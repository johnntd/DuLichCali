# DuLichCali — Full App System Audit

## Role

Read-only audit of the full DuLichCali app for production readiness.

Do NOT modify code. Inspect and report first.

---

## Audit Scope

### Pages

| Page | File | Audit Focus |
|------|------|-------------|
| Homepage | `index.html` | 3-panel layout, hero carousel, AI launcher buttons, mobile nav |
| Nail salon | `nailsalon/index.html` | Luxurious Nails — reference standard |
| Hair salon | `hairsalon/index.html` | Beauty Hair OC — must match nailsalon standard |
| Food vendors | `foods/index.html` | Vendor tabs, ordering flow |
| Travel page | `travel.html` | Package carousel, destination modal |
| Marketplace | `marketplace/marketplace.js` | Vendor loading, tabs, booking entry |
| Admin | `admin.html` | Vendor management, driver management, PIN system |
| Vendor admin | `vendor-admin.html` | Vendor login, vendor dashboard |
| Salon admin | `salon-admin.html` | AI key, staff schedule, booking management |
| Driver admin | `driver-admin.html` | Compliance, rides, tours |

### Systems

| System | Files | Audit Focus |
|--------|-------|-------------|
| AI receptionist | `nailsalon/receptionist.js` | Booking flow, language, availability check |
| AI engine | `ai-engine.js`, `aiOrchestrator.js` | Provider routing, fallback, key handling |
| Booking | `script.js` | Airport/ride booking, capacity, pricing |
| Firestore | `firestore.rules`, `firestore.indexes.json` | Security rules, index coverage |
| Firebase Functions | `functions/index.js` | Secret handling, AI proxy, notifications |
| Travel packages | `travel-packages.js`, `destinations.js` | Data model, carousel |
| Location-aware | `landing-nav.js` | Does not overwrite valid vendor data |
| Voice mode | `nailsalon/voice-mode.js` | TTS chain, iOS constraints |

---

## Key Audit Questions

**Nail salon (reference standard):**
- Luxurious Nails loads correctly?
- AI receptionist has correct vendor context?
- Booking gated on availability before confirmation?
- Voice mode TTS chain correct?
- Mobile layout at 375px?

**Hair salon (primary gap area):**
- Beauty Hair OC shows vendor-specific name, phone, address, hours?
- Hair-specific services, pricing, stylists?
- Michelle AI persona correctly applied?
- Voice mode present?
- What gaps exist vs Luxurious Nails?

**Airport/ride booking:**
- Vehicle capacity enforced (4-seat car ≠ 7 or 12 passengers)?
- Pricing computed correctly from rate table?
- All 3 booking modes working (pickup, dropoff, private ride)?

**AI receptionist:**
- Real-time clock used for open/closed detection?
- Staff schedule checked before confirming availability?
- Language detection working (vi / en / es)?
- No hardcoded strings in any language? (VIOLATION — must report)
- Voice mode present in both nail and hair salon?

**Firestore / data model:**
- Security rules complete and not overly permissive?
- Indexes cover all active queries?
- Driver compliance enforced (only `approved` drivers in availability)?
- Vendor `adminStatus` checked on every login?

**Mobile / desktop:**
- Homepage 3-panel layout on mobile?
- Bottom nav on mobile, sidebar on desktop (1200px+)?
- Vendor pages usable at 375px?

**Deployment:**
- JS version strings (`?v=`) up to date?
- No build or function deploy risks?
- No secrets in source?

---

## Classification

| Code | Meaning |
|------|---------|
| P0 | Production blocker |
| P1 | Major user-facing bug |
| P2 | Important weakness |
| P3 | Improvement |

---

## Output: Phased Fix Plan

After the audit report, produce a phased plan:

**Phase 1:** Hair salon / Beauty Hair OC — match Luxurious Nails standard.
**Phase 2:** Booking and AI receptionist correctness.
**Phase 3:** Mobile/UI/carousel polish.
**Phase 4:** Vendor admin and data model hardening.
**Phase 5:** Travel/media improvements.

---

## Hard Rules

- Do not start fixing. Stop after audit report + phased plan.
- Only report confirmed findings from source.
- Do not expose API keys, credentials, or customer data.
- Use Luxurious Nails as the reference standard throughout.
