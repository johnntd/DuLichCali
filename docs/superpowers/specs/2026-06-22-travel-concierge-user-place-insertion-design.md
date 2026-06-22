# Travel Concierge — "Add My Choice" User Place Insertion

**Date:** 2026-06-22
**Branch:** `travel-concierge`
**Status:** Design approved · hardened against code via adversarial review (v2)
**Author:** Claude (with johnntd)

> v2 note: this spec was rewritten after an adversarial review verified every
> load-bearing claim against `travel-concierge.js`, `functions/index.js`, and
> `firestore.rules`. Several v1 claims that framed net-new logic as "reuse" or
> asserted honesty guarantees the code does not provide were corrected. Line
> anchors below are function-name-first (line numbers drift in a 7400-line file —
> re-confirm by symbol at edit time).

---

## 1. Problem & Goal

Travel Concierge recommends restaurants, attractions, hotels, and activities, but a
user cannot add **their own** preferred place. Users often already know a specific
spot (e.g. *Pho 79, Garden Grove*) they want on the trip.

**Goal:** Let a trip participant add a named place of any supported type. The AI
researches it **in the background**, returns *labeled, never-faked* details,
auto-places it into a validated schedule slot, persists it across refresh +
regenerate, and lets families vote — all without presenting AI guesses as confirmed.

### Supported place types (9)
Restaurant · Coffee/Dessert · Attraction · Event · Hotel/Stay · Stopover ·
Activity · Shopping · Other (Custom note)

---

## 2. Locked Decisions

| Decision | Choice |
|---|---|
| **Storage** | Reuse existing stores: `added/backup/vote_only` → enriched `addedPlaces[]`; `replaced` → existing `placeOverrides[].replacement`. Every entry tagged `userChoice:true`. |
| **"Ask group to vote"** | Proposed (voting) lane on the target day; auto-promotes when `consensusFor()` verdict ∈ {liked, loved}. |
| **Placement** | Auto-place immediately, but the AI suggestion is **deterministically validated/clamped** (see §6.4). |
| **Research timing** | Background / non-blocking: optimistic "🔎 Researching…" card → fills with labeled data + re-slots on resolve; persists + resumes if the page closes. |
| **Honesty** | AI-sourced facts are **always** `pending_verification`; `'verified'` is reserved for `google_maps`-sourced sub-fields only (photos, place_id, route distance). |
| **Trust model** | Auto-promote / `proposed` / `lockedByUser` are **collaborative conventions, not tamper-proof** (field-open rules — see §12). |

---

## 3. Non-Goals (YAGNI)

- No new Firestore **subcollection** (field-open rules already allow new top-level fields).
- **No real-time menu/price/hours scraping** — research is Gemini-grounded + Google
  Places photos only; everything ungrounded is labeled **"Pending verification."**
- No new voting primitive — reuse `votes` / `favorites` / `consensusFor`.
- No separate `UserPlaceOverride` collection or parallel render engine — the spec's
  model is satisfied logically across the two existing stores.
- No price/URL/phone fabrication (hard rule, §6.5).

---

## 4. Reuse vs Net-New (honest accounting)

### Genuinely reusable as-is
| Unit (`travel-concierge.js`) | Role |
|---|---|
| `saveTrip` / `loadTrip` / `stripRuntime` | Persistence (localStorage + `groupTrips/{id}` merge). |
| `placeOverrides` engine — `placeKey`, `getOverride`, `setPlaceOverride`, `clearPlaceOverride`, `regenerateSingleDay`, `resetDayToAI`, `placementOnDay` | `replaced` keeps original skipped across regenerate (the "don't bring back unless restored" guarantee). |
| `votes` / `favorites` / `consensusFor` (NOT `voteVerdict`) | Like/Maybe/Skip/Favorite + family-weighted consensus + `{liked,loved}` verdict used for auto-promote. |
| `setItemPlacement` / `moveToDay` / `moveToSlot` | User re-places after auto-place. |
| Firestore rules | `groupTrips/{tripId}` update is field-open (rules ~L624) → no rules change for new fields. |
| `placePhotos` (`functions/index.js`) | Real Google Places photos; `[]` without a ≥20-char key. |
| `tcComputeRouteLegs` | Distance/time with `source` label (`google_maps`\|`estimated`\|`unknown`). |
| `serverCallGeminiGrounded` / `tripSalvageJson` | Grounded research call + JSON salvage. |

