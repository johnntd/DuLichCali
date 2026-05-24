# Mobile Barber — Phase 9: Notifications and Confirmation Messages

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phase 8 PASS.

## Objective
Add confirmation and reminder messaging hooks.

## Reuse Existing
Use existing app notification pattern if available (`notifications.js`, `DLCNotifications`, Cloud Functions in `functions/index.js`). Confirm in Phase 0 audit.

## Booking Confirmation Should Include
- customer name
- barber/vendor
- service
- date/time
- estimated duration
- price
- address summary
- contact phone
- cancellation/reschedule note

## Channels
Implement safely:
- in-app confirmation
- vendor dashboard alert
- optional SMS/email hook if existing infrastructure exists (Twilio + Resend per `functions/index.js`)
- do not require Twilio if not currently approved

## STOP/HELP Compliance
If SMS is used, follow existing DuLichCali SMS compliance copy (see `sms-opt-in.html`).

## Multilingual
- All notifications must be vi/en/es
- Per project pattern: pass `lang` param to all `DLCNotifications` functions

## Verification
- confirmation generated
- vendor sees new booking
- customer sees final booking summary
- no duplicate notification spam
- existing notification flows (salon, ride, food) not regressed

## STRICT RULES — apply (see master prompt)

## End-of-phase report (required)
