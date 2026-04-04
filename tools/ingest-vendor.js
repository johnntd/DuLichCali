#!/usr/bin/env node
/**
 * ingest-vendor.js — DuLichCali Vendor Item Ingestion Pipeline
 *
 * USAGE:
 *   node tools/ingest-vendor.js --vendor <vendor_slug> [--dry-run]
 *
 * EXAMPLES:
 *   node tools/ingest-vendor.js --vendor nha_bep_cua_emily
 *   node tools/ingest-vendor.js --vendor pho_bac_bay_area --dry-run
 *
 * WHAT IT DOES:
 *   1. Reads Vendors_inputs/<vendor_slug>/
 *   2. Groups images into dish items by filename prefix
 *   3. Copies images to /images/ with canonical names
 *   4. Calls Claude API to generate Vietnamese + English product copy
 *   5. Outputs item data structured for CANONICAL_ITEMS and services-data.js
 *
 * REQUIREMENTS:
 *   npm install @anthropic-ai/sdk
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FILENAME GROUPING RULES (deterministic):
 *
 * Files in Vendors_inputs/<vendor_slug>/ are named:
 *   hero_<dish_slug>[_suffix].{jpg,jpeg,png,webp}   (underscore separator)
 *   hero-<dish_slug>[-suffix].{jpg,jpeg,png,webp}   (dash separator)
 *
 * Grouping algorithm:
 *   1. Strip leading "hero_" or "hero-" prefix
 *   2. Split remaining name on "_" or "-"
 *   3. The DISH SLUG is the longest common prefix shared by all files in a group
 *   4. Files with identical dish slug → same item
 *   5. Suffixes like "grill1", "grill2", "bun", "rau" → secondary/variant images
 *
 * Known suffix conventions (treated as secondary, not separate dishes):
 *   grill1, grill2, grill → grilling process shots
 *   bun, noodle           → noodle component shots
 *   rau, herb             → herb plate shots
 *   raw, fresh, cooked    → variant shots (mapped to variants[])
 *   2, 3, 4               → additional angle shots
 *
 * Image role assignment:
 *   - First/best image (fewest suffix tokens) → product.image (primary)
 *   - "raw"/"fresh"/"cooked" suffix → variant.imageUrl
 *   - Other suffixes → secondary references (logged but not directly wired)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const vendor  = (args[args.indexOf('--vendor') + 1] || '').trim();
const dryRun  = args.includes('--dry-run');

if (!vendor) {
  console.error('Usage: node tools/ingest-vendor.js --vendor <vendor_slug> [--dry-run]');
  process.exit(1);
}

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT        = path.resolve(__dirname, '..');
const INPUT_DIR   = path.join(ROOT, 'Vendors_inputs', vendor);
const IMAGES_DIR  = path.join(ROOT, 'images');

if (!fs.existsSync(INPUT_DIR)) {
  console.error('Input folder not found:', INPUT_DIR);
  process.exit(1);
}

// ── Image extensions ──────────────────────────────────────────────────────────
const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function isImage(f) {
  return IMG_EXTS.has(path.extname(f).toLowerCase());
}

// ── Normalize filename to dish slug ──────────────────────────────────────────
// "hero_bun_cha_hanoi_grill1.jpeg" → { dish: "bun-cha-hanoi", suffix: "grill1" }
// "hero-bun-dau-mamtom.jpeg"       → { dish: "bun-dau-mamtom", suffix: "" }
const SECONDARY_SUFFIXES = new Set([
  'grill', 'grill1', 'grill2', 'grill3',
  'bun', 'noodle', 'rau', 'herb', 'herbs',
  '2', '3', '4', '5',
  'process', 'prep', 'raw_side', 'fresh_side'
]);
const VARIANT_SUFFIXES = new Set(['raw', 'fresh', 'cooked', 'fried']);

function parseFilename(filename) {
  const base   = path.basename(filename, path.extname(filename));
  // Strip hero_ or hero- prefix
  const body   = base.replace(/^hero[_-]/i, '');
  // Normalize separators: underscores → dashes
  const parts  = body.split(/[_-]/).filter(Boolean);

  if (parts.length === 0) return null;

  // Find where the dish slug ends and the suffix begins
  // A suffix is a known secondary/variant keyword OR a bare number at the end
  let dishParts  = [...parts];
  let suffixParts = [];

  // Walk from the end: if last token is a known suffix/number, peel it off
  while (dishParts.length > 1) {
    const last = dishParts[dishParts.length - 1].toLowerCase();
    if (SECONDARY_SUFFIXES.has(last) || VARIANT_SUFFIXES.has(last) || /^\d+$/.test(last)) {
      suffixParts.unshift(dishParts.pop());
    } else {
      break;
    }
  }

  const dish   = dishParts.join('-').toLowerCase();
  const suffix = suffixParts.join('-').toLowerCase();
  const isVariant   = suffixParts.some(p => VARIANT_SUFFIXES.has(p.toLowerCase()));
  const isSecondary = suffixParts.some(p => SECONDARY_SUFFIXES.has(p.toLowerCase()));

  return { dish, suffix, isVariant, isSecondary, parts };
}

// ── Scan input folder and group by dish ─────────────────────────────────────
function scanInputFolder(dir) {
  const files = fs.readdirSync(dir).filter(f => isImage(f) && !f.startsWith('.'));
  const groups = {};

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) continue;
    const { dish } = parsed;
    if (!groups[dish]) groups[dish] = { primary: null, variants: [], secondary: [] };
    const g = groups[dish];

    if (parsed.isVariant) {
      g.variants.push({ file, suffix: parsed.suffix });
    } else if (parsed.isSecondary) {
      g.secondary.push({ file, suffix: parsed.suffix });
    } else {
      // No suffix → primary image for this dish
      if (!g.primary) {
        g.primary = file;
      } else {
        g.secondary.push({ file, suffix: parsed.suffix });
      }
    }
  }

  // For groups with no clean primary, promote the first secondary
  for (const dish of Object.keys(groups)) {
    const g = groups[dish];
    if (!g.primary && g.secondary.length > 0) {
      g.primary = g.secondary.shift().file;
    }
  }

  return groups;
}

// ── Generate canonical image name ────────────────────────────────────────────
function canonicalImageName(dish, suffix) {
  return 'hero-' + dish + (suffix ? '-' + suffix : '') + '.jpg';
}

// ── Copy images to /images/ ──────────────────────────────────────────────────
function copyImages(groups, inputDir, imagesDir, isDryRun) {
  const copied = {};
  for (const [dish, g] of Object.entries(groups)) {
    if (g.primary) {
      const dest = canonicalImageName(dish, '');
      const src  = path.join(inputDir, g.primary);
      const dst  = path.join(imagesDir, dest);
      if (!isDryRun) fs.copyFileSync(src, dst);
      copied[dish] = { primary: '/images/' + dest, variants: [], secondary: [] };
      console.log('[copy]', g.primary, '→', 'images/' + dest, isDryRun ? '(dry-run)' : '✓');
    }
    const gCopied = copied[dish] || { primary: null, variants: [], secondary: [] };
    for (const v of g.variants) {
      const dest = canonicalImageName(dish, v.suffix);
      const src  = path.join(inputDir, v.file);
      const dst  = path.join(imagesDir, dest);
      if (!isDryRun) fs.copyFileSync(src, dst);
      gCopied.variants.push({ suffix: v.suffix, url: '/images/' + dest });
      console.log('[copy]', v.file, '→', 'images/' + dest, isDryRun ? '(dry-run)' : '✓');
    }
    for (const s of g.secondary) {
      const dest = canonicalImageName(dish, s.suffix);
      const src  = path.join(inputDir, s.file);
      const dst  = path.join(imagesDir, dest);
      if (!isDryRun) fs.copyFileSync(src, dst);
      gCopied.secondary.push({ suffix: s.suffix, url: '/images/' + dest });
      console.log('[copy]', s.file, '→', 'images/' + dest + ' (secondary)', isDryRun ? '(dry-run)' : '✓');
    }
    copied[dish] = gCopied;
  }
  return copied;
}

// ── AI content generation via Claude API ────────────────────────────────────
async function generateItemContent(dishSlug, imageFiles, vendorSlug) {
  let Anthropic;
  try { Anthropic = require('@anthropic-ai/sdk'); } catch (e) {
    console.warn('[ai] @anthropic-ai/sdk not installed — skipping AI content generation');
    console.warn('[ai] Run: npm install @anthropic-ai/sdk');
    return null;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[ai] ANTHROPIC_API_KEY not set — skipping AI content generation');
    return null;
  }

  const client = new Anthropic.default({ apiKey });

  // Build image content blocks
  const imageContent = [];
  for (const f of imageFiles.slice(0, 3)) { // max 3 images per API call
    try {
      const buf    = fs.readFileSync(f);
      const b64    = buf.toString('base64');
      const ext    = path.extname(f).replace('.', '').replace('jpeg', 'jpg');
      const media  = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      imageContent.push({ type: 'image', source: { type: 'base64', media_type: media, data: b64 } });
    } catch (e) {
      console.warn('[ai] Could not read image:', f, e.message);
    }
  }

  if (imageContent.length === 0) return null;

  const prompt =
    `You are a food copywriter for Du Lịch Cali, a Vietnamese-American food marketplace in Southern California.\n` +
    `Analyze the food images provided (dish slug: "${dishSlug}", vendor: "${vendorSlug}").\n\n` +
    `Return ONLY a JSON object (no markdown, no code fences) with:\n` +
    `{\n` +
    `  "name": "<Vietnamese dish name>",\n` +
    `  "nameEn": "<English dish name>",\n` +
    `  "shortTagline": "<15-30 chars, Vietnamese, evocative>",\n` +
    `  "shortDescription": "<1 English sentence, under 120 chars>",\n` +
    `  "description": "<2-3 sentences Vietnamese, appetizing and authentic, no invented facts>",\n` +
    `  "tags": ["<tag1>", "<tag2>", ...],\n` +
    `  "allergenNotes": "<Vietnamese, list key allergens visible in dish>"\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Tone: premium, authentic, mouth-watering, Vietnamese-food-aware\n` +
    `- Tags: choose from: Miền Bắc, Miền Nam, Homemade, Grilled, Street Food, Soup, Comfort Food, Iconic, Bếp Than, Spicy, Vegetarian-adaptable, Contains Shellfish, Beef, Tofu, Limited Batch\n` +
    `- Do NOT invent ingredients not visible in the images\n` +
    `- description must be in Vietnamese\n` +
    `- shortTagline must be in Vietnamese`;

  try {
    const resp = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: prompt }
        ]
      }]
    });

    const text = resp.content[0].text.trim();
    return JSON.parse(text);
  } catch (e) {
    console.warn('[ai] Generation failed for', dishSlug, ':', e.message);
    return null;
  }
}

// ── Build item record ─────────────────────────────────────────────────────────
function buildItemRecord(dish, images, aiContent, sortOrder) {
  const slug  = dish;
  const ai    = aiContent || {};

  const variants = images.variants.map(v => ({
    key:      v.suffix,
    label:    v.suffix.charAt(0).toUpperCase() + v.suffix.slice(1),
    imageUrl: v.url,
    price:    null
  }));

  return {
    canonicalId:      slug,
    name:             ai.name             || slug.replace(/-/g, ' '),
    displayNameVi:    ai.name             || '',
    nameEn:           ai.nameEn           || '',
    description:      ai.description      || '',
    shortDescription: ai.shortDescription || '',
    shortTagline:     ai.shortTagline     || '',
    tags:             ai.tags             || [],
    variants,
    price:            null,   // vendor must set
    unit:             'phần',
    minimumOrderQty:  1,
    image:            images.primary      || '',
    videoUrl:         null,
    videoStatus:      'pending',
    videoGeneratedAt: null,
    remotionTemplate: 'FoodPromo',
    active:           true,
    featured:         true,
    sortOrder,
    allergenNotes:    ai.allergenNotes    || '',
    preparationInstructions: '',
    reheatingInstructions:   '',
    storageInstructions:     '',
    servingNotes:            ''
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== DuLichCali Vendor Ingestion Pipeline ===');
  console.log('Vendor :', vendor);
  console.log('Input  :', INPUT_DIR);
  console.log('Dry run:', dryRun);
  console.log('');

  // 1. Scan
  const groups = scanInputFolder(INPUT_DIR);
  const dishes = Object.keys(groups);
  console.log(`Found ${dishes.length} dish group(s):`, dishes.join(', '));
  console.log('');

  // 2. Copy images
  const copiedImages = copyImages(groups, INPUT_DIR, IMAGES_DIR, dryRun);
  console.log('');

  // 3. Generate AI content and build item records
  const items = [];
  let sortOrder = 10; // start at 10 to leave room for existing items

  for (const dish of dishes) {
    console.log(`[ai] Generating content for: ${dish}`);
    const imageFiles = [];
    if (groups[dish].primary) imageFiles.push(path.join(INPUT_DIR, groups[dish].primary));
    for (const s of groups[dish].secondary.slice(0, 2)) {
      imageFiles.push(path.join(INPUT_DIR, s.file));
    }

    const aiContent = await generateItemContent(dish, imageFiles, vendor);
    const item = buildItemRecord(dish, copiedImages[dish] || { primary: null, variants: [], secondary: [] }, aiContent, sortOrder++);
    items.push(item);

    if (aiContent) {
      console.log(`  → name: ${item.name} / ${item.nameEn}`);
      console.log(`  → tags: ${item.tags.join(', ')}`);
    } else {
      console.log(`  → AI unavailable — skeleton record created`);
    }
    console.log('');
  }

  // 4. Output
  console.log('=== INGESTION RESULT ===\n');
  console.log('Paste the following into CANONICAL_ITEMS in vendor-admin.html');
  console.log('and into the vendor\'s products[] in services-data.js:\n');
  console.log(JSON.stringify(items, null, 2));

  if (!dryRun) {
    const outPath = path.join(ROOT, 'tools', `ingested_${vendor}_${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
    console.log('\nSaved to:', outPath);
  }

  console.log('\n=== NEXT STEPS ===');
  console.log('1. Review and adjust price, minimumOrderQty, unit for each item');
  console.log('2. Add preparationInstructions, storageInstructions, etc. in vendor admin');
  console.log('3. Vendor admin will auto-seed items into Firestore on next login');
  console.log('4. Use ✨ AI Content button in vendor admin to refine per-item copy');
  console.log('5. Generate promo videos: set videoStatus → "ready" and populate videoUrl');
}

main().catch(err => { console.error(err); process.exit(1); });
