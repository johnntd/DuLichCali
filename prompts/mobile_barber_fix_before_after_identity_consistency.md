# Critical Fix — Mobile Barber Before/After Gallery Identity Consistency

## Problem

Current AI-generated before/after haircut gallery is wrong.

Examples:

```
before = black male
after  = white male

before = adult man
after  = child

before = man
after  = woman
```

These are invalid barber transformations.

Customers must see:

```
SAME PERSON
before haircut
↓
after haircut
```

Only haircut changes. Identity must stay fixed.

---

# Root Cause

Current image generation appears to create:

```
before image
AND
after image
```

independently.

This causes identity drift. Need identity-locked generation.

---

# Required Rule

Before / After generation MUST preserve:

- same person
- same age
- same gender
- same ethnicity
- same face
- same hairline
- same body type
- same clothes if possible
- same camera angle
- same lighting

Only change:

- hair style
- beard
- grooming

---

# Generation Method

Preferred:

```
generate BEFORE image first
↓
use image-to-image edit
↓
before image -> haircut edit -> after image
```

NOT two independent generations.

---

# Workflow

## Step 1 — Identity seed

```json
{
  "personId": "<unique>",
  "ageRange": "child | teen | young-adult | adult | senior",
  "gender": "male | female | nonbinary",
  "ethnicity": "...",
  "hairType": "...",
  "beard": true | false,
  "pose": "...",
  "lighting": "..."
}
```

Save the seed alongside the asset.

## Step 2 — Generate BEFORE image

Example prompt:

```
young Vietnamese male age 28
short overgrown hair
indoor home environment
mobile barber customer
neutral expression
realistic portrait
```

Save identity metadata alongside the file.

## Step 3 — Generate AFTER from BEFORE

Use the image-to-image edit endpoint with explicit identity-lock instructions:

```
same exact person
same face
same ethnicity
same age
same pose
same clothing
apply clean fade haircut
mobile barber result
```

Only the haircut changes.

---

# Identity Lock Fields

Persist per pair:

```json
{
  "identityId": "...",
  "gender": "...",
  "ageGroup": "...",
  "ethnicity": "...",
  "faceSeed": "...",
  "poseSeed": "...",
  "outfitSeed": "...",
  "lightingSeed": "...",
  "cameraSeed": "..."
}
```

Reuse for the after generation.

---

# Service Examples

**Fade**

- Before: same adult male, grown hair, needs fade
- After: same person, sharp fade

**Kids**

- Before: same child
- After: same child, clean haircut
- No age change.

**Business**

- Before: same professional adult male
- After: same person, business haircut

**Beard**

- Before: same beard
- After: same face, clean beard trim

**Family**

- Before: same father
- After: same father
- No identity swap.

---

# Validation

Reject pair if:

- gender changed
- age changed
- ethnicity changed
- face changed
- adult → kid
- man → woman
- black → white
- white → Asian
- etc.

Mark invalid. Regenerate.

---

# QA

Generate 10 samples. Review. If > 10% identity drift, regenerate.

---

# Existing Gallery Repair

Audit current gallery. Delete invalid pairs. Regenerate.

---

# Allowed files

- assets/mobile-barber/portfolio/*.jpg  (will be overwritten)
- mobile-barber/mobile-barber-data.js   (only if identity metadata is added to schema)
- tests/lib/mobile-barber-landing.js
- docs/mobile_barber_before_after_identity_fix.md

Do NOT touch:

- nailsalon/*, hairsalon/*, salon-admin.html
- functions/index.js
- firestore.rules
- script.js, style.css, desktop.css
- marketplace/*, foods/*, airport.html, tour.html
- notifications.js

---

# Required Report

`docs/mobile_barber_before_after_identity_fix.md`

Include:

1. Root cause
2. Generation pipeline (text→image for BEFORE, image→image edit for AFTER)
3. Identity-lock fields
4. Gallery repaired count
5. Invalid removed count
6. PASS / BLOCKED

---

# PASS Criteria

- Same person preserved across each before/after pair
- Only the haircut/beard/grooming changes
- Gallery looks realistic and family-friendly
- No celebrities, no logos, no text overlays
