import { z } from 'zod';

export const TravelPromoSchema = z.object({
  packageName:  z.string().default('Big Sur & Monterey — 1 Day'),
  tagline:      z.string().default('California Coastal Experience'),
  durationDays: z.number().default(1),
  priceGroup:   z.string().default('$89/person'),
  pricePrivate: z.string().default('$299 private'),
  highlights:   z.array(z.string()).default([
    'McWay Falls viewpoint at sunset',
    'Bixby Creek Bridge photo stop',
    'Monterey Bay Aquarium',
  ]),
  itinerary: z.array(z.object({
    time: z.string(),
    desc: z.string(),
  })).default([
    { time: '7:00 AM',  desc: 'Depart San Jose' },
    { time: '9:30 AM',  desc: 'Bixby Bridge & Big Sur' },
    { time: '1:00 PM',  desc: 'Carmel lunch' },
    { time: '2:30 PM',  desc: 'Monterey Aquarium' },
    { time: '5:00 PM',  desc: 'Return' },
  ]),
  heroImageUrl:  z.string().default(''),
  accentColor:   z.string().default('#d4af37'),
  phone:         z.string().default('(408) 916-3439'),
  website:       z.string().default('dulichcali21.com/travel'),
  ctaText:       z.string().default('Book Now'),
  // ── AI-generated cinematic assets ───────────────────────────────────────
  // Filenames (no path prefix) for files saved in remotion-promo/public/
  scenePaths:    z.array(z.string()).default([]),       // 6 Sora MP4 clips
  narrationPath: z.string().default(''),                // TTS narration MP3
  musicPath:     z.string().default(''),                // Pixabay underscore MP3
});

export type TravelPromoProps = z.infer<typeof TravelPromoSchema>;
