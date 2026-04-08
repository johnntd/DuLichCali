# Nail Receptionist Regression Harness

A controlled test loop that catches AI conversation failures before they reach production.

```
Real failure found → Add case → Run harness → Fix code → Re-run → Confirm clean
```

---

## Run the harness

```bash
npm run test:receptionist
# or directly:
node tests/runner.js
```

No build step. No npm install for dependencies. Requires Node.js ≥ 14.

---

## What it tests — and confidence levels

Each test layer has a **type** label shown in the runner output. These labels tell you how much confidence each layer actually provides.

### Layer 1 — Prompt Integrity · `static-source-check` · **MEDIUM confidence**
Greps `nailsalon/receptionist.js` for strings that should only exist when a specific fix is in place. Confirms the instruction text is present. **Does NOT prove Claude follows the instruction.** Claude's actual behavior requires live API testing.

Examples:
- `"Do NOT inherit prior staff"` — RX-001 guard
- `"Set time: null (new time needed)"` — RX-003 replace-it fix
- `"BOOKING STATUS: CONFIRMED"` — RX-009 post-booking clarity

### Layer 2 — State Parser · `mirrored-unit-logic` · **MEDIUM-HIGH confidence**
Tests `tests/lib/state-parser.js` — a manual duplication of `_parseStateMarker`, `_parseEscalationType`, `_mergeState` from receptionist.js. **Sync risk:** if the production parsing logic changes, this library must be updated manually. Does NOT test the production functions directly.

### Layer 3 — Availability Logic · `mirrored-unit-logic | fixture-behavioral` · **HIGH confidence (algorithm); MEDIUM (production coupling)**
Tests `tests/lib/avail-logic.js` — a duplication of `NailAvailabilityChecker` with pre-loaded fixture data instead of Firestore. Directly exercises the isModify exclusion paths that caused the RX-003 and RX-006 loop bugs. **Does NOT test real Firestore queries or the production `NailAvailabilityChecker`.** Sync risk same as Layer 2.

### Layer 4 — Case Library · `structural | static-source-check` · **MEDIUM confidence**
Validates case file schema (required fields, valid status values, RX-NNN ID format). For `verified_in_runner` cases, checks fix string presence in source (same confidence as Layer 1).

---

## What this harness guarantees — and does not guarantee

| Claim | Guaranteed? |
|-------|-------------|
| Fix instruction text is present in receptionist.js | ✅ Layer 1 |
| STATE/BOOKING/ESCALATE parsing is correct | ✅ Layer 2 |
| Availability algorithm handles conflict cases | ✅ Layer 3 |
| Case files are properly structured | ✅ Layer 4 |
| Claude follows the prompt instructions | ❌ Requires live API test |
| End-to-end booking flow is correct | ❌ Requires live integration test |
| Firestore behavior matches fixture expectations | ❌ Requires live integration test |
| Correct behavior on real customer input variation | ❌ Requires live API test |
| Regression-free after Claude model updates | ❌ Requires live API test |

**A fully-passing harness reduces regression risk but does not prove production correctness.**

---

## Directory structure

```
tests/
  runner.js            Main test runner — run this
  README.md            This file

  lib/
    state-parser.js    STATE/BOOKING/ESCALATE parsing (mirrors receptionist.js)
    avail-logic.js     Availability check algorithm (no Firebase dependency)
    prompt-checker.js  Load and grep receptionist.js source

  fixtures/
    biz.json           Mock vendor data (staff schedules, services, hours)
    bookings.json      Mock booking documents for conflict tests

  cases/
    001-*.json         Known failure cases — the failure memory
    ...
    010-*.json
```

---

## Case status model

Cases move through a defined progression — never skip steps:

| Status | Meaning |
|--------|---------|
| `known_bug` | Documented failure. No fix applied yet. |
| `expected_fixed` | Code change made. No automated verification added yet. |
| `verified_in_runner` | Runner has a test for the fix (static/unit level). |
| `verified_live` | Manually confirmed correct behavior in production. |

