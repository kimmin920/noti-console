# Harness Review

Use Codex review for repository changes that should be checked against the
harness rules.

## Command

```bash
npm run harness:review
```

## Checklist

| Item | Question |
| --- | --- |
| Architecture | Does the change follow `docs/ARCHITECTURE.md`? |
| ADR | Does the change respect decisions in `docs/ADR.md`? |
| UI | Does product UI follow `docs/UI_GUIDE.md`? |
| Project rules | Does the change obey `AGENTS.md`? |
| Verification | Did `npm run lint` and `npm run build` pass? |

Reviews should prioritize bugs, behavior regressions, architecture drift, and
missing verification.
