import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// Seamless 4-second (120 frame) looping background for the Nails hero.
// ALL animations use (frame / TOTAL_FRAMES) * 2π so frame 0 === frame 120.
// Intended for object-fit:cover use — no readable content, pure atmosphere.

const TOTAL = 120; // must match durationInFrames in Root.tsx
const TAU   = Math.PI * 2;

// Deterministic pseudo-random from seed
function rng(seed: number) {
  const s = Math.sin(seed * 9301 + 49297) * 233280;
  return s - Math.floor(s);
}

// Generate particle data once at module level (stable across frames)
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  x:     rng(i * 3 + 0) * 1080,
  y:     rng(i * 3 + 1) * 1920,
  r:     2 + rng(i * 3 + 2) * 4,
  phase: rng(i * 7 + 3) * TAU,        // phase offset for sin
  orbitX: 30 + rng(i * 5 + 1) * 80,  // orbital radius x
  orbitY: 20 + rng(i * 5 + 2) * 50,  // orbital radius y
  speed:  0.6 + rng(i * 5 + 3) * 1.2, // how many cycles in TOTAL frames
  alpha:  0.25 + rng(i * 5 + 4) * 0.45,
  glow:   rng(i * 5 + 5) > 0.6,       // ~40% of particles get a glow
}));

// Three slow-drifting atmospheric blobs
const BLOBS = [
  { cx: 0.28, cy: 0.32, rx: 420, ry: 380, phase: 0,       color: "rgba(236,72,153,0.18)",   sp: 0.5 },
  { cx: 0.72, cy: 0.55, rx: 380, ry: 320, phase: TAU/3,   color: "rgba(168,85,247,0.14)",   sp: 0.7 },
  { cx: 0.45, cy: 0.78, rx: 340, ry: 300, phase: TAU*2/3, color: "rgba(244,114,182,0.12)",   sp: 0.9 },
];

export const NailsHeroLoop: React.FC = () => {
  const frame = useCurrentFrame();

  // Normalised loop position [0, 1) — frame 0 == frame TOTAL
  const t = frame / TOTAL;

  return (
    <AbsoluteFill
      style={{
        // Multi-stop deep-plum background — same family as salon.css #180d1a / #2d0a2e
        background:
          "linear-gradient(160deg, #0f0015 0%, #1e0028 30%, #2a0038 55%, #180020 80%, #0c0010 100%)",
        overflow: "hidden",
      }}
    >
      {/* ── Atmospheric blobs ───────────────────────────────────────────────── */}
      {BLOBS.map((b, i) => {
        const bx = b.cx * 1080 + Math.sin(t * TAU * b.sp + b.phase) * 140;
        const by = b.cy * 1920 + Math.cos(t * TAU * b.sp + b.phase) * 100;
        return (
          <div
            key={`blob-${i}`}
            style={{
              position: "absolute",
              left: bx - b.rx,
              top:  by - b.ry,
              width:  b.rx * 2,
              height: b.ry * 2,
              borderRadius: "50%",
              background: `radial-gradient(ellipse, ${b.color} 0%, transparent 70%)`,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* ── Shimmer particles ───────────────────────────────────────────────── */}
      {PARTICLES.map((p, i) => {
        // Each particle orbits around its base position
        const px = p.x + Math.sin(t * TAU * p.speed + p.phase) * p.orbitX;
        const py = p.y + Math.cos(t * TAU * p.speed + p.phase + 0.8) * p.orbitY;
        // Alpha pulses in sync with position (feels sparkly)
        const alphaPulse = p.alpha * (0.6 + 0.4 * Math.sin(t * TAU * p.speed * 1.5 + p.phase));

        return (
          <div
            key={`p-${i}`}
            style={{
              position: "absolute",
              left:   px - p.r,
              top:    py - p.r,
              width:  p.r * 2,
              height: p.r * 2,
              borderRadius: "50%",
              background:   i % 3 === 0 ? "#f9a8d4" : i % 3 === 1 ? "#e879f9" : "#fbbf24",
              opacity:      alphaPulse,
              boxShadow:    p.glow
                ? `0 0 ${p.r * 4}px ${p.r}px ${i % 3 === 0 ? "rgba(249,168,212,0.6)" : "rgba(232,121,249,0.5)"}`
                : "none",
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* ── Subtle radial vignette ──────────────────────────────────────────── */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 85% 85% at 50% 50%, transparent 30%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Bottom density fade (helps text legibility) ─────────────────────── */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(18,0,20,0.80) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
