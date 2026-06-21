# Travel Concierge V2 — Album · AI Clips · Embedded Live Map (Phase A)

**Date:** 2026-06-20 · **Surface:** `/travel-concierge` · **Target version:** hosting `v=20260620zt` + functions `generateTripClipPackage`
**Status:** Implemented · V2 smoke 107/107 · rules emulator 104/0 · i18n parity 939/939 (vi/en/es) · `full_system_dry_run.sh` → `FINAL: PASS` · **NOT yet deployed (under autonomy grant, after green)**

## Goal
Give a group trip a shared **Album** (share photos/videos by link, privacy-aware) and an **AI Clips** tab that turns the picked media into a ready-to-shoot **export package** (storyboard, captions, voiceover, overlays, hashtags, per-platform posts). Plus a true **embedded Google map** of live member locations. No video is rendered or posted here — rendering lives in the separate `ai_social_content_agent` repo.

## Hard constraints honored
- **No binary upload (Phase A):** media is added by **link only** (`storageProvider: 'external_link'`). Firebase Storage binary upload is deferred to Phase B (needs `storage.rules` review).
- **Privacy / consent:** album is **members-only**; `private` items are visible only to the author + trip owner; `selected_only` is for clip use. The Clips tab requires an explicit **consent checkbox** before it will build a package, and private items are never used unless the user picked them.
- **No auto-post / no render:** the clip output is an **export package** the user assembles in their own editor. The server returns `note: 'export_package_only_no_render_no_post'` and the UI states no video is rendered or posted.
- **Anti-fabrication:** the server only references media the user actually selected (a storyboard scene whose `media` isn't in the provided set is blanked), and the prompt forbids inventing view counts, prices, dates, @handles, or track names.
- **Multilingual vi/en/es** (50 new keys × 3, parity 939/939); **mobile-first** CSS with `@media 768/1200`.

## Data model — `groupTrips/{tripId}/media/{mediaId}` (new subcollection)
`{ uploadedBy, familyId, mediaType: photo|video|link, url, caption, place, day, visibility: group|private|selected_only, favorite, selected, tags[], storageProvider: 'external_link', createdAt }`

### Firestore rules (new `media` block)
- **read:** owner, or the author, or a trip member when `visibility != 'private'`.
- **create:** owner/member, `uploadedBy == auth.uid`, `mediaType ∈ {photo,video,link}`, `visibility ∈ {group,private,selected_only}`.
- **update:** owner or author, `uploadedBy` immutable, valid `visibility`.
- **delete:** owner or author (owner moderation).
- 18 new rules tests (members-only read, private hidden from other members, author/owner moderation, invalid mediaType/visibility denied) → **104 passed, 0 failed**.

## Components

### Album tab (`renderAlbum` / `addMediaPanel` / `albumCard`)
- Add-media panel (collapsible): URL + caption + place + day + visibility. Image URLs render inline (`isImageUrl`); other links show a 🔗/🎞 placeholder.
- Per-card actions (author/owner only): ❤️ favorite, ✓ "Use in clip" (toggles `selected`), visibility re-select, delete. Cards sort favorites first.
- `visibleMedia()` mirrors the rules exactly so the client never shows a private item the server would reject.
- Gates: demo trip → "create a real trip" note; logged-out → login-needed.

### AI Clips tab (`renderClips` / `clipExportPanel`) + server `generateTripClipPackage`
- Picks platform (TikTok/Instagram/YouTube/Facebook), mood (fun/cinematic/heartfelt/energetic), length (short/medium/long).
- Consent checkbox + ≥1 selected item required → otherwise the build button is disabled.
- Client wrapper sends **only** `{caption, place, day, mediaType, tags}` per item (≤30) — no URLs/uploader/visibility leak to the model.
- Server (`serverCallClaude` haiku, `CLAUDE_API_KEY`): returns `{ summary, storyboard[{scene,media,text}], voiceoverScript, textOverlays[], hashtags[], posts{tiktok,instagram,youtube,facebook} }`. Every `storyboard.media` must match a provided caption/place or it's blanked. Empty media set → `NO_MEDIA`.

### Embedded live map (`mountLiveMap`)
- Renders a real Google map of located members into the Live (Group-tab) panel via the working client-key `importLibrary` path; one marker per located member + `fitBounds`. No-op (nav links remain) when Maps is unavailable or no member has shared coordinates.

## Tabs
`Itinerary · Transport · Stay · Food · Events · Discoveries · Costs · Bookings · Album · Clips · Group` (album/clips added to `TAB_PAIRS` + the render switch; stale-tab heal unchanged).

## Tests
`/tmp/tc_v2_album_clips.js` (107): i18n V2 keys × vi/en/es + non-copy check; tab wiring; `visibleMedia` privacy matrix (member vs author vs owner); `isImageUrl`; `addMedia` persists `uploadedBy`/`visibility`/`external_link`/`createdAt`; `updateMedia` merge + `deleteMedia`; `generateClipPackage` payload hygiene (≤30, no leaked fields, platform/mood/length/lang forwarded, returns server data); `clipExportPanel` export-only note + sections; consent/selection gating; album demo/login gates; `mountLiveMap` no-op + embedded map+markers; server anti-fabrication guards. Rules: 104/0. Full dry run: `FINAL: PASS`.

## Preserved / not broken
Consensus engine, optimizer, transport/Hoàng, Stay/Food/Events/Stopovers/Route-Ops/Tours, DLC inquiries, cost engine, live-location sharing — all untouched call paths.

## Deferred to V2 Phase B
- Firebase **Storage** binary photo/video upload (needs `storage.rules` review) — current model is external link.
- The social-media render/publish step itself lives in the separate `ai_social_content_agent` repo; this tab only produces the export package + memory-video assets list it consumes.
