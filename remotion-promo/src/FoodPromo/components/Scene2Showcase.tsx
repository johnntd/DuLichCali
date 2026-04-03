import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont, bodyFont } from "../../fonts";
import { FoodPromoProps } from "../schema";

// Scene 2 — Food showcase: full-bleed image with Ken Burns, staggered text reveal.
// Duration: ~195 frames (6.5 s at 30fps). Fades in/out at 15-frame boundaries.
export const Scene2Showcase: React.FC<FoodPromoProps> = ({
  itemName,
  itemNameEn,
  itemDescription,
  itemImage,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Scene opacity envelope
  const fadeIn  = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const sceneOpacity = Math.min(fadeIn, fadeOut);

  // Ken Burns: slow zoom + lateral drift over full scene
  const kbScale = interpolate(frame, [0, durationInFrames], [1.0, 1.15], {
    extrapolateRight: "clamp",
  });
  const kbX = interpolate(frame, [0, durationInFrames], [0, -40], {
    extrapolateRight: "clamp",
  });

  // Item name slides up (delay 15f)
  const nameProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 180, stiffness: 80 },
    durationInFrames: 40,
  });
  const nameY  = interpolate(nameProgress, [0, 1], [60, 0]);
  const nameOp = interpolate(frame, [15, 38], [0, 1], { extrapolateRight: "clamp" });

  // English subtitle fades in (delay 35f)
  const subOp = interpolate(frame, [35, 58], [0, 1], { extrapolateRight: "clamp" });
  const subY  = interpolate(
    spring({ frame: frame - 35, fps, config: { damping: 200 }, durationInFrames: 35 }),
    [0, 1],
    [20, 0],
  );

  // Description fades in (delay 58f)
  const descOp = interpolate(frame, [58, 82], [0, 1], { extrapolateRight: "clamp" });
  const descY  = interpolate(
    spring({ frame: frame - 58, fps, config: { damping: 200 }, durationInFrames: 30 }),
    [0, 1],
    [16, 0],
  );

  // Resolve image source
  const src = itemImage.startsWith("http") ? itemImage : staticFile(itemImage);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity, overflow: "hidden", background: "#000" }}>
      {/* Full-bleed food image with Ken Burns */}
      <AbsoluteFill
        style={{
          transform: `scale(${kbScale}) translateX(${kbX}px)`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      </AbsoluteFill>

      {/* Heavy bottom gradient overlay */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.30) 40%, rgba(10,4,0,0.84) 68%, rgba(10,4,0,0.96) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Text block pinned to bottom */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "flex-start",
          paddingBottom: 100,
          paddingLeft: 56,
          paddingRight: 56,
          flexDirection: "column",
        }}
      >
        {/* Vietnamese item name */}
        <div
          style={{
            fontFamily: displayFont,
            fontSize: 110,
            fontWeight: 300,
            color: "#fff8ee",
            lineHeight: 1.0,
            letterSpacing: "-0.01em",
            transform: `translateY(${nameY}px)`,
            opacity: nameOp,
            marginBottom: 14,
          }}
        >
          {itemName}
        </div>

        {/* English subtitle */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 30,
            fontWeight: 400,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: accentColor,
            opacity: subOp,
            transform: `translateY(${subY}px)`,
            marginBottom: 22,
          }}
        >
          {itemNameEn}
        </div>

        {/* Description */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 26,
            fontWeight: 300,
            color: "rgba(210,230,245,0.80)",
            lineHeight: 1.55,
            opacity: descOp,
            transform: `translateY(${descY}px)`,
            maxWidth: 860,
          }}
        >
          {itemDescription}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
