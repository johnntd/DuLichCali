# Critical Patch — Mobile Barber Talk Agent Must Use Nail Salon Smart Agent Brain

## Problems

1. On Mobile Barber dashboard/page, clicking "Talk to Agent" opens or redirects to an individual barber selection/page. This is confusing.
Expected:
- It should immediately start talking to the customer.
- It should not redirect the customer unless the customer explicitly wants to choose another barber.

2. The Mobile Barber AI asks too many questions at once.
Expected booking flow:
1. Ask for phone number first.
2. Look up existing customer record.
3. If existing customer:
   - greet by name
   - confirm saved address/service history
   - ask what service/time they want
4. If new customer:
   - ask name
   - then address
   - then service/time
5. Ask ONE question at a time.

3. The current agent does not understand customer responses well.
Expected:
- Reuse the same smart agent/brain pattern that the nail salon AI receptionist uses.
- Audit nail salon agent first.
- Adapt that proven conversation brain to Mobile Barber.

---

# Strict Rules

1. Do NOT blindly patch.
2. First inspect the nail salon AI agent flow and identify the exact files/functions responsible.
3. Reuse the nail salon smart booking brain pattern where possible.
4. Do NOT break nail salon agent.
5. Do NOT break mobile barber manual booking.
6. Do NOT break Gemini Vietnamese voice routing.
7. Do NOT redirect "Talk to Agent" to barber selection unless explicitly intended.
8. Ask one question at a time.
9. Phone lookup must happen first.

---

## Allowed files
- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/mobile-barber-agent.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber-voice.js
- mobile-barber/mobile-barber.js
- tests/lib/mobile-barber-agent.js
- tests/lib/mobile-barber-landing.js
- docs/mobile_barber_talk_agent_brain_fix_report.md
- prompts/mobile_barber_talk_agent_brain_fix.md

Do **not** touch any file outside this list. In particular, do not modify:
- `nailsalon/`, `hairsalon/`, `marketplace/`, `script.js`, `style.css`, `ai-engine.js`, `chat.js`, `workflowEngine.js`
- `firestore.rules`, `firestore.indexes.json`
- `functions/`
- Any auth, driver, ride, food, or travel surface.

---

# Required Audit

Search:
```bash
grep -R "Talk to Agent" -n .
grep -R "talk" -n public src functions .
grep -R "nail" -n public src functions .
grep -R "receptionist" -n public src functions .
grep -R "booking agent" -n public src functions .
grep -R "phone" -n public src functions .
grep -R "customer" -n public src functions .
grep -R "mobile-barber" -n public src functions .
grep -R "startVoice" -n public src functions .
grep -R "Gemini" -n public src functions .
grep -R "gemini" -n public src functions .
```

Compare:

Nail Salon Agent

Document:

* UI button handler
* voice launch function
* agent prompt/brain
* customer lookup flow
* booking state machine
* phone-first behavior if present
* language/voice provider selection
* Firestore customer lookup
* booking confirmation logic

Mobile Barber Agent

Document:

* current Talk button handler
* why it redirects
* current voice launch function
* current agent prompt/brain
* current customer lookup behavior
* why it asks too many questions
* why responses are misunderstood

---

# Required Fixes

## Fix 1 — Talk Button Behavior

For Mobile Barber pages/dashboard:

Clicking:

```
Talk to Agent
Talk to Barber Assistant
Voice Booking
```

must:

* open/start the voice assistant immediately
* pass current vendor context if already on a vendor page
* if on general /mobile-barber, start agent with barber-selection as a conversational step, not redirect
* never pop up a confusing vendor page automatically

Correct behavior:

Customer clicks Talk to Agent
AI says:
"Hi, I can help book a mobile haircut. What phone number should I use to look up your appointment record?"

If vendor already known:

"Hi, this is Michael Mobile Barber OC. What phone number should I use to look up your appointment record?"

---

## Fix 2 — Phone-First Booking State Machine

Implement Mobile Barber booking brain with this order:

