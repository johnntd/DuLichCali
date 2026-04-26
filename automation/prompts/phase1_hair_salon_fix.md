# DuLichCali Phase 1 — Hair Salon Fix Prompt

## Role

You are now approved to fix confirmed P0 and P1 issues from the hair salon audit.

You have permission to modify source files for this specific scope only.

---

## Primary Target

Beauty Hair OC — `hairsalon/index.html` and all files it loads.

Reference standard: Luxurious Nails at `/nailsalon?id=luxurious-nails`.

---

## Rules — Strictly Enforced

- Fix **only confirmed P0/P1 issues** from the audit report.
- **Do not touch** Luxurious Nails vendor data or nailsalon booking logic.
- **Do not touch** nail salon receptionist.js unless fixing a confirmed shared bug.
- **Do not touch** airport/ride booking, travel packages, food vendors, driver/vendor auth unless the confirmed bug directly requires it.
- **Do not rewrite** the app or vendor architecture.
- **Do not broadly refactor** unless strictly required to fix a confirmed bug.
- **Prefer minimal patches** — smallest safe change per issue.
- **Preserve all existing routes** and Firestore field names.
- Beauty Hair OC must remain a **single-vendor page**, not a directory page.
- Every fix must be **reversible and auditable**.
- **Bump `?v=` version strings** in every HTML file for every modified `.js` file.

---

## Required Fixes (if confirmed by audit)

Implement only the items the audit confirmed as P0/P1:

**Vendor identity:**
- [ ] Vendor name shown as "Beauty Hair OC"
- [ ] Vendor phone shown (from services-data.js or Firestore)
- [ ] Vendor address shown (Westminster, Orange County)
- [ ] Business hours shown (hair salon hours)

**Services and staff:**
- [ ] Hair-specific services listed (Cut, Color, Balayage, Keratin, Blowout, etc.)
- [ ] Hair-specific pricing shown (from services-data.js)
- [ ] Stylists shown (Michael Nguyen, Michele, Tracy Tran)

**AI receptionist:**
- [ ] Michelle AI persona correctly injected
- [ ] Correct vendor context (beauty-hair-oc) in AI system prompt
- [ ] Services, staff, hours from vendor data in AI context
- [ ] Language detection working (vi/en/es)
- [ ] No hardcoded strings in any language (use AI for natural language)

**Voice:**
- [ ] Voice mode enabled if confirmed missing vs nailsalon standard
- [ ] TTS chain correct (OpenAI → Gemini → browser fallback)

**Booking:**
- [ ] Booking entry point present and functional
- [ ] Availability check gates booking before confirmation

**UI/Layout:**
- [ ] Hero carousel present with hair-specific images
- [ ] Z-index/overlay correct (no bleed-through)
- [ ] Mobile layout correct at 375px
- [ ] Desktop layout correct at 1280px

---

## Cascading Changes Required

For every `.js` file modified:

1. Find all HTML files that load it:
   ```bash
   grep -rn "filename.js" . --include="*.html"
   ```
2. Bump the `?v=YYYYMMDD` string in every found HTML file.
3. Use `v=20260426a` or higher (never reuse a previously deployed version string).

---

## After Each Fix

Run:
```bash
npm run test:receptionist
```

All 211 tests must continue to pass after every fix.

---

## Post-Fix QA Checklist

Run through this manually in a browser at `http://localhost:8080`:

- [ ] Luxurious Nails page (`/nailsalon?id=luxurious-nails`) still loads correctly
- [ ] Luxurious Nails AI receptionist still works
- [ ] Luxurious Nails booking still works
- [ ] Beauty Hair OC page (`/hairsalon?id=beauty-hair-oc`) loads
- [ ] Beauty Hair OC shows vendor-specific name, phone, address, hours
- [ ] Beauty Hair OC does NOT show nail salon data or directory data
- [ ] Hair services and pricing shown
- [ ] Stylist list shown
- [ ] AI receptionist panel opens on hair salon page
- [ ] AI uses Michelle persona and Beauty Hair OC context
- [ ] AI responds in correct language (type in vi, en, es separately)
- [ ] Voice mode works (if applicable)
- [ ] Booking entry point present and tappable
- [ ] Mobile layout correct at 375px (no overflow, no broken nav)
- [ ] Desktop layout correct at 1280px
- [ ] No console errors in browser devtools
- [ ] No exposed API keys or Firebase credentials in page source

---

## Fix Report

After all fixes, write a fix report to:

```
automation/reports/fixes/YYYY-MM-DD_phase1_hair_salon_fix_report.md
```

Use the template at: `automation/templates/fix_report_template.md`

Include:
- Which confirmed issues were fixed
- Which were skipped and why
- Files changed
- Commands run and results
- QA checklist status
- Final verdict: READY_FOR_USER_REVIEW / NEEDS_MORE_FIXES / BLOCKED_NEEDS_HUMAN_DECISION

---

## Deployment

Only deploy after all fixes are confirmed and QA checklist is complete:

```bash
git add <specific files>
git commit -m "fix: phase 1 hair salon — Beauty Hair OC vendor page correctness"
git push origin main
firebase deploy --only hosting
```

Verify production at `https://www.dulichcali21.com/hairsalon?id=beauty-hair-oc`.