### Net-new logic (must be built — flagged because v1 mislabeled these as reuse)
1. **`researchUserPlace` callable** + its server-side sanitizer (§6).
2. **Richer added-place mapper** — `addedToPlace` returns only `id/name/category/address/whySelected/dataSource`; it drops every enriched field (`rating`, `photos`, `popularDishes`, `priceRange`, `estimatedDuration`, kid/senior, `websiteUrl`, `reservationUrl`, `googleMapsUrl`, `distanceNote`). `placeCard` reads all of those — so the mapper **must be extended** to forward them.
3. **Proposed (voting) lane** — `buildDayView` builds lanes strictly from `TIME_SLOTS` and drops any slot not in the set; there is **no** `proposed`/`vote_only`/lane concept today. New synthetic lane + promotion logic.
4. **`canSuggestPlace()` permission gate** — existing add entry points gate on `canEditPlan()` (owner/organizer only).
5. **Meal-type → slot mapping** (`TIME_SLOTS` lacks breakfast/snack/dessert/coffee).
6. **Resume-research pass** on `loadTrip` for entries stuck in `researching`.
7. **Deterministic placement validation/clamp** for `suggestedPlacement`.
8. **Cost line-item** in `computeTripCosts` (Phase 4) — it is 100% formula-based today.
9. **Consensus vote-keying decision** + audit (see §8).

---

## 5. UI Design

### 5.1 Permissions (net-new gate)
Existing add entry points route through `canEditPlan()` → `canApprove()` = owner ||
organizer. That excludes the plain members the vote flow targets.

- New **`canSuggestPlace()`** = any non-readonly participant (member or above).
- **Mapping:** "Add my place" (Add to itinerary / backup / **Ask group to vote** /
  Add to Food Picks) → `canSuggestPlace()`. **"Replace existing"** and **promote /
  demote a proposal** → `canEditPlan()` (owner/organizer).

### 5.2 Entry points
1. **Per day** (`dayActionsBar`, currently gated at the owner/organizer check): one
   **"＋ Add my place"** expander → 9 types.
   *Documented deviation:* the user's 5 named per-day buttons (restaurant / activity /
   stopover / hotel-stay / custom note) are **consolidated into the 9-type expander**
   for mobile density; the 9 types superset the 5.
2. **Per card** (`cardMenuPanel`): **Replace with my choice** · **Add alternative** ·
   **Add to this day** · **Add to Food Picks** · **Ask group to vote** (all 5 from the
   requirement).
3. **Per recommendation section** (Stays / Food / Attractions): section-level
   "＋ Add my place".

### 5.3 `addMyChoiceForm` — 3-step progressive disclosure (customer-form rule)
- **Step 1 — What:** type (pre-filled) · place name · area/city.
- **Step 2 — What to do:** **action selector** is the *single required* control
  (Add to itinerary · Save as backup · Ask group to vote · Add to Food Picks · Replace
  existing). Preferred **day / time / meal type are OPTIONAL**, collapsed under a
  **"More details (optional)"** expander (AI auto-places when blank). The Replace
  card-picker appears **only** after "Replace existing" is chosen.
- **Step 3 — Notes (optional)** → Submit.

### 5.4 Card states (`placeCard`)
- **Researching:** "🔎 Researching {name}…", **no factual chips** (nothing to show yet).
- **Researched (pending verification):** full chips, but `dataSource` stays
  `ai_researched_pending_verification` so the existing `/pending/` → `t('unverified')`
  tag **fires**; missing fields read "Pending verification"; **Retry research** present.