```
START
ASK_PHONE
LOOKUP_CUSTOMER
IF_EXISTING_CUSTOMER_CONFIRM_PROFILE
IF_NEW_CUSTOMER_ASK_NAME
ASK_ADDRESS
VALIDATE_SERVICE_AREA
ASK_SERVICE
ASK_DATE_TIME
CHECK_AVAILABILITY
CONFIRM_SUMMARY
CREATE_BOOKING
DONE
```

Ask only one thing at a time.

Never ask:

```
name, phone, address, service, date, time
```

all in one message.

---

## Fix 3 — Existing Customer Lookup

Phone lookup should search:

```
mobileBarberCustomers
mobileBarberBookings
```

Normalize phone numbers.

If match found:

* retrieve name
* previous address
* preferred barber
* previous service
* notes if safe
* ask confirmation before reusing address

Example:

"I found your record, John. Do you want to use the same address in San Jose?"

If no match:

"I don't see a record yet. What name should I put on the booking?"

---

## Fix 4 — Reuse Nail Salon Smart Agent Brain

Do not create a dumb prompt-only assistant.

Adapt the proven nail salon agent pattern:

* intent extraction
* slot filling
* one-question-at-a-time
* customer lookup
* service lookup
* availability check
* booking confirmation
* multilingual response
* voice provider routing

If the nail salon brain is domain-specific, extract shared reusable logic:

```
serviceBookingAgentBrain({
  vertical: "mobile_barber",
  vendorId,
  customerPhone,
  serviceCatalog,
  availabilityProvider,
  bookingWriter
})
```

or create an adapter that preserves existing nail salon behavior.

---

## Fix 5 — Better Understanding

The agent must handle responses like:

```
"My number is 408-555-1212"
"Same address"
"I want a fade"
"Tomorrow afternoon"
"Do you have anything after 5?"
"Book with Tim"
"Vietnamese please"
```

It must update the booking state, not restart.

---

## Fix 6 — Vietnamese Voice Provider Must Stay Correct

When customer speaks Vietnamese:

* use Gemini/Google voice if configured
* log provider selection
* do not fall back to OpenAI silently
* preserve previous voice-provider diagnostic logging

---

# Required Tests

Create scenario tests or documented manual tests:

## Scenario 1 — New Customer

Customer clicks Talk to Agent.

Expected:

1. asks phone
2. customer gives phone
3. no record found
4. asks name
5. asks address
6. asks service
7. asks time
8. confirms
9. creates booking

## Scenario 2 — Existing Customer

Existing phone found.

Expected:

1. asks phone
2. finds customer
3. confirms saved name/address
4. asks service/time
5. creates booking

## Scenario 3 — General Mobile Barber Page

Route:

```
/mobile-barber
```

Click Talk to Agent.

Expected:

* voice starts
* no redirect
* agent asks phone first
* if needed, asks preferred region/barber conversationally

## Scenario 4 — Vendor Page

Route:

```
/mobile-barber/vendor/michael-nguyen-oc
```

Click Talk to Agent.

Expected:

* voice starts for Michael
* no redirect
* asks phone first

## Scenario 5 — Vietnamese

Customer speaks Vietnamese.

Expected:

* Gemini/Google voice selected
* asks one question at a time in Vietnamese
* booking state updates correctly

---

# Required Report

Create:

```
docs/mobile_barber_talk_agent_brain_fix_report.md
```

Include:

1. Root cause of redirect
2. Root cause of weak conversation flow
3. Nail salon smart agent files inspected
4. Mobile Barber files changed
5. New booking state machine
6. Customer lookup behavior
7. Voice provider verification
8. Tests run
9. PASS / BLOCKED

---

# PASS Criteria

Do NOT mark PASS unless:

* Talk to Agent starts conversation immediately
* no confusing redirect
* phone is asked first
* existing customer lookup works
* new customer flow works
* only one question asked at a time
* Mobile Barber uses nail salon smart brain pattern or shared adapter
* Vietnamese voice still uses Gemini/Google when configured
* booking can be completed by voice
* nail salon agent still works

Run:
```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_talk_agent_brain_fix.md --max-loops 3 --allow-dirty --timeout 2400
```
