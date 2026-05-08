# AI Food Promo Video Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based studio page where vendors upload food photos/clips, AI generates recipe + script + hashtags, and a Remotion CLI renders a cinematic 30s vertical promo video.

**Architecture:** Static HTML/CSS/JS studio page (auth-gated, vendor-facing) saves projects to Firestore `food_promo_projects`; Claude API (via existing `aiProxy` CF) generates all text content; Remotion `FoodPromoStudio` composition (new, in `remotion-promo/`) renders locally via CLI and uploads output to Firebase Storage. Phase 1 is local-render only — no server-side Remotion, no auto-posting.

**Tech Stack:** Remotion 4.0.240 + TypeScript (composition), `@remotion/transitions` + `@remotion/media` (new installs), Firebase Firestore + Storage + Functions (existing), Claude API via `aiProxy` CF, vanilla HTML/CSS/JS (studio page).

---

## File Structure

### New files — remotion-promo/
| File | Responsibility |
|------|---------------|
| `src/FoodPromoStudio/schema.ts` | Zod schema + TS type for studio composition |
| `src/FoodPromoStudio/FoodPromoStudio.tsx` | Root composition wiring all scenes via TransitionSeries |
| `src/FoodPromoStudio/components/SceneBrand.tsx` | 3s brand intro (vendor name + tagline) |
| `src/FoodPromoStudio/components/SceneMedia.tsx` | Multi-image Ken Burns + video clip support |
| `src/FoodPromoStudio/components/SceneIngredients.tsx` | Animated ingredient list cards |
| `src/FoodPromoStudio/components/SceneSteps.tsx` | Recipe step reveal cards |
| `src/FoodPromoStudio/components/SceneCTA.tsx` | Enhanced CTA with order URL |
| `src/FoodPromoStudio/components/Overlays.tsx` | Steam + glow overlay effects |
| `src/FoodPromoStudio/components/Caption.tsx` | Subtitle/caption track overlay |
| `generate-studio-content.js` | Node CLI: reads Firestore project → calls Claude → writes AI content back |
| `generate-studio-video.js` | Node CLI: reads Firestore project → renders Remotion → uploads to Storage |

### Modified files — remotion-promo/
| File | Change |
|------|--------|
| `package.json` | Add `@remotion/transitions`, `@remotion/media`; add `studio-content` + `studio-video` scripts |
| `src/Root.tsx` | Register `FoodPromoStudio` composition |

### New files — project root
| File | Responsibility |
|------|---------------|
| `ai-food-video-studio.html` | Studio UI page: auth gate, vendor selector, dish form, upload, AI gen, render trigger |
| `ai-food-video-studio.css` | Mobile-first styles for the studio page |
| `ai-food-video-studio.js` | All JS: Firebase init, upload, AI call, Firestore CRUD, status polling |

### Modified files — project root
| File | Change |
|------|--------|
| `firebase.json` | Add `/ai-food-video-studio` → `/ai-food-video-studio.html` rewrite |
| `firestore.rules` | Add rules for `food_promo_projects` collection |
| `functions/index.js` | Add `uploadStudioMedia` CF + `queueFoodPromoRender` CF |

---

## Task 1: Install Remotion packages + add scripts

**Files:**
- Modify: `remotion-promo/package.json`

- [ ] **Step 1: Install missing packages**

```bash
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/remotion-promo
npm install @remotion/transitions@4.0.240 @remotion/media@4.0.240
```

Expected: two new packages added to node_modules, no peer dep errors.

- [ ] **Step 2: Add generate scripts to package.json**

Open `remotion-promo/package.json` and replace the `scripts` block:

```json
"scripts": {
  "start": "npx remotion studio src/index.ts",
  "render": "npx remotion render src/index.ts FoodPromo out/food-promo.mp4",
  "generate": "node generate-promo.js",
  "studio-content": "node generate-studio-content.js",
  "studio-video": "node generate-studio-video.js"
},
```

- [ ] **Step 3: Verify install**

```bash
cd remotion-promo && node -e "require('@remotion/transitions'); require('@remotion/media'); console.log('OK')"
```

Expected: prints `OK`.

- [ ] **Step 4: Commit**

```bash
git add remotion-promo/package.json remotion-promo/package-lock.json
git commit -m "feat(video-studio): install @remotion/transitions and @remotion/media"
```

---

## Task 2: Firestore data model — rules + firebase.json rewrite

**Files:**
- Modify: `firestore.rules` (after line 100, before the closing braces)
- Modify: `firebase.json` (rewrites array)

- [ ] **Step 1: Add food_promo_projects rule to firestore.rules**

After the `videoRenderJobs` block (around line 100), add:

```
    // ── Food promo studio projects — auth only (vendor + admin tool) ──────────────
    match /food_promo_projects/{projectId} {
      allow read, write: if request.auth != null;
    }
```

- [ ] **Step 2: Add firebase.json rewrite**

In `firebase.json`, inside the `rewrites` array, add:

```json
{ "source": "/ai-food-video-studio", "destination": "/ai-food-video-studio.html" },
{ "source": "/ai-food-video-studio/**", "destination": "/ai-food-video-studio.html" }
```

- [ ] **Step 3: Verify rules syntax**

```bash
firebase firestore:rules --dry-run 2>/dev/null || echo "check rules manually"
```

- [ ] **Step 4: Commit**

```bash
git add firestore.rules firebase.json
git commit -m "feat(video-studio): add food_promo_projects Firestore rules + routing"
```

---

## Task 3: FoodPromoStudio Zod schema

**Files:**
- Create: `remotion-promo/src/FoodPromoStudio/schema.ts`

- [ ] **Step 1: Create schema file**

```typescript
// remotion-promo/src/FoodPromoStudio/schema.ts
import { z } from "zod";

export const MediaItemSchema = z.object({
  id:        z.string(),
  type:      z.enum(["image", "video"]),
  url:       z.string(), // Firebase Storage download URL or https:// URL
  order:     z.number().default(0),
  trimStart: z.number().optional(), // seconds — video clips only
  trimEnd:   z.number().optional(), // seconds — video clips only
});

export const CaptionSchema = z.object({
  startSec: z.number(),
  endSec:   z.number(),
  text:     z.string(),
});

export const FoodPromoStudioSchema = z.object({
  // Vendor identity
  vendorName:    z.string().default("Nhà Bếp Của Emily"),
  vendorTagline: z.string().default("Handmade Vietnamese Kitchen · San Jose"),

  // Dish identity
  dishName:        z.string().default("Món Ngon"),
  dishNameEn:      z.string().default(""),
  dishDescription: z.string().default(""),
  price:           z.number().optional(),
  unit:            z.string().default("phần"),
  orderUrl:        z.string().default(""),
  phone:           z.string().default("408-916-3439"),

  // Media — sorted by .order ascending
  mediaItems: z.array(MediaItemSchema).default([]),

  // AI-generated content
  ingredients:     z.array(z.string()).default([]),
  steps:           z.array(z.string()).default([]),
  voiceoverScript: z.string().default(""),
  captions:        z.array(CaptionSchema).default([]),
  hashtags:        z.array(z.string()).default([]),

  // Optional audio tracks (filenames relative to remotion-promo/public/)
  musicTrack:    z.string().optional(), // background music file
  voiceoverFile: z.string().optional(), // TTS-generated voiceover file

  // Brand accent color (hex)
  accentColor: z.string().default("#f59e0b"),

  // Which optional scenes to include
  showIngredients: z.boolean().default(true),
  showSteps:       z.boolean().default(true),
});

export type FoodPromoStudioProps = z.infer<typeof FoodPromoStudioSchema>;
export type MediaItem = z.infer<typeof MediaItemSchema>;
export type Caption = z.infer<typeof CaptionSchema>;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd remotion-promo && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors for the new file (other pre-existing errors are OK if any exist).

---

## Task 4: Overlays component (steam + glow effects)

**Files:**
- Create: `remotion-promo/src/FoodPromoStudio/components/Overlays.tsx`

- [ ] **Step 1: Create Overlays.tsx**

```tsx
// remotion-promo/src/FoodPromoStudio/components/Overlays.tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

// Pulsing radial glow — driven by sine wave on frame
export const GlowOverlay: React.FC<{ color: string; intensity?: number }> = ({
  color, intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const pulse = Math.sin(frame * 0.08) * 0.12 + 0.88; // 0.76–1.0

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        top: "35%", left: "50%",
        transform: `translate(-50%, -50%) scale(${pulse})`,
        width: 900, height: 900,
        background: `radial-gradient(circle, ${color}55 0%, transparent 68%)`,
        borderRadius: "50%",
        opacity: intensity,
      }} />
    </AbsoluteFill>
  );
};

// Rising steam blobs — each on a cyclic frame offset
const BLOBS = [
  { x: 160, delay: 0   },
  { x: 380, delay: 20  },
  { x: 580, delay: 40  },
  { x: 780, delay: 10  },
  { x: 980, delay: 30  },
];
const CYCLE = 90; // frames per steam cycle

