import React from "react";
import { Composition } from "remotion";
import { FoodPromo } from "./FoodPromo/FoodPromo";
import { FoodPromoSchema } from "./FoodPromo/schema";
import { SalonPromo } from "./SalonPromo/SalonPromo";
import { SalonPromoProps } from "./SalonPromo/schema";
import { NailsHeroLoop } from "./NailsHeroLoop/NailsHeroLoop";
import { NailsShowcaseLoop } from "./NailsShowcaseLoop/NailsShowcaseLoop";
import { TravelPromo } from "./TravelPromo/TravelPromo";
import { TravelPromoSchema } from "./TravelPromo/schema";

// Total frames: 450 @ 30fps = 15 seconds
// Dimensions: 1080×1920 (vertical 9:16 mobile)
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition<SalonPromoProps>
        id="SalonPromo"
        component={SalonPromo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          salonName:    "Luxurious Nails & Spa",
          salonTagline: "Premium Nail Art · Bay Area",
          tagline2:     "Nơi Vẻ Đẹp Thăng Hoa",
          accentColor:  "#f472b6",
          phone:        "(408) 916-3439",
          website:      "dulichcali21.com/nailsalon",
          location:     "Bay Area, California",
          ctaText:      "Đặt Lịch Ngay",
          ctaSubtext:   "Walk-ins welcome · Same-day appointments",
          services: [
            { name: "Sơn Móng Tay",        nameEn: "Manicure",      price: "from $25" },
            { name: "Chăm Sóc Chân",        nameEn: "Pedicure",      price: "from $35" },
            { name: "Gel Màu",              nameEn: "Gel Nails",     price: "from $40" },
            { name: "Bột Nhúng",            nameEn: "Dip Powder",    price: "from $50" },
            { name: "Vẽ Móng Nghệ Thuật",   nameEn: "Nail Art",      price: "from $45" },
          ],
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
      <Composition
        id="NailsHeroLoop"
        component={NailsHeroLoop}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="NailsShowcaseLoop"
        component={NailsShowcaseLoop}
        durationInFrames={150}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{}}
      />
      <Composition
        id="TravelPromo"
        component={TravelPromo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        schema={TravelPromoSchema}
        defaultProps={{
          packageName:  'Big Sur & Monterey — 1 Day',
          tagline:      'California Coastal Experience',
          durationDays: 1,
          priceGroup:   '$89/person',
          pricePrivate: '$299 private',
          highlights: [
            'McWay Falls viewpoint at sunset',
            'Bixby Creek Bridge photo stop',
            'Monterey Bay Aquarium',
          ],
          itinerary: [
            { time: '7:00 AM',  desc: 'Depart San Jose — Hwy 101' },
            { time: '9:30 AM',  desc: 'Bixby Bridge & Big Sur coast' },
            { time: '1:00 PM',  desc: 'Lunch in Carmel-by-the-Sea' },
            { time: '2:30 PM',  desc: 'Monterey Bay Aquarium' },
            { time: '5:00 PM',  desc: 'Return to San Jose' },
          ],
          heroImageUrl:  '',
          accentColor:   '#d4af37',
          phone:         '(408) 916-3439',
          website:       'dulichcali21.com/travel',
          ctaText:       'Book Now',
          scenePaths:    [],
          narrationPath: '',
          musicPath:     '',
        }}
      />
    </>
  );
};
