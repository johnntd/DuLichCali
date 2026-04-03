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

// Scene 1 — Vendor intro: brand mark, vendor name, tagline.
// Duration: ~105 frames (3.5 s at 30fps). Fades out smoothly at end.
export const Scene1Intro: React.FC<FoodPromoProps> = ({
  vendorName,
  vendorTagline,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Scene opacity envelope
  const fadeIn  = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const sceneOpacity = Math.min(fadeIn, fadeOut);

  // Horizontal gold line expands from center
  const lineProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 35,
  });
  const lineWidth = interpolate(lineProgress, [0, 1], [0, 200]);

  // Brand mark slides down from above
  const brandProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 200 },
    durationInFrames: 30,
  });
  const brandY = interpolate(brandProgress, [0, 1], [-24, 0]);
  const brandOpacity = interpolate(frame, [5, 22], [0, 1], { extrapolateRight: "clamp" });

  // Vendor name slides up
  const nameProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 200 },
    durationInFrames: 35,
  });
  const nameY = interpolate(nameProgress, [0, 1], [40, 0]);
  const nameOpacity = interpolate(frame, [15, 38], [0, 1], { extrapolateRight: "clamp" });

  // Tagline fades in
  const tagOpacity = interpolate(frame, [38, 58], [0, 1], { extrapolateRight: "clamp" });

  // Second decorative line
  const line2Opacity = interpolate(frame, [55, 72], [0, 1], { extrapolateRight: "clamp" });

  // Three dots
  const dotOpacity = interpolate(frame, [68, 82], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        opacity: sceneOpacity,
        background:
          "linear-gradient(170deg, #120500 0%, #2d1200 45%, #1a0800 100%)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      {/* Subtle vignette ring */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 90% 90% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Brand mark: "✦ Du Lịch Cali" */}
      <div
        style={{
          fontFamily: bodyFont,
          fontSize: 22,
          fontWeight: 400,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: accentColor,
          opacity: brandOpacity,
          transform: `translateY(${brandY}px)`,
          marginBottom: 36,
        }}
      >
        ✦ Du Lịch Cali
      </div>

      {/* Top gold line */}
      <div
        style={{
          width: lineWidth,
          height: 1,
          background: accentColor,
          opacity: lineProgress,
          marginBottom: 40,
        }}
      />

      {/* Vendor name */}
      <div
        style={{
          fontFamily: displayFont,
          fontSize: 80,
          fontWeight: 300,
          color: "#fff8ee",
          letterSpacing: "0.02em",
          textAlign: "center",
          paddingLeft: 50,
          paddingRight: 50,
          lineHeight: 1.08,
          transform: `translateY(${nameY}px)`,
          opacity: nameOpacity,
        }}
      >
        {vendorName}
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily: bodyFont,
          fontSize: 26,
          fontWeight: 400,
          color: "rgba(200,228,248,0.72)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginTop: 22,
          opacity: tagOpacity,
          textAlign: "center",
          paddingLeft: 60,
          paddingRight: 60,
        }}
      >
        {vendorTagline}
      </div>

      {/* Bottom gold line (shorter) */}
      <div
        style={{
          width: interpolate(lineProgress, [0, 1], [0, 80]),
          height: 1,
          background: accentColor,
          marginTop: 40,
          opacity: lineProgress * line2Opacity,
        }}
      />

      {/* Three decorative dots */}
      <div
        style={{
          marginTop: 18,
          display: "flex",
          gap: 12,
          opacity: dotOpacity,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: i === 1 ? 9 : 5,
              height: i === 1 ? 9 : 5,
              borderRadius: "50%",
              background: accentColor,
              opacity: i === 1 ? 0.9 : 0.45,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
