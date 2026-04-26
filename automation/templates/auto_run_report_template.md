# Auto Run Report — DuLichCali

Run ID:
Date:
Prompt:
Run dir:
Status: PASS / FAIL

---

## Prompt Used

See: `automation/reports/auto_runs/<run_id>/prompt_used.md`

---

## Check Results

| Result | Check | Command |
|--------|-------|---------|
| PASS / FAIL / SKIPPED | npm run test:receptionist | `npm run test:receptionist` |
| SKIPPED | lint | no lint script |
| SKIPPED | build | no build step (static HTML) |
| SKIPPED | typecheck | no typecheck script |

Full log: `automation/reports/auto_runs/<run_id>/checks.log`

---

## Claude API

Status: PASS / FAIL / SKIPPED

Output: `automation/reports/auto_runs/<run_id>/claude_output.txt`
OR
Manual prompt: `automation/reports/auto_runs/<run_id>/claude_prompt.txt`

---

## Files in This Run

| File | Purpose |
|------|---------|
| `prompt_used.md` | Exact prompt that drove this run |
| `git_status.txt` | Branch, status, recent commits |
| `file_inventory.txt` | Key file sizes and paths |
| `context.txt` | Package scripts + env var names (no values) |
| `file_excerpts.txt` | Key file excerpts for context |
| `checks.log` | Raw check output |
| `claude_prompt.txt` | Combined context + prompt sent to Claude |
| `claude_output.txt` | Claude API response (if API mode) |
| `claude_error.txt` | API errors if any |

---

## Next Steps

[Fill in after run]
