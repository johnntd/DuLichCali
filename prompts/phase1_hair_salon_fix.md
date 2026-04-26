# DuLichCali — Phase 1 Hair Salon Fix

## Role

You are approved to fix confirmed P0 and P1 issues from the hair salon audit.

Fix only what the audit confirmed. Nothing else.

---

## Primary Target

Beauty Hair OC — `hairsalon/index.html` and files it loads.

Reference standard: Luxurious Nails at `/nailsalon?id=luxurious-nails`.

---

## Hard Rules

- Fix **only confirmed P0/P1** items from the audit report.
- Do **not** touch Luxurious Nails data or nailsalon booking logic.
- Do **not** touch airport/ride, travel packages, food vendors, admin pages unless the confirmed bug directly requires it.
- Do **not** rewrite vendor architecture.
- Do **not** broadly refactor unrelated code.
- Prefer **minimal patches** — smallest safe change per issue.
- Preserve all existing **routes and Firestore field names**.
- Beauty Hair OC must remain a **single-vendor page**, not a directory page.
- Every fix must be **reversible and auditable**.

---

## Version String Rule

For every `.js` file modified, bump `?v=` in every HTML file that loads it:

```bash
grep -rn "filename.js" . --include="*.html"
```

Use `v=20260426a` or higher. Never reuse a previously deployed version string.

---

## After Each Fix

```bash
scripts/ai/full_system_dry_run.sh
```

All tests must pass after every fix. If any test fails, fix the failure before moving to the next issue.

---

## Required Checks Before Marking Complete

```bash
scripts/ai/targeted_dry_run.sh hair-salon
scripts/ai/full_system_dry_run.sh
```

Both must end `FINAL: PASS`.

---

## Manual QA Checklist

- [ ] Luxurious Nails page still loads and AI works
- [ ] Luxurious Nails booking still works
- [ ] Beauty Hair OC page loads
- [ ] Beauty Hair OC shows vendor-specific name, phone, address, hours
- [ ] Beauty Hair OC does NOT show nail salon data or directory data
- [ ] Hair services and pricing shown
- [ ] Stylists shown (Michael, Michele, Tracy)
- [ ] AI receptionist (Michelle) opens and responds
- [ ] AI uses Beauty Hair OC context
- [ ] AI responds in correct language (vi / en / es)
- [ ] Voice mode works (if applicable)
- [ ] Booking entry point present
- [ ] Mobile layout correct at 375px
- [ ] Desktop layout correct at 1280px
- [ ] No console errors
- [ ] No exposed secrets

---

## Fix Report

Write a fix report to:

```
ai_reviews/fix_reports/YYYY-MM-DD_phase1_hair_salon_fix_report.md
```

Include: findings fixed, findings skipped, files changed, commands run, QA checklist, final verdict.

---

## Deployment (only after FINAL: PASS)

```bash
git add <specific files only>
git commit -m "fix: phase 1 hair salon — Beauty Hair OC vendor page correctness"
git push origin main
firebase deploy --only hosting
```

Verify at `https://www.dulichcali21.com/hairsalon?id=beauty-hair-oc`.
