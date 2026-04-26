---

## DuLichCali — AI Agent Safety Override

All AI agents working on this repository (Claude, Codex, and future agents) must follow these rules. They override default autonomy behavior.

### What This App Is

`dulichcali21.com` — a Vietnamese-American travel and local services platform serving customers in Southern California.

Surfaces: homepage, marketplace, nail salon, hair salon, food vendors, travel packages, airport/ride booking, AI receptionist, vendor admin, driver admin, Firestore data, Firebase Functions, Remotion/YouTube media.

### Required Workflow (MANDATORY)

1. **Read first.** Inspect current code before changing anything.
2. **Use the prompt.** Pick or create a prompt under `prompts/`. The prompt is the source of truth for the task.
3. **Run a targeted dry run** before risky changes:
   ```
   scripts/ai/targeted_dry_run.sh hair-salon
   scripts/ai/targeted_dry_run.sh booking
   scripts/ai/targeted_dry_run.sh travel
   scripts/ai/targeted_dry_run.sh marketplace
   scripts/ai/targeted_dry_run.sh ai-receptionist
   ```
4. **Apply only scoped changes** from the prompt. Touch only the files the task requires.
5. **Run the full dry run after every patch:**
   ```
   scripts/ai/full_system_dry_run.sh
   ```
6. **Do not mark work complete unless** `full_system_dry_run.sh` ends `FINAL: PASS`.
7. **If `FINAL: FAIL`** — stop, report the failure, do not proceed to the next step.
8. **Write a report** — every significant task ends with a summary of files changed, commands run, dry run result, remaining risks, and next command.

### Implementation Rules

- Never rewrite the app or large modules unless explicitly requested.
- Never broadly refactor files unrelated to the current task.
- Never change booking validation behavior without explicit instruction.
- Never change AI receptionist behavior without explicit instruction.
- Never change Firestore schema or security rules without explicit instruction.
- Never deploy to production without explicit user approval.
- Never send real customer or vendor notifications during tests or validation.
- Never write to production Firestore during validation or dry runs.
- Never expose API keys, Firebase credentials, or customer/vendor data in reports or logs.
- Never commit `.env` files or secret config.

### Scope Discipline

- Only modify files directly required for the current task.
- Avoid cascading changes across unrelated systems.
- Prefer additive patches over refactors.
- If a fix requires touching a shared file, state the impact explicitly before proceeding.

---

## Must-Not-Break Flows

These flows must continue working after every patch:

| Flow | Key Files |
|------|-----------|
| Homepage | `index.html`, `style.css`, `script.js` |
| Marketplace | `marketplace/marketplace.js`, `marketplace/services-data.js` |
| Luxurious Nails page | `nailsalon/index.html`, `nailsalon/receptionist.js` |
| Hair salon page | `hairsalon/index.html` |
| Food vendor page | `foods/index.html` |
| Travel packages | `travel.html`, `travel-packages.js`, `destinations.js` |
| Airport/ride booking | `script.js` (booking section) |
| AI receptionist | `nailsalon/receptionist.js`, `ai-engine.js`, `aiOrchestrator.js` |
| Voice mode | `nailsalon/voice-mode.js` |
| Vendor admin | `vendor-admin.html`, `vendor-login.html` |
| Firebase/Firestore reads | `firestore.rules`, `firestore.indexes.json` |
| Mobile layout (375px) | `style.css`, `marketplace/marketplace.css` |
| Desktop layout (1200px+) | `desktop.css` |

---

## Hair Salon Priority Rules

Beauty Hair OC / hair salon interface is a priority audit and fix target.

The hair salon page **must**:
- Be a single-vendor page, not a generic area directory.
- Show vendor-specific: business name, phone, address, hours, services, staff, pricing, images, and booking controls.
- Match the quality and template standard of Luxurious Nails.
- Preserve carousel/showcase behavior.
- Preserve AI receptionist panel with correct Michelle persona.
- Use the correct vendor context (`beauty-hair-oc`).
- Fix overlay/underlay/z-index problems without breaking other pages.
- Work correctly on mobile (375px) and desktop (1280px+).
- Not leak Luxurious Nails data unless intentionally using shared template structure.