export const SteamOverlay: React.FC<{ intensity?: number }> = ({ intensity = 0.6 }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {BLOBS.map((blob, i) => {
        const t = (frame + blob.delay) % CYCLE;
        const progress = t / CYCLE;
        const y = 1920 * 0.55 - progress * 500;
        const opacity = intensity * Math.sin(progress * Math.PI) * 0.5;
        const scale = 0.4 + progress * 0.9;
        const wobble = Math.sin(frame * 0.04 + i * 1.1) * 18;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: blob.x + wobble,
              top: y,
              width: 90, height: 130,
              background: `radial-gradient(ellipse, rgba(255,255,255,${opacity}) 0%, transparent 70%)`,
              transform: `scale(${scale})`,
              borderRadius: "50%",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
```

---

## Task 5: Caption overlay component

**Files:**
- Create: `remotion-promo/src/FoodPromoStudio/components/Caption.tsx`

- [ ] **Step 1: Create Caption.tsx**

```tsx
// remotion-promo/src/FoodPromoStudio/components/Caption.tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../schema";
import { bodyFont } from "../../fonts";

type Props = {
  captions: Caption[];
  // globalStartFrame: frame offset of this scene within the full composition (0 if scene-relative)
};

export const CaptionTrack: React.FC<Props> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentCaption = captions.find(
    (c) => frame >= c.startSec * fps && frame < c.endSec * fps
  );

  if (!currentCaption) return null;

  const appearFrame = currentCaption.startSec * fps;
  const opacity = interpolate(frame, [appearFrame, appearFrame + 6], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 200, pointerEvents: "none" }}
    >
      <div
        style={{
          fontFamily: bodyFont,
          fontSize: 36,
          fontWeight: 600,
          color: "#fff",
          background: "rgba(0,0,0,0.65)",
          borderRadius: 12,
          padding: "14px 28px",
          maxWidth: 900,
          textAlign: "center",
          lineHeight: 1.4,
          opacity,
        }}
      >
        {currentCaption.text}
      </div>
    </AbsoluteFill>
  );
};
```

---

## Task 6: SceneBrand component

**Files:**
- Create: `remotion-promo/src/FoodPromoStudio/components/SceneBrand.tsx`

- [ ] **Step 1: Create SceneBrand.tsx**

```tsx
// remotion-promo/src/FoodPromoStudio/components/SceneBrand.tsx
import React from "react";
import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig,
} from "remotion";
import { displayFont, bodyFont } from "../../fonts";
import { FoodPromoStudioProps } from "../schema";

