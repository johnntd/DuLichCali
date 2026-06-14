# Mobile Barber Vietnamese Voice Provider Audit

Prompt used: `prompts/mobile_barber_voice_vietnamese_gemini_audit.md`  
Date: 2026-05-24  
Scope: read-only audit; no production logic changed.

## 1. Summary of Findings

PASS: the audit identifies the current nail salon voice provider path, current Mobile Barber provider path, exact OpenAI selection point, responsible files/functions, and safe patch options.

The Mobile Barber voice agent is not using an OpenAI Realtime session. It uses browser `SpeechRecognition` for STT, a local JavaScript booking agent for responses, and direct client-side TTS calls in this order:

1. OpenAI audio speech (`tts-1`, `nova`)
2. Gemini TTS (`gemini-2.5-flash-preview-tts`)
3. Browser `speechSynthesis`

The nail salon voice mode currently uses the same effective TTS order in code: OpenAI first, Gemini second, browser third. The header comment in `nailsalon/voice-mode.js` still says Vietnamese should use Gemini TTS, but the active router sends every language, including Vietnamese, to OpenAI first when an OpenAI key is available.

The practical reason Mobile Barber can speak poor Vietnamese is:

- Mobile Barber intentionally tries OpenAI TTS first in `mobile-barber/mobile-barber-voice.js`.
- Its controller passes no `openAiKey`, `geminiKey`, `platformOpenAiKey`, `platformGeminiKey`, `firestoreOpenAiKey`, or `firestoreGeminiKey` into `MobileBarberVoice.open()`.
- Therefore Mobile Barber TTS can only read `localStorage.dlc_openai_key` and `localStorage.dlc_gemini_key`.
- If `dlc_openai_key` exists, Vietnamese audio uses OpenAI before Gemini.
- If no Gemini key is available in localStorage, Gemini cannot be used at all.
- Mobile Barber Vietnamese detection is weaker than nail salon detection for unaccented Vietnamese because `mobile-barber/vendor.html` does not load `ai-engine.js`; `mobile-barber-agent.js` falls back to a mostly diacritic-only detector.

## 2. Nail Salon Voice Path

| Item | Finding |
|---|---|
| Launch button / UI file | `marketplace/marketplace.js` renders `.mp-ai__voice-btn` in `renderAiSection()` for vendor AI widgets. `nailsalon/index.html` loads `ai-engine.js`, `nailsalon/receptionist.js`, and `nailsalon/voice-mode.js`. |
| JS handler | `nailsalon/receptionist.js` wires `.mp-ai__voice-btn` to `window.DLCVoiceMode.open(biz, messagesEl)`. |
| API route | No backend voice API route. STT and TTS are client-side. Chat brain uses `AIEngine.call('nails', ...)` for text responses. |
| Provider used for response text | `AIEngine.call('nails', ...)`; current `ai-engine.js` forces Claude for browser-side AI calls in `_resolveProvider()`. |
| STT provider | Browser Web Speech API: `SpeechRecognition` / `webkitSpeechRecognition`; language tag is `en-US`, `vi-VN`, or `es-US`. |
| TTS provider | Active code order is OpenAI TTS first, Gemini TTS second, browser TTS third. |
| Vietnamese config | `LANG_TAG.vi = 'vi-VN'`; manual VI button sets `_lang = 'vi'`; transcript auto-detection can switch to `vi`; Gemini TTS uses voice `Aoede` for non-English. |
| Prompts/system instructions | `nailsalon/receptionist.js` builds a specialized Lily prompt with Vietnamese output rules, salon services, staff, schedule, availability rules, and voice-mode brevity rules. |
| Fallback behavior | TTS falls back OpenAI -> Gemini -> browser. Text AI falls back to local fallback text if no Claude key or API error. |

Important code references:

- `nailsalon/index.html:54-62` loads `ai-engine.js`, receptionist, and voice mode.
- `marketplace/marketplace.js:1910-1939` renders the voice button.
- `nailsalon/receptionist.js:3602-3609` opens `DLCVoiceMode`.
- `nailsalon/voice-mode.js:32-33` maps `vi` to `vi-VN`.
- `nailsalon/voice-mode.js:374-377` sets `SpeechRecognition.lang`.
- `nailsalon/voice-mode.js:589-600` calls OpenAI TTS.
- `nailsalon/voice-mode.js:660-686` calls Gemini TTS.
- `nailsalon/voice-mode.js:765-769` is the active TTS router: OpenAI first, Gemini fallback, browser fallback.
- `nailsalon/receptionist.js:2991-3017` reads platform/vendor Gemini and OpenAI keys from Firestore.

## 3. Mobile Barber Voice Path