**Known finding from targeted dry run (2026-04-26):**
`hairsalon/index.html` currently loads `/nailsalon/salon.css`, `/nailsalon/receptionist.js`, and `/nailsalon/voice-mode.js`. This is a confirmed audit finding queued for Phase 1.

Prompt to use for Phase 1 fix:
```
scripts/ai/patch_cycle.sh prompts/phase1_hair_salon_fix.md --scope hair-salon
```

---

## Booking Rules

- Do not confirm bookings before checking availability.
- Do not double-book a staff member or vehicle.
- Do not book staff on their days off.
- Do not use nail salon service assumptions for hair salon services.
- For airport/ride booking: do not assign a 4-seat vehicle to 7 or 12 passengers.
- Manual booking and AI booking must share the same availability validation where possible.
- Do not quote incorrect flat pricing for different party sizes.

---

## AI Receptionist Rules

- AI receptionist must use vendor-specific context (not generic directory behavior).
- It must not hallucinate vendor phone, address, staff, services, prices, or availability.
- It must not act like a city-wide directory on a vendor detail page.
- Language detection must work (vi / en / es) — do not hardcode strings in any language.
- Voice mode must not be broken when fixing UI.
- Exit and language controls must be usable on mobile.
- Real-time clock must be used for open/closed detection.
- Staff schedule must be checked before confirming availability.

---

## Automation Commands

**Primary validation gate:**
```
scripts/ai/full_system_dry_run.sh
```
Must end `FINAL: PASS` before any patch is marked complete.

**Targeted validation by scope:**
```
scripts/ai/targeted_dry_run.sh hair-salon
scripts/ai/targeted_dry_run.sh booking
scripts/ai/targeted_dry_run.sh travel
scripts/ai/targeted_dry_run.sh marketplace
scripts/ai/targeted_dry_run.sh ai-receptionist
```

**Patch cycle (prompt-driven):**
```
scripts/ai/patch_cycle.sh prompts/<prompt>.md [--scope <scope>]
```

**Codex review cycle:**
```
scripts/ai/codex_review_cycle.sh <codex_review_file>
```

**Run artifacts:** `.ai_runs/latest/` — all logs, diffs, prompts, and reports are written here.

---

## Codex → Claude Review Rules

- Codex review findings are not automatically correct.
- Claude must classify each finding before fixing anything:
  - `CONFIRMED_BUG` — verified against source, definitely broken → fix it
  - `VALID_IMPROVEMENT` — real improvement but not a bug → needs user approval
  - `FALSE_POSITIVE` — Codex was wrong; code is correct → document and skip
  - `OUT_OF_SCOPE` — correct but unrelated to this PR → skip
  - `NEEDS_HUMAN_DECISION` — ambiguous or risky → flag for user
- Claude fixes only `CONFIRMED_BUG` unless the user explicitly approves broader changes.
- After fixes, run `scripts/ai/full_system_dry_run.sh`. Must end `FINAL: PASS`.

---

## JS Version String Rule (DuLichCali-Specific)

Every modified `.js` file must have its `?v=YYYYMMDD` bumped in all HTML files that load it.

```bash
grep -rn "filename.js" . --include="*.html"
```

Never reuse a previously deployed version string. Use the current date + letter suffix: `v=20260426a`.

---

## Secrets / Safety

- Never print `.env` values or API key values.
- Never commit secrets, credentials, or private config files.
- Never expose customer booking data, vendor data, or Firebase service account credentials.
- Only list environment variable **names** when relevant.
- Never run destructive commands without explicit user approval.
- Never delete user data.
- Never deploy to `https://www.dulichcali21.com` without explicit user approval.
- Production deploy command (only when approved): `firebase deploy --only hosting`
