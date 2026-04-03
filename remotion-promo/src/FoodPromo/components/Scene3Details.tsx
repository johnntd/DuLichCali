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

// Scene 3 — Pricing & chips: price big, variant or tag chips, min order, promo line.
// Duration: ~120 frames (4 s at 30fps).
// When variants is empty, shows tags as feature chips instead.
export const Scene3Details: React.FC<FoodPromoProps> = ({
  pricePerUnit,
  unit,
  minimumOrderQty,
  variants,
  tags,
  promoText,
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

  // "Giá" label (delay 0)
  const labelOp = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" });

  // Price number counts up via spring (delay 5f)
  const priceProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 180, stiffness: 70 },
    durationInFrames: 45,
  });
  const displayPrice = interpolate(priceProgress, [0, 1], [0, pricePerUnit]);
  const priceY = interpolate(priceProgress, [0, 1], [80, 0]);

  // Per-unit label slides in with price
  const unitOp = interpolate(frame, [20, 38], [0, 1], { extrapolateRight: "clamp" });

  // Divider line expands (delay 38f)
  const lineProgress = spring({
    frame: frame - 38,
    fps,
    config: { damping: 200 },
    durationInFrames: 28,
  });
  const lineWidth = interpolate(lineProgress, [0, 1], [0, 680]);

  // Min order info (delay 50f)
  const minOp = interpolate(frame, [50, 66], [0, 1], { extrapolateRight: "clamp" });
  const minY  = interpolate(
    spring({ frame: frame - 50, fps, config: { damping: 200 }, durationInFrames: 28 }),
    [0, 1],
    [18, 0],
  );

  // Chip data: use variants if present, otherwise fall back to tags
  const chips: Array<{ primary: string; secondary?: string }> =
    variants.length > 0
      ? variants.map((v) => ({ primary: v.label, secondary: v.labelEn }))
      : tags.map((t) => ({ primary: t }));

  // Chip stagger (delay 68f, 14f apart)
  const variantDelay = 68;
  const chipStagger  = 14;

  // Promo text (delay after last chip)
  const promoDelay = variantDelay + chips.length * chipStagger + 18;
  const promoOp    = interpolate(frame, [promoDelay, promoDelay + 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const formatPrice = (p: number) =>
    p >= 1
      ? `$${p.toFixed(2).replace(/\.?0+$/, "")}`
      : `${Math.round(p * 100)}¢`;

  return (
    <AbsoluteFill
      style={{
        opacity: sceneOpacity,
        background:
          "linear-gradient(160deg, #0a0300 0%, #1e0900 55%, #0f0500 100%)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 85% 85% at 50% 50%, transparent 45%, rgba(0,0,0,0.60) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Content stack */}
      <div
        style={{
          width: "100%",
          paddingLeft: 72,
          paddingRight: 72,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        {/* "GIÁ / ĐƠN" label */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "0.30em",
            textTransform: "uppercase",
            color: "rgba(200,228,248,0.55)",
            opacity: labelOp,
            marginBottom: 10,
          }}
        >
          Giá / {unit}
        </div>

        {/* Price + unit row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 18,
            transform: `translateY(${priceY}px)`,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 160,
              fontWeight: 300,
              color: accentColor,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {formatPrice(displayPrice)}
          </div>

          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 32,
              fontWeight: 400,
              color: "rgba(255,248,238,0.70)",
              paddingBottom: 18,
              opacity: unitOp,
            }}
          >
            / {unit}
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: lineWidth,
            height: 1,
            background: `linear-gradient(to right, ${accentColor}, transparent)`,
            marginBottom: 30,
          }}
        />

        {/* Minimum order — hidden when qty === 1 (per-serving dish) */}
        {minimumOrderQty > 1 && (
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 28,
              fontWeight: 400,
              color: "rgba(210,230,245,0.75)",
              opacity: minOp,
              transform: `translateY(${minY}px)`,
              marginBottom: 36,
            }}
          >
            Đặt tối thiểu{" "}
            <span style={{ color: "#fff8ee", fontWeight: 600 }}>
              {minimumOrderQty} {unit}
            </span>
          </div>
        )}

        {/* Variant chips OR tag chips (whichever is present) */}
        {chips.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              marginBottom: 40,
              marginTop: minimumOrderQty <= 1 ? 36 : 0,
            }}
          >
            {chips.map((chip, i) => {
              const chipOp = interpolate(
                frame,
                [variantDelay + i * chipStagger, variantDelay + i * chipStagger + 18],
                [0, 1],
                { extrapolateRight: "clamp" },
              );
              const chipY = interpolate(
                spring({
                  frame: frame - (variantDelay + i * chipStagger),
                  fps,
                  config: { damping: 200 },
                  durationInFrames: 22,
                }),
                [0, 1],
                [14, 0],
              );
              return (
                <div
                  key={i}
                  style={{
                    opacity: chipOp,
                    transform: `translateY(${chipY}px)`,
                    borderRadius: 8,
                    border: `1.5px solid ${accentColor}`,
                    paddingLeft: chip.secondary ? 28 : 22,
                    paddingRight: chip.secondary ? 28 : 22,
                    paddingTop: 14,
                    paddingBottom: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: bodyFont,
                      fontSize: chip.secondary ? 24 : 22,
                      fontWeight: 600,
                      color: "#fff8ee",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {chip.primary}
                  </span>
                  {chip.secondary && (
                    <span
                      style={{
                        fontFamily: bodyFont,
                        fontSize: 20,
                        fontWeight: 300,
                        color: "rgba(200,228,248,0.65)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {chip.secondary}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Promo text */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 24,
            fontWeight: 400,
            color: "rgba(200,228,248,0.60)",
            letterSpacing: "0.06em",
            opacity: promoOp,
          }}
        >
          ✦ {promoText}
        </div>
      </div>
    </AbsoluteFill>
  );
};
