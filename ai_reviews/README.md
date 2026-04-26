# AI Review Workflow — DuLichCali

This directory implements a disciplined Codex → Claude review flow.
Codex reviews first. Claude audits second. Claude fixes only confirmed issues.

---

## Workflow Steps

### 1. Create a branch and open a PR

```bash
git checkout -b feature/<name>
# make changes
git push origin feature/<name>
# open PR on GitHub
```

### 2. Trigger Codex review on the PR

In the GitHub PR comment box, type:

```
@codex review
```

Codex will analyze the diff and post review comments on the PR.

### 3. Claude copies Codex findings

Claude copies or summarizes Codex findings into:

```
ai_reviews/codex_reviews/YYYY-MM-DD_<branch-or-pr>_codex.md
```

Use the script to pre-create timestamped files:

```bash
./scripts/ai_review_flow.sh <branch-or-pr-name>
```

### 4. Claude independently validates each finding

Claude reads the actual current source files — never trusts Codex output blindly.
Each finding is classified:

| Classification | Meaning |
|---|---|
| `CONFIRMED_BUG` | Verified against source, definitely broken |
| `VALID_IMPROVEMENT` | Real improvement but not a bug — needs user approval to fix |
| `FALSE_POSITIVE` | Codex was wrong; code is correct |
| `NEEDS_HUMAN_DECISION` | Ambiguous; risk too high to decide alone |
| `OUT_OF_SCOPE` | Correct but unrelated to this PR |

Claude writes audit findings to:

```
ai_reviews/claude_audits/YYYY-MM-DD_<branch-or-pr>_claude_audit.md
```

### 5. Claude fixes CONFIRMED_BUG items only

- No unrequested refactors.
- No VALID_IMPROVEMENT fixes unless user explicitly says so.
- No rewrites of unrelated files.
- Every fix is small, reversible, and auditable.

### 6. Claude runs regression checks after every fix

```bash
npm run test:receptionist        # AI receptionist unit tests
node tests/runner.js             # full test runner
firebase deploy --only functions # only if functions were changed
```

Manual QA flows are listed in every fix report.

### 7. Claude writes fix report

```
ai_reviews/fix_reports/YYYY-MM-DD_<branch-or-pr>_fix_report.md
```

Fix report must include: findings fixed, findings rejected, files changed, commands run, manual QA checklist, final decision.

---

## Directory Layout

```
ai_reviews/
  README.md                     ← this file
  codex_reviews/                ← raw Codex output, one file per PR
  claude_audits/                ← Claude classification of Codex findings
  fix_reports/                  ← Claude fix summary + test results
  regression_logs/              ← raw test/build output captured during review
  templates/
    codex_review_request.md     ← paste into GitHub PR to request Codex review
    claude_audit_template.md    ← template for claude_audits/ files
    fix_report_template.md      ← template for fix_reports/ files
```

---

## DuLichCali-Specific Risk Areas

Codex and Claude must always check these:

| Risk Area | Why |
|---|---|
| Vendor pages (Luxurious Nails, Beauty Hair OC) | Must show vendor-specific data, not directory listings |
| AI receptionist behavior | Real-time clock + staff schedule + language detection |
| Booking availability check | Must gate before confirmation, not after |
| Airport/ride vehicle capacity | 4-seat car must not be assigned to 7 or 12 people |
| Travel package carousel | Remotion/YouTube embeds must not break image carousels |
| Mobile layout | Mobile is primary — all changes must pass mobile first |
| JS version strings | Every modified `.js` file needs bumped `?v=` in all HTML consumers |
| Firebase secret exposure | `CLAUDE_API_KEY` lives in Cloud Secret Manager only — never in source |
| Multi-language strings | All customer-facing strings must exist in vi + en + es |
| Firestore schema | Do not add/remove fields without updating security rules |

---

## Quickstart

```bash
# From DuLichCali project root:
./scripts/ai_review_flow.sh my-feature-branch

# This creates:
#   ai_reviews/codex_reviews/2026-04-26_my-feature-branch_codex.md
#   ai_reviews/claude_audits/2026-04-26_my-feature-branch_claude_audit.md
#   ai_reviews/fix_reports/2026-04-26_my-feature-branch_fix_report.md
#
# Then paste ai_reviews/templates/codex_review_request.md into your GitHub PR.
# Type @codex review in the PR.
# When Codex responds, fill in codex_reviews/ file, then run claude audit.
```

---

## Security Rules

- Never include actual API keys, Firebase credentials, customer data, booking data, or vendor private data in any review file.
- Review files are committed to the repo — treat them as public documents.
- If a finding involves secret exposure, note the finding category only, not the value.
