Claude/Codex, fix the shared salon AI phone-intake runtime generally, not just one example.

This is a context-routing bug.

The shared salon AI agent is used by BOTH:
- /nailsalon?id=...
- /hairsalon?id=...

The problem:
When the AI asks the customer for a phone number, the conversation state is PHONE_INTAKE / expecting phone. In that state, Vietnamese spoken number words must be parsed as digits, not names, dates, years, or normal words.

Examples:
- năm / nam / lăm / lam = 5
- bảy / bay = 7
- tám / tam = 8
- sáu / sau = 6
- hai = 2
- ba = 3
- bốn / bon / tư / tu = 4
- không / khong / lẻ / le / linh = 0
- một / mot / mốt = 1
- chín / chin = 9

Important:
Some Vietnamese number words can also be names or normal words in other contexts. That is okay. The parser must only force digit meaning when the app is actively expecting a phone number.

Do NOT build a one-off fix for:
“4084 397 năm 22”

That phrase must be included as a regression test, but the implementation must handle all Vietnamese digit words generally in phone context.

Current deployed failure:
AI asks for phone number in Vietnamese.
Customer replies:
“À số điện thoại là 4084 397 năm 22”
AI incorrectly treats “năm” like a year/word and asks clarification.

Expected:
4084397522

Core rule:
If the app just asked for phone number, or booking state is missing phone and the user response looks like a phone response, deterministic phone parsing must run BEFORE the LLM interprets the text.

The LLM must not decide whether “năm”, “bảy”, “tám”, “sáu”, etc. are names/years when phone intake context is active.

Allowed files:
- nailsalon/phone-intake.js
- nailsalon/receptionist.js
- nailsalon/index.html
- hairsalon/index.html
- tests/runner.js
- scripts/ai/targeted_dry_run.sh

Do not touch unrelated files.
Do not deploy.

Required behavior:

1. Detect phone-intake context generally.

Phone context is active when any of these are true:
- the AI just asked for phone number
- current expected field is phone
- booking/customer state is missing phone
- the message being answered contains “phone number”
- Vietnamese prompt contains “số điện thoại”
- Spanish prompt contains “número de teléfono”
- booking flow has reached customer contact collection
- user utterance contains phone-intent phrases

2. In phone-intake context, parse all digit forms generally.

The parser must combine:
- numeric chunks: 4084, 397, 22
- spaced digits: 4 0 8
- punctuation-separated digits: 408-439-7522, 408.439.7522
- Vietnamese digit words
- English digit words
- Spanish digit words if already supported

Examples that must work in phone context:
- 4084 397 năm 22 -> 4084397522
- 4084 397 bảy 22 -> 4084397722
- 4084 397 tám 22 -> 4084397822
- 4084 397 sáu 22 -> 4084397622
- bốn không tám bốn ba chín bảy năm hai hai -> 4084397522
- bốn không tám bốn ba chín tám năm hai hai -> 4084398522
- bốn không tám bốn ba chín sáu tám hai hai -> 4084396822
- bon khong tam bon ba chin bay nam hai hai -> 4084397522
- số điện thoại là 408 439 bảy năm hai hai -> 4084397522
- my phone is bốn không tám 439 bảy năm hai hai -> 4084397522

3. Outside phone context, do not over-convert.

If the user says:
- “Anh Bảy làm hôm nay không?”
- “Chị Tám có làm không?”
- “Năm nay tôi muốn đặt lịch”
- “Tôi muốn gặp cô Sáu”
and the app is NOT expecting a phone number, do not convert those names/words into digits.

4. Normalize before LLM response.

In `nailsalon/receptionist.js`, find the earliest runtime intake point where customer input is handled.

Before sending the user’s raw response to the LLM for interpretation/clarification:
- check if phone context is active
- call `normalizeSpokenPhoneNumber(rawText, lang, { phoneContext:true, expected:'phone' })`
- if a confident 10-digit phone is returned:
  - store/use it as phone
  - confirm it in active language
  - do not ask clarification about “năm” / “bảy” / “tám” / etc.
- if 7–9 digits are returned:
  - treat as partial
  - ask for missing area code or missing digits
  - do not interpret Vietnamese number words as names/years
- if null:
  - use existing fallback

5. Runtime state marker.

If the app currently does not track “just asked for phone,” add a minimal shared state marker such as:
- `_expectingPhone = true`
or an equivalent existing expected-field state.

Set it when the AI asks for phone number.
Clear it after a full phone number is confirmed or the flow moves on.

6. Confirm in active language.

Vietnamese:
“Em nghe số điện thoại là 408-439-7522, đúng không ạ?”

English:
“I heard your phone number as 408-439-7522. Is that correct?”

Spanish:
“Escuché su número como 408-439-7522. ¿Es correcto?”

7. Tests required.

Add broad tests, not only the one screenshot phrase.

Test group:
`Shared Salon Phone Context Runtime`

Required phone-context tests:
- 4084 397 năm 22 -> 4084397522
- 4084 397 nam 22 -> 4084397522
- 4084 397 bảy 22 -> 4084397722
- 4084 397 bay 22 -> 4084397722
- 4084 397 tám 22 -> 4084397822
- 4084 397 tam 22 -> 4084397822
- 4084 397 sáu 22 -> 4084397622
- 4084 397 sau 22 -> 4084397622
- bốn không tám bốn ba chín bảy năm hai hai -> 4084397522
- bon khong tam bon ba chin bay nam hai hai -> 4084397522
- số điện thoại là 408 439 bảy năm hai hai -> 4084397522
- my phone is bốn không tám 439 bảy năm hai hai -> 4084397522

Required non-phone-context tests:
- “Anh Bảy làm hôm nay không?” must not parse as a phone number
- “Chị Tám có làm không?” must not parse as a phone number
- “Năm nay tôi muốn đặt lịch” must not parse as a phone number
- “Tôi muốn gặp cô Sáu” must not parse as a phone number

Required shared-route tests:
- nailsalon route loads the helper/runtime path
- hairsalon route loads the helper/runtime path

8. Targeted validation.

Update:
`scripts/ai/targeted_dry_run.sh phone-intake`

It must verify:
- the exact production failure phrase exists in tests
- Vietnamese digit words map generally, including năm, bảy, tám, sáu
- non-phone-context name cases exist in tests
- helper is loaded by both hair and nail pages
- node tests/runner.js passes

9. Required commands.

Run:
scripts/ai/targeted_dry_run.sh phone-intake
node tests/runner.js
scripts/ai/targeted_dry_run.sh hair-salon
scripts/ai/full_system_dry_run.sh

Final report must include:
- files changed
- where phone context is detected
- where deterministic phone normalization happens before LLM interpretation
- proof all Vietnamese digit words are handled in phone context
- proof Vietnamese name/normal-word cases are not parsed outside phone context
- proof both hair and nail salon routes use the fixed path
- tests result
- full dry run result
- FINAL: PASS or FINAL: FAIL
