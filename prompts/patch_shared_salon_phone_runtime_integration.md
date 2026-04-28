# Patch: Shared Salon Phone Runtime Integration Fix

## Problem

The deployed shared salon AI receptionist still fails to understand Vietnamese spoken phone numbers in real runtime chat/voice flow.

Screenshot evidence:

User says:

À số điện thoại là 4084 397 năm 22

The AI responds:

Mình nghe được "084397" rồi, nhưng phần cuối "năm 22" — ý bạn là 522 hay 522 hay số khác?

This is wrong.

In phone-number context, Vietnamese:

năm / nam / lăm / lam

must mean digit 5, not “year.”

The expected phone number is:

4084397522

The AI should confirm:

Em nghe số điện thoại là 408-439-7522, đúng không ạ?

or:

Em xác nhận số điện thoại của mình là 408-439-7522, đúng không ạ?

## Critical conclusion

Do not assume the previous patch worked just because tests passed.

The runtime path is still not using the phone normalization helper correctly.

The bug is likely one of these:

1. `normalizeSpokenPhoneNumber()` exists but is not loaded in the deployed hair/nail salon page.
2. The helper is loaded but not called in the actual AI chat/message intake path.
3. The helper is only used in `_mergeState`, but the AI clarification path runs before `_mergeState`.
4. The helper cannot parse mixed digit chunks like `4084 397 năm 22`.
5. The helper rejects spaces/chunks incorrectly.
6. The AI prompt/LLM sees `năm 22` before deterministic normalization and invents a clarification.
7. The hair salon page is not loading the same helper as the nail salon page.
8. Cache-busting version strings were not updated, so the deployed site is still using stale JS.

## Scope

This fix is for the SHARED salon smart agent used by BOTH:

- `/nailsalon?id=...`
- `/hairsalon?id=...`

This is not a nails-only fix.

This is not a hair-only fix.

Even if the shared code lives under `nailsalon/`, treat it as shared salon-agent infrastructure.

## Allowed files

Only these files may be changed unless there is a clear documented reason:

- `nailsalon/phone-intake.js`
- `nailsalon/receptionist.js`
- `nailsalon/index.html`
- `hairsalon/index.html`
- `tests/runner.js`
- `scripts/ai/targeted_dry_run.sh`

Do NOT modify:

- marketplace rendering
- travel pages
- food vendor pages
- vendor admin pages
- Firestore rules
- Firebase deploy config
- Remotion/YouTube files
- AGENTS.md
- CLAUDE.md
- unrelated booking/ride logic

Do NOT deploy.

Do NOT commit.

## Required runtime behavior

When the salon AI receptionist is asking for phone number or missing phone number, and the user enters any of these:

```text
4084 397 năm 22
4084 397 nam 22
408 4397 năm 22
408 439 bảy năm hai hai
số điện thoại là 4084 397 năm 22
à số điện thoại là 4084 397 năm 22
cũng 084397 năm 22
