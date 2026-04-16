// TravelPromo.tsx — 6-scene AI-directed cinematic promo, 1920×1080, 900 frames @ 30fps = 30s
//
// Scene layout (5 s each):
//   Scene 1 (  0–150) — Aerial Establish:  Brand name, "California Awaits"
//   Scene 2 (150–300) — Journey Begins:    Package name + tagline
//   Scene 3 (300–450) — First Wonder:      highlights[0]
//   Scene 4 (450–600) — Human Moment:      highlights[1] — genuine joy
//   Scene 5 (600–750) — Second Wonder:     highlights[2]
//   Scene 6 (750–900) — Golden Close:      Brand + price + phone + CTA
//
// Each scene fades in over 20 frames (smooth cut-in).
// Ken Burns: slow zoom (1.0→1.09 scale) + 1.5% drift left/right alternating.
// Text overlays: bottom-third, fade in at frame 20, fade out at frame 130.
// Audio: narration at 1.0 volume, music underscore at 0.18 volume.
// Fallback: navy gradient when no clip path is supplied.

import React from 'react';
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence,
  interpolate, staticFile, useCurrentFrame,
} from 'remotion';
import { TravelPromoProps } from './schema';

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT    = '#d4af37';
const NAVY_BG   = 'linear-gradient(160deg, #0a2344 0%, #0e2c54 50%, #061628 100%)';
const SCENE_LEN = 150; // frames per scene (5 s @ 30 fps)
const FADE_IN   = 20;  // scene fade-in duration

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Slow Ken Burns zoom + drift. dir=1 → drift left; dir=-1 → drift right. */
function kenBurnsTransform(f: number, dir: 1 | -1 = 1): string {
  const s  = interpolate(f, [0, SCENE_LEN], [1.0,  1.09],       { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tx = interpolate(f, [0, SCENE_LEN], [0,    dir * -1.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ty = interpolate(f, [0, SCENE_LEN], [0,    -0.8],       { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return `scale(${s.toFixed(4)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
}

/** Scene container opacity: fade in from 0→1 over FADE_IN frames. */
function sceneFade(f: number): number {
  return interpolate(f, [0, FADE_IN], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** Text overlay opacity: invisible → fade in at 20 → hold → fade out at 130. */
function textFade(f: number): number {
  return interpolate(
    f,
    [FADE_IN, FADE_IN + 10, 130, SCENE_LEN],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
}

// ── SceneLayer — reusable for scenes 1–5 ─────────────────────────────────────

interface SceneLayerProps {
  clipFile: string;       // filename in public/ (empty string = use fallback)
  dir?: 1 | -1;
  label?: string;
  sublabel?: string;
  accentColor?: string;
}

const SceneLayer: React.FC<SceneLayerProps> = ({
  clipFile, dir = 1, label, sublabel, accentColor = ACCENT,
}) => {
  const f = useCurrentFrame();

  return (
    <AbsoluteFill style={{ opacity: sceneFade(f) }}>

      {/* ── Video or navy fallback ── */}
      {clipFile ? (
        <OffthreadVideo
          src={staticFile(clipFile)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            transform: kenBurnsTransform(f, dir),
            transformOrigin: 'center center',
          }}
          muted
        />
      ) : (
        <AbsoluteFill style={{ background: NAVY_BG }} />
      )}

      {/* ── Cinema vignette ── */}
      <AbsoluteFill style={{
        background:
          'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.20) 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── Bottom-third text overlay ── */}
      {(label || sublabel) && (
        <AbsoluteFill style={{
          display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '0 100px 90px',
          opacity: textFade(f),
          fontFamily: "'Jost', 'Inter', sans-serif",
        }}>
          {sublabel && (
            <div style={{
              fontSize: 26, letterSpacing: '0.22em', color: accentColor,
              textTransform: 'uppercase', marginBottom: 14,
            }}>
              {sublabel}
            </div>
          )}
          {label && (
            <div style={{
              fontSize: 68, fontWeight: 300, color: '#fff',
              fontFamily: "'Bodoni Moda', 'Georgia', serif",
              lineHeight: 1.15, textShadow: '0 2px 16px rgba(0,0,0,0.6)',
              maxWidth: 1400,
            }}>
              {label}
            </div>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ── GoldenClose — Scene 6 CTA ─────────────────────────────────────────────────

interface GoldenCloseProps {
  clipFile: string;
  packageName: string;
  priceGroup: string;
  phone: string;
  website: string;
  accentColor: string;
}

const GoldenClose: React.FC<GoldenCloseProps> = ({
  clipFile, packageName, priceGroup, phone, website, accentColor,
}) => {
  const f = useCurrentFrame();

  /** Sequential fade helpers — each text element fades in at a staggered start. */
  const fade = (start: number, dur = 18) =>
    interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity: sceneFade(f) }}>

      {/* ── Video or navy fallback ── */}
      {clipFile ? (
        <OffthreadVideo
          src={staticFile(clipFile)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            transform: kenBurnsTransform(f, -1),
            transformOrigin: 'center center',
          }}
          muted
        />
      ) : (
        <AbsoluteFill style={{ background: NAVY_BG }} />
      )}

      {/* Dark overlay for CTA legibility */}
      <AbsoluteFill style={{ background: 'rgba(5,15,35,0.68)' }} />

      {/* ── CTA content — centered ── */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '80px',
        fontFamily: "'Jost', 'Inter', sans-serif",
      }}>
        {/* Brand label */}
        <div style={{
          fontSize: 28, letterSpacing: '0.20em', color: accentColor,
          textTransform: 'uppercase', marginBottom: 24, opacity: fade(10),
        }}>
          Du Lich Cali
        </div>

        {/* Package name */}
        <div style={{
          fontFamily: "'Bodoni Moda', 'Georgia', serif",
          fontSize: 76, fontWeight: 400, color: '#fff',
          lineHeight: 1.1, marginBottom: 36,
          textShadow: '0 2px 20px rgba(0,0,0,0.5)',
          opacity: fade(22),
        }}>
          {packageName}
        </div>

        {/* Price */}
        <div style={{
          fontSize: 50, fontWeight: 700, color: accentColor,
          marginBottom: 8, opacity: fade(40),
        }}>
          From {priceGroup}
        </div>

        {/* Phone */}
        <div style={{
          fontSize: 42, color: '#fff', marginBottom: 8, opacity: fade(54),
        }}>
          {phone}
        </div>

        {/* Website */}
        <div style={{
          fontSize: 30, color: 'rgba(255,255,255,0.72)', opacity: fade(64),
        }}>
          {website}
        </div>

        {/* Animated gold underline */}
        <div style={{
          marginTop: 48, height: 3, borderRadius: 2, background: accentColor,
          width: interpolate(f, [74, 120], [0, 560], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }),
        }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── TravelPromo — root composition ────────────────────────────────────────────

export const TravelPromo: React.FC<TravelPromoProps> = (props) => {
  const {
    packageName, tagline,
    priceGroup, phone, website,
    accentColor = ACCENT,
    highlights  = [],
    scenePaths  = [],
    narrationPath,
    musicPath,
  } = props;

  // Helper: get the filename for scene index i (empty string = fallback gradient)
  const clip = (i: number): string => scenePaths[i] || '';

  return (
    <AbsoluteFill style={{ background: '#061628' }}>

      {/* ── Audio tracks ── */}
      {narrationPath && <Audio src={staticFile(narrationPath)} volume={1.0} />}
      {musicPath     && <Audio src={staticFile(musicPath)}     volume={0.18} />}

      {/* ── Scene 1: Aerial Establish (0–150) ── */}
      <Sequence from={0} durationInFrames={SCENE_LEN} name="Aerial Establish">
        <SceneLayer
          clipFile={clip(0)} dir={1}
          sublabel="Du Lich Cali"
          label="California Awaits"
          accentColor={accentColor}
        />
      </Sequence>

      {/* ── Scene 2: Journey Begins (150–300) ── */}
      <Sequence from={SCENE_LEN} durationInFrames={SCENE_LEN} name="Journey Begins">
        <SceneLayer
          clipFile={clip(1)} dir={-1}
          sublabel={tagline}
          label={packageName}
          accentColor={accentColor}
        />
      </Sequence>

      {/* ── Scene 3: First Wonder (300–450) ── */}
      <Sequence from={SCENE_LEN * 2} durationInFrames={SCENE_LEN} name="First Wonder">
        <SceneLayer
          clipFile={clip(2)} dir={1}
          sublabel="Discover"
          label={highlights[0] || 'Pacific Coast Magic'}
          accentColor={accentColor}
        />
      </Sequence>

      {/* ── Scene 4: Human Moment (450–600) ── */}
      <Sequence from={SCENE_LEN * 3} durationInFrames={SCENE_LEN} name="Human Moment">
        <SceneLayer
          clipFile={clip(3)} dir={-1}
          sublabel="Experience"
          label={highlights[1] || 'Unforgettable Moments'}
          accentColor={accentColor}
        />
      </Sequence>

      {/* ── Scene 5: Second Wonder (600–750) ── */}
      <Sequence from={SCENE_LEN * 4} durationInFrames={SCENE_LEN} name="Second Wonder">
        <SceneLayer
          clipFile={clip(4)} dir={1}
          sublabel="Explore"
          label={highlights[2] || 'Hidden California'}
          accentColor={accentColor}
        />
      </Sequence>

      {/* ── Scene 6: Golden Close (750–900) ── */}
      <Sequence from={SCENE_LEN * 5} durationInFrames={SCENE_LEN} name="Golden Close">
        <GoldenClose
          clipFile={clip(5)}
          packageName={packageName}
          priceGroup={priceGroup}
          phone={phone}
          website={website}
          accentColor={accentColor}
        />
      </Sequence>

    </AbsoluteFill>
  );
};
