import React from "react";
import { Composition } from "remotion";
import { FoodPromo } from "./FoodPromo/FoodPromo";
import { FoodPromoSchema } from "./FoodPromo/schema";
import { SalonPromo } from "./SalonPromo/SalonPromo";

// Total frames: 450 @ 30fps = 15 seconds
// Dimensions: 1080×1920 (vertical 9:16 mobile)
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SalonPromo"
        component={SalonPromo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          salonName:    "Luxurious Nails & Spa",
          salonTagline: "Premium Nail Art · Bay Area",
          accentColor:  "#f472b6",
          phone:        "(408) 555-0123",
        }}
      />
      <Composition
        id="FoodPromo"
        component={FoodPromo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        schema={FoodPromoSchema}
        defaultProps={{
          vendorName:      "Nhà Bếp Của Emily",
          vendorTagline:   "Handmade Vietnamese Kitchen · San Jose",
          itemName:        "Chả Giò",
          itemNameEn:      "Handmade Eggrolls",
          itemDescription:
            "Nhân thịt heo, nấm hương và cà rốt tươi — gói bằng bánh tráng mỏng, chiên giòn vàng thơm phức.",
          itemImage:       "nha-bep-emily-eggroll.jpg",
          pricePerUnit:    0.75,
          unit:            "cuốn",
          minimumOrderQty: 30,
          variants: [
            { label: "Sống (Raw)",    labelEn: "Raw — fry fresh at home" },
            { label: "Tươi (Fresh)", labelEn: "Fresh — ready to serve" },
          ],
          ctaText:    "Đặt Hàng Ngay",
          ctaSubtext: "Perfect for family dinners & parties",
          phone:      "408-931-2438",
          promoText:  "No preservatives · Handmade every batch",
          accentColor: "#f59e0b",
        }}
      />
    </>
  );
};
