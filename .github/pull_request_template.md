## Summary

[Describe what this PR changes and why]

---

## Files Changed

[List key files modified]

---

## Mobile / Desktop QA

- [ ] Mobile layout verified at 375px
- [ ] Desktop layout verified at 1280px

---

## JS Version Strings

- [ ] All modified `.js` files have bumped `?v=YYYYMMDD` in every HTML consumer
- [ ] No version string was reused from a previously deployed build

---

## DuLichCali-Specific Checks

- [ ] Vendor pages still show vendor-specific data (not directory data)
- [ ] Luxurious Nails page behavior unchanged (reference standard)
- [ ] AI receptionist behavior unchanged unless fixing a confirmed bug
- [ ] Booking availability check still fires before confirmation
- [ ] No hardcoded strings in vi / en / es added to source files
- [ ] No API keys, secrets, or customer data exposed in source or logs
- [ ] Firestore schema changes documented if applicable

---

## AI Review Flow

- [ ] Ran `./scripts/ai_review_flow.sh <branch>` to create review files
- [ ] Triggered Codex review with `@codex review` on this PR
- [ ] Claude reviewed Codex findings and classified each one
- [ ] False positives documented in `ai_reviews/claude_audits/`
- [ ] Only `CONFIRMED_BUG` findings were fixed
- [ ] Automated tests run: `npm run test:receptionist`
- [ ] Fix report written to `ai_reviews/fix_reports/`
- [ ] No secrets or private data in any review file

---

## Deployment

- [ ] `firebase deploy --only hosting` run after all fixes
- [ ] Production verified at https://www.dulichcali21.com
