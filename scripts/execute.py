#!/usr/bin/env python3
"""Codex Harness Step Executor.

Runs a phase directory step-by-step with Codex CLI, records JSON state, retries
failed steps, and separates code commits from harness metadata commits.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DOTENV_FILES = (".env", ".env.local")
MIGRATION_GATE_EXACT_PATHS = {"drizzle.config.js", "src/db/schema.js"}
MIGRATION_GATE_PREFIXES = ("drizzle/",)
MIGRATION_GATE_COMMANDS = (
    ("migration privacy verification", ("npm", "run", "db:migration:verify")),
    ("migration history check", ("npm", "run", "db:migration:check")),
    ("migration apply", ("npm", "run", "db:migration:apply")),
)


@contextlib.contextmanager
def progress_indicator(label: str):
    frames = "-\\|/"
    stop = threading.Event()
    started = time.monotonic()

    def animate() -> None:
        index = 0
        while not stop.wait(0.12):
            elapsed = int(time.monotonic() - started)
            sys.stderr.write(f"\r{frames[index % len(frames)]} {label} [{elapsed}s]")
            sys.stderr.flush()
            index += 1
        sys.stderr.write("\r" + " " * (len(label) + 24) + "\r")
        sys.stderr.flush()

    thread = threading.Thread(target=animate, daemon=True)
    thread.start()
    info = {"elapsed": 0.0}
    try:
        yield info
    finally:
        stop.set()
        thread.join()
        info["elapsed"] = time.monotonic() - started


class StepExecutor:
    MAX_RETRIES = 3
    TZ = timezone(timedelta(hours=9))

    FEAT_MSG = "feat({phase}): step {num} - {name}"
    CHORE_MSG = "chore({phase}): step {num} output"

    def __init__(
        self,
        phase_dir_name: str,
        *,
        auto_push: bool = False,
        use_branch: bool = True,
        use_commit: bool = True,
        dangerous: bool = False,
        sandbox: str = "workspace-write",
        approval_policy: str = "never",
        model: str | None = None,
        timeout: int = 1800,
        codex_bin: str | None = None,
        root: Path | None = None,
    ):
        self.root = (root or ROOT).resolve()
        self.phases_dir = self.root / "phases"
        self.phase_dir = self.phases_dir / phase_dir_name
        self.phase_dir_name = phase_dir_name
        self.top_index_file = self.phases_dir / "index.json"
        self.index_file = self.phase_dir / "index.json"

        self.auto_push = auto_push
        self.use_branch = use_branch
        self.use_commit = use_commit
        self.dangerous = dangerous
        self.sandbox = sandbox
        self.approval_policy = approval_policy
        self.model = model
        self.timeout = timeout
        self.codex_bin = codex_bin or os.environ.get("CODEX_BIN", "codex")

        if not self.phase_dir.is_dir():
            self._exit(f"ERROR: {self.phase_dir} not found")
        if not self.index_file.exists():
            self._exit(f"ERROR: {self.index_file} not found")

        index = self._read_json(self.index_file)
        self.project = index.get("project", "messaging-app")
        self.phase_name = index.get("phase", phase_dir_name)
        self.total = len(index.get("steps", []))

    def run(self) -> None:
        self._print_header()
        self._check_blockers()
        if self.use_branch:
            self._checkout_branch()
        self._ensure_top_index_entry()
        self._ensure_created_at()
        guardrails = self._load_guardrails()
        self._execute_all_steps(guardrails)
        self._finalize()

    @staticmethod
    def _exit(message: str, code: int = 1) -> None:
        print(message, file=sys.stderr)
        raise SystemExit(code)

    def _stamp(self) -> str:
        return datetime.now(self.TZ).strftime("%Y-%m-%dT%H:%M:%S%z")

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _write_json(path: Path, data: dict[str, Any]) -> None:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def _run_git(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *args],
            cwd=self.root,
            capture_output=True,
            text=True,
        )

    def _current_branch(self) -> str:
        result = self._run_git("rev-parse", "--abbrev-ref", "HEAD")
        if result.returncode != 0:
            self._exit(f"ERROR: git branch lookup failed: {result.stderr.strip()}")
        return result.stdout.strip()

    def _checkout_branch(self) -> None:
        branch = f"feat-{self.phase_name}"
        current = self._current_branch()
        if current == branch:
            print(f"  Branch: {branch}")
            return

        exists = self._run_git("rev-parse", "--verify", branch)
        result = self._run_git("checkout", branch) if exists.returncode == 0 else self._run_git("checkout", "-b", branch)
        if result.returncode != 0:
            self._exit(
                "\n".join(
                    [
                        f"ERROR: failed to checkout {branch}.",
                        result.stderr.strip(),
                        "Hint: commit or stash conflicting changes before running the harness.",
                    ]
                )
            )
        print(f"  Branch: {branch}")

    def _commit_step(self, step_num: int, step_name: str) -> None:
        if not self.use_commit:
            return

        metadata_paths = [
            f"phases/{self.phase_dir_name}/index.json",
            f"phases/{self.phase_dir_name}/step{step_num}-output.json",
            f"phases/{self.phase_dir_name}/step{step_num}-output.md",
            "phases/index.json",
        ]

        self._run_git("add", "-A")
        for path in metadata_paths:
            self._run_git("reset", "HEAD", "--", path)

        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            message = self.FEAT_MSG.format(phase=self.phase_name, num=step_num, name=step_name)
            result = self._run_git("commit", "-m", message)
            if result.returncode == 0:
                print(f"  Commit: {message}")
            else:
                print(f"  WARN: code commit failed: {result.stderr.strip()}")

        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            message = self.CHORE_MSG.format(phase=self.phase_name, num=step_num)
            result = self._run_git("commit", "-m", message)
            if result.returncode == 0:
                print(f"  Commit: {message}")
            else:
                print(f"  WARN: metadata commit failed: {result.stderr.strip()}")

    def _commit_metadata(self, message: str) -> None:
        if not self.use_commit:
            return
        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode == 0:
            return
        result = self._run_git("commit", "-m", message)
        if result.returncode == 0:
            print(f"  Commit: {message}")
        else:
            print(f"  WARN: metadata commit failed: {result.stderr.strip()}")

    def _ensure_top_index_entry(self) -> None:
        if not self.top_index_file.exists():
            self._write_json(self.top_index_file, {"phases": []})

        top = self._read_json(self.top_index_file)
        phases = top.setdefault("phases", [])
        if not any(item.get("dir") == self.phase_dir_name for item in phases):
            phases.append({"dir": self.phase_dir_name, "status": "pending"})
            self._write_json(self.top_index_file, top)

    def _update_top_index(self, status: str) -> None:
        if not self.top_index_file.exists():
            return

        top = self._read_json(self.top_index_file)
        phases = top.setdefault("phases", [])
        phase = next((item for item in phases if item.get("dir") == self.phase_dir_name), None)
        if phase is None:
            phase = {"dir": self.phase_dir_name}
            phases.append(phase)

        phase["status"] = status
        timestamp_key = {
            "completed": "completed_at",
            "error": "failed_at",
            "blocked": "blocked_at",
        }.get(status)
        if timestamp_key:
            phase[timestamp_key] = self._stamp()
        self._write_json(self.top_index_file, top)

    def _load_guardrails(self) -> str:
        sections: list[str] = []
        agents_md = self.root / "AGENTS.md"
        if agents_md.exists():
            sections.append(f"## Project Rules (AGENTS.md)\n\n{agents_md.read_text(encoding='utf-8')}")

        docs_dir = self.root / "docs"
        if docs_dir.is_dir():
            for doc in sorted(docs_dir.glob("*.md")):
                sections.append(f"## {doc.relative_to(self.root)}\n\n{doc.read_text(encoding='utf-8')}")

        return "\n\n---\n\n".join(sections)

    @staticmethod
    def _build_step_context(index: dict[str, Any]) -> str:
        lines = [
            f"- Step {step['step']} ({step['name']}): {step['summary']}"
            for step in index.get("steps", [])
            if step.get("status") == "completed" and step.get("summary")
        ]
        if not lines:
            return ""
        return "## Previous Step Outputs\n\n" + "\n".join(lines) + "\n\n"

    def _build_preamble(self, guardrails: str, step_context: str, prev_error: str | None = None) -> str:
        retry_section = ""
        if prev_error:
            retry_section = (
                "## Previous Attempt Failure\n\n"
                "Use this concrete failure information to repair the implementation:\n\n"
                f"{prev_error}\n\n---\n\n"
            )

        return (
            f"You are Codex executing a harness step for `{self.project}`.\n\n"
            "## Harness Contract\n\n"
            f"- Phase directory: `phases/{self.phase_dir_name}`.\n"
            f"- Step status file: `phases/{self.phase_dir_name}/index.json`.\n"
            "- Do only the work requested by the step file.\n"
            "- Read the files named by the step before editing.\n"
            "- Keep implementation consistent with the project guardrails below.\n"
            "- Run the step Acceptance Criteria commands before marking the step completed.\n"
            "- If schema or Drizzle migration files change, run migration verification and apply the reviewed migrations against the local DB before marking the step completed.\n"
            "- The harness enforces this with a post-step migration gate and may retry or fail the step if migration checks/apply fail.\n"
            "- Do not create branches, commit, or push; the harness executor handles git operations after you exit.\n"
            "- If the step succeeds, update this step to `completed` and add a one-line `summary`.\n"
            "- If user input or external credentials are required, update this step to `blocked` and add `blocked_reason`.\n"
            "- If the step cannot be completed after reasonable self-correction, update this step to `error` and add `error_message`.\n\n"
            "---\n\n"
            "## Project Guardrails\n\n"
            f"{guardrails}\n\n"
            "---\n\n"
            f"{step_context}"
            f"{retry_section}"
        )

    def _invoke_codex(self, step: dict[str, Any], preamble: str) -> dict[str, Any]:
        step_num = step["step"]
        step_name = step["name"]
        step_file = self.phase_dir / f"step{step_num}.md"
        if not step_file.exists():
            self._exit(f"ERROR: {step_file} not found")

        output_md = self.phase_dir / f"step{step_num}-output.md"
        output_json = self.phase_dir / f"step{step_num}-output.json"
        prompt = preamble + step_file.read_text(encoding="utf-8")

        command = [self.codex_bin, "exec", "-C", str(self.root)]
        if self.model:
            command.extend(["-m", self.model])
        if self.dangerous:
            command.append("--dangerously-bypass-approvals-and-sandbox")
        else:
            command.extend(["-s", self.sandbox])
            if self.approval_policy:
                command.extend(["-c", f'approval_policy="{self.approval_policy}"'])
        command.extend(["--output-last-message", str(output_md), "-"])

        env = os.environ.copy()
        env.setdefault("TERM", "xterm-256color")
        env.setdefault("NO_COLOR", "1")
        env.setdefault("GIT_TERMINAL_PROMPT", "0")

        result = subprocess.run(
            command,
            cwd=self.root,
            input=prompt,
            capture_output=True,
            text=True,
            timeout=self.timeout,
            env=env,
        )

        final_message = output_md.read_text(encoding="utf-8") if output_md.exists() else ""
        output = {
            "step": step_num,
            "name": step_name,
            "command": command,
            "exitCode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "finalMessage": final_message,
        }
        output_json.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        if result.returncode != 0:
            print(f"\n  WARN: Codex exited with code {result.returncode}")
            if result.stderr:
                print(f"  stderr: {result.stderr[:500]}")

        return output

    def _print_header(self) -> None:
        print(f"\n{'=' * 60}")
        print("  Codex Harness Step Executor")
        print(f"  Phase: {self.phase_name} | Steps: {self.total}")
        print(f"  Branch: {'enabled' if self.use_branch else 'disabled'}")
        print(f"  Commits: {'enabled' if self.use_commit else 'disabled'}")
        if self.auto_push:
            print("  Auto-push: enabled")
        print(f"{'=' * 60}")

    def _check_blockers(self) -> None:
        index = self._read_json(self.index_file)
        for step in index.get("steps", []):
            status = step.get("status", "pending")
            if status == "error":
                print(f"\n  ERROR: Step {step['step']} ({step['name']}) is marked error.")
                print(f"  {step.get('error_message', 'unknown error')}")
                print("  Reset it to pending after fixing the issue.")
                raise SystemExit(1)
            if status == "blocked":
                print(f"\n  BLOCKED: Step {step['step']} ({step['name']}) is marked blocked.")
                print(f"  {step.get('blocked_reason', 'unknown blocker')}")
                print("  Reset it to pending after resolving the blocker.")
                raise SystemExit(2)
            if status == "pending":
                break

    def _ensure_created_at(self) -> None:
        index = self._read_json(self.index_file)
        if "created_at" not in index:
            index["created_at"] = self._stamp()
            self._write_json(self.index_file, index)

    def _mark_step_started(self, step_num: int) -> None:
        index = self._read_json(self.index_file)
        for step in index.get("steps", []):
            if step.get("step") == step_num and "started_at" not in step:
                step["started_at"] = self._stamp()
                self._write_json(self.index_file, index)
                return

    @staticmethod
    def _find_step(index: dict[str, Any], step_num: int) -> dict[str, Any]:
        for step in index.get("steps", []):
            if step.get("step") == step_num:
                return step
        raise KeyError(f"step {step_num} not found")

    @staticmethod
    def _fallback_summary(output: dict[str, Any], step_name: str) -> str:
        final_message = output.get("finalMessage", "").strip()
        if final_message:
            return final_message.splitlines()[0][:160]
        return f"{step_name} completed"

    @staticmethod
    def _error_message(step_state: dict[str, Any], output: dict[str, Any]) -> str:
        if step_state.get("error_message"):
            return str(step_state["error_message"])
        if output.get("exitCode") != 0:
            stderr = str(output.get("stderr", "")).strip()
            if stderr:
                return f"Codex exited with code {output['exitCode']}: {stderr[:700]}"
            return f"Codex exited with code {output['exitCode']}"
        return "Step did not update its status to completed or blocked."

    def _changed_paths(self) -> set[str]:
        result = self._run_git("status", "--porcelain", "--untracked-files=all")
        if result.returncode != 0:
            return set()

        paths: set[str] = set()
        for line in result.stdout.splitlines():
            if len(line) < 4:
                continue
            path_text = line[3:].strip()
            if " -> " in path_text:
                paths.update(part.strip() for part in path_text.split(" -> ") if part.strip())
            elif path_text:
                paths.add(path_text)
        return paths

    @staticmethod
    def _requires_migration_gate(paths: set[str]) -> bool:
        for path in paths:
            if path in MIGRATION_GATE_EXACT_PATHS:
                return True
            if any(path.startswith(prefix) for prefix in MIGRATION_GATE_PREFIXES):
                return True
        return False

    def _migration_env(self) -> dict[str, str]:
        env: dict[str, str] = {}
        for env_file_name in DOTENV_FILES:
            env.update(self._read_dotenv_file(self.root / env_file_name))
        env.update(os.environ)
        env.setdefault("TERM", "xterm-256color")
        env.setdefault("NO_COLOR", "1")
        env.setdefault("GIT_TERMINAL_PROMPT", "0")
        return env

    @staticmethod
    def _read_dotenv_file(path: Path) -> dict[str, str]:
        if not path.exists():
            return {}

        values: dict[str, str] = {}
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if line.startswith("export "):
                line = line[len("export "):].strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, raw_value = line.split("=", 1)
            key = key.strip()
            if not key:
                continue
            value = raw_value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            values[key] = value
        return values

    def _append_post_step_checks(self, step_num: int, checks: list[dict[str, Any]]) -> None:
        output_json = self.phase_dir / f"step{step_num}-output.json"
        if not output_json.exists():
            return

        output = self._read_json(output_json)
        output["postStepChecks"] = checks
        output_json.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def _run_post_step_migration_gate(self, step_num: int) -> str | None:
        changed_paths = self._changed_paths()
        if not self._requires_migration_gate(changed_paths):
            return None

        env = self._migration_env()
        checks: list[dict[str, Any]] = []
        if not env.get("DATABASE_MIGRATION_URL") and not env.get("DATABASE_URL"):
            message = (
                "Post-step migration gate detected schema or migration changes, but "
                "DATABASE_MIGRATION_URL or DATABASE_URL is not available after loading .env and .env.local."
            )
            checks.append({
                "name": "migration env check",
                "exitCode": 1,
                "stdout": "",
                "stderr": message,
            })
            self._append_post_step_checks(step_num, checks)
            return message

        print("  Migration gate: schema/migration changes detected")
        for name, command in MIGRATION_GATE_COMMANDS:
            result = subprocess.run(
                list(command),
                cwd=self.root,
                capture_output=True,
                text=True,
                env=env,
            )
            checks.append({
                "name": name,
                "command": list(command),
                "exitCode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
            })
            if result.returncode != 0:
                self._append_post_step_checks(step_num, checks)
                detail = (result.stderr or result.stdout).strip()
                return f"Post-step migration gate failed during {name}: {detail[:700]}"

        self._append_post_step_checks(step_num, checks)
        print("  Migration gate: verify/check/apply passed")
        return None

    def _execute_single_step(self, step: dict[str, Any], guardrails: str) -> None:
        step_num = step["step"]
        step_name = step["name"]
        previous_error: str | None = None

        for attempt in range(1, self.MAX_RETRIES + 1):
            index = self._read_json(self.index_file)
            completed_count = sum(1 for item in index.get("steps", []) if item.get("status") == "completed")
            step_context = self._build_step_context(index)
            preamble = self._build_preamble(guardrails, step_context, previous_error)

            label = f"Step {step_num}/{self.total - 1} ({completed_count} done): {step_name}"
            if attempt > 1:
                label += f" retry {attempt}/{self.MAX_RETRIES}"

            with progress_indicator(label) as progress:
                output = self._invoke_codex(step, preamble)
            elapsed = int(progress["elapsed"])

            index = self._read_json(self.index_file)
            step_state = self._find_step(index, step_num)
            status = step_state.get("status", "pending")
            timestamp = self._stamp()

            if status == "completed":
                migration_gate_error = self._run_post_step_migration_gate(step_num)
                if migration_gate_error:
                    if attempt < self.MAX_RETRIES:
                        step_state["status"] = "pending"
                        step_state.pop("error_message", None)
                        step_state.pop("failed_at", None)
                        self._write_json(self.index_file, index)
                        previous_error = migration_gate_error
                        print(f"  RETRY Step {step_num}: {migration_gate_error}")
                        continue

                    step_state["status"] = "error"
                    step_state["error_message"] = f"[{self.MAX_RETRIES} attempts failed] {migration_gate_error}"
                    step_state["failed_at"] = timestamp
                    self._write_json(self.index_file, index)
                    self._update_top_index("error")
                    self._commit_step(step_num, step_name)
                    print(f"  ERROR Step {step_num}: {step_name} failed migration gate after {self.MAX_RETRIES} attempts [{elapsed}s]")
                    print(f"  {migration_gate_error}")
                    raise SystemExit(1)

                step_state["completed_at"] = timestamp
                step_state.setdefault("summary", self._fallback_summary(output, step_name))
                self._write_json(self.index_file, index)
                self._commit_step(step_num, step_name)
                print(f"  OK Step {step_num}: {step_name} [{elapsed}s]")
                return

            if status == "blocked":
                step_state["blocked_at"] = timestamp
                self._write_json(self.index_file, index)
                self._update_top_index("blocked")
                print(f"  BLOCKED Step {step_num}: {step_name} [{elapsed}s]")
                print(f"  Reason: {step_state.get('blocked_reason', 'unknown blocker')}")
                raise SystemExit(2)

            error_message = self._error_message(step_state, output)

            if attempt < self.MAX_RETRIES:
                step_state["status"] = "pending"
                step_state.pop("error_message", None)
                step_state.pop("failed_at", None)
                self._write_json(self.index_file, index)
                previous_error = error_message
                print(f"  RETRY Step {step_num}: {error_message}")
                continue

            step_state["status"] = "error"
            step_state["error_message"] = f"[{self.MAX_RETRIES} attempts failed] {error_message}"
            step_state["failed_at"] = timestamp
            self._write_json(self.index_file, index)
            self._update_top_index("error")
            self._commit_step(step_num, step_name)
            print(f"  ERROR Step {step_num}: {step_name} failed after {self.MAX_RETRIES} attempts [{elapsed}s]")
            print(f"  {error_message}")
            raise SystemExit(1)

    def _execute_all_steps(self, guardrails: str) -> None:
        while True:
            index = self._read_json(self.index_file)
            pending = next((step for step in index.get("steps", []) if step.get("status") == "pending"), None)
            if pending is None:
                print("\n  All steps completed.")
                return

            self._mark_step_started(pending["step"])
            self._execute_single_step(pending, guardrails)

    def _finalize(self) -> None:
        index = self._read_json(self.index_file)
        index["status"] = "completed"
        index["completed_at"] = self._stamp()
        self._write_json(self.index_file, index)
        self._update_top_index("completed")
        self._commit_metadata(f"chore({self.phase_name}): mark phase completed")

        if self.auto_push:
            branch = f"feat-{self.phase_name}" if self.use_branch else self._current_branch()
            result = self._run_git("push", "-u", "origin", branch)
            if result.returncode != 0:
                self._exit(f"ERROR: git push failed: {result.stderr.strip()}")
            print(f"  Pushed to origin/{branch}")

        print(f"\n{'=' * 60}")
        print(f"  Phase '{self.phase_name}' completed.")
        print(f"{'=' * 60}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Codex Harness Step Executor")
    parser.add_argument("phase_dir", help="Phase directory name, for example 0-mvp")
    parser.add_argument("--push", action="store_true", help="Push the phase branch after completion")
    parser.add_argument("--no-branch", action="store_true", help="Run on the current branch")
    parser.add_argument("--no-commit", action="store_true", help="Do not create harness commits")
    parser.add_argument("--dangerous", action="store_true", help="Bypass Codex sandbox and approvals")
    parser.add_argument("--sandbox", default="workspace-write", help="Codex sandbox mode")
    parser.add_argument("--approval-policy", default="never", help="Codex approval policy")
    parser.add_argument("--model", default=None, help="Optional Codex model override")
    parser.add_argument("--timeout", type=int, default=1800, help="Per-step Codex timeout in seconds")
    parser.add_argument("--codex-bin", default=None, help="Codex executable path")
    args = parser.parse_args()

    StepExecutor(
        args.phase_dir,
        auto_push=args.push,
        use_branch=not args.no_branch,
        use_commit=not args.no_commit,
        dangerous=args.dangerous,
        sandbox=args.sandbox,
        approval_policy=args.approval_policy,
        model=args.model,
        timeout=args.timeout,
        codex_bin=args.codex_bin,
    ).run()


if __name__ == "__main__":
    main()
