# DuLichCali — Hair Salon System Audit

## Role

Read-only audit. Do NOT modify code.

Inspect the hair salon interface, specifically Beauty Hair OC, and compare it against the Luxurious Nails reference standard. Produce a prioritized audit report. Stop after the report.

---

## Reference Standard

Luxurious Nails (`/nailsalon?id=luxurious-nails`) is the gold standard.

Beauty Hair OC (`/hairsalon?id=beauty-hair-oc`) must be an equivalent vendor-specific page — not a generic directory page.

---

## Files to Inspect

Read these fully or in relevant sections:

1. `hairsalon/index.html`
2. `marketplace/services-data.js` — beauty-hair-oc block + luxurious-nails block
3. `marketplace/marketplace.js` — vendor loading, rendering, AI panel
4. `marketplace/vendor-data-service.js` — if present
5. `nailsalon/index.html` — reference structure
6. `nailsalon/receptionist.js` — how vendor context is injected into AI prompt

---

## Audit Checklist

For each item, report: expected / actual / gap / root cause / fix priority.

**Vendor identity:**
- Vendor name shown: "Beauty Hair OC"
- Vendor phone shown (vendor-specific, not generic)
- Vendor address shown (Westminster / Orange County area)
- Business hours shown (hair salon hours)

**Services and staff:**
- Hair-specific services listed (Cut, Color, Blowout, Balayage, Keratin, etc.)
- Hair-specific pricing shown
- Stylists/staff shown (Michael Nguyen, Michele, Tracy Tran)

**AI receptionist:**
- Michelle persona correctly applied
- Correct vendor context (beauty-hair-oc) in AI system prompt
- Services, staff, hours in AI context
- Language detection working (vi / en / es)
- No hardcoded strings in any language in source

**Voice:**
- Voice mode present (compare with nailsalon/voice-mode.js as reference)
- TTS chain present (OpenAI → Gemini → browser)

**Booking:**
- Booking entry point present and functional
- Availability check gates before confirmation

**UI / Layout:**
- Hero carousel present with hair-specific images
- Z-index/overlay correct (no bleed-through)
- Mobile layout at 375px
- Desktop layout at 1280px

**Isolation:**
- No leakage of Luxurious Nails data on hair salon page
- No generic directory behavior (must be single-vendor page)

---

## Comparison Table

Fill in from audit:

| Feature | Luxurious Nails | Beauty Hair OC | Gap | Root Cause | Priority |
|---|---|---|---|---|---|

---

## Finding Format

```
ID: H-01
Severity: P0 / P1 / P2 / P3
Symptom:
Root cause: [file:line or code path]
Files involved:
Proposed fix: [smallest safe change]
Risk:
Required test:
```

Severity:
- P0: production blocker (wrong data shown, broken booking, broken AI)
- P1: major user-facing bug (broken layout, broken voice, broken carousel)
- P2: important weakness (gap vs nailsalon standard)
- P3: improvement (polish)

---

## Output

1. Executive summary — overall health vs Luxurious Nails standard
2. Comparison table — filled in
3. All confirmed findings — P0/P1/P2/P3
4. Root cause analysis — shared vs per-vendor code paths
5. Recommended fix order

Do not fix. Stop after audit report.
Do not expose API keys, Firebase credentials, or customer data.
