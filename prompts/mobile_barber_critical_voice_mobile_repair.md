# CRITICAL REPAIR — Mobile Barber Voice Provider + Mobile UX

## Current Failure
Previous patches did NOT actually fix the issues.

1. **Vietnamese voice is still poor.** The app must verify whether Gemini API is actually used for Vietnamese voice. Vietnamese must NOT silently fall back to OpenAI or Anthropic voice.
2. **Mobile Barber vendor pages are still unreadable/unusable on mobile.** Use the `ui-ux-pro-max` skill/mode to audit and fix the mobile webapp.

Target route:
`https://www.dulichcali21.com/mobile-barber/vendor/michael-nguyen-oc`

But the fix must apply to ALL barber vendors: `/mobile-barber/vendor/:vendorId`

---

## HARD RULES
1. Do NOT mark PASS based on code inspection only.
2. Do NOT claim Gemini is used unless runtime logs prove it.
3. Do NOT claim mobile is fixed unless screenshots or viewport tests prove it.
4. Do NOT hardcode Michael only.
5. Do NOT break:
   - nail salon AI
   - salon booking
   - mobile barber booking
   - AI chat
   - AI voice
   - dashboard
   - food
   - rides
   - travel

---

## Allowed files
- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/dashboard.html
- mobile-barber/mobile-barber.css
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber-voice.js
- mobile-barber/mobile-barber-agent.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-data.js
- mobile-barber/mobile-barber-dashboard.js
- nailsalon/voice-mode.js  (read-only; only modify if introducing a shared provider selector that nailsalon must also import — and only after the report documents byte-identical Vietnamese routing for Lily before vs after)
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-data-model.js
- tests/lib/mobile-barber-voice.js
- docs/mobile_barber_critical_voice_mobile_repair_report.md

Do not touch any file outside this list. In particular do not touch:
- `firestore.rules`, `functions/`, `firestore.indexes.json`
- `nailsalon/receptionist.js`, anything else under `nailsalon/` besides `voice-mode.js`
- `hairsalon/`, `marketplace/`, `ai-engine.js`, `script.js`, `chat.js`, `workflowEngine.js`, `style.css`
- Any auth/driver/ride/food/travel surface.

---

## PART A — Vietnamese Voice Provider Audit + Fix

### Objective
Make Vietnamese voice use Gemini voice when configured.

Prove which provider runs **at runtime** via console logs and a Playwright network probe — not via grep.

### Required Runtime Logging
Add (or keep) gated diagnostic logging in `mobile-barber/mobile-barber-voice.js`. The log line must fire on every `speakReply()` decision and on every provider attempt:

```js
console.info('[voice-provider]', {
  vertical: 'mobile-barber',
  route: location.pathname,
  vendorId,
  requestedLanguage,    // raw lang from controller getLang()
  normalizedLanguage,   // mapped to 'vi'|'en'|'es'
  selectedProvider,     // 'gemini' | 'openai' | 'browser'
  selectedModel,        // e.g. 'gemini-2.5-flash-preview-tts' | 'tts-1'
  selectedVoice,        // e.g. 'Aoede' | 'nova'
  fallbackReason,       // '' or 'no-key' | 'fetch-failed' | 'http-<code>'
  usingGemini,          // boolean
  usingOpenAI,          // boolean
  usingAnthropic        // always false — assert at runtime
});
```

The log must run unconditionally in dev/production. It is small and useful; not gated behind a debug flag.

For Vietnamese Mobile Barber expected log shape:
- `requestedLanguage`: `'vi'` or `'vi-VN'`
- `normalizedLanguage`: `'vi'`
- `selectedProvider`: `'gemini'` (when key present)
- `usingGemini`: `true`
- `usingOpenAI`: `false`
- `usingAnthropic`: `false`

If `usingGemini` is `false` for Vietnamese, the log must explain why via `fallbackReason`. If the reason is `'no-key'`, that means no Gemini key is configured anywhere reachable to the client; the fix is config-only and must be documented.

### Required Audit (read-only first)
Search and compare:
```bash
grep -R "gemini" -n .
grep -R "Gemini" -n .
grep -R "OpenAI" -n .
grep -R "Anthropic" -n .
grep -R "voice" -n .
grep -R "vi-VN" -n .
grep -R "Vietnamese" -n .
grep -R "mobile-barber" -n .
grep -R "nailsalon" -n .
```

