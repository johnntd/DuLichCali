# DuLichCali Full App System Audit Prompt

## Role

You are auditing the full DuLichCali app (`dulichcali21.com`) for production readiness.

**Do not start coding immediately.**

Inspect and report first. All fixes require explicit approval and follow the ai_reviews/ workflow.

---

## Audit Scope

### Pages and Surfaces

| Surface | File | Audit Focus |
|---|---|---|
| Homepage | `index.html` | 3-panel layout, hero carousel, AI launcher buttons, mobile nav |
| Marketplace | `marketplace/marketplace.js` | Vendor loading, tabs, search, booking entry |
| Nail salon | `nailsalon/index.html` | Luxurious Nails — reference standard |
| Hair salon | `hairsalon/index.html` | Beauty Hair OC — must match nailsalon standard |
| Food vendors | `foods/index.html` | Vendor tabs, ordering flow |
| Travel page | `travel.html` | Travel package carousel, destination modal |
| Airport/ride | `index.html` (airport section) | Booking flow, vehicle capacity, pricing |
| Admin | `admin.html` | Vendor management, driver management, PIN system |
| Vendor admin | `vendor-admin.html` | Vendor login, vendor dashboard |
| Salon admin | `salon-admin.html` | AI key, staff schedule, booking management |
| Vendor login | `vendor-login.html` | PIN flow, Firebase Auth |
| Driver admin | `driver-admin.html` | Compliance, rides, tours |
| Driver login | `driver-login.html` | Phone + PIN auth |

### Systems

| System | Files | Audit Focus |
|---|---|---|
| AI receptionist | `nailsalon/receptionist.js`, `marketplace/marketplace.js` | Booking flow, language detection, availability check |
| AI engine | `ai-engine.js`, `aiOrchestrator.js` | Provider routing, fallback, key handling |
| Workflow engine | `workflowEngine.js` (if present) | State machine correctness |
| Booking | `script.js` | Airport/ride booking, capacity, pricing |
| Firestore | `firestore.rules`, `firestore.indexes.json` | Security rules, index coverage |
| Firebase Functions | `functions/index.js` | Secret handling, AI proxy, notifications |
| Notifications | `notifications.js` | SMS/email triggers |
| Travel packages | `travel-packages.js` | Data model, carousel |
| Remotion/YouTube | `remotion-promo/` | Media integration, carousel impact |
| Location-aware | `landing-nav.js` | Does not overwrite valid vendor data |

---

## Per-Surface Audit Questions

### Nail Salon (reference standard — establish baseline)
- Does Luxurious Nails load correctly at `/nailsalon?id=luxurious-nails`?
- Is AI receptionist working with correct vendor context?
- Is booking flow gating on availability before confirmation?
- Is voice mode enabled and TTS chain correct?
- Does mobile layout work at 375px?

### Hair Salon (primary concern — compare to nail salon standard)
- Does Beauty Hair OC load correctly at `/hairsalon?id=beauty-hair-oc`?
- Does it show vendor-specific name, phone, address, hours?
- Does it show hair-specific services, pricing, stylists?
- Is Michelle's AI persona correctly applied?
- Is booking functional?
- Is voice mode enabled?
- What gaps exist vs Luxurious Nails?

### Airport/Ride Booking
- Is the vehicle capacity enforced (4-seat car cannot be assigned to 7 or 12 people)?
- Is pricing computed correctly from rate table?
- Are all 3 booking modes working (pickup, dropoff, private ride)?

### AI Receptionist
- Is real-time clock used for open/closed detection?
- Is staff schedule checked before confirming availability?
- Is language detection working (vi/en/es)?
- Are hardcoded strings present (VIOLATION — must report)?
- Is voice mode enabled in both nail and hair salon?

### Firestore / Data Model
- Are security rules complete and not overly permissive?
- Are indexes covering all active queries?
- Is driver compliance enforced (only `approved` drivers appear in availability)?
- Is vendor `adminStatus` checked on every login?

### Mobile / Desktop Layout
- Does the homepage 3-panel layout hold on mobile?
- Does bottom nav appear correctly on mobile?
- Does sidebar nav appear correctly on desktop (1280px+)?
- Are vendor pages usable on 375px mobile?

### Deployment
- Is `firebase.json` hosting config correct?
- Are all JS version strings (`?v=`) up to date?
- Are there any build or function deploy risks?

---

## Classification

| Code | Meaning |
|---|---|
| P0 | Production blocker — broken booking, wrong vendor data, security issue |
| P1 | Major user-facing bug — broken layout, broken AI, broken voice |
| P2 | Important weakness — partial feature gap vs standard |
| P3 | Improvement — polish, nice-to-have |

---

## Output: Phased Fix Plan

After completing the audit report, produce a phased fix plan:

**Phase 1: Hair Salon / Beauty Hair OC**
Fix all P0/P1 issues in the hair salon vendor page.
Target: Beauty Hair OC matches Luxurious Nails standard.

**Phase 2: Booking and AI Receptionist**
Fix confirmed booking and AI correctness issues.
Target: Availability gating works. Language detection correct. No hardcoded strings.

**Phase 3: Mobile/UI/Carousel**
Polish mobile layout, fix any carousel or media issues.
Target: App is usable and correct at 375px.

**Phase 4: Vendor Admin and Data Model**
Fix vendor/driver auth, compliance enforcement, Firestore rules.
Target: Security rules correct. Driver compliance enforced.

**Phase 5: Travel/Media**
Fix travel package carousel, Remotion/YouTube integration.
Target: Travel page carousel works correctly.

---

## Hard Rules

- Do not start fixing. Stop after audit report + phased plan.
- Do not guess — only report confirmed findings from source.
- Do not expose API keys, Firebase credentials, customer data, or vendor private data.
- Use Luxurious Nails page as reference standard for all salon/vendor pages throughout.
- Mark which findings require human decision vs can be auto-fixed.
