import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Stub — replace with full implementation when ready
export const SalonPromo: React.FC<{
  salonName: string;
  salonTagline: string;
  accentColor: string;
  phone: string;
}> = ({ salonName, salonTagline, accentColor, phone }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const opacity = interpolate(frame, [0, 20, durationInFrames - 20, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #831843 0%, #4c1d95 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Jost', sans-serif",
        opacity,
      }}
    >
      <div
        style={{
          color: accentColor,
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 24,
        }}
      >
        Luxurious Nails & Spa
      </div>
      <div
        style={{
          color: "#fff8ee",
          fontSize: 72,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.1,
          marginBottom: 32,
          padding: "0 80px",
        }}
      >
        {salonName}
      </div>
      <div
        style={{
          color: "#c8e4f8",
          fontSize: 40,
          textAlign: "center",
          padding: "0 80px",
          marginBottom: 60,
        }}
      >
        {salonTagline}
      </div>
      <div
        style={{
          color: accentColor,
          fontSize: 48,
          fontWeight: 600,
        }}
      >
        {phone}
      </div>
    </AbsoluteFill>
  );
};