`verified_in_runner` is NOT `verified_live`. See the confidence table above.

---

## How to add a new case when a bug is found

1. **Reproduce the failure** — note the exact conversation that triggered it.

2. **Create a case file** in `tests/cases/`:

```bash
# Example: new case for a discovered bug
cp tests/cases/001-staff-switch-helen-to-tracy.json tests/cases/011-your-new-bug.json
```

3. **Fill in the required fields**:

```json
{
  "id": "RX-011",
  "fix_date": null,
  "category": "booking_create",
  "status": "known_bug",
  "title": "Short description of the bug",
  "failing_behavior": "What the AI did wrong (exact quote if possible)",
  "root_cause": "Technical explanation of why it happened",
  "conversation": [
    { "role": "user",      "content": "message that triggered the bug" },
    { "role": "assistant", "content": "what the AI said (wrong)" }
  ],
  "expected_state": { "intent": "booking_request", "staff": "Tracy" },
  "expected_no_contain": ["wrong phrase AI should not say"],
  "code_areas": ["nailsalon/receptionist.js:_buildPrompt:SECTION_NAME"],
  "notes": "Any additional context"
}
```

4. **Run the harness** — it will validate your case structure:
```bash
node tests/runner.js
```

5. **Fix the code** in `nailsalon/receptionist.js`.

6. **Add a `verify_fix_string`** and set `"fix_date"` to today. Update `"status"` to `"expected_fixed"`:
```json
"fix_date": "2026-04-XX",
"status": "expected_fixed",
"verify_fix_string": "some unique string from your fix"
```

7. **Set `"status": "verified_in_runner"`** and run the harness again. All tests must pass.

8. **Bump the version string** in `nailsalon/index.html` per the JS cache-bust rule.

---

## Valid categories

| Category              | Use for |
|-----------------------|---------|
| `booking_create`      | New booking flow failures |
| `booking_modify`      | Reschedule failures |
| `booking_cancel`      | Cancellation failures |
| `booking_replace`     | Replace-existing-booking failures |
| `availability_check`  | Slot conflict detection failures |
| `alternate_staff`     | Staff switching failures |
| `conflict_handling`   | Conflict message and alternatives failures |
| `language_consistency`| Wrong language in response |
| `stale_data`          | Hours/staff/services not refreshed |
| `confirmation_quality`| Missing price/time/ref in confirmation |
| `conversation_closing`| Ambiguous or looping conversation endings |
| `calendar_packet`     | Calendar link or booking packet failures |
| `vendor_sync`         | Admin changes not reflected to AI |

---

## How fix detection works

Each case file may include a `verify_fix_string` — a short, unique string that is ONLY present in `receptionist.js` when the fix is applied. The runner does:

```javascript
assertContains(src, c.verify_fix_string);
```

If the fix was accidentally reverted, this assertion fails immediately.

Choose strings that are:
- **Unique** — only appear in the fix, not in unrelated code
- **Short** — a key phrase from the added instruction
- **Specific** — from the exact fix, not general comments

---

## Known limitations

- **Layer 3 availability tests** use pre-loaded fixture data, not live Firestore. They test the algorithm, not the Firestore query itself.
- **AI behavior tests** (what Claude actually outputs) are documented in case files but not auto-executed — they require a Claude API key and are currently manual verification.
- **Stale data window** (CASE-010): the 10-minute cache is expected behavior. Real-time schedule changes won't be reflected until the cache expires.

---

## Workflow for each future debugging session

```
1. Bug found in production conversation
2. Create tests/cases/NNN-short-name.json with fixed:false
3. node tests/runner.js  →  new case appears in output, structure validated
4. Fix code in nailsalon/receptionist.js
5. Add verify_fix_string to case, set fixed:true
6. node tests/runner.js  →  ALL TESTS PASS
7. Bump ?v= version string in nailsalon/index.html
8. git commit + firebase deploy --only hosting
9. Done — the fix is now a permanent regression guard
```