Compare:
- nail salon Vietnamese voice path (`nailsalon/voice-mode.js`, `nailsalon/receptionist.js`)
- mobile barber Vietnamese voice path (`mobile-barber/mobile-barber-voice.js`, `mobile-barber/mobile-barber-vendor.js`)

Find the exact divergence.

### Required Fix Behavior
Vietnamese in Mobile Barber must reach Gemini TTS first.

If implementing a single shared selector across mobile-barber and nail salon:

```js
// new shared helper, location TBD by the implementer — must be loadable from both
// nailsalon/voice-mode.js and mobile-barber/mobile-barber-voice.js without breaking
// existing globals or module loading order.
function selectVoiceProvider({ vertical, vendorId, language, preferredProvider, geminiKey, openAiKey }) {
  // returns: { provider, model, voice, fallbackReason }
}
```

Rules:
- Vietnamese prefers Gemini/Google voice when a Gemini key exists.
- OpenAI fallback only when Gemini unavailable.
- Anthropic must not be used for Vietnamese speaking voice unless explicitly configured (it currently is never used by either voice module — assert this and keep it true).
- English can remain current provider.
- Spanish must still work (OpenAI-first today).
- `fallbackReason` must be logged.

If the shared selector requires changes to `nailsalon/voice-mode.js`, the report must include a before/after diff of Lily's effective Vietnamese routing showing it is byte-identical for Vietnamese, English, and Spanish.

### Required Verification (RUNTIME, not code-inspection)
The implementer must run a headless Playwright probe against **production** OR against `python3 -m http.server 8080` on the working tree, and capture:

1. Mobile Barber `/mobile-barber/vendor/michael-nguyen-oc?lang=vi`: open the voice overlay (programmatically via `document.querySelector('[data-action="openVoiceAssistant"]').click()`), let the welcome utterance fire, dump every `[voice-provider]` console log captured, and dump every outbound network request whose URL contains `generativelanguage.googleapis.com` or `api.openai.com/v1/audio/speech`. The captured logs and network requests are the proof.
2. Mobile Barber English (`?lang=en`): same probe. Expected provider order shows OpenAI first (or whatever was decided), Gemini after.
3. Nail salon Vietnamese: visit a Lily voice surface (e.g. `https://www.dulichcali21.com/nailsalon/?id=luxurious-nails` then click the voice button), record the same logs.
4. With the Gemini key deliberately removed from `localStorage` (set to empty before triggering voice), confirm Mobile Barber Vietnamese falls back to OpenAI and the log carries `fallbackReason: 'no-key'`.

If the implementer cannot run Playwright in the sandbox, the report must mark PART A as BLOCKED and provide the exact commands and curl/console snippets the human can run to verify.

---

## PART B — Mobile UX Audit + Fix Using ui-ux-pro-max

### Objective
Use the `ui-ux-pro-max` skill to audit the live Mobile Barber vendor page on mobile and produce a punch list of concrete issues, then fix the shared template.

### Required ui-ux-pro-max audit step
Before changing CSS, the implementer must invoke the skill's checklist:

```
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "mobile vendor service barber" --design-system -p "Mobile Barber"
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "mobile touch target accessibility" --domain ux
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "service card carousel scroll snap" --domain style
```

The report must include a "Findings against ui-ux-pro-max checklist" section listing every violation observed on the current production page (touch target size, contrast, cursor pointer, focus rings, viewport overflow, etc.) — with evidence from the Playwright capture.

### Must Fix (with screenshot proof)
For `/mobile-barber/vendor/:vendorId`:
- no horizontal overflow at 375 px, 360 px, 390 px, 414 px viewports
- readable text — body min 16 px, headings clamp scaled
- proper spacing — section padding 14–16 px on mobile
- mobile-first hero — identity card visible above the fold; image is secondary not dominant
- service carousel instead of desktop grid on mobile (already in place — verify or fix)
- large thumb-friendly buttons — min-height 48 px on every interactive surface inside the page
- sticky bottom booking CTA with `padding-bottom: env(safe-area-inset-bottom)`
- portfolio carousel — horizontal swipe with scroll-snap (already in place — verify or fix)
- clean booking panel — collapse to inline card on mobile, no sticky sidebar feel
- no tiny chips/buttons — meta chips min 2.25 rem touch height
- no desktop sidebar on mobile

