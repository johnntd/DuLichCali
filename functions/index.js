'use strict';

/**
 * DuLichCali — Firebase Cloud Functions
 *
 * Functions:
 *  1. onVendorNotification  — Twilio SMS on new vendor notification
 *  2. aiOrchestrate         — Secure server-side AI orchestration proxy
 *
 * Secrets (Google Cloud Secret Manager):
 *   SMS:  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *   AI:   OPENAI_API_KEY, GEMINI_API_KEY, CLAUDE_API_KEY
 *
 * Set secrets once with:
 *   firebase functions:secrets:set TWILIO_ACCOUNT_SID
 *   firebase functions:secrets:set OPENAI_API_KEY
 *   firebase functions:secrets:set GEMINI_API_KEY
 *   firebase functions:secrets:set CLAUDE_API_KEY
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall }            = require('firebase-functions/v2/https');
const { defineSecret }      = require('firebase-functions/params');
const admin                 = require('firebase-admin');
const twilio                = require('twilio');
const https                 = require('https');
const os                    = require('os');
const path                  = require('path');
const fs                    = require('fs');
const ffmpegPath            = require('ffmpeg-static');
const ffmpeg                = require('fluent-ffmpeg');

// ── Secrets (Google Cloud Secret Manager) ────────────────────────────────────
// These are injected at runtime — never stored in code or .env files.
const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN  = defineSecret('TWILIO_AUTH_TOKEN');
const TWILIO_FROM_NUMBER = defineSecret('TWILIO_FROM_NUMBER');

// AI provider secrets
const OPENAI_API_KEY  = defineSecret('OPENAI_API_KEY');
const GEMINI_API_KEY  = defineSecret('GEMINI_API_KEY');
const CLAUDE_API_KEY  = defineSecret('CLAUDE_API_KEY');

// ── Firebase Admin ────────────────────────────────────────────────────────────
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── Twilio error codes that are fatal (don't retry) ──────────────────────────
const FATAL_TWILIO_CODES = new Set([
  20003,  // Authentication failed
  21211,  // Invalid 'To' phone number
  21608,  // Unverified number (trial account restriction)
  21610,  // Message blocked — recipient opted out (STOP)
  21612,  // Cannot route to the 'To' number
  21614,  // 'To' number is not a mobile number
  21617,  // The concatenated message is too long
]);

// ── Main Cloud Function ───────────────────────────────────────────────────────
exports.onVendorNotification = onDocumentCreated(
  {
    document:       'vendors/{vendorId}/notifications/{notificationId}',
    region:         'us-central1',
    secrets:        [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER],
    timeoutSeconds: 60,
    // retry: false — we handle retries internally with idempotency.
    // Cloud-level retry is left off to prevent potential double-sends on function
    // crashes that happen AFTER a successful Twilio call but BEFORE the Firestore write.
    retry: false,
  },
  async (event) => {
    const { vendorId, notificationId } = event.params;
    const notifRef = event.data.ref;
    const log = (msg, ...args) =>
      console.log(`[sms][${vendorId}/${notificationId}] ${msg}`, ...args);

    log('triggered');

    // ── Idempotency: live-read current doc state ───────────────────────────────
    // event.data.data() is the state AT TRIGGER TIME, which won't reflect a
    // previous partial run. Read current state to guard against any double-send.
    const currentSnap = await notifRef.get();
    const currentData = currentSnap.data() || {};

    if (currentData.smsSent === true || currentData.smsStatus === 'sent') {
      log('already sent — idempotency skip');
      return;
    }

    // Use trigger-time data for the notification payload
    const notifData = event.data.data();

    // ── Load vendor doc ────────────────────────────────────────────────────────
    const vendorSnap = await db.collection('vendors').doc(vendorId).get();
    if (!vendorSnap.exists) {
      log('vendor doc not found');
      await notifRef.update({
        smsSent:       false,
        smsStatus:     'skipped',
        smsSkipReason: 'vendor_not_found',
      });
      return;
    }
    const vendor = vendorSnap.data();

    // ── Check SMS opt-in ───────────────────────────────────────────────────────
    if (!vendor.smsEnabled) {
      log('smsEnabled=false — skipping');
      await notifRef.update({ smsSent: false, smsStatus: 'skipped', smsSkipReason: 'sms_disabled' });
      return;
    }
    if (!vendor.notificationPhone) {
      log('no notificationPhone — skipping');
      await notifRef.update({ smsSent: false, smsStatus: 'skipped', smsSkipReason: 'no_phone' });
      return;
    }

    // ── Validate Twilio credentials ────────────────────────────────────────────
    const accountSid = TWILIO_ACCOUNT_SID.value();
    const authToken  = TWILIO_AUTH_TOKEN.value();
    const fromNumber = TWILIO_FROM_NUMBER.value();

    if (!accountSid || !authToken || !fromNumber) {
      const missing = [
        !accountSid  ? 'TWILIO_ACCOUNT_SID'  : null,
        !authToken   ? 'TWILIO_AUTH_TOKEN'   : null,
        !fromNumber  ? 'TWILIO_FROM_NUMBER'  : null,
      ].filter(Boolean).join(', ');
      log('missing secrets:', missing);
      await notifRef.update({
        smsSent:   false,
        smsStatus: 'failed',
        smsError:  `Missing Secret Manager secrets: ${missing}`,
      });
      return;
    }

    // ── Build SMS body ─────────────────────────────────────────────────────────
    const body = buildSmsBody(notifData, vendor);
    log(`sending to ${vendor.notificationPhone}: "${body.split('\n')[0]}..."`);

    // ── Build message params ───────────────────────────────────────────────────
    // If TWILIO_FROM_NUMBER starts with 'MG' it's a Messaging Service SID
    // (required for A2P 10DLC compliance on US long codes).
    // Otherwise treat it as a plain E.164 phone number.
    const msgParams = fromNumber.startsWith('MG')
      ? { messagingServiceSid: fromNumber, to: vendor.notificationPhone, body }
      : { from: fromNumber,               to: vendor.notificationPhone, body };

    // ── Send with in-function retry (3 attempts, short backoff) ───────────────
    const client      = twilio(accountSid, authToken);
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const msg = await client.messages.create(msgParams);

        // Twilio should always return a SID on success
        if (!msg.sid) {
          throw new Error('Twilio returned no message SID');
        }

        log(`sent on attempt ${attempt} — sid=${msg.sid}`);
        await notifRef.update({
          smsSent:       true,
          smsStatus:     'sent',
          smsMessageSid: msg.sid,
          smsSentAt:     admin.firestore.FieldValue.serverTimestamp(),
          smsAttempts:   attempt,
          smsTo:         vendor.notificationPhone,
          // Clear any previous error if retried
          smsError:      admin.firestore.FieldValue.delete(),
        });
        return; // success — done

      } catch (err) {
        const errMsg  = err?.message   || String(err);
        const errCode = err?.code      || null;   // Twilio error code (21211, etc.)
        const errStatus = err?.status  || null;   // HTTP status (400, 401, 429, etc.)

        log(`attempt ${attempt}/${maxAttempts} failed: [${errCode || errStatus}] ${errMsg}`);

        // ── Detect fatal errors (no point retrying) ──────────────────────────
        const isFatal =
          FATAL_TWILIO_CODES.has(errCode) ||
          errStatus === 401 ||  // auth failure
          errStatus === 403;    // forbidden

        if (isFatal) {
          log(`fatal error — not retrying`);
          await notifRef.update({
            smsSent:     false,
            smsStatus:   'failed',
            smsError:    `Twilio ${errCode ? `code ${errCode}` : `HTTP ${errStatus}`}: ${errMsg}`,
            smsAttempts: attempt,
            smsTo:       vendor.notificationPhone,
          });
          return;
        }

        // ── Retryable — wait then loop ────────────────────────────────────────
        if (attempt < maxAttempts) {
          const delayMs = attempt === 1 ? 2000 : 6000; // 2s → 6s
          log(`retrying in ${delayMs}ms`);
          await sleep(delayMs);
        }
      }
    }

    // ── All attempts exhausted ─────────────────────────────────────────────────
    log(`all ${maxAttempts} attempts failed`);
    await notifRef.update({
      smsSent:     false,
      smsStatus:   'failed',
      smsError:    `Failed after ${maxAttempts} attempts`,
      smsAttempts: maxAttempts,
      smsTo:       vendor.notificationPhone,
    });
  }
);

// ── SMS body builder ──────────────────────────────────────────────────────────
// Keeps text in GSM-7 charset (no emoji, no Vietnamese diacritics in body)
// to avoid UCS-2 encoding which halves per-segment character limits.
// 160 chars per segment in GSM-7 vs 70 in UCS-2.
//
// Example output:
//   [Nha Bep Cua Emily] Don hang moi!
//   KH: Nguyen Van An | 408-555-1234
//   SP: Cha Gio (Raw) x50 - $37.50
//   Ngay: T7 5/4
//   Xem: dulichcali21.com/vendor-admin

function buildSmsBody(notif, vendor) {
  const shopName  = stripDiacritics(vendor.businessName || 'DuLichCali');
  const lines     = [];

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push(`[${shopName}] Don hang moi!`);

  // ── Customer ──────────────────────────────────────────────────────────────
  const name  = stripDiacritics(notif.customerName || 'Khach hang');
  const phone = notif.customerPhone ? ` | ${notif.customerPhone}` : '';
  lines.push(`KH: ${name}${phone}`);

  // ── Item / service ────────────────────────────────────────────────────────
  const item = stripDiacritics(notif.itemName || notif.message || '');
  const qty  = notif.quantity ? ` x${notif.quantity}` : '';
  const amt  = notif.subtotal ? ` - $${Number(notif.subtotal).toFixed(2)}` : '';
  if (item) lines.push(`SP: ${item}${qty}${amt}`);

  // ── Requested date ────────────────────────────────────────────────────────
  if (notif.requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(notif.requestedDate)) {
    const d    = new Date(notif.requestedDate + 'T12:00:00');
    const DOW  = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    lines.push(`Ngay: ${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`);
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (notif.notes) {
    const notes = stripDiacritics(notif.notes).slice(0, 60); // cap length
    lines.push(`Note: ${notes}`);
  }

  // ── Dashboard link ────────────────────────────────────────────────────────
  lines.push('Xem: dulichcali21.com/vendor-admin');

  return lines.join('\n');
}

// ── Strip Vietnamese diacritics → ASCII for GSM-7 compatibility ───────────────
function stripDiacritics(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove combining diacritics
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

// ── Utility: promise-based sleep ──────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ══════════════════════════════════════════════════════════════════════════════
//  AI ORCHESTRATION — Secure server-side proxy
//
//  Called by the browser via: firebase.functions().httpsCallable('aiOrchestrate')
//  Keeps API keys in Google Cloud Secret Manager, not exposed to the browser.
//
//  Request format: { taskType: string, payload: object }
//  Response format: standard orchestrator result object (see aiOrchestrator.js)
//
//  To add a new AI provider: extend PROVIDER_ROUTES and add a callXxx() helper.
// ══════════════════════════════════════════════════════════════════════════════

const AI_ROUTES = {
  'chat.general':        { primary: 'claude',  fallback: 'openai'  },
  'chat.marketplace':    { primary: 'claude',  fallback: 'openai'  },
  'booking.create':      { primary: 'claude',  fallback: 'openai'  },
  'booking.analyze':     { primary: 'claude',  fallback: 'openai'  },
  'travel.plan':         { primary: 'claude',  fallback: 'gemini'  },
  'content.generate':    { primary: 'openai',  fallback: 'claude'  },
  'content.ad_copy':     { primary: 'openai',  fallback: 'claude'  },
  'video.script':        { primary: 'openai',  fallback: 'claude'  },
  'search.web':          { primary: 'gemini',  fallback: 'openai'  },
  'image.analyze':       { primary: 'gemini',  fallback: null      },
  'support.classify':    { primary: 'claude',  fallback: 'openai'  },
  'support.draft_reply': { primary: 'claude',  fallback: 'openai'  },
};

/**
 * Simple HTTPS fetch wrapper for Node.js (no external SDK needed).
 * Returns response body as string.
 */
