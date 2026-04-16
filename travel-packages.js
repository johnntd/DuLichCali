// travel-packages.js — Static package definitions.
// Source of truth for travel package data. Used by:
//   - scripts/seed-travel-packages.js (writes to Firestore once)
//   - travel.html / travel-booking.js (Firestore read with local fallback)
// Do NOT modify individual package prices without also updating the Firestore seed document.
// Schema v2: tiered pricing_private, hotel_options, attractions, booking_rules.

var DLC_TRAVEL_PACKAGES = [
  {
    id:            'big_sur_monterey_1_day',
    name:          'Big Sur & Monterey — 1 Day',
    name_vi:       'Big Sur & Monterey — 1 Ngày',
    name_es:       'Big Sur & Monterey — 1 Día',
    slug:          'big_sur_monterey_1_day',
    duration_days: 1,
    region:        'bayarea',
    hub_city:      'San Jose',
    distance_miles: 180,

    // ── Pricing ──────────────────────────────────────────────────────────────
    // Tiered private: price changes with party size (larger group = larger vehicle)
    pricing_private: {
      '1_2':  349,   // Toyota Sienna (1–2 pax)
      '3_5':  449,   // Toyota Sienna (3–5 pax)
      '6_7':  599,   // Toyota Sienna full capacity
      '8_12': 799,   // Mercedes Van
    },
    base_price_private:          349,  // backward-compat: equals 1_2 tier
    base_price_per_person_group:  89,  // per person (min 4, max 12)
    min_group:  4,
    max_group: 12,

    // ── Booking rules ────────────────────────────────────────────────────────
    booking_rules: {
      min_advance_days:    2,
      max_advance_days:   90,
      cancellation_hours: 48,  // free cancellation if >48h before departure
      deposit_percent:    25,  // % due at booking
    },

    // ── Available pickup regions ─────────────────────────────────────────────
    available_regions: ['all'],

    // ── Highlights ───────────────────────────────────────────────────────────
    highlights: [
      { en: 'McWay Falls viewpoint at golden hour', vi: 'Thác McWay lúc hoàng hôn', es: 'Mirador de McWay Falls en hora dorada' },
      { en: 'Bixby Creek Bridge photo stop',        vi: 'Chụp ảnh cầu Bixby Creek',  es: 'Parada fotográfica en el puente Bixby' },
      { en: 'Monterey Bay Aquarium visit',          vi: 'Thủy cung Vịnh Monterey',   es: 'Visita al Acuario de la Bahía de Monterey' },
    ],

    // ── Itinerary ────────────────────────────────────────────────────────────
    itinerary: [
      { time: '7:00 AM',  en: 'Depart San Jose — south on Hwy 101',         vi: 'Khởi hành San Jose — Hwy 101',           es: 'Salida de San Jose — Hwy 101' },
      { time: '9:30 AM',  en: 'Bixby Bridge & Big Sur coastline stops',     vi: 'Cầu Bixby & bờ biển Big Sur',            es: 'Puente Bixby y costa de Big Sur' },
      { time: '11:00 AM', en: 'McWay Falls & Pfeiffer Beach',               vi: 'Thác McWay & Bãi Pfeiffer',              es: 'Caídas McWay y Playa Pfeiffer' },
      { time: '1:00 PM',  en: 'Lunch in Carmel-by-the-Sea',                 vi: 'Ăn trưa ở Carmel-by-the-Sea',            es: 'Almuerzo en Carmel-by-the-Sea' },
      { time: '2:30 PM',  en: 'Monterey Bay Aquarium (self-guided, 2 hrs)', vi: 'Thủy cung Vịnh Monterey (tự tham quan)', es: 'Acuario de Monterey (2 horas libre)' },
      { time: '5:00 PM',  en: 'Return drive to San Jose',                   vi: 'Trở về San Jose',                        es: 'Regreso a San Jose' },
      { time: '7:30 PM',  en: 'Arrive home',                                vi: 'Về đến nhà',                              es: 'Llegada a casa' },
    ],

    // ── Key attractions (for detail page cards) ──────────────────────────────
    attractions: [
      { name: 'Bixby Creek Bridge',      name_vi: 'Cầu Bixby Creek',         entry_fee: 0,   notes_en: 'Free roadside pull-off' },
      { name: 'McWay Falls',             name_vi: 'Thác McWay',              entry_fee: 0,   notes_en: 'Julia Pfeiffer Burns State Park — free' },
      { name: 'Pfeiffer Beach',          name_vi: 'Bãi Pfeiffer',            entry_fee: 12,  notes_en: '$12/vehicle day-use fee' },
      { name: 'Monterey Bay Aquarium',   name_vi: 'Thủy Cung Vịnh Monterey', entry_fee: 55,  notes_en: 'Adult general admission (~$55)' },
    ],

    // ── Media ─────────────────────────────────────────────────────────────────
    images:              ['/monterey.jpg'],
    promo_video_url:     'https://www.youtube.com/watch?v=vm-fUXqMXnY',
    youtube_thumbnail_url: 'https://img.youtube.com/vi/bKcia4_aT50/hqdefault.jpg',

    active: true,
  },

  {
    id:            'highway_1_classic_2_day',
    name:          'Highway 1 Classic — 2 Days',
    name_vi:       'Quốc Lộ 1 Cổ Điển — 2 Ngày',
    name_es:       'Clásico Hwy 1 — 2 Días',
    slug:          'highway_1_classic_2_day',
    duration_days: 2,
    region:        'bayarea',
    hub_city:      'San Jose',
    distance_miles: 420,

    // ── Pricing ──────────────────────────────────────────────────────────────
    pricing_private: {
      '1_2':   699,
      '3_5':   999,
      '6_7':  1299,
      '8_12': 1699,
    },
    base_price_private:           699,
    base_price_per_person_group:  169,
    min_group:  4,
    max_group: 12,

    // ── Booking rules ────────────────────────────────────────────────────────
    booking_rules: {
      min_advance_days:    3,
      max_advance_days:   90,
      cancellation_hours: 72,
      deposit_percent:    30,
    },

    available_regions: ['all'],

    // ── Highlights ───────────────────────────────────────────────────────────
    highlights: [
      { en: 'Full Highway 1 coastal drive',   vi: 'Toàn tuyến Hwy 1 ven biển',       es: 'Ruta costera completa Hwy 1' },
      { en: 'Hearst Castle guided tour',      vi: 'Tour có hướng dẫn Lâu Đài Hearst', es: 'Tour guiado Castillo Hearst' },
      { en: 'Elephant Seal Vista Point',      vi: 'Khu bảo tồn Hải Cẩu Elephant',   es: 'Mirador de las Focas Elefante' },
    ],

    // ── Itinerary ────────────────────────────────────────────────────────────
    itinerary: [
      { time: 'Day 1 · 7:00 AM',  en: 'Depart San Jose → Davenport cliffs',    vi: 'Khởi hành → vách đá Davenport',        es: 'Salida → acantilados Davenport' },
      { time: 'Day 1 · 10:00 AM', en: 'Santa Cruz Boardwalk',                  vi: 'Khu vui chơi Santa Cruz',              es: 'Boardwalk de Santa Cruz' },
      { time: 'Day 1 · 1:00 PM',  en: 'Big Sur scenic drive & lunch',          vi: 'Big Sur & ăn trưa',                     es: 'Big Sur y almuerzo' },
      { time: 'Day 1 · 4:00 PM',  en: 'Check-in hotel in San Simeon',          vi: 'Nhận phòng San Simeon',                es: 'Check-in en San Simeon' },
      { time: 'Day 2 · 9:00 AM',  en: 'Hearst Castle guided tour',             vi: 'Tour Lâu Đài Hearst',                  es: 'Tour guiado Castillo Hearst' },
      { time: 'Day 2 · 12:00 PM', en: 'Elephant Seal Vista Point & lunch',     vi: 'Khu bảo tồn hải cẩu & ăn trưa',       es: 'Vista Point de focas y almuerzo' },
      { time: 'Day 2 · 2:00 PM',  en: 'Return via Hwy 101 to San Jose',        vi: 'Về San Jose qua Hwy 101',              es: 'Regreso vía Hwy 101 a San Jose' },
      { time: 'Day 2 · 6:00 PM',  en: 'Arrive home',                           vi: 'Về đến nhà',                            es: 'Llegada a casa' },
    ],

    // ── Key attractions ──────────────────────────────────────────────────────
    attractions: [
      { name: 'Santa Cruz Beach Boardwalk', name_vi: 'Khu vui chơi Santa Cruz', entry_fee: 0,   notes_en: 'Free entry; rides extra' },
      { name: 'Hearst Castle',              name_vi: 'Lâu Đài Hearst',          entry_fee: 35,  notes_en: 'Grand Rooms tour ~$35/adult' },
      { name: 'Elephant Seal Vista Point',  name_vi: 'Khu hải cẩu Piedras Blancas', entry_fee: 0, notes_en: 'Free roadside overlook' },
    ],

    // ── Hotel options (1 night — Day 1 in San Simeon) ────────────────────────
    hotel_options: [
      {
        id:       'san_simeon_budget',
        name:     'Best Western Cavalier Oceanfront',
        location: 'San Simeon, CA',
        tier:     'standard',
        price_per_night: 159,
        amenities_en: 'Oceanfront views, free parking, complimentary breakfast',
        book_url: '',
      },
      {
        id:       'san_simeon_premium',
        name:     'Sands by the Sea Motel',
        location: 'San Simeon, CA',
        tier:     'premium',
        price_per_night: 219,
        amenities_en: 'Beach access, garden setting, quiet location near Hearst',
        book_url: '',
      },
    ],

    // ── Media ─────────────────────────────────────────────────────────────────
    images:                ['/santabarbara.jpg'],
    promo_video_url:       'https://www.youtube.com/watch?v=fOvzCNt5WEc',
    youtube_thumbnail_url: 'https://img.youtube.com/vi/0vhzzsKVLhQ/hqdefault.jpg',

    active: true,
  },

  {
    id:            'coastal_premium_3_day',
    name:          'Coastal Premium — 3 Days',
    name_vi:       'Gói Bờ Biển Cao Cấp — 3 Ngày',
    name_es:       'Premium Costero — 3 Días',
    slug:          'coastal_premium_3_day',
    duration_days: 3,
    region:        'bayarea',
    hub_city:      'San Jose',
    distance_miles: 680,

    // ── Pricing ──────────────────────────────────────────────────────────────
    pricing_private: {
      '1_2':  1299,
      '3_5':  1699,
      '6_7':  2099,
      '8_12': 2699,
    },
    base_price_private:           1299,
    base_price_per_person_group:   349,
    min_group:  4,
    max_group:  8,

    // ── Booking rules ────────────────────────────────────────────────────────
    booking_rules: {
      min_advance_days:    5,
      max_advance_days:   90,
      cancellation_hours: 96,  // 4 days
      deposit_percent:    40,
    },

    available_regions: ['all'],

    // ── Highlights ───────────────────────────────────────────────────────────
    highlights: [
      { en: 'Private vehicle — no shared stops',     vi: 'Xe riêng — không dừng chung',       es: 'Vehículo privado — sin paradas compartidas' },
      { en: 'Santa Barbara wine country excursion',  vi: 'Thăm vùng rượu vang Santa Barbara',  es: 'Excursión a viñedos Santa Barbara' },
      { en: 'Malibu PCH + Getty Villa',              vi: 'Malibu PCH + Getty Villa',            es: 'Malibu PCH + Getty Villa' },
    ],

    // ── Itinerary ────────────────────────────────────────────────────────────
    itinerary: [
      { time: 'Day 1 · 7:00 AM',  en: 'San Jose → Carmel wine tasting',          vi: 'San Jose → thử rượu Carmel',           es: 'San Jose → cata de vinos en Carmel' },
      { time: 'Day 1 · 3:00 PM',  en: 'Big Sur overnight at boutique inn',       vi: 'Nghỉ đêm Big Sur tại inn boutique',    es: 'Noche en Big Sur en hotel boutique' },
      { time: 'Day 2 · 9:00 AM',  en: 'Hearst Castle → Santa Barbara',           vi: 'Hearst Castle → Santa Barbara',        es: 'Castillo Hearst → Santa Barbara' },
      { time: 'Day 2 · 4:00 PM',  en: 'Santa Barbara wine country',              vi: 'Vùng rượu Santa Barbara',              es: 'Viñedos de Santa Barbara' },
      { time: 'Day 2 · 7:00 PM',  en: 'Hotel check-in Santa Barbara',            vi: 'Nhận phòng Santa Barbara',             es: 'Check-in en Santa Barbara' },
      { time: 'Day 3 · 9:00 AM',  en: 'Malibu PCH → Getty Villa',                vi: 'Malibu PCH → Getty Villa',             es: 'Malibu PCH → Getty Villa' },
      { time: 'Day 3 · 3:00 PM',  en: 'Return to San Jose via Hwy 101',          vi: 'Trở về San Jose Hwy 101',              es: 'Regreso a San Jose vía Hwy 101' },
      { time: 'Day 3 · 8:00 PM',  en: 'Arrive home',                             vi: 'Về đến nhà',                            es: 'Llegada a casa' },
    ],

    // ── Key attractions ──────────────────────────────────────────────────────
    attractions: [
      { name: 'Carmel-by-the-Sea',         name_vi: 'Phố Carmel',            entry_fee: 0,  notes_en: 'Walkable coastal village with galleries & wine' },
      { name: 'Hearst Castle',             name_vi: 'Lâu Đài Hearst',        entry_fee: 35, notes_en: 'Grand Rooms tour ~$35/adult' },
      { name: 'Santa Barbara Wine Region', name_vi: 'Vùng Rượu Santa Barbara', entry_fee: 0, notes_en: 'Tasting fees vary by winery (~$20–40)' },
      { name: 'Getty Villa',               name_vi: 'Biệt Thự Getty',        entry_fee: 20, notes_en: 'Timed-entry reservation required — $20 parking' },
    ],

    // ── Hotel options (2 nights) ──────────────────────────────────────────────
    hotel_options: [
      {
        id:       'big_sur_night1',
        name:     'Fernwood Resort Big Sur',
        location: 'Big Sur, CA',
        tier:     'standard',
        night:    1,
        price_per_night: 195,
        amenities_en: 'Redwood cabins, riverside setting, on-site tavern',
        book_url: '',
      },
      {
        id:       'big_sur_night1_premium',
        name:     'Glen Oaks Big Sur',
        location: 'Big Sur, CA',
        tier:     'premium',
        night:    1,
        price_per_night: 350,
        amenities_en: 'Modern bungalows, hot tub, farm-to-table breakfast',
        book_url: '',
      },
      {
        id:       'santa_barbara_night2',
        name:     'Hotel Indigo Santa Barbara',
        location: 'Santa Barbara, CA',
        tier:     'standard',
        night:    2,
        price_per_night: 249,
        amenities_en: 'Downtown location, rooftop terrace, free bike rentals',
        book_url: '',
      },
      {
        id:       'santa_barbara_night2_premium',
        name:     'Canary Hotel Santa Barbara',
        location: 'Santa Barbara, CA',
        tier:     'premium',
        night:    2,
        price_per_night: 379,
        amenities_en: 'Rooftop pool, steps from State St, breakfast included',
        book_url: '',
      },
    ],

    // ── Media ─────────────────────────────────────────────────────────────────
    images:                ['/santabarbara.jpg'],
    promo_video_url:       'https://www.youtube.com/watch?v=WwNKytvUiQ8',
    youtube_thumbnail_url: 'https://img.youtube.com/vi/lYQdGLc6AzE/hqdefault.jpg',

    active: true,
  },
];

if (typeof module !== 'undefined') module.exports = { DLC_TRAVEL_PACKAGES };
