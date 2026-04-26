# DuLichCali Hair Salon System Audit Prompt

## Role

You are auditing the DuLichCali app with special focus on the hair salon interface, specifically Beauty Hair OC.

**Do not start coding immediately.**

Your job is to inspect the codebase, identify confirmed weaknesses, compare Beauty Hair OC against the Luxurious Nails standard, and produce a prioritized audit report.

---

## Reference Standard

Luxurious Nails (`/nailsalon?id=luxurious-nails`) is the gold standard for all vendor pages.

The hair salon page for Beauty Hair OC (`/hairsalon?id=beauty-hair-oc`) must be an equivalent vendor-specific page — not a generic directory page.

---

## Audit Target: Beauty Hair OC

Audit `hairsalon/index.html` and all files it loads for:

| Feature | Expected | Actual | Gap | Root Cause | Fix Priority |
|---|---|---|---|---|---|
| Vendor name shown | "Beauty Hair OC" | ? | ? | ? | ? |
| Vendor phone shown | Vendor-specific | ? | ? | ? | ? |
| Vendor address shown | Westminster, OC | ? | ? | ? | ? |
| Business hours shown | Hair salon hours | ? | ? | ? | ? |
| Hair-specific services listed | Cut, Color, Balayage, Keratin, etc. | ? | ? | ? | ? |
| Hair-specific staff/stylists | Michael, Michele, Tracy | ? | ? | ? | ? |
| Pricing displayed | Per services-data.js | ? | ? | ? | ? |
| Carousel/showcase present | Yes | ? | ? | ? | ? |
| AI receptionist panel | Michelle persona | ? | ? | ? | ? |
| Voice support | Enabled | ? | ? | ? | ? |
| Booking flow entry point | Works | ? | ? | ? | ? |
| Availability check gates booking | Yes | ? | ? | ? | ? |
| Mobile layout (375px) | Correct | ? | ? | ? | ? |
| Desktop layout (1280px) | Correct | ? | ? | ? | ? |
| Z-index/overlay correct | No bleed-through | ? | ? | ? | ? |
| Correct vendor context injected | beauty-hair-oc | ? | ? | ? | ? |
| No leakage from Luxurious Nails | Clean | ? | ? | ? | ? |
| No generic directory behavior | Single vendor | ? | ? | ? | ? |

---

## Files to Read

Read these files fully or in relevant sections:

1. `hairsalon/index.html` — entire file
2. `marketplace/services-data.js` — beauty-hair-oc vendor block + cali-hair-beauty block
3. `marketplace/marketplace.js` — vendor loading and rendering logic
4. `marketplace/vendor-data-service.js` — if present, how vendor data is fetched
5. `nailsalon/index.html` — first 100 lines (reference structure)
6. `nailsalon/receptionist.js` — how vendor context is injected into AI prompt (reference)

---

## Related Systems to Audit

After auditing the vendor page itself, check:

**Routes and loading:**
- How does `hairsalon/index.html` decide which vendor to show?
- Is `?id=beauty-hair-oc` required? What happens without it?
- Does it fall back to a correct default or show wrong data?

**Firestore/data loading:**
- Which Firestore collection powers the hair salon page?
- What happens if Firestore is unavailable — does it fall back to services-data.js correctly?

**AI receptionist:**
- What system prompt context is injected for Beauty Hair OC?
- Is Michelle's persona correctly applied?
- Is the correct vendor data (services, staff, hours) in the AI context?
- Is language detection (vi/en/es) wired correctly?

**Booking:**
- Where does the booking entry point live on the hair salon page?
- Does it check availability before confirming?

**Staff/services model:**
- Is the hair services model consistent with nailsalon services structure?
- Are staff working hours and days configured correctly for hair stylists?

**Carousel/media:**
- Is there a hero carousel on the hair salon page?
- Are hair-specific images used (not nail salon images)?

**Mobile controls:**
- Does the bottom navigation show on mobile for hair salon?
- Are touch targets correctly sized?

**Voice mode:**
- Is voice mode enabled for the hair salon AI receptionist?
- Is the TTS chain (OpenAI → Gemini → browser) present?

---

## Classification

Classify every finding as:

| Code | Meaning |
|---|---|
| P0 | Production blocker — incorrect data shown, broken booking, broken AI |
| P1 | Major user-facing bug — wrong layout, broken carousel, voice not working |
| P2 | Important weakness — minor display errors, missing features vs nailsalon |
| P3 | Improvement — nice-to-have polish |

---

## Finding Format

For each confirmed finding:

```
ID: H-01
Severity: P0 / P1 / P2 / P3
Symptom: [what the user sees or what breaks]
Root cause: [exact file + line if known, or code path]
Files involved: [file.js:line or file.html section]
Proposed fix: [smallest safe change]
Risk: [what else could break]
Required test: [how to verify the fix]
```

---

## Output Format

Produce a structured audit report with:

1. **Executive summary** — overall health of Beauty Hair OC page vs Luxurious Nails standard
2. **Feature comparison table** — filled in from the audit
3. **Confirmed findings** — all P0/P1/P2/P3 items in finding format above
4. **Root cause analysis** — shared vs per-vendor code paths
5. **Recommended fix order** — P0 first, then P1, then P2
6. **Regression risks** — what to watch when fixing

---

## Hard Rules

- Do not start fixing. Stop after the audit report.
- Do not guess — only report confirmed findings from source.
- Do not include unrelated pages, routes, or booking systems unless they are directly involved in the hair salon flow.
- Do not expose API keys, Firebase credentials, customer data, or vendor private data in the report.
- Use the Luxurious Nails page as the comparison standard throughout.