### Required Mobile Breakpoints to Test
- 375 × 667 (iPhone SE / classic mobile)
- 390 × 844 (iPhone 14)
- 414 × 896 (iPhone 11)
- 360 × 800 (typical Android)
- 768 × 1024 (iPad portrait — tablet check)

### Required CSS Standards
For mobile:

```css
@media (max-width: 768px) {
  /* mobile-first layout — no desktop assumptions */
}
```

Rules:
- body/page width must not exceed viewport (`overflow-x: hidden` on `.mb-page` is OK)
- all cards `max-width: 100%`
- images `object-fit: cover`
- buttons `min-height: 48px`
- sections use 14–16 px side padding
- no fixed desktop widths on mobile
- service cards use scroll-snap carousel
- sticky CTA safe-area aware via `padding-bottom: env(safe-area-inset-bottom)`
- respect `@media (prefers-reduced-motion: reduce)`

---

## Required Visual Verification (NOT optional)
The implementer must produce, as artifacts checked into the run folder or attached to the report:

1. Playwright screenshot of `/mobile-barber/vendor/michael-nguyen-oc` at 390 × 844 — full page
2. Playwright screenshot of `/mobile-barber/vendor/tim-nguyen-bay` at 390 × 844 — full page
3. Playwright screenshot of the same page at 1440 × 900 — desktop sanity check
4. Console log from each screenshot run, showing zero red errors (404s on placeholder images may be tolerated; document them)
5. Confirmation that `document.documentElement.scrollWidth === document.documentElement.clientWidth` on every mobile viewport — i.e. no horizontal overflow

Screenshots must be saved under `.ai_runs/latest/screenshots/` (or `/tmp/dlc_screenshots/`) and referenced from the report. Do not delete them on cleanup.

---

## Required Routes to Test
- `/mobile-barber/vendor/michael-nguyen-oc`
- `/mobile-barber/vendor/tim-nguyen-bay`
- `/mobile-barber`
- `/mobile-barber/dashboard?vendorId=michael-nguyen-oc`
- `/nailsalon/?id=luxurious-nails` (regression check only — must still render and load voice)

---

## Required Report
Create `docs/mobile_barber_critical_voice_mobile_repair_report.md` with:

1. Root cause of Vietnamese voice failure — specific to runtime evidence, not theory
2. Actual provider used **before** this patch (with log lines or network captures)
3. Actual provider used **after** this patch (with log lines or network captures)
4. Whether a Gemini API key/config is actually reachable to the client (read from Firestore at runtime; if not, the fix is config-only and the report must say so explicitly)
5. Runtime provider logs — pasted verbatim, including the `[voice-provider]` JSON for VI, EN, ES on Mobile Barber, plus VI on nail salon
6. Root cause of mobile layout failure — specific to user's observed issue at 375 px
7. Files changed
8. Mobile screenshots or viewport proof (PNG paths + captioned)
9. Booking regression result (manual booking still saves to Firestore — verify via dashboard read after a test booking)
10. Nail salon regression result (Lily Vietnamese voice unchanged — log capture)
11. PASS / BLOCKED — with an explicit list of which PASS criteria were met and which were not

---

## PASS CRITERIA
Do NOT mark PASS unless **all** of the following are runtime-verified:

- Vietnamese Mobile Barber voice **runtime log proves Gemini/Google is selected** (provider: gemini, usingGemini: true)
- OpenAI/Anthropic are not used for Vietnamese unless Gemini unavailable
- `fallbackReason` is visible in the log if fallback happens
- mobile vendor page is **readable and screenshot-verified at 375 px width**
- no horizontal overflow at every required viewport (scrollWidth === clientWidth)
- service carousel works (scroll-snap, ~1.15 cards visible)
- sticky CTA works on mobile only, not desktop
- booking still works end-to-end (Firestore write verified post-patch)
- nail salon Vietnamese voice still works (regression check)

If any criterion is not runtime-verifiable in the sandbox, mark PART A or PART B as BLOCKED, list the missing capability, and provide the exact verification commands the human can run.
