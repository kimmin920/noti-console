import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import execute as ex


def completed(args=None, code=0, stdout="", stderr=""):
    return subprocess.CompletedProcess(args or [], code, stdout=stdout, stderr=stderr)


class ExecutorTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "AGENTS.md").write_text("# Rules\n\n- Keep scope small.\n", encoding="utf-8")
        docs = self.root / "docs"
        docs.mkdir()
        (docs / "ADR.md").write_text("# ADR\n", encoding="utf-8")
        (docs / "ARCHITECTURE.md").write_text("# Architecture\n", encoding="utf-8")

        phase = self.root / "phases" / "0-mvp"
        phase.mkdir(parents=True)
        (self.root / "phases" / "index.json").write_text(
            json.dumps({"phases": [{"dir": "0-mvp", "status": "pending"}]}, indent=2),
            encoding="utf-8",
        )
        (phase / "index.json").write_text(
            json.dumps(
                {
                    "project": "messaging-app",
                    "phase": "0-mvp",
                    "steps": [
                        {"step": 0, "name": "setup", "status": "pending"},
                    ],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        (phase / "step0.md").write_text("# Step 0: setup\n\n## Task\n\nDo setup.\n", encoding="utf-8")
        self.phase = phase

    def tearDown(self):
        self.tmp.cleanup()

    def make_executor(self, **kwargs):
        return ex.StepExecutor(
            "0-mvp",
            root=self.root,
            use_branch=kwargs.pop("use_branch", False),
            use_commit=kwargs.pop("use_commit", False),
            **kwargs,
        )


class TestGuardrails(ExecutorTestCase):
    def test_loads_agents_and_docs(self):
        executor = self.make_executor()
        guardrails = executor._load_guardrails()

        self.assertIn("AGENTS.md", guardrails)
        self.assertIn("Keep scope small", guardrails)
        self.assertIn("docs/ADR.md", guardrails)
        self.assertIn("docs/ARCHITECTURE.md", guardrails)

    def test_build_step_context_uses_completed_summaries(self):
        context = ex.StepExecutor._build_step_context(
            {
                "steps": [
                    {"step": 0, "name": "setup", "status": "completed", "summary": "created app"},
                    {"step": 1, "name": "ui", "status": "pending"},
                ]
            }
        )

        self.assertIn("Step 0 (setup): created app", context)
        self.assertNotIn("ui", context)


class TestCodexInvocation(ExecutorTestCase):
    def test_invokes_codex_exec_with_prompt_on_stdin(self):
        executor = self.make_executor(codex_bin="codex-test", model="gpt-test", timeout=12)
        captured = {}

        def fake_run(command, **kwargs):
            captured["command"] = command
            captured["input"] = kwargs["input"]
            output_path = Path(command[command.index("--output-last-message") + 1])
            output_path.write_text("final report\n", encoding="utf-8")
            return completed(command, stdout="stdout text", stderr="")

        with patch("subprocess.run", side_effect=fake_run):
            output = executor._invoke_codex({"step": 0, "name": "setup"}, "PREAMBLE\n")

        self.assertEqual(captured["command"][:4], ["codex-test", "exec", "-C", str(executor.root)])
        self.assertIn("-m", captured["command"])
        self.assertIn("gpt-test", captured["command"])
        self.assertIn("-c", captured["command"])
        self.assertIn('approval_policy="never"', captured["command"])
        self.assertIn("--output-last-message", captured["command"])
        self.assertEqual(captured["command"][-1], "-")
        self.assertIn("PREAMBLE", captured["input"])
        self.assertIn("Do setup", captured["input"])
        self.assertEqual(output["finalMessage"], "final report\n")

        output_json = json.loads((self.phase / "step0-output.json").read_text(encoding="utf-8"))
        self.assertEqual(output_json["exitCode"], 0)
        self.assertEqual(output_json["finalMessage"], "final report\n")

    def test_dangerous_flag_uses_codex_bypass(self):
        executor = self.make_executor(codex_bin="codex-test", dangerous=True)

        def fake_run(command, **kwargs):
            output_path = Path(command[command.index("--output-last-message") + 1])
            output_path.write_text("", encoding="utf-8")
            self.assertIn("--dangerously-bypass-approvals-and-sandbox", command)
            self.assertNotIn("-s", command)
            self.assertNotIn("-c", command)
            return completed(command)

        with patch("subprocess.run", side_effect=fake_run):
            executor._invoke_codex({"step": 0, "name": "setup"}, "")


class TestStateTransitions(ExecutorTestCase):
    def test_completed_step_gets_timestamp_and_summary(self):
        executor = self.make_executor()

        def fake_invoke(step, preamble):
            index = json.loads((self.phase / "index.json").read_text(encoding="utf-8"))
            index["steps"][0]["status"] = "completed"
            index["steps"][0]["summary"] = "setup done"
            (self.phase / "index.json").write_text(json.dumps(index), encoding="utf-8")
            return {"exitCode": 0, "finalMessage": "unused"}

        executor._invoke_codex = fake_invoke
        executor._execute_single_step({"step": 0, "name": "setup"}, "guardrails")

        index = json.loads((self.phase / "index.json").read_text(encoding="utf-8"))
        step = index["steps"][0]
        self.assertEqual(step["status"], "completed")
        self.assertEqual(step["summary"], "setup done")
        self.assertIn("completed_at", step)

    def test_retries_until_step_completes(self):
        executor = self.make_executor()
        calls = {"count": 0}

        def fake_invoke(step, preamble):
            calls["count"] += 1
            if calls["count"] == 2:
                index = json.loads((self.phase / "index.json").read_text(encoding="utf-8"))
                index["steps"][0]["status"] = "completed"
                index["steps"][0]["summary"] = "setup done"
                (self.phase / "index.json").write_text(json.dumps(index), encoding="utf-8")
            return {"exitCode": 0, "finalMessage": ""}

        executor._invoke_codex = fake_invoke
        executor._execute_single_step({"step": 0, "name": "setup"}, "guardrails")

        self.assertEqual(calls["count"], 2)

    def test_marks_error_after_max_retries(self):
        executor = self.make_executor()
        executor._invoke_codex = lambda step, preamble: {"exitCode": 0, "finalMessage": ""}

        with self.assertRaises(SystemExit) as raised:
            executor._execute_single_step({"step": 0, "name": "setup"}, "guardrails")

        self.assertEqual(raised.exception.code, 1)
        index = json.loads((self.phase / "index.json").read_text(encoding="utf-8"))
        step = index["steps"][0]
        self.assertEqual(step["status"], "error")
        self.assertIn("failed_at", step)
        self.assertIn("3 attempts failed", step["error_message"])

    def test_blocked_updates_top_index(self):
        executor = self.make_executor()

        def fake_invoke(step, preamble):
            index = json.loads((self.phase / "index.json").read_text(encoding="utf-8"))
            index["steps"][0]["status"] = "blocked"
            index["steps"][0]["blocked_reason"] = "needs API key"
            (self.phase / "index.json").write_text(json.dumps(index), encoding="utf-8")
            return {"exitCode": 0, "finalMessage": ""}

        executor._invoke_codex = fake_invoke

        with self.assertRaises(SystemExit) as raised:
            executor._execute_single_step({"step": 0, "name": "setup"}, "guardrails")

        self.assertEqual(raised.exception.code, 2)
        top = json.loads((self.root / "phases" / "index.json").read_text(encoding="utf-8"))
        self.assertEqual(top["phases"][0]["status"], "blocked")
        self.assertIn("blocked_at", top["phases"][0])


class TestMigrationGate(ExecutorTestCase):
    def test_skips_when_schema_and_migrations_are_unchanged(self):
        executor = self.make_executor()
        executor._changed_paths = lambda: {"src/server/messages/service.js"}

        with patch("subprocess.run") as run:
            error = executor._run_post_step_migration_gate(0)

        self.assertIsNone(error)
        run.assert_not_called()

    def test_runs_migration_commands_with_dotenv_values(self):
        executor = self.make_executor()
        executor._changed_paths = lambda: {"src/db/schema.js", "drizzle/0001_initial.sql"}
        (self.root / ".env.local").write_text("DATABASE_URL=postgres://local-db\n", encoding="utf-8")
        (self.phase / "step0-output.json").write_text(json.dumps({"step": 0}, indent=2), encoding="utf-8")
        calls = []

        def fake_run(command, **kwargs):
            calls.append((command, kwargs["env"].get("DATABASE_URL")))
            return completed(command, stdout="ok")

        with patch.dict(os.environ, {}, clear=True), patch("subprocess.run", side_effect=fake_run):
            error = executor._run_post_step_migration_gate(0)

        self.assertIsNone(error)
        self.assertEqual(
            [call[0] for call in calls],
            [
                ["npm", "run", "db:migration:verify"],
                ["npm", "run", "db:migration:check"],
                ["npm", "run", "db:migration:apply"],
            ],
        )
        self.assertEqual([call[1] for call in calls], ["postgres://local-db"] * 3)
        output_json = json.loads((self.phase / "step0-output.json").read_text(encoding="utf-8"))
        self.assertEqual(len(output_json["postStepChecks"]), 3)

    def test_fails_when_migration_changes_have_no_database_url(self):
        executor = self.make_executor()
        executor._changed_paths = lambda: {"drizzle/0001_initial.sql"}
        (self.phase / "step0-output.json").write_text(json.dumps({"step": 0}, indent=2), encoding="utf-8")

        with patch.dict(os.environ, {}, clear=True):
            error = executor._run_post_step_migration_gate(0)

        self.assertIn("DATABASE_MIGRATION_URL or DATABASE_URL", error)
        output_json = json.loads((self.phase / "step0-output.json").read_text(encoding="utf-8"))
        self.assertEqual(output_json["postStepChecks"][0]["exitCode"], 1)

    def test_completed_step_retries_when_migration_gate_fails(self):
        executor = self.make_executor()
        invokes = {"count": 0}
        gate_errors = ["migration failed", None]

        def fake_invoke(step, preamble):
            invokes["count"] += 1
            index = json.loads((self.phase / "index.json").read_text(encoding="utf-8"))
            index["steps"][0]["status"] = "completed"
            index["steps"][0]["summary"] = "setup done"
            (self.phase / "index.json").write_text(json.dumps(index), encoding="utf-8")
            return {"exitCode": 0, "finalMessage": ""}

        executor._invoke_codex = fake_invoke
        executor._run_post_step_migration_gate = lambda step_num: gate_errors.pop(0)
        executor._execute_single_step({"step": 0, "name": "setup"}, "guardrails")

        self.assertEqual(invokes["count"], 2)


class TestGitBehavior(ExecutorTestCase):
    def test_checkout_branch_creates_missing_branch(self):
        executor = self.make_executor(use_branch=True)
        calls = []
        responses = [
            completed(stdout="main\n"),
            completed(code=1, stderr="missing"),
            completed(),
        ]

        def fake_git(*args):
            calls.append(args)
            return responses.pop(0)

        executor._run_git = fake_git
        executor._checkout_branch()

        self.assertEqual(calls[2], ("checkout", "-b", "feat-0-mvp"))

    def test_commit_step_splits_code_and_metadata_commits(self):
        executor = self.make_executor(use_commit=True)
        calls = []
        diff_count = {"count": 0}

        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                diff_count["count"] += 1
                return completed(code=1)
            return completed()

        executor._run_git = fake_git
        executor._commit_step(0, "setup")

        reset_paths = [call[-1] for call in calls if call and call[0] == "reset"]
        self.assertIn("phases/0-mvp/index.json", reset_paths)
        self.assertIn("phases/0-mvp/step0-output.json", reset_paths)

        commit_messages = [call[2] for call in calls if call and call[0] == "commit"]
        self.assertEqual(commit_messages[0], "feat(0-mvp): step 0 - setup")
        self.assertEqual(commit_messages[1], "chore(0-mvp): step 0 output")


class TestFinalize(ExecutorTestCase):
    def test_finalize_marks_phase_completed(self):
        executor = self.make_executor()
        index = json.loads((self.phase / "index.json").read_text(encoding="utf-8"))
        index["steps"][0]["status"] = "completed"
        index["steps"][0]["summary"] = "done"
        (self.phase / "index.json").write_text(json.dumps(index), encoding="utf-8")

        executor._finalize()

        phase_index = json.loads((self.phase / "index.json").read_text(encoding="utf-8"))
        top = json.loads((self.root / "phases" / "index.json").read_text(encoding="utf-8"))
        self.assertEqual(phase_index["status"], "completed")
        self.assertIn("completed_at", phase_index)
        self.assertEqual(top["phases"][0]["status"], "completed")
        self.assertIn("completed_at", top["phases"][0])


if __name__ == "__main__":
    unittest.main()