- A sub-field shows a confirmed marker **only** when its source is `google_maps`
  (photos / route distance) — never for rating/price/hours/dishes.

---

## 6. Backend — `researchUserPlace` callable

```
exports.researchUserPlace = onCall({ region:'us-central1',
  secrets:[GEMINI_API_KEY, GOOGLE_MAPS_API_KEY], timeoutSeconds:60, cors:true }, …)
```
**Auth:** `tripRequireAuth` + `tripCallerRole(tripId, uid)` ∈ member/organizer/owner.

**Input**
```jsonc
{ tripId, name, area, placeType,
  mealType,        // breakfast|lunch|dinner|snack|dessert|coffee (optional)
  preferredDay, preferredTime, notes,   // optional
  tripContext: { destinations, dayContents, hotelsByCity, groupProfile, routeLegs } }
```

### 6.1 Process
1. **Text research** via `serverCallGeminiGrounded` (its internal temp is fixed at 0.4
   — not a tunable arg). Prompt asks ONLY for text fields (§6.3). It MUST NOT request
   or accept any `photos`/`imageUrl`/`videoUrl` field.
2. **Parse:** strip ```` ```json ```` fences → replace control chars →
   `slice(indexOf('{')..lastIndexOf('}'))` → **then** `tripSalvageJson`.
3. **Photos (separate, deterministic):** reuse `placePhotos` logic
   (findplacefromtext + photo, ≥20-char key gate, keyless `lh3` redirect URLs,
   `source:'google_places'`). No key / not found → `photos:[]` (no placeholder, no AI image).
4. **Placement suggestion + validation** (§6.4).
5. **Server sanitizer** (§6.5) before returning.

### 6.2 Output
```jsonc
{ ok:true,
  place:{ name, address, rating, reviewCount, hours, popularDishes,
          priceRange, parkingNote, kidSuitability, seniorSuitability,
          estimatedDuration, websiteUrl, reservationUrl, reservationNote,
          googleMapsUrl, appleMapsUrl, photos, researchedPlaceId, why,
          dataSource:'ai_researched_pending_verification' },
  suggestedPlacement:{ day, slot, reason, fits },
  distanceNote, distanceSource,                 // distanceSource ∈ google_maps|estimated|unknown
  verificationStatus:'pending_verification' }    // never 'verified' for AI facts
```

### 6.3 Meal-type → slot mapping (net-new)
`TIME_SLOTS` = morning/lunch/afternoon/dinner/evening/optional/backup. Coerce via
`normSlot`: breakfast→`morning`, lunch→`lunch`, dinner→`dinner`,
snack/dessert/coffee→`afternoon` (or `evening` if `preferredTime` is late). Any
mealType not coerced to a `TIME_SLOTS` member would be dropped by `buildDayView`.

### 6.4 Placement validation/clamp (net-new)
The Gemini-suggested `{day,slot}` is **clamped** server-or-client on resolve:
- `day` → a valid **non-travel** (`!d.isTravelDay`), in-trip-date day; else nearest valid.
- `slot` → a `TIME_SLOTS` member; if the slot's hours conflict or are missing, fall
  back to the deterministic best slot via existing timing logic.
- `fits:false` → UI **warns and still places** (auto-place decision), with the warning
  surfaced on the card; the user can move it.

### 6.5 Honesty rules — server-side sanitizer (mirror `researchTripStays` `.map()`)
Applied to every field before return; **ungrounded fields are blanked, not guessed**:
- `rating` / `reviewCount` / `hours` → `''` unless grounded.
- `priceRange` → forced to `'pending verification'` unless it matches `$`/`$$`/`$$$`
  or a numeric range.
- `reservationUrl` / `websiteUrl` → `''` **unless** a well-known official domain
  (carry the itinerary prompt's guardrail string verbatim); never a guessed domain.
- `googleMapsUrl` / `appleMapsUrl` → **built deterministically** from name+address,
  never AI-authored.
- Any phone field → **stripped entirely**.
- `dataSource` → forced to `'ai_researched_pending_verification'`.
- `distanceNote` → append `(est.)` (or run through `routeSourceTag`) whenever
  `distanceSource !== 'google_maps'`. Under the placeholder Maps key, `estimated` is
  the **expected default** and must be labeled.

---

## 7. Data Model

### 7.1 Enriched `addedPlaces[]` entry (added / backup / vote_only)
```jsonc
{ id, name, category /*placeType*/, addedKind,
  userChoice:true, ucAction:'added'|'backup'|'vote_only',
  locationHint /*area*/, preferredDate, preferredTime, mealType, notes,
  lockedByUser:false, proposed:false,        // proposed=true while vote_only awaits consensus
  day, slot, order, pinned,
  verificationStatus:'researching'|'pending_verification',
  researchAttempts:0, researchedPlaceId,
  address, rating, reviewCount, hours, popularDishes, priceRange,
  parkingNote, kidSuitability, seniorSuitability, estimatedDuration,
  websiteUrl, reservationUrl, reservationNote, googleMapsUrl, appleMapsUrl,
  photos, distanceNote, distanceSource, whySelected,
  dataSource:'user_entered'|'ai_researched_pending_verification',  // flips on research resolve
  createdBy, createdAt, updatedAt }
