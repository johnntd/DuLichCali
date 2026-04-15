#!/usr/bin/env node
/**
 * generate-travel-promo.js
 * ─────────────────────────
 * Render a TravelPromo video, optionally upload to YouTube, and update Firestore.
 *
 * Usage:
 *   node generate-travel-promo.js --pkg big_sur_monterey_1_day
 *   node generate-travel-promo.js --pkg highway_1_classic_2_day --image /path/to/hero.jpg
 *   node generate-travel-promo.js --pkg coastal_premium_3_day --no-youtube
 *
 * Flags:
 *   --pkg <id>         Package slug from DLC_TRAVEL_PACKAGES (required)
 *   --image <path>     Hero image — copied into public/ before rendering
 *   --no-youtube       Skip YouTube upload (render only)
 *   --no-firestore     Skip Firestore youtubeId update
 *   --help
 *
 * First-time YouTube auth:
 *   1. Enable YouTube Data API v3 in Google Cloud Console
 *   2. Create OAuth2 Desktop credentials → download → save as client_secret.json in this dir
 *   3. Run the script — it will open a browser auth URL and prompt for the code
 *   4. token.json is saved for future runs
 *
 * Output: out/<pkg-id>.mp4
 */
'use strict';

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');
const readline     = require('readline');

const SCRIPT_DIR  = __dirname;
const PUBLIC_DIR  = path.join(SCRIPT_DIR, 'public');
const OUT_DIR     = path.join(SCRIPT_DIR, 'out');
const TOKEN_FILE  = path.join(SCRIPT_DIR, 'token.json');
const SECRET_FILE = path.join(SCRIPT_DIR, 'client_secret.json');

// ── Argument parsing ─────────────────────────────────────────────────────────
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
    '  --image <path>   Hero image path',
    '  --no-youtube     Skip YouTube upload',
    '  --no-firestore   Skip Firestore update',
  ].join('\n'));
  process.exit(0);
}

const pkgId     = flag('--pkg');
const imagePath = flag('--image');
const skipYT    = hasFlag('--no-youtube');
const skipFS    = hasFlag('--no-firestore');

if (!pkgId) { console.error('--pkg <id> is required'); process.exit(1); }

// ── Load package data ────────────────────────────────────────────────────────
const { DLC_TRAVEL_PACKAGES } = require('../travel-packages.js');
const pkg = DLC_TRAVEL_PACKAGES.find(p => p.id === pkgId || p.slug === pkgId);
if (!pkg) {
  console.error('Package not found: ' + pkgId);
  console.error('Available: ' + DLC_TRAVEL_PACKAGES.map(p => p.id).join(', '));
  process.exit(1);
}

// ── Prepare directories ──────────────────────────────────────────────────────
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR,    { recursive: true });

// ── Copy hero image into public/ ─────────────────────────────────────────────
let heroPublicPath = '';
if (imagePath) {
  const abs  = path.resolve(imagePath);
  const ext  = path.extname(imagePath) || '.jpg';
  const dest = path.join(PUBLIC_DIR, pkgId + '-hero' + ext);
  fs.copyFileSync(abs, dest);
  heroPublicPath = './' + pkgId + '-hero' + ext;
  console.log('Hero image copied → ' + dest);
}

// ── Build Remotion props ──────────────────────────────────────────────────────
const remProps = {
  packageName:  pkg.name,
  tagline:      'California Coastal Experience · Du Lich Cali',
  durationDays: pkg.duration_days,
  priceGroup:   '$' + pkg.base_price_per_person_group + '/person',
  pricePrivate: '$' + pkg.base_price_private + ' private',
  highlights:   (pkg.highlights || []).map(h => h.en),
  itinerary:    (pkg.itinerary  || []).slice(0, 5).map(item => ({ time: item.time, desc: item.en })),
  heroImageUrl: heroPublicPath,
  accentColor:  '#d4af37',
  phone:        '(408) 916-3439',
  website:      'dulichcali21.com/travel',
  ctaText:      'Book Now',
};

const outPath = path.join(OUT_DIR, pkgId + '.mp4');

// ── Render ────────────────────────────────────────────────────────────────────
console.log('\nRendering TravelPromo: ' + pkg.name);
console.log('Output: ' + outPath + '\n');

const propsStr = JSON.stringify(remProps);
const renderCmd = [
  'npx remotion render TravelPromo',
  '--output=' + outPath,
  '--props=' + JSON.stringify(propsStr),  // double-encode for shell safety
].join(' ');

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

if (skipYT) {
  console.log('--no-youtube: skipping upload');
  process.exit(0);
}

// ── YouTube upload ────────────────────────────────────────────────────────────
async function uploadToYouTube() {
  const { google } = require('googleapis');

  if (!fs.existsSync(SECRET_FILE)) {
    console.error([
      '',
      'client_secret.json not found at: ' + SECRET_FILE,
      '',
      'To set up YouTube upload:',
      '  1. Open Google Cloud Console → APIs & Services → Credentials',
      '  2. Create OAuth 2.0 Client ID (Desktop app)',
      '  3. Download JSON → rename to client_secret.json → place in remotion-promo/',
      '  4. Run this script again',
    ].join('\n'));
    process.exit(1);
  }

  const secret = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8'));
  const creds  = secret.installed || secret.web;
  const { client_id, client_secret, redirect_uris } = creds;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_FILE)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')));
    // Refresh token if needed
    try { await oAuth2Client.getAccessToken(); } catch (_) {}
  } else {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload'],
    });
    console.log('\nOpen this URL in your browser to authorize YouTube access:');
    console.log('\n  ' + authUrl + '\n');

    const rl   = readline.createInterface({ input: process.stdin, output: process.stdout });
    const code = await new Promise(res => rl.question('Paste the auth code here: ', c => { rl.close(); res(c.trim()); }));
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    console.log('Token saved → ' + TOKEN_FILE);
  }

  const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });

  console.log('\nUploading to YouTube (unlisted)...');
  const title       = pkg.name + ' — California Coastal Tour · Du Lich Cali';
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
        tags:       ['California tour', 'coastal tour', 'Big Sur', 'Monterey', 'Du Lich Cali', pkg.name],
        categoryId: '19', // Travel & Events
      },
      status: {
        privacyStatus:           'unlisted',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(outPath),
    },
  });

  const youtubeId = res.data.id;
  console.log('YouTube upload complete!');
  console.log('Video URL: https://www.youtube.com/watch?v=' + youtubeId);

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
      videoUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Firestore updated: travel_packages/' + pkgId + '.youtubeId = ' + youtubeId);
  }

  return youtubeId;
}

uploadToYouTube().catch(err => {
  console.error('\nUpload error:', err.message || err);
  process.exit(1);
});