| Item | Finding |
|---|---|
| Launch button / UI file | `mobile-barber/vendor.html` has `data-action="openVoiceAssistant"` buttons in the vendor hero and booking panel. Landing page service links can open `/mobile-barber/vendor/<vendorId>?serviceId=...&assistant=voice`. |
| JS handler | `mobile-barber/mobile-barber-vendor.js` handles `openVoiceAssistant()` and calls `MobileBarberVoice.open({...})`. |
| API route | No backend voice API route. No OpenAI Realtime route. No Gemini voice route. |
| Provider used for response text | `MobileBarberAgent.handleMessage()` is local deterministic JS. It does not call Claude, OpenAI, or Gemini for message generation. |
| STT provider | Browser Web Speech API: `SpeechRecognition` / `webkitSpeechRecognition`; language tag is `en-US`, `vi-VN`, or `es-US`. |
| TTS provider | OpenAI TTS first, Gemini TTS second, browser TTS third. |
| Vietnamese config | `LANG_TAG.vi = 'vi-VN'`; overlay VI button updates `lang`; controller `setLang()` stores `dlcLang` and `dlc_lang`; Gemini voice is `Aoede` for non-English. |
| Prompts/system instructions | `mobile-barber/mobile-barber-agent.js` has `buildPrompt()`, but the current browser flow does not send it to an AI provider; `handleMessage()` returns deterministic responses and booking state. |
| Fallback behavior | TTS falls back OpenAI -> Gemini -> browser. Mic denial or unsupported STT opens text chat. |

Important code references:

- `mobile-barber/vendor.html:50-52` and `mobile-barber/vendor.html:80-82` render voice buttons.
- `mobile-barber/vendor.html:242-247` loads mobile barber data, booking, agent, voice, and vendor scripts; it does not load `ai-engine.js`.
- `mobile-barber/mobile-barber-vendor.js:1312-1323` opens `MobileBarberVoice` with only `getLang`, `setLang`, `sendMessage`, and `openTextFallback`.
- `mobile-barber/mobile-barber-voice.js:11` maps `vi` to `vi-VN`.
- `mobile-barber/mobile-barber-voice.js:253-260` calls OpenAI TTS.
- `mobile-barber/mobile-barber-voice.js:281-294` calls Gemini TTS.
- `mobile-barber/mobile-barber-voice.js:327-330` is the exact OpenAI-first fallback point.
- `mobile-barber/mobile-barber-agent.js:87-92` uses `AIEngine.detectLang()` if available, otherwise a fallback detector.

## 4. Exact Fallback Point to OpenAI

Mobile Barber does not fall back to OpenAI after Gemini fails. It chooses OpenAI first.

Exact point: `mobile-barber/mobile-barber-voice.js:322-334`.

The `speakReply()` function calls `_speakViaOpenAi(spoken, ...)` first. Only when `okOpenAi` is false does it call `_speakViaGemini()`. If Gemini also fails, it calls browser TTS.

Nail salon has the same active router at `nailsalon/voice-mode.js:751-773`.

This conflicts with the stale nail salon header comment at `nailsalon/voice-mode.js:18-22`, which says Vietnamese should use Gemini TTS.

## 5. Missing Config, Route, or Language Propagation Issue

Confirmed issues:

1. Provider order is wrong for the desired Vietnamese behavior.
   - Desired: Vietnamese prefers Gemini if configured, OpenAI fallback only if Gemini unavailable.
   - Current Mobile Barber: OpenAI first for all languages.
   - Current nail salon active code: OpenAI first for all languages.

2. Mobile Barber is missing vendor/platform key propagation.
   - Nail salon reads `vendors/{id}.geminiKey`, `vendors/{id}.openaiKey`, `config/platform.geminiKey`, and `config/platform.openaiKey`.
   - Mobile Barber sample vendor data has no `geminiKey` or `openaiKey` fields.
   - `openVoiceAssistant()` does not pass any provider key fields to the voice controller.
   - `MobileBarberVoice.getGeminiKey()` can read controller key fields, but none are supplied.

3. Mobile Barber language detection is incomplete.
   - Voice overlay transcript detection only detects Vietnamese by Vietnamese diacritics.
   - Agent detection can use `AIEngine.detectLang()`, but `mobile-barber/vendor.html` does not load `ai-engine.js`, so it uses its fallback detector.
   - The fallback detector misses common unaccented Vietnamese like `toi muon cat toc ngay mai`.

4. There is no shared provider selector.
   - Nail salon and Mobile Barber each duplicate their own TTS routing.
   - Neither module currently has `selectVoiceProvider({ vertical, language, vendorId, fallbackProvider })`.

Not confirmed as an issue:

