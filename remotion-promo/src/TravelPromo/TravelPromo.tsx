// TravelPromo.tsx — 5-scene promo video, 1920×1080, 600 frames @ 30fps = 20s
// Scene 1 (0–90):    Hero — name, duration, price
// Scene 2 (90–210):  Highlights — 3 bullet points
// Scene 3 (210–360): Itinerary — day timeline
// Scene 4 (360–480): Pricing — private vs group comparison
// Scene 5 (480–600): CTA — call to action

import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { TravelPromoProps } from './schema';

const NAVY  = '#0a2344';
const NAVY2 = '#0e2c54';
const CREAM = '#f5f0e8';
const MUTED = 'rgba(245,240,232,0.65)';

const fadeIn = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const slideUp = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [28, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const slideX = (frame: number, start: number, dur: number, from = -30) =>
  interpolate(frame, [start, start + dur], [from, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

export const TravelPromo: React.FC<TravelPromoProps> = (props) => {
  const frame  = useCurrentFrame();
  const accent = props.accentColor || '#d4af37';

  const base: React.CSSProperties = {
    fontFamily: "'Jost', 'Inter', sans-serif",
    color: CREAM,
  };

  return (
    <AbsoluteFill style={{ background: NAVY }}>

      {/* ── Scene 1: Hero (frames 0–90) ───────────────────────────── */}
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill style={base}>
          {props.heroImageUrl ? (
            <Img
              src={props.heroImageUrl}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                opacity: interpolate(frame, [0, 20], [0, 0.4], { extrapolateRight: 'clamp' }),
              }}
            />
          ) : null}
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, rgba(10,35,68,0.25), rgba(10,35,68,0.88))`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '80px',
          }}>
            {/* Brand */}
            <div style={{
              fontSize: 30, letterSpacing: '0.14em', color: accent,
              textTransform: 'uppercase', marginBottom: 20,
              opacity: fadeIn(frame, 5, 18),
            }}>
              Du Lich Cali
            </div>

            {/* Package name */}
            <div style={{
              fontFamily: "'Bodoni Moda', 'Georgia', serif",
              fontSize: 78, fontWeight: 400, color: CREAM,
              textAlign: 'center', lineHeight: 1.15,
              opacity: fadeIn(frame, 15, 22),
              transform: `translateY(${slideUp(frame, 15, 22)}px)`,
            }}>
              {props.packageName}
            </div>

            {/* Tagline */}
            <div style={{
              fontSize: 34, color: MUTED, marginTop: 22, textAlign: 'center',
              opacity: fadeIn(frame, 32, 18),
            }}>
              {props.tagline}
            </div>

            {/* Price badges */}
            <div style={{
              marginTop: 44, display: 'flex', gap: 52, alignItems: 'center',
              opacity: fadeIn(frame, 48, 18),
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 52, fontWeight: 700, color: accent, lineHeight: 1 }}>
                  {props.priceGroup}
                </div>
                <div style={{ fontSize: 24, color: MUTED, marginTop: 8 }}>per person</div>
              </div>
              <div style={{ width: 2, height: 64, background: accent, opacity: 0.45 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 52, fontWeight: 700, color: accent, lineHeight: 1 }}>
                  {props.pricePrivate}
                </div>
                <div style={{ fontSize: 24, color: MUTED, marginTop: 8 }}>exclusive</div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ── Scene 2: Highlights (90–210) ─────────────────────────── */}
      <Sequence from={90} durationInFrames={120}>
        <AbsoluteFill style={{
          ...base, background: NAVY2,
          flexDirection: 'column', justifyContent: 'center',
          padding: '80px 110px',
          display: 'flex',
        }}>
          <div style={{
            fontFamily: "'Bodoni Moda', serif",
            fontSize: 56, color: CREAM, marginBottom: 48,
            opacity: fadeIn(frame - 90, 0, 14),
          }}>
            Highlights
          </div>

          {(props.highlights || []).slice(0, 3).map((h: string, i: number) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 30, marginBottom: 38,
              opacity: fadeIn(frame - 90, 18 + i * 16, 18),
              transform: `translateX(${slideX(frame - 90, 18 + i * 16, 18)}px)`,
            }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%',
                background: accent, color: NAVY,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 800, flexShrink: 0,
              }}>✓</div>
              <div style={{ fontSize: 40, color: CREAM, lineHeight: 1.3 }}>{h}</div>
            </div>
          ))}
        </AbsoluteFill>
      </Sequence>

      {/* ── Scene 3: Itinerary (210–360) ─────────────────────────── */}
      <Sequence from={210} durationInFrames={150}>
        <AbsoluteFill style={{
          ...base, background: NAVY,
          flexDirection: 'column',
          padding: '64px 88px',
          display: 'flex',
          overflow: 'hidden',
        }}>
          <div style={{
            fontFamily: "'Bodoni Moda', serif",
            fontSize: 56, color: CREAM, marginBottom: 36,
            opacity: fadeIn(frame - 210, 0, 14),
          }}>
            Your Day
          </div>

          {(props.itinerary || []).slice(0, 5).map((item: { time: string; desc: string }, i: number) => (
            <div key={i} style={{
              display: 'flex', gap: 34, alignItems: 'flex-start', marginBottom: 28,
              opacity: fadeIn(frame - 210, 14 + i * 13, 16),
              transform: `translateX(${slideX(frame - 210, 14 + i * 13, 16)}px)`,
            }}>
              <div style={{
                fontSize: 25, color: accent, fontWeight: 700,
                minWidth: 130, paddingTop: 5, flexShrink: 0,
              }}>
                {item.time}
              </div>
              <div style={{ width: 2, alignSelf: 'stretch', background: accent, opacity: 0.35, flexShrink: 0 }} />
              <div style={{ fontSize: 34, color: CREAM, lineHeight: 1.4 }}>{item.desc}</div>
            </div>
          ))}
        </AbsoluteFill>
      </Sequence>

      {/* ── Scene 4: Pricing (360–480) ───────────────────────────── */}
      <Sequence from={360} durationInFrames={120}>
        <AbsoluteFill style={{
          ...base, background: NAVY2,
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px',
          display: 'flex',
        }}>
          <div style={{
            fontFamily: "'Bodoni Moda', serif",
            fontSize: 54, color: CREAM, marginBottom: 56, textAlign: 'center',
            opacity: fadeIn(frame - 360, 0, 14),
          }}>
            Choose Your Experience
          </div>

          <div style={{ display: 'flex', gap: 48, width: '100%', maxWidth: 1100 }}>
            {/* Group */}
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: 28, padding: '48px 44px',
              opacity: fadeIn(frame - 360, 18, 20),
              transform: `translateY(${slideUp(frame - 360, 18, 20)}px)`,
            }}>
              <div style={{ fontSize: 30, color: MUTED, marginBottom: 14 }}>Group</div>
              <div style={{ fontSize: 78, fontWeight: 700, color: accent, lineHeight: 1 }}>
                {props.priceGroup}
              </div>
              <div style={{ fontSize: 26, color: MUTED, marginTop: 14 }}>Join a shared group</div>
              <div style={{ marginTop: 22, fontSize: 23, color: CREAM }}>
                Min 4 · Max 12 travelers
              </div>
            </div>

            {/* Private */}
            <div style={{
              flex: 1,
              background: `rgba(212,175,55,0.1)`,
              border: `2px solid ${accent}`,
              borderRadius: 28, padding: '48px 44px',
              opacity: fadeIn(frame - 360, 28, 20),
              transform: `translateY(${slideUp(frame - 360, 28, 20)}px)`,
            }}>
              <div style={{ fontSize: 30, color: MUTED, marginBottom: 14 }}>Private</div>
              <div style={{ fontSize: 78, fontWeight: 700, color: accent, lineHeight: 1 }}>
                {props.pricePrivate}
              </div>
              <div style={{ fontSize: 26, color: MUTED, marginTop: 14 }}>Exclusive vehicle</div>
              <div style={{ marginTop: 22, fontSize: 23, color: CREAM }}>
                All-inclusive · Bilingual guide
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ── Scene 5: CTA (480–600) ───────────────────────────────── */}
      <Sequence from={480} durationInFrames={120}>
        <AbsoluteFill style={{
          ...base, background: NAVY,
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '80px',
          display: 'flex',
        }}>
          <div style={{
            fontSize: 36, letterSpacing: '0.12em', color: accent,
            textTransform: 'uppercase', marginBottom: 22,
            opacity: fadeIn(frame - 480, 5, 18),
          }}>
            Du Lich Cali
          </div>

          <div style={{
            fontFamily: "'Bodoni Moda', serif",
            fontSize: 100, fontWeight: 400, color: CREAM,
            lineHeight: 1.1, marginBottom: 36,
            opacity: fadeIn(frame - 480, 14, 22),
            transform: `translateY(${slideUp(frame - 480, 14, 22)}px)`,
          }}>
            {props.ctaText}
          </div>

          <div style={{
            fontSize: 54, color: accent, fontWeight: 700, marginBottom: 18,
            opacity: fadeIn(frame - 480, 34, 18),
          }}>
            {props.phone}
          </div>

          <div style={{
            fontSize: 36, color: MUTED,
            opacity: fadeIn(frame - 480, 46, 18),
          }}>
            {props.website}
          </div>

          {/* Animated underline */}
          <div style={{
            marginTop: 52, height: 4, borderRadius: 2,
            background: accent,
            width: interpolate(frame - 480, [56, 90], [0, 620], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            }),
          }} />
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};