function httpsPost(hostname, path, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const req  = https.request(
      { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers } },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function serverCallClaude(system, userContent, jsonMode, claudeKey, maxTokens) {
  const sysPrompt = jsonMode ? system + '\n\nRespond ONLY with valid JSON. No markdown.' : system;
  const raw = await httpsPost('api.anthropic.com', '/v1/messages',
    { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
    { model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens || 1200, system: sysPrompt,
      messages: [{ role: 'user', content: userContent }] }
  );
  const d = JSON.parse(raw);
  return d.content[0].text;
}

async function serverCallOpenAI(system, userContent, jsonMode, openaiKey, maxTokens) {
  const sysPrompt = jsonMode ? system + '\n\nRespond ONLY with valid JSON.' : system;
  const body = { model: 'gpt-4o-mini', max_tokens: maxTokens || 1200,
    messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userContent }] };
  if (jsonMode) body.response_format = { type: 'json_object' };
  const raw = await httpsPost('api.openai.com', '/v1/chat/completions',
    { 'Authorization': `Bearer ${openaiKey}` }, body);
  const d = JSON.parse(raw);
  return d.choices[0].message.content;
}

async function serverCallGemini(prompt, geminiKey) {
  const raw = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
    {},
    { contents: [{ parts: [{ text: prompt }] }] }
  );
  const d = JSON.parse(raw);
  return d.candidates[0].content.parts[0].text;
}

