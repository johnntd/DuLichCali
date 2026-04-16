#!/usr/bin/env node
/**
 * generate-travel-promo.js — AI-Directed Cinematic Travel Promo Pipeline
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Claude (claude-sonnet-4-6) writes narration script + 6 Sora scene prompts
 * 2. OpenAI Sora (sora-1.0-turbo) generates 6 × 5-second MP4 clips in parallel
 * 3. OpenAI TTS (tts-1-hd, shimmer) records the narration MP3
 * 4. Pixabay CDN: cinematic underscore downloaded once (shared across packages)
 * 5. Remotion renders the 900-frame 1920×1080 composition
 * 6. YouTube upload (existing OAuth flow)
 * 7. Firestore update (youtubeId, promo_video_url, youtube_thumbnail_url)
 *
 * Usage:
 *   node generate-travel-promo.js --pkg big_sur_monterey_1_day
 *   node generate-travel-promo.js --pkg highway_1_classic_2_day --no-youtube
 *   node generate-travel-promo.js --pkg coastal_premium_3_day --no-sora
 *
 * Flags:
 *   --pkg <id>       Package slug (required)
 *   --no-youtube     Skip YouTube upload (render only)
 *   --no-firestore   Skip Firestore update
 *   --no-sora        Skip Sora generation (use existing clips if present)
 *   --help
 *
 * Environment variables required:
 *   ANTHROPIC_API_KEY   — Claude script generation
 *   OPENAI_API_KEY      — Sora video generation + TTS
 *
 * Requires Node.js 18+ (uses built-in fetch).
 */
'use strict';

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');
const http         = require('http');
const urlModule    = require('url');

// ── Paths ─────────────────────────────────────────────────────────────────────
const SCRIPT_DIR  = __dirname;
const PUBLIC_DIR  = path.join(SCRIPT_DIR, 'public');
const OUT_DIR     = path.join(SCRIPT_DIR, 'out');
const YT_DIR      = path.join(__dirname, '..', 'scripts', 'youtube');
const TOKEN_FILE  = path.join(YT_DIR, 'token.json');
const SECRET_FILE = path.join(YT_DIR, 'client_secret.json');

// Shared music file (downloaded once, reused across all packages)
const MUSIC_FILE    = 'travel-music.mp3';
const MUSIC_PATH    = path.join(PUBLIC_DIR, MUSIC_FILE);
// Public-domain cinematic instrumental from SoundHelix (royalty-free)
const MUSIC_CDN_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

// ── Argument parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}
function hasFlag(name) { return args.includes(name); }

if (hasFlag('--help')) {
  console.log([
    'Usage: node generate-travel-promo.js --pkg <id> [options]',
    '',
    'Options:',
    '  --pkg <id>       Package ID (required)',
    '  --no-youtube     Skip YouTube upload',
    '  --no-firestore   Skip Firestore update',
    '  --no-sora        Skip Sora generation (use existing clips)',
    '',
    'Env vars required: ANTHROPIC_API_KEY, OPENAI_API_KEY',
  ].join('\n'));
  process.exit(0);
}

const pkgId      = flag('--pkg');
const skipYT     = hasFlag('--no-youtube');
const skipFS     = hasFlag('--no-firestore');
const skipSora   = hasFlag('--no-sora');
const skipClaude = hasFlag('--no-claude') || skipSora; // --no-sora implies --no-claude

if (!pkgId) { console.error('--pkg <id> is required'); process.exit(1); }

