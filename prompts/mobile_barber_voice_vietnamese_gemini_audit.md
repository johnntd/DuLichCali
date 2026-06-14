# Audit Prompt — Mobile Barber Vietnamese Voice Agent Uses Wrong Provider

## Problem
The Mobile Barber AI voice agent speaks very poor Vietnamese.

It appears to be falling back to the OpenAI voice/speaking agent instead of using the better Google Gemini Vietnamese voice assistant behavior that the nail salon AI agent used successfully.

We need to audit why Mobile Barber does not use the same Gemini Vietnamese voice path as the nail salon agent.

Do NOT patch yet unless the fix is obvious, minimal, and safe.

---

## Objective
Find out exactly why Mobile Barber voice uses the wrong speaking path/provider for Vietnamese.

Compare Mobile Barber voice routing against the existing nail salon AI voice agent.

Determine:
1. What provider nail salon uses for Vietnamese voice.
2. Whether nail salon uses Gemini, Google TTS, Google STT, or another voice pipeline.
3. What provider Mobile Barber currently uses.
4. Where the Mobile Barber flow falls back to OpenAI.
5. Whether Vietnamese language detection is working.
6. Whether the selected language is passed into voice/session config.
7. Whether Mobile Barber is missing vendor/vertical/provider config.
8. Whether environment variables/API keys are missing.
9. Whether the route uses the generic AI receptionist instead of the Gemini-enabled agent.

---

## Allowed files
- docs/mobile_barber_voice_vietnamese_gemini_audit.md

---

## Strict Rules
1. READ ONLY unless a tiny diagnostic log is required.
2. Do NOT modify production logic in this audit phase.
3. Do NOT break:
   - nail salon AI receptionist
   - mobile barber booking
   - OpenAI fallback
   - Gemini fallback
   - text chat booking
   - voice permissions
4. Do NOT replace the whole voice system.
5. Do NOT hardcode Vietnamese-only behavior.
6. Solution must support multilingual routing:
   - English
   - Vietnamese
   - Spanish
7. The final recommendation must preserve fallback behavior:
   - Gemini preferred for Vietnamese if configured
   - OpenAI fallback only if Gemini unavailable

---

## Files / Areas to Inspect
Search and inspect actual code. Do not guess.

Look for:
- Gemini usage
- Google voice usage
- OpenAI realtime usage
- AI receptionist config
- nail salon agent config
- mobile barber agent config
- language detection
- manual language selection buttons
- voice provider selection
- text-to-speech provider
- speech-to-text provider
- environment variables
- API route handlers
- vendor type / vertical type routing
- booking assistant launch buttons

Suggested search terms:
```bash
grep -R "Gemini" -n .
grep -R "gemini" -n .
grep -R "Google" -n .
grep -R "google" -n .
grep -R "Vietnamese" -n .
grep -R "vi" -n public src functions api server .
grep -R "OpenAI" -n .
grep -R "realtime" -n .
grep -R "voice" -n .
grep -R "nail" -n .
grep -R "mobile-barber" -n .
grep -R "ai receptionist" -n .
```

---

## Required Comparison

Create a side-by-side comparison:

### Nail Salon Voice Agent

Document:
- launch button / UI file
- JS handler
- API route
- provider used
- TTS provider
- STT provider
- language detection method
- Vietnamese config
- prompts/system instructions
- fallback behavior

### Mobile Barber Voice Agent

Document:
- launch button / UI file
- JS handler
- API route
- provider used
- TTS provider
- STT provider
- language detection method
- Vietnamese config
- prompts/system instructions
- fallback behavior

---

## Specific Questions To Answer

1. Does nail salon actually use Gemini for Vietnamese voice?
2. If yes, where is that configured?
3. Does Mobile Barber route call the same Gemini-capable code?
4. If not, what route or function does it call instead?
5. Is Mobile Barber using OpenAI Realtime by default?
6. Is Vietnamese language selection passed through as:
   - vi
   - vi-VN
   - Vietnamese
   - another value?
7. Is the provider decision based on:
   - route
   - vendor category
   - selected language
   - browser locale
   - hardcoded default
   - env var
8. Is Gemini disabled because of missing env key?
9. Is the Mobile Barber voice button wired to the wrong assistant?
10. What is the safest minimal fix?

---

## Required Output File

Create:
`docs/mobile_barber_voice_vietnamese_gemini_audit.md`

---

## Audit Report Must Include

1. Summary of findings
2. Nail salon voice path
3. Mobile Barber voice path
4. Exact fallback point to OpenAI
5. Missing config, route, or language propagation issue
6. Environment variables checked
7. Risks
8. Recommended patch plan
9. Files that would need changes
10. Regression test plan

---

## Recommended Patch Plan Format

Do not implement yet unless clearly safe.

Provide patch plan as:

### Fix Option A — Minimal Routing Fix
Use existing Gemini Vietnamese voice route for Mobile Barber when language is Vietnamese.

### Fix Option B — Shared Voice Provider Selector
Create reusable provider selector:

```js
selectVoiceProvider({
  vertical,
  language,
  vendorId,
  fallbackProvider
})
```

Vietnamese should prefer Gemini if configured.

### Fix Option C — UI Language Propagation Fix
Pass selected/detected language from Mobile Barber UI into voice session start.

---

## Verification Plan

After future fix, tests must cover:
1. Mobile Barber Vietnamese voice
2. Mobile Barber English voice
3. Mobile Barber Spanish voice
4. Nail salon Vietnamese voice still works
5. Nail salon English voice still works
6. OpenAI fallback still works if Gemini unavailable
7. No booking regression
8. No voice UI regression

---

## PASS Criteria

PASS only if the audit identifies:
- current nail salon Vietnamese provider
- current Mobile Barber provider
- exact reason Mobile Barber uses poor Vietnamese/OpenAI path
- exact files/functions responsible
- safe minimal patch plan

If unclear, mark BLOCKED and explain what runtime logs or environment values are needed.