- Mobile Barber is not wired to the nail salon generic receptionist by mistake. It uses `MobileBarberVoice.open()` and `MobileBarberAgent.handleMessage()`, not `DLCVoiceMode.open()` or `LilyReceptionist`.
- OpenAI Realtime is not used in the inspected code.
- Google STT is not used; STT is browser Web Speech in both inspected voice overlays.

## 6. Environment Variables and Keys Checked

No secret values were read or printed.

Key names and locations found:

- Browser/localStorage:
  - `dlc_openai_key`
  - `dlc_gemini_key`
  - `dlc_claude_key`
- Firestore for nail salon voice:
  - `vendors/{vendorId}.openaiKey`
  - `vendors/{vendorId}.geminiKey`
  - `config/platform.openaiKey`
  - `config/platform.geminiKey`
  - `config/platform.aiKey`
- Firebase Functions secrets:
  - `OPENAI_API_KEY`
  - `GEMINI_API_KEY`
  - `CLAUDE_API_KEY`

Runtime key presence was not verified because this audit is read-only and did not query production Firestore or secret values. The source shows Firebase Functions secrets exist in code, but the voice overlays do not use the server-side functions for TTS.

## 7. Specific Questions Answered

1. Does nail salon actually use Gemini for Vietnamese voice?
   - Only when OpenAI TTS is unavailable or fails. Active code tries OpenAI first for Vietnamese.

2. If yes, where is that configured?
   - Gemini TTS is implemented in `nailsalon/voice-mode.js:660-686`; keys are read from vendor/platform Firestore fields or `localStorage.dlc_gemini_key`; the active router reaches it only after OpenAI failure.

3. Does Mobile Barber route call the same Gemini-capable code?
   - No. It has its own copied Gemini-capable code in `mobile-barber/mobile-barber-voice.js`. It does not use `DLCVoiceMode`.

4. If not, what route or function does it call instead?
   - `mobile-barber/mobile-barber-vendor.js:1318-1323` calls `MobileBarberVoice.open()`.
   - Voice transcripts call `controller.sendMessage()`, which is `sendAgentMessage()`, which calls `MobileBarberAgent.handleMessage()`.

5. Is Mobile Barber using OpenAI Realtime by default?
   - No. It uses OpenAI Audio Speech REST endpoint, not Realtime.

6. Is Vietnamese language selection passed through as `vi`, `vi-VN`, `Vietnamese`, or another value?
   - UI/controller language is `vi`.
   - STT/TTS browser language tag is `vi-VN`.
   - Prompt text says language code `vi`.
   - Gemini TTS payload does not pass `vi-VN`; it only sends text plus voice name `Aoede`.

7. Is provider decision based on route, vendor category, selected language, browser locale, hardcoded default, or env var?
   - Current provider decision is a hardcoded TTS order in each voice JS module.
   - It is not based on selected language, vendor category, route, or browser locale.
   - Keys only determine whether each hardcoded provider attempt can run.

8. Is Gemini disabled because of missing env key?
   - Source cannot prove runtime key absence. However, Mobile Barber does not pass vendor/platform Gemini keys, so Gemini is unavailable unless `localStorage.dlc_gemini_key` exists.

9. Is the Mobile Barber voice button wired to the wrong assistant?
   - No. It is wired to `MobileBarberVoice` and `MobileBarberAgent`, not nail salon or generic marketplace receptionist.

10. What is the safest minimal fix?
   - Make Mobile Barber Vietnamese TTS prefer Gemini when `lang === 'vi'` and a Gemini key is configured, while preserving OpenAI fallback. Also pass platform/vendor Gemini/OpenAI key fields into the voice controller if those fields are available.

## 8. Risks

- Changing provider order only for Mobile Barber could create a behavior difference from nail salon, whose current active code also uses OpenAI first despite stale comments.
- Changing provider order in shared code is safer long term but touches nail salon voice behavior and requires focused regression testing.
- Adding Firestore-backed provider keys to Mobile Barber may require a data model decision because current `mobileBarberVendors` fields do not include provider keys.
- Vietnamese detection based only on diacritics will continue to misroute unaccented Vietnamese unless `AIEngine.detectLang()` is loaded or detection is duplicated/improved.
- Direct browser calls to provider APIs expose client-side provider keys if stored in Firestore/localStorage and used in the browser. Existing nail salon code already follows this pattern, but expanding it should be deliberate.

## 9. Recommended Patch Plan

### Fix Option A — Minimal Routing Fix

Use the existing Gemini Vietnamese TTS path for Mobile Barber when language is Vietnamese:

- In `mobile-barber/mobile-barber-voice.js`, update `speakReply()` so:
  - if `lang === 'vi'`, call `_speakViaGemini()` first;
  - if Gemini fails or has no key, call `_speakViaOpenAi()`;
  - then browser TTS fallback.