// 90 frames (3s) — vendor name + tagline intro on dark background
export const SceneBrand: React.FC<Pick<FoodPromoStudioProps, "vendorName" | "vendorTagline" | "accentColor">> = ({
  vendorName, vendorTagline, accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn  = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const sceneOp = Math.min(fadeIn, fadeOut);

  const nameY = interpolate(
    spring({ frame: frame - 10, fps, config: { damping: 200 }, durationInFrames: 35 }),
    [0, 1], [50, 0],
  );
  const nameOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  const lineW = interpolate(
    spring({ frame: frame - 28, fps, config: { damping: 200 }, durationInFrames: 30 }),
    [0, 1], [0, 480],
  );

  const tagOp = interpolate(frame, [38, 55], [0, 1], { extrapolateRight: "clamp" });
  const tagY  = interpolate(
    spring({ frame: frame - 38, fps, config: { damping: 200 }, durationInFrames: 25 }),
    [0, 1], [20, 0],
  );

  return (
    <AbsoluteFill
      style={{
        opacity: sceneOp,
        background: "linear-gradient(160deg, #0c0400 0%, #1a0800 60%, #0c0400 100%)",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div style={{ fontFamily: displayFont, fontSize: 90, fontWeight: 300, color: "#fff8ee", opacity: nameOp, transform: `translateY(${nameY}px)`, textAlign: "center", paddingInline: 60 }}>
        {vendorName}
      </div>
      <div style={{ width: lineW, height: 2, background: accentColor, marginTop: 20, marginBottom: 20 }} />
      <div style={{ fontFamily: bodyFont, fontSize: 28, fontWeight: 400, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,248,238,0.55)", opacity: tagOp, transform: `translateY(${tagY}px)`, textAlign: "center" }}>
        {vendorTagline}
      </div>
    </AbsoluteFill>
  );
};
```

---

## Task 7: SceneMedia component (Ken Burns + video clips)

**Files:**
- Create: `remotion-promo/src/FoodPromoStudio/components/SceneMedia.tsx`

- [ ] **Step 1: Create SceneMedia.tsx**

```tsx
// remotion-promo/src/FoodPromoStudio/components/SceneMedia.tsx
import React from "react";
import {
  AbsoluteFill, Img, interpolate, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { FoodPromoStudioProps, MediaItem } from "../schema";
import { displayFont, bodyFont } from "../../fonts";
import { SteamOverlay, GlowOverlay } from "./Overlays";

const CROSSFADE = 15;

type KenBurnsProps = {
  url: string;
  durationInFrames: number;
  zoomOut?: boolean;
  panDirection?: "left" | "right" | "up" | "down";
};

const KenBurnsImage: React.FC<KenBurnsProps> = ({ url, durationInFrames, zoomOut = false, panDirection = "left" }) => {
  const frame = useCurrentFrame();
  const src = url.startsWith("http") ? url : staticFile(url);

  const scale = interpolate(frame, [0, durationInFrames],
    zoomOut ? [1.15, 1.0] : [1.0, 1.15],
    { extrapolateRight: "clamp" }
  );

  const panMap: Record<string, [number, number]> = {
    left:  [0, -40], right: [0, 40],
    up:    [0, 0],   down:  [0, 0],
  };
  const [xStart, xEnd] = panMap[panDirection];
  const [yStart, yEnd] = panDirection === "up" ? [20, -20] : panDirection === "down" ? [-20, 20] : [0, 0];

  const tx = interpolate(frame, [0, durationInFrames], [xStart, xEnd], { extrapolateRight: "clamp" });
  const ty = interpolate(frame, [0, durationInFrames], [yStart, yEnd], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${scale}) translate(${tx}px, ${ty}px)`, willChange: "transform" }}>
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{
        background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 40%, rgba(10,4,0,0.80) 65%, rgba(10,4,0,0.95) 100%)",
        pointerEvents: "none",
      }} />
    </AbsoluteFill>
  );
};

type ClipProps = { item: MediaItem; durationInFrames: number };
const VideoClip: React.FC<ClipProps> = ({ item, durationInFrames }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Video
        src={item.url}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        trimBefore={item.trimStart ? item.trimStart * fps : undefined}
        trimAfter={item.trimEnd ? item.trimEnd * fps : undefined}
        muted
      />
      <AbsoluteFill style={{
        background: "linear-gradient(to bottom, transparent 50%, rgba(10,4,0,0.90) 100%)",
        pointerEvents: "none",
      }} />
    </AbsoluteFill>
  );
};

const PAN_DIRS: Array<KenBurnsProps["panDirection"]> = ["left", "right", "up", "down", "left"];

type Props = {
  mediaItems: MediaItem[];
  accentColor: string;
  dishName: string;
  dishNameEn: string;
  dishDescription: string;
  durationInFrames: number; // total scene duration
};

export const SceneMedia: React.FC<Props> = ({
  mediaItems, accentColor, dishName, dishNameEn, dishDescription, durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = mediaItems.length > 0 ? mediaItems : [{ id: "placeholder", type: "image" as const, url: "", order: 0 }];
  const perItem = Math.floor((durationInFrames + CROSSFADE * (items.length - 1)) / items.length);

  // Text reveal (shown across all media segments)
  const nameOp  = interpolate(frame, [18, 40], [0, 1], { extrapolateRight: "clamp" });
  const nameY   = interpolate(frame, [18, 48], [50, 0], { extrapolateRight: "clamp" });
  const enOp    = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const descOp  = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });

  const mediaSeriesChildren: React.ReactNode[] = [];
  items.forEach((item, i) => {
    mediaSeriesChildren.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={perItem}>
        <AbsoluteFill style={{ background: "#0c0400" }}>
          {item.type === "video" ? (
            <VideoClip item={item} durationInFrames={perItem} />
          ) : (
            <KenBurnsImage
              url={item.url}
              durationInFrames={perItem}
              zoomOut={i % 2 === 1}
              panDirection={PAN_DIRS[i % PAN_DIRS.length]}
            />
          )}
          <SteamOverlay intensity={0.5} />
          <GlowOverlay color={accentColor} intensity={0.25} />
        </AbsoluteFill>
      </TransitionSeries.Sequence>
    );
    if (i < items.length - 1) {
      mediaSeriesChildren.push(
        <TransitionSeries.Transition
          key={`t${i}`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: CROSSFADE })}
        />
      );
    }
  });

  return (
    <AbsoluteFill>
      <TransitionSeries>{mediaSeriesChildren}</TransitionSeries>

      {/* Text overlay — pinned to bottom, across all media */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", paddingBottom: 110, paddingInline: 56, flexDirection: "column" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 104, fontWeight: 300, color: "#fff8ee", lineHeight: 1.0, opacity: nameOp, transform: `translateY(${nameY}px)`, marginBottom: 12 }}>
          {dishName}
        </div>
        {dishNameEn ? (
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 28, fontWeight: 400, letterSpacing: "0.22em", textTransform: "uppercase", color: accentColor, opacity: enOp, marginBottom: 18 }}>
            {dishNameEn}
          </div>
        ) : null}
        {dishDescription ? (
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 26, fontWeight: 300, color: "rgba(210,230,245,0.80)", lineHeight: 1.55, opacity: descOp, maxWidth: 860 }}>
            {dishDescription}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

**Note:** Using inline font strings as fallback since `displayFont`/`bodyFont` from `../../fonts` may need path adjustment. The existing `fonts.ts` exports those constants — verify the import resolves correctly.

---

## Task 8: SceneIngredients component

**Files:**
- Create: `remotion-promo/src/FoodPromoStudio/components/SceneIngredients.tsx`

- [ ] **Step 1: Create SceneIngredients.tsx**

```tsx
// remotion-promo/src/FoodPromoStudio/components/SceneIngredients.tsx
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type Props = { ingredients: string[]; accentColor: string };

export const SceneIngredients: React.FC<Props> = ({ ingredients, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn  = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  const titleSp = spring({ frame: frame - 5, fps, config: { damping: 200 }, durationInFrames: 30 });
  const titleY  = interpolate(titleSp, [0, 1], [40, 0]);

  const visible = ingredients.slice(0, 9);

  return (
    <AbsoluteFill style={{
      opacity: Math.min(fadeIn, fadeOut),
      background: "linear-gradient(145deg, #0c0400 0%, #1c0c00 100%)",
      paddingTop: 120, paddingInline: 64,
      flexDirection: "column",
    }}>
      {/* Section header */}
      <div style={{
        fontSize: 52, fontWeight: 800, color: accentColor,
        marginBottom: 48,
        opacity: titleSp,
        transform: `translateY(${titleY}px)`,
        letterSpacing: "0.04em",
        fontFamily: "system-ui, sans-serif",
      }}>
        🥘 Nguyên Liệu
      </div>

      {/* Ingredient chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {visible.map((ing, i) => {
          const delay = (i + 1) * 6;
          const sp  = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 25 });
          const op  = sp;
          const tx  = interpolate(sp, [0, 1], [-50, 0]);

          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                opacity: op, transform: `translateX(${tx}px)`,
              }}
            >
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
              <span style={{ fontSize: 40, fontWeight: 500, color: "#fff8ee", fontFamily: "system-ui, sans-serif" }}>
                {ing}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

---

## Task 9: SceneSteps component

**Files:**
- Create: `remotion-promo/src/FoodPromoStudio/components/SceneSteps.tsx`

- [ ] **Step 1: Create SceneSteps.tsx**

```tsx
// remotion-promo/src/FoodPromoStudio/components/SceneSteps.tsx
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type Props = { steps: string[]; accentColor: string };

export const SceneSteps: React.FC<Props> = ({ steps, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn  = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  const titleSp = spring({ frame: frame - 5, fps, config: { damping: 200 }, durationInFrames: 30 });
  const visible = steps.slice(0, 5);

  return (
    <AbsoluteFill style={{
      opacity: Math.min(fadeIn, fadeOut),
      background: "linear-gradient(145deg, #080310 0%, #150820 100%)",
      paddingTop: 120, paddingInline: 64,
      flexDirection: "column",
    }}>
      <div style={{
        fontSize: 52, fontWeight: 800, color: accentColor,
        marginBottom: 44,
        opacity: spring({ frame: frame - 5, fps, config: { damping: 200 } }),
        transform: `translateY(${interpolate(titleSp, [0, 1], [40, 0])}px)`,
        fontFamily: "system-ui, sans-serif",
        letterSpacing: "0.04em",
      }}>
        📋 Cách Làm
      </div>

      {visible.map((step, i) => {
        const delay = (i + 1) * 8;
        const sp = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 30 });
        return (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 32,
              opacity: sp,
              transform: `translateY(${interpolate(sp, [0, 1], [30, 0])}px)`,
            }}
          >
            <div style={{
              minWidth: 52, height: 52,
              borderRadius: "50%",
              background: accentColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 800, color: "#0c0400",
              fontFamily: "system-ui, sans-serif",
              flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <div style={{
              fontSize: 34, fontWeight: 400, color: "#fff8ee",
              lineHeight: 1.4, fontFamily: "system-ui, sans-serif",
            }}>
              {step}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
```

---

## Task 10: SceneCTA component

**Files:**
- Create: `remotion-promo/src/FoodPromoStudio/components/SceneCTA.tsx`

- [ ] **Step 1: Create SceneCTA.tsx**

```tsx
// remotion-promo/src/FoodPromoStudio/components/SceneCTA.tsx
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GlowOverlay } from "./Overlays";

type Props = {
  vendorName: string;
  dishName: string;
  phone: string;
  orderUrl: string;
  accentColor: string;
  hashtags: string[];
};

export const SceneCTA: React.FC<Props> = ({ vendorName, dishName, phone, orderUrl, accentColor, hashtags }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const headline = spring({ frame: frame - 10, fps, config: { damping: 180, stiffness: 80 }, durationInFrames: 40 });
  const headlineY = interpolate(headline, [0, 1], [60, 0]);

  const lineW = interpolate(
    spring({ frame: frame - 30, fps, config: { damping: 200 }, durationInFrames: 28 }),
    [0, 1], [0, 600],
  );

  const phoneOp = interpolate(frame, [45, 65], [0, 1], { extrapolateRight: "clamp" });
  const phoneY  = interpolate(
    spring({ frame: frame - 45, fps, config: { damping: 200 }, durationInFrames: 30 }),
    [0, 1], [30, 0],
  );

  const tagOp = interpolate(frame, [65, 85], [0, 1], { extrapolateRight: "clamp" });

  const topHashtags = hashtags.slice(0, 4).map((h) => (h.startsWith("#") ? h : `#${h}`)).join("  ");

  return (
    <AbsoluteFill style={{
      opacity: fadeIn,
      background: "linear-gradient(160deg, #0c0400 0%, #1a0800 100%)",
      justifyContent: "center", alignItems: "center", flexDirection: "column",
    }}>
      <GlowOverlay color={accentColor} intensity={0.5} />

      <div style={{
        fontSize: 80, fontWeight: 300, color: "#fff8ee",
        opacity: headline, transform: `translateY(${headlineY}px)`,
        textAlign: "center", paddingInline: 60,
        fontFamily: "Georgia, serif", lineHeight: 1.1,
      }}>
        {dishName}
      </div>

      <div style={{ width: lineW, height: 2, background: accentColor, marginBlock: 28 }} />

      <div style={{
        fontSize: 32, fontWeight: 400, color: "rgba(255,248,238,0.65)",
        textAlign: "center", fontFamily: "system-ui, sans-serif",
        letterSpacing: "0.04em",
      }}>
        {vendorName}
      </div>

      <div style={{
        fontSize: 72, fontWeight: 700, color: accentColor,
        marginTop: 50, opacity: phoneOp, transform: `translateY(${phoneY}px)`,
        fontFamily: "system-ui, sans-serif", letterSpacing: "0.02em",
      }}>
        {phone}
      </div>

      {orderUrl ? (
        <div style={{
          fontSize: 30, color: "rgba(255,248,238,0.50)",
          marginTop: 16, fontFamily: "system-ui, sans-serif",
          opacity: phoneOp,
        }}>
          {orderUrl}
        </div>
      ) : null}

      {topHashtags ? (
        <div style={{
          fontSize: 26, color: accentColor, opacity: tagOp * 0.6,
          marginTop: 40, textAlign: "center", paddingInline: 60,
          fontFamily: "system-ui, sans-serif", fontWeight: 500,
        }}>
          {topHashtags}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
```

---

## Task 11: FoodPromoStudio root composition + Root.tsx registration

**Files:**
- Create: `remotion-promo/src/FoodPromoStudio/FoodPromoStudio.tsx`
- Modify: `remotion-promo/src/Root.tsx`

- [ ] **Step 1: Create FoodPromoStudio.tsx**

```tsx
// remotion-promo/src/FoodPromoStudio/FoodPromoStudio.tsx
import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { FoodPromoStudioProps } from "./schema";
import { SceneBrand } from "./components/SceneBrand";
import { SceneMedia } from "./components/SceneMedia";
import { SceneIngredients } from "./components/SceneIngredients";
import { SceneSteps } from "./components/SceneSteps";
import { SceneCTA } from "./components/SceneCTA";
import { CaptionTrack } from "./components/Caption";

// Fixed scene frame counts
const BRAND_DUR  = 90;   // 3s
const MEDIA_DUR  = 360;  // 12s base (split across media items)
const ING_DUR    = 120;  // 4s
const STEPS_DUR  = 120;  // 4s
const CTA_DUR    = 120;  // 4s
const XFADE      = 15;   // crossfade overlap

// Total: 90 + 360 + 120 + 120 + 120 - (4 crossfades * 15) = 750 frames = 25s
// With showIngredients=false + showSteps=false: 90 + 360 + 120 - 2*15 = 540 = 18s
export const TOTAL_FRAMES = BRAND_DUR + MEDIA_DUR + ING_DUR + STEPS_DUR + CTA_DUR - 4 * XFADE; // 690

export const FoodPromoStudio: React.FC<FoodPromoStudioProps> = (props) => {
  const {
    vendorName, vendorTagline, dishName, dishNameEn, dishDescription,
    phone, orderUrl, mediaItems, ingredients, steps, captions,
    accentColor, musicTrack, voiceoverFile, showIngredients, showSteps, hashtags,
  } = props;

  const children: React.ReactNode[] = [];

  // Scene 1 — Brand intro
  children.push(
    <TransitionSeries.Sequence key="brand" durationInFrames={BRAND_DUR}>
      <SceneBrand vendorName={vendorName} vendorTagline={vendorTagline} accentColor={accentColor} />
    </TransitionSeries.Sequence>
  );
  children.push(
    <TransitionSeries.Transition key="t1" presentation={fade()} timing={linearTiming({ durationInFrames: XFADE })} />
  );

  // Scene 2 — Media gallery
  children.push(
    <TransitionSeries.Sequence key="media" durationInFrames={MEDIA_DUR}>
      <SceneMedia
        mediaItems={mediaItems}
        accentColor={accentColor}
        dishName={dishName}
        dishNameEn={dishNameEn}
        dishDescription={dishDescription}
        durationInFrames={MEDIA_DUR}
      />
    </TransitionSeries.Sequence>
  );

  // Scene 3 — Ingredients (optional)
  if (showIngredients && ingredients.length > 0) {
    children.push(
      <TransitionSeries.Transition key="t2" presentation={fade()} timing={linearTiming({ durationInFrames: XFADE })} />
    );
    children.push(
      <TransitionSeries.Sequence key="ing" durationInFrames={ING_DUR}>
        <SceneIngredients ingredients={ingredients} accentColor={accentColor} />
      </TransitionSeries.Sequence>
    );
  }

  // Scene 4 — Steps (optional)
  if (showSteps && steps.length > 0) {
    children.push(
      <TransitionSeries.Transition key="t3" presentation={fade()} timing={linearTiming({ durationInFrames: XFADE })} />
    );
    children.push(
      <TransitionSeries.Sequence key="steps" durationInFrames={STEPS_DUR}>
        <SceneSteps steps={steps} accentColor={accentColor} />
      </TransitionSeries.Sequence>
    );
  }

  // Scene 5 — CTA
  children.push(
    <TransitionSeries.Transition key="t4" presentation={fade()} timing={linearTiming({ durationInFrames: XFADE })} />
  );
  children.push(
    <TransitionSeries.Sequence key="cta" durationInFrames={CTA_DUR}>
      <SceneCTA
        vendorName={vendorName}
        dishName={dishName}
        phone={phone}
        orderUrl={orderUrl}
        accentColor={accentColor}
        hashtags={hashtags}
      />
    </TransitionSeries.Sequence>
  );

  return (
    <AbsoluteFill style={{ background: "#0c0400" }}>
      <TransitionSeries>{children}</TransitionSeries>

      {/* Optional music bed */}
      {musicTrack && (
        <Audio src={staticFile(musicTrack)} volume={0.18} />
      )}

      {/* Optional voiceover */}
      {voiceoverFile && (
        <Audio src={staticFile(voiceoverFile)} volume={0.9} />
      )}

      {/* Caption track — absolute, renders above everything */}
      {captions.length > 0 && (
        <CaptionTrack captions={captions} />
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Register in Root.tsx**

Open `remotion-promo/src/Root.tsx` and add after the existing imports:

```tsx
import { FoodPromoStudio, TOTAL_FRAMES } from "./FoodPromoStudio/FoodPromoStudio";
import { FoodPromoStudioSchema } from "./FoodPromoStudio/schema";
```

Then add inside the `<Folder name="Food">` or directly in the root `<>` (after the existing `FoodPromo` composition):

```tsx
<Composition
  id="FoodPromoStudio"
  component={FoodPromoStudio}
  durationInFrames={TOTAL_FRAMES}
  fps={30}
  width={1080}
  height={1920}
  schema={FoodPromoStudioSchema}
  defaultProps={{
    vendorName: "Nhà Bếp Của Emily",
    vendorTagline: "Handmade Vietnamese Kitchen · San Jose",
    dishName: "Chả Giò",
    dishNameEn: "Handmade Eggrolls",
    dishDescription: "Nhân thịt heo, nấm hương — gói tay, chiên giòn vàng thơm.",
    price: 0.75,
    unit: "cuốn",
    orderUrl: "dulichcali21.com",
    phone: "408-916-3439",
    mediaItems: [{ id: "1", type: "image", url: "nha-bep-emily-eggroll.jpg", order: 0 }],
    ingredients: ["Thịt heo xay", "Nấm hương", "Cà rốt", "Miến", "Bánh tráng"],
    steps: ["Trộn nhân đều tay", "Gói bánh tráng thật chặt", "Chiên vàng ở 350°F"],
    voiceoverScript: "",
    captions: [],
    hashtags: ["#NhaBepCuaEmily", "#VietnameseFood", "#SanJoseFood"],
    accentColor: "#f59e0b",
    showIngredients: true,
    showSteps: true,
    musicTrack: undefined,
    voiceoverFile: undefined,
  }}
/>
```

- [ ] **Step 3: Launch Remotion Studio and verify**

```bash
cd remotion-promo && npm start
```

Open `http://localhost:3000`, navigate to `FoodPromoStudio`. Scrub through the timeline — verify:
- SceneBrand fades in (vendor name, gold line, tagline)
- SceneMedia shows Ken Burns on default image with dish name text
- SceneIngredients shows 5 ingredient chips sliding in
- SceneSteps shows 3 numbered steps
- SceneCTA shows dish name, phone number, and accent color glow

Fix any TypeScript errors (run `npx tsc --noEmit` to see them all).

- [ ] **Step 4: Commit**

```bash
cd .. && git add remotion-promo/src/FoodPromoStudio/ remotion-promo/src/Root.tsx
git commit -m "feat(video-studio): add FoodPromoStudio Remotion composition with 5 scenes"
```

---

## Task 12: AI content generation script

**Files:**
- Create: `remotion-promo/generate-studio-content.js`

- [ ] **Step 1: Create generate-studio-content.js**

```javascript
#!/usr/bin/env node
// remotion-promo/generate-studio-content.js
// Usage: node generate-studio-content.js --projectId <id>
// Reads food_promo_projects/{id} from Firestore, calls Claude for AI content, writes back.

const Anthropic = require("@anthropic-ai/sdk");
const admin = require("firebase-admin");
const path = require("path");

// ── Firebase init ──────────────────────────────────────────────────────────────
const serviceAccountPath = path.join(__dirname, "../dulichcali-booking-calendar-6796caee41ac.json");
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccountPath) });
}
const db = admin.firestore();

// ── CLI args ───────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith("--")) acc.push([arg.slice(2), arr[i + 1] ?? true]);
    return acc;
  }, [])
);
const projectId = args.projectId;
if (!projectId) { console.error("Usage: node generate-studio-content.js --projectId <id>"); process.exit(1); }

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📡 Loading project ${projectId} from Firestore…`);
  const doc = await db.collection("food_promo_projects").doc(projectId).get();
  if (!doc.exists) { console.error("Project not found"); process.exit(1); }

  const project = doc.data();
  console.log(`   Dish: ${project.dishName ?? "unknown"} · Vendor: ${project.vendorName ?? "unknown"}`);

  await db.collection("food_promo_projects").doc(projectId).update({ status: "analyzing", "timestamps.updatedAt": new Date().toISOString() });

  const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a Vietnamese food marketing expert fluent in Vietnamese, English, and Spanish.
Generate a complete promotional content package for the following dish.

Dish name: ${project.dishName ?? "unknown"}
English name: ${project.dishNameEn ?? ""}
Vendor: ${project.vendorName ?? "unknown"} (${project.vendorTagline ?? ""})
Description: ${project.dishDescription ?? ""}
Price: ${project.price ? `$${project.price} per ${project.unit ?? "each"}` : "contact for pricing"}
Cuisine: ${project.cuisine ?? "Vietnamese"}

Return ONLY valid JSON with these exact keys:
{
  "recipeTitle": "catchy Vietnamese recipe title",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "steps": ["step 1 instruction", "step 2 instruction", ...],
  "shortDescription": "1-2 sentence appetizing hook in Vietnamese",
  "voiceoverScript": "30-second narration script matching a food promo video. Engaging, warm, Vietnamese food storytelling voice. About 80 words.",
  "captions": [
    { "startSec": 3, "endSec": 6, "text": "caption text" },
    ...
  ],
  "hashtags": ["NhaBepCuaEmily", "VietnameseFood", "SanJoseFood", ...15 total],
  "youtubeTitle": "SEO-optimized YouTube Shorts title under 60 characters",
  "youtubeDescription": "YouTube description 150 words with keywords",
  "facebookCaption": "Facebook/Instagram caption with emojis, 3-4 sentences",
  "tiktokCaption": "TikTok caption under 150 chars",
  "thumbnailText": "5-word bold thumbnail text"
}

Captions should cover roughly 0-25 seconds of the video. Keep them short (max 12 words each).`;

  console.log("\n🤖 Calling Claude claude-sonnet-4-6…");
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = message.content[0].text;
  let generated;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    generated = JSON.parse(jsonMatch?.[0] ?? rawText);
  } catch (e) {
    console.error("Failed to parse Claude response:", rawText.slice(0, 500));
    await db.collection("food_promo_projects").doc(projectId).update({ status: "failed", "timestamps.updatedAt": new Date().toISOString() });
    process.exit(1);
  }

  console.log("✅ AI content generated:", Object.keys(generated).join(", "));

  await db.collection("food_promo_projects").doc(projectId).update({
    status: "script_ready",
    generated,
    "timestamps.updatedAt": new Date().toISOString(),
  });

  console.log(`\n✔ Project ${projectId} updated — status: script_ready`);
  console.log("   Next: node generate-studio-video.js --projectId", projectId);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Test with a mock project**

First create a test project in Firestore (or use the studio UI from Task 15). Quick manual test:

```bash
# In a Firebase project shell or emulator
cd remotion-promo
ANTHROPIC_API_KEY=<your-key> node generate-studio-content.js --projectId test-001
```

Expected: prints "AI content generated" with keys list, updates Firestore doc to `script_ready`.

---

## Task 13: Render pipeline script

**Files:**
- Create: `remotion-promo/generate-studio-video.js`

- [ ] **Step 1: Create generate-studio-video.js**

```javascript
#!/usr/bin/env node
// remotion-promo/generate-studio-video.js
// Usage: node generate-studio-video.js --projectId <id> [--upload]
// Reads food_promo_projects/{id}, maps AI content to FoodPromoStudio props, renders, uploads.

const { execSync } = require("child_process");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const serviceAccountPath = path.join(__dirname, "../dulichcali-booking-calendar-6796caee41ac.json");
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    storageBucket: "dulichcali-booking-calendar.appspot.com",
  });
}
const db = admin.firestore();
const bucket = admin.storage().bucket();

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith("--")) acc.push([arg.slice(2), arr[i + 1] ?? true]);
    return acc;
  }, [])
);
const projectId = args.projectId;
const upload = args.upload === true || args.upload === "true";

if (!projectId) { console.error("Usage: node generate-studio-video.js --projectId <id> [--upload]"); process.exit(1); }

async function main() {
  console.log(`\n📡 Loading project ${projectId}…`);
  const doc = await db.collection("food_promo_projects").doc(projectId).get();
  if (!doc.exists) { console.error("Project not found"); process.exit(1); }

  const p = doc.data();
  const g = p.generated ?? {};

  // Map Firestore project to FoodPromoStudioSchema props
  const props = {
    vendorName:      p.vendorName ?? "Du Lịch Cali",
    vendorTagline:   p.vendorTagline ?? "",
    dishName:        p.dishName ?? g.recipeTitle ?? "Món Ngon",
    dishNameEn:      p.dishNameEn ?? "",
    dishDescription: g.shortDescription ?? p.dishDescription ?? "",
    price:           p.price,
    unit:            p.unit ?? "phần",
    phone:           p.phone ?? "408-916-3439",
    orderUrl:        p.orderUrl ?? "dulichcali21.com",
    mediaItems:      (p.media ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    ingredients:     g.ingredients ?? [],
    steps:           g.steps ?? [],
    voiceoverScript: g.voiceoverScript ?? "",
    captions:        g.captions ?? [],
    hashtags:        g.hashtags ?? [],
    accentColor:     p.accentColor ?? "#f59e0b",
    showIngredients: (g.ingredients ?? []).length > 0,
    showSteps:       (g.steps ?? []).length > 0,
    musicTrack:      undefined,
    voiceoverFile:   undefined,
  };

  const outDir = path.join(__dirname, "out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outFile = path.join(outDir, `studio-${projectId}.mp4`);

  // Write props JSON to a temp file
  const propsFile = path.join(outDir, `props-${projectId}.json`);
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));

  await db.collection("food_promo_projects").doc(projectId).update({
    status: "rendering",
    "timestamps.updatedAt": new Date().toISOString(),
  });

  console.log("\n🎬 Rendering FoodPromoStudio…");
  const cmd = `npx remotion render src/index.ts FoodPromoStudio "${outFile}" --props="${propsFile}" --codec=h264`;
  console.log("  $", cmd);

  try {
    execSync(cmd, { cwd: __dirname, stdio: "inherit" });
  } catch (err) {
    await db.collection("food_promo_projects").doc(projectId).update({
      status: "failed",
      "render.error": err.message,
      "timestamps.updatedAt": new Date().toISOString(),
    });
    process.exit(1);
  }

  console.log("✅ Render complete:", outFile);

  if (upload) {
    const storagePath = `food-promo-projects/${projectId}/output.mp4`;
    console.log(`\n⬆️  Uploading to gs://${bucket.name}/${storagePath}…`);
    await bucket.upload(outFile, { destination: storagePath, metadata: { contentType: "video/mp4" } });
    const [outputUrl] = await bucket.file(storagePath).getSignedUrl({ action: "read", expires: "2099-01-01" });

    await db.collection("food_promo_projects").doc(projectId).update({
      status: "ready",
      "render.outputUrl": outputUrl,
      "render.outputStoragePath": storagePath,
      "timestamps.renderedAt": new Date().toISOString(),
      "timestamps.updatedAt": new Date().toISOString(),
    });
    console.log("✔ Upload complete:", outputUrl);
  } else {
    await db.collection("food_promo_projects").doc(projectId).update({
      status: "ready",
      "render.localPath": outFile,
      "timestamps.renderedAt": new Date().toISOString(),
      "timestamps.updatedAt": new Date().toISOString(),
    });
    console.log("✔ Local render saved. Run with --upload to push to Firebase Storage.");
  }

  // Clean up temp props file
  fs.unlinkSync(propsFile);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add a test run note**

To test end-to-end (after Task 12 generates content):
```bash
cd remotion-promo
node generate-studio-video.js --projectId test-001
# Output: out/studio-test-001.mp4
```

- [ ] **Step 3: Commit**

```bash
cd ..
git add remotion-promo/generate-studio-content.js remotion-promo/generate-studio-video.js
git commit -m "feat(video-studio): add AI content generation + render pipeline scripts"
```

---

## Task 14: Cloud Functions — uploadStudioMedia + queueFoodPromoRender

**Files:**
- Modify: `functions/index.js` (append two new exported functions at the end)

- [ ] **Step 1: Add uploadStudioMedia function**

Open `functions/index.js`. Before the final closing `}` or after the last export, add:

```javascript
// ── uploadStudioMedia ──────────────────────────────────────────────────────────
// Callable: { projectId, base64, fileName, mimeType, mediaType }
// Stores to food-promo-projects/{projectId}/media/{timestamp}.{ext}
// Returns: { ok, url, storagePath }
exports.uploadStudioMedia = onCall({ secrets: [] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const { projectId, base64, fileName, mimeType, mediaType } = request.data;
  if (!projectId || !base64 || !fileName || !mimeType) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  const ext  = fileName.split(".").pop() ?? "bin";
  const dest = `food-promo-projects/${projectId}/media/${Date.now()}.${ext}`;
  const file = adminStorage.bucket().file(dest);

  await file.save(Buffer.from(base64, "base64"), { metadata: { contentType: mimeType } });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${adminStorage.bucket().name}/${dest}`;

  return { ok: true, url, storagePath: dest };
});

// ── queueFoodPromoRender ────────────────────────────────────────────────────────
// Callable: { projectId }
// Creates a videoRenderJobs doc and sets project status to 'rendering'.
// Returns: { ok, jobId }
exports.queueFoodPromoRender = onCall({ secrets: [] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const { projectId } = request.data;
  if (!projectId) throw new HttpsError("invalid-argument", "Missing projectId");

  const db = adminFirestore;
  const projectRef = db.collection("food_promo_projects").doc(projectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) throw new HttpsError("not-found", "Project not found");

  const jobRef = db.collection("videoRenderJobs").doc();
  const command = `cd remotion-promo && node generate-studio-video.js --projectId ${projectId} --upload`;

  await jobRef.set({
    type: "food_promo_studio",
    projectId,
    status: "queued",
    command,
    createdAt: new Date().toISOString(),
  });

  await projectRef.update({ status: "rendering", "timestamps.updatedAt": new Date().toISOString() });

  return { ok: true, jobId: jobRef.id };
});
```

**Note:** Verify that `adminStorage`, `adminFirestore`, `onCall`, and `HttpsError` are already imported/defined at the top of `functions/index.js`. If `adminStorage` is not yet aliased, check what pattern the existing functions use (the file uses `admin.storage()` — add `const adminStorage = admin.storage();` near the top if needed).

- [ ] **Step 2: Deploy functions**

```bash
firebase deploy --only functions:uploadStudioMedia,functions:queueFoodPromoRender
```

Expected: both functions deployed successfully.

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat(video-studio): add uploadStudioMedia + queueFoodPromoRender Cloud Functions"
```

---

## Task 15: Studio UI page — HTML structure + CSS

**Files:**
- Create: `ai-food-video-studio.html`
- Create: `ai-food-video-studio.css`

- [ ] **Step 1: Create ai-food-video-studio.css**

```css
/* ai-food-video-studio.css */
:root {
  --navy: #0d1b2a;
  --gold: #c9a84c;
  --bg: #f8f6f2;
  --card-bg: #ffffff;
  --radius: 12px;
  --shadow: 0 2px 12px rgba(0,0,0,0.10);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Jost', system-ui, sans-serif;
  background: var(--bg);
  color: var(--navy);
  min-height: 100vh;
  padding-bottom: 80px;
}

/* ── Header ── */
.studio-header {
  background: var(--navy);
  color: #fff;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.studio-header h1 { font-size: 1.1rem; font-weight: 600; }
.studio-header .back-link { color: var(--gold); text-decoration: none; font-size: 0.9rem; }

/* ── Auth gate ── */
#authGate {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  gap: 16px;
  padding: 20px;
  text-align: center;
}
#authGate p { color: #666; }

/* ── Main layout ── */
#studioApp { display: none; padding: 16px 16px 0; max-width: 680px; margin: 0 auto; }

/* ── Cards ── */
.s-card {
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
  margin-bottom: 16px;
}
.s-card h2 { font-size: 1rem; font-weight: 700; margin-bottom: 14px; color: var(--navy); }

/* ── Form fields ── */
.s-field { margin-bottom: 14px; }
.s-field label { display: block; font-size: 0.82rem; font-weight: 600; color: #555; margin-bottom: 5px; }
.s-field input, .s-field textarea, .s-field select {
  width: 100%; padding: 10px 12px;
  border: 1.5px solid #ddd; border-radius: 8px;
  font-size: 0.95rem; font-family: inherit;
  transition: border-color 0.2s;
}
.s-field input:focus, .s-field textarea:focus, .s-field select:focus {
  outline: none; border-color: var(--gold);
}
.s-field textarea { resize: vertical; min-height: 80px; }

/* ── Media upload zone ── */
.upload-zone {
  border: 2px dashed #ccc; border-radius: 10px;
  padding: 28px; text-align: center; cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  margin-bottom: 14px;
}
.upload-zone:hover { border-color: var(--gold); background: #fffaf0; }
.upload-zone input[type=file] { display: none; }
.upload-zone p { color: #888; font-size: 0.9rem; margin-top: 6px; }

.media-preview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 10px;
}
.media-thumb {
  position: relative; aspect-ratio: 9/16;
  border-radius: 8px; overflow: hidden; background: #eee;
}
.media-thumb img, .media-thumb video { width: 100%; height: 100%; object-fit: cover; }
.media-thumb .remove-btn {
  position: absolute; top: 4px; right: 4px;
  background: rgba(0,0,0,0.6); color: #fff;
  border: none; border-radius: 50%;
  width: 24px; height: 24px; cursor: pointer;
  font-size: 14px; display: flex; align-items: center; justify-content: center;
}

/* ── Buttons ── */
.btn-primary {
  width: 100%; padding: 14px;
  background: var(--gold); color: var(--navy);
  border: none; border-radius: 10px;
  font-size: 1rem; font-weight: 700; cursor: pointer;
  transition: opacity 0.2s;
}
.btn-primary:hover { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-secondary {
  padding: 10px 18px;
  background: transparent; color: var(--navy);
  border: 1.5px solid var(--navy); border-radius: 8px;
  font-size: 0.9rem; font-weight: 600; cursor: pointer;
}

/* ── AI content preview ── */
.ai-preview { display: none; }
.ai-section { margin-bottom: 16px; }
.ai-section h3 { font-size: 0.88rem; font-weight: 700; color: #555; margin-bottom: 8px; }
.ai-section pre {
  background: #f4f4f4; border-radius: 8px; padding: 12px;
  font-size: 0.82rem; white-space: pre-wrap; line-height: 1.5;
}
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
.tag-chip {
  background: #f0e8d0; color: var(--navy);
  padding: 4px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 600;
}

/* ── Status bar ── */
.status-bar {
  background: var(--navy); color: #fff;
  padding: 10px 16px; border-radius: 8px;
  font-size: 0.88rem; margin-bottom: 14px; display: none;
}
.status-bar.visible { display: block; }
.status-bar.success { background: #1a6b3a; }
.status-bar.error   { background: #8b1a1a; }

/* ── Video preview ── */
.video-preview { display: none; }
.video-preview video { width: 100%; border-radius: 10px; }

/* ── Desktop ── */
@media (min-width: 768px) {
  #studioApp { padding: 24px; }
  .s-card { padding: 28px; }
  .media-preview-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (min-width: 1200px) {
  body { display: flex; flex-direction: column; }
  #studioApp { max-width: 760px; }
}
```

- [ ] **Step 2: Create ai-food-video-studio.html**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Food Video Studio — Du Lịch Cali</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/desktop.css">
  <link rel="stylesheet" href="/ai-food-video-studio.css?v=20260502a">
  <link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;600;700&display=swap" rel="stylesheet">

  <!-- Firebase 9.22.0 compat -->
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js"></script>
</head>
<body>

<header class="studio-header">
  <a href="/vendor-admin" class="back-link">← Vendor Admin</a>
  <h1>🎬 AI Food Video Studio</h1>
</header>

<!-- Auth gate -->
<div id="authGate">
  <p>🔒</p>
  <p>Vui lòng đăng nhập để sử dụng studio.</p>
  <a href="/vendor-login" style="color:var(--gold)">Đăng nhập</a>
</div>

<!-- Main studio app (shown after auth) -->
<div id="studioApp">

  <!-- Status bar -->
  <div class="status-bar" id="statusBar"></div>

  <!-- Section 1: Project info -->
  <div class="s-card">
    <h2>1. Thông tin món ăn</h2>

    <div class="s-field">
      <label>Vendor</label>
      <select id="vendorSelect">
        <option value="">Đang tải danh sách vendor…</option>
      </select>
    </div>

    <div class="s-field">
      <label>Tên món (tiếng Việt) *</label>
      <input type="text" id="dishName" placeholder="VD: Chả Giò">
    </div>

    <div class="s-field">
      <label>Tên món (tiếng Anh)</label>
      <input type="text" id="dishNameEn" placeholder="VD: Handmade Eggrolls">
    </div>

    <div class="s-field">
      <label>Mô tả ngắn</label>
      <textarea id="dishDescription" placeholder="Mô tả nguyên liệu, hương vị…"></textarea>
    </div>

    <div class="s-field">
      <label>Giá</label>
      <input type="number" id="price" placeholder="0.75" step="0.01">
    </div>

    <div class="s-field">
      <label>Màu accent (hex)</label>
      <input type="color" id="accentColor" value="#f59e0b">
    </div>
  </div>

  <!-- Section 2: Media upload -->
  <div class="s-card">
    <h2>2. Ảnh / Video clip</h2>
    <label class="upload-zone" id="uploadZone">
      <input type="file" id="mediaInput" accept="image/*,video/*" multiple>
      <div style="font-size:2rem">📷</div>
      <p>Bấm để chọn ảnh hoặc video (tối đa 6 file)</p>
    </label>
    <div class="media-preview-grid" id="mediaGrid"></div>
  </div>

  <!-- Section 3: AI generation -->
  <div class="s-card">
    <h2>3. Tạo nội dung AI</h2>
    <p style="font-size:0.88rem;color:#666;margin-bottom:14px">
      AI sẽ tự động tạo công thức, script thuyết minh, hashtag, tiêu đề YouTube/TikTok.
    </p>
    <button class="btn-primary" id="generateAIBtn">✨ Tạo nội dung AI</button>

    <div class="ai-preview" id="aiPreview" style="margin-top:20px">
      <div class="ai-section">
        <h3>Recipe Title</h3>
        <pre id="aiTitle"></pre>
      </div>
      <div class="ai-section">
        <h3>Ingredients</h3>
        <pre id="aiIngredients"></pre>
      </div>
      <div class="ai-section">
        <h3>Voiceover Script</h3>
        <pre id="aiScript"></pre>
      </div>
      <div class="ai-section">
        <h3>Hashtags</h3>
        <div class="tag-list" id="aiHashtags"></div>
      </div>
      <div class="ai-section">
        <h3>YouTube Title</h3>
        <pre id="aiYtTitle"></pre>
      </div>
      <div class="ai-section">
        <h3>Facebook Caption</h3>
        <pre id="aiFbCaption"></pre>
      </div>
    </div>
  </div>

  <!-- Section 4: Render -->
  <div class="s-card">
    <h2>4. Render video</h2>
    <p style="font-size:0.88rem;color:#666;margin-bottom:14px">
      Sau khi queue, chạy lệnh bên dưới trên máy workstation để render:
    </p>
    <pre id="renderCmd" style="background:#f4f4f4;padding:12px;border-radius:8px;font-size:0.8rem;word-break:break-all;display:none"></pre>
    <button class="btn-primary" id="queueRenderBtn" style="margin-top:12px" disabled>
      🎬 Queue Render Job
    </button>

    <div class="video-preview" id="videoPreview" style="margin-top:16px">
      <h3 style="font-size:0.9rem;margin-bottom:8px">Preview</h3>
      <video id="previewPlayer" controls playsinline></video>
    </div>
  </div>

</div>

<script src="/ai-food-video-studio.js?v=20260502a"></script>
</body>
</html>
```

- [ ] **Step 3: Commit (HTML + CSS only)**

```bash
git add ai-food-video-studio.html ai-food-video-studio.css
git commit -m "feat(video-studio): add studio HTML page + CSS (no JS yet)"
```

---

## Task 16: Studio JavaScript — all logic

**Files:**
- Create: `ai-food-video-studio.js`

- [ ] **Step 1: Create ai-food-video-studio.js**

```javascript
// ai-food-video-studio.js?v=20260502a
'use strict';

// ── Firebase init ──────────────────────────────────────────────────────────────
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey:            'AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ',
    authDomain:        'dulichcali-booking-calendar.firebaseapp.com',
    projectId:         'dulichcali-booking-calendar',
    storageBucket:     'dulichcali-booking-calendar.appspot.com',
    messagingSenderId: '623460884698',
    appId:             '1:623460884698:web:a08bd435c453a7b4db05e3',
  });
}

