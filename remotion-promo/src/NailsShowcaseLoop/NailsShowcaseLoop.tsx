import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * NailsShowcaseLoop
 * -----------------
 * Premium photo-to-video cinematic loop for the Luxurious Nails hero.
 * Source: nails-1.jpg → animated with Ken Burns, light sweep, color grading.
 * Duration: 150 frames @ 30fps = 5 seconds.
 * All animations complete exactly one period so frame 0 === frame 150 (seamless loop).
 *
 * Effects applied:
 *  1. Ken Burns slow zoom-in + float (scale 1.04 → 1.07, always > 1 to avoid edge reveal)
 *  2. Subtle parallax pan (±15px X, ±8px Y) — feels like handheld depth
 *  3. Light sweep — diagonal soft highlight sweeps once across polish (shimmer illusion)
 *  4. Warm color grading — subtle golden-rose tint, lifted contrast
 *  5. Soft vignette — keeps edges cinematic, draws eye to center
 *  6. Bottom gradient — deep-to-transparent for text readability
 */

const TOTAL = 150; // frames — must match durationInFrames in Root.tsx
const TAU   = Math.PI * 2;

export const NailsShowcaseLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Normalized loop position [0, 1) — frame 150 returns to same state as frame 0.
  const t = frame / TOTAL;

  // ── 1. Ken Burns zoom + float ─────────────────────────────────────────────
  // scale: 1.04 → 1.07 → 1.04 → 1.01 → 1.04 (never below 1.01 — no edge reveal)
  // Range: 1.04 ± 0.03 via sin with half-cycle offset so it starts mid-zoom.
  const scale = 1.055 + 0.025 * Math.sin(TAU * t + Math.PI / 2);

  // Parallax drift — full period so start === end.
  const panX = 18 * Math.sin(TAU * t);
  const panY = 9  * Math.sin(TAU * t + Math.PI / 3);

  // ── 2. Light sweep — one pass per loop cycle ──────────────────────────────
  // A slim diagonal highlight stripe sweeps left→right between frames 12–80.
  // Fades in at 12, fully visible 20–65, fades out by 80. Dark rest-of-loop.
  const sweepX = interpolate(frame, [12, 80], [-420, 1540], {
    extrapolateLeft:  "clamp",
    extrapolateRight: "clamp",
  });
  const sweepOpacity = interpolate(frame, [0, 12, 55, 78], [0, 0.28, 0.28, 0], {
    extrapolateLeft:  "clamp",
    extrapolateRight: "clamp",
  });

  // ── 3. Scene fade-in at start (first half-second only) ───────────────────
  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#0f0015", opacity: fadeIn }}>

      {/* ── Base photo with Ken Burns transform ────────────────────────────── */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate(${panX}px, ${panY}px)`,
          transformOrigin: "center 42%", // bias toward upper half (where nails are)
          willChange: "transform",
        }}
      >
        <Img
          src={staticFile("nails-1.jpg")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 30%",
            // Color grading: lift contrast, boost saturation, warm shadow
            filter: "contrast(1.07) saturate(1.22) brightness(0.94) sepia(0.06)",
          }}
        />
      </AbsoluteFill>

      {/* ── Warm color tone overlay ─────────────────────────────────────────── */}
      {/* Adds a faint golden-rose wash — like a beauty ad warm grade */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(150deg, rgba(255,200,140,0.07) 0%, rgba(220,80,130,0.09) 60%, rgba(100,0,80,0.10) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Light sweep — polish shimmer illusion ──────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: -600,
          left: sweepX,
          width: 80,
          height: 3200,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,245,235,0.55) 50%, transparent 100%)",
          transform: "rotate(14deg)",
          opacity: sweepOpacity,
          pointerEvents: "none",
          mixBlendMode: "overlay",
        }}
      />

      {/* ── Vignette ────────────────────────────────────────────────────────── */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 50% 40%, transparent 38%, rgba(0,0,0,0.60) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Bottom gradient — deep plum fade for CTA text readability ─────── */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(18,0,20,1.0) 0%, rgba(18,0,20,0.72) 28%, rgba(18,0,20,0.0) 58%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