- Keep English and Spanish on current OpenAI-first behavior unless product explicitly wants Gemini for Spanish too.
- Add static tests asserting Vietnamese provider order and fallback preservation.

Files likely changed:

- `mobile-barber/mobile-barber-voice.js`
- `tests/lib/mobile-barber-landing.js` or `tests/runner.js`
- `mobile-barber/vendor.html` version string for `mobile-barber-voice.js`

### Fix Option B — Shared Voice Provider Selector

Create a reusable provider selector:

```js
selectVoiceProvider({
  vertical,
  language,
  vendorId,
  fallbackProvider
})
```

Rules:

- Vietnamese should prefer Gemini if configured.
- English can prefer OpenAI if configured.
- Spanish can remain OpenAI first unless Gemini Spanish quality is approved.
- Browser TTS remains the last fallback.

Files likely changed:

- New shared voice provider module or existing `ai-engine.js`
- `nailsalon/voice-mode.js`
- `mobile-barber/mobile-barber-voice.js`
- HTML version strings for modified JS
- Static tests for both voice modules

### Fix Option C — UI Language Propagation Fix

Strengthen Mobile Barber language propagation and detection:

- Load `ai-engine.js` on `mobile-barber/vendor.html`, or add equivalent Vietnamese word-list detection to `mobile-barber-agent.js` and `mobile-barber-voice.js`.
- Keep `vi` as the app language code and `vi-VN` as the Web Speech language tag.
- Ensure landing-page `vendorUrl(service, mode)` includes `lang=state.lang` so direct assistant links preserve explicit language selection even before localStorage is read.

Files likely changed:

- `mobile-barber/index.html`
- `mobile-barber/vendor.html`
- `mobile-barber/mobile-barber.js`
- `mobile-barber/mobile-barber-agent.js` and/or `mobile-barber/mobile-barber-voice.js`
- HTML version strings for modified JS

## 10. Regression Test Plan

After a future fix, run:

1. `scripts/ai/targeted_dry_run.sh marketplace`
2. `scripts/ai/targeted_dry_run.sh ai-receptionist`
3. `node tests/lib/mobile-barber-agent.js`
4. `node tests/runner.js`
5. `scripts/ai/full_system_dry_run.sh`

Manual browser/device checks:

1. Mobile Barber Vietnamese voice with `lang=vi`: confirm STT uses `vi-VN` and TTS attempts Gemini before OpenAI.
2. Mobile Barber English voice: confirm no regression in OpenAI/browser fallback.
3. Mobile Barber Spanish voice: confirm `es-US` STT and fallback behavior.
4. Nail salon Vietnamese voice still works.
5. Nail salon English voice still works.
6. Remove/withhold Gemini key and confirm OpenAI fallback still speaks.
7. Remove/withhold OpenAI key and confirm Gemini/browser fallback still speaks.
8. Confirm Mobile Barber text chat booking still uses `MobileBarberBooking.checkAvailability()`.
9. Confirm mobile voice permissions fallback opens text chat.

## 11. Commands Run

- `pwd && rg --files ...`
- `ls -la prompts docs scripts/ai`
- `git status --short`
- `sed -n '1,240p' prompts/mobile_barber_voice_vietnamese_gemini_audit.md`
- `rg -n "Gemini|gemini|Google|google|Vietnamese|vi-VN|\\bvi\\b|OpenAI|openai|realtime|voice|speech|tts|stt|ai receptionist|receptionist|mobile-barber|barber|nail" ...`
- Targeted `nl -ba ... | sed -n ...` reads for:
  - `nailsalon/index.html`
  - `nailsalon/voice-mode.js`
  - `nailsalon/receptionist.js`
  - `marketplace/marketplace.js`
  - `marketplace/services-data.js`
  - `mobile-barber/index.html`
  - `mobile-barber/vendor.html`
  - `mobile-barber/mobile-barber.js`
  - `mobile-barber/mobile-barber-vendor.js`
  - `mobile-barber/mobile-barber-voice.js`
  - `mobile-barber/mobile-barber-agent.js`
  - `mobile-barber/mobile-barber-data.js`
  - `ai-engine.js`
  - `voice.js`
  - `functions/index.js`
  - `docs/mobile_barber_phase7_ai_voice_agent_report.md`

No targeted dry run was executed before writing this audit because no production logic was changed.

- `scripts/ai/full_system_dry_run.sh`
  - Result: `FINAL: PASS`
  - Test runner summary: `312 passed, 0 failed`

## 12. Dry Run Result

`scripts/ai/full_system_dry_run.sh` ended `FINAL: PASS`.

Next command for a future implementation phase:

```bash
scripts/ai/targeted_dry_run.sh ai-receptionist
```
