#!/usr/bin/env node
/**
 * Du Lich Cali — YouTube Upload Tool
 * ------------------------------------
 * Uses YouTube Data API v3 with OAuth 2.0 (Desktop App flow).
 *
 * First run:  Opens browser for Google consent → saves token.json
 * Later runs: Reads token.json, auto-refreshes access token as needed
 *
 * Usage:
 *   node upload.js --dry-run                         # verify auth only, no upload
 *   node upload.js --file clip.mp4                   # upload (private by default)
 *   node upload.js --file clip.mp4 --public          # upload as public
 *   node upload.js --file clip.mp4 --title "..." --description "..."
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const url  = require('url');
const readline = require('readline');
const { google } = require('googleapis');

// ── Paths ────────────────────────────────────────────────────────────────────
const DIR             = __dirname;
const CREDENTIALS_PATH = path.join(DIR, 'client_secret.json');
const TOKEN_PATH       = path.join(DIR, 'token.json');

// ── Scopes ───────────────────────────────────────────────────────────────────
// upload.readonly lets us verify access without touching uploads
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

// ── Arg parsing ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { dryRun: false, file: null, title: null, description: null, privacy: 'private' };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--dry-run':    args.dryRun = true; break;
      case '--public':     args.privacy = 'public'; break;
      case '--unlisted':   args.privacy = 'unlisted'; break;
      case '--file':        args.file = argv[++i]; break;
      case '--title':       args.title = argv[++i]; break;
      case '--description': args.description = argv[++i]; break;
    }
  }
  return args;
}

// ── Credential loader ────────────────────────────────────────────────────────
function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('\n❌  client_secret.json not found.');
    console.error('    Download it from Google Cloud Console → APIs & Services → Credentials');
    console.error('    Save it as:  scripts/youtube/client_secret.json\n');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  // Google Desktop App credentials use "installed" key
  const creds = raw.installed || raw.web;
  if (!creds) {
    console.error('❌  client_secret.json does not look like a valid OAuth client file.');
    process.exit(1);
  }
  return creds;
}

// ── OAuth2 client ────────────────────────────────────────────────────────────
function buildOAuth2Client(creds) {
  return new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    'http://localhost:3456/callback'   // must be in OAuth client's redirect URIs
  );
}

// ── Token persistence ────────────────────────────────────────────────────────
function saveToken(oAuth2Client) {
  const token = oAuth2Client.credentials;
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
  console.log('  ✓  Token saved to token.json');
}

function loadToken(oAuth2Client) {
  if (!fs.existsSync(TOKEN_PATH)) return false;
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);
    return true;
  } catch (_) {
    return false;
  }
}

// ── Browser-based consent flow ────────────────────────────────────────────────
async function runConsentFlow(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',  // always request refresh_token
  });

  console.log('\n🔐  AUTHORIZATION REQUIRED');
  console.log('─'.repeat(60));
  console.log('  Open this URL in your browser:\n');
  console.log('  ' + authUrl);
  console.log('\n  Waiting for you to approve access...');
  console.log('  (A local server is listening at http://localhost:3456/callback)');

  // Try to open browser automatically (optional — works on macOS)
  try {
    require('child_process').exec(`open "${authUrl}"`);
  } catch (_) {}

  // Local HTTP server to receive the redirect with the auth code
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url, true);
      if (parsed.pathname !== '/callback') { res.end('Not found'); return; }
      const code = parsed.query.code;
      if (!code) { res.end('No code received.'); reject(new Error('No code')); return; }
      res.end('<html><body style="font-family:sans-serif;padding:40px">'
        + '<h2 style="color:#0d2f50">✓ Authorization successful!</h2>'
        + '<p>You can close this window and return to the terminal.</p>'
        + '</body></html>');
      server.close();
      resolve(code);
    });
    server.listen(3456, '127.0.0.1', () => {});
    server.on('error', reject);
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  saveToken(oAuth2Client);
  console.log('\n  ✅  Authorization complete.\n');
}

// ── Ensure valid auth ─────────────────────────────────────────────────────────
async function authorize(oAuth2Client) {
  if (loadToken(oAuth2Client)) {
    // Auto-refresh if expired
    const expiry = oAuth2Client.credentials.expiry_date;
    if (expiry && Date.now() > expiry - 60_000) {
      console.log('  ↻  Access token expired — refreshing...');
      const { credentials } = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(credentials);
      saveToken(oAuth2Client);
    } else {
      console.log('  ✓  Token loaded from token.json');
    }
  } else {
    await runConsentFlow(oAuth2Client);
  }
}

// ── Dry run ───────────────────────────────────────────────────────────────────
async function dryRun(oAuth2Client) {
  console.log('\n🔍  DRY RUN — verifying auth and channel access...\n');

  const yt = google.youtube({ version: 'v3', auth: oAuth2Client });
  const res = await yt.channels.list({
    part: ['snippet', 'statistics'],
    mine: true,
  });

  const channels = res.data.items;
  if (!channels || channels.length === 0) {
    console.error('❌  No YouTube channel found for this account.');
    process.exit(1);
  }

  const ch = channels[0];
  console.log('  ✅  Auth verified. Channel access confirmed:\n');
  console.log(`     Channel ID   : ${ch.id}`);
  console.log(`     Channel Name : ${ch.snippet.title}`);
  console.log(`     Subscribers  : ${Number(ch.statistics.subscriberCount || 0).toLocaleString()}`);
  console.log(`     Videos       : ${Number(ch.statistics.videoCount || 0).toLocaleString()}`);
  console.log(`     Description  : ${(ch.snippet.description || '(none)').slice(0, 80)}`);
  console.log('\n  ✓  Ready to upload. Run with --file to upload a clip.\n');
}

// ── Upload ────────────────────────────────────────────────────────────────────
async function uploadVideo(oAuth2Client, args) {
  const filePath = path.resolve(args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌  File not found: ${filePath}`);
    process.exit(1);
  }

  const stats    = fs.statSync(filePath);
  const sizeMB   = (stats.size / 1024 / 1024).toFixed(1);
  const basename = path.basename(filePath);

  const title       = args.title       || `Du Lich Cali — ${basename.replace(/\.[^.]+$/, '')}`;
  const description = args.description || 'Du Lich Cali — Vietnamese-American travel services in California.\nhttps://www.dulichcali21.com';
  const privacy     = args.privacy; // 'private' | 'unlisted' | 'public'

  console.log(`\n📹  Uploading video:`);
  console.log(`     File     : ${filePath}`);
  console.log(`     Size     : ${sizeMB} MB`);
  console.log(`     Title    : ${title}`);
  console.log(`     Privacy  : ${privacy}`);
  console.log('');

  const yt = google.youtube({ version: 'v3', auth: oAuth2Client });

  const fileStream = fs.createReadStream(filePath);

  const res = await yt.videos.insert(
    {
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
          tags:        ['Du Lich Cali', 'Vietnamese', 'California', 'travel'],
          categoryId:  '19',   // Travel & Events
          defaultLanguage: 'vi',
        },
        status: {
          privacyStatus:       privacy,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fileStream,
      },
    },
    {
      onUploadProgress: (evt) => {
        const done = Math.round((evt.bytesRead / stats.size) * 100);
        process.stdout.write(`\r  Uploading... ${done}%   `);
      },
    }
  );

  process.stdout.write('\n');
  const video = res.data;
  console.log(`\n  ✅  Upload complete!`);
  console.log(`     Video ID : ${video.id}`);
  console.log(`     URL      : https://studio.youtube.com/video/${video.id}/edit`);
  console.log(`     Privacy  : ${privacy}`);
  if (privacy !== 'public') {
    console.log(`\n  ℹ️   Video is ${privacy}. Change visibility in YouTube Studio when ready.\n`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  if (!args.dryRun && !args.file) {
    console.log('\nUsage:');
    console.log('  node upload.js --dry-run                    # verify auth only');
    console.log('  node upload.js --file <path>                # upload (private)');
    console.log('  node upload.js --file <path> --public       # upload as public');
    console.log('  node upload.js --file <path> --title "..." --description "..."');
    console.log('');
    process.exit(0);
  }

  const creds       = loadCredentials();
  const oAuth2Client = buildOAuth2Client(creds);

  await authorize(oAuth2Client);

  if (args.dryRun) {
    await dryRun(oAuth2Client);
  } else {
    await uploadVideo(oAuth2Client, args);
  }
}

main().catch((err) => {
  console.error('\n❌  Error:', err.message || err);
  if (err.response && err.response.data) {
    console.error('    API response:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