// ── API keys ──────────────────────────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY    = process.env.OPENAI_API_KEY;
if (!ANTHROPIC_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
if (!OPENAI_KEY)    { console.error('OPENAI_API_KEY not set');    process.exit(1); }

// ── Load package data ─────────────────────────────────────────────────────────
const { DLC_TRAVEL_PACKAGES } = require('../travel-packages.js');
const pkg = DLC_TRAVEL_PACKAGES.find(p => p.id === pkgId || p.slug === pkgId);
if (!pkg) {
  console.error('Package not found: ' + pkgId);
  console.error('Available: ' + DLC_TRAVEL_PACKAGES.map(p => p.id).join(', '));
  process.exit(1);
}

// ── Prepare directories ───────────────────────────────────────────────────────
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR,    { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// AI GENERATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateScript — Claude writes narration + 6 Sora scene prompts.
 * Returns { narration: string, scenes: string[] }
 */
async function generateScript(packageData) {
  console.log('\n[1/4] Claude: writing narration script + scene prompts...');

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default({ apiKey: ANTHROPIC_KEY });

  const systemPrompt = `You are a cinematic travel video director writing for Du Lich Cali, a Vietnamese-English bilingual California tour company.

Write two things for the package below:

1. NARRATION (exactly 75–85 words, second-person immersive, warm and aspirational):
   Start with a sensory hook. Build through the journey. End on the booking CTA.
   Tone: National Geographic meets friendly local guide.
   Must mention: the key attraction names, the duration, the price entry point.

2. SCENE_PROMPTS (array of 6 strings, one per scene):
   Cinematic language: lighting conditions, camera movement, subject action, mood.
   Include real people enjoying the experience (not just landscapes).
   Each prompt: 2–3 sentences, < 200 chars.
   Scene order: aerial establish → road journey → attraction 1 → human moment → attraction 2 → golden close.

Output JSON only: { "narration": "...", "scenes": ["...", "...", "...", "...", "...", "..."] }`;

  const userPrompt = `Package: ${packageData.name}
Duration: ${packageData.duration_days} day(s)
Group price: $${packageData.base_price_per_person_group}/person
Private price: $${packageData.base_price_private}
Key attractions: ${(packageData.highlights || []).map(h => h.en).join(', ')}
Itinerary: ${(packageData.itinerary || []).map(i => i.time + ' ' + i.en).join(' | ')}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude did not return JSON. Response: ' + text);

  const result = JSON.parse(jsonMatch[0]);
  if (!result.narration || !Array.isArray(result.scenes) || result.scenes.length !== 6) {
    throw new Error('Unexpected Claude JSON shape: ' + JSON.stringify(result));
  }

  console.log('  ✓ Narration (' + result.narration.split(' ').length + ' words)');
  console.log('  ✓ 6 scene prompts');
  return result;
}

/**
 * generateSoraClip — submits an async Sora video job, polls until complete, downloads MP4.
 *
 * Sora-2 generates asynchronously. The API:
 *   1. openai.videos.create()  → returns job with status "queued"
 *   2. openai.videos.retrieve(id) → poll until status "completed" | "failed"
 *   3. openai.videos.downloadContent(id) → binary MP4
 *
 * Valid sizes: "1280x720" (landscape) or "720x1280" (portrait)
 * Valid seconds: 4, 8, 12  (we use 4 — minimum; Ken Burns CSS motion runs for full 5s scene)
 */
async function generateSoraClip(prompt, outputPath) {
  const OpenAI = require('openai');
  const openai = new OpenAI.default({ apiKey: OPENAI_KEY });

  // Submit generation job
  const job = await openai.videos.create({
    model: 'sora-2',
    prompt,
    size: '1280x720',   // landscape; Remotion objectFit:cover upscales to 1920x1080
    seconds: 4,         // minimum supported (5 not valid); Ken Burns CSS runs for full scene
  });
  console.log('    job ' + job.id + ' queued...');

  // Poll until completed or failed (max 12 minutes per clip)
  const POLL_MS  = 20000;  // 20 s between checks
  const MAX_MS   = 720000; // 12 min timeout
  const deadline = Date.now() + MAX_MS;

  let video = job;
  while (video.status !== 'completed' && video.status !== 'failed') {
    if (Date.now() > deadline) throw new Error('Sora timed out after 12 minutes');
    await new Promise(r => setTimeout(r, POLL_MS));
    video = await openai.videos.retrieve(job.id);
    process.stdout.write('    ' + video.progress + '% ');
  }
  process.stdout.write('\n');

  if (video.status === 'failed') {
    throw new Error('Sora generation failed: ' + JSON.stringify(video.error));
  }

  // Download the MP4 binary
  const content = await openai.videos.downloadContent(job.id);
  const buffer  = Buffer.from(await content.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

/**
 * generateSoraClipWithRetry — wraps generateSoraClip with 1 retry.
 * Returns the output filename (relative, for Remotion props) or '' on failure.
 */
async function generateSoraClipWithRetry(prompt, sceneIdx) {
  const filename   = pkgId + '-scene-' + (sceneIdx + 1) + '.mp4';
  const outputPath = path.join(PUBLIC_DIR, filename);

  // Skip if --no-sora and file already exists
  if (skipSora && fs.existsSync(outputPath)) {
    console.log('  [skip] ' + filename + ' exists');
    return filename;
  }

  // Skip if --no-sora and file does not exist (use navy fallback)
  if (skipSora) {
    console.log('  [skip] --no-sora, no existing file → navy fallback for scene ' + (sceneIdx + 1));
    return '';
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await generateSoraClip(prompt, outputPath);
      console.log('  ✓ Scene ' + (sceneIdx + 1) + ' → ' + filename);
      return filename;
    } catch (e) {
      console.warn('  ✗ Scene ' + (sceneIdx + 1) + ' attempt ' + attempt + ' failed: ' + e.message);
      if (attempt === 2) {
        console.warn('  → Navy gradient fallback for scene ' + (sceneIdx + 1));
        return ''; // empty string = navy gradient in TravelPromo.tsx
      }
    }
  }
  return '';
}

/**
 * generateTTS — OpenAI TTS (tts-1-hd, shimmer voice) → MP3.
 * Returns the output filename (relative) or '' on failure.
 */
async function generateTTS(narration) {
  console.log('\n[3/4] OpenAI TTS: recording narration (shimmer voice)...');
  const filename   = pkgId + '-narration.mp3';
  const outputPath = path.join(PUBLIC_DIR, filename);

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI.default({ apiKey: OPENAI_KEY });

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'shimmer',
      input: narration,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    console.log('  ✓ Narration saved → ' + filename);
    return filename;
  } catch (e) {
    console.warn('  ✗ TTS failed: ' + e.message + ' — rendering without narration');
    return '';
  }
}

/**
 * downloadMusic — fetches the Pixabay cinematic underscore once.
 * Skips if the file already exists. Returns filename or '' on failure.
 */
async function downloadMusic() {
  console.log('\n[4/4] Pixabay: downloading cinematic music underscore...');
  if (fs.existsSync(MUSIC_PATH)) {
    console.log('  ✓ Music already cached → ' + MUSIC_FILE);
    return MUSIC_FILE;
  }

  try {
    const res = await fetch(MUSIC_CDN_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    fs.writeFileSync(MUSIC_PATH, Buffer.from(buf));
    console.log('  ✓ Music saved → ' + MUSIC_FILE);
    return MUSIC_FILE;
  } catch (e) {
    console.warn('  ✗ Music download failed: ' + e.message + ' — rendering without music');
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YOUTUBE UPLOAD (preserved from original)
// ─────────────────────────────────────────────────────────────────────────────

async function uploadToYouTube(outPath) {
  const { google } = require('googleapis');

  if (!fs.existsSync(SECRET_FILE)) {
    console.error('\nclient_secret.json not found at: ' + SECRET_FILE);
    console.error('Expected location: scripts/youtube/client_secret.json');
    process.exit(1);
  }

  const secret = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8'));
  const creds  = secret.installed || secret.web;
  const { client_id, client_secret } = creds;

  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, 'http://localhost:3456/callback'
  );

  if (fs.existsSync(TOKEN_FILE)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')));
    const expiry = oAuth2Client.credentials.expiry_date;
    if (expiry && Date.now() > expiry - 60000) {
      console.log('  ↻  Refreshing access token...');
      const { credentials } = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(credentials);
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(credentials, null, 2));
    } else {
      console.log('  ✓  Token loaded from scripts/youtube/token.json');
    }
  } else {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload'],
      prompt: 'consent',
    });
    console.log('\nOpen this URL in your browser:\n\n  ' + authUrl);
    try { require('child_process').exec('open "' + authUrl + '"'); } catch (_) {}

    const code = await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const parsed = urlModule.parse(req.url, true);
        if (parsed.pathname !== '/callback') { res.end('Not found'); return; }
        const c = parsed.query.code;
        if (!c) { res.end('No code'); reject(new Error('No code')); return; }
        res.end('<html><body style="font-family:sans-serif;padding:40px"><h2>✓ Authorized!</h2><p>Close this window.</p></body></html>');
        server.close();
        resolve(c);
      });
      server.listen(3456, '127.0.0.1');
    });

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    console.log('Token saved → ' + TOKEN_FILE);
  }

  const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
  console.log('\nUploading to YouTube (unlisted)...');

  const title = pkg.name + ' — California Coastal Tour · Du Lich Cali';
  const description = [
    'Book at: https://www.dulichcali21.com/travel.html?pkg=' + pkg.id,
    'Call: (408) 916-3439',
    '',
    'Highlights:',
    ...(pkg.highlights || []).map(h => '• ' + h.en),
    '',
    'Du Lich Cali — California tours & travel. Vietnamese-English bilingual guides.',
  ].join('\n');

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags:       ['California tour', 'coastal tour', 'Big Sur', 'Du Lich Cali', pkg.name],
        categoryId: '19', // Travel & Events
      },
      status: {
        privacyStatus:           'unlisted',
        selfDeclaredMadeForKids: false,
      },
    },
    media: { body: fs.createReadStream(outPath) },
  });

  const youtubeId = res.data.id;
  console.log('YouTube upload complete!');
  console.log('Video URL: https://www.youtube.com/watch?v=' + youtubeId);
  return youtubeId;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('Du Lich Cali — AI Cinematic Promo Generator');
  console.log('Package: ' + pkg.name);
  console.log('='.repeat(60));

  // ── Step 1: Claude generates narration + scene prompts ────────────────────
  let narration, scenes;
  if (skipClaude) {
    console.log('\n[1/4] Claude: skipped (--no-claude / --no-sora)');
    narration = pkg.name + ' — a California coastal adventure awaits. Book with Du Lich Cali.';
    scenes = Array(6).fill('');
  } else {
    ({ narration, scenes } = await generateScript(pkg));
  }

  // ── Step 2: Sora generates 6 clips in parallel ────────────────────────────
  console.log('\n[2/4] Sora: generating 6 × 5-second clips in parallel...');
  const clipFilenames = await Promise.all(
    scenes.map((prompt, i) => generateSoraClipWithRetry(prompt, i))
  );
  const successCount = clipFilenames.filter(Boolean).length;
  console.log('  ' + successCount + '/6 clips generated successfully');

  // ── Step 3: OpenAI TTS narration ─────────────────────────────────────────
  const narrationFilename = await generateTTS(narration);

  // ── Step 4: Download music ────────────────────────────────────────────────
  const musicFilename = await downloadMusic();

  // ── Step 5: Build Remotion props ─────────────────────────────────────────
  const remProps = {
    packageName:  pkg.name,
    tagline:      'California Coastal Experience · Du Lich Cali',
    durationDays: pkg.duration_days,
    priceGroup:   '$' + pkg.base_price_per_person_group + '/person',
    pricePrivate: '$' + pkg.base_price_private + ' private',
    highlights:   (pkg.highlights || []).map(h => h.en),
    itinerary:    (pkg.itinerary  || []).slice(0, 5).map(i => ({ time: i.time, desc: i.en })),
    heroImageUrl: '',
    accentColor:  '#d4af37',
    phone:        '(408) 916-3439',
    website:      'dulichcali21.com/travel',
    ctaText:      'Book Now',
    // AI-generated cinematic assets
    scenePaths:    clipFilenames,      // filenames in public/ (empty = navy fallback)
    narrationPath: narrationFilename, // filename in public/
    musicPath:     musicFilename,     // filename in public/
  };

  // ── Step 6: Remotion render ───────────────────────────────────────────────
  const outPath  = path.join(OUT_DIR, pkgId + '.mp4');
  const propsStr = JSON.stringify(remProps);

  console.log('\n[Remotion] Rendering 900-frame 1920×1080 composition...');
  console.log('Output → ' + outPath + '\n');

  try {
    execSync(
      'npx remotion render TravelPromo --output=' + JSON.stringify(outPath) +
      ' --props=' + JSON.stringify(propsStr),
      { cwd: SCRIPT_DIR, stdio: 'inherit' }
    );
  } catch (e) {
    console.error('Render failed:', e.message);
    process.exit(1);
  }

  console.log('\nRender complete → ' + outPath);

  // ── Step 7: YouTube upload ────────────────────────────────────────────────
  if (skipYT) {
    console.log('\n--no-youtube: skipping upload. Done!');
    process.exit(0);
  }

  const youtubeId = await uploadToYouTube(outPath);

  // ── Step 8: Firestore update ──────────────────────────────────────────────
  if (!skipFS) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId:  'dulichcali-booking-calendar',
      });
    }
    const db = admin.firestore();
    await db.collection('travel_packages').doc(pkgId).update({
      youtubeId,
      promo_video_url:       'https://www.youtube.com/watch?v=' + youtubeId,
      youtube_thumbnail_url: 'https://img.youtube.com/vi/' + youtubeId + '/hqdefault.jpg',
      videoUpdatedAt:        admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Firestore updated: travel_packages/' + pkgId + '.youtubeId = ' + youtubeId);
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error('\nFatal error:', err.message || err);
  process.exit(1);
});