```
**`addedToPlace` must be extended** (or replaced) to forward ALL of the above onto the
rendered place object (today it surfaces only 6 fields).

### 7.2 `replaced` (existing `placeOverrides[placeKey]`)
```jsonc
{ action:'replaced',
  replacement:{ …enriched researched fields…, userChoice:true, ucAction:'replaced' },
  name, createdBy, createdAt, updatedAt }
```
Both the **preserved original (skipped)** and the **replacement** must survive
regenerate. **Name-drift:** `placeKey` is name-based; if regenerate emits a renamed
near-duplicate of the replaced original, fold diacritics + case (the
`placeKey`/`isPinnedName` style) for the match, or accept-and-document the edge.

### 7.3 Spec `UserPlaceOverride` ↔ implementation
| Spec field | Home |
|---|---|
| tripId | implicit (`groupTrips/{tripId}`) |
| placeName / placeType / locationHint | `name` / `category` / `locationHint` |
| preferredDate / preferredTime / notes | same |
| researchedPlaceId / verificationStatus | same |
| action | `ucAction` (replaced lives in `placeOverrides`) |
| replacesPlaceId | `placeOverrides` key (original's `placeKey`) |
| lockedByUser | `lockedByUser` (drives `pinned`) |
| createdBy / createdAt | same |

---

## 8. Voting, consensus & promotion

- **Vote key = NAME** for userChoice/proposed/added entries (the engine is name-keyed:
  `consensusFor`, `consensusSort`, `recomputeAutoReject`, `isPinnedName`, and every
  existing `voteRow` caller pass `{name:...}`). The itinerary `voteRow` path currently
  keys added cards by `id`; **audit it to key userChoice entries by name** so votes
  agree across consensus/auto-reject/sort and **carry through promotion + regenerate**.
- **Auto-promote:** `proposed` clears when `consensusFor(name).verdict` ∈ {liked,loved}
  (NOT `voteVerdict`, which returns `{rejected,reason}`).
- **Global Optimize/regenerate respecting votes:** `userChoice 'added'` entries are
  treated as **pinned** (never auto-rejected); `backup`/`vote_only` follow existing
  rules; `recomputeAutoReject` must never silently drop an `added` userChoice place the
  group skipped (define + assert intended behavior).

---

## 9. Data flow — Pho 79 example
1. Member taps **＋ Add my place → Restaurant** → name "Pho 79", area "Garden Grove",
   action "Add to itinerary" (day/time/meal left blank).
2. **Optimistic insert:** `addedPlaces[]` entry `{verificationStatus:'researching',
   ucAction:'added', dataSource:'user_entered'}` (no slot yet) → `saveTrip` → render
   shows "🔎 Researching Pho 79…".
3. **Background:** `researchUserPlace` runs.
4. **On resolve:** extend the entry with enriched fields + photos; **flip `dataSource`
   → `ai_researched_pending_verification`**; set validated `{day,slot}` (§6.4);
   `verificationStatus:'pending_verification'`; `saveTrip`; render; toast
   *"Pho 79 added — best fit Jul 3 dinner (pending verification)"*.
5. **Persistence/regenerate:** survives refresh + regenerate (added→treated pinned;
   replaced→original stays skipped).

### Resume-research pass (net-new, §4.6)
On `loadTrip` success, scan `addedPlaces()` for `verificationStatus==='researching'`
**and** (`createdBy===me` **or** older than ~5 min); re-dispatch `researchUserPlace`;
cap at **3 attempts** → then `pending_verification` + Retry; guard against two members
racing (e.g. only the creator, or a `researchAttempts` compare-before-write).

---

## 10. "Add to Food Picks only" & bookings/checklist

- **Food Picks:** `trip.food[]` is grouped **by city**; `foodCard` needs
  `name/cuisine/priceRange/popularDishes→dishes/why` + `userChoice/verificationStatus`.
  Insertion: match `area` to the nearest destination city bucket, else a **"My picks"**
  bucket. Reuses the same `researchUserPlace` result.
- **Bookings checklist** ("if applicable"): the checklist is `mergeBookings`/`newBooking`
  deduped by `bookingKey`. **Decision:** for `added`/`replaced` **Hotel/Stay** (and
  ticketed attractions), surface an **explicit "Add to bookings" action** (consistent
  with existing hotel/restaurant cards), calling `newBooking` with the userChoice
  fields, deduped via `bookingKey`. (Not automatic — avoids polluting the checklist.)

---

## 11. Edge cases & environment honesty

- **Placeholder Maps key (current):** photos `[]`; distance labeled `(est.)`;
  rating/reviewCount best-effort from grounding only.
- **Place not found by Google:** keep AI text as `pending_verification`; no photos.
- **Research fails/times out:** `pending_verification` + Retry.
- **Duplicate detection:** scope = itinerary places + `addedPlaces` + `trip.food` +
  `placeOverrides` replacements + attractions/stopovers; normalize trim+lowercase+
  **diacritic-fold** ("Pho 79" vs "Phở 79", `placeKey` style); offer "go to it"
  (with the tab it lives in) instead of duplicating.

---

## 12. Trust model (field-open rules)

`groupTrips` update (rules ~L624) is field-open with **no role discrimination** — any
joined member can write `proposed`/`lockedByUser`/`pinned` or edit `votes`. Therefore:

- `proposed` / `lockedByUser` / consensus **auto-promote are collaborative, NOT
  tamper-proof**; the rule cannot enforce owner-only promotion. This matches the
  existing field-open trip-notes/plan-editing model — **accepted** for this feature.
- We do **not** claim "owner override" as a security guarantee. If tamper-resistance is
  later required, route explicit promote/demote through an Admin-SDK callable checking
  `tripCallerRole` (mirroring `decideTripSuggestion`, rules comment ~L616-619). Out of
  scope for now.

---

## 13. Phasing (gate each on `FINAL: PASS` before the next)

Do **not** ship as one plan — net-new logic touches CLAUDE.md audit-first areas (AI
prompts, cost engine, voting/booking). Hold the deploy until all phases done + user OK.

- **Phase 1 — Foundation (honesty-first):** `researchUserPlace` + sanitizer +
  per-field guardrails + `pending_verification`-only states; extend `addedToPlace`;
  meal-slot mapping; "Add to itinerary / Save as backup" with optimistic insert +
  Researching/Pending cards; resume-research pass; placement clamp; i18n keys; version
  bump; rules test; backend live test (incl. non-existent-place blanking). **No** Proposed
  lane, **no** cost change; entry gated owner/organizer for now.
- **Phase 2 — Replace + survival:** Replace-with-my-choice via `placeOverrides`;
  regenerate-survival of replacement **and** skipped original + name-drift; duplicate
  detection. Re-gate.
- **Phase 3 — Group voting:** Proposed (voting) lane (net-new `buildDayView` lane);
  `canSuggestPlace()` member gate; name-keyed consensus auto-promote; trust-model note.
  Re-gate.
- **Phase 4 — Integrations:** cost line-item in `computeTripCosts` (per-userChoice,
  labeled estimate, parses `estimatedCost`/`priceRange` → `tpCostMid`); Food Picks
  insertion (city-bucket reconciliation); bookings hook for Hotel/Stay + ticketed.
  Re-gate.

---

## 14. Testing & completion (CLAUDE.md)

1. **Rules test** — `tests/rules/firestore-rules.test.js`: append after the
   member-collaborate (~L220) / stranger-deny (~L225) cases, reusing the existing
   tripper/tripMember/stranger/anon contexts (~L209-212): a joined member can write
   enriched `addedPlaces` / `proposed` / `placeOverrides` fields; a stranger cannot.
   Run `npm run test:rules`.
2. **Backend live test** — `tests/live/`: call `researchUserPlace`; assert the output
   shape, the `pending_verification` fallback, and **no fabricated price/URL/phone**;
   adversarial assertion: a **non-existent place** yields blanked (not invented) fields.
3. **Acceptance (environment-honest)** — San Jose → OC → San Diego; add *Pho 79,
   Garden Grove, dinner, Jul 3*. Pass = research returns address + rating *(if
   grounded)* + dishes + **pending-verification photos** (real photos validated only
   with a live Maps key); auto-place; **persist after refresh**; **survive regenerate
   (both add AND replace paths)**; **other families vote and a vote_only entry's votes
   survive a day regenerate and still drive auto-promote**; bookings/cost per Phase 4.
   Verified at **375px and 1280px**.
4. **Gates per phase** — `npm run test:rules` → `bash scripts/ai/targeted_dry_run.sh
   travel` → `scripts/ai/full_system_dry_run.sh` (must end `FINAL: PASS`).
5. **Completion deliverables** — each phase ends with the CLAUDE.md **Required Review
   Format** (Verdict/Scope/Safety/Tests/Remaining Risks) + **Required Report Format**
   (Summary/Files changed/Commands+excerpts/Dry run result/Report path/Remaining
   risks/Next command).

---

## 15. i18n, mobile, versioning

- **i18n (RULE #2):** add every new key to the **module-level `T` object** (en ~L37,
  vi ~L314, es ~L581) in all three languages; access **only** via `t("key")` (~L888);
  follow the `addPlaceForm` pattern (`t("addKind_"+kind)`, `t("addNamePh")`,
  `t("addOwn")`). The per-category chip maps (~L7290-7316) are NOT for general UI
  strings; never write a literal to the DOM. **Keys needed:** 9 place-type labels,
  3-step form labels, action-selector options, "More details" expander, Proposed-lane
  heading, card-state labels (Researching / Pending verification / Retry research /
  added-by-you), duplicate warning, and every toast.
- **Mobile-first (RULE #1):** form + cards designed at 375px first; desktop parity at
  1280px; the expander + Proposed lane must not break the day view on either.
- **Versioning:** bump `travel-concierge.js?v=…` to the **next unused** string **after
  verifying via `git log --all -p` it was never deployed** (do not pre-name it). The
  **only** HTML consumer is `travel-concierge.html` (verified); the `/airport /tour
  /food /hair /nails` pages enter via `?entry=` and need no bump. Bump in the **same
  commit** that touches `travel-concierge.js`. Functions deploy separately.

---

## 16. Open risks

- **Gemini grounding variance** — single-place research can be thin; the
  `pending_verification` path is the graceful default, never a guess.
- **Background re-slot** could move a card the user is viewing — mitigate via toast +
  only re-slot when the user gave no explicit slot.
- **Name-drift on regenerate** for replaced places (mitigation in §7.2).
- **Vote-keying audit** (id→name on the itinerary path) must be done carefully so no
  existing AI-place voting regresses.
