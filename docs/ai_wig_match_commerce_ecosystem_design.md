# AI Wig Match — Commerce / Partner Ecosystem (DESIGN ONLY)

- **Date:** 2026-06-14 · **Status:** Design document — **no implementation**. No code, callables, collections, or deploys are part of this doc.
- **Model (chosen):** Hybrid — **(1) Affiliate "Shop this look"** (link matched products to partner retailers + wig/hair-system vendors) **+ (2) Local vendor fitting** (connect to salons / mobile-barber vendors for in-person fitting via the existing booking system).
- **Catalog scope (chosen):** Wigs · Hair systems · Hair-care & styling products · Local fitting/styling services.
- **Hard guardrails carried over:** privacy-first (no selfie/generated image ever sent to partners or stored), AI keys server-side, vi/en/es, no medical claims for hair systems, FTC affiliate disclosure. The existing AI Wig Match + Style Studio behavior is unchanged by this design.

---

## 1. Goal
Turn an **AI Wig Match result** (the recommended wig/hair-system looks + their style attributes) into a path to actually obtain the look — buy a matching product online (affiliate) and/or get fitted locally (vendor booking) — generating affiliate + lead revenue, without compromising the privacy model.

## 2. Core principle — match by ATTRIBUTES, never by image
The commerce layer matches on the **text style attributes** AI Wig Match already produces (`family`, `length`, `color`, `texture`, `audience`, `coverage` for systems), **never** the selfie or the generated preview. The user's photo/preview never leaves the device and is never sent to a partner. "Shop this look" passes only the attribute filter (e.g. `wig · long · chestnut · wavy · women`) to find matching products. This preserves [[feedback_no_store_ai_hairstyle_images]].

## 3. Two commerce paths (per recommended look)

### Path A — Affiliate "Shop this look" (online product)
- Each wig/hair-system result card (and the full-screen viewer) gets a **"Shop this look"** action.
- It opens a commerce sheet showing 2–4 **matched partner products** (retailer thumbnail — the *product's* image, not the user's — title, price, retailer badge) with affiliate-tagged outbound links ("View on Amazon / Temu / AliExpress / {WigVendor}").
- Sources: general marketplaces (Amazon Associates, Temu, AliExpress affiliate) + dedicated wig/hair-system vendor affiliate programs (typically higher commission).
- **Hair-care & styling accessories** surface as an attach ("Complete the look": adhesive, care kit, brush) — also affiliate.

### Path B — Local vendor fitting (service)
- A **"Get fitted near you"** action → surfaces local salons / **existing mobile-barber vendors** flagged `offersWigFitting`, filtered by `serviceAreas` (reuse the current availability/region logic).
- Booking flows through the **existing booking system** (privacy-preserving: text style reference only, no stored images — the booking carries the wig look's *attributes/title*, not the preview).
- This is the platform's differentiator: an **online + offline** ecosystem that turns an AI match into a real in-person fitting, leveraging the vendor network already built.

## 4. Data model (DESIGN — not created)
```
commercePartners/{partnerId}
  name, type: 'affiliate' | 'vendor_fitting'
  category: 'wig' | 'hairsystem' | 'haircare' | 'service'
  affiliateNetwork?: 'amazon' | 'temu' | 'aliexpress' | 'wigvendor' | ...
  affiliateTag?, baseUrl?, commissionRate?, regions[], active, priority

commerceProducts/{productId}          // curated/affiliate catalog (or fetched via partner API)
  partnerId, title, category
  attributes: { family, length, color, texture, audience, coverage }
  price, currency, productImageUrl(partner-hosted), affiliateUrl, active

vendors/{vendorId}  (EXISTING — extend, do not fork)
  + offersWigFitting: bool, wigServiceIds[], (reuse serviceAreas / availability / compliance)

commerceClicks/{id}                   // analytics only — affiliate click-through (no user image)
  lookAttributes(text), partnerId, productId?, uid?(or anon), ts
```
Matching = rule/tag map from AI look `attributes` → product `attributes` (server-side or a thin callable later; **not built here**). Curated catalog first; partner-API (Amazon PA-API, etc.) dynamic matching later.

## 5. Privacy / security (carried over)
- No selfie or generated image is sent to any partner, stored, or included in outbound links. Matching + booking use **text attributes** only.
- Affiliate outbound = standard referral tag (no PII beyond the click). `commerceClicks` logs attributes + partner, never images.
- Partner/API keys (Amazon PA-API secret, etc.) live **server-side only** (Functions secrets), never frontend — same rule as the AI keys.
- Local-fitting booking reuses the existing privacy-safe booking write (`stripUnstoredImages`).

## 6. Revenue
- **Affiliate commission:** marketplaces (~1–4% beauty) + dedicated wig/hair-system vendor programs (often higher). Hair-care attach lifts basket.
- **Local fitting:** lead/booking value through the vendor system (drives vendor bookings → platform value; an optional lead fee later).
- **Membership tie-in (future):** Premium members get curated expert picks, partner discount codes, or a fitting-concierge — a paid-tier perk that doesn't gate the free affiliate links.

## 7. UX on /style-studio (design)
- Wig result card + viewer: **"Shop this look"** (Path A) and **"Get fitted near you"** (Path B, shown only where a local fitting vendor serves the user's region).
- A commerce sheet (bottom-sheet on mobile, consistent with the chips/cards language) lists matched products + the local-fitting CTA, with a clear **affiliate disclosure** line.
- All copy in vi/en/es. No native dropdowns (chips/cards), 44px touch targets — consistent with the just-shipped premium UI.

## 8. Compliance
- **FTC affiliate disclosure** on every shop surface ("We may earn a commission from these links").
- **No medical claims** for hair systems anywhere ("restore fullness / a fuller look", never "cure hair loss") — extends the existing thinning-hair language rule.
- Affiliate-program ToS (Amazon Associates / PA-API operating requirements, Temu/AliExpress terms), per-region availability, CCPA/GDPR for click logging, and partner vetting/quality gates.

## 9. Integration with the existing platform (reuse, don't fork)
- **Vendor + booking system** for Path B (`offersWigFitting` flag + the current availability/compliance/region logic + the booking write).
- **Marketplace card / sheet patterns** + the Style Studio component language for the UI.
- **Admin** (`admin.html`) gains a future "Commerce partners/products" section to manage partners, tags, and the curated catalog (multilingual, email-allowlist gated).
- Additive only — the AI Wig Match generation path is untouched.

## 10. Phasing (design-only roadmap — each its own future spec→plan→build)
- **C1 — Affiliate "Shop this look" (MVP):** curated partner links matched by attribute on wig results + a disclosure. Lowest build (no checkout, no inventory).
- **C2 — Local vendor fitting:** `offersWigFitting` + region filter + booking integration ("Get fitted near you").
- **C3 — Hair-care/accessories attach** (affiliate "complete the look").
- **C4 — Dynamic matching + admin + analytics:** partner-API product matching (Amazon PA-API…), admin partner/catalog management, `commerceClicks` analytics, membership perks.

## 11. Open questions for the build phase (not decided here)
- Which affiliate programs to apply to first (approval timelines: Amazon Associates, specific wig vendors)?
- Curated catalog vs. live partner-API matching for C1?
- Lead fee vs. free for local fitting (vendor-relations decision)?
- Where the commerce sheet sits relative to the membership gate (free affiliate vs Premium concierge)?

## 12. Explicitly NOT in this document
No code, no callables, no Firestore collections/rules, no UI, no deploy. This is the blueprint; each phase (C1–C4) gets its own spec → plan → implementation when commerce work is greenlit.
