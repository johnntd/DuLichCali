# Mobile Barber — Phase 2: Customer Mobile Barber Landing Page

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phase 1 PASS.

## Objective
Add a mobile-first customer landing page for in-home barber services.

## Route
Add route: `/mobile-barber`

## Page Must Include
- Hero section: "Mobile Barber — In-Home Haircuts"
- Service cards
- Barber/vendor profile cards
- Price/duration display
- Service area display
- CTAs:
  - "Book Now"
  - "Chat with AI Barber Assistant"
  - "Talk to AI Barber Assistant"
- Mobile-first layout
- Desktop responsive layout
- No duplicated global navigation

## Tasks
1. Reuse existing DuLichCali design language (CLAUDE.md: style.css + desktop.css pattern).
2. iOS/mobile-friendly feel.
3. Trust elements: in-home service, verified barber, transparent pricing, appointment confirmation.
4. Fallback empty state if no mobile barber vendors exist.

## Verification
- iPhone width (375px)
- Android width
- desktop width (1280px, 1600px)
- route refresh works
- existing home page still works
- other verticals (salon, food, hair, airport, tour) still work

## Multilingual
Must support vi/en/es from day one. Use translation lookup table — no hardcoded strings in any language. See CLAUDE.md RULE #2.

## STRICT RULES — apply (see master prompt)

## End-of-phase report (required)