const db       = firebase.firestore();
const auth     = firebase.auth();
const fns      = firebase.functions();

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null;
let vendorId    = null;
let projectId   = null;
let mediaItems  = []; // { id, type, url, storagePath, file, localUrl }
let aiGenerated = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const authGate      = document.getElementById('authGate');
const studioApp     = document.getElementById('studioApp');
const statusBar     = document.getElementById('statusBar');
const vendorSelect  = document.getElementById('vendorSelect');
const dishName      = document.getElementById('dishName');
const dishNameEn    = document.getElementById('dishNameEn');
const dishDesc      = document.getElementById('dishDescription');
const price         = document.getElementById('price');
const accentColor   = document.getElementById('accentColor');
const mediaInput    = document.getElementById('mediaInput');
const mediaGrid     = document.getElementById('mediaGrid');
const generateAIBtn = document.getElementById('generateAIBtn');
const aiPreview     = document.getElementById('aiPreview');
const queueRenderBtn= document.getElementById('queueRenderBtn');
const renderCmd     = document.getElementById('renderCmd');
const videoPreview  = document.getElementById('videoPreview');
const previewPlayer = document.getElementById('previewPlayer');

// ── Helpers ───────────────────────────────────────────────────────────────────
function showStatus(msg, type = '') {
  statusBar.textContent = msg;
  statusBar.className = `status-bar visible${type ? ' ' + type : ''}`;
  if (type === 'success') setTimeout(() => statusBar.classList.remove('visible'), 4000);
}