exports.aiOrchestrate = onCall(
  {
    region: 'us-central1',
    secrets: [OPENAI_API_KEY, GEMINI_API_KEY, CLAUDE_API_KEY],
    timeoutSeconds: 60,
    cors: true,
  },
  async (request) => {
    const { taskType, payload } = request.data || {};
    if (!taskType) throw new Error('taskType is required');

    const route = AI_ROUTES[taskType];
    if (!route) throw new Error(`Unknown taskType: ${taskType}`);

    const t0        = Date.now();
    const jsonMode  = !['chat.general','chat.marketplace','support.draft_reply'].includes(taskType);
    const userContent = typeof payload === 'string' ? payload : JSON.stringify(payload || {});

    // Simple system prompt — for full task prompts use aiOrchestrator.js client-side
    const system = `You are an AI assistant for Du Lịch Cali, a Vietnamese-American travel and marketplace service. Task: ${taskType}. Be concise and accurate.`;

    const claudeKey = CLAUDE_API_KEY.value();
    const openaiKey = OPENAI_API_KEY.value();
    const geminiKey = GEMINI_API_KEY.value();

    const providerFns = {
      claude: () => serverCallClaude(system, userContent, jsonMode, claudeKey),
      openai: () => serverCallOpenAI(system, userContent, jsonMode, openaiKey),
      gemini: () => serverCallGemini(system + '\n\n' + userContent, geminiKey),
    };

    let rawText, usedProvider, error = null;

    try {
      rawText      = await providerFns[route.primary]();
      usedProvider = route.primary;
    } catch (primaryErr) {
      console.warn(`[aiOrchestrate] ${route.primary} failed for ${taskType}:`, primaryErr.message);
      if (route.fallback && providerFns[route.fallback]) {
        try {
          rawText      = await providerFns[route.fallback]();
          usedProvider = route.fallback;
        } catch (fallbackErr) {
          error = `${route.primary}: ${primaryErr.message} | ${route.fallback}: ${fallbackErr.message}`;
        }
      } else {
        error = primaryErr.message;
      }
    }

    if (error) {
      return { intent: taskType, data: null, ui_response: '', confidence: 0, provider: null, latency_ms: Date.now() - t0, error };
    }

    let data;
    if (jsonMode) {
      try {
        const clean = rawText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
        data = JSON.parse(clean);
      } catch (_) {
        data = { raw: rawText };
      }
    } else {
      data = { text: rawText };
    }

    return {
      intent:      taskType,
      data,
      ui_response: data.ui_response || (data.text ? data.text.slice(0, 200) : ''),
      confidence:  data.confidence  || 0.9,
      provider:    usedProvider,
      latency_ms:  Date.now() - t0,
      error:       null,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
//  AI PROXY — Thin relay for vendor dashboard marketing content generation
//
//  Called by marketingEngine.js when no local dev key is present.
//  Accepts: { provider, system, messages, maxTokens, jsonMode }
//  Returns: { ok: true, text } | { ok: false, vendorMessage, debugCode }
//
//  Auth required — vendor must be logged in via Firebase Auth.
// ══════════════════════════════════════════════════════════════════════════════

exports.aiProxy = onCall(
  {
    region: 'us-central1',
    secrets: [OPENAI_API_KEY, GEMINI_API_KEY, CLAUDE_API_KEY],
    timeoutSeconds: 55,
    cors: true,
  },
  async (request) => {
    // ── Auth gate ───────────────────────────────────────────────────────────
    if (!request.auth) {
      return { ok: false, vendorMessage: 'Vui lòng đăng nhập lại để sử dụng AI.', debugCode: 'UNAUTHENTICATED' };
    }

    const { provider, system, messages, maxTokens, jsonMode } = request.data || {};

    if (!provider || !system) {
      return { ok: false, vendorMessage: 'Yêu cầu không hợp lệ.', debugCode: 'INVALID_REQUEST' };
    }

    const claudeKey = CLAUDE_API_KEY.value();
    const openaiKey = OPENAI_API_KEY.value();
    const geminiKey = GEMINI_API_KEY.value();

    // Build user content from messages array
    const userContent = (messages || []).map(m => m.content).join('\n') || 'Generate content.';
    const mt = maxTokens || 1000;

    try {
      let text;

      if (provider === 'claude') {
        if (!claudeKey) return { ok: false, vendorMessage: 'Dịch vụ AI tạm thời không khả dụng.', debugCode: 'NO_CLAUDE_KEY' };
        text = await serverCallClaude(system, userContent, jsonMode !== false, claudeKey, mt);
      } else if (provider === 'openai') {
        if (!openaiKey) return { ok: false, vendorMessage: 'Dịch vụ AI tạm thời không khả dụng.', debugCode: 'NO_OPENAI_KEY' };
        text = await serverCallOpenAI(system, userContent, jsonMode !== false, openaiKey, mt);
      } else if (provider === 'gemini') {
        if (!geminiKey) return { ok: false, vendorMessage: 'Dịch vụ AI tạm thời không khả dụng.', debugCode: 'NO_GEMINI_KEY' };
        const prompt = system + '\n\nRespond ONLY with valid JSON.\n\n' + userContent;
        text = await serverCallGemini(prompt, geminiKey);
      } else {
        return { ok: false, vendorMessage: 'Nhà cung cấp AI không được hỗ trợ.', debugCode: 'UNKNOWN_PROVIDER' };
      }

      return { ok: true, text };

    } catch (err) {
      console.error(`[aiProxy] ${provider} error for uid=${request.auth.uid}:`, err.message);

      // Classify error for vendor-friendly messages
      const msg = err.message || '';
      let vendorMessage = 'AI không phản hồi. Vui lòng thử lại sau.';
      let debugCode = 'AI_ERROR';

      if (/rate.?limit|429/i.test(msg)) {
        vendorMessage = 'AI đang bận. Vui lòng thử lại sau 30 giây.';
        debugCode = 'RATE_LIMIT';
      } else if (/401|unauthorized|invalid.*key/i.test(msg)) {
        vendorMessage = 'Lỗi xác thực dịch vụ AI. Liên hệ hỗ trợ.';
        debugCode = 'AUTH_ERROR';
      } else if (/timeout|ETIMEDOUT|ECONNRESET/i.test(msg)) {
        vendorMessage = 'AI mất quá nhiều thời gian. Vui lòng thử lại.';
        debugCode = 'TIMEOUT';
      } else if (/network|ENOTFOUND|fetch/i.test(msg)) {
        vendorMessage = 'Lỗi kết nối mạng. Kiểm tra internet và thử lại.';
        debugCode = 'NETWORK_ERROR';
      }

      return { ok: false, vendorMessage, debugCode };
    }
  }
);

// ── generateItemVideo ─────────────────────────────────────────────────────────
// Callable function: accepts {vendorId, itemId}
// Creates a 15-second promotional MP4 using ffmpeg, uploads to Firebase Storage,
// updates the menuItem document with videoUrl, and returns { ok, videoUrl }.
// Requires ffmpeg-static + fluent-ffmpeg in package.json.
exports.generateItemVideo = onCall(
  {
    region:         'us-central1',
    timeoutSeconds: 300,
    memory:         '2GiB',
    cors:           true,
  },
  async (request) => {
    if (!request.auth) {
      return { ok: false, error: 'Vui lòng đăng nhập lại.', debugCode: 'UNAUTHENTICATED' };
    }

    const { vendorId, itemId } = request.data || {};
    if (!vendorId || !itemId) {
      return { ok: false, error: 'Thiếu vendorId hoặc itemId.', debugCode: 'INVALID_REQUEST' };
    }

    // ── Load item + vendor data ─────────────────────────────────────────────────
    const itemRef = db.collection('vendors').doc(vendorId).collection('menuItems').doc(itemId);
    const [itemSnap, vendorSnap] = await Promise.all([
      itemRef.get(),
      db.collection('vendors').doc(vendorId).get(),
    ]);

    if (!itemSnap.exists) {
      return { ok: false, error: 'Không tìm thấy sản phẩm.', debugCode: 'NOT_FOUND' };
    }

    const item   = itemSnap.data();
    const vendor = vendorSnap.data() || {};

    const vendorName = vendor.businessName || 'Du Lịch Cali';
    const itemName   = item.displayNameVi || item.name || 'Sản phẩm';
    const price      = item.price != null ? '$' + Number(item.price).toFixed(2) : '';
    const unit       = item.unit || 'each';
    const minQty     = item.minimumOrderQty || 1;
    const imageUrl   = item.image || item.imageUrl || '';

    // ── Temp paths ─────────────────────────────────────────────────────────────
    const tmpDir     = os.tmpdir();
    const imgPath    = path.join(tmpDir, `dlc-vid-${itemId}-bg.jpg`);
    const outPath    = path.join(tmpDir, `dlc-vid-${itemId}.mp4`);
    const placeholderPath = path.join(tmpDir, `dlc-vid-${itemId}-bg-solid.png`);

    // Mark as generating in Firestore immediately (so admin UI can show spinner)
    await itemRef.update({
      videoStatus: 'generating',
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    try {
      // ── Download item image ───────────────────────────────────────────────────
      let bgInput = null;
      if (imageUrl) {
        try {
          await _downloadToFile(imageUrl, imgPath);
          bgInput = imgPath;
        } catch (dlErr) {
          console.warn('[generateItemVideo] image download failed:', dlErr.message);
        }
      }

      // If no image available, create a solid navy background via ffmpeg lavfi
      if (!bgInput) {
        bgInput = null; // signal to use lavfi color source
      }

      // ── Build price line ──────────────────────────────────────────────────────
      const variants = item.variants || [];
      let priceLine = price ? price + ' / ' + unit : '';
      const variantsWithPrice = variants.filter(v => v.price != null && v.price > 0);
      if (variantsWithPrice.length > 1) {
        priceLine = variantsWithPrice.map(v => {
          const lbl = (v.labelEn || v.label || '').split(/[\s\u2014\-]+/)[0];
          return '$' + Number(v.price).toFixed(2) + ' ' + lbl;
        }).join('  /  ');
      }

      const minLine = minQty > 1 ? 'Min. ' + minQty + ' ' + unit + 's' : '';
      const ctaLine = 'Dat hang ngay';  // ASCII safe for drawtext

      // ── Run ffmpeg ────────────────────────────────────────────────────────────
      await _renderPromoVideo({
        bgInput,
        outPath,
        vendorName,
        itemName,
        priceLine,
        minLine,
        ctaLine,
      });

      // ── Upload to Firebase Storage ────────────────────────────────────────────
      const bucket   = admin.storage().bucket();
      const destPath = `vendors/${vendorId}/videos/${Date.now()}-${itemId}.mp4`;

      await bucket.upload(outPath, {
        destination: destPath,
        metadata:    { contentType: 'video/mp4' },
        public:      true,
      });

      // Build public URL (no signed URL needed — file is public)
      const bucketName = bucket.name;
      const encodedPath = encodeURIComponent(destPath).replace(/%2F/g, '%2F');
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(destPath)}`;

      // Try to get a signed download URL instead (more robust)
      let videoUrl = publicUrl;
      try {
        const [signed] = await bucket.file(destPath).getSignedUrl({
          action:  'read',
          expires: '03-14-2100',
        });
        videoUrl = signed;
      } catch (signErr) {
        console.warn('[generateItemVideo] signed URL failed, using public URL:', signErr.message);
      }

      // ── Update Firestore ──────────────────────────────────────────────────────
      await itemRef.update({
        videoUrl:          videoUrl,
        videoStatus:       'ready',
        videoGeneratedAt:  admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:         admin.firestore.FieldValue.serverTimestamp(),
      });

      return { ok: true, videoUrl };

    } catch (err) {
      console.error('[generateItemVideo] error:', err.message, err.stack);
      await itemRef.update({ videoStatus: 'error', updatedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
      return { ok: false, error: 'Lỗi tạo video: ' + err.message, debugCode: 'RENDER_ERROR' };

    } finally {
      // Clean up temp files
      [imgPath, outPath, placeholderPath].forEach(f => {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
      });
    }
  }
);

// ── ffmpeg render helper ──────────────────────────────────────────────────────
function _renderPromoVideo({ bgInput, outPath, vendorName, itemName, priceLine, minLine, ctaLine }) {
  return new Promise((resolve, reject) => {
    // Font: use a built-in safe default
    // drawtext fontfile path is optional when using fontname on Linux
    const W = 1080, H = 1920, DUR = 15;

    // Sanitize text for ffmpeg drawtext (escape colons, single-quotes, backslashes)
    function esc(t) {
      return (t || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');
    }

    const vendorEsc = esc(vendorName);
    const itemEsc   = esc(itemName);
    const priceEsc  = esc(priceLine);
    const minEsc    = esc(minLine);
    const ctaEsc    = esc(ctaLine);

    // Build video filter chain
    // Layer 1: background (image scaled/cropped to 1080x1920, or solid navy)
    // Layer 2: dark gradient overlay (semi-transparent black, bottom-heavy)
    // Layer 3: text overlays

    const textFilters = [
      // Vendor name — top area, small
      `drawtext=text='${vendorEsc}':fontsize=44:fontcolor=0xFFD700:x=(w-text_w)/2:y=160:shadowcolor=black:shadowx=2:shadowy=2`,
      // Item name — center-top, large
      `drawtext=text='${itemEsc}':fontsize=92:fontcolor=white:x=(w-text_w)/2:y=820:shadowcolor=black:shadowx=3:shadowy=3`,
      // Price line
      ...(priceLine ? [`drawtext=text='${priceEsc}':fontsize=60:fontcolor=0xFFA500:x=(w-text_w)/2:y=940:shadowcolor=black:shadowx=2:shadowy=2`] : []),
      // Min order
      ...(minLine   ? [`drawtext=text='${minEsc}':fontsize=42:fontcolor=0xCCCCCC:x=(w-text_w)/2:y=1020:shadowcolor=black:shadowx=1:shadowy=1`] : []),
      // CTA bottom
      `drawtext=text='${ctaEsc}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=1680:box=1:boxcolor=0xE67E22@0.9:boxborderw=20:shadowcolor=black:shadowx=2:shadowy=2`,
    ].join(',');

    let cmd;
    if (bgInput) {
      // Use the provided image as background
      cmd = ffmpeg(bgInput)
        .inputOptions(['-loop 1'])
        .outputOptions([
          '-t', String(DUR),
          '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
                 `colorchannelmixer=rr=0.4:gg=0.4:bb=0.4,` +
                 `drawbox=x=0:y=h*0.6:w=iw:h=ih:color=black@0.55:t=fill,` +
                 textFilters,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-r', '25',
          '-an',
          '-movflags', '+faststart',
        ]);
    } else {
      // Solid navy background (no image)
      cmd = ffmpeg()
        .input(`color=c=0x0d2f50:s=${W}x${H}:r=25`)
        .inputFormat('lavfi')
        .outputOptions([
          '-t', String(DUR),
          '-vf', textFilters,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-r', '25',
          '-an',
          '-movflags', '+faststart',
        ]);
    }

    cmd
      .setFfmpegPath(ffmpegPath)
      .on('error', reject)
      .on('end', resolve)
      .save(outPath);
  });
}

// ── HTTPS download helper ─────────────────────────────────────────────────────
function _downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? require('https') : require('http');
    protocol.get(url, res => {
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      file.close();
      reject(err);
    });
  });
}

