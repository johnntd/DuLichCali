import { z } from "zod";

export const FoodPromoSchema = z.object({
  // Vendor identity
  vendorName:    z.string().default("Nhà Bếp Của Emily"),
  vendorTagline: z.string().default("Handmade Vietnamese Kitchen · San Jose"),

  // Item identity
  itemName:        z.string().default("Chả Giò"),
  itemNameEn:      z.string().default("Handmade Eggrolls"),
  itemDescription: z.string().default(
    "Nhân thịt heo, nấm hương và cà rốt tươi — gói bằng bánh tráng mỏng, chiên giòn vàng thơm phức."
  ),
  // Filename relative to public/ (e.g. "nha-bep-emily-eggroll.jpg")
  // or a full https:// URL for remote images
  itemImage: z.string().default("nha-bep-emily-eggroll.jpg"),

  // Pricing
  pricePerUnit:    z.number().default(0.75),
  unit:            z.string().default("cuốn"),
  minimumOrderQty: z.number().default(30),

  // Variants shown on slide 3
  variants: z
    .array(z.object({ label: z.string(), labelEn: z.string() }))
    .default([
      { label: "Sống (Raw)",    labelEn: "Raw — fry fresh at home" },
      { label: "Tươi (Fresh)", labelEn: "Fresh — ready to serve"  },
    ]),

  // CTA / contact
  ctaText:   z.string().default("Đặt Hàng Ngay"),
  ctaSubtext: z.string().default("Perfect for family dinners & parties"),
  phone:     z.string().default("408-931-2438"),

  // Optional promo line beneath price (slide 3)
  promoText: z.string().default("No preservatives · Handmade every batch"),

  // Tags — shown as chips on slide 3 when no variants exist
  tags: z.array(z.string()).default([]),

  // Short one-liner description (optional, for future scenes)
  shortDescription: z.string().default(""),

  // Brand accent color (hex) — drives glow, chips, highlights
  accentColor: z.string().default("#f59e0b"),
});

export type FoodPromoProps = z.infer<typeof FoodPromoSchema>;