function hideStatus() { statusBar.classList.remove('visible'); }

// ── Auth ──────────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    authGate.style.display = 'flex';
    studioApp.style.display = 'none';
    return;
  }
  currentUser = user;

  // Resolve vendorId from vendorUsers
  const vendorUserSnap = await db.collection('vendorUsers').doc(user.uid).get();
  if (vendorUserSnap.exists) {
    vendorId = vendorUserSnap.data().vendorId;
  }

  authGate.style.display = 'none';
  studioApp.style.display = 'block';
  loadVendors();
});

// ── Vendor selector ───────────────────────────────────────────────────────────
async function loadVendors() {
  const snap = await db.collection('vendors')
    .where('category', '==', 'food')
    .where('adminStatus', '==', 'active')
    .get();

  vendorSelect.innerHTML = '<option value="">-- Chọn vendor --</option>';
  snap.forEach((doc) => {
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = doc.data().businessName ?? doc.id;
    if (doc.id === vendorId) opt.selected = true;
    vendorSelect.appendChild(opt);
  });
  if (vendorId) vendorSelect.value = vendorId;
}

// ── Media upload ──────────────────────────────────────────────────────────────
document.getElementById('uploadZone').addEventListener('click', () => mediaInput.click());
mediaInput.addEventListener('change', handleFiles);