// ── uploadVendorImage — image upload proxy (bypasses Firebase Storage CORS) ───
// Accepts base64-encoded image, stores in GCS bucket, returns public URL.
// Bucket: dulichcali-vendor-images (CORS + public read already configured)
const IMAGE_BUCKET = 'dulichcali-vendor-images';

exports.uploadVendorImage = onCall(
  { region: 'us-central1', cors: true },
  async (request) => {
    if (!request.auth) {
      return { ok: false, error: 'Vui lòng đăng nhập lại.' };
    }

    const { vendorId, base64, fileName, mimeType } = request.data || {};
    if (!vendorId || !base64 || !fileName) {
      return { ok: false, error: 'Thiếu vendorId, base64, hoặc fileName.' };
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
    const gcsPath  = `vendors/${vendorId}/menu/${safeName}`;

    try {
      const bucket = admin.storage().bucket(IMAGE_BUCKET);
      const file   = bucket.file(gcsPath);
      const buffer = Buffer.from(base64, 'base64');

      await file.save(buffer, {
        contentType: mimeType || 'image/jpeg',
        metadata:    { cacheControl: 'public, max-age=31536000' },
      });
      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${IMAGE_BUCKET}/${gcsPath}`;
      return { ok: true, url: publicUrl };
    } catch (err) {
      console.error('[uploadVendorImage] Error:', err);
      return { ok: false, error: err.message };
    }
  }
);
