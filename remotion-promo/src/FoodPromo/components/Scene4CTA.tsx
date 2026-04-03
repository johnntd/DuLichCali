import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont, bodyFont } from "../../fonts";
import { FoodPromoProps } from "../schema";

// Scene 4 — Call-to-action: CTA text, phone, brand sign-off.
// Duration: ~105 frames (3.5 s at 30fps). No fade-out (final scene).
export const Scene4CTA: React.FC<FoodPromoProps> = ({
  ctaText,
  ctaSubtext,
  phone,
  accentColor,
  vendorName,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Fade in only (last scene, no fade-out)
  const sceneOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pulsing glow ring behind phone (subtle, loops)
  const pulse = interpolate(
    Math.sin(((frame % 60) / 60) * Math.PI * 2),
    [-1, 1],
    [0.35, 0.65],
  );

  // CTA line 1 slides up (delay 10f)
  const ctaProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 160, stiffness: 80 },
    durationInFrames: 40,
  });
  const ctaY  = interpolate(ctaProgress, [0, 1], [80, 0]);
  const ctaOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  // Decorative line expands (delay 30f)
  const lineProgress = spring({
    frame: frame - 30,
    fps,
    config: { damping: 200 },
    durationInFrames: 28,
  });
  const lineWidth = interpolate(lineProgress, [0, 1], [0, 520]);

  // Subtext (delay 38f)
  const subOp = interpolate(frame, [38, 56], [0, 1], { extrapolateRight: "clamp" });
  const subY  = interpolate(
    spring({ frame: frame - 38, fps, config: { damping: 200 }, durationInFrames: 28 }),
    [0, 1],
    [20, 0],
  );

  // Phone number slides up big (delay 52f)
  const phoneProgress = spring({
    frame: frame - 52,
    fps,
    config: { damping: 140, stiffness: 70 },
    durationInFrames: 45,
  });
  const phoneY  = interpolate(phoneProgress, [0, 1], [100, 0]);
  const phoneOp = interpolate(frame, [52, 72], [0, 1], { extrapolateRight: "clamp" });

  // Brand sign-off (delay 78f)
  const brandOp = interpolate(frame, [78, 95], [0, 1], { extrapolateRight: "clamp" });

  // Bottom tagline
  const tagOp = interpolate(frame, [88, durationInFrames - 5], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity: sceneOpacity,
        background:
          "linear-gradient(170deg, #0c0400 0%, #251000 50%, #120500 100%)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.65) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Glow ring behind phone */}
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
          opacity: pulse,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          paddingLeft: 60,
          paddingRight: 60,
          gap: 0,
        }}
      >
        {/* CTA headline */}
        <div
          style={{
            fontFamily: displayFont,
            fontSize: 100,
            fontWeight: 300,
            color: "#fff8ee",
            letterSpacing: "0.01em",
            textAlign: "center",
            lineHeight: 1.05,
            transform: `translateY(${ctaY}px)`,
            opacity: ctaOp,
            marginBottom: 28,
          }}
        >
          {ctaText}
        </div>

        {/* Decorative line */}
        <div
          style={{
            width: lineWidth,
            height: 1,
            background: accentColor,
            marginBottom: 28,
            opacity: lineProgress,
          }}
        />

        {/* Subtext */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 26,
            fontWeight: 400,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "rgba(200,228,248,0.70)",
            textAlign: "center",
            opacity: subOp,
            transform: `translateY(${subY}px)`,
            marginBottom: 56,
          }}
        >
          {ctaSubtext}
        </div>

        {/* Phone number — the hero element */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 72,
            fontWeight: 600,
            color: accentColor,
            letterSpacing: "0.06em",
            textAlign: "center",
            opacity: phoneOp,
            transform: `translateY(${phoneY}px)`,
            marginBottom: 48,
          }}
        >
          {phone}
        </div>

        {/* Three dots */}
        <div
          style={{
            display: "flex",
            gap: 14,
            marginBottom: 44,
            opacity: brandOp,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: i === 1 ? 10 : 6,
                height: i === 1 ? 10 : 6,
                borderRadius: "50%",
                background: accentColor,
                opacity: i === 1 ? 0.9 : 0.45,
              }}
            />
          ))}
        </div>

        {/* Brand sign-off */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 20,
            fontWeight: 400,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: accentColor,
            opacity: brandOp,
            marginBottom: 10,
          }}
        >
          ✦ Du Lịch Cali
        </div>

        {/* Vendor name smaller */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 18,
            fontWeight: 300,
            letterSpacing: "0.12em",
            color: "rgba(200,228,248,0.45)",
            opacity: tagOp,
          }}
        >
          {vendorName}
        </div>
      </div>
    </AbsoluteFill>
  );
};