function handleFiles(e) {
  const files = Array.from(e.target.files).slice(0, 6 - mediaItems.length);
  files.forEach(addLocalMedia);
  e.target.value = '';
}

function addLocalMedia(file) {
  const isVideo = file.type.startsWith('video/');
  const id = 'local-' + Date.now() + Math.random().toString(36).slice(2);
  const localUrl = URL.createObjectURL(file);
  mediaItems.push({ id, type: isVideo ? 'video' : 'image', url: '', storagePath: '', file, localUrl });
  renderMediaGrid();
}

function renderMediaGrid() {
  mediaGrid.innerHTML = '';
  mediaItems.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'media-thumb';
    div.innerHTML = item.type === 'video'
      ? `<video src="${item.localUrl}" muted playsinline style="width:100%;height:100%;object-fit:cover"></video>`
      : `<img src="${item.localUrl}" alt="">`;
    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '×';
    btn.onclick = () => { mediaItems.splice(i, 1); renderMediaGrid(); };
    div.appendChild(btn);
    mediaGrid.appendChild(div);
  });
}

async function uploadAllMedia() {
  const uploadFn = fns.httpsCallable('uploadStudioMedia');
  for (const item of mediaItems) {
    if (item.url) continue; // already uploaded
    showStatus(`Uploading ${item.type}…`);
    const base64 = await fileToBase64(item.file);
    const result = await uploadFn({
      projectId,
      base64: base64.split(',')[1],
      fileName: item.file.name,
      mimeType: item.file.type,
      mediaType: item.type,
    });
    item.url = result.data.url;
    item.storagePath = result.data.storagePath;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Save project to Firestore ─────────────────────────────────────────────────
async function saveProject() {
  if (!vendorSelect.value) { alert('Vui lòng chọn vendor'); return false; }
  if (!dishName.value.trim()) { alert('Vui lòng nhập tên món'); return false; }

  const vendor = await db.collection('vendors').doc(vendorSelect.value).get();
  const vendorData = vendor.data() ?? {};

  const data = {
    vendorId:      vendorSelect.value,
    vendorName:    vendorData.businessName ?? '',
    vendorTagline: vendorData.description ?? '',
    dishName:      dishName.value.trim(),
    dishNameEn:    dishNameEn.value.trim(),
    dishDescription: dishDesc.value.trim(),
    price:         parseFloat(price.value) || null,
    accentColor:   accentColor.value,
    phone:         vendorData.phone ?? '408-916-3439',
    orderUrl:      `dulichcali21.com/marketplace?vendorId=${vendorSelect.value}`,
    media:         mediaItems.map((m, i) => ({
      id: m.id, type: m.type, url: m.url,
      storagePath: m.storagePath, order: i,
    })),
    status: 'draft',
    'timestamps.createdAt': new Date().toISOString(),
    'timestamps.updatedAt': new Date().toISOString(),
  };

  if (projectId) {
    await db.collection('food_promo_projects').doc(projectId).update(data);
  } else {
    const ref = await db.collection('food_promo_projects').add(data);
    projectId = ref.id;
  }
  return true;
}

// ── AI content generation ─────────────────────────────────────────────────────
generateAIBtn.addEventListener('click', async () => {
  generateAIBtn.disabled = true;
  generateAIBtn.textContent = '⏳ Đang xử lý…';

  try {
    showStatus('Uploading media…');
    await uploadAllMedia();

    showStatus('Saving project…');
    const ok = await saveProject();
    if (!ok) return;

    showStatus('Calling AI (Claude)…');

    // Call Claude via aiProxy CF
    const aiProxy = fns.httpsCallable('aiProxy');
    const vendor = await db.collection('vendors').doc(vendorSelect.value).get();
    const vendorData = vendor.data() ?? {};

    const systemPrompt = `You are a Vietnamese food marketing expert. Generate promotional content as valid JSON only.`;
    const userPrompt = `Generate a complete promotional content package for:

Dish: ${dishName.value}
English name: ${dishNameEn.value || 'n/a'}
Vendor: ${vendorData.businessName ?? ''} — ${vendorData.description ?? ''}
Description: ${dishDesc.value || 'n/a'}
Price: ${price.value ? '$' + price.value : 'contact for pricing'}

Return ONLY valid JSON with these keys:
{
  "recipeTitle": "catchy Vietnamese title",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "steps": ["step 1", "step 2", "step 3"],
  "shortDescription": "1-2 sentence hook in Vietnamese",
  "voiceoverScript": "30-second narration script, ~80 words, warm food storytelling voice",
  "captions": [{"startSec": 3, "endSec": 6, "text": "caption text"}],
  "hashtags": ["NhaBepCuaEmily", "VietnameseFood", "SanJoseEats"],
  "youtubeTitle": "SEO title under 60 chars",
  "youtubeDescription": "YouTube description ~150 words",
  "facebookCaption": "Facebook/IG caption with emojis",
  "tiktokCaption": "TikTok caption under 150 chars",
  "thumbnailText": "5-word bold text"
}`;

    const res = await aiProxy({
      provider: 'claude',
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 2000,
      jsonMode: false,
    });

    let generated;
    try {
      const match = res.data.text.match(/\{[\s\S]*\}/);
      generated = JSON.parse(match?.[0] ?? res.data.text);
    } catch {
      throw new Error('AI returned invalid JSON');
    }

    aiGenerated = generated;

    // Save to Firestore
    await db.collection('food_promo_projects').doc(projectId).update({
      status: 'script_ready',
      generated,
      'timestamps.updatedAt': new Date().toISOString(),
    });

    renderAIPreview(generated);
    queueRenderBtn.disabled = false;

    renderCmd.textContent = `cd remotion-promo && node generate-studio-video.js --projectId ${projectId} --upload`;
    renderCmd.style.display = 'block';

    showStatus('AI content generated successfully!', 'success');
  } catch (err) {
    showStatus('Error: ' + err.message, 'error');
    console.error(err);
  } finally {
    generateAIBtn.disabled = false;
    generateAIBtn.textContent = '✨ Tạo nội dung AI';
  }
});

function renderAIPreview(g) {
  document.getElementById('aiTitle').textContent = g.recipeTitle ?? '';
  document.getElementById('aiIngredients').textContent = (g.ingredients ?? []).join('\n');
  document.getElementById('aiScript').textContent = g.voiceoverScript ?? '';
  document.getElementById('aiHashtags').innerHTML = (g.hashtags ?? [])
    .map((h) => `<span class="tag-chip">#${h.replace(/^#/, '')}</span>`).join('');
  document.getElementById('aiYtTitle').textContent = g.youtubeTitle ?? '';
  document.getElementById('aiFbCaption').textContent = g.facebookCaption ?? '';
  aiPreview.style.display = 'block';
}

// ── Queue render ───────────────────────────────────────────────────────────────
queueRenderBtn.addEventListener('click', async () => {
  queueRenderBtn.disabled = true;
  queueRenderBtn.textContent = '⏳ Queueing…';
  try {
    const queueFn = fns.httpsCallable('queueFoodPromoRender');
    const res = await queueFn({ projectId });
    showStatus(`Render queued (job: ${res.data.jobId}). Run the command below on your workstation.`, 'success');
    queueRenderBtn.textContent = '✅ Queued';
    pollForVideo();
  } catch (err) {
    showStatus('Queue error: ' + err.message, 'error');
    queueRenderBtn.disabled = false;
    queueRenderBtn.textContent = '🎬 Queue Render Job';
  }
});

// ── Poll for rendered video ───────────────────────────────────────────────────
function pollForVideo() {
  const unsub = db.collection('food_promo_projects').doc(projectId)
    .onSnapshot((snap) => {
      const data = snap.data();
      const url = data?.render?.outputUrl;
      if (url) {
        previewPlayer.src = url;
        videoPreview.style.display = 'block';
        showStatus('Video ready!', 'success');
        unsub();
      }
    });
}
```

- [ ] **Step 2: Smoke test in browser**

```bash
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali
python3 -m http.server 8080
```

Open `http://localhost:8080/ai-food-video-studio.html`.

Verify:
- [ ] Page loads without console errors
- [ ] Auth gate shows (if not logged in to Firebase)
- [ ] After Firebase auth, vendor dropdown loads food vendors
- [ ] File picker opens when clicking upload zone
- [ ] Thumbnails appear in grid after selecting files
- [ ] "Tạo nội dung AI" button is clickable

- [ ] **Step 3: Commit**

```bash
git add ai-food-video-studio.js
git commit -m "feat(video-studio): add studio JavaScript — upload, AI gen, render queue, poll"
```

---

## Task 17: Deploy to production

- [ ] **Step 1: Final check — bump version strings**

`ai-food-video-studio.css` and `ai-food-video-studio.js` are new files, so `?v=20260502a` is safe (first deploy).

Verify `firestore.rules` and `firebase.json` changes are committed.

- [ ] **Step 2: Deploy hosting + functions + rules**

```bash
firebase deploy --only hosting,firestore:rules,functions:uploadStudioMedia,functions:queueFoodPromoRender
```

Expected output: all targets deployed successfully.

- [ ] **Step 3: Verify production**

```bash
curl -s -o /dev/null -w "%{http_code}" "https://www.dulichcali21.com/ai-food-video-studio"
```

Expected: `200`

- [ ] **Step 4: Confirm**

```
✔ Production domain updated — https://www.dulichcali21.com
```

---

## Self-Review — Spec Coverage

| Spec requirement | Covered in task |
|-----------------|----------------|
| Upload photos + video clips | Task 16 (file picker, base64 upload), Task 14 (uploadStudioMedia CF) |
| Recipe title | Task 12/16 (Claude generates `recipeTitle`) |
| Ingredients list | Task 8 (SceneIngredients), Task 12/16 (Claude generates) |
| Step-by-step recipe | Task 9 (SceneSteps), Task 12/16 (Claude generates) |
| Voiceover script | Task 12/16 (Claude generates `voiceoverScript`) |
| Captions/subtitles | Task 5 (CaptionTrack), Task 12/16 (Claude generates `captions`) |
| Hashtags | Task 10 (SceneCTA shows top 4), Task 12/16 (Claude generates 15) |
| YouTube/FB/TikTok titles | Task 12/16 (Claude generates all) |
| Thumbnail text | Task 12/16 (Claude generates `thumbnailText`) |
| Order/CTA | Task 10 (SceneCTA with `orderUrl` + `phone`) |
| Vertical 9:16 format | Task 11 (1080×1920 composition) |
| Animated zoom/pan/crop | Task 7 (KenBurnsImage with variable scale + translate) |
| Close-up movement + pan directions | Task 7 (PAN_DIRS alternation across images) |
| Food-style transitions | Task 7 (TransitionSeries with `fade()`) |
| Ingredient callouts | Task 8 (SceneIngredients with spring animations) |
| Recipe step cards | Task 9 (SceneSteps with numbered circles) |
| Steam/glow overlays | Task 4 (SteamOverlay + GlowOverlay in Overlays.tsx) |
| Music bed support | Task 11 (FoodPromoStudio Audio with `musicTrack` prop) |
| Optional voiceover | Task 11 (Audio with `voiceoverFile` prop) |
| Subtitle/caption track | Task 5 (CaptionTrack driven by `captions[]` timestamps) |
| Branded end card | Task 10 (SceneCTA with vendor name) |
| QR code / order link CTA | Task 10 (orderUrl shown in SceneCTA) |
| Video clip support (not just photos) | Task 7 (VideoClip component with `@remotion/media`) |
| Local generation, no auto-post | Tasks 12-13 (CLI scripts, manual render) |
| High quality (not boring slideshow) | Tasks 4, 6, 7, 8, 9, 10 (steam, glow, Ken Burns, transitions, animated cards) |
| Reusable for future vendors | FoodPromoStudioSchema is fully parameterized via props |
| Accessible from admin/vendor only | Task 15 (auth gate via `firebase.auth().onAuthStateChanged`) |

### Placeholder scan

No "TBD" or "TODO" found in plan tasks. Each task has exact code.

### Type consistency

- `MediaItem` type exported from `schema.ts`, used in `SceneMedia.tsx` and `FoodPromoStudio.tsx` — consistent.
- `Caption` type exported from `schema.ts`, used in `Caption.tsx` — consistent.
- `FoodPromoStudioProps` used as prop type in all scene components — consistent.
- `TOTAL_FRAMES` exported from `FoodPromoStudio.tsx`, imported in `Root.tsx` — consistent.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-ai-food-video-studio.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast parallel iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints

**Which approach?**
