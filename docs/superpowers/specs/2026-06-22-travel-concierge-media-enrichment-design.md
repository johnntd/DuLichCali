# Travel Concierge — AI Research Media Enrichment ("Learn more")

**Date:** 2026-06-22 · **Branch:** `travel-concierge` · **Status:** design locked (user-approved), code-hardened against the real renderers.

## 1. Goal
Every recommendation card (restaurant · attraction · tour · event · hotel · stopover · hidden gem) gets an expandable **"Learn more"** section with helpful, **never-faked** research links + media: YouTube/TikTok *search* links, Google/Yelp reviews, official site, menu, tickets, map, real photos, popular dishes, time-needed, best-time, why-it-fits / group-fit.

## 2. Locked decisions
- **Backend:** a new AI callable **`researchPlaceMedia`** curates the links (user's choice over pure client-side).
- **UI:** an inline **collapsible "Learn more"** on the card, sharing one builder with the existing `openPlaceModal`.
- **Rollout:** all 8 card types, **phased** (P1 placeCard+foodCard, P2 the other 6 + modal, P3 polish/i18n/gate).

## 3. Honesty model (NON-NEGOTIABLE — the crux of the AI-callable choice)
A new pure, unit-tested **`functions/lib/placeMediaSanitize.js`** (mirrors `userPlaceSanitize.js`) clamps the AI's `RecommendationMedia[]`:
- **video / youtube / tiktok → always a SEARCH link** built from the AI's curated query (`ytSearch`). NEVER a specific/embedded video URL. (Spec: "do not fake/embed unverified videos"; we have no YouTube Data API key to verify a watch URL.)
- **official_site / menu / ticket / blog_guide:** the AI's URL is kept ONLY if `https://` + on a safe-domain allowlist, marked `verificationStatus:'ai_suggested'` (pending), and a deterministic Google-search fallback is ALWAYS also provided; no safe URL → search link only (`verificationStatus:'search'`).
- **google_reviews / yelp / tripadvisor / photos(link) / map → deterministic search links** (`gsearch` / `FoodLinkProvider` / `StayLinkProvider` / `MapLinkProvider`) — honest by construction (`verificationStatus:'search'`).
- **Real photos** only via the existing `placeMedia` (Google Places → Wikipedia → none; the code's hard "never AI/generic images" rule). No AI imagery, ever.
- No fabricated ratings/prices/hours/availability — text only, behind the existing `tc-unverified` tag.
- `RecommendationMedia { type, title, url, source, verificationStatus, reason }` (spec model). `verificationStatus ∈ search | ai_suggested | verified` (verified = google_maps-sourced only).

## 4. Reuse map (verified — no shared card component; 8 renderers share leaf helpers)
| Renderer (fn @ line, drifts) | Inject point |
|---|---|
| `placeCard` (itinerary), `foodCard` (restaurant), `attractionCard`, `tourCard`, `stayCard`, `eventCard`, `stopoverCard`, live-highlights item | each builds a `*__acts` div — append the `learnMore` toggle there |

Reusable helpers (all confirmed): `gsearch(q)`, `MapLinkProvider.google/.apple`, `FoodLinkProvider` (.googleReviews/.yelp/.menu/.website/.tripadvisor/.photos), `StayLinkProvider`, `placeMedia(p,cls)` (verified-only photos), `openPlaceModal(p)`, `collapseGroup(titleKey,opensByDefault,buildBodyFn,countFn)` (the lazy accordion to mirror), `linkBtn(label,href,cls)`, `chip`, `pbtn`, `el`, `researchBanner`, `t()`. **Net-new:** `ytSearch`/`tiktokSearch` (no YouTube/TikTok builder exists today), the `researchPlaceMedia` callable + `placeMediaSanitize`, and the `TCMedia` builder/collapsible.

**Reusable research fields already returned (don't re-fetch):** restaurants → dishes/rating/priceRange/reservationNote/why; events → eventUrl + date/time; stopovers → estimatedStopDuration + mapUrl; routeOps → visitDuration + weatherSuitability; tours → duration; stays → starRating/amenities; highlights → whenRelevant. **No callable returns** menu/ticket/official URLs → those become search links unless the AI grounds one.

## 5. Architecture
- **`tc-media.js`** (new, pure browser-IIFE + node-testable, like `tc-journey-days.js`): `TCMedia.build(item, type, city) → RecommendationMedia[]` — deterministic baseline (search links + map + reviews via the existing providers + `ytSearch`) ordered by a **per-type priority table** (§6). `TCMedia.learnMore(item, type, city)` → a `collapseGroup` collapsible: prioritized link buttons + reused fields (why / group-fit / duration / best-time / dishes) + a lazy `placeMedia` photo slot + a lazy `researchPlaceMedia` enrich-on-expand (cached on the item as `item._media`). The same builder feeds `openPlaceModal`.
- **Client flow:** "Learn more" shows the **deterministic links instantly** (no wait, always honest); on first expand it lazily calls `researchPlaceMedia` to enrich ordering + add curated why/best-time + candidate official/menu/ticket links + refined video query; result cached so re-expand is free. Photos load lazily, verified-only.
- **Backend `researchPlaceMedia({ tripId, name, type, city, lang })`:** auth-gated (member); Gemini-grounded; returns `RecommendationMedia[]` + curated text; runs through `placeMediaSanitize` (§3) before returning. Degrades to `{ ok:false }` → client keeps the deterministic links.

## 6. Per-type priority (the spec's lists)
- **restaurant / coffee:** menu · google_reviews · yelp · youtube_search(food review) · photos · (dishes shown inline)
- **tour:** official_site(search) · ticket(search) · youtube_search · google_reviews · (duration + age-fit shown)
- **attraction:** official_site(search) · ticket(search) · youtube_search · google_reviews · map · photos
- **beach/scenic/hidden_gem (stopover/highlight):** map · youtube_search(travel guide) · google_reviews · (parking + best-time + walking shown)
- **event:** official_site(eventUrl or search) · ticket(search) · map · youtube_search · (date/time + weather shown)
- **hotel/stay:** booking(search) · google_reviews · tripadvisor · photos · map

## 7. Phasing
- **P1:** `placeMediaSanitize.js` + test · `tc-media.js` (`build`/`ytSearch`/type config) + test · `researchPlaceMedia` callable + live test · `learnMore` collapsible + inject into `placeCard` + `foodCard` · i18n keys · version bump → `20260622b`.
- **P2:** inject into `attractionCard`/`tourCard`/`stayCard`/`eventCard`/`stopoverCard`/live-highlights + enrich `openPlaceModal`.
- **P3:** per-type polish, lazy-photo wiring, full vi/en/es sweep, `full_system_dry_run` gate.

## 8. Testing
`placeMediaSanitize` + `TCMedia.build` are pure → node unit tests (`pricing.test.js`/`tc-journey-days.test.js` pattern): assert video→search (never a watch URL), guessed official/menu URL blanked-or-flagged + search fallback present, per-type ordering, `verificationStatus` correct, no fabricated price/rating. `researchPlaceMedia` live test asserts no fabricated video/URL + the `pending` fallback. DOM render verified at 375/1280. Gate: `FINAL: PASS`. **No deploy until confirmed.** Acceptance: SEAL Tour / La Jolla Cove / Sunset Cliffs / Pho 79 / Brodard / SD Zoo / LEGOLAND / Disneyland — each gets "Learn more" with the right links, no fake videos/prices/photos.

## 9. Honesty failure conditions (hard-stop)
A specific/embedded video URL; an AI-authored official/menu/ticket URL presented as verified; any AI/generic photo; a fabricated rating/price/hours. All must route to a search link or `pending verification`.
