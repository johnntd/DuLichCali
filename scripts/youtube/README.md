# YouTube Upload Tool — Du Lich Cali

Reusable script for uploading promo/showcase clips to the Du Lich Cali YouTube channel.
Uses YouTube Data API v3 with OAuth 2.0. Defaults every upload to **private** for safety.

---

## One-time Setup (do this once)

### Step 1 — Enable YouTube Data API v3

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=dulichcali-booking-calendar)
2. Make sure project **dulichcali-booking-calendar** is selected (top-left dropdown)
3. Click **Enable**

### Step 2 — Create OAuth 2.0 Desktop App credentials

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=dulichcali-booking-calendar)
2. Click **+ Create Credentials → OAuth client ID**
3. Application type: **Desktop app**
4. Name: `DuLichCali YouTube Uploader`
5. Under **Authorized redirect URIs**, add: `http://localhost:3456/callback`
6. Click **Create**
7. Click **Download JSON** on the new credential
8. Save the file as **`scripts/youtube/client_secret.json`** (exact name required)

> `client_secret.json` is in `.gitignore` — it will never be committed.

### Step 3 — Configure OAuth consent screen (if not already done)

If prompted about the consent screen:
1. Go to [APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent?project=dulichcali-booking-calendar)
2. User Type: **External** (or Internal if using Google Workspace)
3. Add your Google account email as a **Test user**
4. Scopes: add `youtube.upload` and `youtube.readonly`

### Step 4 — Install dependencies

```bash
cd scripts/youtube
npm install
```

---

## Dry Run (verify auth — no upload)

```bash
cd scripts/youtube
node upload.js --dry-run
```

**First run:** A browser window opens for Google sign-in → approve access → `token.json` is saved locally.

**Output on success:**
```
  ✅  Auth verified. Channel access confirmed:

     Channel ID   : UCxxxxxxxxxxxxxxxxx
     Channel Name : Du Lich Cali
     Subscribers  : 1,234
     Videos       : 45

  ✓  Ready to upload. Run with --file to upload a clip.
```

> `token.json` is in `.gitignore` — it will never be committed.

---

## Upload a Video

```bash
# Upload as private (safe default)
node upload.js --file /path/to/clip.mp4

# Upload with custom title and description
node upload.js --file /path/to/clip.mp4 \
  --title "Nail Salon at Bay Area — Du Lich Cali" \
  --description "Professional nail services in the Bay Area.\nhttps://www.dulichcali21.com/nailsalon"

# Upload as unlisted (shareable link but not public)
node upload.js --file /path/to/clip.mp4 --unlisted

# Upload as public (only when ready)
node upload.js --file /path/to/clip.mp4 --public
```

**Output on success:**
```
  ✅  Upload complete!
     Video ID : dQw4w9WgXcQ
     URL      : https://studio.youtube.com/video/dQw4w9WgXcQ/edit
     Privacy  : private
```

---

## File Locations

| File | Status | Purpose |
|------|--------|---------|
| `upload.js` | ✅ Committed | Main upload script |
| `package.json` | ✅ Committed | Dependencies |
| `client_secret.json` | 🔒 Git-ignored | OAuth client credentials (download from Cloud Console) |
| `token.json` | 🔒 Git-ignored | Access + refresh token (auto-created on first auth) |
| `node_modules/` | 🔒 Git-ignored | npm packages |

---

## Re-authentication

If `token.json` is ever deleted or revoked:
1. Delete `scripts/youtube/token.json`
2. Run `node upload.js --dry-run` — the consent flow will re-run

---

## Default Upload Metadata

| Field | Default |
|-------|---------|
| Title | `Du Lich Cali — <filename without extension>` |
| Description | `Du Lich Cali — Vietnamese-American travel services in California.\nhttps://www.dulichcali21.com` |
| Category | Travel & Events (ID 19) |
| Language | Vietnamese (`vi`) |
| Tags | `Du Lich Cali`, `Vietnamese`, `California`, `travel` |
| Privacy | **private** |
| Made for kids | No |

Override any field with `--title`, `--description`, `--public`, `--unlisted`.

---

## Privacy Workflow

1. Upload with default (`--file clip.mp4`) → video is **private**
2. Review in [YouTube Studio](https://studio.youtube.com)
3. Change visibility to **Unlisted** to share a review link
4. Change to **Public** when approved

Never use `--public` on the first upload of a new clip.
