# Audit Report — DuLichCali

Prompt:
Run ID:
Date:
Auditor: Claude (claude-sonnet-4-6)

---

## Executive Summary

[Overall health assessment. How does the target compare to the reference standard?]

---

## Feature Comparison Table

| Feature | Reference (Luxurious Nails) | Target (Beauty Hair OC) | Gap | Root Cause | Priority |
|---|---|---|---|---|---|

---

## Confirmed Findings

### P0 — Production Blockers

#### [ID]: [Title]

- **Severity:** P0
- **Symptom:** [what the user sees or what breaks]
- **Root cause:** [file + line or code path]
- **Files involved:** [`file.js:line`]
- **Proposed fix:** [smallest safe change]
- **Risk:** [what else could break]
- **Required test:** [how to verify]

### P1 — Major User-Facing Bugs

[same format]

### P2 — Important Weaknesses

[same format]

### P3 — Improvements

[same format, brief]

---

## Root Cause Analysis

[Are issues in shared code paths or vendor-specific code?
Which files are responsible?
What is the fix strategy?]

---

## Recommended Fix Order

1. P0 fixes (required before any deployment)
2. P1 fixes (required before release)
3. P2 fixes (recommended, can ship separately)
4. P3 fixes (nice-to-have, defer)

---

## Regression Risks

[What could break when applying these fixes?
Which flows must be retested?]

---

## Findings Requiring Human Decision

[List any findings that are too ambiguous or risky to fix autonomously.
Explain what decision is needed.]

---

## Stop — Do Not Fix Yet

This is an audit report only.
Review findings and approve the fix phase before proceeding to:

```bash
./automation/auto_run.sh automation/prompts/phase1_hair_salon_fix.md
```
