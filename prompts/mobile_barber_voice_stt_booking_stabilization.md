# CRITICAL STABILIZATION — Mobile Barber Voice + STT + Booking

Production issues remain.

Target:
https://www.dulichcali21.com/mobile-barber

Do NOT treat these independently. Audit and fix the full voice → STT → conversation → booking pipeline.

---

# ISSUE 1 — Voice switches accents mid-conversation

Current behavior:

Sentence 1:
Southern Vietnamese voice

Sentence 2:
Northern Vietnamese voice

This sounds broken.

Expected:

One conversation = one voice identity.

Once conversation starts:

lock provider
lock voice
lock accent
lock language

until session ends.

Customer should never hear accent switching mid-session.

---

## Required Audit

Log:

```js
console.info("[voice-session]", {
  sessionId,
  language,
  provider,
  model,
  voice,
  accent,
  vendorId
});
```

Per reply:

```js
console.info("[tts-turn]", {
  sessionId,
  turn,
  provider,
  voice,
  accent
});
```

Find:

* why voice changes
* provider switching?
* Gemini fallback?
* OpenAI fallback?
* voice re-selection every turn?
* language normalization issue?

---

## Required Fix

Conversation start:

create:

```js
voiceSession = {
 sessionId,
 provider,
 voice,
 accent,
 language
}
```

Reuse entire session.

Vietnamese:

If Gemini available:

lock ONE Vietnamese voice only.

Do not reselect each sentence.

No north/south switching.

Preferred:

southern Vietnamese if already used by nail salon

OR reuse exact nail salon voice config.

Audit nail salon voice config first.

---

# ISSUE 2 — STT recognition terrible

Current:

Phone took 3 tries.

Address took 5 tries.

Agent still failed.

This is unacceptable.

Need intelligent intake.

---

## Required Fix

Phone intake:

If confidence low:

agent says:

> "I didn't catch the number clearly. Could you say the digits one by one?"

or

> "Could you spell the number slowly?"

Phone parser:

support:

* `4085043684`
* `408-504-3684`
* `four zero eight five zero four three six eight four`
* `four oh eight …`

Vietnamese equivalents too.

---

Address intake:

Current system keeps asking again.

Need recovery.

If address confidence low:

Agent:

> "I may have missed the address. Could you spell the street name?"

or:

> "Could you say the city first?"

Need address parser.

Parse:

* street
* city
* zip
* partial address

Use conversational repair.

---

## Intelligent address confirmation

Example:

Customer:

> 123 Main Street San Jose California 95123

If low confidence:

Agent:

> "I heard Main Street in San Jose. Is that correct?"

instead of restarting.

---

## STT Audit

Compare nail salon STT.

Search:

```bash
grep -R "transcribe" -n .
grep -R "speech" -n .
grep -R "Gemini" -n .
grep -R "STT" -n .
grep -R "recognition" -n .
grep -R "nail" -n .
```

Determine:

does nail salon use better STT?

reuse same stack.

---

# ISSUE 3 — Booking still broken

Need real booking verification.

Manual booking likely still failing.

Audit:

* button
* validation
* write path
* Firestore
* dashboard

Run REAL booking:

Vendor:

Michael

Create:

* phone
* address
* service
* time

Verify:

`mobileBarberBookings` document created.

Verify dashboard shows booking.

Do not mark PASS from UI only.

Need real DB write.

---

# Required Tests

Voice:

* Vietnamese session: same accent entire conversation
* English session: same voice entire conversation

STT:

* phone recognition: 1 try success
* address recognition: 1–2 tries max
* fallback prompts work

Booking:

* manual booking writes DB
* voice booking writes DB
* dashboard shows booking

---

# Required Report

`docs/mobile_barber_voice_stt_booking_stabilization.md`

Include:

* root cause voice switching
* voice provider logs
* STT comparison nail vs barber
* booking verification
* Firestore proof
* tests
* PASS/BLOCKED

---

PASS only if:

* voice no longer changes accent
* phone intake works
* address intake works
* booking creates DB record
* dashboard shows booking

Run:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_voice_stt_booking_stabilization.md --max-loops 3 --allow-dirty --timeout 2400
```
