# Nail Receptionist Regression Harness

A controlled test loop that catches AI conversation failures before they reach production.

```
Real failure found → Add case → Run harness → Fix code → Re-run → Confirm clean
```

---

## Run the harness

```bash
node tests/runner.js
```

No build step. No npm install. Requires Node.js ≥ 14.

---

## What it tests

### Layer 1 — Prompt Integrity (17 checks)
Static analysis of `nailsalon/receptionist.js` source to verify that every known bug fix is still in place. If a fix was accidentally removed (e.g. by a refactor or revert), the relevant test fails immediately.

Examples:
- `"Do NOT inherit prior staff"` — CASE-001 guard
- `"Set time: null (new time needed)"` — CASE-003 replace-it fix
- `"BOOKING STATUS: CONFIRMED"` — CASE-009 post-booking clarity

### Layer 2 — State Parser (13 checks)
Pure-function tests for the `[STATE:{...}]`, `[BOOKING:{...}]`, and `[ESCALATE:type]` parsing code. These are the decoding layer between Claude's text output and the JS state machine.

### Layer 3 — Availability Logic (19 checks)
Unit tests for the slot-conflict algorithm with mock booking data. No Firebase, no network.

Covers: free slot, staff conflict, customer conflict, staff not working, outside shift, isModify exclusion, "any" staff bypass, cancelled booking passthrough, alternative slot suggestions.

### Layer 4 — Case Library (20 checks)
Validates structure of all `cases/*.json` files and confirms each fixed case has its fix string present in source.

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
  "id": "CASE-011",
  "date": "2026-04-XX",
  "category": "booking_create",
  "title": "Short description of the bug",
  "fixed": false,
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

6. **Add a `verify_fix_string`** to your case — a string that will be present in source ONLY when the fix is applied:
```json
"verify_fix_string": "some unique string from your fix"
```

7. **Set `"fixed": true`** and run the harness again. All tests must pass.

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
