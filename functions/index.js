'use strict';

/**
 * DuLichCali — Firebase Cloud Functions
 *
 * Functions:
 *  1. onVendorNotification  — Twilio SMS on new vendor notification  [DISABLED — SMS_ENABLED=false]
 *  2. onRideNotification    — Twilio SMS to drivers on new ride       [DISABLED — SMS_ENABLED=false]
 *  3. onEmailQueue          — Booking confirmation emails via Resend  [ACTIVE]
 *  4. onInboundEmail        — Inbound email reply handler via Resend  [ACTIVE]
 *  5. aiOrchestrate         — Secure server-side AI orchestration proxy [ACTIVE]
 *
 * SMS STATUS: DISABLED as of 2026-04-17.
 *   A2P Sole Proprietor Messaging Service was generating repeated Outgoing API
 *   failures. Flip SMS_ENABLED = true (line ~72) only after Twilio is reprovisioned.
 *
 * Secrets (Google Cloud Secret Manager):
 *   SMS:   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER  (inactive until SMS_ENABLED=true)
 *   Email: RESEND_API_KEY, RESEND_WEBHOOK_SECRET
 *   AI:    OPENAI_API_KEY, GEMINI_API_KEY, CLAUDE_API_KEY
 */

const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const { defineSecret }      = require('firebase-functions/params');
const admin                 = require('firebase-admin');
const twilio                = require('twilio');
const https                 = require('https');
const os                    = require('os');
const path                  = require('path');
const fs                    = require('fs');
const ffmpegPath            = require('ffmpeg-static');
const ffmpeg                = require('fluent-ffmpeg');
// Pure, dependency-free Style Studio helpers (unit-tested in tests/unit/style-studio.test.js).
const StudioLib             = require('./style-studio-lib.js');

// ── Secrets (Google Cloud Secret Manager) ────────────────────────────────────
// These are injected at runtime — never stored in code or .env files.
const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN  = defineSecret('TWILIO_AUTH_TOKEN');
const TWILIO_FROM_NUMBER = defineSecret('TWILIO_FROM_NUMBER');

// AI provider secrets
const OPENAI_API_KEY  = defineSecret('OPENAI_API_KEY');
const GEMINI_API_KEY  = defineSecret('GEMINI_API_KEY');
const CLAUDE_API_KEY  = defineSecret('CLAUDE_API_KEY');
// Google Maps (Geocoding + Distance Matrix) — server-side ONLY. The key is never
// exposed to the frontend; the validateAddressAndDistance callable proxies it and
// degrades to a city/ZIP centroid haversine when the key is absent or Maps errors.
const GOOGLE_MAPS_API_KEY = defineSecret('GOOGLE_MAPS_API_KEY');
const _userPlaceSanitize = require('./lib/userPlaceSanitize.js');
const _placeMediaSanitize = require('./lib/placeMediaSanitize.js');

// Email provider secret (Resend — https://resend.com)
const RESEND_API_KEY      = defineSecret('RESEND_API_KEY');
// Shared token added to inbound webhook URL as ?token=VALUE so random POSTs are rejected.
// Set once:  firebase functions:secrets:set RESEND_WEBHOOK_SECRET
const RESEND_WEBHOOK_SECRET = defineSecret('RESEND_WEBHOOK_SECRET');

// Web Push (VAPID) — vendor portal PWA booking alerts. Public key is shipped in
// mobile-barber-pwa.js; private key set via: firebase functions:secrets:set VAPID_PRIVATE_KEY
const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY  = 'BBHEU_YqwysrntO1a6JPvWn8YSQmKumg6fcgLipNPcOVC-0LbZc8SU-1q0Nf_ilI7B3pFs_OXPCf-ajrSO8c0V8';

// ── Firebase Admin ────────────────────────────────────────────────────────────
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── AI provider keys (secured) ────────────────────────────────────────────────
// Keys are read from the SECURED Firestore doc `config/aiSecrets` (server-only:
// Firestore rules deny all client reads; the Admin SDK here bypasses rules),
// falling back to the Functions secrets. Cached ~5 min to avoid a read per call.
// This lets the keys live in "secured firestore" — never served to a browser.
let _aiKeyCache = { at: 0, keys: {} };
async function _loadFirestoreAiKeys() {
  const now = Date.now();
  if (now - _aiKeyCache.at < 5 * 60 * 1000) return _aiKeyCache.keys;
  let keys = {};
  try {
    const snap = await db.doc('config/aiSecrets').get();
    if (snap.exists) keys = snap.data() || {};
  } catch (e) { /* fall back to Functions secrets below */ }
  _aiKeyCache = { at: now, keys };
  return keys;
}
async function getAiKey(provider) {
  const k = await _loadFirestoreAiKeys();
  if (provider === 'claude') return String(k.claudeKey || k.aiKey || '') || CLAUDE_API_KEY.value();
  if (provider === 'openai') return String(k.openaiKey || '') || OPENAI_API_KEY.value();
  if (provider === 'gemini') return String(k.geminiKey || '') || GEMINI_API_KEY.value();
  return '';
}

// ── Travel dispatch service ───────────────────────────────────────────────────
const travelDispatch = require('./travelDispatch');

// ── SMS kill-switch ───────────────────────────────────────────────────────────
// Set to false to stop ALL outbound Twilio calls without removing the implementation.
// Current state: DISABLED — A2P Sole Proprietor Messaging Service was generating
// repeated Outgoing API failures (drivers: +14088596718, +14084397522, +17142276007).
// Flip to true only after Twilio account/messaging service is correctly reprovisioned.
const SMS_ENABLED = false;

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

    // ── SMS kill-switch ────────────────────────────────────────────────────────
    // Twilio outbound disabled 2026-04-17. A2P Messaging Service was generating
    // repeated Outgoing API failures. Re-enable SMS_ENABLED at top of file
    // only after Twilio account is correctly reprovisioned.
    if (!SMS_ENABLED) {
      log('SMS disabled — Twilio path intentionally disabled pending rebuild');
      await notifRef.update({
        smsSent:       false,
        smsStatus:     'disabled',
        smsSkipReason: 'sms_rebuild_pending',
      });
      return;
    }

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

// ══════════════════════════════════════════════════════════════════════════════
//  DRIVER RIDE ALERT — SMS to eligible drivers on new ride notification
//
//  Trigger:  client writes to rideNotifications/{notifId} with status='new'
//  Behavior: fetches each eligibleDriverId → gets phone → sends Twilio SMS.
//            Falls back to querying all active+compliant drivers when
//            eligibleDriverIds is empty (e.g. no browser-loaded driver data).
//  Idempotent: guards with driverSmsSent === true before sending.
// ══════════════════════════════════════════════════════════════════════════════
const AIRPORT_REGION_CF = {
  SFO:'bayarea', OAK:'bayarea', SJC:'bayarea', SMF:'bayarea',
  LAX:'socal', SNA:'socal', BUR:'socal', LGB:'socal', ONT:'socal',
  SAN:'sandiego', PSP:'palmsprings',
};

exports.onRideNotification = onDocumentCreated(
  {
    document:       'rideNotifications/{notifId}',
    region:         'us-central1',
    secrets:        [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER],
    timeoutSeconds: 60,
    retry:          false,
  },
  async (event) => {
    const { notifId } = event.params;
    const notifRef    = event.data.ref;
    const log = (msg) => console.log(`[driver-sms][${notifId}] ${msg}`);

    log('triggered');

    // ── SMS kill-switch ────────────────────────────────────────────────────────
    // Twilio outbound disabled 2026-04-17. Driver SMS was generating repeated
    // Outgoing API failures via A2P Messaging Service. Re-enable SMS_ENABLED at
    // top of file only after Twilio account is correctly reprovisioned.
    if (!SMS_ENABLED) {
      log('SMS disabled — Twilio path intentionally disabled pending rebuild');
      await notifRef.update({
        driverSmsSent:       false,
        driverSmsStatus:     'disabled',
        driverSmsSkipReason: 'sms_rebuild_pending',
      });
      return;
    }

    // ── Idempotency ───────────────────────────────────────────────────────────
    const current = (await notifRef.get()).data() || {};
    if (current.driverSmsSent === true) { log('already sent — skip'); return; }

    const data = event.data.data();
    if (data.status !== 'new') { log('status is not new — skip'); return; }

    // ── Resolve eligible driver IDs ───────────────────────────────────────────
    let eligibleIds = (data.eligibleDriverIds || []).filter(Boolean);

    if (eligibleIds.length === 0) {
      // Client had no _activeDrivers loaded — query Firestore directly
      log('eligibleDriverIds empty, querying Firestore for eligible drivers');
      const airport   = (data.airport || '').toUpperCase();
      const regionId  = AIRPORT_REGION_CF[airport] || null;
      const allSnap   = await db.collection('drivers')
        .where('adminStatus',       '==', 'active')
        .where('complianceStatus',  '==', 'approved')
        .get();
      eligibleIds = allSnap.docs
        .filter(d => {
          if (!regionId) return true; // private ride: all regions
          return (d.data().regions || []).includes(regionId);
        })
        .map(d => d.id);
      log(`Firestore fallback found ${eligibleIds.length} eligible driver(s)`);
    }

    if (eligibleIds.length === 0) {
      log('no eligible drivers — skip SMS');
      await notifRef.update({
        driverSmsSent:       false,
        driverSmsStatus:     'skipped',
        driverSmsSkipReason: 'no_eligible_drivers',
      });
      return;
    }

    // ── Validate Twilio credentials ───────────────────────────────────────────
    const accountSid = TWILIO_ACCOUNT_SID.value();
    const authToken  = TWILIO_AUTH_TOKEN.value();
    const fromNumber = TWILIO_FROM_NUMBER.value();
    if (!accountSid || !authToken || !fromNumber) {
      log('missing Twilio secrets');
      await notifRef.update({ driverSmsSent: false, driverSmsStatus: 'skipped', driverSmsSkipReason: 'missing_twilio_secrets' });
      return;
    }

    // ── Build SMS body (GSM-7: no emoji, no diacritics) ──────────────────────
    const SVC = { airport_pickup:'Don san bay', airport_dropoff:'Ra san bay', private_ride:'Xe rieng' };
    const svcLabel  = SVC[data.serviceType || data.type] || 'Chuyen xe';
    const airport   = data.airport ? ' [' + data.airport + ']' : '';
    const pax       = data.passengers || 1;
    const addr      = data.pickupAddress || data.dropoffAddress || '';
    const addrLine  = addr ? '\n' + stripDiacritics(addr).slice(0, 50) : '';
    const smsBody   = [
      '[Du Lich Cali] Chuyen xe moi!',
      svcLabel + airport + ' · ' + pax + ' nguoi' + addrLine,
      'Nhan chuyen: dulichcali21.com/driver-admin',
    ].join('\n');

    // ── Send SMS to each eligible driver ──────────────────────────────────────
    const client  = twilio(accountSid, authToken);
    const sentTo  = [];
    const failed  = [];

    for (const driverId of eligibleIds) {
      try {
        const driverSnap = await db.collection('drivers').doc(driverId).get();
        if (!driverSnap.exists) { log(`driver ${driverId} not found`); continue; }
        const phone = driverSnap.data().phone;
        if (!phone) { log(`driver ${driverId} has no phone`); continue; }

        const msgParams = fromNumber.startsWith('MG')
          ? { messagingServiceSid: fromNumber, to: phone, body: smsBody }
          : { from: fromNumber,               to: phone, body: smsBody };

        const msg = await client.messages.create(msgParams);
        log(`sent to driver ${driverId} (${phone}) — sid=${msg.sid}`);
        sentTo.push(driverId);
      } catch (err) {
        log(`failed for driver ${driverId}: ${err.message}`);
        failed.push(driverId);
      }
    }

    await notifRef.update({
      driverSmsSent:   sentTo.length > 0,
      driverSmsStatus: sentTo.length > 0 ? 'sent' : 'failed',
      driverSmsSentTo: sentTo,
      driverSmsSentAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(failed.length ? { driverSmsFailedTo: failed } : {}),
    });

    log(`done — sent to ${sentTo.length}, failed ${failed.length}`);
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
//  BOOKING CONFIRMATION EMAIL
//
//  Trigger:  client writes to vendors/{vendorId}/emailQueue/{emailId}
//            immediately after a successful booking + customer provides email.
//  Provider: Resend (api.resend.com) — no new npm dep, uses native https.
//  Secret:   RESEND_API_KEY in Google Cloud Secret Manager.
//
//  Setup checklist (one-time):
//    1. Sign up at https://resend.com (3 000 emails/month free)
//    2. Verify domain dulichcali21.com (or use onboarding@resend.dev for testing)
//    3. firebase functions:secrets:set RESEND_API_KEY
//    4. firebase deploy --only functions
// ══════════════════════════════════════════════════════════════════════════════

exports.onEmailQueue = onDocumentCreated(
  {
    document:       'vendors/{vendorId}/emailQueue/{emailId}',
    region:         'us-central1',
    secrets:        [RESEND_API_KEY],
    timeoutSeconds: 30,
    retry:          false,   // idempotency handled below
  },
  async (event) => {
    const { vendorId, emailId } = event.params;
    const queueRef = event.data.ref;
    const log = (msg, ...args) =>
      console.log(`[email][${vendorId}/${emailId}] ${msg}`, ...args);

    log('triggered');

    // ── Idempotency guard ─────────────────────────────────────────────────────
    const current = (await queueRef.get()).data() || {};
    if (current.emailSent === true || current.emailStatus === 'sent') {
      log('already sent — skip');
      return;
    }

    const data = event.data.data();

    // Driver-notify emails route to the driver, not the customer
    const toEmail = data.bookingType === 'travel_driver_notify'
      ? data.driverEmail
      : data.customerEmail;

    if (!toEmail) {
      const skipReason = data.bookingType === 'travel_driver_notify'
        ? 'no_driver_email'
        : 'no_customer_email';
      await queueRef.update({ emailStatus: 'skipped', emailSkipReason: skipReason });
      return;
    }

    const apiKey = RESEND_API_KEY.value();
    if (!apiKey) {
      log('RESEND_API_KEY not configured — skipping');
      await queueRef.update({ emailStatus: 'skipped', emailSkipReason: 'missing_api_key' });
      return;
    }

    // ── Build and send ────────────────────────────────────────────────────────
    let textBody, htmlBody, subject, fromName;

    if (data.bookingType === 'ride') {
      // Ride booking emails (airport pickup/dropoff, private ride)
      fromName = 'Du Lịch Cali';
      if (data.eventType === 'assigned') {
        ({ textBody, htmlBody } = buildDriverAssignedEmail(data));
        subject = `Driver Assigned — Du Lịch Cali [${data.bookingId || ''}]`;
      } else if (typeof data.eventType === 'string' && data.eventType.startsWith('status_')) {
        // Ride status-change emails (driver_confirmed / on_the_way / arrived / completed / cancelled)
        const STATUS_SUBJECTS = {
          status_driver_confirmed: `Driver Confirmed Your Ride`,
          status_on_the_way:       `Your Driver Is On The Way`,
          status_arrived:          `Your Driver Has Arrived`,
          status_completed:        `Your Ride Is Complete`,
          status_cancelled:        `Your Ride Has Been Cancelled`,
        };
        ({ textBody, htmlBody } = buildRideStatusEmail(data));
        subject = `${STATUS_SUBJECTS[data.eventType] || 'Ride Update'} — Du Lịch Cali [${data.bookingId || ''}]`;
      } else if (data.eventType === 'reminder_30min' || data.eventType === 'reminder_2hr') {
        // Pre-pickup reminder emails (scheduled by checkRideReminders)
        const reminderLabel = data.eventType === 'reminder_2hr' ? '2-Hour' : '30-Minute';
        ({ textBody, htmlBody } = buildRideReminderEmail(data, data.eventType));
        subject = `Ride Reminder (${reminderLabel}) — Du Lịch Cali [${data.bookingId || ''}]`;
      } else {
        ({ textBody, htmlBody } = buildRideConfirmationEmail(data));
        subject = `Ride Confirmed — Du Lịch Cali [${data.bookingId || ''}]`;
      }
    } else if (data.bookingType === 'travel') {
      // Customer travel booking confirmation
      fromName = 'Du Lịch Cali Tours';
      ({ textBody, htmlBody } = buildTravelConfirmationEmail(data));
      subject = `Tour Confirmed — Du Lịch Cali [${data.bookingId || ''}]`;
    } else if (data.bookingType === 'travel_owner') {
      // Owner notification for new travel booking
      fromName = 'Du Lịch Cali Bookings';
      ({ textBody, htmlBody } = buildTravelOwnerEmail(data));
      subject = `New Tour Booking: ${data.packageName || 'Tour'} — [${data.bookingId || ''}]`;
    } else if (data.bookingType === 'travel_driver_notify') {
      // Driver dispatch notification — sent only to the assigned driver(s)
      fromName = 'Du Lịch Cali Dispatch';
      ({ textBody, htmlBody } = buildDriverNotifyEmail(data));
      subject = `[Tour Assignment] ${data.travelDate || 'Upcoming Tour'} — ${data.packageName || ''} [${data.bookingId || ''}]`;
    } else if (data.bookingType === 'mobile_barber') {
      // Mobile barber customer booking confirmation
      fromName = data.businessName || 'Du Lịch Cali Mobile Barber';
      ({ textBody, htmlBody } = buildMobileBarberConfirmationEmail(data));
      subject = `Mobile Barber Request Received — ${fromName} [${data.bookingId || ''}]`;
    } else {
      // Appointment emails (nail/hair) — existing template
      fromName = data.shopName || 'Luxurious Nails';
      ({ textBody, htmlBody } = buildConfirmationEmailBody(data));
      subject = `Booking Confirmed — ${fromName} [${data.bookingId || ''}]`;
    }

    try {
      await _resendSend(apiKey, {
        from:     `${fromName} <appointments@dulichcali21.com>`,
        reply_to: data.shopEmail || 'dulichcali21@gmail.com',
        to:       [toEmail],
        subject,
        text:     textBody,
        html:     htmlBody,
      });
      await queueRef.update({
        emailSent:   true,
        emailStatus: 'sent',
        sentAt:      admin.firestore.FieldValue.serverTimestamp(),
      });
      log('sent →', toEmail);
    } catch (err) {
      log('send failed:', err.message);
      await queueRef.update({ emailStatus: 'error', emailError: err.message.slice(0, 200) });
    }
  }
);

// ── Travel booking dispatch ───────────────────────────────────────────────────
// Fires on every new travel_bookings document. Runs driver selection,
// writes to travel_dispatch/{bookingId}, and queues driver emails.
// Does NOT touch existing booking fields set by travel-booking.js.
// Additive: failure is logged and does not affect the saved booking.
exports.onTravelBookingCreated = onDocumentCreated(
  {
    document:       'travel_bookings/{bookingId}',
    region:         'us-central1',
    timeoutSeconds: 60,
    retry:          false,
  },
  async (event) => {
    const { bookingId } = event.params;
    const booking = event.data ? event.data.data() : null;
    if (!booking) return;

    // Skip if dispatch already ran (safety for manual re-triggers)
    if (booking.dispatch_status) {
      console.log(`[TravelDispatch] ${bookingId} already dispatched — skip`);
      return;
    }

    try {
      const result = await travelDispatch.assignDrivers(booking, bookingId);
      console.log(`[TravelDispatch] ${bookingId} complete:`, result.assignment_type);
    } catch (err) {
      console.error(`[TravelDispatch] ${bookingId} error:`, err.message);
      // Fail silently — booking is already persisted; admin can dispatch manually
      await db.collection('travel_bookings').doc(bookingId).update({
        dispatch_status: 'error',
        dispatch_error:  err.message.slice(0, 500),
        dispatched_at:   admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
  }
);

// ── Resend HTTP helper (native https — no extra npm dependency) ───────────────
function _resendSend(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req  = https.request(
      {
        hostname: 'api.resend.com',
        path:     '/emails',
        method:   'POST',
        headers:  {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(raw));
          } else {
            reject(new Error(`Resend HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Ride confirmation email builder ──────────────────────────────────────────
function buildRideConfirmationEmail(data) {
  const name          = data.customerName || 'Customer';
  const bookingId     = data.bookingId    || '';
  const serviceType   = data.serviceType  || '';
  const isPickup      = serviceType === 'pickup';
  const isDropoff     = serviceType === 'dropoff';
  const isPrivate     = serviceType === 'private_ride';
  const dispatchStatus= data.dispatchStatus || 'awaiting_driver';
  const driverName    = data.driverName   || null;
  const trackingToken = data.trackingToken || '';
  const passengers    = data.passengers   || 1;

  // Format datetime
  let datetimeStr = data.datetime || '';
  if (datetimeStr && datetimeStr.includes('T')) {
    try {
      const d = new Date(datetimeStr);
      const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const h = d.getHours(), m = d.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12  = h % 12 || 12;
      datetimeStr = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${h12}:${String(m).padStart(2,'0')} ${ampm}`;
    } catch (_) {}
  }

  // Service label and route
  let serviceLabel, routeFrom, routeTo;
  if (isPickup) {
    serviceLabel = `Airport Pickup — ${data.airport || ''}`;
    routeFrom    = `${data.airport || 'Airport'}${data.terminal ? ` Terminal ${data.terminal}` : ''}`;
    routeTo      = data.address || '';
  } else if (isDropoff) {
    serviceLabel = `Airport Drop-off — ${data.airport || ''}`;
    routeFrom    = data.address || '';
    routeTo      = `${data.airport || 'Airport'}${data.terminal ? ` Terminal ${data.terminal}` : ''}`;
  } else {
    serviceLabel = 'Private Ride';
    routeFrom    = data.pickupAddress  || '';
    routeTo      = data.dropoffAddress || '';
  }

  // Dispatch status message
  const dispatchMsg = (dispatchStatus === 'assigned' && driverName)
    ? `Your driver ${driverName} has been assigned to your trip. We'll be in touch with exact pickup details.`
    : `We're matching you with the best available driver. You'll receive a text confirmation within 30 minutes.`;

  const trackUrl = trackingToken
    ? `https://www.dulichcali21.com/tracking.html?id=${bookingId}&t=${trackingToken}`
    : 'https://www.dulichcali21.com';

  const fare = data.estimatedPrice ? `~$${data.estimatedPrice}` : null;

  // ── Plain text ──────────────────────────────────────────────────────────────
  const textLines = [
    `Hi ${name},`,
    '',
    `Your ride has been booked! Here are your details:`,
    '',
    `  Booking ID:  ${bookingId}`,
    `  Service:     ${serviceLabel}`,
    `  Date/Time:   ${datetimeStr || '(to be confirmed)'}`,
    `  From:        ${routeFrom}`,
    `  To:          ${routeTo}`,
    passengers > 1 ? `  Passengers:  ${passengers}` : null,
    fare           ? `  Est. Fare:   ${fare}` : null,
    '',
    dispatchMsg,
    '',
    trackingToken ? `Track your booking: ${trackUrl}` : null,
    '',
    'Questions? Email: dulichcali21@gmail.com',
    '',
    '— Du Lịch Cali',
    'https://www.dulichcali21.com',
  ].filter(l => l !== null).join('\n');

  // ── HTML ────────────────────────────────────────────────────────────────────
  const row = (label, value) => value
    ? `<tr style="border-bottom:1px solid #f0ebe3;">
        <td style="padding:10px 0;color:#7a6a52;width:38%;font-size:14px;">${label}</td>
        <td style="padding:10px 0;font-size:14px;">${value}</td>
       </tr>` : '';

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ride Confirmed</title></head>
<body style="margin:0;padding:16px;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <div style="background:#0d2f50;padding:24px 32px;">
    <h1 style="color:#c9a84c;font-size:20px;margin:0;font-weight:400;letter-spacing:.5px;">Du Lịch Cali</h1>
    <p style="color:#a8c4d8;font-size:13px;margin:6px 0 0;">Ride Confirmation</p>
  </div>
  <div style="padding:28px 32px;color:#2c2c2c;">
    <p style="font-size:15px;margin:0 0 20px;">Hi <strong>${name}</strong>,<br>Your ride is booked!</p>
    <table style="width:100%;border-collapse:collapse;">
      ${row('Booking ID',  `<span style="font-family:monospace;font-weight:600;">${bookingId}</span>`)}
      ${row('Service',     serviceLabel)}
      ${row('Date / Time', datetimeStr || '(to be confirmed)')}
      ${row('From',        routeFrom)}
      ${row('To',          routeTo)}
      ${row('Passengers',  passengers > 1 ? String(passengers) : null)}
      ${row('Est. Fare',   fare)}
    </table>
    <div style="margin:24px 0 0;padding:16px;background:#f0f6ff;border-radius:6px;border-left:3px solid #c9a84c;">
      <p style="margin:0;font-size:13px;color:#2c2c2c;line-height:1.7;">${dispatchMsg}</p>
    </div>
    ${trackingToken ? `<p style="margin:20px 0 0;font-size:14px;"><a href="${trackUrl}" style="color:#0d6efd;">Track your booking →</a></p>` : ''}
    <p style="font-size:13px;margin:20px 0 0;color:#5a4a3a;">Questions? <a href="mailto:dulichcali21@gmail.com" style="color:#0d2f50;">Email us</a></p>
  </div>
  <div style="background:#f0ebe3;padding:14px 32px;text-align:center;">
    <p style="color:#9a8a7a;font-size:12px;margin:0;">— Du Lịch Cali &nbsp;·&nbsp; <a href="https://www.dulichcali21.com" style="color:#9a8a7a;">dulichcali21.com</a></p>
  </div>
</div>
</body></html>`;

  return { textBody, htmlBody };
}

// ── Driver-assigned email builder ─────────────────────────────────────────────
function buildDriverAssignedEmail(data) {
  const name         = data.customerName || 'Customer';
  const bookingId    = data.bookingId    || '';
  const driverName   = data.driverName   || 'Your driver';
  const driverPhone  = data.driverPhone  || '';
  const trackingToken= data.trackingToken|| '';
  const serviceType  = data.serviceType  || '';
  const isPickup     = serviceType === 'pickup';

  let datetimeStr = data.datetime || '';
  if (datetimeStr && datetimeStr.includes('T')) {
    try {
      const d = new Date(datetimeStr);
      const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const h = d.getHours(), m = d.getMinutes();
      datetimeStr = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
    } catch (_) {}
  }

  const meetLocation = isPickup
    ? `${data.airport || 'Airport'} Arrivals/Baggage Claim`
    : (data.address || data.pickupAddress || '');

  const trackUrl = trackingToken
    ? `https://www.dulichcali21.com/tracking.html?id=${bookingId}&t=${trackingToken}`
    : 'https://www.dulichcali21.com';

  // ── Plain text ──────────────────────────────────────────────────────────────
  const textLines = [
    `Hi ${name},`,
    '',
    `Great news — your driver has been assigned!`,
    '',
    `  Driver:      ${driverName}`,
    driverPhone ? `  Driver phone: ${driverPhone}` : null,
    `  Booking ID:  ${bookingId}`,
    datetimeStr ? `  Date/Time:   ${datetimeStr}` : null,
    meetLocation ? `  Meet at:     ${meetLocation}` : null,
    '',
    'Your driver will contact you closer to the pickup time.',
    trackingToken ? `Track your ride: ${trackUrl}` : null,
    '',
    'Questions? Email: dulichcali21@gmail.com',
    '',
    '— Du Lịch Cali',
  ].filter(l => l !== null).join('\n');

  // ── HTML ────────────────────────────────────────────────────────────────────
  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Driver Assigned</title></head>
<body style="margin:0;padding:16px;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <div style="background:#0d2f50;padding:24px 32px;">
    <h1 style="color:#c9a84c;font-size:20px;margin:0;font-weight:400;letter-spacing:.5px;">Du Lịch Cali</h1>
    <p style="color:#a8c4d8;font-size:13px;margin:6px 0 0;">Driver Assigned</p>
  </div>
  <div style="padding:28px 32px;color:#2c2c2c;">
    <p style="font-size:15px;margin:0 0 20px;">Hi <strong>${name}</strong>,<br>Great news — your driver has been assigned!</p>
    <div style="padding:20px;background:#f8fdf4;border-radius:8px;border:1px solid #c3e6cb;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:18px;font-weight:600;color:#0d2f50;">🚗 ${driverName}</p>
      ${driverPhone ? `<p style="margin:0;font-size:14px;color:#5a4a3a;">📞 <a href="tel:${driverPhone.replace(/\D/g,'')}" style="color:#0d2f50;">${driverPhone}</a></p>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${datetimeStr ? `<tr style="border-bottom:1px solid #f0ebe3;"><td style="padding:10px 0;color:#7a6a52;width:38%;font-size:14px;">Date / Time</td><td style="padding:10px 0;font-size:14px;">${datetimeStr}</td></tr>` : ''}
      ${meetLocation ? `<tr style="border-bottom:1px solid #f0ebe3;"><td style="padding:10px 0;color:#7a6a52;width:38%;font-size:14px;">Meet at</td><td style="padding:10px 0;font-size:14px;">${meetLocation}</td></tr>` : ''}
      <tr><td style="padding:10px 0;color:#7a6a52;font-size:14px;">Booking ID</td><td style="padding:10px 0;font-size:14px;font-family:monospace;font-weight:600;">${bookingId}</td></tr>
    </table>
    <p style="font-size:13px;margin:20px 0 0;color:#5a4a3a;">Your driver will contact you closer to the pickup time.</p>
    ${trackingToken ? `<p style="font-size:14px;margin:12px 0 0;"><a href="${trackUrl}" style="color:#0d6efd;">Track your ride →</a></p>` : ''}
    <p style="font-size:13px;margin:16px 0 0;color:#5a4a3a;">Questions? <a href="mailto:dulichcali21@gmail.com" style="color:#0d2f50;">Email us</a></p>
  </div>
  <div style="background:#f0ebe3;padding:14px 32px;text-align:center;">
    <p style="color:#9a8a7a;font-size:12px;margin:0;">— Du Lịch Cali &nbsp;·&nbsp; <a href="https://www.dulichcali21.com" style="color:#9a8a7a;">dulichcali21.com</a></p>
  </div>
</div>
</body></html>`;

  return { textBody, htmlBody };
}

// ── Ride status-change email builder ─────────────────────────────────────────
// Handles: status_driver_confirmed, status_on_the_way, status_arrived,
//          status_completed, status_cancelled
// Produces concise single-purpose emails — not verbose confirmation style.
function buildRideStatusEmail(data) {
  const name          = data.customerName || 'Customer';
  const bookingId     = data.bookingId    || '';
  const eventType     = data.eventType    || '';
  const driverName    = data.driverName   || 'your driver';
  const driverPhone   = data.driverPhone  || '';
  const trackingToken = data.trackingToken || '';

  const trackUrl = trackingToken
    ? `https://www.dulichcali21.com/tracking.html?id=${bookingId}&t=${trackingToken}`
    : null;

  // Per-status content
  const STATUS_CONTENT = {
    status_driver_confirmed: {
      headline:  'Your driver confirmed your ride!',
      body:      `${driverName} has confirmed your booking.` +
                 (driverPhone ? ` You can reach them at ${driverPhone}.` : ''),
      cta:       'Track Your Ride',
      ctaUrl:    trackUrl || 'https://www.dulichcali21.com',
      icon:      '✓',
      accentBg:  '#f8fdf4',
      accentBdr: '#c3e6cb',
    },
    status_on_the_way: {
      headline:  'Your driver is on the way!',
      body:      `${driverName} is heading to your pickup location now.` +
                 (driverPhone ? ` Contact: ${driverPhone}.` : ''),
      cta:       'Track Live',
      ctaUrl:    trackUrl || 'https://www.dulichcali21.com',
      icon:      '🚗',
      accentBg:  '#f0f6ff',
      accentBdr: '#b3d0f7',
    },
    status_arrived: {
      headline:  'Your driver has arrived!',
      body:      `${driverName} is at the pickup location. Please head out when ready.` +
                 (driverPhone ? ` Contact: ${driverPhone}.` : ''),
      cta:       'View Details',
      ctaUrl:    trackUrl || 'https://www.dulichcali21.com',
      icon:      '📍',
      accentBg:  '#fff8f0',
      accentBdr: '#ffd89b',
    },
    status_completed: {
      headline:  'Your ride is complete — thank you!',
      body:      'Thank you for riding with Du Lịch Cali. We hope you had a great experience. We look forward to serving you again!',
      cta:       'Book Another Ride',
      ctaUrl:    'https://www.dulichcali21.com',
      icon:      '★',
      accentBg:  '#f4fdf4',
      accentBdr: '#a3d9a5',
    },
    status_cancelled: {
      headline:  'Your ride has been cancelled.',
      body:      'Your booking has been cancelled. If this was unexpected or you need to rebook, please contact us — we are happy to help.',
      cta:       'Book a New Ride',
      ctaUrl:    'https://www.dulichcali21.com',
      icon:      '✕',
      accentBg:  '#fff5f5',
      accentBdr: '#f5c6cb',
    },
  };

  const s = STATUS_CONTENT[eventType] || STATUS_CONTENT['status_driver_confirmed'];

  // ── Plain text ──────────────────────────────────────────────────────────────
  const textLines = [
    `Hi ${name},`,
    '',
    s.headline,
    '',
    s.body,
    '',
    `Booking ID: ${bookingId}`,
    '',
    s.ctaUrl ? `${s.cta}: ${s.ctaUrl}` : null,
    '',
    'Questions? Email: dulichcali21@gmail.com',
    '— Du Lịch Cali · dulichcali21.com',
  ].filter(l => l !== null).join('\n');

  // ── HTML ────────────────────────────────────────────────────────────────────
  const isCancelled = eventType === 'status_cancelled';
  const headerLabel = {
    status_driver_confirmed: 'Driver Confirmed',
    status_on_the_way:       'Driver En Route',
    status_arrived:          'Driver Arrived',
    status_completed:        'Ride Complete',
    status_cancelled:        'Ride Cancelled',
  }[eventType] || 'Ride Update';

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${headerLabel}</title></head>
<body style="margin:0;padding:16px;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <div style="background:${isCancelled ? '#5a1a1a' : '#0d2f50'};padding:24px 32px;">
    <h1 style="color:#c9a84c;font-size:20px;margin:0;font-weight:400;letter-spacing:.5px;">Du Lịch Cali</h1>
    <p style="color:${isCancelled ? '#e8a0a0' : '#a8c4d8'};font-size:13px;margin:6px 0 0;">${headerLabel}</p>
  </div>
  <div style="padding:28px 32px;color:#2c2c2c;">
    <p style="font-size:15px;margin:0 0 20px;">Hi <strong>${name}</strong>,</p>
    <div style="padding:20px;background:${s.accentBg};border-radius:8px;border:1px solid ${s.accentBdr};margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:22px;">${s.icon}</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#0d2f50;">${s.headline}</p>
    </div>
    <p style="font-size:14px;margin:0 0 16px;color:#3a3a3a;line-height:1.7;">${s.body}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="padding:8px 0;color:#7a6a52;font-size:13px;width:38%;">Booking ID</td>
        <td style="padding:8px 0;font-family:monospace;font-weight:600;font-size:13px;">${bookingId}</td>
      </tr>
    </table>
    ${s.ctaUrl ? `<p style="margin:0 0 16px;"><a href="${s.ctaUrl}" style="display:inline-block;padding:10px 24px;background:#c9a84c;color:#fff;text-decoration:none;border-radius:5px;font-size:14px;font-weight:600;">${s.cta} →</a></p>` : ''}
    <p style="font-size:13px;margin:0;color:#5a4a3a;">Questions? <a href="mailto:dulichcali21@gmail.com" style="color:#0d2f50;">Email us</a></p>
  </div>
  <div style="background:#f0ebe3;padding:14px 32px;text-align:center;">
    <p style="color:#9a8a7a;font-size:12px;margin:0;">— Du Lịch Cali &nbsp;·&nbsp; <a href="https://www.dulichcali21.com" style="color:#9a8a7a;">dulichcali21.com</a></p>
  </div>
</div>
</body></html>`;

  return { textBody, htmlBody };
}

// ── Pre-pickup reminder email builder ─────────────────────────────────────────
function buildRideReminderEmail(data, reminderType) {
  const name          = data.customerName || 'Customer';
  const bookingId     = data.bookingId    || '';
  const serviceType   = data.serviceType  || '';
  const isPickup      = serviceType === 'pickup';
  const isDropoff     = serviceType === 'dropoff';
  const trackingToken = data.trackingToken || '';
  const driverName    = data.driverName   || null;
  const driverPhone   = data.driverPhone  || '';
  const passengers    = data.passengers   || 1;

  const is2hr    = reminderType === 'reminder_2hr';
  const minLabel = is2hr ? '2 hours' : '30 minutes';

  // Format datetime (same logic as confirmation email)
  let datetimeStr = data.datetime || '';
  if (datetimeStr && datetimeStr.includes('T')) {
    try {
      const d = new Date(datetimeStr);
      const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const h = d.getHours(), m = d.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12  = h % 12 || 12;
      datetimeStr = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${h12}:${String(m).padStart(2,'0')} ${ampm}`;
    } catch (_) {}
  }

  // Route info
  let serviceLabel, pickupStr, dropoffStr;
  if (isPickup) {
    serviceLabel = `Airport Pickup — ${data.airport || ''}`;
    pickupStr    = `${data.airport || 'Airport'}${data.terminal ? ` Terminal ${data.terminal}` : ''}`;
    dropoffStr   = data.address || '';
  } else if (isDropoff) {
    serviceLabel = `Airport Drop-off — ${data.airport || ''}`;
    pickupStr    = data.address || '';
    dropoffStr   = `${data.airport || 'Airport'}${data.terminal ? ` Terminal ${data.terminal}` : ''}`;
  } else {
    serviceLabel = 'Private Ride';
    pickupStr    = data.pickupAddress  || '';
    dropoffStr   = data.dropoffAddress || '';
  }

  const trackUrl = trackingToken
    ? `https://www.dulichcali21.com/tracking.html?id=${bookingId}&t=${trackingToken}`
    : 'https://www.dulichcali21.com';

  const mapsUrl = pickupStr
    ? `https://maps.google.com/?q=${encodeURIComponent(pickupStr)}`
    : null;

  const driverLine = driverName
    ? `Your driver ${driverName}${driverPhone ? ` (${driverPhone})` : ''} is assigned to your trip.`
    : `We are finalizing your driver assignment and will confirm shortly.`;

  // ── Plain text ──────────────────────────────────────────────────────────────
  const textLines = [
    `Hi ${name},`,
    '',
    `Your ride is coming up in ${minLabel}! Here are your details:`,
    '',
    `  Booking ID:  ${bookingId}`,
    `  Service:     ${serviceLabel}`,
    `  Pickup time: ${datetimeStr || '(see booking)'}`,
    `  From:        ${pickupStr}`,
    `  To:          ${dropoffStr}`,
    passengers > 1 ? `  Passengers:  ${passengers}` : null,
    '',
    driverLine,
    '',
    `Track your ride: ${trackUrl}`,
    mapsUrl ? `Pickup map:     ${mapsUrl}` : null,
    '',
    'Questions? Email: dulichcali21@gmail.com',
    '— Du Lịch Cali · dulichcali21.com',
  ].filter(l => l !== null).join('\n');

  // ── HTML ────────────────────────────────────────────────────────────────────
  const row = (label, value) => value
    ? `<tr style="border-bottom:1px solid #f0ebe3;">
        <td style="padding:10px 0;color:#7a6a52;width:38%;font-size:14px;">${label}</td>
        <td style="padding:10px 0;font-size:14px;">${value}</td>
       </tr>` : '';

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ride Reminder</title></head>
<body style="margin:0;padding:16px;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <div style="background:#0d2f50;padding:24px 32px;">
    <h1 style="color:#c9a84c;font-size:20px;margin:0;font-weight:400;letter-spacing:.5px;">Du Lịch Cali</h1>
    <p style="color:#a8c4d8;font-size:13px;margin:6px 0 0;">Ride Reminder &mdash; ${minLabel} away</p>
  </div>
  <div style="padding:28px 32px;color:#2c2c2c;">
    <p style="font-size:15px;margin:0 0 20px;">Hi <strong>${name}</strong>,<br>Your ride is in <strong>${minLabel}</strong>. Please be ready at your pickup location!</p>
    <table style="width:100%;border-collapse:collapse;">
      ${row('Booking ID',   `<span style="font-family:monospace;font-weight:600;">${bookingId}</span>`)}
      ${row('Service',      serviceLabel)}
      ${row('Pickup Time',  datetimeStr || '(see booking)')}
      ${row('Pickup From',  pickupStr)}
      ${row('Dropoff To',   dropoffStr)}
      ${row('Passengers',   passengers > 1 ? String(passengers) : null)}
    </table>
    <div style="margin:24px 0 0;padding:16px;background:#f0f6ff;border-radius:6px;border-left:3px solid #c9a84c;">
      <p style="margin:0;font-size:13px;color:#2c2c2c;line-height:1.7;">${driverLine}</p>
    </div>
    <div style="margin:16px 0 0;">
      <a href="${trackUrl}" style="display:inline-block;padding:10px 20px;background:#0d2f50;color:#c9a84c;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;margin-right:8px;">Track Ride</a>
      ${mapsUrl ? `<a href="${mapsUrl}" style="display:inline-block;padding:10px 20px;background:#f0ebe3;color:#5a4030;text-decoration:none;border-radius:4px;font-size:13px;">View Pickup on Map</a>` : ''}
    </div>
    <p style="font-size:13px;margin:20px 0 0;color:#5a4a3a;">Questions? <a href="mailto:dulichcali21@gmail.com" style="color:#0d2f50;">Email us</a></p>
  </div>
  <div style="background:#f0ebe3;padding:14px 32px;text-align:center;">
    <p style="color:#9a8a7a;font-size:12px;margin:0;">— Du Lịch Cali &nbsp;&middot;&nbsp; <a href="https://www.dulichcali21.com" style="color:#9a8a7a;">dulichcali21.com</a></p>
  </div>
</div>
</body></html>`;

  return { textBody, htmlBody };
}

// ── Confirmation email builder ────────────────────────────────────────────────
function buildConfirmationEmailBody(data) {
  const {
    customerName  = 'Customer',
    bookingId     = '',
    services      = [],
    staff,
    requestedDate = '',
    requestedTime = '',
    shopName      = 'Luxurious Nails',
    shopPhone     = '',
    shopAddress   = '',
    shopUrl       = 'https://www.dulichcali21.com',
  } = data;

  // ── Format date ───────────────────────────────────────────────────────────
  let dateStr = requestedDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    const d = new Date(requestedDate + 'T12:00:00');
    const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dateStr = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // ── Format time ───────────────────────────────────────────────────────────
  let timeStr = requestedTime;
  if (/^\d{1,2}:\d{2}$/.test(requestedTime)) {
    const [h, m] = requestedTime.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    timeStr = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  const svcStr  = Array.isArray(services) ? services.join(', ') : (services || 'Appointment');
  const techStr = staff || 'Next available technician';
  const name    = customerName || 'Customer';
  const shop    = shopName;

  // ── Plain text ────────────────────────────────────────────────────────────
  const textBody = [
    `Hi ${name},`,
    '',
    'Your appointment is confirmed! Here are your details:',
    '',
    `  Booking ID:   ${bookingId}`,
    `  Date:         ${dateStr}`,
    `  Time:         ${timeStr}`,
    `  Service:      ${svcStr}`,
    `  Technician:   ${techStr}`,
    shopAddress ? `  Location:     ${shopAddress}` : null,
    shopPhone   ? `  Phone:        ${shopPhone}`   : null,
    '',
    'To manage your appointment, reply to this email with:',
    '  CONFIRM    — to confirm you\'ll be there',
    '  CANCEL     — to cancel your appointment',
    '  RESCHEDULE — to request a different date or time',
    '',
    'We look forward to seeing you!',
    '',
    `— ${shop}`,
    shopUrl,
  ].filter(l => l !== null).join('\n');

  // ── HTML ──────────────────────────────────────────────────────────────────
  const row = (label, value) => value
    ? `<tr style="border-bottom:1px solid #f0ebe3;">
        <td style="padding:10px 0;color:#7a6a52;width:38%;font-size:14px;">${label}</td>
        <td style="padding:10px 0;font-size:14px;">${value}</td>
       </tr>`
    : '';

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Booking Confirmed</title></head>
<body style="margin:0;padding:16px;background:#f8f5f1;font-family:Georgia,serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:#0d2f50;padding:24px 32px;">
    <h1 style="color:#c9a84c;font-size:20px;margin:0;font-family:Georgia,serif;font-weight:400;letter-spacing:.5px;">${shop}</h1>
    <p style="color:#a8c4d8;font-size:13px;margin:6px 0 0;">Appointment Confirmation</p>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px;color:#2c2c2c;">
    <p style="font-size:15px;margin:0 0 20px;">Hi <strong>${name}</strong>,<br>Your appointment is confirmed!</p>
    <table style="width:100%;border-collapse:collapse;">
      ${row('Booking ID', `<span style="font-family:monospace;font-weight:600;">${bookingId}</span>`)}
      ${row('Date',        dateStr)}
      ${row('Time',        timeStr)}
      ${row('Service',     svcStr)}
      ${row('Technician',  techStr)}
      ${row('Location',    shopAddress)}
      ${row('Phone',       shopPhone)}
    </table>

    <!-- Reply actions -->
    <div style="margin:24px 0 0;padding:16px;background:#f8f5f1;border-radius:6px;border-left:3px solid #c9a84c;">
      <p style="margin:0 0 8px;font-size:13px;color:#5a4a3a;font-weight:600;">Manage your appointment</p>
      <p style="margin:0;font-size:13px;color:#5a4a3a;line-height:1.8;">
        Reply to this email with:<br>
        <strong>CONFIRM</strong> &nbsp;— to confirm you'll be there<br>
        <strong>CANCEL</strong> &nbsp;&nbsp;— to cancel your appointment<br>
        <strong>RESCHEDULE</strong> — to request a new date or time
      </p>
    </div>

    <p style="font-size:14px;margin:20px 0 0;color:#5a4a3a;">We look forward to seeing you!</p>
  </div>

  <!-- Footer -->
  <div style="background:#f0ebe3;padding:14px 32px;text-align:center;">
    <p style="color:#9a8a7a;font-size:12px;margin:0;">— ${shop} &nbsp;·&nbsp; <a href="${shopUrl}" style="color:#9a8a7a;">${shopUrl.replace('https://','')}</a></p>
  </div>
</div>
</body></html>`;

  return { textBody, htmlBody };
}

// ── Mobile barber confirmation email builder ─────────────────────────────────
function buildMobileBarberConfirmationEmail(data) {
  const {
    customerName     = 'Customer',
    bookingId        = '',
    barberName       = 'Mobile Barber',
    businessName     = barberName,
    vendorPhone      = '',
    serviceName      = 'Mobile barber service',
    requestedDate    = '',
    startTime        = '',
    endTime          = '',
    durationMinutes  = '',
    servicePrice     = '',
    addressSummary   = '',
    customerPhone    = '',
    cancellationNote = 'To cancel or reschedule, contact the barber before the appointment time.',
    lang             = 'en',
  } = data;

  const timeRange = [startTime, endTime].filter(Boolean).join(' - ');
  const price = servicePrice === '' || servicePrice == null ? '' : `$${Number(servicePrice).toFixed(0)}`;
  const COPY = {
    en: {
      greeting: 'Your mobile barber request has been received. Here are your details:',
      htmlIntro: 'Your request has been received. The barber will confirm the appointment or contact you if a schedule change is needed.',
      header: 'Mobile barber request received',
      bookingId: 'Booking ID',
      barber: 'Barber',
      service: 'Service',
      date: 'Date',
      time: 'Time',
      duration: 'Estimated duration',
      price: 'Price',
      address: 'Address',
      customerPhone: 'Your phone',
      vendorPhone: 'Barber phone',
      minutes: 'minutes',
    },
    vi: {
      greeting: 'Yêu cầu mobile barber của bạn đã được nhận. Thông tin chi tiết:',
      htmlIntro: 'Yêu cầu của bạn đã được nhận. Thợ sẽ xác nhận lịch hẹn hoặc liên hệ nếu cần đổi lịch.',
      header: 'Đã nhận yêu cầu mobile barber',
      bookingId: 'Mã đặt lịch',
      barber: 'Thợ',
      service: 'Dịch vụ',
      date: 'Ngày',
      time: 'Giờ',
      duration: 'Thời gian ước tính',
      price: 'Giá',
      address: 'Địa chỉ',
      customerPhone: 'Số điện thoại của bạn',
      vendorPhone: 'Số điện thoại thợ',
      minutes: 'phút',
    },
    es: {
      greeting: 'Su solicitud de barbero móvil fue recibida. Estos son los detalles:',
      htmlIntro: 'Su solicitud fue recibida. El barbero confirmará la cita o se comunicará si necesita cambiar el horario.',
      header: 'Solicitud de barbero móvil recibida',
      bookingId: 'ID de reserva',
      barber: 'Barbero',
      service: 'Servicio',
      date: 'Fecha',
      time: 'Hora',
      duration: 'Duración estimada',
      price: 'Precio',
      address: 'Dirección',
      customerPhone: 'Su teléfono',
      vendorPhone: 'Teléfono del barbero',
      minutes: 'minutos',
    },
  };
  const copy = COPY[lang] || COPY.en;
  const duration = durationMinutes ? `${durationMinutes} ${copy.minutes}` : '';
  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const safeCustomerName = escapeHtml(customerName || 'Customer');
  const safeBookingId = escapeHtml(bookingId);
  const safeBarberName = escapeHtml(barberName);
  const safeBusinessName = escapeHtml(businessName);
  const safeServiceName = escapeHtml(serviceName);
  const safeRequestedDate = escapeHtml(requestedDate);
  const safeTimeRange = escapeHtml(timeRange);
  const safeDuration = escapeHtml(duration);
  const safePrice = escapeHtml(price);
  const safeAddressSummary = escapeHtml(addressSummary);
  const safeCustomerPhone = escapeHtml(customerPhone);
  const safeVendorPhone = escapeHtml(vendorPhone);
  const safeCancellationNote = escapeHtml(cancellationNote);

  const textBody = [
    `Hi ${customerName || 'Customer'},`,
    '',
    copy.greeting,
    '',
    `  ${copy.bookingId}: ${bookingId}`,
    `  ${copy.barber}: ${barberName}`,
    `  ${copy.service}: ${serviceName}`,
    requestedDate ? `  ${copy.date}: ${requestedDate}` : null,
    timeRange ? `  ${copy.time}: ${timeRange}` : null,
    duration ? `  ${copy.duration}: ${duration}` : null,
    price ? `  ${copy.price}: ${price}` : null,
    addressSummary ? `  ${copy.address}: ${addressSummary}` : null,
    customerPhone ? `  ${copy.customerPhone}: ${customerPhone}` : null,
    vendorPhone ? `  ${copy.vendorPhone}: ${vendorPhone}` : null,
    '',
    cancellationNote,
    '',
    `— ${businessName}`,
    'https://www.dulichcali21.com/mobile-barber',
  ].filter(l => l !== null).join('\n');

  const row = (label, value) => value
    ? `<tr style="border-bottom:1px solid #edf0f2;">
        <td style="padding:10px 0;color:#52616f;width:38%;font-size:14px;">${label}</td>
        <td style="padding:10px 0;font-size:14px;">${value}</td>
       </tr>`
    : '';

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mobile Barber Request Received</title></head>
<body style="margin:0;padding:16px;background:#f5f7f8;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <div style="background:#0d2f50;padding:24px 32px;">
    <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700;">${safeBusinessName}</h1>
    <p style="color:#c7d6e2;font-size:13px;margin:6px 0 0;">${copy.header}</p>
  </div>
  <div style="padding:28px 32px;color:#1f2a33;">
    <p style="font-size:15px;margin:0 0 20px;">Hi <strong>${safeCustomerName}</strong>,<br>${copy.htmlIntro}</p>
    <table style="width:100%;border-collapse:collapse;">
      ${row(copy.bookingId, `<span style="font-family:monospace;font-weight:600;">${safeBookingId}</span>`)}
      ${row(copy.barber, safeBarberName)}
      ${row(copy.service, safeServiceName)}
      ${row(copy.date, safeRequestedDate)}
      ${row(copy.time, safeTimeRange)}
      ${row(copy.duration, safeDuration)}
      ${row(copy.price, safePrice)}
      ${row(copy.address, safeAddressSummary)}
      ${row(copy.customerPhone, safeCustomerPhone)}
      ${row(copy.vendorPhone, safeVendorPhone)}
    </table>
    <div style="margin:24px 0 0;padding:14px 16px;background:#f5f7f8;border-left:3px solid #0d2f50;border-radius:6px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#52616f;">${safeCancellationNote}</p>
    </div>
  </div>
  <div style="background:#edf0f2;padding:14px 32px;text-align:center;">
    <p style="color:#697886;font-size:12px;margin:0;">Du Lịch Cali · <a href="https://www.dulichcali21.com/mobile-barber" style="color:#0d2f50;">dulichcali21.com/mobile-barber</a></p>
  </div>
</div>
</body></html>`;

  return { textBody, htmlBody };
}

// ══════════════════════════════════════════════════════════════════════════════
//  INBOUND EMAIL HANDLER
//
//  Resend forwards inbound email to this HTTPS endpoint whenever a customer
//  replies to appointments@dulichcali21.com.
//
//  Setup (one-time):
//    1. Resend dashboard → Inbound → Add webhook URL:
//       https://us-central1-dulichcali-booking-calendar.cloudfunctions.net/onInboundEmail?token=SECRET
//    2. firebase functions:secrets:set RESEND_WEBHOOK_SECRET  (set to same SECRET)
//    3. firebase deploy --only functions
//
//  Security:
//    - ?token=SECRET query param rejects random POSTs (shared secret in Resend config)
//    - BookingId extracted from subject must match a real Firestore booking (no guessing)
//    - from email is stored in the audit record for traceability
//
//  Customer commands (first word of email body, case-insensitive):
//    CONFIRM     → sets booking status = 'confirmed_by_customer'
//    CANCEL      → sets booking status = 'cancelled_by_customer'
//    RESCHEDULE  → sets booking status = 'reschedule_requested', stores their note
//    anything else → sends a help reply with the three commands
// ══════════════════════════════════════════════════════════════════════════════

exports.onInboundEmail = onRequest(
  {
    region:         'us-central1',
    secrets:        [RESEND_API_KEY, RESEND_WEBHOOK_SECRET],
    timeoutSeconds: 30,
  },
  async (req, res) => {
    // Only handle POST
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const log = (msg, ...args) => console.log(`[inbound-email] ${msg}`, ...args);

    // ── Auth: shared secret in query param ────────────────────────────────────
    const secret = RESEND_WEBHOOK_SECRET.value();
    if (secret && req.query.token !== secret) {
      log('rejected — invalid token');
      res.status(401).send('Unauthorized');
      return;
    }

    // ── Parse Resend inbound payload ──────────────────────────────────────────
    const body    = req.body || {};
    const from    = (body.from    || '').trim();
    const subject = (body.subject || '').trim();
    const rawText = (body.text    || body.plain || '').trim();

    log(`from="${from}" subject="${subject}"`);

    // ── Extract booking ID from subject ───────────────────────────────────────
    // Confirmation email subject format:  Booking Confirmed — ShopName [BID-XXXX]
    // Customer reply subject format:      Re: Booking Confirmed — ShopName [BID-XXXX]
    // We capture the last [...] group.
    const bidMatch = subject.match(/\[([^\]]+)\]\s*$/);
    const bookingId = bidMatch ? bidMatch[1].trim() : null;

    if (!bookingId) {
      log('no booking ID in subject — ignoring');
      res.status(200).send('ok');
      return;
    }

    // ── Detect customer action from first line of body ────────────────────────
    const firstWord = rawText.split(/[\n\r\s]/)[0].toUpperCase();
    let action;
    if (/^CONFIRM/i.test(firstWord))    action = 'confirm';
    else if (/^CANCEL/i.test(firstWord)) action = 'cancel';
    else if (/^RESCHEDULE/i.test(firstWord)) action = 'reschedule';
    else action = 'help';

    log(`bookingId="${bookingId}" action="${action}"`);

    // ── Find booking via collection group query ───────────────────────────────
    // Bookings are stored at  vendors/{vendorId}/bookings/{bookingId}
    // The 'bookingId' field mirrors the document ID for querying.
    let bookingRef, booking, vendorId;
    try {
      const snap = await db.collectionGroup('bookings')
        .where('bookingId', '==', bookingId)
        .limit(1)
        .get();

      if (snap.empty) {
        log(`booking "${bookingId}" not found — ignoring`);
        res.status(200).send('ok');
        return;
      }

      bookingRef = snap.docs[0].ref;
      booking    = snap.docs[0].data();
      // Path: vendors/{vendorId}/bookings/{bookingId}
      vendorId   = bookingRef.parent.parent.id;
    } catch (err) {
      log('Firestore lookup failed:', err.message);
      res.status(500).send('lookup error');
      return;
    }

    // ── Write inbound email audit record ──────────────────────────────────────
    await db.collection('vendors').doc(vendorId)
      .collection('inboundEmails').add({
        from,
        subject,
        bodyPreview:  rawText.slice(0, 500),
        bookingId,
        action,
        receivedAt:   admin.firestore.FieldValue.serverTimestamp(),
      });

    // ── Apply action to booking ───────────────────────────────────────────────
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === 'confirm') {
      await bookingRef.update({
        status:              'confirmed_by_customer',
        customerConfirmedAt: now,
        customerEmail:       from,
      });

    } else if (action === 'cancel') {
      await bookingRef.update({
        status:          'cancelled_by_customer',
        cancelledAt:     now,
        cancelledBy:     'customer_email',
        customerEmail:   from,
      });

    } else if (action === 'reschedule') {
      await bookingRef.update({
        status:                   'reschedule_requested',
        rescheduleRequestedAt:    now,
        rescheduleNote:           rawText.slice(0, 500),
        customerEmail:            from,
      });
    }
    // action === 'help' → no booking update, just send the help reply below

    // ── Send reply email ──────────────────────────────────────────────────────
    const apiKey = RESEND_API_KEY.value();
    if (apiKey && from) {
      try {
        await _sendInboundReply(apiKey, from, booking, action, rawText);
        log(`reply sent to ${from} for action=${action}`);
      } catch (err) {
        log('reply email failed:', err.message);
        // Non-fatal — booking was already updated
      }
    }

    log(`done: booking="${bookingId}" action="${action}" vendor="${vendorId}"`);
    res.status(200).send('ok');
  }
);

// ── Inbound reply email builder ───────────────────────────────────────────────
async function _sendInboundReply(apiKey, toEmail, booking, action, originalText) {
  const shopName  = booking.shopName  || 'Du Lịch Cali Services';
  const bookingId = booking.bookingId || '';
  const shopUrl   = booking.shopUrl   || 'https://www.dulichcali21.com';

  // Format date + time for the reply
  let dateStr = booking.requestedDate || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + 'T12:00:00');
    const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dateStr = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
  let timeStr = booking.requestedTime || '';
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':').map(Number);
    timeStr = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  const apptStr = [dateStr, timeStr].filter(Boolean).join(' at ');

  const SUBJECTS = {
    confirm:    `Confirmed — ${shopName} [${bookingId}]`,
    cancel:     `Cancelled — ${shopName} [${bookingId}]`,
    reschedule: `Reschedule Request Received — ${shopName} [${bookingId}]`,
    help:       `How to manage your appointment — ${shopName} [${bookingId}]`,
  };

  const TEXTS = {
    confirm: [
      `Your appointment${apptStr ? ' on ' + apptStr : ''} is confirmed. ✓`,
      `We look forward to seeing you!`,
      ``,
      `— ${shopName}`,
      shopUrl,
    ].join('\n'),

    cancel: [
      `Your appointment${apptStr ? ' on ' + apptStr : ''} has been cancelled.`,
      `We hope to see you again soon. To make a new booking, visit us online or chat with our AI receptionist.`,
      ``,
      `— ${shopName}`,
      shopUrl,
    ].join('\n'),

    reschedule: [
      `We received your reschedule request.`,
      `A team member will contact you shortly to arrange a new time that works for you.`,
      ``,
      `Original appointment: ${apptStr || bookingId}`,
      ``,
      `— ${shopName}`,
      shopUrl,
    ].join('\n'),

    help: [
      `To manage your appointment, reply to this email with one of these commands:`,
      ``,
      `  CONFIRM     — to confirm you'll be there`,
      `  CANCEL      — to cancel your appointment`,
      `  RESCHEDULE  — to request a new date or time (add any details after the word)`,
      ``,
      `— ${shopName}`,
      shopUrl,
    ].join('\n'),
  };

  await _resendSend(apiKey, {
    from:    `${shopName} <appointments@dulichcali21.com>`,
    to:      [toEmail],
    subject: SUBJECTS[action] || SUBJECTS.help,
    text:    TEXTS[action]    || TEXTS.help,
  });
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

async function serverCallClaude(system, messagesOrUserContent, jsonMode, claudeKey, maxTokens, model) {
  const sysPrompt = jsonMode ? system + '\n\nRespond ONLY with valid JSON. No markdown.' : system;
  // Backwards compat: accept either a full multi-turn messages array OR a
  // single flattened userContent string (legacy aiProxy callers). Multi-turn
  // is required by Lily so she can remember earlier turns of the conversation.
  let messages;
  if (Array.isArray(messagesOrUserContent)) {
    messages = messagesOrUserContent.map(m => ({
      role:    m && m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m === 'string' ? m : (m && m.content) || ''
    })).filter(m => m.content);
    if (!messages.length) messages = [{ role: 'user', content: 'Generate content.' }];
  } else {
    messages = [{ role: 'user', content: messagesOrUserContent || 'Generate content.' }];
  }
  const raw = await httpsPost('api.anthropic.com', '/v1/messages',
    { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
    {
      model:      model || 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens || 1200,
      system:     sysPrompt,
      messages
    }
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
    `/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {},
    { contents: [{ parts: [{ text: prompt }] }] }
  );
  const d = JSON.parse(raw);
  return d.candidates[0].content.parts[0].text;
}

// Gemini 2.5 Flash WITH Google Search grounding — returns up-to-date, web-grounded
// text (used for live/seasonal/trending travel research). No new paid dependency;
// grounding is built into the Gemini API. Concatenates all returned text parts.
async function serverCallGeminiGrounded(prompt, geminiKey, maxOutputTokens) {
  const raw = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {},
    {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.4, maxOutputTokens: maxOutputTokens || 900 },
    }
  );
  const d = JSON.parse(raw);
  const cand = d && d.candidates && d.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  return parts.map(p => (p && p.text) || '').join('').trim();
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

    const claudeKey = await getAiKey('claude');
    const openaiKey = await getAiKey('openai');
    const geminiKey = await getAiKey('gemini');

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
    // No auth gate: customer-facing AI (Lily, marketplace receptionists,
    // travel chat) happens on public pages where the customer is anonymous.
    // Cost is bounded by the maxTokens cap (1200) below, Cloud Function
    // per-IP quotas, and the CORS allowlist enforced by onCall. Long term,
    // Firebase App Check should be added to gate this proxy from third-party
    // origins (TODO).

    const { provider, system, messages, maxTokens, jsonMode, model } = request.data || {};

    if (!provider || !system) {
      return { ok: false, vendorMessage: 'Yêu cầu không hợp lệ.', debugCode: 'INVALID_REQUEST' };
    }

    const claudeKey = await getAiKey('claude');
    const openaiKey = await getAiKey('openai');
    const geminiKey = await getAiKey('gemini');

    // Pass messages array through unchanged so multi-turn callers (Lily) keep
    // their conversation context. Legacy callers that pass a string instead
    // are still supported by serverCallClaude / serverCallOpenAI.
    const safeMessages = Array.isArray(messages) ? messages : (messages ? [messages] : []);
    const mt = Math.min(maxTokens || 1200, 1500); // hard ceiling for cost protection

    try {
      let text;

      if (provider === 'claude') {
        if (!claudeKey) return { ok: false, vendorMessage: 'Dịch vụ AI tạm thời không khả dụng.', debugCode: 'NO_CLAUDE_KEY' };
        text = await serverCallClaude(system, safeMessages, jsonMode === true, claudeKey, mt, model);
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

// ── validateAddressAndDistance ───────────────────────────────────────────────
// Server-side Google Maps proxy (key never exposed to the frontend). Geocodes the
// customer service address and measures distance/travel time from the barber's
// origin. Degrades gracefully to a city/ZIP centroid haversine when the key is
// absent or Maps errors — so a Maps outage NEVER blocks booking (it just lowers
// confidence). Input:  { serviceAddress:{address,city,zip}|string, vendorOrigin:{lat,lng}|{address,city,zip} }
// Output: { ok, formattedAddress, lat, lng, placeId, addressValidationStatus, distanceMiles, travelMinutes, routeConfidence, googleMapsUsed }
const MB_CITY_CENTROIDS = {
  // Bay Area (barber: Tim)
  'san jose': { lat: 37.3382, lng: -121.8863 }, 'santa clara': { lat: 37.3541, lng: -121.9552 },
  'sunnyvale': { lat: 37.3688, lng: -122.0363 }, 'milpitas': { lat: 37.4323, lng: -121.8996 },
  'fremont': { lat: 37.5485, lng: -121.9886 }, 'mountain view': { lat: 37.3861, lng: -122.0839 },
  'cupertino': { lat: 37.3229, lng: -122.0322 }, 'campbell': { lat: 37.2872, lng: -121.9500 },
  // Orange County (barber: Michael)
  'irvine': { lat: 33.6846, lng: -117.8265 }, 'santa ana': { lat: 33.7455, lng: -117.8677 },
  'anaheim': { lat: 33.8366, lng: -117.9143 }, 'garden grove': { lat: 33.7739, lng: -117.9414 },
  'westminster': { lat: 33.7514, lng: -117.9940 }, 'costa mesa': { lat: 33.6411, lng: -117.9187 },
  'tustin': { lat: 33.7458, lng: -117.8261 }, 'orange': { lat: 33.7879, lng: -117.8531 },
  'huntington beach': { lat: 33.6595, lng: -117.9988 }, 'fountain valley': { lat: 33.7092, lng: -117.9536 },
};
const MB_ZIP3_CENTROIDS = {
  '951': { lat: 37.3382, lng: -121.8863 }, '950': { lat: 37.3688, lng: -122.0363 }, // San Jose / Sunnyvale
  '945': { lat: 37.5485, lng: -121.9886 }, // Fremont
  '926': { lat: 33.6846, lng: -117.8265 }, '927': { lat: 33.7455, lng: -117.8677 }, // Irvine / Santa Ana
  '928': { lat: 33.8366, lng: -117.9143 }, '920': { lat: 33.7514, lng: -117.9940 }, // Anaheim / Westminster
};
function mbCityCentroid(city, zip) {
  const c = String(city || '').trim().toLowerCase();
  if (c && MB_CITY_CENTROIDS[c]) return MB_CITY_CENTROIDS[c];
  const z3 = String(zip || '').replace(/\D/g, '').slice(0, 3);
  if (z3 && MB_ZIP3_CENTROIDS[z3]) return MB_ZIP3_CENTROIDS[z3];
  return null;
}
function mbHaversineMiles(a, b) {
  if (!a || !b) return 0;
  const R = 3958.8, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
// Travel-Concierge city coordinates — ONLY for the haversine fallback when the Google
// Maps key is absent (the primary path is Google Distance Matrix). Broader CA/SW coverage
// than MB_CITY_CENTROIDS (which is Bay Area + OC service areas).
const TC_CITY_CENTROIDS = {
  'san diego': { lat: 32.7157, lng: -117.1611 }, 'los angeles': { lat: 34.0522, lng: -118.2437 }, 'long beach': { lat: 33.7701, lng: -118.1937 },
  'san francisco': { lat: 37.7749, lng: -122.4194 }, 'sacramento': { lat: 38.5816, lng: -121.4944 }, 'fresno': { lat: 36.7378, lng: -119.7871 },
  'bakersfield': { lat: 35.3733, lng: -119.0187 }, 'santa barbara': { lat: 34.4208, lng: -119.6982 }, 'san luis obispo': { lat: 35.2828, lng: -120.6596 },
  'monterey': { lat: 36.6002, lng: -121.8947 }, 'santa cruz': { lat: 36.9741, lng: -122.0308 }, 'palm springs': { lat: 33.8303, lng: -116.5453 },
  'las vegas': { lat: 36.1699, lng: -115.1398 }, 'oakland': { lat: 37.8044, lng: -122.2712 }, 'orange county': { lat: 33.7175, lng: -117.8311 },
  'carlsbad': { lat: 33.1581, lng: -117.3506 }, 'oceanside': { lat: 33.1959, lng: -117.3795 }, 'pasadena': { lat: 34.1478, lng: -118.1445 },
  'riverside': { lat: 33.9806, lng: -117.3755 }, 'san bernardino': { lat: 34.1083, lng: -117.2898 }, 'ventura': { lat: 34.2746, lng: -119.2290 },
  'napa': { lat: 38.2975, lng: -122.2869 }, 'solvang': { lat: 34.5958, lng: -120.1377 }, 'temecula': { lat: 33.4936, lng: -117.1484 },
};
function tcCityName(s) { return String(s || '').replace(/\(.*?\)/g, '').split(',')[0].trim().toLowerCase(); }
function tcCentroid(s) { var n = tcCityName(s); return TC_CITY_CENTROIDS[n] || mbCityCentroid(n, '') || null; }
// ── AI Group Travel Concierge — structured trip-plan generator ──────────────
// Public (anonymous) like the other customer-facing AI. Returns a TripPlan JSON
// (days → sections → place cards + per-family transportation + synchronized
// meetup). The frontend (/travel-concierge) falls back to a mock sample plan if
// this is unavailable or returns invalid JSON, so it never crashes. No fake
// prices/confirmations; every place is dataSource:"ai_generated_pending_verification".
function buildGroupTripSystemPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are an expert California group-travel concierge for Du Lich Cali. Plan a shared trip for MULTIPLE families/groups with mixed ages (toddlers, kids, teens, adults, seniors).',
    'Return ONLY valid JSON (no markdown, no commentary) matching this TripPlan shape:',
    '{ "destination","groupName","dateRange","departureCity","summary","assumptions":[],"warnings":[],"totalEstimatedCostRange","meetupPoint","meetupTime","families":[],"liveHighlights":[{ "name","category","note","whenRelevant" }],',
    '  "destinations":[ { "index","city","startDate","endDate","hotelSuggestion":{ "name","area","searchUrl","notes" }|null,"dataSource" } ], "routeOverview":{ "legs":[ { "fromCity","toCity","estimatedDriveTime","estimatedDistance" } ],"totalDriveTime","totalDistance","dataSource" },',
    '  "transportation":[ { "familyName","method"(car|plane|bus|other),"origin","destination","recommendedDepartureTime","estimatedArrivalTime","estimatedCost","bookingStatus","providerName","providerPhone","providerWebsite","ticketSearchUrl","routeSummary","restStops":[],"notes","backupPlan" } ],',
    '  "days":[ { "date","title","theme","summary","destinationIndex"(0-based index into destinations[]),"isTravelDay"(true for a drive/transfer day, else false),"travelLeg":{ "fromCity","toCity","estimatedDriveTime","estimatedDistance","suggestedDepartureTime","suggestedArrivalTime","routeSummary","fatigueNote","toddlerNapNote","seniorNote","mealStops":[ {PlaceCard} ],"restStops":[ { "name","city","note","googleMapsUrl" } ],"backupPlan","dataSource" }|null,"estimatedDrivingTime","estimatedWalkingLevel","sections":[ { "timeOfDay"(morning|lunch|afternoon|dinner|night),"startTime","endTime","title","places":[ {',
    '    "id","name","category","address","latitude","longitude","imageUrl","videoUrl","websiteUrl","reservationUrl","googleMapsUrl","appleMapsUrl","phone","estimatedCost","estimatedDuration","bestTimeToVisit","parkingNotes","kidFriendlyScore"(0-5),"toddlerFriendlyScore","teenFriendlyScore","seniorFriendlyScore","walkingLevel"(low|medium|high),"whySelected","description","tips","backupPlace","dataSource" } ] } ] } ] }',
    'HARD RULES: Use REAL, well-known places with real approximate addresses + lat/lng. Build googleMapsUrl = "https://www.google.com/maps/search/?api=1&query=" + URL-encoded "<name>, <address>" and appleMapsUrl = "https://maps.apple.com/?q=" + URL-encoded "<name>, <address>". Set imageUrl=null and videoUrl=null (only set videoUrl to an official/allowed clip URL if you are certain it exists — never invent one). reservationUrl=null UNLESS a well-known official ticketing site. websiteUrl=official site if well-known else null. estimatedCost = ranges, NEVER fake exact prices. For plane/bus transportation, estimatedCost MUST be "pending verification" and use search links (Google Flights for plane; a search link for Vietnamese bus services like Xe Hoang / Hoang Express for bus). Set dataSource="ai_generated_pending_verification" on EVERY place. Pace around toddler naps and senior walking limits; honor budget, food prefs, interests, accessibility, walking tolerance, drive time, weather, holiday closures; ALWAYS include a synchronized meetupPoint + meetupTime every family can reach, and a backupPlan per family.',
    'OPTIMIZE like an expert planner: produce the BEST balanced plan for ALL families together — minimize total driving and cost while still hitting each family\'s must-haves and interests; CLUSTER nearby places each day to cut transit time; time activities intelligently (toddler-nap downtime in early afternoon, higher-energy/teen activities while toddlers rest, low-walking/seated options for seniors, marquee spots early to beat crowds/heat/traffic); FAIRLY balance every family\'s stated interests across the 3 days (never favor one family); respect the chosen pace and budget. In assumptions/warnings, briefly explain the key time/cost tradeoffs and how the plan fits the whole group.',
    'LIVE / SEASONAL / TRENDING: If the input includes a "liveHighlights" list (current local events/festivals, seasonal natural sightseeing such as flower blooms or whale watching tied to the travel dates, and newly opened or currently highly-rated/trending spots — gathered from live web research), PRIORITIZE weaving the most group-relevant, in-season ones into the daily itinerary where they fit. Reflect the ones you actually used (plus any other current/seasonal picks you are confident about) in the top-level "liveHighlights" array, each with a short "note" and "whenRelevant" (month/season/date). Clearly favor what is in-season and popular right now. NEVER invent events, dates, or prices.',
    'HONOR EACH FAMILY\'S DETAILED PREFERENCES (provided per family in the input): interests[] (beach/aquarium/zoo/theme_park/museums/nature/casino/shopping/food/nightlife/photography/hiking/shows/sports/fishing/cruises/scenic_drives/hidden_gems), foodPrefsKeys[] (vietnamese/japanese/korean/seafood/steakhouse/mexican/vegetarian/fine_dining) plus free-text foodPrefs, kidPrefs[] (arcades/water_parks/roller_coasters/animal_encounters), teenInterests[] (escape_rooms/vr/anime/teen_shopping), seniorNeeds[] (limited_walking/wheelchair_accessible/frequent_breaks) plus free-text accessibility, hotelPrefs[] (resort/airbnb/suites/kitchen/pool/free_breakfast/ocean_view) plus free-text roomNeeds. Match cuisines per family; pick kid/teen activities for the right ages; respect senior mobility (limited_walking/wheelchair → low-walking/seated/accessible picks; frequent_breaks → build in rest stops). Reflect hotelPrefs in any lodging suggestion. tripStyle is relaxed/balanced/packed/luxury/budget (the VIBE/PACE) and is DISTINCT from budget (the SPEND tier) — do not double-count them: luxury vibe = premium picks, budget vibe/tier = free or low-cost first. Continue to FAIRLY balance every family.',
    'MULTI-DESTINATION: The input may include a "destinations" array (ordered cities, each with a "role" and flags). If it has MORE THAN ONE city you MUST plan each destination as a REAL distinct place per its role — never collapse the trip into a single destination. Set every day\'s "destinationIndex"; mark each drive/transfer day "isTravelDay":true with a filled "travelLeg" (fromCity→toCity, realistic drive time/distance, depart/arrive, routeSummary, fatigue/nap/senior notes, real mealStops/restStops); emit the top-level "destinations" array (echo each city; include hotelSuggestion = AREA only, NEVER a price, ONLY when that destination\'s hotelNeeded is true) and a "routeOverview" with one entry per leg.',
    'HONOR EACH DESTINATION ROLE: main_destination → a full day (or more) of activities + dining there. overnight_destination → evening + next-morning activities + a hotel there, then travel onward. stopover → a short activity/visit then continue (no hotel unless hotelNeeded). meal_stop → ONLY a food/rest stop (one restaurant or two; no hotel, no full day). airport_arrival → arrival logistics: pickup/meetup point, nearby food if useful, then the transfer to the next city (no hotel unless hotelNeeded). pass_through → only a brief rest/gas/coffee stop. optional_attraction → include it but clearly mark optional (whySelected notes it is optional) and reflect the time/cost tradeoff (e.g. a full theme-park day vs. continuing). Respect each destination\'s hotelNeeded (suggest lodging ONLY where true), suggestFood/suggestActivities flags, and "hoursToSpend". priority:"optional" stops may be lighter. Example: "Orange County (meal_stop) → San Diego (main)" = Day 1: arrive/meet + an OC dinner, drive to San Diego, check in; then full San Diego days — and NO Orange County hotel.',
    'Write all human-readable text in ' + langName + '. Produce EXACTLY 3 days. BE CONCISE so the plan returns quickly: at most 3 places per day TOTAL (spread across sections), descriptions 1–2 short sentences, tips one short line, liveHighlights at most 5 items. Always set destinationIndex and isTravelDay on every day. Output valid compact JSON only.',
  ].join('\n');
}
// ── Live travel research (Gemini + Google Search grounding) ────────────────
// Surfaces what is POPULAR / SEASONAL / TRENDING right now for the destination
// during the trip dates: local events & festivals, seasonal nature sightseeing
// (flower blooms, whale watching, fall colors…), and newly opened / currently
// top-rated attractions, restaurants, bars, beaches, nightlife, shopping.
// The frontend calls this FIRST, shows the highlights, and passes them into
// generateGroupTripPlan so the AI weaves the in-season/trending picks into the
// itinerary. Web-grounded → no fabricated names/dates; all marked unverified.
function buildTripResearchPrompt(trip, lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  var interests = [];
  try {
    (trip.families || []).forEach(function (f) {
      (f && f.interests || []).forEach(function (i) { if (interests.indexOf(i) < 0) interests.push(i); });
    });
  } catch (e) {}
  return [
    'You are a live travel researcher. Using current web search, find what is POPULAR, SEASONAL, or TRENDING RIGHT NOW for a group trip to ' + (trip.destination || '') + (trip.dateRange ? ' during ' + trip.dateRange : '') + '.',
    'Cover three buckets: (1) local events / festivals / shows / markets happening during those dates; (2) seasonal natural sightseeing tied to that time of year (e.g. wildflower or flower blooms, whale watching, fall foliage, seasonal harvests); (3) newly opened or currently highly-rated / trending attractions, restaurants, bars, beaches, nightlife, and shopping.' + (interests.length ? ' Bias toward these group interests: ' + interests.join(', ') + '.' : ''),
    'Return ONLY valid compact JSON: { "highlights":[ { "name","category"(event|seasonal|attraction|restaurant|bar|beach|nightlife|shopping|other),"note"(one short sentence on why it is notable NOW),"whenRelevant"(month/season/specific dates if time-bound, else "") } ], "sourceNote"(one short line noting recency) }',
    'Rules: ONLY include items you can ground in current search results — do NOT invent names, dates, venues, or prices. No prices. At most 8 highlights; prioritize the most current, in-season, and group-friendly. Write all human-readable text in ' + langName + '. Output valid JSON only, no markdown.',
  ].join('\n');
}
exports.researchTripHighlights = onCall(
  {
    region: 'us-central1',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 45,
    memory: '256MiB',
    cors: true,
  },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    if (!trip.destination) return { ok: false, debugCode: 'NO_DESTINATION', highlights: [] };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', highlights: [] };
    try {
      const text = await serverCallGeminiGrounded(buildTripResearchPrompt(trip, lang), geminiKey, 1100);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
      if (start > 0 || end > 0) raw = raw.slice(start, end + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed) { console.error('[researchTripHighlights] unparseable JSON, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', highlights: [] }; }
      let highlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];
      highlights = highlights.filter(h => h && h.name).slice(0, 8).map(h => ({
        name: String(h.name).slice(0, 120),
        category: String(h.category || 'other').slice(0, 24),
        note: String(h.note || '').slice(0, 220),
        whenRelevant: String(h.whenRelevant || '').slice(0, 60),
      }));
      return { ok: true, highlights, sourceNote: String(parsed.sourceNote || '').slice(0, 160), dataSource: 'live_research_pending_verification' };
    } catch (e) {
      console.error('[researchTripHighlights] failed', e && e.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', highlights: [] };
    }
  }
);
exports.generateGroupTripPlan = onCall(
  {
    region: 'us-central1',
    secrets: [CLAUDE_API_KEY, GEMINI_API_KEY],
    timeoutSeconds: 120,
    memory: '512MiB',
    cors: true,
  },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    if (!trip.destination) return { ok: false, debugCode: 'NO_DESTINATION' };
    const claudeKey = await getAiKey('claude');
    if (!claudeKey) return { ok: false, debugCode: 'NO_CLAUDE_KEY' };
    const system = buildGroupTripSystemPrompt(lang);
    const userContent = 'Plan this group trip. Input JSON:\n' + JSON.stringify({
      groupName: trip.groupName, destination: trip.destination, dateRange: trip.dateRange,
      departureCity: trip.departureCity, tripStyle: trip.tripStyle, budget: trip.budget,
      destinations: Array.isArray(trip.destinations) ? trip.destinations.slice(0, 8) : [],
      families: trip.families, preferences: trip.preferences,
      liveHighlights: Array.isArray(trip.liveHighlights) ? trip.liveHighlights.slice(0, 8) : [],
    });
    try {
      // Fast model + enough tokens to finish the JSON, but bounded to stay under the
      // ~60s request gateway. Sonnet/8k TIMED OUT; Haiku/4k finished in ~32s but the
      // JSON was TRUNCATED (parse error). Haiku/7k + the concise prompt completes the
      // full plan in ~40s and parses cleanly; the mock fallback still covers failures.
      const text = await serverCallClaude(system, [{ role: 'user', content: userContent }], true, claudeKey, 7000, 'claude-haiku-4-5-20251001');
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
      if (start > 0 || end > 0) raw = raw.slice(start, end + 1);
      const plan = JSON.parse(raw);
      if (!plan || !Array.isArray(plan.days) || !plan.days.length) return { ok: false, debugCode: 'INVALID_PLAN' };
      plan.dataSource = plan.dataSource || 'ai_generated_pending_verification';
      return { ok: true, plan };
    } catch (e) {
      console.error('[generateGroupTripPlan] failed', e && e.message);
      return { ok: false, debugCode: 'AI_ERROR' };
    }
  }
);

// ── Multi-destination orchestration: skeleton + per-leg detail ─────────────
// For trips with 3+ destinations a single generateGroupTripPlan call would blow the
// ~60s request gateway (the Sonnet/8k-timeout / Haiku/4k-truncation noted above), so
// the frontend calls generateTripSkeleton ONCE (outline only, no PlaceCards → fast)
// then generateLegDays PER LEG (bounded concurrency) and stitches days back together.
// Both reuse serverCallClaude(haiku)/getAiKey; no new secrets; same anti-fabrication
// rules (imageUrl/videoUrl null, real Maps URLs, cost ranges only, dataSource pending).
function summarizeFamiliesForTrip(families) {
  if (!Array.isArray(families)) return [];
  return families.slice(0, 12).map(function (f) {
    f = f || {};
    return {
      name: f.name || '', adults: f.adults || 0, seniors: f.seniors || 0, childrenAges: f.childrenAges || '',
      interests: Array.isArray(f.interests) ? f.interests.slice(0, 18) : [],
      foodPrefsKeys: Array.isArray(f.foodPrefsKeys) ? f.foodPrefsKeys : [], foodPrefs: typeof f.foodPrefs === 'string' ? f.foodPrefs : '',
      kidPrefs: Array.isArray(f.kidPrefs) ? f.kidPrefs : [], teenInterests: Array.isArray(f.teenInterests) ? f.teenInterests : [],
      seniorNeeds: Array.isArray(f.seniorNeeds) ? f.seniorNeeds : [], hotelPrefs: Array.isArray(f.hotelPrefs) ? f.hotelPrefs : [],
      // V2 stay atmosphere (ocean_view/near_beach/quiet/family_friendly/resort/airbnb/luxury/budget/near_attractions/walkable)
      // — the AI hotel agent maps these to REAL areas/hotels (it is never given hotel names/areas).
      stayPrefs: Array.isArray(f.stayPrefs) ? f.stayPrefs : [],
      // Travelers = adults + seniors + #children-ages (the AI no longer asks for a count).
      travelers: (f.adults || 0) + (f.seniors || 0) + String(f.childrenAges || '').split(/[,\s]+/).filter(function (x) { return /\d/.test(x); }).length,
      // Return-trip logistics: how this family travels + where they head home to.
      transportMethod: (f.transport && f.transport.method) || 'car', origin: (f.transport && f.transport.origin) || '',
    };
  });
}
// Family Analysis Agent (deterministic) — derives GROUP TRAITS (not attractions) from ages +
// seniors + budget + pace, so the AI can score the right signature attractions for THIS group.
function tcGroupProfile(families, budget, pace) {
  families = Array.isArray(families) ? families : [];
  var adults = 0, seniors = 0, ages = [];
  families.forEach(function (f) {
    f = f || {}; adults += (f.adults || 0); seniors += (f.seniors || 0);
    String(f.childrenAges || '').split(/[,\s]+/).forEach(function (x) { var n = parseInt(x, 10); if (!isNaN(n)) ages.push(n); });
  });
  var kids = ages.filter(function (a) { return a <= 12; }).length;
  var teens = ages.filter(function (a) { return a >= 13 && a <= 17; }).length;
  var toddlers = ages.filter(function (a) { return a <= 3; }).length;
  var relaxed = (pace === 'relaxed'), packed = (pace === 'packed'), lowBudget = (budget === 'budget');
  return {
    travelers: adults + seniors + ages.length, adults: adults, seniors: seniors, kids: kids, teens: teens, toddlers: toddlers,
    childFocused: kids > 0, teenFocused: teens > 0, seniorSensitive: seniors > 0, multiGen: seniors > 0 && (kids > 0 || teens > 0),
    thrillSeeking: teens > 0 && !relaxed,
    themeParkAffinity: (kids || teens) ? (lowBudget ? 'medium' : 'high') : (relaxed ? 'low' : 'medium'),
    walkingTolerance: (seniors > 0 || toddlers > 0) ? (seniors > adults ? 'low' : 'medium') : (relaxed ? 'medium' : 'high'),
    energyLevel: packed ? 'high' : (relaxed ? 'low' : 'medium'), budget: budget || 'moderate', pace: pace || 'balanced',
  };
}
// SIGNATURE ATTRACTION INTELLIGENCE — shared reasoning block (teaching examples, NOT a
// hardcoded city→attraction table). Makes the AI reason like a local expert about each
// destination's iconic attractions, scored against the group + constraints.
function signatureAttractionIntel() {
  return 'SIGNATURE ATTRACTION INTELLIGENCE — reason like a LOCAL travel EXPERT, never a generic itinerary generator and NEVER a hardcoded city→attraction rule. For EACH destination: (1) identify its SIGNATURE / iconic attractions — the marquee places people actually travel there FOR; (2) SCORE each against THIS group (use the provided groupProfile) and the constraints; (3) prioritize the high-scoring ones into the plan, dedicating prominent time (often a FULL day) to a top theme-park/zoo. These are ILLUSTRATIVE examples of the KIND of iconic attraction to recognize for ANY destination (apply the SAME reasoning everywhere — do not limit to this list, do not force these exact names): Orange County/Anaheim → Disneyland + Disney California Adventure (very high), Knott’s Berry Farm (high), Little Saigon food + beaches (medium); Hollywood/Los Angeles → Universal Studios Hollywood (very high), Griffith Observatory + Hollywood Walk of Fame (high); San Diego → San Diego Zoo (very high), LEGOLAND + SeaWorld (high), USS Midway + Balboa Park + beaches (medium); Las Vegas → The Strip (very high), Sphere + Fremont Street (high), Hoover Dam (medium); Grand Canyon → South Rim (very high), sunrise/sunset viewpoints (high). SCORE = destination importance × family fit (young kids → zoo / LEGOLAND / theme parks / aquariums; teens → thrill rides / Universal / interactive; seniors → lower-walking, seated, cultural such as Balboa Park / observatories; multi-generation → all-day venues that suit every age, e.g. a zoo) × constraints. LOWER the score (and possibly DROP it) when: budget is very low (theme-park ticket cost dominates), the stop is only a partial/single day, the group dislikes theme parks, weather is poor for an outdoor venue, or walking tolerance is low. NEVER force a low-scoring attraction. For each high-scoring signature attraction, EXPLAIN in one short phrase WHY it fits this group (e.g. "all-day, multi-age venue for two 6-year-olds and two teens"), and if it is TICKETED, note tickets in tips/bookings. The plan must feel like a knowledgeable local chose it for THIS family.';
}
// Phase 3 — group-consensus signals shared by the research prompts: the group's accumulated
// votes become AVOID (skipped → never re-suggest) + PREFER (liked/favorited → feature if it fits).
function tcConsensusPromptLine() {
  return 'GROUP VOTES: if the input has an "avoidPlaces" list, the group SKIPPED those — NEVER suggest any of them (or an obvious rename); pick a different real option instead. If it has a "preferredPlaces" list, the group VOTED THOSE UP — feature or keep them when they genuinely fit (never force an ill-fitting one, never duplicate).';
}
function tcConsensusArrays(data) {
  data = data || {};
  return {
    avoidPlaces: Array.isArray(data.avoidPlaces) ? data.avoidPlaces.slice(0, 40).map((x) => String(x).slice(0, 120)) : [],
    preferredPlaces: Array.isArray(data.preferredPlaces) ? data.preferredPlaces.slice(0, 30).map((x) => String(x).slice(0, 120)) : [],
  };
}
function tcAvoidSet(arr) { const s = {}; (arr || []).forEach((n) => { s[String(n).trim().toLowerCase()] = 1; }); return s; }
function buildTripSkeletonPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are an expert California multi-destination group-travel planner for Du Lich Cali. Produce a high-level TRIP SKELETON (OUTLINE ONLY — NO place cards, NO addresses) for a road trip across several cities for multiple families with mixed ages.',
    'Return ONLY valid JSON (no markdown): { "destinations":[ { "index","city","role","hotelNeeded"(true|false),"startDate","endDate","hotelSuggestion":{ "area","note" }|null } ], "routeOverview":{ "legs":[ { "fromCity","toCity","estimatedDriveTime","estimatedDistance" } ],"totalDriveTime","totalDistance" }, "days":[ { "dayNumber"(1-based),"date","destinationIndex"(0-based into destinations[]),"isTravelDay"(true on a drive/transfer day),"isReturnDay"(true ONLY on the final departure-home day),"title","theme","summary" } ] }',
    'CRITICAL: The "destinations" you output MUST be EXACTLY the input "destinations" cities, same order, and the SAME "index" value on each (echo the cities back). Do NOT add the departureCity or any city not in the input as a destination. Every day\'s "destinationIndex" must be one of those input indices. The departure city is only the trip START — it is NOT a destination.',
    'YOU DETERMINE EACH DESTINATION\'S ROLE (the user does NOT specify it). Classify each input city into exactly one "role" from the geography, the trip dates, the route order and the group: main_destination (a city worth one or more full days), overnight_destination (worth ~a day incl. an overnight), stopover (a brief activity/visit en route), meal_stop (only good for a meal/rest en route), airport_arrival (an airport/arrival gateway), pass_through (just a gas/coffee/rest break). Set "hotelNeeded" true ONLY for cities where the group actually sleeps (main/overnight, or a stopover that clearly needs a night); false for meal_stop/pass_through/airport_arrival and same-day stops. NEVER ask the user — infer it.',
    'RULES: Order days chronologically across all destinations. Insert an isTravelDay:true day for each inter-city drive (its destinationIndex = the ARRIVING city). Leave estimatedDriveTime and estimatedDistance EMPTY (""): VERIFIED distances and drive times come from Google Maps — NEVER estimate or invent them. hotelSuggestion is an AREA/neighborhood only (NEVER a price/exact property) and ONLY for a destination whose hotelNeeded you set true (null otherwise). NO prices, NO fake URLs. Keep each summary to one short sentence.',
    'ALLOCATE DAYS BY THE ROLE YOU ASSIGNED: main_destination → 1+ full day(s). overnight_destination → about a day there (incl. an overnight). stopover → usually fold into a travel day or a short partial day (not a full overnight day) unless it needs a night. meal_stop / airport_arrival / pass_through → do NOT give a full standalone day; fold them into the adjacent travel/arrival day (the arriving day\'s summary mentions the stop). ~2 days per main/overnight city when dates allow; lighter coverage for minor stops. Never give a meal_stop or pass_through its own hotel or full day. Match the day count to the trip dates (see DAY COUNT rule).',
    'DAY COUNT = ACTUAL TRIP LENGTH: if a "dateList" is provided, output EXACTLY one day per entry, in order, using those dates — NEVER omit any, including the final (return) date. Otherwise produce one day per calendar date in dateRange (e.g. "July 2–5" → 4 days: Jul 2,3,4,5). Do NOT hard-cap at 3 days and do NOT pad beyond the real dates. Applies even to a SINGLE-destination trip. The FINAL day MUST be present even though it is the return day.',
    signatureAttractionIntel() + ' At the SKELETON level: when a destination has a high-scoring signature attraction that fits the group, DEDICATE a day (or a major block) to it and NAME it in that day\'s title/summary (e.g. a "San Diego Zoo day"), so the detailed pass builds it out. Use the provided groupProfile (childFocused/teenFocused/seniorSensitive/themeParkAffinity/walkingTolerance) to choose which icons lead.',
    'PINNED MUST-DO ACTIVITIES: if "pinnedActivities" is provided, schedule each one. For a pin with a preferredDayNumber, that day MUST cover it (its destinationIndex should match the pin\'s destination); reflect required pins in that day\'s title/summary. Never silently drop a required pin.',
    'AVOID: if the input includes an "avoidPlaces" list, the group has REJECTED those places — do NOT name any of them in a day title/theme/summary or build the outline around them; centre rejected days on different real attractions instead.',
    'PREFER: if the input includes a "preferredPlaces" list, the group VOTED THOSE UP (liked/favorited) — favour featuring them in the relevant city\'s days/titles when they genuinely fit; never force an ill-fitting one and never duplicate.',
    'DAY ROLES: Day 1 is the ARRIVAL / travel-in day (lighter — get there, check in, an easy evening). Middle days are the main activity days. Its destinationIndex stays the last destination on the final day (the day starts there before driving/flying home).',
    'FINAL-DAY MODE (generic — applies to ANY trip, never hardcoded to a city/date): the input "finalDayMode" controls the LAST day\'s shape. "return_day" → the final day is the return/departure day (set isReturnDay:true; title/theme/summary about checkout + heading home, NOT a full day of attractions). "half_day" → a HALF day: a short morning of light, nearby activity THEN checkout + travel home that afternoon (set isReturnDay:true — it is still a mixed return day). "full_day" → a normal full activity day (do NOT set isReturnDay). "ai_decide" or empty → YOU decide based on the distance/journey home, the hotel checkout time, whether young kids or seniors are in the group, and the overall pace: a long drive/flight home or tired travelers → lean return_day; a short hop home with energy to spare → half_day or full_day. WHICHEVER mode, the final dated day MUST still exist (never drop it). (Legacy: if "lastDayFull" is true treat it as "full_day".)',
    'Write all human-readable text in ' + langName + '. Output compact JSON only.',
  ].join('\n');
}
exports.generateTripSkeleton = onCall(
  { region: 'us-central1', secrets: [CLAUDE_API_KEY], timeoutSeconds: 45, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const dests = Array.isArray(trip.destinations) ? trip.destinations : [];
    if (!dests.length) return { ok: false, debugCode: 'NO_DESTINATIONS' };
    const claudeKey = await getAiKey('claude');
    if (!claudeKey) return { ok: false, debugCode: 'NO_CLAUDE_KEY' };
    const userContent = 'Outline this multi-destination group trip. Input JSON:\n' + JSON.stringify({
      groupName: trip.groupName, departureCity: trip.departureCity, dateRange: trip.dateRange,
      dateList: Array.isArray(request.data && request.data.dateList) ? request.data.dateList.slice(0, 30) : [],
      tripStyle: trip.tripStyle, budget: trip.budget, destinations: dests.slice(0, 8),
      lastDayFull: !!trip.lastDayFull, finalDayMode: trip.finalDayMode || (trip.lastDayFull ? 'full_day' : 'ai_decide'),
      pinnedActivities: Array.isArray(trip.pinnedActivities) ? trip.pinnedActivities.slice(0, 12) : [],
      avoidPlaces: Array.isArray(data.avoidPlaces) ? data.avoidPlaces.slice(0, 40).map(x => String(x).slice(0, 120)) : [],
      preferredPlaces: Array.isArray(data.preferredPlaces) ? data.preferredPlaces.slice(0, 30).map(x => String(x).slice(0, 120)) : [],
      familiesSummary: summarizeFamiliesForTrip(trip.families), groupProfile: tcGroupProfile(trip.families, trip.budget, trip.tripStyle), preferences: trip.preferences,
      liveHighlights: Array.isArray(trip.liveHighlights) ? trip.liveHighlights.slice(0, 8) : [],
    });
    try {
      const text = await serverCallClaude(buildTripSkeletonPrompt(lang), [{ role: 'user', content: userContent }], true, claudeKey, 2500, 'claude-haiku-4-5-20251001');
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const skeleton = JSON.parse(raw);
      if (!skeleton || !Array.isArray(skeleton.days) || !skeleton.days.length) return { ok: false, debugCode: 'INVALID_SKELETON' };
      skeleton.dataSource = 'ai_generated_pending_verification';
      if (skeleton.routeOverview) skeleton.routeOverview.dataSource = 'ai_generated_pending_verification';
      return { ok: true, skeleton };
    } catch (e2) {
      console.error('[generateTripSkeleton] failed', e2 && e2.message);
      return { ok: false, debugCode: 'AI_ERROR' };
    }
  }
);
// Bound a richer leg day so one runaway day can't bloat the trip doc: cap sections,
// places/section, popularDishes, and normalize alternatives to short strings.
function clampLegDay(d) {
  if (!d || typeof d !== 'object') return;
  const s = (v, n) => (v == null ? '' : String(v).slice(0, n));
  if (Array.isArray(d.sections)) {
    d.sections = d.sections.slice(0, 6).map((sec) => {
      if (sec && Array.isArray(sec.places)) sec.places = sec.places.slice(0, 6).map((p) => {
        if (p && Array.isArray(p.popularDishes)) p.popularDishes = p.popularDishes.slice(0, 4).map((x) => s(x, 60));
        return p;
      });
      return sec;
    });
  }
  if (d.alternatives && typeof d.alternatives === 'object') {
    ['kidFriendly', 'toddlerLowEnergy', 'teenOption', 'seniorLowWalking', 'rainyDay', 'foodBackup'].forEach((k) => {
      const v = d.alternatives[k];
      d.alternatives[k] = Array.isArray(v) ? v.slice(0, 3).map((x) => s(x, 160)).join(' · ') : s(v, 200);
    });
  }
}
function buildLegDaysPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are an expert California group-travel concierge for Du Lich Cali. Fill in the FULL daily detail for ONE LEG (one city, possibly preceded by an inbound travel day) of a larger multi-destination group trip for multiple families with mixed ages.',
    'You are given the leg city, its dates, and the specific day stubs to detail. Return ONLY valid JSON: { "days":[ { "date","title","theme","summary","destinationIndex","isTravelDay","isReturnDay"(echo the stub\'s value),"travelLeg":{ "fromCity","toCity","estimatedDriveTime","estimatedDistance","suggestedDepartureTime","suggestedArrivalTime","routeSummary","fatigueNote","toddlerNapNote","seniorNote","mealStops":[ {PlaceCard} ],"restStops":[ { "name","city","note","googleMapsUrl" } ],"backupPlan","dataSource" }|null,"estimatedDrivingTime","estimatedWalkingLevel","sections":[ { "timeOfDay"(morning|lunch|afternoon|dinner|evening),"startTime","endTime","title","places":[ {PlaceCard} ] } ],"alternatives":{ "kidFriendly","toddlerLowEnergy","teenOption","seniorLowWalking","rainyDay","foodBackup" } } ] }',
    'PlaceCard = { "id","name","category","address","latitude","longitude","imageUrl":null,"videoUrl":null,"websiteUrl","reservationUrl","googleMapsUrl","appleMapsUrl","phone","estimatedCost","estimatedDuration","bestTimeToVisit","parkingNotes","popularDishes":[](1-2 well-known signature dishes for restaurant/food cards, else []),"kidFriendlyScore"(0-5),"toddlerFriendlyScore"(0-5),"teenFriendlyScore"(0-5),"seniorFriendlyScore"(0-5),"walkingLevel"(low|medium|high),"whySelected","description","tips","backupPlace","dataSource" }.',
    'HARD RULES: Use REAL, well-known places in the leg city with real approximate addresses + lat/lng. Build googleMapsUrl = "https://www.google.com/maps/search/?api=1&query=" + URL-encoded "<name>, <address>" and appleMapsUrl = "https://maps.apple.com/?q=" + URL-encoded "<name>, <address>". imageUrl=null, videoUrl=null. reservationUrl=null unless a well-known official ticketing site; websiteUrl=official site if well-known else null. estimatedCost = ranges, NEVER fake exact prices. popularDishes = real signature dishes only (no prices). Set dataSource="ai_generated_pending_verification" everywhere. For a day with isTravelDay:true, fill ONLY the travelLeg NARRATIVE (routeSummary, fatigueNote, toddlerNapNote, seniorNote, optional REAL mealStops/restStops along the route, backupPlan) and keep that day\'s sections minimal. LEAVE estimatedDriveTime, estimatedDistance, suggestedDepartureTime and suggestedArrivalTime as "" — VERIFIED distance/time/ETA come from Google Maps, NEVER from you (you may still describe traffic in routeSummary, e.g. "expect heavy traffic around LA"). Honor each family\'s interests/food/kid/teen/senior/hotel preferences; pace around toddler naps + senior mobility.',
    'HONOR THIS LEG\'S "role" (given in the input leg): main_destination → a full, balanced day. overnight_destination → evening + next-morning highlights. stopover → one short activity/visit. meal_stop → ONLY restaurant(s)/a rest stop (no all-day plan). airport_arrival → arrival logistics: a meetup point near the airport, nearby food if useful, then the onward transfer (use the travelLeg). pass_through → just a brief rest/gas/coffee stop. optional_attraction → include it but set whySelected to note it is OPTIONAL and mention the time/cost tradeoff (and a ticket/reservation reminder for ticketed attractions). Respect the leg\'s suggestFood/suggestActivities flags (skip the category if false) and "hoursToSpend". Do NOT propose lodging for this leg unless its hotelNeeded is true.',
    'INBOUND TRANSPORT: the input leg may carry "transportPreference" (bus|private_ride|flight|car|train|any) and "preferredProvider" (e.g. a named bus operator or "Michael / Du Lich Cali"). On this leg\'s travel day, reflect the user\'s choice in the travelLeg narrative — e.g. arrive by that mode/provider at its real dropoff area, then any transfer to the hotel — and pace the day around it. If it is "any"/blank, describe a sensible arrival. NEVER invent exact schedules/prices; keep them "pending verification".',
    'DEPTH (no fixed cap): a FULL day at a main_destination or overnight_destination must be RICH — build morning + lunch + afternoon + dinner + evening sections with 4–6 meaningful place/restaurant cards TOTAL across the day, clustered geographically to minimise transit, and timed around toddler naps (quieter early-afternoon) and senior mobility. The lunch and dinner sections MUST be REAL restaurants matched to the families\' cuisine preferences, each with 1–2 popularDishes. THINK LIKE A LOCAL: if the leg city has a famous food community matching those cuisines, pick REAL neighborhood favorites there, never generic chains (e.g. Orange County\'s Little Saigon for Vietnamese — Pho 79 / Phoholic, Brodard, bun bo hue at Ngu Binh, oc/seafood at Oc & Lau, coffee/dessert at 7 Leaves / Che Cali). Lighter days carry fewer cards: stopover 1–2, meal_stop 1–2 (food only), airport_arrival 1–2 + transfer, pass_through 1, isTravelDay → mostly the travelLeg + optional mealStops.',
    'RETURN / DEPARTURE DAY: if a day stub has isReturnDay:true, plan it as the journey HOME, NOT a full activity day. Sections: a relaxed breakfast near the hotel, hotel checkout + packing, then AT MOST ONE short, nearby, optional, low-risk stop ONLY if time clearly allows (a quick photo spot — never a water park, theme park, marquee attraction or all-day outing), then a "Heading home" section covering the return to the departure city by each family\'s transportMethod: car → a realistic drive home with rest/meal/gas (or charging) stops and toddler-nap + senior-comfort timing; plane → airport arrival time, baggage, rental-car return, and a TSA/security buffer; bus → the pickup station and a buffer. Mention traffic if relevant. Keep it calm and low-stress.',
    'FINAL-DAY MODE override (generic — never hardcoded): if the input "finalDayMode" is "full_day", ignore the return-day rule for the final day and plan a normal full activity day. If it is "half_day" and the day stub is the final/return day, plan a SHORT morning of light, nearby activity (1–2 low-risk stops) FIRST, THEN checkout + the "Heading home" journey in the afternoon — a calm mixed day, not a full day and not a pure travel day. "return_day" → follow the return-day rule above. "ai_decide"/empty → respect the stub\'s isReturnDay flag as given.',
    'For EACH day also fill "alternatives" with ONE short, concrete suggestion per category: kidFriendly (a fun swap for younger kids), toddlerLowEnergy (a calm/nap-friendly option), teenOption (something teens prefer), seniorLowWalking (a low-walking/seated/accessible option), rainyDay (an indoor backup), foodBackup (an alternative restaurant). Use REAL place names where possible; NO fake prices/URLs; one short phrase each.',
    signatureAttractionIntel() + ' At the DETAIL level: if a day\'s title/theme/summary centers on a signature attraction (or one scores high for this group on this leg), BUILD it as a real, prominent PlaceCard with the right time block (often most of the day for a theme park/zoo), age-appropriate pacing, and a "whySelected" that states WHY it ranks for this group; if it is ticketed, put a tickets reminder in "tips". MULTI-GENERATION: when the group has both young kids/teens AND seniors, you may SPLIT a block (e.g. morning whole-family at the zoo; afternoon teens to thrill rides while grandparents rest / adults get coffee) and describe both in the section. Do NOT force a low-scoring attraction.',
    'AVOID: if the input includes an "avoidPlaces" list, NEVER include any place whose name matches one of them — the user explicitly skipped those; pick different real places instead.',
    'PREFER: if the input includes a "preferredPlaces" list, the group VOTED THOSE UP (liked/favorited) — include the ones that genuinely fit THIS leg/day as real PlaceCards (the group will be happiest seeing them kept); never force an ill-fitting one and never duplicate.',
    'PINNED MUST-DO: if "pinnedActivities" is provided, for any pin whose preferredDayNumber matches a day you are detailing (or whose destination matches THIS leg and it has no preferred day), you MUST include that EXACT activity in that day at its preferredTimeOfDay (else flexible), as a real PlaceCard with a ticket/reservation reminder in "tips" and kid/toddler/senior pacing around it. A "required" pin must NOT be dropped or moved away; if truly impossible, place it on the closest day and explain why in whySelected.',
    'Write all human-readable text in ' + langName + '. Detail ONLY the given day stubs for THIS leg, in order, returning exactly that many day objects. Be concrete but concise (descriptions 1–2 sentences, tips one line). Output compact JSON only.',
  ].join('\n');
}
exports.generateLegDays = onCall(
  { region: 'us-central1', secrets: [CLAUDE_API_KEY], timeoutSeconds: 90, memory: '512MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const leg = data.leg || {};
    const daySpecs = Array.isArray(data.daySpecs) ? data.daySpecs : [];
    if (!leg.city || !daySpecs.length) return { ok: false, debugCode: 'NO_LEG' };
    const claudeKey = await getAiKey('claude');
    if (!claudeKey) return { ok: false, debugCode: 'NO_CLAUDE_KEY' };
    const trip = data.trip || {};
    const userContent = 'Detail this leg. Input JSON:\n' + JSON.stringify({
      tripStyle: trip.tripStyle, budget: trip.budget,
      departureCity: trip.departureCity || '', lastDayFull: !!trip.lastDayFull, finalDayMode: trip.finalDayMode || (trip.lastDayFull ? 'full_day' : 'ai_decide'),
      avoidPlaces: Array.isArray(data.avoidPlaces) ? data.avoidPlaces.slice(0, 40).map(x => String(x).slice(0, 120)) : [],
      preferredPlaces: Array.isArray(data.preferredPlaces) ? data.preferredPlaces.slice(0, 30).map(x => String(x).slice(0, 120)) : [],
      pinnedActivities: Array.isArray(data.pinnedActivities) ? data.pinnedActivities.slice(0, 12) : [],
      familiesSummary: summarizeFamiliesForTrip(trip.families), groupProfile: tcGroupProfile(trip.families, trip.budget, trip.tripStyle), preferences: trip.preferences,
      // Pass the leg's ROLE + flags so the prompt's role-handling has data to honor.
      leg: {
        index: leg.index, city: leg.city, startDate: leg.startDate, endDate: leg.endDate, hotelSuggestion: leg.hotelSuggestion || null,
        role: leg.role || 'main_destination', hotelNeeded: leg.hotelNeeded !== false, mealOnly: !!leg.mealOnly,
        suggestFood: leg.suggestFood !== false, suggestActivities: leg.suggestActivities !== false,
        hoursToSpend: leg.hoursToSpend || '', priority: leg.priority || 'required',
      },
      daySpecs: daySpecs.slice(0, 3),
      liveHighlights: Array.isArray(data.liveHighlights) ? data.liveHighlights.slice(0, 6) : [],
    });
    try {
      // The frontend sends ONE day per call (server caps at 3 as a backstop); ~7k token
      // ceiling + 90s function timeout leave headroom, and salvage recovers a truncated
      // day into partial sections instead of failing the whole call.
      const text = await serverCallClaude(buildLegDaysPrompt(lang), [{ role: 'user', content: userContent }], true, claudeKey, 7000, 'claude-haiku-4-5-20251001');
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || !Array.isArray(parsed.days) || !parsed.days.length) return { ok: false, debugCode: 'INVALID_LEG' };
      parsed.days.forEach(function (d) { if (d) { d.dataSource = d.dataSource || 'ai_generated_pending_verification'; clampLegDay(d); } });
      return { ok: true, days: parsed.days };
    } catch (e2) {
      console.error('[generateLegDays] failed', e2 && e2.message);
      return { ok: false, debugCode: 'AI_ERROR' };
    }
  }
);

// ── Travel Booking Concierge — research WHAT to reserve (no purchasing) ─────
// Given the trip, recommends which items the group should reserve/buy tickets for
// (flights, hotels, rentals, theme-park/attraction tickets, restaurant reservations,
// tours, parking, rental cars, bus) with a recommendation, a rough/labelled price
// range, and general deadline/cancellation guidance. STRICT no-fake rules: NO exact
// guaranteed prices, NO availability, NO confirmation numbers, NO URLs (the frontend
// builds official/search links deterministically to avoid fabricated links). The AI
// NEVER purchases anything — this only researches. Gemini + Google Search grounding.
function buildBookingResearchPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are a travel-booking research assistant for Du Lich Cali. Given a group trip (cities, dates, families with ages, and key planned places), identify which items the group should RESERVE or buy tickets for, and recommend the best option for the group. You ONLY research and recommend — you NEVER purchase, reserve, or generate confirmations.',
    'Return ONLY valid JSON (no markdown): { "items":[ { "type"(flight|hotel|airbnb|attraction|restaurant|tour|parking|rental_car|bus|ride),"title","city","provider"(a well-known booking provider or brand name, or ""),"priceRange"(a ROUGH range clearly labelled, or "pending verification" — NEVER an exact guaranteed price),"recommendedOption"(one short line: which category/option to pick and why for this group),"deadline"(RELATIVE guidance like "book 1–2 months ahead" — never a fabricated exact date),"cancellationNote"(general guidance to check the official refund policy),"dataSource":"ai_researched_pending_verification" } ] }',
    'RULES: Include ONLY items that genuinely need a reservation or ticket for THIS trip (e.g. a theme-park day → tickets; a popular restaurant → reservation; a flight/hotel/rental per the families\' transport). At most 10 items, prioritised by importance and deadline. Do NOT invent venue names that would not plausibly exist in the destination. NEVER output exact prices, availability, confirmation numbers, or URLs. Honor family size, toddlers, seniors, and budget in the recommendation. Write all human-readable text in ' + langName + '. Output compact JSON only.',
  ].join('\n');
}
exports.researchTripBookings = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 45, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    if (!trip.destination && !(Array.isArray(trip.destinations) && trip.destinations.length)) return { ok: false, debugCode: 'NO_DESTINATION', items: [] };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', items: [] };
    const userContent = 'Recommend what to reserve/buy tickets for this group trip. Input JSON:\n' + JSON.stringify({
      destination: trip.destination,
      destinations: Array.isArray(trip.destinations) ? trip.destinations.slice(0, 8) : [],
      dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle,
      familiesSummary: summarizeFamiliesForTrip(trip.families),
      keyPlaces: Array.isArray(trip.keyPlaces) ? trip.keyPlaces.slice(0, 24) : [],
    });
    try {
      const text = await serverCallGeminiGrounded(buildBookingResearchPrompt(lang) + '\n\n' + userContent, geminiKey, 1400);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed) { console.error('[researchTripBookings] unparseable JSON, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', items: [] }; }
      let items = Array.isArray(parsed.items) ? parsed.items : [];
      const TYPES = ['flight', 'hotel', 'airbnb', 'attraction', 'restaurant', 'tour', 'parking', 'rental_car', 'bus', 'ride'];
      items = items.filter(it => it && it.title).slice(0, 10).map(it => ({
        type: TYPES.indexOf(String(it.type)) !== -1 ? it.type : 'attraction',
        title: String(it.title).slice(0, 140),
        city: String(it.city || '').slice(0, 80),
        provider: String(it.provider || '').slice(0, 80),
        priceRange: String(it.priceRange || 'pending verification').slice(0, 80),
        recommendedOption: String(it.recommendedOption || '').slice(0, 280),
        deadline: String(it.deadline || '').slice(0, 80),
        cancellationNote: String(it.cancellationNote || '').slice(0, 200),
        dataSource: 'ai_researched_pending_verification',
      }));
      return { ok: true, items };
    } catch (e2) {
      console.error('[researchTripBookings] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', items: [] };
    }
  }
);
// ── "Where to Stay": per-destination lodging research (hotels + Airbnb areas) ──
// For each destination that needs lodging, recommends the best AREA + several hotel
// options (budget / best-value / family / luxury / pool / breakfast / kitchen) and a
// few Airbnb search areas, with amenities, parking/distance notes, and WHY — but NO
// fabricated exact prices, availability, or booking URLs (the frontend builds official
// /search links). Gemini + Google Search grounding. dataSource always pending.
// Best-effort repair of a truncated JSON object from a (token-capped) model
// response. Tries a straight parse first; on failure, rewinds to the last
// fully-closed bracket at depth>=1, then re-closes the still-open ancestor
// containers so the salvaged prefix is valid JSON. Returns the parsed object,
// or null if nothing usable can be recovered. String state is tracked so
// braces/brackets inside string values are never miscounted.
function tripSalvageJson(raw) {
  if (raw == null) return null;
  // Gemini google_search grounding injects citation markers like "[cite: 3, 12]" /
  // "[cite_start]" into the text — strip them so they don't break JSON.parse.
  var s = String(raw).replace(/\[cite[^\]]*\]/gi, '');
  try { return JSON.parse(s); } catch (_) {}
  var stack = [], inStr = false, esc = false, safeLen = -1, safeStack = null;
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length) { safeLen = i + 1; safeStack = stack.slice(); }
    }
  }
  if (safeLen < 0 || !safeStack) return null;
  var out = s.slice(0, safeLen).replace(/,\s*$/, '');
  for (var j = safeStack.length - 1; j >= 0; j--) out += safeStack[j];
  try { return JSON.parse(out); } catch (_) { return null; }
}
function buildStaysResearchPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are an expert lodging concierge for Du Lich Cali who acts like a PERSONAL TRAVEL AGENT. The group does NOT know the destination — so YOU decide the best AREA(s), the best HOTELS by category, and (across destinations) the smartest hotel STRATEGY, using current web knowledge. You ONLY research/recommend — never book or charge. The goal: the group thinks "wow, I never would have thought of staying there."',
    'Return ONLY valid JSON (no markdown): { "stays":[ { "city","bestArea","whyArea"(one sentence),"bestAreas":[ { "area","why"(one short phrase),"reasons":[2-4 very short checkmark phrases e.g. "Close to the Zoo","Ocean view","Family friendly","Easy parking"] } ],"hotels":[ { "name"(a real, well-known hotel/brand if confident, else ""),"area","category"(best_overall|best_value|family|luxury|resort|ocean_view|food_area|theme_parks|disneyland|budget|pool|breakfast|kitchen|accessible),"starRating"(rough number like "4.5" ONLY if grounded in search, else ""),"reviewCount"(rough like "2k+" ONLY if grounded, else ""),"amenities":[≤4 short],"breakfast"(bool),"kitchen"(bool),"pool"(bool),"familySuite"(bool),"oceanDistance"(short phrase or ""),"attractionDistances":[ { "name","distance"(rough drive/walk) } ](≤2),"parkingNote","priceRange"("pending verification" or a rough range/$/$$/$$$ — NEVER an exact/guaranteed price),"why"(one short sentence),"dataSource":"ai_researched_pending_verification" } ],"airbnbAreas":[ { "area","bestFor"(family|budget|kitchen|space),"why" } ] } ], "strategies":[ { "name"(single_base|split_nights|cheapest|near_attraction),"label"(short),"nights":[ { "city","nights" } ],"costRange"(rough total "(est.)" or "pending verification"),"driving"(one phrase),"convenience"(one phrase),"kidsNote"(one phrase),"foodNote"(one phrase),"why"(one sentence),"recommended"(bool) } ] }',
    'CATEGORIES: present a SPREAD of category-labelled picks across the trip — always Best Overall, Best Value and Best For Families, PLUS an Ocean View pick when the group likes the coast/ocean, a Best Food Area pick when food is a priority, and a Best For Theme Parks / Disneyland pick when those are relevant. ALWAYS return AT LEAST 3 hotels (ideally 3–5) for EVERY city — NEVER fewer than 3; if you are not confident of exact hotel names, still provide 3 distinct area-anchored options labelled by category. Span budget→luxury, including a family suite/kitchen/pool option when there are kids/toddlers and a low-walking/accessible option when there are seniors. Recommend 1–3 best AREAS per city with concrete reasons.',
    'You DETERMINE areas + hotels from the families\' "stayPrefs" atmosphere (ocean_view/near_beach/quiet/family_friendly/resort/airbnb/luxury/budget/near_attractions/walkable), budget and any destination "hotelPrefs" — map atmosphere words to REAL neighborhoods (e.g. "near_beach" → a real beachfront area; theme-park interest → the hotel district by the park). The user never gives hotel names or areas — YOU choose them. Optimise to minimise driving/traffic, maximise experience/safety/food/family-friendliness, and MINIMISE hotel changes. 2 Airbnb AREAS (not fake listings).',
    'MULTI-DESTINATION STRATEGY (include "strategies" ONLY when there are 2+ lodging destinations; otherwise omit it or return []): compare realistic stay strategies and mark exactly ONE recommended:true — e.g. single_base (one central base + day trips), split_nights (X nights here, Y there), cheapest (lowest total), near_attraction (next to the big attraction first, then move). For each give rough cost, driving, convenience, a kids note, a food note and WHY. Favour fewer hotel changes for families with young kids/seniors.',
    tcConsensusPromptLine(),
    'NEVER output exact prices, availability, confirmation numbers, or URLs (priceRange/costRange = "pending verification" or a rough range; the app builds the booking links). BE CONCISE so the JSON stays small and valid: every text field ONE short phrase; amenities ≤4; no markdown, no commentary, no trailing commas. Write all human-readable text in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.researchTripStays = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 60, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const dests = (Array.isArray(trip.destinations) ? trip.destinations : []).filter(d => d && (d.city || '').trim() && d.hotelNeeded !== false);
    if (!dests.length) return { ok: false, debugCode: 'NO_LODGING_DESTINATIONS', stays: [] };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', stays: [] };
    const cons = tcConsensusArrays(data); const avoidSet = tcAvoidSet(cons.avoidPlaces);
    const userContent = 'Recommend where to stay. Input JSON:\n' + JSON.stringify({
      dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle,
      destinations: dests.slice(0, 6).map(d => ({ city: d.city, role: d.role, hotelNeeded: d.hotelNeeded !== false, notes: d.notes || '', hotelPrefs: Array.isArray(d.hotelPrefs) ? d.hotelPrefs : [] })),
      avoidPlaces: cons.avoidPlaces, preferredPlaces: cons.preferredPlaces,
      familiesSummary: summarizeFamiliesForTrip(trip.families),
    });
    try {
      const text = await serverCallGeminiGrounded(buildStaysResearchPrompt(lang) + '\n\n' + userContent, geminiKey, 7000);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed) { console.error('[researchTripStays] unparseable JSON, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', stays: [] }; }
      // Category enum (back-compat: legacy "bestFor" is read when "category" is absent).
      const CATS = ['best_overall', 'best_value', 'family', 'luxury', 'resort', 'ocean_view', 'food_area', 'theme_parks', 'disneyland', 'budget', 'pool', 'breakfast', 'kitchen', 'accessible'];
      const catOf = (h) => CATS.indexOf(String(h.category || h.bestFor)) !== -1 ? (h.category || h.bestFor) : 'best_value';
      let stays = Array.isArray(parsed.stays) ? parsed.stays : [];
      stays.forEach(s2 => { if (s2 && Array.isArray(s2.hotels)) s2.hotels = s2.hotels.filter(h => h && !avoidSet[String(h.name || h.area || '').trim().toLowerCase()]); }); // drop any group-skipped hotel
      stays = stays.filter(s2 => s2 && s2.city).slice(0, 6).map(s2 => ({
        city: String(s2.city).slice(0, 80),
        bestArea: String(s2.bestArea || '').slice(0, 100),
        whyArea: String(s2.whyArea || '').slice(0, 240),
        bestAreas: (Array.isArray(s2.bestAreas) ? s2.bestAreas : []).filter(a => a && a.area).slice(0, 3).map(a => ({
          area: String(a.area).slice(0, 100), why: String(a.why || '').slice(0, 160),
          reasons: (Array.isArray(a.reasons) ? a.reasons : []).slice(0, 4).map(x => String(x).slice(0, 48)),
        })),
        hotels: (Array.isArray(s2.hotels) ? s2.hotels : []).filter(h => h).slice(0, 6).map(h => ({
          name: String(h.name || '').slice(0, 120),
          area: String(h.area || '').slice(0, 100),
          category: catOf(h), bestFor: catOf(h), // bestFor kept as a legacy alias
          starRating: String(h.starRating || '').slice(0, 8), reviewCount: String(h.reviewCount || '').slice(0, 16),
          amenities: (Array.isArray(h.amenities) ? h.amenities : []).slice(0, 6).map(x => String(x).slice(0, 40)),
          breakfast: !!h.breakfast, kitchen: !!h.kitchen, pool: !!h.pool, familySuite: !!h.familySuite,
          oceanDistance: String(h.oceanDistance || '').slice(0, 60),
          attractionDistances: (Array.isArray(h.attractionDistances) ? h.attractionDistances : []).filter(a => a && a.name).slice(0, 2).map(a => ({ name: String(a.name).slice(0, 60), distance: String(a.distance || '').slice(0, 40) })),
          parkingNote: String(h.parkingNote || '').slice(0, 120),
          distanceNote: String(h.distanceNote || '').slice(0, 120),
          priceRange: String(h.priceRange || 'pending verification').slice(0, 80),
          why: String(h.why || '').slice(0, 200),
          dataSource: 'ai_researched_pending_verification',
        })),
        airbnbAreas: (Array.isArray(s2.airbnbAreas) ? s2.airbnbAreas : []).filter(x => x).slice(0, 4).map(x => ({
          area: String(x.area || '').slice(0, 100), bestFor: String(x.bestFor || '').slice(0, 40), why: String(x.why || '').slice(0, 200),
        })),
      }));
      const SNAMES = ['single_base', 'split_nights', 'cheapest', 'near_attraction'];
      let strategies = (Array.isArray(parsed.strategies) ? parsed.strategies : []).filter(x => x && (x.name || x.label)).slice(0, 4).map(x => ({
        name: SNAMES.indexOf(String(x.name)) !== -1 ? x.name : 'single_base',
        label: String(x.label || '').slice(0, 80),
        nights: (Array.isArray(x.nights) ? x.nights : []).filter(n => n && n.city).slice(0, 6).map(n => ({ city: String(n.city).slice(0, 80), nights: (parseInt(n.nights, 10) || 0) })),
        costRange: String(x.costRange || 'pending verification').slice(0, 80),
        driving: String(x.driving || '').slice(0, 120), convenience: String(x.convenience || '').slice(0, 120),
        kidsNote: String(x.kidsNote || '').slice(0, 120), foodNote: String(x.foodNote || '').slice(0, 120),
        why: String(x.why || '').slice(0, 240), recommended: !!x.recommended,
        dataSource: 'ai_researched_pending_verification',
      }));
      if (dests.length < 2) strategies = []; // strategies only matter with 2+ lodging stops
      if (strategies.length && !strategies.some(s3 => s3.recommended)) strategies[0].recommended = true;
      return { ok: true, stays, strategies };
    } catch (e2) {
      console.error('[researchTripStays] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', stays: [] };
    }
  }
);
// Research ONE user-named place (e.g. "Pho 79, Garden Grove"). Returns labeled,
// never-faked details + a placement suggestion. Photos + rating come ONLY from Google Places.
exports.researchUserPlace = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY, GOOGLE_MAPS_API_KEY], timeoutSeconds: 60, memory: '256MiB', cors: true },
  async (request) => {
    const uid = tripRequireAuth(request);
    const d = request.data || {};
    const tripId = String(d.tripId || '');
    const role = await tripCallerRole(tripId, uid);
    if (!role) throw new HttpsError('permission-denied', 'Join this trip to add places.');
    const name = String(d.name || '').trim();
    if (!name) return { ok: false, debugCode: 'NO_NAME' };
    const lang = (d.lang === 'vi' || d.lang === 'es') ? d.lang : 'en';
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY' };

    const ctx = d.tripContext || {};
    const userContent = 'Research this ONE place the user already chose. Input JSON:\n' + JSON.stringify({
      name: name, area: String(d.area || '').slice(0, 120), placeType: String(d.placeType || '').slice(0, 40),
      mealType: String(d.mealType || '').slice(0, 20), notes: String(d.notes || '').slice(0, 300),
      destinations: Array.isArray(ctx.destinations) ? ctx.destinations.slice(0, 6) : [],
      dayContents: Array.isArray(ctx.dayContents) ? ctx.dayContents.slice(0, 10) : [],
      hotelsByCity: ctx.hotelsByCity || {}, groupProfile: ctx.groupProfile || {},
    });
    const prompt = [
      'You are a LOCAL concierge for Du Lich Cali. The user already chose a specific place; research it using current web knowledge. You ONLY research — never reserve or charge.',
      'Return ONLY valid JSON (no markdown): { "place": { "name","address"(approx street + city, no fake suite),"rating"(rough star ONLY if grounded, e.g. "4.6★", else ""),"reviewCount"(e.g. "2k+" only if grounded, else ""),"hours"(short, only if grounded, else ""),"popularDishes":[up to 4 real signature items],"priceRange"("pending verification" or rough $/$$/$$$ — NEVER exact),"parkingNote"(short),"kidSuitability"(short),"seniorSuitability"(short),"estimatedDuration"(e.g. "1–2 hours"),"reservationNote"(walk-in ok / reserve ahead),"why"(one sentence) }, "suggestedPlacement": { "day"(0-based index into dayContents),"slot"(morning|lunch|afternoon|dinner|evening),"reason"(one sentence),"fits"(true|false) } }',
      'NEVER output exact prices, availability, confirmation numbers, phone numbers, or website/reservation URLs. NEVER output photos or image URLs. If you are not confident of a fact, leave that field "" — do not guess.',
      'For suggestedPlacement, reason from the provided dayContents, hotels, route, opening hours, mealType and the group mix (kids/seniors). Pick the day/slot that best fits.',
    ].join('\n');

    try {
      const text = await serverCallGeminiGrounded(prompt + '\n\n' + userContent, geminiKey, 2200);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || !parsed.place) return { ok: false, debugCode: 'RESEARCH_ERROR' };

      const place = _userPlaceSanitize.sanitizeUserPlace(parsed.place, d);
      place.name = place.name || name;

      // Photos + VERIFIED rating — Google Places only; empty without a key.
      place.photos = [];
      let researchedPlaceId = '';
      try {
        const key = GOOGLE_MAPS_API_KEY.value();
        if (key && String(key).trim().length >= 20) {
          const q = encodeURIComponent((place.name + ' ' + place.address).trim());
          const fp = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=place_id,photos,name,rating,user_ratings_total&key=${key}`).then((r) => r.json());
          const cand = fp && fp.candidates && fp.candidates[0];
          researchedPlaceId = (cand && cand.place_id) || '';
          // Verified rating/reviewCount from Google Places override the AI text (google_maps-sourced).
          if (cand && typeof cand.rating === 'number') place.rating = String(cand.rating) + '★';
          if (cand && typeof cand.user_ratings_total === 'number') place.reviewCount = cand.user_ratings_total >= 1000 ? (Math.round(cand.user_ratings_total / 100) / 10 + 'k') : String(cand.user_ratings_total);
          const refs = (cand && Array.isArray(cand.photos)) ? cand.photos.slice(0, 3) : [];
          for (const ph of refs) {
            try {
              const resp = await fetch(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(ph.photo_reference)}&key=${key}`, { redirect: 'manual' });
              const loc = resp.headers.get('location');
              if (loc && /^https?:\/\//.test(loc) && loc.indexOf('key=') === -1) place.photos.push({ url: loc, source: 'google_places' });
            } catch (e3) { /* skip photo */ }
          }
        }
      } catch (e2) { /* no photos */ }

      // Distance from hotel/route — labeled estimate under the placeholder key.
      let distanceNote = '', distanceSource = 'unknown';
      try {
        const fromCity = (ctx.hotelsByCity && Object.keys(ctx.hotelsByCity)[0]) || (Array.isArray(ctx.destinations) && ctx.destinations[0] && ctx.destinations[0].city) || '';
        const toArea = String(d.area || '') || place.address;
        if (fromCity && toArea) {
          const rl = await tcComputeRouteLegs([fromCity, toArea], GOOGLE_MAPS_API_KEY.value());
          const leg = rl && rl.legs && rl.legs[0];
          if (leg) { distanceNote = (leg.distanceText ? leg.distanceText + ' · ' : '') + (leg.durationText || ''); distanceSource = leg.source; }
        }
      } catch (e4) { /* no distance */ }
      if (distanceNote && distanceSource !== 'google_maps') distanceNote = distanceNote + ' (est.)';

      const sp = parsed.suggestedPlacement || {};
      const slots = ['morning', 'lunch', 'afternoon', 'dinner', 'evening'];
      const suggestedPlacement = {
        day: Number.isInteger(sp.day) ? sp.day : null,
        slot: slots.indexOf(String(sp.slot)) !== -1 ? sp.slot : '',
        reason: String(sp.reason || '').slice(0, 200),
        fits: sp.fits !== false,
      };

      return { ok: true, place, suggestedPlacement, distanceNote, distanceSource, researchedPlaceId, verificationStatus: 'pending_verification' };
    } catch (e) {
      console.error('[researchUserPlace] failed', e && e.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR' };
    }
  }
);
// ── Food Picks: food-first restaurant research per destination ─────────────
// Recommends WHERE TO EAT for the group at each stop: a spread of real, well-known
// spots spanning the group's cuisines, with a kid-friendly option when there are
// kids and an easy/accessible option when there are seniors. Recommends only — it
// NEVER reserves, charges, or invents prices, availability, or booking URLs (the
// frontend builds official search links). Gemini + Google Search grounding.
function buildRestaurantResearchPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are a LOCAL food concierge for Du Lich Cali who personally knows each California city\'s food scene. For a group trip (multiple families, mixed ages and cuisine tastes), recommend WHERE TO EAT at each stop using current web knowledge. You ONLY research/recommend — you never reserve or charge.',
    'Return ONLY valid JSON (no markdown): { "food":[ { "city","note"(one phrase: this stop\'s food scene / what the group should prioritize),"picks":[ { "name"(a REAL, well-known restaurant — never invented),"cuisine","address"(approx street + city, no fake suite numbers),"bestFor"(family|groups|date_night|quick_bite|fine_dining|breakfast|vegetarian|seafood|local_specialty|kid_friendly),"dishes":[1-2 popular/signature dishes],"mustTry":[1-2 must-order items],"rating"(rough star rating ONLY if grounded in current search, e.g. "4.6★", else ""),"priceRange"("pending verification" or a rough $/$$/$$$ — NEVER an exact price),"kidSuitability"(one short phrase),"parkingNote"(one short phrase),"reservationNote"(walk-in ok / reserve ahead),"why"(one short sentence: why a local sends this group here),"dataSource":"ai_researched_pending_verification" } ] } ] }',
    'THINK LIKE A LOCAL, NOT A DIRECTORY. If a destination has a famous ethnic food community matching the group\'s cuisine preferences, recommend the REAL, well-known neighborhood favorites there — never generic chains or a single safe pick. KEY EXAMPLE: Orange County (Westminster / Garden Grove) = LITTLE SAIGON; for Vietnamese fans suggest real local icons — pho (Pho 79, Phoholic, Pho 101, Sup Noodle Bar), bun bo hue (Ngu Binh, Bun Bo Hue Co Do), Vietnamese seafood/oc (Oc & Lau, Oc & Cua, Bien Hen), modern Vietnamese (Nep Cafe, Vox Kitchen, Garlic & Chives), spring rolls (Brodard / Brodard Chateau), coffee/dessert (Phin Smith, 7 Leaves, Bambu, Che Cali, Da Vien). Apply the same local-knowledge approach to every city/cuisine (e.g. San Gabriel Valley for Chinese, Japantown for Japanese, Koreatown for Korean).',
    'ALWAYS GIVE A SPREAD per destination (never just one): cover best overall, best authentic, best seafood (if seafood is a preference or the city is known for it), a kid-friendly option (when the group has kids/toddlers), a budget option, a dessert/coffee option, and a backup. Honor each family\'s foodPrefsKeys + free-text foodPrefs and any destination "notes". For a meal_stop role, favor convenient en-route favorites. NEVER output exact prices, availability, confirmation numbers, phone numbers, or URLs.',
    'GROUP TASTE: if the input has a "likedCuisines" list, lean the picks toward those cuisines. ' + tcConsensusPromptLine(),
    'BE CONCISE so the JSON stays valid: 4-6 picks per destination; address = street + city only; every text field ONE short phrase; dishes/mustTry at most 2 each; no trailing commas. Write all human-readable text in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
// Curate research links + notes for ONE recommended place ("Learn more" media enrichment).
// Gemini decides which link types matter + crafts search queries; placeMediaSanitize enforces
// honesty (videos → search links only; official/menu/ticket validated; reviews/map deterministic;
// no fabricated prices/ratings). The client always also shows its deterministic baseline links.
exports.researchPlaceMedia = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 40, memory: '256MiB', cors: true },
  async (request) => {
    const uid = tripRequireAuth(request);
    const d = request.data || {};
    const tripId = String(d.tripId || '');
    const role = await tripCallerRole(tripId, uid);
    if (!role) throw new HttpsError('permission-denied', 'Join this trip to enrich places.');
    const name = String(d.name || '').trim();
    if (!name) return { ok: false, debugCode: 'NO_NAME' };
    const placeType = String(d.type || d.placeType || 'place').slice(0, 40);
    const city = String(d.city || '').slice(0, 80);
    const lang = (d.lang === 'vi' || d.lang === 'es') ? d.lang : 'en';
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY' };

    const userContent = 'Curate research links + notes for ONE place the app is recommending. Input JSON:\n' + JSON.stringify({ name: name, placeType: placeType, city: city });
    const prompt = [
      'You are a LOCAL travel concierge for Du Lich Cali. For ONE recommended place, decide which research links are MOST useful for this place type, plus a short why-it-fits + group-fit + best-time + time-needed. You ONLY research — never reserve or charge.',
      'Return ONLY valid JSON (no markdown): { "media":[ { "type"(official_site|menu|ticket|google_reviews|yelp_reviews|tripadvisor|youtube_search|tiktok|photos|map|blog_guide), "title"(short label), "url"(a REAL official/menu/ticket/blog URL ONLY for official_site|menu|ticket|blog_guide and ONLY if you actually know it from current search — else omit), "query"(for youtube_search/tiktok: the best SEARCH phrase, e.g. "San Diego SEAL Tour review"), "reason"(one short phrase) } ], "why"(one sentence), "groupFit"(short), "bestTime"(short or ""), "timeNeeded"(e.g. "1-2 hours" or ""), "popularDishes":[up to 4 for restaurants, else []], "parking"(short note or ""), "walkingDifficulty"(short or ""), "waitTime"(short or ""), "safety"(short note or ""), "weatherBackup"(short or "") }',
      'HARD RULES: NEVER invent a video — for any video give a SEARCH "query", never a watch/embed URL. NEVER output exact prices, ratings, review counts, availability, hours, or phone numbers. For official_site/menu/ticket/blog_guide give a url ONLY if it is the real, current official URL you found; if unsure, omit url (the app builds a search link). Prioritize by type: restaurants -> menu/reviews/yelp/youtube food review/photos; tours -> official/ticket/youtube/reviews; beaches/scenic -> map/youtube travel guide/reviews; events -> official/ticket/map; hotels -> reviews/tripadvisor/photos.',
      'Write human text (title/why/groupFit/bestTime/reason) in ' + (lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English')) + '. Output ONE compact valid JSON object.',
    ].join('\n');

    try {
      const text = await serverCallGeminiGrounded(prompt + '\n\n' + userContent, geminiKey, 1800);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed) return { ok: false, debugCode: 'RESEARCH_ERROR' };
      const media = _placeMediaSanitize.sanitizeMediaItems(parsed.media, { name: name, city: city });
      return {
        ok: true, media: media,
        why: String(parsed.why || '').slice(0, 240),
        groupFit: String(parsed.groupFit || '').slice(0, 160),
        bestTime: String(parsed.bestTime || '').slice(0, 120),
        timeNeeded: String(parsed.timeNeeded || '').slice(0, 60),
        popularDishes: (Array.isArray(parsed.popularDishes) ? parsed.popularDishes : []).slice(0, 4).map(function (x) { return String(x).slice(0, 60); }),
        parking: String(parsed.parking || '').slice(0, 120),
        walkingDifficulty: String(parsed.walkingDifficulty || '').slice(0, 90),
        waitTime: String(parsed.waitTime || '').slice(0, 90),
        safety: String(parsed.safety || '').slice(0, 120),
        weatherBackup: String(parsed.weatherBackup || '').slice(0, 120),
        dataSource: 'ai_researched_pending_verification',
      };
    } catch (e2) {
      console.error('[researchPlaceMedia] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR' };
    }
  }
);

exports.researchTripRestaurants = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 50, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const dests = (Array.isArray(trip.destinations) ? trip.destinations : [])
      .filter(d => d && (d.city || '').trim() && d.role !== 'pass_through');
    const fallbackCity = (trip.destination || '').trim();
    const cities = dests.length ? dests : (fallbackCity ? [{ city: fallbackCity, role: 'main_destination' }] : []);
    if (!cities.length) return { ok: false, debugCode: 'NO_DESTINATION', food: [] };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', food: [] };
    const cons = tcConsensusArrays(data); const avoidSet = tcAvoidSet(cons.avoidPlaces);
    const userContent = 'Recommend where to eat. Input JSON:\n' + JSON.stringify({
      dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle,
      destinations: cities.slice(0, 6).map(d => ({ city: d.city, role: d.role || 'main_destination', notes: d.notes || '' })),
      avoidPlaces: cons.avoidPlaces, preferredPlaces: cons.preferredPlaces,
      likedCuisines: Array.isArray(data.likedCuisines) ? data.likedCuisines.slice(0, 12).map(x => String(x).slice(0, 40)) : [],
      familiesSummary: summarizeFamiliesForTrip(trip.families),
    });
    try {
      const text = await serverCallGeminiGrounded(buildRestaurantResearchPrompt(lang) + '\n\n' + userContent, geminiKey, 3600);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed) { console.error('[researchTripRestaurants] unparseable JSON, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', food: [] }; }
      const BEST = ['family', 'groups', 'date_night', 'quick_bite', 'fine_dining', 'breakfast', 'vegetarian', 'seafood', 'local_specialty', 'kid_friendly'];
      let food = Array.isArray(parsed.food) ? parsed.food : [];
      food = food.filter(f => f && f.city).slice(0, 6).map(f => ({
        city: String(f.city).slice(0, 80),
        note: String(f.note || '').slice(0, 200),
        picks: (Array.isArray(f.picks) ? f.picks : []).filter(p => p && !avoidSet[String(p.name || '').trim().toLowerCase()]).slice(0, 8).map(p => ({
          name: String(p.name || '').slice(0, 120),
          cuisine: String(p.cuisine || '').slice(0, 60),
          address: String(p.address || '').slice(0, 140),
          bestFor: BEST.indexOf(String(p.bestFor)) !== -1 ? p.bestFor : 'groups',
          dishes: (Array.isArray(p.dishes) ? p.dishes : []).slice(0, 3).map(x => String(x).slice(0, 60)),
          mustTry: (Array.isArray(p.mustTry) ? p.mustTry : []).slice(0, 3).map(x => String(x).slice(0, 60)),
          rating: String(p.rating || '').slice(0, 24),
          priceRange: String(p.priceRange || 'pending verification').slice(0, 60),
          kidSuitability: String(p.kidSuitability || '').slice(0, 90),
          parkingNote: String(p.parkingNote || '').slice(0, 100),
          reservationNote: String(p.reservationNote || '').slice(0, 120),
          why: String(p.why || '').slice(0, 200),
          dataSource: 'ai_researched_pending_verification',
        })),
      }));
      return { ok: true, food };
    } catch (e2) {
      console.error('[researchTripRestaurants] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', food: [] };
    }
  }
);
// ── Destination Intelligence + Attraction Ranking Engine ─────────────────────
// Ranks each destination's SIGNATURE attractions for THIS group (Family Analysis →
// scoring), like a local expert. NOT a hardcoded table — the AI reasons; the examples
// teach the concept. No fake prices/URLs; ticketed flag drives the booking checklist.
function buildAttractionRankPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are a LOCAL travel EXPERT for Du Lich Cali. For each destination, RANK its real signature/iconic attractions for THIS specific group, using current web knowledge. Recommend only — never book or invent.',
    signatureAttractionIntel(),
    'Return ONLY valid JSON (no markdown): { "destinations":[ { "city","attractions":[ { "name"(a REAL attraction — never invented),"tier"(very_high|high|medium),"score"(0-100 for THIS group),"category"(theme_park|zoo|aquarium|museum|landmark|nature|beach|food|nightlife|show|other),"ticketed"(true|false),"ageFit"(kids|teens|seniors|all_ages|adults),"walkingLevel"(low|medium|high),"weatherSensitive"(true|false),"why"(one short sentence: why this rank for THIS group) } ] } ] }',
    'AVOID: if the input includes an "avoidPlaces" list, the group has REJECTED those attractions — NEVER include any of them (or an obvious rename of them); rank different real attractions instead.',
    'Rank 4-7 attractions per destination, sorted by score DESC. Use the provided groupProfile (childFocused/teenFocused/seniorSensitive/thrillSeeking/themeParkAffinity/walkingTolerance/budget/pace) to score: e.g. two 6-year-olds + two teens → a zoo and a big theme park/LEGOLAND rank highest (all-day, multi-age); seniors present → also surface a lower-walking cultural option. LOWER scores for very low budget, theme-park-averse groups, single-day stops, poor weather, or low walking tolerance — and you may omit a clearly-unfit icon. Mark "ticketed":true for paid attractions (theme parks, zoos, aquariums, observatories with paid entry). NEVER output exact prices, hours, availability, or URLs. Keep "why" to one short phrase. Write all human-readable text in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.rankDestinationAttractions = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 50, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const dests = (Array.isArray(trip.destinations) ? trip.destinations : []).map(d => String((d && d.city) || '').trim()).filter(Boolean);
    if (!dests.length) return { ok: false, debugCode: 'NO_DESTINATIONS', destinations: [] };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', destinations: [] };
    const avoid = Array.isArray(data.avoidPlaces) ? data.avoidPlaces.slice(0, 40).map(x => String(x).slice(0, 120)) : [];
    const avoidSet = {}; avoid.forEach(n => { avoidSet[String(n).trim().toLowerCase()] = 1; });
    const userContent = 'Rank signature attractions. Input JSON:\n' + JSON.stringify({
      destinations: dests.slice(0, 8), dateRange: trip.dateRange, budget: trip.budget, pace: trip.tripStyle,
      avoidPlaces: avoid,
      groupProfile: tcGroupProfile(trip.families, trip.budget, trip.tripStyle), familiesSummary: summarizeFamiliesForTrip(trip.families),
    });
    try {
      const text = await serverCallGeminiGrounded(buildAttractionRankPrompt(lang) + '\n\n' + userContent, geminiKey, 3200);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || !Array.isArray(parsed.destinations)) { console.error('[rankDestinationAttractions] unparseable, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', destinations: [] }; }
      const TIERS = ['very_high', 'high', 'medium'];
      const destinations = parsed.destinations.slice(0, 8).map(d => {
        d = d || {};
        const attractions = (Array.isArray(d.attractions) ? d.attractions : []).filter(a => a && a.name && !avoidSet[String(a.name).trim().toLowerCase()]).slice(0, 8).map(a => ({
          name: String(a.name).slice(0, 120),
          tier: TIERS.indexOf(a.tier) >= 0 ? a.tier : 'medium',
          score: Math.max(0, Math.min(100, parseInt(a.score, 10) || 0)),
          category: String(a.category || '').slice(0, 24),
          ticketed: !!a.ticketed,
          ageFit: String(a.ageFit || '').slice(0, 16),
          walkingLevel: String(a.walkingLevel || '').slice(0, 8),
          weatherSensitive: !!a.weatherSensitive,
          why: String(a.why || '').slice(0, 200),
          dataSource: 'ai_researched_pending_verification',
        })).sort((x, y) => y.score - x.score);
        return { city: String(d.city || '').slice(0, 80), attractions };
      }).filter(d => d.city && d.attractions.length);
      return { ok: true, destinations, groupProfile: tcGroupProfile(trip.families, trip.budget, trip.tripStyle), dataSource: 'ai_researched_pending_verification' };
    } catch (e2) {
      console.error('[rankDestinationAttractions] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', destinations: [] };
    }
  }
);
// ── Event Discovery Agent — current/temporary events matching the trip DATES ──────
// Festivals, concerts, markets, fireworks, seasonal/pop-up/family/kids/teen/free events.
// NEVER invents events: when unsure, returns "pending verification" + a real search link.
function buildEventsPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are a LOCAL events concierge for Du Lich Cali. For each destination, find REAL current/temporary events that fall WITHIN the trip dates and suit this group, using current web knowledge. Recommend only — never book.',
    'Return ONLY valid JSON (no markdown): { "destinations":[ { "city","events":[ { "name","date"(within trip dates),"time","location","category"(festival|concert|farmers_market|night_market|food|fireworks|seasonal|popup|family|kids|teen|free|other),"priceRange"(rough or "free" or "pending verification"),"familySuitability"(kids|teens|all_ages|adults),"ticketRequired"(true|false),"eventUrl"(a REAL event/official or search URL),"whyRecommended"(one short phrase),"verificationStatus":"pending_verification" } ] } ] }',
    'HARD RULES: NEVER invent an event, date, venue, or price. Only list events you are reasonably confident recur or are announced for these dates; if you are NOT sure a specific event runs on the trip dates, instead return ONE entry per destination with name "Local events (research pending)", category matching the group, eventUrl = a Google search like "https://www.google.com/search?q=" + URL-encoded "<city> events <dateRange>", and verificationStatus "pending_verification". Events MUST fall within the trip dates. NEVER output exact ticket prices as fact — use ranges or "pending verification". Prefer family/kids/teen-friendly and FREE local events for this group. 3-6 events per destination max.',
    tcConsensusPromptLine(),
    'Write all human-readable text in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.researchTripEvents = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 50, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const dests = (Array.isArray(trip.destinations) ? trip.destinations : []).map(d => String((d && d.city) || '').trim()).filter(Boolean);
    if (!dests.length || !String(trip.dateRange || '').trim()) return { ok: false, debugCode: 'NO_DATES_OR_DEST', destinations: [] };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', destinations: [] };
    const cons = tcConsensusArrays(data); const avoidSet = tcAvoidSet(cons.avoidPlaces);
    const userContent = 'Find events. Input JSON:\n' + JSON.stringify({
      destinations: dests.slice(0, 8), dateRange: trip.dateRange,
      dateList: Array.isArray(data.dateList) ? data.dateList.slice(0, 30) : [],
      avoidPlaces: cons.avoidPlaces, preferredPlaces: cons.preferredPlaces,
      groupProfile: tcGroupProfile(trip.families, trip.budget, trip.tripStyle), familiesSummary: summarizeFamiliesForTrip(trip.families),
    });
    try {
      const text = await serverCallGeminiGrounded(buildEventsPrompt(lang) + '\n\n' + userContent, geminiKey, 3000);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || !Array.isArray(parsed.destinations)) { console.error('[researchTripEvents] unparseable, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', destinations: [] }; }
      const destinations = parsed.destinations.slice(0, 8).map(d => {
        d = d || {};
        const events = (Array.isArray(d.events) ? d.events : []).filter(ev => ev && ev.name && !avoidSet[String(ev.name).trim().toLowerCase()]).slice(0, 6).map(ev => ({
          name: String(ev.name).slice(0, 120), date: String(ev.date || '').slice(0, 40), time: String(ev.time || '').slice(0, 40),
          location: String(ev.location || '').slice(0, 140), category: String(ev.category || '').slice(0, 24),
          priceRange: String(ev.priceRange || 'pending verification').slice(0, 60), familySuitability: String(ev.familySuitability || '').slice(0, 16),
          ticketRequired: !!ev.ticketRequired, eventUrl: String(ev.eventUrl || '').slice(0, 300), whyRecommended: String(ev.whyRecommended || '').slice(0, 200),
          source: 'ai_researched', verificationStatus: 'pending_verification',
        }));
        return { city: String(d.city || '').slice(0, 80), events };
      }).filter(d => d.city);
      return { ok: true, destinations, dataSource: 'ai_researched_pending_verification' };
    } catch (e2) {
      console.error('[researchTripEvents] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', destinations: [] };
    }
  }
);
// ── Stopover Agent — smart stops on LONG drive legs (meal/rest/gas/coffee/scenic) ──
// Considers meal timing, kids/seniors, Vietnamese-food preference, charging, route. Real
// places + map links; no fake prices/route times.
function buildStopoverPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are a road-trip concierge for Du Lich Cali. For each LONG drive leg, suggest smart REAL stopovers for THIS group, using current web knowledge. Recommend only — never book or invent.',
    'Return ONLY valid JSON (no markdown): { "legs":[ { "fromCity","toCity","stopovers":[ { "name"(a REAL place near the route),"type"(meal|rest|gas|coffee|attraction|scenic|hotel),"location"(town/area near the highway),"estimatedStopDuration"(e.g. "30 min"),"estimatedCost"(rough or "" — NEVER a fake exact price),"whyRecommended"(one short phrase),"mapUrl"(Google Maps search URL),"alternatives"([1-2 real alternative names]),"verificationStatus":"pending_verification" } ] } ] }',
    'Reason about meal timing (a lunch stop ~2-3h in), restroom/leg-stretch breaks for kids and seniors, the families\' food preferences (e.g. if they like Vietnamese food, suggest a real Vietnamese spot near the route when one exists), gas/EV charging, scenic stops worth a short break, and safe well-known rest areas — paced by the real drive time provided. 2-4 stopovers per long leg. Build mapUrl = "https://www.google.com/maps/search/?api=1&query=" + URL-encoded "<name>, <location>". NEVER invent a place or output a fake exact price/route time. Use REAL, well-known places along that corridor.',
    tcConsensusPromptLine(),
    'Write all human-readable text in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.researchTripStopovers = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY, GOOGLE_MAPS_API_KEY], timeoutSeconds: 50, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const origin = String(trip.departureCity || '').trim();
    const destCities = (Array.isArray(trip.destinations) ? trip.destinations : []).map(d => String((d && d.city) || '').trim()).filter(Boolean);
    if (!destCities.length) return { ok: false, debugCode: 'NO_ROUTE', legs: [] };
    const path = (origin ? [origin] : []).concat(destCities);
    if (origin) path.push(origin);
    const cities = path.filter((c, i) => i === 0 || c.toLowerCase() !== path[i - 1].toLowerCase());
    if (cities.length < 2) return { ok: false, debugCode: 'NO_ROUTE', legs: [] };
    const route = await tcComputeRouteLegs(cities.slice(0, 12), GOOGLE_MAPS_API_KEY.value());
    // Only LONG legs (>= ~100 mi) get stopovers.
    const longLegs = route.legs.filter(l => (l.distanceMiles || 0) >= 100).map(l => ({ fromCity: l.fromCity, toCity: l.toCity, driveDistanceText: l.distanceText, driveDurationText: l.durationTrafficText || l.durationText, driveSource: l.source }));
    if (!longLegs.length) return { ok: true, legs: [], note: 'no_long_legs' };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', legs: [] };
    const cons = tcConsensusArrays(data); const avoidSet = tcAvoidSet(cons.avoidPlaces);
    const userContent = 'Suggest stopovers. Input JSON:\n' + JSON.stringify({
      legs: longLegs, avoidPlaces: cons.avoidPlaces, preferredPlaces: cons.preferredPlaces,
      groupProfile: tcGroupProfile(trip.families, trip.budget, trip.tripStyle), familiesSummary: summarizeFamiliesForTrip(trip.families),
    });
    try {
      const text = await serverCallGeminiGrounded(buildStopoverPrompt(lang) + '\n\n' + userContent, geminiKey, 3000);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || !Array.isArray(parsed.legs)) { console.error('[researchTripStopovers] unparseable, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', legs: [] }; }
      const TYPES = ['meal', 'rest', 'gas', 'coffee', 'attraction', 'scenic', 'hotel'];
      const legs = parsed.legs.slice(0, 8).map((lg, i) => {
        lg = lg || {}; const c = longLegs[i] || {};
        const stopovers = (Array.isArray(lg.stopovers) ? lg.stopovers : []).filter(s2 => s2 && s2.name && !avoidSet[String(s2.name).trim().toLowerCase()]).slice(0, 5).map(s2 => ({
          name: String(s2.name).slice(0, 120), type: TYPES.indexOf(s2.type) >= 0 ? s2.type : 'rest',
          location: String(s2.location || '').slice(0, 120), estimatedStopDuration: String(s2.estimatedStopDuration || '').slice(0, 30),
          estimatedCost: String(s2.estimatedCost || '').slice(0, 40), whyRecommended: String(s2.whyRecommended || '').slice(0, 200),
          mapUrl: String(s2.mapUrl || '').slice(0, 300), alternatives: (Array.isArray(s2.alternatives) ? s2.alternatives : []).slice(0, 2).map(x => String(x).slice(0, 80)),
          source: 'ai_researched', verificationStatus: 'pending_verification',
        }));
        return { fromCity: c.fromCity || String(lg.fromCity || '').slice(0, 80), toCity: c.toCity || String(lg.toCity || '').slice(0, 80), driveDistanceText: c.driveDistanceText || '', driveDurationText: c.driveDurationText || '', driveSource: c.driveSource || 'estimated', stopovers };
      }).filter(l => l.stopovers.length);
      return { ok: true, legs, source: route.source, dataSource: 'ai_researched_pending_verification' };
    } catch (e2) {
      console.error('[researchTripStopovers] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', legs: [] };
    }
  }
);
// ── Travel-Day Route Opportunities Agent ──────────────────────────────────────
// For EACH route leg (origin→dest, incl. the return), discover REAL, interesting things to
// optionally insert ON a travel day — ethnic food districts, beaches, scenic viewpoints,
// shopping, hidden gems, historic towns, museums, theme parks, photo spots — chosen for THIS
// group (ages/prefs/budget/ocean/food/weather). Turns a plain A→B drive into a customizable
// day. NEVER hardcodes a city/place; NEVER re-suggests a skipped place; builds around pins.
// Recommend only (the user inserts) — no fake prices/URLs/confirmations.
function buildRouteOpportunitiesPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are an expert California road-trip concierge for Du Lich Cali. For EACH driving leg given (origin → destination), discover REAL, interesting OPTIONAL stops the group could insert into that travel day, using current web knowledge. A travel day is one of the most flexible, fun days — surface a rich, varied set of opportunities so the family feels they can BUILD their own trip, not follow a fixed line from A to B. Recommend only — never book or invent.',
    'Return ONLY valid JSON (no markdown): { "legs":[ { "fromCity","toCity","opportunities":[ { "place"(a REAL, well-known place near/along the route — never invented),"category"(food|beach|scenic|shopping|cultural|museum|theme_park|aquarium|nature|historic|photo|hidden_gem|other),"insertionType"(food_stop|short_stop|half_day|overnight|scenic_stop|shopping_stop|beach_stop|kid_stop|teen_stop|senior_stop|photo_stop),"detourMinutes"(rough extra minutes off the direct route, integer, or ""),"visitDuration"(e.g. "30 min","1–2h"),"costEstimate"(rough, "free", or "pending verification" — NEVER a fake exact price),"whyRecommended"(one short sentence for THIS group),"whoBenefits"(kids|teens|seniors|all_ages|foodies|adults),"weatherSuitability"(any|sunny|outdoor|indoor),"energyLevel"(low|medium|high),"priority"(must_see|recommended|optional),"mapQuery"(the place + town for a maps search),"verificationStatus":"pending_verification" } ] } ] }',
    'DISCOVER A VARIED SPREAD per leg (6–9 opportunities): mix food districts/famous local eats, a beach or waterfront if the route is near the coast and the group likes the ocean, a scenic viewpoint/photo spot, a kid stop, a teen stop, a senior-friendly low-walking stop, a hidden gem, and an optional half-day attraction (theme park/aquarium/museum/historic town) when one is genuinely near the corridor. THINK LIKE A LOCAL: if the corridor passes a famous ethnic food community matching the group\'s cuisines, surface its real icons. Choose opportunities from the group\'s preferences, ages (kids/teens/seniors), budget, the ocean/food priorities, likely weather and the actual route — NOT a fixed template.',
    'AVOID: if the input includes an "avoidPlaces" list, the group has REJECTED those — NEVER suggest any of them again. PINNED: if "pinnedActivities" is given, do not duplicate them; build complementary stops around them.',
    'HARD RULES: Every place must be REAL and plausibly near that corridor. detourMinutes is a rough estimate of extra time vs. the direct drive (the app shows exact drive time separately). NEVER output exact prices, hours, availability, phone numbers, or URLs (costEstimate = rough/"free"/"pending verification"). Keep every text field to ONE short phrase. Write all human-readable text in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.researchTripRouteOpportunities = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 55, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const origin = String(trip.departureCity || '').trim();
    const destCities = (Array.isArray(trip.destinations) ? trip.destinations : []).map((d) => String((d && d.city) || '').trim()).filter(Boolean);
    if (!origin || !destCities.length) return { ok: false, debugCode: 'NO_ROUTE', legs: [] };
    const path = [origin].concat(destCities); path.push(origin);
    const seq = path.filter((c, i) => i === 0 || c.toLowerCase() !== path[i - 1].toLowerCase());
    const legPairs = [];
    for (let i = 0; i < seq.length - 1 && legPairs.length < 8; i++) legPairs.push({ fromCity: seq[i], toCity: seq[i + 1] });
    if (!legPairs.length) return { ok: false, debugCode: 'NO_ROUTE', legs: [] };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', legs: [] };
    const userContent = 'Discover travel-day route opportunities. Input JSON:\n' + JSON.stringify({
      legs: legPairs, dateRange: trip.dateRange, budget: trip.budget, pace: trip.tripStyle,
      groupProfile: tcGroupProfile(trip.families, trip.budget, trip.tripStyle), familiesSummary: summarizeFamiliesForTrip(trip.families),
      avoidPlaces: Array.isArray(data.avoidPlaces) ? data.avoidPlaces.slice(0, 40).map((x) => String(x).slice(0, 120)) : [],
      pinnedActivities: Array.isArray(trip.pinnedActivities) ? trip.pinnedActivities.slice(0, 12) : [],
    });
    try {
      const text = await serverCallGeminiGrounded(buildRouteOpportunitiesPrompt(lang) + '\n\n' + userContent, geminiKey, 3600);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || !Array.isArray(parsed.legs)) { console.error('[researchTripRouteOpportunities] unparseable, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', legs: [] }; }
      const avoid = {}; (Array.isArray(data.avoidPlaces) ? data.avoidPlaces : []).forEach((n) => { avoid[String(n).trim().toLowerCase()] = 1; });
      const CATS = ['food', 'beach', 'scenic', 'shopping', 'cultural', 'museum', 'theme_park', 'aquarium', 'nature', 'historic', 'photo', 'hidden_gem', 'other'];
      const INS = ['food_stop', 'short_stop', 'half_day', 'overnight', 'scenic_stop', 'shopping_stop', 'beach_stop', 'kid_stop', 'teen_stop', 'senior_stop', 'photo_stop'];
      const ENERGY = ['low', 'medium', 'high']; const PRIO = ['must_see', 'recommended', 'optional'];
      const legs = parsed.legs.slice(0, 8).map((lg, idx) => {
        lg = lg || {}; const c = legPairs[idx] || {};
        const opportunities = (Array.isArray(lg.opportunities) ? lg.opportunities : [])
          .filter((o) => o && o.place && !avoid[String(o.place).trim().toLowerCase()])
          .slice(0, 9).map((o) => ({
            place: String(o.place).slice(0, 120),
            category: CATS.indexOf(String(o.category)) >= 0 ? o.category : 'other',
            insertionType: INS.indexOf(String(o.insertionType)) >= 0 ? o.insertionType : 'short_stop',
            detourMinutes: (o.detourMinutes === '' || o.detourMinutes == null) ? '' : (parseInt(o.detourMinutes, 10) || ''),
            visitDuration: String(o.visitDuration || '').slice(0, 30),
            costEstimate: String(o.costEstimate || 'pending verification').slice(0, 50),
            whyRecommended: String(o.whyRecommended || '').slice(0, 200),
            whoBenefits: String(o.whoBenefits || '').slice(0, 40),
            weatherSuitability: String(o.weatherSuitability || 'any').slice(0, 16),
            energyLevel: ENERGY.indexOf(String(o.energyLevel)) >= 0 ? o.energyLevel : 'medium',
            priority: PRIO.indexOf(String(o.priority)) >= 0 ? o.priority : 'optional',
            mapQuery: String(o.mapQuery || o.place || '').slice(0, 140),
            source: 'ai_researched', verificationStatus: 'pending_verification',
          }));
        return { fromCity: c.fromCity || String(lg.fromCity || '').slice(0, 80), toCity: c.toCity || String(lg.toCity || '').slice(0, 80), opportunities };
      }).filter((l) => l.opportunities.length);
      return { ok: true, legs, dataSource: 'ai_researched_pending_verification' };
    } catch (e2) {
      console.error('[researchTripRouteOpportunities] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', legs: [] };
    }
  }
);
// ── Tour Discovery Agent — REAL tours & unique experiences per destination ────────
// Harbor/whale-watching/hop-on-hop-off/food/kayak/brewery/amphibious/ghost/biking tours, etc.,
// discovered for THIS group (ages/prefs/budget). Recommend only — NEVER invents an operator,
// price, schedule, availability or URL (the frontend builds official search links). Honors the
// group's votes (avoid skipped, prefer liked/favorited). Gemini + Google Search grounding.
function buildToursPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are a LOCAL tours & experiences concierge for Du Lich Cali. For each destination, find REAL, well-known TOURS and UNIQUE EXPERIENCES that suit THIS group, using current web knowledge — the kinds of things a visitor books beyond a plain attraction ticket. Recommend only — never book, never invent.',
    'Return ONLY valid JSON (no markdown): { "destinations":[ { "city","tours":[ { "name"(a REAL, well-known tour/operator or experience — never invented),"type"(harbor_cruise|whale_watching|hop_on_hop_off|food_tour|walking_tour|bike_tour|kayak|boat|amphibious|brewery|cultural|adventure|nature|seasonal|other),"duration"(rough, e.g. "2h","half-day"),"familySuitability"(kids|teens|seniors|all_ages|adults),"whoBenefits"(one short phrase),"priceRange"("pending verification" or a rough per-person range — NEVER a fake exact price),"bookingNote"(walk-in / reserve ahead / seasonal — general),"why"(one short sentence: why a local picks this for THIS group),"verificationStatus":"pending_verification" } ] } ] }',
    'Give 3-6 tours per destination spanning the group: an all-ages signature experience, a kid-friendly one (when there are kids), a teen-oriented one (when there are teens), a low-walking/seated option (when there are seniors), and a food/cultural experience when food is a priority. THINK LIKE A LOCAL — surface the experiences that destination is actually known for. NEVER output exact prices, availability, confirmation numbers, phone numbers, or URLs (priceRange = "pending verification" or a rough range; the app builds the search/booking links).',
    tcConsensusPromptLine(),
    'BE CONCISE: every text field ONE short phrase; no trailing commas. Write all human-readable text in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.researchTripTours = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 50, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const dests = (Array.isArray(trip.destinations) ? trip.destinations : []).map(d => String((d && d.city) || '').trim()).filter(Boolean);
    if (!dests.length) return { ok: false, debugCode: 'NO_DESTINATIONS', destinations: [] };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', destinations: [] };
    const cons = tcConsensusArrays(data); const avoidSet = tcAvoidSet(cons.avoidPlaces);
    const userContent = 'Find tours & unique experiences. Input JSON:\n' + JSON.stringify({
      destinations: dests.slice(0, 8), dateRange: trip.dateRange, budget: trip.budget, pace: trip.tripStyle,
      avoidPlaces: cons.avoidPlaces, preferredPlaces: cons.preferredPlaces,
      groupProfile: tcGroupProfile(trip.families, trip.budget, trip.tripStyle), familiesSummary: summarizeFamiliesForTrip(trip.families),
    });
    try {
      const text = await serverCallGeminiGrounded(buildToursPrompt(lang) + '\n\n' + userContent, geminiKey, 3200);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || !Array.isArray(parsed.destinations)) { console.error('[researchTripTours] unparseable, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', destinations: [] }; }
      const TYPES = ['harbor_cruise', 'whale_watching', 'hop_on_hop_off', 'food_tour', 'walking_tour', 'bike_tour', 'kayak', 'boat', 'amphibious', 'brewery', 'cultural', 'adventure', 'nature', 'seasonal', 'other'];
      const destinations = parsed.destinations.slice(0, 8).map(d => {
        d = d || {};
        const tours = (Array.isArray(d.tours) ? d.tours : []).filter(tr2 => tr2 && tr2.name && !avoidSet[String(tr2.name).trim().toLowerCase()]).slice(0, 6).map(tr2 => ({
          name: String(tr2.name).slice(0, 120), type: TYPES.indexOf(String(tr2.type)) >= 0 ? tr2.type : 'other',
          duration: String(tr2.duration || '').slice(0, 30), familySuitability: String(tr2.familySuitability || '').slice(0, 16),
          whoBenefits: String(tr2.whoBenefits || '').slice(0, 60), priceRange: String(tr2.priceRange || 'pending verification').slice(0, 60),
          bookingNote: String(tr2.bookingNote || '').slice(0, 80), why: String(tr2.why || '').slice(0, 200),
          source: 'ai_researched', verificationStatus: 'pending_verification',
        }));
        return { city: String(d.city || '').slice(0, 80), tours };
      }).filter(d => d.city && d.tours.length);
      return { ok: true, destinations, dataSource: 'ai_researched_pending_verification' };
    } catch (e2) {
      console.error('[researchTripTours] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', destinations: [] };
    }
  }
);
// ── AI Social Clip Package Agent (V2) — export PACKAGE only, NO render/post ───
// Builds a ready-to-shoot social package (storyboard, captions, voiceover, overlays,
// hashtags, per-platform posts) FROM the media the group already picked. It NEVER
// renders or posts a video, NEVER invents footage/media that isn't in the provided
// list, and NEVER fabricates stats/metrics/handles. Consent is gated on the client.
function buildClipPackagePrompt(lang, platform, mood, length) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  var PLAT = { tiktok: 'TikTok (vertical 9:16, fast hook in the first 2s, trend-friendly, casual)', instagram: 'Instagram Reels (vertical 9:16, aesthetic, tasteful captions)', youtube: 'YouTube Shorts (vertical 9:16, a clear hook + payoff)', facebook: 'Facebook (square/vertical, family-friendly, a little more text is OK)' };
  var MOOD = { fun: 'fun, upbeat and playful', cinematic: 'cinematic and sweeping', heartfelt: 'warm, heartfelt and nostalgic', energetic: 'high-energy and exciting' };
  var LEN = { short: 'about 15-30 seconds — keep it to 3-5 scenes', medium: 'about 30-60 seconds — 6-8 scenes', long: 'about 1-3 minutes — 9-12 scenes' };
  return [
    'You are a social-media producer for Du Lich Cali. Build a ready-to-shoot CLIP PACKAGE for a family trip, using ONLY the media items the group already selected (given as "media" with caption/place/day/type). This is an EXPORT package the user will assemble in their own editor — you do NOT render, generate, or post any video, and you do NOT create or imagine any footage that is not in the provided media list.',
    'Target platform: ' + (PLAT[platform] || PLAT.tiktok) + '. Mood: ' + (MOOD[mood] || MOOD.fun) + '. Length: ' + (LEN[length] || LEN.short) + '.',
    'Return ONLY valid JSON (no markdown): { "summary"(one short sentence describing the clip), "storyboard":[ { "scene"(short scene label e.g. "Opening hook"),"media"(the caption or place of the EXACT provided media item this scene uses — must match one of the inputs; use "" only for a pure text/title card),"text"(what happens / on-screen direction, one short phrase) } ], "voiceoverScript"(a short spoken-narration script matching the scene count; plain text, no stage directions), "textOverlays":[ short on-screen text lines, one per key scene ], "hashtags":[ 6-12 relevant hashtags WITHOUT spaces ], "posts": { "tiktok"(a ready caption for TikTok),"instagram"(caption),"youtube"(a short title + description),"facebook"(a short post) } }',
    'HARD RULES: Every storyboard "media" value MUST correspond to one of the provided media items (by its caption or place) — never invent a new shot, location, or clip. If there are fewer media items than scenes, reuse items or add clearly-labeled text/title cards (media:""). Do NOT fabricate view counts, metrics, prices, dates, @handles, music track names, or any fact not given. Keep captions tasteful and family-appropriate. Write ALL human-readable text (summary, scene labels/text, voiceover, overlays, posts) in ' + langName + '; hashtags may stay in their natural language. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.generateTripClipPackage = onCall(
  { region: 'us-central1', secrets: [CLAUDE_API_KEY], timeoutSeconds: 50, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const platform = ['tiktok', 'instagram', 'youtube', 'facebook'].indexOf(data.platform) >= 0 ? data.platform : 'tiktok';
    const mood = ['fun', 'cinematic', 'heartfelt', 'energetic'].indexOf(data.mood) >= 0 ? data.mood : 'fun';
    const length = ['short', 'medium', 'long'].indexOf(data.length) >= 0 ? data.length : 'short';
    const media = (Array.isArray(data.media) ? data.media : []).slice(0, 30).map(m => ({
      caption: String((m && m.caption) || '').slice(0, 160), place: String((m && m.place) || '').slice(0, 80),
      day: (m && m.day != null) ? String(m.day).slice(0, 8) : '', mediaType: String((m && m.mediaType) || 'photo').slice(0, 12),
    })).filter(m => m.caption || m.place);
    if (!media.length) return { ok: false, debugCode: 'NO_MEDIA' };
    const claudeKey = await getAiKey('claude');
    if (!claudeKey) return { ok: false, debugCode: 'NO_CLAUDE_KEY' };
    const dests = (Array.isArray(trip.destinations) ? trip.destinations : []).map(d => String((d && d.city) || '').trim()).filter(Boolean);
    const userContent = 'Build the clip package. Input JSON:\n' + JSON.stringify({
      groupName: String(trip.groupName || '').slice(0, 80), destinations: dests.slice(0, 8), dateRange: trip.dateRange || '',
      platform, mood, length, media,
    });
    try {
      const text = await serverCallClaude(buildClipPackagePrompt(lang, platform, mood, length), [{ role: 'user', content: userContent }], true, claudeKey, 2500, 'claude-haiku-4-5-20251001');
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || typeof parsed !== 'object') { console.error('[generateTripClipPackage] unparseable, len=' + raw.length); return { ok: false, debugCode: 'CLIP_ERROR' }; }
      const allowed = {}; media.forEach(m => { if (m.caption) allowed[m.caption.toLowerCase()] = 1; if (m.place) allowed[m.place.toLowerCase()] = 1; });
      const storyboard = (Array.isArray(parsed.storyboard) ? parsed.storyboard : []).slice(0, 12).map(sc => {
        sc = sc || {};
        let mediaRef = String(sc.media || '').slice(0, 160);
        // Anti-fabrication: a scene may only reference provided media (or be a text/title card).
        if (mediaRef && !allowed[mediaRef.toLowerCase()]) mediaRef = '';
        return { scene: String(sc.scene || '').slice(0, 60), media: mediaRef, text: String(sc.text || '').slice(0, 200) };
      }).filter(sc => sc.scene || sc.text);
      const posts = (parsed.posts && typeof parsed.posts === 'object') ? parsed.posts : {};
      const cleanPosts = {};
      ['tiktok', 'instagram', 'youtube', 'facebook'].forEach(k => { if (posts[k]) cleanPosts[k] = String(posts[k]).slice(0, 600); });
      return {
        ok: true, platform, mood, length,
        summary: String(parsed.summary || '').slice(0, 200),
        storyboard,
        voiceoverScript: String(parsed.voiceoverScript || '').slice(0, 1500),
        textOverlays: (Array.isArray(parsed.textOverlays) ? parsed.textOverlays : []).slice(0, 14).map(x => String(x).slice(0, 120)).filter(Boolean),
        hashtags: (Array.isArray(parsed.hashtags) ? parsed.hashtags : []).slice(0, 14).map(x => String(x).replace(/\s+/g, '').slice(0, 40)).filter(Boolean),
        posts: cleanPosts,
        note: 'export_package_only_no_render_no_post', dataSource: 'ai_generated_from_user_media',
      };
    } catch (e2) {
      console.error('[generateTripClipPackage] failed', e2 && e2.message);
      return { ok: false, debugCode: 'CLIP_ERROR' };
    }
  }
);
// ── Phase X Step 5 — Natural-language trip EDIT INTERPRETER ───────────────────
// Maps a user's plain-language request ("return to OC July 3 by 4 PM, keep Bus Hoang";
// "skip SeaWorld"; "find another Vietnamese restaurant"; "stay another night") into a
// STRUCTURED EDIT PLAN over the existing node graph. It returns INTENTS only — which
// nodes/days to change and how — and NEVER invents new place names, prices, or schedules
// (a real place comes from the research/replan agents, not from here). The client previews
// the plan, then applies + scoped-replans (preserving locked nodes).
function buildInterpretPrompt(lang) {
  const langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are the edit interpreter for an AI travel concierge. You are given the trip\'s NODE GRAPH (each node: name, type(activity|meal|stay|transport), day (1-based), locked) and a user REQUEST in natural language. Output a STRUCTURED EDIT PLAN of operations over those nodes. You do the parsing/reasoning; you do NOT invent places, prices, times, or schedules.',
    'ALLOWED ops: "skip" (remove an existing node — reference it by its exact node name), "lock" / "unlock" (an existing node), "replace" (swap an existing node for a same-kind alternative — name the node to replace + optionally a cuisine/category hint; do NOT name the replacement, the research agent finds it), "add" (add something — if the user named a REAL specific place use it as "name", else give "category"/"cuisine" only), "retime" (change a node/day timing — give "time"), "replan_day" (regenerate a day around locked items — for vague "make day 2 better / find another X on day 2"), "stay_extra_night" / "leave_earlier" / "change_return" (structural date/return change — give the day + a short note; the app handles the date logic).',
    'RULES: Reference existing items by their EXACT node name from the graph (so the app can find them). Respect locked nodes — if the user\'s change would touch a locked node, keep it and note it. Compute "affectedDays" = the 1-based day numbers that actually change (keep it minimal — do NOT include unaffected days). NEVER fabricate a restaurant/hotel/attraction name the user didn\'t say, and NEVER invent prices/times/schedules. If the request is unclear or out of scope, return ops:[] with a short clarifying "summary".',
    'Return ONLY valid JSON (no markdown): { "summary"(one short sentence describing what will change, in the user\'s language), "affectedDays":[ints], "ops":[ { "op","targetName"(existing node name or ""),"day"(1-based or null),"slot"(morning|lunch|afternoon|dinner|evening or ""),"name"(only if the user named a real place, else ""),"category"(activity|meal|stay or ""),"cuisine"(if relevant, else ""),"time"(if relevant, else ""),"note"(one short phrase),"why"(one short phrase) } ] }',
    'Write "summary"/"note"/"why" in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.interpretTripCommand = onCall(
  { region: 'us-central1', secrets: [CLAUDE_API_KEY], timeoutSeconds: 30, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const utterance = String(data.utterance || '').trim().slice(0, 400);
    if (!utterance) return { ok: false, debugCode: 'NO_UTTERANCE' };
    const graph = (Array.isArray(data.graph) ? data.graph : []).slice(0, 80).map((n) => ({
      name: String((n && n.name) || '').slice(0, 80), type: String((n && n.type) || '').slice(0, 16),
      day: (n && n.day != null) ? (parseInt(n.day, 10) + 1) : null, locked: !!(n && n.locked),
    })).filter((n) => n.name);
    if (!graph.length) return { ok: false, debugCode: 'NO_GRAPH' };
    const claudeKey = await getAiKey('claude');
    if (!claudeKey) return { ok: false, debugCode: 'NO_CLAUDE_KEY' };
    const userContent = 'Interpret this edit. Input JSON:\n' + JSON.stringify({ dateRange: data.dateRange || '', nodes: graph, request: utterance });
    try {
      const text = await serverCallClaude(buildInterpretPrompt(lang), [{ role: 'user', content: userContent }], true, claudeKey, 1400, 'claude-haiku-4-5-20251001');
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || typeof parsed !== 'object') { console.error('[interpretTripCommand] unparseable, len=' + raw.length); return { ok: false, debugCode: 'INTERPRET_ERROR' }; }
      const OPS = ['skip', 'delete', 'lock', 'unlock', 'replace', 'add', 'retime', 'replan_day', 'stay_extra_night', 'leave_earlier', 'change_return'];
      const clamp = (x, n) => String(x == null ? '' : x).slice(0, n);
      const ops = (Array.isArray(parsed.ops) ? parsed.ops : []).slice(0, 12).map((o) => {
        o = o || {};
        return {
          op: OPS.indexOf(String(o.op)) >= 0 ? o.op : '',
          targetName: clamp(o.targetName, 80), day: (o.day === '' || o.day == null) ? null : (parseInt(o.day, 10) || null),
          slot: ['morning', 'lunch', 'afternoon', 'dinner', 'evening'].indexOf(String(o.slot)) >= 0 ? o.slot : '',
          name: clamp(o.name, 80), category: ['activity', 'meal', 'stay'].indexOf(String(o.category)) >= 0 ? o.category : '',
          cuisine: clamp(o.cuisine, 40), time: clamp(o.time, 24), note: clamp(o.note, 120), why: clamp(o.why, 140),
        };
      }).filter((o) => o.op);
      const affectedDays = (Array.isArray(parsed.affectedDays) ? parsed.affectedDays : []).map((x) => parseInt(x, 10)).filter((x) => x > 0).slice(0, 30);
      return { ok: true, summary: clamp(parsed.summary, 200), affectedDays: affectedDays, ops: ops, dataSource: 'ai_interpreted_intent' };
    } catch (e2) {
      console.error('[interpretTripCommand] failed', e2 && e2.message);
      return { ok: false, debugCode: 'INTERPRET_ERROR' };
    }
  }
);
// ── Natural-Language Journey Builder — parse free-form trip notes into a JOURNEY ──
// The user already knows parts of the route ("July 1 take Hoang Bus from San Jose to
// Orange County, then Michael drives us to San Diego. July 2 zoo…"). We PARSE that
// into a structured, editable list of typed segments (the user confirms before any
// plan is generated). We do the language understanding; we NEVER invent dates the user
// didn't give, schedules, prices, or photos. Explicit user requirements are lockedByUser;
// the rest is flexible and the AI optimizes around the locked spine later.
function buildJourneyNotesPrompt(lang, todayIso) {
  const langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are the JOURNEY PARSER for an AI group-travel concierge (Du Lich Cali, Southern California / Vietnamese-American travelers). The user describes a trip they ALREADY partly planned, in their own words. Extract a precise, structured journey. You ONLY parse and organize what the user said — you do NOT invent destinations, dates, times, schedules, prices, or providers they did not mention.',
    'TODAY is ' + todayIso + '. Resolve relative dates ("July 1", "next Friday") to absolute YYYY-MM-DD using the NEXT upcoming occurrence (never a past date). If the user gives a day with no year, pick the soonest future year.',
    'Output a flat, time-ordered list of SEGMENTS. Each segment has a segmentType:',
    '  - "transport": a long inter-city leg the user named a mode/operator for (e.g. a bus or flight between metro areas).',
    '  - "transfer": a short hop/drop between nearby places or a named driver ride (e.g. "Michael drives us from OC to San Diego").',
    '  - "stay": an overnight stop in a city (create one whenever the user sleeps somewhere; infer the city from context).',
    '  - "activity": a specific thing to do (e.g. "San Diego Zoo").',
    '  - "food": a meal/food experience (e.g. "Vietnamese food in Orange County").',
    '  - "free_time": an open block the user left vague ("something in San Diego in the morning").',
    '  - "return": the final leg back to the origin.',
    'transportMode (only for transport/transfer/return) is one of: car | bus | private_ride | flight | train | walk | other. Map a named DRIVER (e.g. "Michael") to private_ride. Map a named BUS LINE ("Bus Hoang"/"Hoang Bus"/"Xe Do Hoang") to bus with provider "Xe Đò Hoàng". Keep the provider string the user used (a person\'s name, a bus company) — do not translate proper names.',
    'LOCKING: set lockedByUser=true on anything the user stated as a fixed decision (a named operator, a fixed activity like the zoo, a stated arrival time, a return day). Set flexible=true (and lockedByUser=false) on anything vague the user wants help with ("something in San Diego", "enjoy Vietnamese foods") — the concierge will suggest real options later.',
    'FLAGS: needsResearch=true when a real schedule/route must be looked up (e.g. a bus line, ticketed attraction). needsBooking=true when a ride or ticket will need to be booked (named driver rides, bus tickets, the zoo). mainActivity=true for the headline thing of a day.',
    'Also extract: origin (the home/start city), overallStartDate, overallEndDate (YYYY-MM-DD), fixedRequirements (short phrases for each locked decision), flexibleWindows (short phrases for each open block to fill), and missingInfoQuestions (short, specific questions you genuinely need answered to finalize — e.g. exact bus departure time, number of hotel rooms — ONLY real gaps, max 5).',
    'Return ONLY valid JSON (no markdown): { "origin","overallStartDate","overallEndDate","groupName"(if the user named the group, else ""),"segments":[ { "date"(YYYY-MM-DD or ""),"startTime"(HH:MM 24h, or "" if not stated — infer from "about 4pm"→"16:00"),"endTime"(HH:MM or ""),"origin"(place or ""),"destination"(place or ""),"segmentType","transportMode"(or ""),"provider"(or ""),"title"(short, human),"notes"(short, or ""),"lockedByUser"(bool),"flexible"(bool),"mainActivity"(bool),"needsResearch"(bool),"needsBooking"(bool) } ], "fixedRequirements":[strings], "flexibleWindows":[strings], "missingInfoQuestions":[strings] }',
    'Write title/notes/fixedRequirements/flexibleWindows/missingInfoQuestions in ' + langName + '. Keep city names and proper provider names as the user wrote them. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.interpretJourneyNotes = onCall(
  { region: 'us-central1', secrets: [CLAUDE_API_KEY], timeoutSeconds: 60, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const notes = String(data.notes || '').trim().slice(0, 2000);
    if (notes.length < 8) return { ok: false, debugCode: 'NO_NOTES' };
    let todayIso = String(data.todayIso || '').match(/^\d{4}-\d{2}-\d{2}$/) ? data.todayIso : '';
    if (!todayIso) { const d = new Date(); todayIso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    const claudeKey = await getAiKey('claude');
    if (!claudeKey) return { ok: false, debugCode: 'NO_CLAUDE_KEY' };
    const userContent = 'Parse this trip description into a journey. Origin hint (may be blank): "' + String(data.originHint || '').slice(0, 80) + '".\n\nUSER NOTES:\n' + notes;
    try {
      const text = await serverCallClaude(buildJourneyNotesPrompt(lang, todayIso), [{ role: 'user', content: userContent }], true, claudeKey, 2600, 'claude-haiku-4-5-20251001');
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s >= 0 && e > s) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || typeof parsed !== 'object') { console.error('[interpretJourneyNotes] unparseable, len=' + raw.length); return { ok: false, debugCode: 'PARSE_ERROR' }; }
      const clamp = (x, n) => String(x == null ? '' : x).slice(0, n);
      const isoOr = (x) => (String(x || '').match(/^\d{4}-\d{2}-\d{2}$/) ? x : '');
      const timeOr = (x) => { const m = String(x || '').match(/^(\d{1,2}):(\d{2})$/); return m ? (String(Math.min(23, +m[1])).padStart(2, '0') + ':' + m[2]) : ''; };
      const SEG_TYPES = ['transport', 'transfer', 'stay', 'activity', 'food', 'free_time', 'return'];
      const MODES = ['car', 'bus', 'private_ride', 'flight', 'train', 'walk', 'other'];
      const segments = (Array.isArray(parsed.segments) ? parsed.segments : []).slice(0, 40).map((o) => {
        o = o || {};
        const segmentType = SEG_TYPES.indexOf(String(o.segmentType)) >= 0 ? o.segmentType : 'activity';
        const transportMode = MODES.indexOf(String(o.transportMode)) >= 0 ? o.transportMode : '';
        return {
          date: isoOr(o.date), startTime: timeOr(o.startTime), endTime: timeOr(o.endTime),
          origin: clamp(o.origin, 80), destination: clamp(o.destination, 80),
          segmentType: segmentType, transportMode: transportMode, provider: clamp(o.provider, 60),
          title: clamp(o.title, 120), notes: clamp(o.notes, 200),
          lockedByUser: !!o.lockedByUser, flexible: !!o.flexible, mainActivity: !!o.mainActivity,
          needsResearch: !!o.needsResearch, needsBooking: !!o.needsBooking,
        };
      }).filter((sg) => sg.title || sg.destination || sg.origin);
      if (!segments.length) return { ok: false, debugCode: 'NO_SEGMENTS' };
      const strArr = (a, n, max) => (Array.isArray(a) ? a : []).map((x) => clamp(typeof x === 'string' ? x : (x && (x.text || x.question || x.requirement)) || '', n)).filter(Boolean).slice(0, max);
      return {
        ok: true,
        origin: clamp(parsed.origin || data.originHint || '', 80),
        overallStartDate: isoOr(parsed.overallStartDate),
        overallEndDate: isoOr(parsed.overallEndDate),
        groupName: clamp(parsed.groupName, 80),
        segments: segments,
        fixedRequirements: strArr(parsed.fixedRequirements, 160, 16),
        flexibleWindows: strArr(parsed.flexibleWindows, 160, 16),
        missingInfoQuestions: strArr(parsed.missingInfoQuestions, 200, 5),
        dataSource: 'user_notes_parsed_pending_verification',
      };
    } catch (e2) {
      console.error('[interpretJourneyNotes] failed', e2 && e2.message);
      return { ok: false, debugCode: 'PARSE_ERROR' };
    }
  }
);
// ── Experience Optimizer Agent — "How can this trip be better?" ──────────────
// Suggests CONCRETE improvements toward a goal (general/discoveries/lower_cost/kids/food),
// reasoning over weather, current events, group makeup, budget, route, crowds, hours, votes,
// skipped + pinned items. Suggestions only (the user applies) — NEVER fakes prices/URLs/events.
function buildImprovePrompt(lang, goalList) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  var GMAP = {
    discoveries: 'surface MORE hidden gems, scenic spots, local food areas, photo spots and lesser-known discoveries near the existing plan',
    lower_cost: 'LOWER the total cost — cheaper or free alternatives, value swaps, cost-saving timing/combos — WITHOUT gutting the experience',
    kids_fun: 'make it MORE FUN and engaging for the kids/teens in this group (age-appropriate, high-energy or playful)',
    food_focused: 'make it MORE FOOD-FOCUSED — standout local restaurants, food experiences, markets matched to the families\' cuisines',
    relaxing: 'make it MORE RELAXING — fewer stops per day, a slower pace, built-in downtime, low-stress timing and calm spots',
    scenic: 'make it MORE SCENIC — viewpoints, coastal/nature drives, photo spots and beautiful settings',
    theme_park: 'focus on THEME PARKS & marquee attractions — prioritize the big parks/zoos/aquariums and time them well (tickets/lines)',
    senior_friendly: 'make it MORE SENIOR-FRIENDLY — lower walking, seated/accessible options, rest breaks and easy pacing',
    rainy_backup: 'add RAINY-DAY BACKUPS — indoor alternatives and weather-proof options for the at-risk days',
    general: 'make the overall trip better and more memorable for THIS group (better activities, food, timing, backups, cheaper or more exciting swaps)',
  };
  var gl = (Array.isArray(goalList) && goalList.length) ? goalList : ['general'];
  var lines = gl.map(function (g) { return GMAP[g] || GMAP.general; });
  var multi = gl.length > 1;
  return [
    'You are an expert group-travel OPTIMIZER for Du Lich Cali. Given the CURRENT plan and this group, suggest 5-8 CONCRETE, actionable improvements toward the goal(s) below, using current web knowledge. Recommend only — the user decides; never book.',
    (multi
      ? ('GOALS (the user selected MULTIPLE — optimize for ALL of them TOGETHER, balancing the tradeoffs, not just one): ' + lines.map(function (x, i) { return (i + 1) + ') ' + x; }).join('; ') + '.')
      : ('GOAL: ' + lines[0] + '.')),
    (multi ? 'When goals conflict (e.g. lower cost vs. more fun for kids), prefer suggestions that serve SEVERAL goals at once; for any genuine tradeoff, state it briefly in that suggestion\'s "why", and have the "summary" describe how the suggestions balance the selected goals.' : ''),
    'Reason about: weather/season, current or seasonal EVENTS during the dates, the group makeup (kids/teens/seniors — naps, energy, mobility), food preferences, BUDGET, route/driving, crowd timing, opening hours, local discoveries, cost, the group\'s VOTES, SKIPPED items (NEVER re-suggest a skipped place), and PINNED must-dos (keep them, build around them).',
    'GROUP CONSENSUS IS THE PRIMARY SIGNAL: use the input "votesSummary" + "preferenceProfile". PRIORITIZE and KEEP the favorited + liked places (build the trip around them; do not drop a favorited item). NEVER re-suggest anything in skippedPlaces — if you would have suggested a skipped place, REPLACE it with a different real alternative that serves the same need. Match the preferenceProfile (likedCuisines, oceanPreference, themeParkPreference, walkingTolerance, accessibilityNeeds, likedTransport vs skippedTransport, budget, pace). Where you change something, the "why" should reference the group\'s votes/preferences (e.g. "your group loved the beach picks, so…").',
    'Return ONLY valid JSON (no markdown): { "summary"(one short sentence' + (multi ? ' that notes how the picks balance the selected goals' : '') + '), "suggestions":[ { "category"(activity|food|stopover|timing|backup|cheaper|exciting|low_energy|discovery),"title"(short),"detail"(ONE sentence),"day"(1-based day number this applies to, or ""),"place"(a REAL place name if relevant, else ""),"city","action"(add|replace|consider),"why"(one short phrase: why it fits THIS group' + (multi ? ', noting any tradeoff' : '') + '),"ticketed"(true|false) } ] }',
    'HARD RULES: Use REAL, well-known place names; NEVER invent exact prices, hours, availability, or URLs (say "pending verification" / leave for search). NEVER re-suggest a place in the skipped list. Keep pinned must-dos. Each suggestion must be specific and immediately useful (not generic advice). Write all human-readable text in ' + langName + '. Output ONE compact valid JSON object only.',
  ].filter(Boolean).join('\n');
}
exports.improveTripPlan = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 50, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const ALLOWED = ['discoveries', 'lower_cost', 'kids_fun', 'food_focused', 'relaxing', 'scenic', 'theme_park', 'senior_friendly', 'rainy_backup', 'general'];
    // Multi-select: accept improvementGoals[] (preferred) or a single goal (back-compat).
    let goals = Array.isArray(data.improvementGoals) ? data.improvementGoals : (data.goal ? [data.goal] : []);
    goals = goals.filter((g, i) => ALLOWED.indexOf(g) >= 0 && goals.indexOf(g) === i).slice(0, 5);
    if (!goals.length) goals = ['general'];
    const dests = (Array.isArray(trip.destinations) ? trip.destinations : []).map(d => String((d && d.city) || '').trim()).filter(Boolean);
    if (!dests.length) return { ok: false, debugCode: 'NO_DESTINATIONS', suggestions: [] };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', suggestions: [] };
    const userContent = 'Improve this trip. Input JSON:\n' + JSON.stringify({
      destinations: dests.slice(0, 8), dateRange: trip.dateRange, budget: trip.budget, pace: trip.tripStyle,
      improvementGoals: goals,
      groupProfile: tcGroupProfile(trip.families, trip.budget, trip.tripStyle), familiesSummary: summarizeFamiliesForTrip(trip.families),
      planDays: Array.isArray(data.planDays) ? data.planDays.slice(0, 12) : [],
      skippedPlaces: Array.isArray(data.skippedPlaces) ? data.skippedPlaces.slice(0, 30).map(x => String(x).slice(0, 100)) : [],
      likedPlaces: Array.isArray(data.likedPlaces) ? data.likedPlaces.slice(0, 30).map(x => String(x).slice(0, 100)) : [],
      favoritePlaces: Array.isArray(data.favoritePlaces) ? data.favoritePlaces.slice(0, 20).map(x => String(x).slice(0, 100)) : [],
      pinnedActivities: Array.isArray(trip.pinnedActivities) ? trip.pinnedActivities.slice(0, 12) : [],
      preferenceProfile: (data.preferenceProfile && typeof data.preferenceProfile === 'object') ? data.preferenceProfile : null,
      votesSummary: String(data.votesSummary || '').slice(0, 600), estTotalCost: data.estTotalCost || '',
    });
    try {
      const text = await serverCallGeminiGrounded(buildImprovePrompt(lang, goals) + '\n\n' + userContent, geminiKey, 3000);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || !Array.isArray(parsed.suggestions)) { console.error('[improveTripPlan] unparseable, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', suggestions: [] }; }
      const CATS = ['activity', 'food', 'stopover', 'timing', 'backup', 'cheaper', 'exciting', 'low_energy', 'discovery'];
      const suggestions = parsed.suggestions.slice(0, 8).map(x => {
        x = x || {};
        return {
          category: CATS.indexOf(x.category) >= 0 ? x.category : 'activity',
          title: String(x.title || '').slice(0, 120), detail: String(x.detail || '').slice(0, 240),
          day: (x.day === '' || x.day == null) ? '' : (parseInt(x.day, 10) || ''),
          place: String(x.place || '').slice(0, 120), city: String(x.city || '').slice(0, 80),
          action: ['add', 'replace', 'consider'].indexOf(x.action) >= 0 ? x.action : 'consider',
          why: String(x.why || '').slice(0, 200), ticketed: !!x.ticketed,
          dataSource: 'ai_suggested_pending_verification',
        };
      }).filter(x => x.title);
      return { ok: true, goal: goals[0], goals, summary: String(parsed.summary || '').slice(0, 200), suggestions, dataSource: 'ai_suggested_pending_verification' };
    } catch (e2) {
      console.error('[improveTripPlan] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', suggestions: [] };
    }
  }
);
// ── Skip → alternatives: same-intent replacements for a place the user skipped ─
// Like a local concierge: given the skipped place + city, suggest 4-6 REAL alternatives
// with the SAME intent (same cuisine/category, similar vibe). No fake prices/URLs.
function buildAltPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are a LOCAL concierge for Du Lich Cali. The traveler SKIPPED one place; suggest REAL alternatives with the SAME intent (same cuisine/category and similar vibe) in the same city/area, using current web knowledge. Recommend only — never book or invent.',
    'Return ONLY valid JSON (no markdown): { "alternatives":[ { "name"(a REAL, well-known place — never invented),"category","cuisine"(if a restaurant, else ""),"address"(approx street + city),"why"(one short sentence: why it fits the same need),"dataSource":"ai_researched_pending_verification" } ] }',
    'Give 4-6 alternatives. THINK LIKE A LOCAL: if the area has a famous community matching the cuisine, use its real icons (e.g. Orange County Little Saigon Vietnamese → Phoholic, Pho 101, Ngu Binh, Brodard, Oc & Lau, Nep Cafe). Match the families\' food/age preferences when given. Do NOT repeat the skipped place. NEVER output exact prices, availability, phone numbers, or URLs. Keep each field to one short phrase. Write all human-readable text in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.suggestPlaceAlternatives = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 30, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const place = data.place || {};
    if (!place.name) return { ok: false, debugCode: 'NO_PLACE', alternatives: [] };
    const city = String(data.city || '').slice(0, 100);
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', alternatives: [] };
    const userContent = 'Skipped place + context:\n' + JSON.stringify({
      skipped: { name: String(place.name).slice(0, 120), category: String(place.category || '').slice(0, 60), cuisine: String(place.cuisine || '').slice(0, 60) },
      city, familiesSummary: summarizeFamiliesForTrip(data.families),
    });
    try {
      const text = await serverCallGeminiGrounded(buildAltPrompt(lang) + '\n\n' + userContent, geminiKey, 1400);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed) { console.error('[suggestPlaceAlternatives] unparseable, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR', alternatives: [] }; }
      const skip = String(place.name).trim().toLowerCase();
      let alternatives = (Array.isArray(parsed.alternatives) ? parsed.alternatives : [])
        .filter(a => a && a.name && String(a.name).trim().toLowerCase() !== skip)
        .slice(0, 6).map(a => ({
          name: String(a.name).slice(0, 120),
          category: String(a.category || '').slice(0, 60),
          cuisine: String(a.cuisine || '').slice(0, 60),
          address: String(a.address || '').slice(0, 140),
          why: String(a.why || '').slice(0, 200),
          dataSource: 'ai_researched_pending_verification',
        }));
      return { ok: true, alternatives };
    } catch (e2) {
      console.error('[suggestPlaceAlternatives] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR', alternatives: [] };
    }
  }
);
// AI "Why this day/time?" — a short, GENERIC explanation of why a place sits in a given
// day + time slot (route clustering, opening hours, crowds, weather, family/age pacing).
// Never invents exact facts (no precise hours/prices/wait times) — speaks in general terms.
function buildPlacementReasonPrompt(lang) {
  var langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are a thoughtful group-travel concierge for Du Lich Cali. Explain in 1–2 short sentences WHY the given place makes sense on this day and in this time slot for THIS group.',
    'Reason GENERICALLY about the usual trade-offs a good planner weighs: clustering with the other places that day to cut driving, typical opening hours / best time of day for that kind of place, likely crowds, weather/heat, meal timing, and the group\'s family mix (young kids\' naps, teens, seniors\' mobility/energy, overall pace).',
    'HARD RULES: Do NOT invent exact facts — no precise opening hours, prices, wait times, weather forecasts, or any claim you cannot reason generally. Speak in general terms ("usually quieter in the morning", "keeps driving low by pairing with nearby stops"). Be warm and concise. NEVER mention you are an AI or that data is unverified.',
    'Return ONLY valid JSON (no markdown): { "reason": "<1–2 sentence explanation>" }. Write the reason in ' + langName + '. Output ONE compact JSON object only.',
  ].join('\n');
}
exports.explainTripPlacement = onCall(
  { region: 'us-central1', secrets: [CLAUDE_API_KEY], timeoutSeconds: 30, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const place = data.place || {};
    if (!place.name) return { ok: false, debugCode: 'NO_PLACE', reason: '' };
    const claudeKey = await getAiKey('claude');
    if (!claudeKey) return { ok: false, debugCode: 'NO_CLAUDE_KEY', reason: '' };
    const userContent = 'Explain this placement. Input JSON:\n' + JSON.stringify({
      place: { name: String(place.name).slice(0, 120), category: String(place.category || '').slice(0, 60), cuisine: String(place.cuisine || '').slice(0, 60) },
      dayNumber: data.dayNumber || 1, timeSlot: String(data.timeSlot || '').slice(0, 20), dayTitle: String(data.dayTitle || '').slice(0, 120),
      city: String(data.city || '').slice(0, 100),
      sameDayPlaces: Array.isArray(data.dayPlaces) ? data.dayPlaces.slice(0, 8).map(x => String(x).slice(0, 80)) : [],
      familiesSummary: summarizeFamiliesForTrip(data.families),
    });
    try {
      const text = await serverCallClaude(buildPlacementReasonPrompt(lang), [{ role: 'user', content: userContent }], true, claudeKey, 400, 'claude-haiku-4-5-20251001');
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      let reason = '';
      try { const parsed = JSON.parse(raw); reason = String((parsed && parsed.reason) || '').slice(0, 400); } catch (e3) { reason = ''; }
      if (!reason) return { ok: false, debugCode: 'NO_REASON', reason: '' };
      return { ok: true, reason };
    } catch (e2) {
      console.error('[explainTripPlacement] failed', e2 && e2.message);
      return { ok: false, debugCode: 'AI_ERROR', reason: '' };
    }
  }
);
// ── Shared trip access: passcode-gated invite + server-enforced roles ──────
// The trip owner generates a random shareToken + 6-digit passcode (hashed, never
// stored plaintext). Invitees open /trip/<token>, log in (non-anonymous), and join
// via joinTripWithPasscode — the ONLY writer of tripMembers (so a member can never
// self-add or self-promote). Privileged actions (roles, disable, approve suggestions)
// are owner/organizer-gated here. The app never charges or purchases anything.
const crypto = require('crypto');
function tripHashPasscode(passcode, salt) { return crypto.createHash('sha256').update(String(salt) + ':' + String(passcode)).digest('hex'); }
function tripRandomToken() { return crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12); }
function tripRandomPasscode() { return String(crypto.randomInt(100000, 1000000)); }
function tripRequireAuth(request) {
  const a = request.auth;
  if (!a || !a.uid) throw new HttpsError('unauthenticated', 'Sign in to manage trip sharing.');
  if (a.token && a.token.firebase && a.token.firebase.sign_in_provider === 'anonymous') throw new HttpsError('permission-denied', 'Use your account, not a guest session.');
  return a.uid;
}
async function tripGetOwnerUid(tripId) { const s = await db.collection('groupTrips').doc(tripId).get(); return s.exists ? (s.data().ownerUid || '') : null; }
function tripMemberRef(tripId, uid) { return db.collection('tripMembers').doc(tripId).collection('members').doc(uid); }
function tripContactRef(tripId, uid) { return db.collection('tripMemberContacts').doc(tripId).collection('members').doc(uid); }
function tripNormPhone(p) { var dd = String(p || '').replace(/\D/g, ''); if (dd.length === 11 && dd.charAt(0) === '1') dd = dd.slice(1); return dd.slice(-10); }
function tripPhoneFromAuth(request) { try { var em = request.auth && request.auth.token && request.auth.token.email; if (em && /@mobile-barber\.dulichcali21\.local$/.test(em)) return em.split('@')[0]; } catch (e) {} return ''; }
async function tripFamilyName(tripId, familyId) { if (!familyId) return ''; const ts = await db.collection('groupTrips').doc(tripId).get(); const fams = (ts.exists && Array.isArray(ts.data().families)) ? ts.data().families : []; const ff = fams.filter(f => f && f.id === familyId)[0]; return ff ? (ff.name || '') : ''; }
async function tripCallerRole(tripId, uid) {
  const ownerUid = await tripGetOwnerUid(tripId);
  if (ownerUid && ownerUid === uid) return 'owner';
  const m = await tripMemberRef(tripId, uid).get();
  return m.exists ? (m.data().role || 'member') : null;
}
exports.createTripShareAccess = onCall({ region: 'us-central1', timeoutSeconds: 20, cors: true }, async (request) => {
  const uid = tripRequireAuth(request);
  const d = request.data || {};
  const tripId = String(d.tripId || '');
  if (!tripId) throw new HttpsError('invalid-argument', 'tripId required');
  const ownerUid = await tripGetOwnerUid(tripId);
  if (ownerUid == null) throw new HttpsError('not-found', 'Trip not found');
  if (ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the trip owner can manage sharing.');
  const batch = db.batch();
  const prior = await db.collection('tripShareAccess').where('tripId', '==', tripId).where('enabled', '==', true).get();
  prior.forEach(doc => batch.update(doc.ref, { enabled: false }));
  const shareToken = tripRandomToken(), passcode = tripRandomPasscode(), salt = crypto.randomBytes(8).toString('hex');
  batch.set(db.collection('tripShareAccess').doc(shareToken), {
    tripId, passcodeHash: tripHashPasscode(passcode, salt), salt, enabled: true,
    createdBy: uid, createdAt: admin.firestore.FieldValue.serverTimestamp(), lastUsedAt: null, attemptCount: 0, attemptWindowStart: 0,
  });
  batch.set(tripMemberRef(tripId, uid), { displayName: String(d.ownerName || '').slice(0, 80), familyId: String(d.ownerFamilyId || ''), familyName: String(d.ownerFamilyName || '').slice(0, 80), role: 'owner', active: true, joinedAt: admin.firestore.FieldValue.serverTimestamp(), lastActiveAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  batch.set(tripContactRef(tripId, uid), { phone: tripPhoneFromAuth(request), email: '' }, { merge: true });
  await batch.commit();
  return { ok: true, shareToken, passcode };
});
exports.getTripSharePreview = onCall({ region: 'us-central1', timeoutSeconds: 15, cors: true }, async (request) => {
  const shareToken = String((request.data || {}).shareToken || '');
  if (!shareToken) return { ok: false, reason: 'invalid' };
  const acc = await db.collection('tripShareAccess').doc(shareToken).get();
  if (!acc.exists || !acc.data().enabled) return { ok: false, reason: 'disabled' };
  const trip = await db.collection('groupTrips').doc(acc.data().tripId).get();
  if (!trip.exists) return { ok: false, reason: 'not_found' };
  const t = trip.data();
  if (t.deleted === true) return { ok: false, reason: 'not_found' };
  const fams = Array.isArray(t.families) ? t.families.map((f, i) => ({ id: (f && f.id) || ('f' + i), name: (f && f.name) || '' })).filter(f => f.name) : [];
  return { ok: true, tripId: acc.data().tripId, groupName: t.groupName || '', destination: t.destination || '', dateRange: t.dateRange || '', families: fams };
});
exports.joinTripWithPasscode = onCall({ region: 'us-central1', timeoutSeconds: 20, cors: true }, async (request) => {
  const uid = tripRequireAuth(request);
  const d = request.data || {};
  const accRef = db.collection('tripShareAccess').doc(String(d.shareToken || ''));
  const nowMs = Date.now();
  const verdict = await db.runTransaction(async (tx) => {
    const acc = await tx.get(accRef);
    if (!acc.exists || !acc.data().enabled) return { ok: false, reason: 'disabled' };
    const a = acc.data();
    let count = a.attemptCount || 0, win = a.attemptWindowStart || 0;
    if (nowMs - win > 600000) { count = 0; win = nowMs; }
    if (count >= 8) return { ok: false, reason: 'rate_limited' };
    if (tripHashPasscode(String(d.passcode || ''), a.salt) !== a.passcodeHash) { tx.update(accRef, { attemptCount: count + 1, attemptWindowStart: win }); return { ok: false, reason: 'bad_passcode' }; }
    tx.update(accRef, { attemptCount: 0, attemptWindowStart: nowMs, lastUsedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { ok: true, tripId: a.tripId };
  });
  if (!verdict.ok) return verdict;
  const tripId = verdict.tripId;
  const tripSnap0 = await db.collection('groupTrips').doc(tripId).get();
  if (!tripSnap0.exists || tripSnap0.data().deleted === true) return { ok: false, reason: 'not_found' };
  const ownerUid = await tripGetOwnerUid(tripId);
  const memRef = tripMemberRef(tripId, uid);
  const existing = await memRef.get();
  const phoneNorm = tripNormPhone(d.phone) || tripPhoneFromAuth(request);
  let familyId = String(d.familyId || ''), familyName = String(d.familyName || '').slice(0, 80);
  // "Add my family" → append a new family to the trip (atomic), and use its id.
  if (!familyId && familyName) {
    const tripRef = db.collection('groupTrips').doc(tripId);
    familyId = await db.runTransaction(async (tx) => {
      const snap = await tx.get(tripRef);
      const fams = (snap.exists && Array.isArray(snap.data().families)) ? snap.data().families.slice() : [];
      const fid = 'fam_' + crypto.randomBytes(4).toString('hex');
      fams.push({ id: fid, name: familyName, primaryContactName: String(d.displayName || '').slice(0, 80), addedByMember: true });
      tx.update(tripRef, { families: fams });
      return fid;
    });
  } else if (familyId && !familyName) {
    familyName = await tripFamilyName(tripId, familyId);
  }
  // Determine role: keep existing; owner stays owner; new members are 'member'
  // (a self-requested 'organizer' is stored as requestedRole for owner approval, NOT auto-granted).
  let role = existing.exists ? (existing.data().role || 'member') : (ownerUid === uid ? 'owner' : 'member');
  // Adopt an owner-created pending invite matching this phone (pre-assigned family/role).
  if (!existing.exists && ownerUid !== uid && phoneNorm) {
    const invRef = tripMemberRef(tripId, 'inv_' + phoneNorm);
    const inv = await invRef.get();
    if (inv.exists) {
      const iv = inv.data() || {};
      if (iv.role === 'organizer') role = 'organizer';
      if (!familyId && iv.familyId) { familyId = iv.familyId; familyName = iv.familyName || familyName; }
      await invRef.delete().catch(() => {});
      await tripContactRef(tripId, 'inv_' + phoneNorm).delete().catch(() => {});
    }
  }
  const reqRole = ['member', 'organizer'].indexOf(String(d.requestedRole)) !== -1 ? String(d.requestedRole) : 'member';
  await memRef.set({
    displayName: String(d.displayName || '').slice(0, 80), familyId, familyName, role, requestedRole: reqRole, active: true,
    joinedAt: existing.exists && existing.data().joinedAt ? existing.data().joinedAt : admin.firestore.FieldValue.serverTimestamp(),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await tripContactRef(tripId, uid).set({ phone: phoneNorm, email: String(d.email || '').slice(0, 120) }, { merge: true });
  return { ok: true, tripId, role, displayName: String(d.displayName || '').slice(0, 80), familyId, familyName };
});
exports.setTripMemberRole = onCall({ region: 'us-central1', timeoutSeconds: 15, cors: true }, async (request) => {
  const uid = tripRequireAuth(request);
  const d = request.data || {};
  const tripId = String(d.tripId || ''), memberUid = String(d.memberUid || ''), role = String(d.role || '');
  if (['organizer', 'member'].indexOf(role) === -1) throw new HttpsError('invalid-argument', 'bad role');
  const ownerUid = await tripGetOwnerUid(tripId);
  if (ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the owner can set roles.');
  if (memberUid === ownerUid) throw new HttpsError('invalid-argument', 'Cannot change the owner role.');
  await tripMemberRef(tripId, memberUid).set({ role }, { merge: true });
  return { ok: true };
});
exports.removeTripMember = onCall({ region: 'us-central1', timeoutSeconds: 15, cors: true }, async (request) => {
  const uid = tripRequireAuth(request);
  const d = request.data || {};
  const tripId = String(d.tripId || ''), memberUid = String(d.memberUid || '');
  const ownerUid = await tripGetOwnerUid(tripId);
  if (ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the owner can remove members.');
  if (memberUid === ownerUid) throw new HttpsError('invalid-argument', 'Cannot remove the owner.');
  await tripMemberRef(tripId, memberUid).delete().catch(() => {});
  await tripContactRef(tripId, memberUid).delete().catch(() => {});
  return { ok: true };
});
exports.setTripMemberFamily = onCall({ region: 'us-central1', timeoutSeconds: 15, cors: true }, async (request) => {
  const uid = tripRequireAuth(request);
  const d = request.data || {};
  const tripId = String(d.tripId || ''), memberUid = String(d.memberUid || '');
  let familyId = String(d.familyId || ''), familyName = String(d.familyName || '').slice(0, 80);
  const ownerUid = await tripGetOwnerUid(tripId);
  if (ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the owner can assign families.');
  if (familyId && !familyName) familyName = await tripFamilyName(tripId, familyId);
  await tripMemberRef(tripId, memberUid).set({ familyId, familyName }, { merge: true });
  return { ok: true };
});
exports.inviteTripMember = onCall({ region: 'us-central1', timeoutSeconds: 15, cors: true }, async (request) => {
  const uid = tripRequireAuth(request);
  const d = request.data || {};
  const tripId = String(d.tripId || '');
  const ownerUid = await tripGetOwnerUid(tripId);
  if (ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the owner can invite members.');
  const phoneNorm = tripNormPhone(d.phone);
  if (!phoneNorm) throw new HttpsError('invalid-argument', 'A mobile phone number is required to invite.');
  const role = ['organizer', 'member'].indexOf(String(d.role)) !== -1 ? String(d.role) : 'member';
  let familyId = String(d.familyId || ''), familyName = String(d.familyName || '').slice(0, 80);
  if (familyId && !familyName) familyName = await tripFamilyName(tripId, familyId);
  const invId = 'inv_' + phoneNorm;
  // Pending roster entry: NOT an access grant (its id is never a real auth uid, so
  // gtTripMember can't match it). The phone lives only in the owner-only contacts doc.
  await tripMemberRef(tripId, invId).set({
    displayName: String(d.displayName || '').slice(0, 80), familyId, familyName, role, requestedRole: role,
    pending: true, active: false, joinedAt: null, lastActiveAt: null,
  }, { merge: true });
  await tripContactRef(tripId, invId).set({ phone: phoneNorm, email: String(d.email || '').slice(0, 120) }, { merge: true });
  return { ok: true, inviteId: invId };
});
exports.setTripShareEnabled = onCall({ region: 'us-central1', timeoutSeconds: 15, cors: true }, async (request) => {
  const uid = tripRequireAuth(request);
  const d = request.data || {};
  const tripId = String(d.tripId || ''), enabled = !!d.enabled;
  const ownerUid = await tripGetOwnerUid(tripId);
  if (ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the owner can change sharing.');
  const toks = await db.collection('tripShareAccess').where('tripId', '==', tripId).get();
  const batch = db.batch();
  toks.forEach(doc => batch.update(doc.ref, { enabled }));
  await batch.commit();
  return { ok: true, count: toks.size };
});
exports.decideTripSuggestion = onCall({ region: 'us-central1', timeoutSeconds: 20, cors: true }, async (request) => {
  const uid = tripRequireAuth(request);
  const d = request.data || {};
  const tripId = String(d.tripId || ''), suggestionId = String(d.suggestionId || ''), status = String(d.status || '');
  if (['approved', 'rejected', 'pending'].indexOf(status) === -1) throw new HttpsError('invalid-argument', 'bad status');
  const role = await tripCallerRole(tripId, uid);
  if (role !== 'owner' && role !== 'organizer') throw new HttpsError('permission-denied', 'Only owner/organizer can decide suggestions.');
  const ref = db.collection('groupTrips').doc(tripId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'trip');
    const sugg = (snap.data().suggestions || []).map(s => (s && s.id === suggestionId) ? Object.assign({}, s, { status: status }) : s);
    tx.update(ref, { suggestions: sugg });
  });
  return { ok: true };
});
// Owner-only SOFT delete. Client delete stays blocked in rules (delete:false); this
// Admin-SDK callable is the only delete path. It marks the trip deleted (recoverable),
// and disables every share token so the link + passcode immediately stop working.
// Participants/organizers cannot delete — only the trip owner (ownerUid).
exports.deleteGroupTrip = onCall({ region: 'us-central1', timeoutSeconds: 15, cors: true }, async (request) => {
  const uid = tripRequireAuth(request);
  const d = request.data || {};
  const tripId = String(d.tripId || '');
  if (!tripId) throw new HttpsError('invalid-argument', 'tripId required');
  const ref = db.collection('groupTrips').doc(tripId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true, alreadyGone: true };
  if ((snap.data().ownerUid || '') !== uid) throw new HttpsError('permission-denied', 'Only the trip owner can delete this trip.');
  await ref.set({ deleted: true, deletedAt: admin.firestore.FieldValue.serverTimestamp(), deletedBy: uid }, { merge: true });
  const toks = await db.collection('tripShareAccess').where('tripId', '==', tripId).get();
  if (!toks.empty) { const batch = db.batch(); toks.forEach(doc => batch.update(doc.ref, { enabled: false })); await batch.commit(); }
  return { ok: true };
});
exports.validateAddressAndDistance = onCall(
  { region: 'us-central1', secrets: [GOOGLE_MAPS_API_KEY], timeoutSeconds: 30, cors: true },
  async (request) => {
    const d = request.data || {};
    const addr = d.serviceAddress || {};
    const origin = d.vendorOrigin || {};
    const isStr = typeof addr === 'string';
    const city = isStr ? '' : String(addr.city || '').trim();
    const zip = isStr ? '' : String(addr.zip || '').trim();
    const addressStr = isStr ? addr : [addr.address, addr.city, addr.zip].filter(Boolean).join(', ');
    const key = GOOGLE_MAPS_API_KEY.value();

    function fallback(reason) {
      const dest = mbCityCentroid(city, zip);
      const orig = (typeof origin.lat === 'number' && typeof origin.lng === 'number')
        ? { lat: origin.lat, lng: origin.lng } : mbCityCentroid(origin.city || '', origin.zip || '');
      let dist = 0;
      if (dest && orig) dist = Math.round(mbHaversineMiles(orig, dest) * 1.3 * 10) / 10; // 1.3x road factor
      const hasLoc = !!(city || zip);
      return {
        ok: true, formattedAddress: addressStr,
        lat: dest ? dest.lat : null, lng: dest ? dest.lng : null, placeId: '',
        addressValidationStatus: hasLoc ? 'city_zip_only' : 'invalid',
        distanceMiles: dist, travelMinutes: dist ? Math.round(dist * 2) : 0,
        routeConfidence: 'low', googleMapsUsed: false, reason: reason || 'fallback',
      };
    }

    // A real Google Maps key is ~39 chars; treat missing/short/placeholder values
    // as "not configured" so we fall back without a doomed network call.
    if (!key || String(key).trim().length < 20) return fallback('no_maps_key');
    if (!addressStr) return { ok: true, formattedAddress: '', lat: null, lng: null, placeId: '', addressValidationStatus: 'invalid', distanceMiles: 0, travelMinutes: 0, routeConfidence: 'low', googleMapsUsed: false };

    try {
      const geo = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${key}`).then((r) => r.json());
      if (!geo || geo.status === 'ZERO_RESULTS' || !geo.results || !geo.results.length) {
        if (geo && geo.status === 'ZERO_RESULTS') {
          return { ok: true, formattedAddress: addressStr, lat: null, lng: null, placeId: '', addressValidationStatus: 'invalid', distanceMiles: 0, travelMinutes: 0, routeConfidence: 'low', googleMapsUsed: true };
        }
        return fallback('geocode_' + ((geo && geo.status) || 'error'));
      }
      const g = geo.results[0];
      const loc = (g.geometry && g.geometry.location) || {};
      const locType = (g.geometry && g.geometry.location_type) || '';
      const precise = (locType === 'ROOFTOP' || locType === 'RANGE_INTERPOLATED');
      let distanceMiles = 0, travelMinutes = 0;
      const originStr = (typeof origin.lat === 'number' && typeof origin.lng === 'number')
        ? `${origin.lat},${origin.lng}` : (origin.address || [origin.city, origin.zip].filter(Boolean).join(', '));
      if (originStr && loc.lat != null) {
        try {
          const dm = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originStr)}&destinations=${loc.lat},${loc.lng}&key=${key}`).then((r) => r.json());
          const el = dm && dm.rows && dm.rows[0] && dm.rows[0].elements && dm.rows[0].elements[0];
          if (el && el.status === 'OK') { distanceMiles = Math.round(el.distance.value / 1609.34 * 10) / 10; travelMinutes = Math.round(el.duration.value / 60); }
        } catch (e) { /* distance optional — keep geocode result */ }
      }
      return {
        ok: true, formattedAddress: g.formatted_address || addressStr,
        lat: loc.lat != null ? loc.lat : null, lng: loc.lng != null ? loc.lng : null, placeId: g.place_id || '',
        addressValidationStatus: precise ? 'precise' : 'approximate',
        distanceMiles, travelMinutes, routeConfidence: precise ? 'high' : 'medium', googleMapsUsed: true,
      };
    } catch (err) {
      console.warn('[validateAddressAndDistance] maps error:', err && err.message);
      return fallback('maps_exception');
    }
  }
);
// ── computeTripRoute ─────────────────────────────────────────────────────────
// VERIFIED route legs for the Travel Concierge — reuses the SAME Google Maps key +
// Distance Matrix integration as the ride/driver subsystem (validateAddressAndDistance).
// The AI must NEVER invent distance/drive-time; it gets these here. Degrades to a
// city-centroid haversine estimate (clearly labelled source:'estimated') only when the
// Maps key is absent. Input: { cities:[ ordered city strings ] }.
// Shared route-leg computation (single source of truth for computeTripRoute AND the
// transport agent). Verified Google Distance Matrix when GOOGLE_MAPS_API_KEY is real,
// else a clearly-labelled haversine estimate. Never invents — returns source per leg.
function tcFmtDur(min) { if (!min) return ''; const h = Math.floor(min / 60), m = Math.round(min % 60); return (h ? h + 'h ' : '') + (m ? m + 'm' : (h ? '' : '0m')); }
function tcDirLink(a, b) { return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(a) + '&destination=' + encodeURIComponent(b); }
async function tcGoogleLeg(a, b, key) {
  try {
    const dm = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(a)}&destinations=${encodeURIComponent(b)}&departure_time=now&key=${key}`).then((r) => r.json());
    const el = dm && dm.rows && dm.rows[0] && dm.rows[0].elements && dm.rows[0].elements[0];
    if (el && el.status === 'OK' && el.distance) {
      const miles = Math.round(el.distance.value / 1609.34);
      const dmin = Math.round(el.duration.value / 60);
      const tmin = el.duration_in_traffic ? Math.round(el.duration_in_traffic.value / 60) : dmin;
      return { distanceMiles: miles, durationMin: dmin, durationTrafficMin: tmin, source: 'google_maps' };
    }
  } catch (e) { /* fall through to estimate */ }
  return null;
}
function tcEstLeg(a, b) {
  const ca = tcCentroid(a), cb = tcCentroid(b);
  if (!ca || !cb) return null;
  const miles = Math.round(mbHaversineMiles(ca, cb) * 1.12); // CA-freeway road factor
  return { distanceMiles: miles, durationMin: Math.round(miles / 60 * 60), durationTrafficMin: Math.round(miles / 52 * 60), source: 'estimated' };
}
async function tcComputeRouteLegs(cities, key) {
  const useGoogle = !!(key && String(key).trim().length >= 20);
  const legs = [];
  for (let i = 0; i < cities.length - 1; i++) {
    let r = useGoogle ? await tcGoogleLeg(cities[i], cities[i + 1], key) : null;
    if (!r) r = tcEstLeg(cities[i], cities[i + 1]);
    if (!r) r = { distanceMiles: 0, durationMin: 0, durationTrafficMin: 0, source: 'unknown' };
    legs.push({
      fromCity: cities[i], toCity: cities[i + 1],
      distanceMiles: r.distanceMiles, distanceText: r.distanceMiles ? (r.distanceMiles + ' mi') : '',
      durationText: tcFmtDur(r.durationMin), durationTrafficText: tcFmtDur(r.durationTrafficMin), durationMin: r.durationMin || 0,
      mapLink: tcDirLink(cities[i], cities[i + 1]), source: r.source,
    });
  }
  const srcs = legs.map((l) => l.source);
  const overall = legs.length ? (srcs.every((s) => s === 'google_maps') ? 'google_maps' : (srcs.every((s) => s === 'unknown') ? 'unknown' : 'estimated')) : 'unknown';
  return { legs, source: overall };
}
exports.computeTripRoute = onCall(
  { region: 'us-central1', secrets: [GOOGLE_MAPS_API_KEY], timeoutSeconds: 30, memory: '256MiB', cors: true },
  async (request) => {
    const cities = (Array.isArray(request.data && request.data.cities) ? request.data.cities : [])
      .map((s) => String(s || '').trim()).filter(Boolean).slice(0, 12);
    if (cities.length < 2) return { ok: false, legs: [] };
    const { legs, source } = await tcComputeRouteLegs(cities, GOOGLE_MAPS_API_KEY.value());
    const totMiles = legs.reduce((s, l) => s + (l.distanceMiles || 0), 0);
    const totMin = legs.reduce((s, l) => s + (l.durationMin || 0), 0);
    return { ok: true, source, legs, totalDistanceText: totMiles ? (totMiles + ' mi') : '', totalDurationText: tcFmtDur(totMin) };
  }
);
// ── AI Transportation Agent (Phase B) ────────────────────────────────────────
// Compares realistic travel options PER MAJOR LEG (origin→first dest, dest→dest,
// final→home) and recommends a best-fit with a TRANSPARENT reason. Car/DLC-ride
// distance+time are AUTHORITATIVE (computeTripRoute helper — Google or labelled
// estimate); the AI NEVER invents them. Flight/bus/train are rough AI estimates
// ("pending verification") + a real search link — never fabricated prices/schedules.
// "AI reasons, providers verify." No hardcoded city/airport/route/provider/car type.
// Deterministic transport-options builder — the RELIABILITY CORE of the Transport tab.
// For EACH verified route leg it ALWAYS produces: a personal-car option (verified Google
// distance/time + a labelled gas/parking/toll estimate + route link), a private Du Lich Cali
// ride, a flight (when the leg is long enough — Google Flights + nearest-airport search links,
// labelled per-person/group/per-family estimate + airport buffer/baggage notes), and an
// intercity bus (Greyhound + FlixBus + Hoang Express for CA Vietnamese routes — labelled
// estimate + station note). NO AI dependency, NO fabricated prices/schedules/confirmations —
// rough costs are clearly "(est.)" and links are REAL search URLs. Human-readable reasons,
// pros and cons are emitted as KEYS the client localizes (vi/en/es), never as English prose.
function tcGsearch(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }
function tcMoney(lo, hi) { return '$' + Math.round(lo) + '–$' + Math.round(hi); }
// Is this city on the Xe Đò Hoàng SERVICE NETWORK (Bay Area ↔ Little Saigon/SoCal, and
// Bay Area ↔ AZ/NV)? Hoàng runs a REAL fixed route network, so detecting its service area by
// state suffix + the geography centroid table + the operator's known hub cities is correct
// domain modeling — NOT a hardcoded "always suggest Little Saigon" answer. Works whether or
// not the city carries a ", CA" suffix (the old brittle ", CA"-only check missed bare names).
function tcHoangServiceCity(city) {
  const s = String(city || '').toLowerCase().trim();
  if (!s) return false;
  if (/\b(ca|calif|california|az|ariz|arizona|nv|nev|nevada)\b/.test(s)) return true; // explicit state
  if (tcCentroid(city)) return true; // known Western city in the centroid table (CA + Vegas)
  // Hoàng hub/served cities (substring match; the state regex above already covers suffixed names).
  const HUBS = ['san jose', 'san francisco', 'oakland', 'san mateo', 'santa clara', 'sunnyvale', 'milpitas', 'fremont', 'hayward', 'sacramento', 'stockton', 'elk grove', 'bay area',
    'los angeles', 'orange county', 'westminster', 'garden grove', 'santa ana', 'anaheim', 'fountain valley', 'huntington beach', 'little saigon', 'el monte', 'rosemead', 'san gabriel', 'alhambra', 'monterey park', 'san diego', 'phoenix'];
  for (let i = 0; i < HUBS.length; i++) { if (s.indexOf(HUBS[i]) >= 0) return true; }
  return false;
}
// Map a USER-LOCKED journey leg (transportMode + provider the traveler explicitly chose) to the
// transport-tab option mode. A named driver / "private ride" → dlc_ride; a named coach → hoang_bus
// when it's clearly Xe Đò Hoàng or both endpoints are on its network, else generic bus. No override
// for vague modes (train/walk/other) — those fall back to the AI heuristic. Nothing hardcoded.
function tcMapLockedMode(lg) {
  const m = String(lg.transportMode || '').toLowerCase(), p = String(lg.provider || '').toLowerCase();
  if (m === 'private_ride' || /michael|du ?lich ?cali|dulichcali|\bdlc\b/.test(p)) return 'dlc_ride';
  if (m === 'bus') return (/hoang|hoàng|xe ?đò|xe ?do/.test(p) || (tcHoangServiceCity(lg.fromCity) && tcHoangServiceCity(lg.toCity))) ? 'hoang_bus' : 'bus';
  if (m === 'flight') return 'flight';
  if (m === 'car') return 'personal_car';
  return '';
}
// Minimal, HONEST option for a user-locked mode the heuristic builder didn't already produce
// (e.g. a Hoàng leg outside the usual mileage band). No fabricated price/schedule — fare on
// request, real Hoàng links/phones, drive distance/time carried from the verified route leg.
function tcMinimalOption(mode, l) {
  const base = {
    mode, provider: '', status: l.source === 'google_maps' ? 'verified' : 'estimated',
    distanceText: l.distanceText || '', durationText: l.durationTrafficText || l.durationText || '',
    totalCostRange: '', perTravelerCost: '', perFamilyCost: '',
    luggageSuitability: 'good', childSuitability: 'good', seniorSuitability: 'good',
    prosKeys: [], consKeys: [], whyKey: 'tpwhy_' + mode, bookingLink: '', mapLink: l.mapLink || '',
    convenience: 4, confidence: 'medium', canBookViaDLC: mode === 'dlc_ride', affectsItinerary: true, source: l.source || 'estimated',
  };
  if (mode === 'hoang_bus') {
    base.provider = 'Xe Đò Hoàng'; base.wifiAvailable = true; base.website = 'https://xedohoang.com';
    base.phoneNumbers = ['714-839-3500', '408-729-7885', '888-834-9336']; base.bookingLink = 'https://xedohoang.com/en/plan-trip';
    base.bookingLinks = [{ labelKey: 'tpHoangBook', url: 'https://xedohoang.com/en/plan-trip' }, { labelKey: 'tpHoangGuide', url: 'https://xedohoang.com/en/ticket-booking-guide' }, { labelKey: 'tpHoangSite', url: 'https://xedohoang.com' }];
    base.prosKeys = ['tpro_vietnamese', 'tpro_nodriving', 'tpro_rest']; base.consKeys = ['tcon_schedule']; base.noteKeys = ['tpHoangStation']; base.confidence = 'low';
  } else if (mode === 'dlc_ride') {
    base.provider = 'Du Lich Cali'; base.prosKeys = ['tpro_private', 'tpro_door', 'tpro_kidssenior']; base.consKeys = ['tcon_highercost'];
  } else if (mode === 'bus') {
    base.provider = 'Greyhound / FlixBus'; base.prosKeys = ['tpro_nodriving']; base.consKeys = ['tcon_schedule']; base.confidence = 'low';
  } else if (mode === 'flight') {
    base.prosKeys = ['tpro_fastest']; base.consKeys = ['tcon_airporttime']; base.confidence = 'low';
  }
  return base;
}
function tcBuildTransportLegs(route, trip) {
  const fams = summarizeFamiliesForTrip(trip.families);
  const travelers = fams.reduce((s, f) => s + (f.travelers || 0), 0) || 1;
  const numFamilies = fams.length || 1;
  const kids = fams.reduce((s, f) => s + String(f.childrenAges || '').split(/[,\s]+/).filter((x) => { const n = parseInt(x, 10); return !isNaN(n) && n <= 12; }).length, 0);
  const seniors = fams.reduce((s, f) => s + (f.seniors || 0), 0);
  const lowBudget = String(trip.budget || '') === 'budget';
  const cars = Math.max(1, Math.ceil(travelers / 4));
  const nLegs = route.legs.length;
  return route.legs.map((l, i) => {
    const legType = i === 0 ? 'outbound' : (i === nLegs - 1 ? 'return' : 'inter');
    const miles = l.distanceMiles || 0;
    const driveMin = l.durationMin || 0;
    const verified = l.source === 'google_maps';
    const driveStatus = verified ? 'verified' : (l.source === 'unknown' ? 'unknown' : 'estimated');
    const fromShort = String(l.fromCity || '').split(',')[0];
    const toShort = String(l.toCity || '').split(',')[0];
    // Xe Đò Hoàng serviceable when BOTH endpoints are on its network (robust — not ", CA"-only).
    const inCA = tcHoangServiceCity(l.fromCity) && tcHoangServiceCity(l.toCity);
    const options = [];
    // Personal car (ALWAYS) — verified distance/time + labelled gas/parking/toll estimate.
    const gasLo = miles * 0.18 * cars * 0.85, gasHi = miles * 0.18 * cars * 1.2;
    options.push({
      mode: 'personal_car', provider: '', status: driveStatus,
      distanceText: l.distanceText || '', durationText: l.durationTrafficText || l.durationText || '',
      totalCostRange: miles ? (tcMoney(gasLo, gasHi) + ' (est.)') : '', perTravelerCost: '', perFamilyCost: '',
      gasEstimate: miles ? (tcMoney(gasLo, gasHi) + ' (est.)') : '', parkingEstimate: tcMoney(25, 40) + '/day (est.)', tollNoteKey: 'tpTollNote',
      luggageSuitability: 'good', childSuitability: 'good', seniorSuitability: 'good',
      prosKeys: ['tpro_door', 'tpro_flexible', 'tpro_luggage', 'tpro_costshare'],
      consKeys: miles > 360 ? ['tcon_longdrive', 'tcon_fatigue', 'tcon_parking'] : ['tcon_parking'],
      whyKey: 'tpwhy_personal_car',
      bookingLink: '', mapLink: l.mapLink || '', convenience: miles > 480 ? 3 : 4,
      confidence: verified ? 'high' : 'medium', canBookViaDLC: false,
      affectsItinerary: legType === 'outbound' || legType === 'return', source: l.source || 'estimated',
    });
    // Private Du Lich Cali ride (ALWAYS) — hands off to the existing ride flow; fare on request.
    options.push({
      mode: 'dlc_ride', provider: 'Du Lich Cali', status: driveStatus,
      distanceText: l.distanceText || '', durationText: l.durationTrafficText || l.durationText || '',
      totalCostRange: '', perTravelerCost: '', perFamilyCost: '',
      luggageSuitability: 'good', childSuitability: 'good', seniorSuitability: 'good',
      prosKeys: ['tpro_private', 'tpro_door', 'tpro_kidssenior', 'tpro_noparking'], consKeys: ['tcon_highercost'],
      whyKey: 'tpwhy_dlc_ride',
      bookingLink: '', mapLink: l.mapLink || '', convenience: (legType === 'outbound' || legType === 'return') ? 5 : 4,
      confidence: 'medium', canBookViaDLC: true, affectsItinerary: false, source: l.source || 'estimated',
    });
    // Flight (long legs only) — Google Flights + nearest-airport search; labelled estimate.
    if (miles >= 250 && driveMin >= 180) {
      const ppMid = Math.max(70, Math.min(450, 60 + miles * 0.18));
      const ppLo = ppMid * 0.7, ppHi = ppMid * 1.5, grpLo = ppLo * travelers, grpHi = ppHi * travelers;
      const flightMin = Math.round(miles / 8) + 165; // ~480 mph + ~2.5–3h door-to-door buffer
      const flightUrl = 'https://www.google.com/travel/flights?q=' + encodeURIComponent('flights from ' + l.fromCity + ' to ' + l.toCity);
      options.push({
        mode: 'flight', provider: '', status: 'estimated', distanceText: '', durationText: tcFmtDur(flightMin),
        totalCostRange: tcMoney(grpLo, grpHi) + ' (est.)', perTravelerCost: tcMoney(ppLo, ppHi) + '/person (est.)', perFamilyCost: tcMoney(grpLo / numFamilies, grpHi / numFamilies) + '/family (est.)',
        luggageSuitability: 'ok', childSuitability: 'ok', seniorSuitability: 'ok',
        prosKeys: ['tpro_fastest', 'tpro_lesstiring'], consKeys: ['tcon_airporttime', 'tcon_baggage', 'tcon_carthere', 'tcon_bookahead'],
        noteKeys: ['tpAirportBuffer', 'tpBaggageNote'], whyKey: 'tpwhy_flight',
        bookingLink: flightUrl,
        bookingLinks: [{ labelKey: 'tpFlightSearch', url: flightUrl }, { labelKey: 'tpAirportsNear', url: tcGsearch('major airports near ' + l.toCity) }],
        mapLink: '', convenience: kids > 0 ? 3 : 4, confidence: 'low', canBookViaDLC: false, affectsItinerary: true, source: 'ai_estimate',
      });
    }
    // Xe Đò Hoàng (Vietnamese intercity coach) — a KEY differentiator for our Vietnamese
    // families. Offered on California intercity corridors (the routes Hoàng actually runs:
    // Bay Area ↔ Little Saigon / OC / LA / SD, Sacramento ↔ Westminster). Real booking page,
    // booking guide and phone numbers from xedohoang.com — never a fabricated price/schedule.
    const hoangMin = Math.round(driveMin * 1.4) + 30;
    if (inCA && miles >= 80 && miles <= 800) {
      const hppMid = Math.max(35, Math.min(120, 18 + miles * 0.07));
      const hppLo = hppMid * 0.75, hppHi = hppMid * 1.4, hgrpLo = hppLo * travelers, hgrpHi = hppHi * travelers;
      options.push({
        mode: 'hoang_bus', provider: 'Xe Đò Hoàng', status: 'estimated', distanceText: '', durationText: tcFmtDur(hoangMin),
        totalCostRange: tcMoney(hgrpLo, hgrpHi) + ' (est.)', perTravelerCost: tcMoney(hppLo, hppHi) + '/person (est.)', perFamilyCost: tcMoney(hgrpLo / numFamilies, hgrpHi / numFamilies) + '/family (est.)',
        luggageSuitability: 'ok', childSuitability: 'ok', seniorSuitability: 'good', wifiAvailable: true,
        prosKeys: ['tpro_rest', 'tpro_wifi', 'tpro_nodriving', 'tpro_vietnamese', 'tpro_avoidtraffic'],
        consKeys: ['tcon_schedule', 'tcon_luggagelimit', 'tcon_slowerthancar'],
        // Past the OC/Little Saigon hub (long leg, e.g. → San Diego) → note the onward DLC ride/van connection.
        noteKeys: miles >= 420 ? ['tpHoangStation', 'tpHoangConnect'] : ['tpHoangStation'], whyKey: 'tpwhy_hoang_bus',
        website: 'https://xedohoang.com', phoneNumbers: ['714-839-3500', '408-729-7885', '888-834-9336'],
        bookingLink: 'https://xedohoang.com/en/plan-trip',
        bookingLinks: [
          { labelKey: 'tpHoangBook', url: 'https://xedohoang.com/en/plan-trip' },
          { labelKey: 'tpHoangGuide', url: 'https://xedohoang.com/en/ticket-booking-guide' },
          { labelKey: 'tpHoangSite', url: 'https://xedohoang.com' },
        ],
        mapLink: '', convenience: (seniors > 0 ? 4 : 3), confidence: 'low', canBookViaDLC: false, affectsItinerary: true, source: 'ai_estimate',
      });
    }
    // Generic intercity bus (Greyhound + FlixBus) — the mainstream alternatives.
    if (miles >= 25 && miles <= 700) {
      const bppMid = Math.max(15, Math.min(99, 9 + miles * 0.06));
      const bppLo = bppMid * 0.7, bppHi = bppMid * 1.6, bgrpLo = bppLo * travelers, bgrpHi = bppHi * travelers;
      const busMin = Math.round(driveMin * 1.45) + 30;
      const links = [
        { labelKey: 'tpBusGreyhound', url: tcGsearch('Greyhound bus ' + fromShort + ' to ' + toShort + ' tickets') },
        { labelKey: 'tpBusFlix', url: tcGsearch('FlixBus ' + fromShort + ' to ' + toShort + ' tickets') },
      ];
      options.push({
        mode: 'bus', provider: 'Greyhound / FlixBus', status: 'estimated', distanceText: '', durationText: tcFmtDur(busMin),
        totalCostRange: tcMoney(bgrpLo, bgrpHi) + ' (est.)', perTravelerCost: tcMoney(bppLo, bppHi) + '/person (est.)', perFamilyCost: tcMoney(bgrpLo / numFamilies, bgrpHi / numFamilies) + '/family (est.)',
        luggageSuitability: 'poor', childSuitability: 'ok', seniorSuitability: 'poor',
        prosKeys: ['tpro_cheapest', 'tpro_nodriving'], consKeys: ['tcon_slowest', 'tcon_schedule', 'tcon_luggagelimit'],
        noteKeys: ['tpBusStationNote'], whyKey: 'tpwhy_bus', bookingLink: links[0].url, bookingLinks: links,
        mapLink: '', convenience: 2, confidence: 'low', canBookViaDLC: false, affectsItinerary: true, source: 'ai_estimate',
      });
    }
    // Amtrak (regional rail) — offered on a regional distance band (operator/route RESEARCHED,
    // never a hardcoded line). Real Amtrak + Google search links, labelled estimate, NO fabricated
    // schedule/price. Scenic + low-stress, strong for seniors. Completes the multi-modal comparison.
    if (miles >= 40 && miles <= 700) {
      const tppMid = Math.max(20, Math.min(140, 14 + miles * 0.09));
      const tppLo = tppMid * 0.7, tppHi = tppMid * 1.5, tgrpLo = tppLo * travelers, tgrpHi = tppHi * travelers;
      const trainMin = Math.round(driveMin * 1.5) + 30;
      options.push({
        mode: 'train', provider: 'Amtrak', status: 'estimated', distanceText: '', durationText: tcFmtDur(trainMin),
        totalCostRange: tcMoney(tgrpLo, tgrpHi) + ' (est.)', perTravelerCost: tcMoney(tppLo, tppHi) + '/person (est.)', perFamilyCost: tcMoney(tgrpLo / numFamilies, tgrpHi / numFamilies) + '/family (est.)',
        luggageSuitability: 'good', childSuitability: 'good', seniorSuitability: 'good', wifiAvailable: true,
        prosKeys: ['tpro_scenic', 'tpro_nodriving', 'tpro_rest', 'tpro_wifi'], consKeys: ['tcon_schedule', 'tcon_stations', 'tcon_slowerthancar'],
        noteKeys: ['tpTrainStation'], whyKey: 'tpwhy_train',
        bookingLink: tcGsearch('Amtrak ' + fromShort + ' to ' + toShort + ' schedule tickets'),
        bookingLinks: [{ labelKey: 'tpTrainAmtrak', url: 'https://www.amtrak.com/home.html' }, { labelKey: 'tpTrainSearch', url: tcGsearch('Amtrak ' + fromShort + ' to ' + toShort + ' schedule tickets') }],
        mapLink: '', convenience: (seniors > 0 ? 4 : 3), confidence: 'low', canBookViaDLC: false, affectsItinerary: true, source: 'ai_estimate',
      });
    }
    // Recommendation (deterministic, group-aware). Hoàng wins for seniors / no-drive families
    // on a long California corridor (rest, Wi-Fi, no SoCal traffic); a small adults-only group
    // on a very long hop leans to flying; otherwise a big family group keeps the car.
    let recommendedMode = 'personal_car';
    const hasHoang = options.some((o) => o.mode === 'hoang_bus');
    if (hasHoang && miles >= 150 && travelers <= 9 && (seniors > 0 || (lowBudget && (seniors > 0 || kids > 0)))) recommendedMode = 'hoang_bus';
    else if (miles >= 450 && travelers <= 5 && kids === 0 && options.some((o) => o.mode === 'flight')) recommendedMode = 'flight';
    let recReasonKey = recommendedMode === 'hoang_bus' ? 'tprec_hoang' : (recommendedMode === 'flight' ? 'tprec_flight_long' : (miles < 150 ? 'tprec_car_short' : 'tprec_car_group'));
    // USER-LOCKED transport WINS — when the traveler explicitly chose this leg's mode/provider
    // ("by Bus Hoang", "Michael will take us"), it becomes the Recommended/Chosen option and the
    // AI heuristic above is overridden. Car/flight stay in `options` as alternatives (shown below),
    // but never as the primary, and a locked leg is NEVER overridden on cost. No fabricated data.
    const prio = l.userPriority || (l.userLocked ? 'required' : '');
    if (l.userMode && (prio === 'required' || prio === 'preferred' || l.userLocked)) {
      let opt = options.filter((o) => o.mode === l.userMode)[0];
      if (!opt) { opt = tcMinimalOption(l.userMode, l); options.push(opt); }
      if (opt) {
        if (l.userProvider) opt.provider = l.userProvider;
        const hard = (prio === 'required' || l.userLocked);
        opt.userChosen = true; opt.lockedByUser = hard;
        if (opt.confidence === 'low') opt.confidence = 'medium';
        opt.convenience = Math.max(opt.convenience || 4, 5);
        recommendedMode = l.userMode;
        recReasonKey = hard ? 'tprec_userlocked' : 'tprec_userpref';
      }
    } else if (prio === 'avoid' && l.userMode) {
      // The traveler asked to AVOID this mode — never recommend it; tag it + pick the best remaining.
      const av = options.filter((o) => o.mode === l.userMode)[0]; if (av) av.avoided = true;
      if (recommendedMode === l.userMode) {
        const alt = options.filter((o) => o.mode !== l.userMode).sort((a, b) => (b.convenience || 0) - (a.convenience || 0))[0];
        if (alt) { recommendedMode = alt.mode; recReasonKey = 'tprec_avoided'; }
      }
    }
    return {
      fromCity: l.fromCity, toCity: l.toCity, legType: legType,
      dayHint: miles >= 300 ? 'transit' : (miles >= 120 ? 'half' : 'activity'),
      driveDistanceText: l.distanceText || '', driveDurationText: l.durationTrafficText || l.durationText || '', driveSource: l.source || 'estimated', mapLink: l.mapLink || '',
      options: options, recommendedMode: recommendedMode, recommendationReason: '', recReasonKey: recReasonKey,
      userLocked: !!l.userLocked, userMode: l.userMode || '', userProvider: l.userProvider || '',
    };
  });
}
// Test-only hook (guarded): lets the offline smoke suite exercise the REAL deterministic
// transport builder + route helper without invoking the callable runtime. No prod effect.
if (process.env.TC_EXPORT_INTERNALS) { module.exports.tcBuildTransportLegs = tcBuildTransportLegs; module.exports.tcComputeRouteLegs = tcComputeRouteLegs; }
exports.researchTripTransport = onCall(
  { region: 'us-central1', secrets: [GOOGLE_MAPS_API_KEY], timeoutSeconds: 30, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const origin = String(trip.departureCity || '').trim();
    const destCities = (Array.isArray(trip.destinations) ? trip.destinations : [])
      .map((d) => String((d && d.city) || '').trim()).filter(Boolean);
    // USER-LOCKED LEGS (from the Natural-Language Journey Builder) take priority for the route
    // shape: they preserve the EXACT sequence the traveler described — including same-day
    // waypoints (e.g. San Jose →(bus)→ Orange County →(ride)→ San Diego) that the overnight-city
    // list collapses away. legMeta carries each leg's chosen mode/provider into the builder.
    const lockedLegs = (Array.isArray(trip.lockedLegs) ? trip.lockedLegs : [])
      .filter((lg) => lg && String(lg.fromCity || '').trim() && String(lg.toCity || '').trim()).slice(0, 12);
    let cities, legMeta = [];
    if (lockedLegs.length) {
      const chain = [];
      lockedLegs.forEach((lg) => {
        const from = String(lg.fromCity).trim(), to = String(lg.toCity).trim();
        if (!chain.length) chain.push(from);
        else if (chain[chain.length - 1].toLowerCase() !== from.toLowerCase()) chain.push(from);
        chain.push(to);
      });
      cities = chain.slice(0, 13);
      legMeta = lockedLegs.map((lg) => ({ userMode: tcMapLockedMode(lg), userProvider: lg.provider || '', userLocked: !!lg.lockedByUser, userPriority: lg.priority || (lg.lockedByUser ? 'required' : 'ai_decide') }));
    } else {
      if (!origin || !destCities.length) return { ok: false, debugCode: 'NO_ROUTE', legs: [] };
      // Build the major-leg path: origin -> dest1 -> ... -> destN -> origin, collapsing repeats.
      const path = [origin].concat(destCities);
      path.push(origin); // return home
      cities = path.filter((c, i) => i === 0 || c.toLowerCase() !== path[i - 1].toLowerCase()).slice(0, 12);
    }
    if (cities.length < 2) return { ok: false, debugCode: 'NO_ROUTE', legs: [] };
    // AUTHORITATIVE per-leg drive distance/time (Google Distance Matrix, or a labelled
    // haversine estimate when the key is absent) -- the SAME route code used elsewhere.
    const route = await tcComputeRouteLegs(cities, GOOGLE_MAPS_API_KEY.value());
    // Attach each leg's user-locked mode/provider (by order) so the builder honors it.
    route.legs.forEach((rl, i) => { if (legMeta[i]) { rl.userMode = legMeta[i].userMode; rl.userProvider = legMeta[i].userProvider; rl.userLocked = legMeta[i].userLocked; rl.userPriority = legMeta[i].userPriority; } });
    // Deterministic comparison -- ALWAYS returns car + (long->) flight + (intercity->) bus +
    // a private DLC ride per leg. No AI dependency, so the tab can never come up empty.
    const legs = tcBuildTransportLegs(route, trip);
    return { ok: true, legs, source: route.source, mapsSource: route.source, researchedAt: Date.now(), dataSource: 'estimated_pending_verification' };
  }
);
// ── Deal Hunter — grounded CURRENT-FARE research (the honest alternative to a paid fare API) ──
// Uses Google-Search grounding to research APPROXIMATE current one-way fares per leg/mode. Returns
// LOW–HIGH ranges with a source note + real search URLs, all "pending verification" — NEVER an
// invented exact price (null when no credible fare is found). This powers the Deal Hunter snapshot
// + the scheduled monitor; plug a paid flight-fare API into the SAME shape for authoritative prices.
function buildLegFaresPrompt(legs, lang) {
  const langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are a fare RESEARCH agent for a travel concierge. Using current web search, research the APPROXIMATE current one-way fare PER PERSON for each travel leg below, by mode: flight, intercity bus, and train (Amtrak).',
    'STRICT ANTI-FABRICATION: never invent a number. If you cannot find a credible current fare for a mode on a leg, return null for that mode and note "pending verification". Give a LOW–HIGH USD range reflecting typical current fares (not a fake exact price). Prefer well-known operators (e.g. Southwest/Alaska/United for flights; Greyhound/FlixBus for bus; Amtrak for train) and nearby major airports.',
    'LEGS: ' + JSON.stringify(legs.map((l) => ({ from: l.fromCity, to: l.toCity }))),
    'Return ONLY valid JSON (no markdown): { "sourceNote"(one short sentence), "legs":[ { "from","to","flight":{"low"(int|null),"high"(int|null),"note"(short),"url"(real search/booking URL)},"bus":{...same shape...},"train":{...same shape...} } ] }',
    'Write notes in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
// Shared grounded fare-research core (used by the callable AND the scheduled deal monitor).
// Returns { legs:[{from,to,flight,bus,train}], sourceNote } or null. Never fabricates a number.
async function tcResearchLegFares(legs, lang, geminiKey) {
  const text = await serverCallGeminiGrounded(buildLegFaresPrompt(legs, lang), geminiKey, 1500);
  let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
  if (s >= 0 && e > s) raw = raw.slice(s, e + 1);
  const parsed = tripSalvageJson(raw);
  if (!parsed) return null;
  const intOrNull = (x) => { const n = parseInt(x, 10); return (isFinite(n) && n > 0 && n < 20000) ? n : null; };
  const clampMode = (m) => { m = m || {}; return { low: intOrNull(m.low), high: intOrNull(m.high), note: String(m.note || '').slice(0, 120), url: /^https?:\/\//.test(String(m.url || '')) ? String(m.url).slice(0, 300) : '' }; };
  const outLegs = (Array.isArray(parsed.legs) ? parsed.legs : []).slice(0, 8).map((l) => ({ from: String((l && l.from) || '').slice(0, 80), to: String((l && l.to) || '').slice(0, 80), flight: clampMode(l && l.flight), bus: clampMode(l && l.bus), train: clampMode(l && l.train) }));
  return { legs: outLegs, sourceNote: String(parsed.sourceNote || '').slice(0, 160) };
}
exports.researchLegFares = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], timeoutSeconds: 60, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const legs = (Array.isArray(data.legs) ? data.legs : []).filter((l) => l && String(l.fromCity || '').trim() && String(l.toCity || '').trim()).slice(0, 8);
    if (!legs.length) return { ok: false, debugCode: 'NO_LEGS', legs: [] };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY', legs: [] };
    try {
      const text = await serverCallGeminiGrounded(buildLegFaresPrompt(legs, lang), geminiKey, 1500);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s >= 0 && e > s) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed) { console.error('[researchLegFares] unparseable, len=' + raw.length); return { ok: false, debugCode: 'FARES_ERROR', legs: [] }; }
      const intOrNull = (x) => { const n = parseInt(x, 10); return (isFinite(n) && n > 0 && n < 20000) ? n : null; };
      const clampMode = (m) => { m = m || {}; return { low: intOrNull(m.low), high: intOrNull(m.high), note: String(m.note || '').slice(0, 120), url: /^https?:\/\//.test(String(m.url || '')) ? String(m.url).slice(0, 300) : '' }; };
      const outLegs = (Array.isArray(parsed.legs) ? parsed.legs : []).slice(0, 8).map((l) => ({ from: String((l && l.from) || '').slice(0, 80), to: String((l && l.to) || '').slice(0, 80), flight: clampMode(l && l.flight), bus: clampMode(l && l.bus), train: clampMode(l && l.train) }));
      return { ok: true, legs: outLegs, sourceNote: String(parsed.sourceNote || '').slice(0, 160), researchedAt: Date.now(), dataSource: 'grounded_pending_verification' };
    } catch (e2) {
      console.error('[researchLegFares] failed', e2 && e2.message);
      return { ok: false, debugCode: 'FARES_ERROR', legs: [] };
    }
  }
);
// ── Deal Hunter — SCHEDULED background monitor (V3) ──────────────────────────
// Once a day, re-research fares for trips the owner is WATCHING (dealWatch==true) and, when a leg's
// cheapest researched fare drops below the stored snapshot, write a "better deal" alert onto the
// trip (surfaced in-app next time the owner opens it). NOTIFICATION ONLY — never changes a plan.
// HARD-CAPPED to a handful of trips/run to bound the recurring grounded-research cost; the owner
// disables it by turning Deal Watch off. Prices stay "pending verification" (grounded research, or a
// future fare API plugged into tcResearchLegFares) — never fabricated.
exports.monitorDealWatchTrips = onSchedule(
  { schedule: 'every 24 hours', region: 'us-central1', secrets: [GEMINI_API_KEY, VAPID_PRIVATE_KEY], timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const MAX_TRIPS = 10;
    let geminiKey = null; try { geminiKey = await getAiKey('gemini'); } catch (e) {}
    if (!geminiKey) { console.warn('[monitorDealWatchTrips] no gemini key — skip'); return; }
    // Web Push (reuses the shared VAPID stack) — used to notify the trip owner's device(s).
    let webpush = null; try { webpush = require('web-push'); } catch (e) {}
    const vapidPriv = VAPID_PRIVATE_KEY.value();
    if (webpush && vapidPriv) { try { webpush.setVapidDetails('mailto:dulichcali21@gmail.com', VAPID_PUBLIC_KEY, vapidPriv); } catch (e) { webpush = null; } } else { webpush = null; }
    let snap;
    try { snap = await db.collection('groupTrips').where('dealWatch', '==', true).limit(MAX_TRIPS).get(); } catch (e) { console.error('[monitorDealWatchTrips] query failed', e && e.message); return; }
    for (const docSnap of snap.docs) {
      try {
        const trip = docSnap.data() || {};
        const lang = (trip.lang === 'vi' || trip.lang === 'es') ? trip.lang : 'en';
        let legs = (Array.isArray(trip.lockedLegs) ? trip.lockedLegs : []).filter((l) => l && l.fromCity && l.toCity).map((l) => ({ fromCity: l.fromCity, toCity: l.toCity }));
        if (!legs.length) legs = (Array.isArray(trip.transport) ? trip.transport : []).filter((l) => l && l.fromCity && l.toCity).map((l) => ({ fromCity: l.fromCity, toCity: l.toCity }));
        legs = legs.slice(0, 6);
        if (!legs.length) continue;
        const r = await tcResearchLegFares(legs, lang, geminiKey);
        if (!r || !r.legs.length) continue;
        const snapshot = Object.assign({}, trip.dealSnapshot || {});
        const newAlerts = [];
        r.legs.forEach((lf) => {
          let best = null;
          ['flight', 'bus', 'train'].forEach((mk) => { const f = lf[mk]; if (f && f.low && (!best || f.low < best.cost)) best = { cost: f.low, mode: mk }; });
          if (!best) return;
          const key = 'fare:' + (lf.from || '') + '>' + (lf.to || '');
          const prev = snapshot[key];
          if (prev && prev.cost && best.cost < prev.cost - 1) newAlerts.push({ route: (lf.from || '').split(',')[0] + '→' + (lf.to || '').split(',')[0], oldCost: prev.cost, newCost: best.cost, mode: best.mode, ts: Date.now() });
          snapshot[key] = { cost: best.cost, mode: best.mode, ts: Date.now() };
        });
        const existing = Array.isArray(trip.dealAlerts) ? trip.dealAlerts : [];
        const update = { dealSnapshot: snapshot, dealCheckedAt: Date.now() };
        if (newAlerts.length) update.dealAlerts = existing.concat(newAlerts).slice(-10);
        await docSnap.ref.set(update, { merge: true });
        // Web Push the trip's opted-in device(s) when a better deal appeared. Notification only —
        // the itinerary is never changed. Dead subscriptions (404/410) are pruned.
        if (newAlerts.length && webpush) {
          try {
            const subsSnap = await docSnap.ref.collection('pushSubscriptions').get();
            if (!subsSnap.empty) {
              const a0 = newAlerts[0];
              const payload = JSON.stringify({
                title: 'Better deal found',
                body: a0.route + ': $' + a0.oldCost + ' → $' + a0.newCost + (newAlerts.length > 1 ? (' (+' + (newAlerts.length - 1) + ' more)') : ''),
                url: '/travel-concierge?trip=' + docSnap.id,
                tag: 'dlc-deal-' + docSnap.id,
                badgeCount: (update.dealAlerts || newAlerts).length,
              });
              await Promise.all(subsSnap.docs.map(async (sd) => {
                const s = sd.data() || {};
                if (!s.endpoint || !s.keys) return;
                try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 3600 }); }
                catch (err) { const code = err && err.statusCode; if (code === 404 || code === 410) await sd.ref.delete().catch(() => {}); }
              }));
            }
          } catch (e) { console.warn('[monitorDealWatchTrips] push failed', docSnap.id, e && e.message); }
        }
      } catch (e) { console.error('[monitorDealWatchTrips] trip failed', docSnap.id, e && e.message); }
    }
    console.log('[monitorDealWatchTrips] checked ' + snap.docs.length + ' watched trip(s)');
  }
);
// ── AI Transport STRATEGY + TRANSFER Intelligence (V3) ───────────────────────
// Research-driven, NO hardcoded schedules/routes/hubs. Given the trip + the AUTHORITATIVE
// drive legs (Google or labelled estimate — the AI never invents drive times), it: researches
// the real operators for the preferred mode + alternatives (official site, pickup/dropoff areas,
// schedule WINDOW + price RANGE — all "pending verification" with a real link), INFERS transfer
// hubs from geography + operator networks, GENERATES multiple multi-leg strategies (same-day
// transfer / explore-the-hub / overnight-at-hub / vs flight / vs private car·DLC ride), reasons
// about RETURN logistics (early-departure risk, overnight, leave-a-day-earlier, fly home), and
// EXPLAINS every recommendation. Generalizes to ANY destination (Vegas, Yosemite, Seattle, NY…).
// Never fabricates prices/schedules/availability. The deterministic tcBuildTransportLegs stays as
// the always-on verified backbone + fallback when research yields nothing.
function buildTransportStrategiesPrompt(lang) {
  const langName = lang === 'vi' ? 'Vietnamese' : (lang === 'es' ? 'Spanish' : 'English');
  return [
    'You are an AI TRAVEL OPERATIONS agent for Du Lich Cali — a real travel operator that ALSO runs private rides/transfers. Plan how a GROUP physically gets from its origin through each destination and home, using current web knowledge. You RESEARCH and REASON; you NEVER fabricate exact schedules, prices, seat availability, or confirmations.',
    'INPUT gives: origin, destinations (in order — each may carry its OWN preferred mode + preferred provider for the leg INTO it, plus the user\'s notes), a returnPreference/returnProvider for the leg home, dates, the group profile (families/kids/teens/seniors/luggage), an overall transport PREFERENCE, and verifiedLegs[] = the AUTHORITATIVE per-leg DRIVE distance/time (from Google Maps or a labelled estimate). USE verifiedLegs drive times as ground truth for car/private-ride legs — NEVER invent or contradict them; only the non-drive modes (bus/flight/train) get a clearly-labelled estimate.',
    'HONOR THE USER\'S PER-LEG CHOICES — you are an optimizer, NOT a dictator: when a destination specifies its own preferred mode and/or a named preferred provider for the leg into it (e.g. arrive by bus on a named community operator, or by a private ride), plan THAT leg with THAT mode/provider — research its real operator, dropoff, schedule window and the transfer/buffer it implies; do NOT substitute a different mode for a leg the user pinned. Likewise honor the returnPreference/returnProvider for the leg home. Only legs the user left as "any"/blank are yours to recommend freely. NEVER reorder the destinations or change the requested dates — optimize ONLY within those constraints (transfers, buffers, hub stops, timing, cost).',
    'DO THE HOMEWORK — research, do not assume: (1) For the PREFERRED mode and the realistic ALTERNATIVES (personal car, flight, the relevant intercity bus operators e.g. the Vietnamese-community operator Xe Do Hoang where it serves the route, Greyhound, FlixBus, a Du Lich Cali private ride/transfer, and train/shuttle when they exist), identify the REAL operator, its official website AND phone, the general pickup & dropoff AREAS (the actual STATIONS), the rough schedule WINDOW and price RANGE — every schedule/price marked "pending verification" with the official site to confirm.',
    'TRANSFER DETECTION — this is critical, REASON it through, do NOT assume direct service: a bus or flight drops the group at a STATION / depot / airport, NEVER at their hotel — so a last-mile transfer to the hotel ALWAYS exists. MOREOVER many intercity/community bus lines do NOT reach the final destination city at all — their nearest stop is an intermediate METRO. RESEARCH the operator\'s real dropoff for THIS route and COMPARE it to the final destination: if the nearest dropoff is a different city/area than the destination, that dropoff city is a TRANSFER HUB and the leg from the hub to the destination hotel must be completed by another mode (typically a Du Lich Cali / private van/ride, dlcFit=true). Example of the KIND of reasoning (illustrative, NOT a hardcoded rule — apply the same logic to any operator/route): a Vietnamese-community bus from the Bay Area commonly terminates around the Orange County / Westminster / Garden Grove (Little Saigon) area, so reaching a San Diego hotel needs a transfer from that hub onward. Decide every hub from researched dropoff data + geography, never from a fixed city table.',
    'HUB EXPERIENCE: when a transfer hub has time to spare or cultural relevance (e.g. dropping in a Vietnamese community hub), suggest a few hours there — REAL local Vietnamese food / coffee / bakery / quick attractions that fit the group — before the onward transfer. Only when timing genuinely allows.',
    'COMPARE every strategy on these dimensions explicitly in pros/cons + why: COST, TIME, COMFORT, RISK OF MISSING THE BUS/FLIGHT, family/kid/senior convenience, and HOTEL IMPACT (e.g. losing a night at the destination if you overnight at the hub).',
    'GENERATE 3-5 distinct STRATEGIES that a smart local would compare, e.g.: A) preferred mode + same-day transfer to the final destination; B) preferred mode, then spend several hours enjoying the transfer hub (real local food/coffee/bakery/attractions that fit the group) before continuing; C) overnight at the hub (or leave a day earlier) to de-risk an early departure; D) the fast/comfortable alternative (flight or private ride) and E) personal car with route stopovers — include only the strategies that actually make sense for THIS route and group. For each strategy give: ordered legs (from→to, mode, short note, and dlcFit=true on any leg a Du Lich Cali ride/transfer naturally serves), any overnightAt city, pros, cons, who it is bestFor (kids/seniors/luggage/budget/speed/comfort), a timingRisk (low/medium/high with the reason), and a one-sentence WHY tying it to the group + schedule + risk. Mark exactly one strategy recommended=true.',
    'RETURN INTELLIGENCE: research the operator\'s RETURN schedule and analyse the trip home. If the return bus only departs EARLY (from the hub, far from the destination hotel), the group cannot make it from a destination hotel in time — so present the real options: Option A) overnight at the transfer hub the night BEFORE the return bus; Option B) a very early Du Lich Cali / private ride from the destination to the hub to catch the bus; Option C) skip the bus home and compare a flight or private ride instead. Set earlyDepartureRisk (low/medium/high), overnightRecommended, leaveDayEarlier, a flyHome option, and explain WHY referencing the group (kids, luggage, early departure, traffic, hotel impact).',
    'OUTPUT ONLY valid JSON (no markdown). Put the most important keys FIRST so nothing critical is lost if output is long: { "preference":"<echo the preference or \'any\'>", "connectionPlan":{ "provider"(the main researched operator for the preference, or ""),"origin","providerDropoff"(the operator\'s real nearest dropoff station/area for this route),"finalDestination","transferNeeded"(bool — true whenever the dropoff is not the destination hotel/area),"transferHub"(the hub city when a transfer is needed, else ""),"transferOptions":[ { "mode"(dlc_ride|shuttle|rental_car|taxi|train|personal_car),"from","to","note","dlcFit"(bool) } ],"hubStopSuggested"(bool),"hubStopIdeas":[ short real food/coffee/bakery/attraction ideas at the hub ],"overnightBeforeReturnRecommended"(bool),"returnOptions":[ { "label"(A|B|C),"text"(one phrase) } ],"scheduleRisk"(low|medium|high — reason),"whyRecommended"(one sentence),"officialUrl"(REAL site or search URL),"officialPhone"(only if known, else ""),"verificationStatus":"pending_verification" }, "strategies":[ { "id"(A|B|C|D|E),"name"(short),"summary"(one sentence),"legs":[ { "from","to","mode","note","dlcFit"(bool) } ],"overnightAt"(city or ""),"totalTimeNote","pros":[short],"cons":[short],"bestFor","timingRisk"(low|medium|high — reason),"why"(one sentence),"recommended"(bool) } ], "returnIntelligence":{ "earlyDepartureRisk"(low|medium|high),"overnightRecommended"(bool),"leaveDayEarlier"(bool),"flyHomeOption"(one phrase),"explanation"(one-two sentences) }, "transferHubs":[ { "hub","connects"(A→B),"why"(one phrase) } ], "modes":[ { "mode"(personal_car|flight|hoang_bus|greyhound|flixbus|dlc_ride|train|shuttle),"operator","officialUrl"(REAL official site or a Google search URL — never invented),"routeSummary"(one phrase),"pickupAreas":[short],"dropoffAreas":[short],"scheduleNote"("pending verification — what to check"),"priceNote"("pending verification" or a rough "$X–$Y (est.)"),"travelTimeNote"(use the verified drive time when given, else "~Nh (est.)"),"constraints"(one phrase: luggage/kids/seniors/timing),"bestFor"(one phrase),"source":"ai_researched_pending_verification" } ] }',
    'Keep it COMPACT (2-4 strategies, ≤6 modes, short phrases) so the whole JSON object is returned complete — never truncate mid-object.',
    'HARD RULES: NO fabricated schedules/prices/availability/confirmations — use "pending verification" + the official link. Use REAL operator + place names; if unsure of a detail, say so and link the official source. Use the verifiedLegs drive times verbatim for car/ride legs. NO hardcoded city→hub or mode→behavior rules — derive everything from the route, operator networks and the group. The SAME reasoning must work for any destination. Write ALL human-readable text in ' + langName + '. Output ONE compact valid JSON object only.',
  ].join('\n');
}
exports.researchTransportStrategies = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY, GOOGLE_MAPS_API_KEY], timeoutSeconds: 100, memory: '256MiB', cors: true },
  async (request) => {
    const data = request.data || {};
    const trip = data.trip || {};
    const lang = (data.lang === 'vi' || data.lang === 'es') ? data.lang : 'en';
    const origin = String(trip.departureCity || '').trim();
    const destCities = (Array.isArray(trip.destinations) ? trip.destinations : []).map((d) => String((d && d.city) || '').trim()).filter(Boolean);
    if (!origin || !destCities.length) return { ok: false, debugCode: 'NO_ROUTE' };
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY' };
    // AUTHORITATIVE drive legs (origin → dests → home) — same route core as researchTripTransport.
    const path = [origin].concat(destCities); path.push(origin);
    const cities = path.filter((c, i) => i === 0 || c.toLowerCase() !== path[i - 1].toLowerCase());
    let route = { legs: [], source: 'estimated' };
    try { route = await tcComputeRouteLegs(cities.slice(0, 12), GOOGLE_MAPS_API_KEY.value()); } catch (e) { /* estimate fallback below */ }
    const verifiedLegs = (route.legs || []).map((l) => ({ from: l.fromCity || l.from || '', to: l.toCity || l.to || '', driveTime: l.durationText || l.durationTrafficText || '', driveDistance: l.distanceText || '', source: route.source }));
    const pref = String(data.transportPreference || trip.transportPreference || 'any').slice(0, 40);
    // Per-segment user choices (Step C): each destination's preferred mode/provider for the leg
    // INTO it, plus any note — so the agent honors them instead of choosing freely.
    const segPrefs = (Array.isArray(trip.destinations) ? trip.destinations : []).slice(0, 8).map((d) => ({
      city: String((d && d.city) || '').trim(),
      transportPreference: String((d && d.transportPreference) || 'any').slice(0, 30),
      preferredProvider: String((d && d.preferredProvider) || '').slice(0, 60),
      note: String((d && d.notes) || '').slice(0, 140),
    })).filter((d) => d.city);
    const userContent = 'Plan transport strategies. Input JSON:\n' + JSON.stringify({
      origin, destinations: segPrefs, dateRange: trip.dateRange, transportPreference: pref,
      returnPreference: String(trip.returnTransportPreference || 'any').slice(0, 30), returnProvider: String(trip.returnProvider || '').slice(0, 60),
      verifiedLegs, driveSource: route.source,
      groupProfile: tcGroupProfile(trip.families, trip.budget, trip.tripStyle), familiesSummary: summarizeFamiliesForTrip(trip.families),
      budget: trip.budget, pace: trip.tripStyle,
    });
    async function attemptStrategies() {
    try {
      const text = await serverCallGeminiGrounded(buildTransportStrategiesPrompt(lang) + '\n\n' + userContent, geminiKey, 6500);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').replace(/[\u0000-\u001F]+/g, ' ');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || typeof parsed !== 'object') { console.error('[researchTransportStrategies] unparseable, len=' + raw.length); return { ok: false, debugCode: 'RESEARCH_ERROR' }; }
      const MODES = ['personal_car', 'flight', 'hoang_bus', 'greyhound', 'flixbus', 'dlc_ride', 'train', 'shuttle'];
      const clampStr = (x, n) => String(x == null ? '' : x).slice(0, n);
      const clampArr = (a, n, len) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => clampStr(x, len)).filter(Boolean);
      const modes = (Array.isArray(parsed.modes) ? parsed.modes : []).slice(0, 10).map((m) => {
        m = m || {};
        return {
          mode: MODES.indexOf(String(m.mode)) >= 0 ? m.mode : 'shuttle', operator: clampStr(m.operator, 60), officialUrl: /^https?:\/\//i.test(String(m.officialUrl || '')) ? clampStr(m.officialUrl, 200) : '',
          routeSummary: clampStr(m.routeSummary, 120), pickupAreas: clampArr(m.pickupAreas, 4, 50), dropoffAreas: clampArr(m.dropoffAreas, 4, 50),
          scheduleNote: clampStr(m.scheduleNote || 'pending verification', 120), priceNote: clampStr(m.priceNote || 'pending verification', 60),
          travelTimeNote: clampStr(m.travelTimeNote, 40), constraints: clampStr(m.constraints, 100), bestFor: clampStr(m.bestFor, 60),
          source: 'ai_researched_pending_verification',
        };
      }).filter((m) => m.operator || m.routeSummary);
      const transferHubs = (Array.isArray(parsed.transferHubs) ? parsed.transferHubs : []).slice(0, 5).map((h) => ({ hub: clampStr((h || {}).hub, 80), connects: clampStr((h || {}).connects, 80), why: clampStr((h || {}).why, 160) })).filter((h) => h.hub);
      let recSeen = false;
      const strategies = (Array.isArray(parsed.strategies) ? parsed.strategies : []).slice(0, 6).map((st, i) => {
        st = st || {};
        const rec = !recSeen && st.recommended === true; if (rec) recSeen = true;
        return {
          id: clampStr(st.id || String.fromCharCode(65 + i), 2), name: clampStr(st.name, 80), summary: clampStr(st.summary, 200),
          legs: (Array.isArray(st.legs) ? st.legs : []).slice(0, 8).map((lg) => ({ from: clampStr((lg || {}).from, 60), to: clampStr((lg || {}).to, 60), mode: MODES.indexOf(String((lg || {}).mode)) >= 0 ? lg.mode : clampStr((lg || {}).mode, 24), note: clampStr((lg || {}).note, 120), dlcFit: (lg || {}).dlcFit === true })).filter((lg) => lg.from || lg.to),
          overnightAt: clampStr(st.overnightAt, 80), totalTimeNote: clampStr(st.totalTimeNote, 40),
          pros: clampArr(st.pros, 5, 80), cons: clampArr(st.cons, 5, 80), bestFor: clampStr(st.bestFor, 60),
          timingRisk: clampStr(st.timingRisk, 120), why: clampStr(st.why, 240), recommended: rec,
        };
      }).filter((st) => st.name || st.legs.length);
      const ri = parsed.returnIntelligence || {};
      const returnIntelligence = {
        earlyDepartureRisk: (['low', 'medium', 'high'].indexOf(String(ri.earlyDepartureRisk)) >= 0 ? ri.earlyDepartureRisk : ''),
        overnightRecommended: ri.overnightRecommended === true, leaveDayEarlier: ri.leaveDayEarlier === true,
        flyHomeOption: clampStr(ri.flyHomeOption, 120), explanation: clampStr(ri.explanation, 280),
      };
      // TransportConnectionPlan — the focused per-provider transfer analysis (dropoff vs final).
      const cpRaw = parsed.connectionPlan || {};
      const XMODES = ['dlc_ride', 'shuttle', 'rental_car', 'taxi', 'train', 'personal_car'];
      const connectionPlan = (cpRaw.provider || cpRaw.providerDropoff || cpRaw.transferNeeded != null) ? {
        provider: clampStr(cpRaw.provider, 60), origin: clampStr(cpRaw.origin, 60), providerDropoff: clampStr(cpRaw.providerDropoff, 80),
        finalDestination: clampStr(cpRaw.finalDestination, 80), transferNeeded: cpRaw.transferNeeded === true, transferHub: clampStr(cpRaw.transferHub, 80),
        transferOptions: (Array.isArray(cpRaw.transferOptions) ? cpRaw.transferOptions : []).slice(0, 5).map((o) => ({ mode: XMODES.indexOf(String((o || {}).mode)) >= 0 ? o.mode : clampStr((o || {}).mode, 24), from: clampStr((o || {}).from, 60), to: clampStr((o || {}).to, 60), note: clampStr((o || {}).note, 120), dlcFit: (o || {}).dlcFit === true })).filter((o) => o.from || o.to || o.mode),
        hubStopSuggested: cpRaw.hubStopSuggested === true, hubStopIdeas: clampArr(cpRaw.hubStopIdeas, 5, 70),
        overnightBeforeReturnRecommended: cpRaw.overnightBeforeReturnRecommended === true,
        returnOptions: (Array.isArray(cpRaw.returnOptions) ? cpRaw.returnOptions : []).slice(0, 4).map((o) => ({ label: clampStr((o || {}).label, 2), text: clampStr((o || {}).text, 160) })).filter((o) => o.text),
        scheduleRisk: clampStr(cpRaw.scheduleRisk, 120), whyRecommended: clampStr(cpRaw.whyRecommended, 240),
        officialUrl: /^https?:\/\//i.test(String(cpRaw.officialUrl || '')) ? clampStr(cpRaw.officialUrl, 200) : '',
        officialPhone: clampStr(cpRaw.officialPhone, 40), verificationStatus: 'pending_verification',
      } : null;
      // Strategies are the core deliverable — if they're missing (e.g. a truncated/partial
      // grounding response), signal failure so the client's callWithRetry self-heals.
      if (!strategies.length) return { ok: false, debugCode: 'RESEARCH_ERROR', modes: modes, transferHubs: transferHubs };
      return { ok: true, preference: clampStr(parsed.preference || pref, 40), connectionPlan, modes, transferHubs, strategies, returnIntelligence, driveSource: route.source, dataSource: 'ai_researched_pending_verification' };
    } catch (e2) {
      console.error('[researchTransportStrategies] failed', e2 && e2.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR' };
    }
    }
    // Single server-side retry: a transient grounding miss (unparseable / empty strategies /
    // thrown error) self-heals here so even non-client callers get a complete plan. The route
    // legs above are computed ONCE — only the AI generate+parse is retried.
    let result = await attemptStrategies();
    if (!result || !result.ok) { const retry = await attemptStrategies(); if (retry && retry.ok) result = retry; }
    return result;
  }
);
// ── placePhotos (PlacePhotoProvider) ─────────────────────────────────────────
// REAL place/food photos via Google Places — reuses the SAME GOOGLE_MAPS_API_KEY as the
// ride subsystem. Resolves the exact place (Find Place from name+address) → its photo
// references → the keyless googleusercontent CDN URL (the Places Photo endpoint
// 302-redirects there, so the API key is NEVER exposed to the client). Returns real
// photos + attribution, or ok:false (NO_MAPS_KEY / no photos) so the client shows
// "No verified photo available" + links. NEVER returns an AI/generic image.
exports.placePhotos = onCall(
  { region: 'us-central1', secrets: [GOOGLE_MAPS_API_KEY], timeoutSeconds: 20, memory: '256MiB', cors: true },
  async (request) => {
    const d = request.data || {};
    const name = String(d.name || '').trim();
    const address = String(d.address || '').trim();
    if (!name) return { ok: false, debugCode: 'NO_PLACE', photos: [] };
    const key = GOOGLE_MAPS_API_KEY.value();
    if (!key || String(key).trim().length < 20) return { ok: false, debugCode: 'NO_MAPS_KEY', photos: [] };
    const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();
    try {
      const q = encodeURIComponent((name + ' ' + address).trim());
      const fp = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=place_id,photos,name&key=${key}`).then((r) => r.json());
      const cand = fp && fp.candidates && fp.candidates[0];
      if (!cand || !Array.isArray(cand.photos) || !cand.photos.length) return { ok: true, placeId: (cand && cand.place_id) || '', photos: [], source: 'google_places' };
      const refs = cand.photos.slice(0, 3);
      const photos = [];
      for (const ph of refs) {
        try {
          // The Photo endpoint 302-redirects to a keyless lh3.googleusercontent.com URL.
          const resp = await fetch(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(ph.photo_reference)}&key=${key}`, { redirect: 'manual' });
          const loc = resp.headers.get('location');
          if (loc && /^https?:\/\//.test(loc) && loc.indexOf('key=') === -1) {
            photos.push({ url: loc, attribution: stripTags((ph.html_attributions || [])[0]).slice(0, 120), width: ph.width || 0, height: ph.height || 0 });
          }
        } catch (e) { /* skip this photo */ }
      }
      return { ok: true, placeId: cand.place_id || '', photos, source: 'google_places' };
    } catch (e) {
      console.error('[placePhotos] failed', e && e.message);
      return { ok: false, debugCode: 'ERROR', photos: [] };
    }
  }
);

// ── aiTtsProxy ─────────────────────────────────────────────────────────────────
// Callable function: server-side TTS proxy so the client never needs a Gemini
// API key. Reuses the existing GEMINI_API_KEY Functions secret (the "latest
// and valid key"). Returns audio as base64.
//
// Input:  { provider: 'gemini', text, voice?, language? }
// Output: { ok: true,  provider, audioBase64, mimeType, model, voice }
//      |  { ok: false, error,    debugCode,   detail?  }
//
// Authless (anonymous customers must be able to hear Vietnamese voice). Input
// text is capped at TTS_MAX_TEXT to keep abuse bounded. Cloud Function CORS
// already restricts callers to the project's app domain.
const TTS_MAX_TEXT = 2000;
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

async function serverCallGeminiTts(text, voice, geminiKey) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              GEMINI_TTS_MODEL + ':generateContent?key=' + encodeURIComponent(geminiKey);
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Aoede' } }
        }
      }
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error('gemini-tts HTTP ' + resp.status + ' ' + errText.slice(0, 200));
  }
  const data = await resp.json();
  const part = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
               data.candidates[0].content.parts && data.candidates[0].content.parts[0];
  if (!part || !part.inlineData || !part.inlineData.data) {
    // Diagnostic: dump a redacted summary of what came back so we can see the actual
    // response shape. Only the first 600 chars of the JSON to keep logs bounded.
    let preview = '';
    try {
      preview = JSON.stringify(data, function(k, v) {
        // strip anything that looks like audio bytes
        if (typeof v === 'string' && v.length > 80) return '<' + v.length + ' chars>';
        return v;
      }).slice(0, 600);
    } catch (_) {}
    throw new Error('gemini-tts no audio in response | shape=' + preview);
  }
  return {
    audioBase64: part.inlineData.data,
    mimeType: part.inlineData.mimeType || 'audio/L16;rate=24000'
  };
}

const OPENAI_TTS_MODEL = 'tts-1';
const OPENAI_TTS_DEFAULT_VOICE = 'nova';

async function serverCallOpenAiTts(text, voice, openaiKey) {
  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + openaiKey,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({
      model:           OPENAI_TTS_MODEL,
      input:           text,
      voice:           voice || OPENAI_TTS_DEFAULT_VOICE,
      response_format: 'mp3'
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error('openai-tts HTTP ' + resp.status + ' ' + errText.slice(0, 200));
  }
  const arrayBuffer = await resp.arrayBuffer();
  const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
  return {
    audioBase64,
    mimeType: 'audio/mpeg'
  };
}

exports.aiTtsProxy = onCall(
  {
    region:         'us-central1',
    secrets:        [GEMINI_API_KEY, OPENAI_API_KEY],
    timeoutSeconds: 30,
    cors:           true,
  },
  async (request) => {
    const { provider, text, voice, language } = request.data || {};
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, error: 'Missing text', debugCode: 'INVALID_REQUEST' };
    }
    const safeText = text.slice(0, TTS_MAX_TEXT);

    if (provider === 'gemini') {
      const safeVoice = (typeof voice === 'string' && voice.length <= 64) ? voice : 'Aoede';
      const geminiKey = await getAiKey('gemini');
      if (!geminiKey) {
        return { ok: false, error: 'Gemini key not configured', debugCode: 'NO_GEMINI_KEY' };
      }
      try {
        const result = await serverCallGeminiTts(safeText, safeVoice, geminiKey);
        console.info('[aiTtsProxy] gemini ok', {
          language: language || '',
          voice:    safeVoice,
          textLen:  safeText.length,
          audioB64Len: result.audioBase64.length
        });
        return {
          ok:          true,
          provider:    'gemini',
          model:       GEMINI_TTS_MODEL,
          voice:       safeVoice,
          audioBase64: result.audioBase64,
          mimeType:    result.mimeType
        };
      } catch (err) {
        console.error('[aiTtsProxy] gemini error:', err && err.message);
        return {
          ok:        false,
          error:     'TTS provider error',
          debugCode: 'PROVIDER_ERROR',
          detail:    (err && err.message || '').slice(0, 200)
        };
      }
    }

    if (provider === 'openai') {
      const safeVoice = (typeof voice === 'string' && voice.length <= 64) ? voice : OPENAI_TTS_DEFAULT_VOICE;
      const openaiKey = await getAiKey('openai');
      if (!openaiKey) {
        return { ok: false, error: 'OpenAI key not configured', debugCode: 'NO_OPENAI_KEY' };
      }
      try {
        const result = await serverCallOpenAiTts(safeText, safeVoice, openaiKey);
        console.info('[aiTtsProxy] openai ok', {
          language: language || '',
          voice:    safeVoice,
          textLen:  safeText.length,
          audioB64Len: result.audioBase64.length
        });
        return {
          ok:          true,
          provider:    'openai',
          model:       OPENAI_TTS_MODEL,
          voice:       safeVoice,
          audioBase64: result.audioBase64,
          mimeType:    result.mimeType
        };
      } catch (err) {
        console.error('[aiTtsProxy] openai error:', err && err.message);
        return {
          ok:        false,
          error:     'TTS provider error',
          debugCode: 'PROVIDER_ERROR',
          detail:    (err && err.message || '').slice(0, 200)
        };
      }
    }

    return { ok: false, error: 'Unsupported provider', debugCode: 'UNSUPPORTED' };
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

// ── Mobile Barber: REAL AI haircut preview (image-to-image, identity preserved)
//
// Supports MEN, WOMEN, and CHILDREN plus optional style preferences
// (haircut / hair color / highlights / curly / straight + a vibe).
//
// Two stages:
//   STAGE 1 — Gemini 2.5 Flash (vision) analyses the selfie (face shape,
//             jawline, forehead, hair length/texture, age category,
//             masc/fem/neutral presentation, skin tone) honoring the
//             customer's audience + explore + preference choices, and returns
//             EXACTLY 5 face-matched, audience-correct styles. Customer-facing
//             text comes back in the customer's language; the per-style
//             image-edit prompt comes back in English (and is identity-locked).
//   STAGE 2 — Gemini 2.5 Flash Image (Nano Banana) renders one image-to-image
//             preview per style from the SAME selfie, preserving the same
//             person/face/ethnicity/skin tone/age.
//
// No silent degradation of IMAGES: previews are always generated from the
// customer's own selfie — never a static catalog photo. If the analysis model
// hiccups we fall back to a deterministic, AUDIENCE-CORRECT prompt scaffold
// (still image-to-image from the real selfie) so 5 options are always offered
// and women/children never get a male-only fallback. If the GEMINI_API_KEY is
// missing or every image generation fails, the Function returns
// { ok:false, vendorMessage, debugCode } and the client shows an explicit
// "AI preview unavailable" message.
//
// Cost: ~$0.039/image × 5 + 1 vision call ≈ ~$0.20 per booking that uses it.
// Latency: 1 analysis call (~3-6s) then 5 parallel image calls (~8-20s).
//
// Endpoint contract:
//   Input:  { selfieDataUrl, lang: 'en'|'vi'|'es',
//             audience: 'man'|'woman'|'child'|'neutral',
//             explore: ['haircut','color','highlights','curly','straight'],
//             preference: 'professional'|'trendy'|'low_maintenance'|'natural'|'bold'|'' }
//   Output: { ok: true, analysis, audience, recommendations: [ {
//               styleId, title, targetAudience, explanation, whyItFitsFace,
//               maintenance, barberNotes, colorRecommendation,
//               highlightRecommendation, curlStraightRecommendation,
//               confidence, safetyNotes, previewKind, previewDataUrl } x5 ] }
//   Errors: { ok: false, vendorMessage, debugCode }

const HAIRCUT_LANG_NAME = { en: 'English', vi: 'Vietnamese (tiếng Việt)', es: 'Spanish (Español)' };
const HAIRCUT_AUDIENCES = new Set(['man', 'woman', 'child', 'neutral']);
const HAIRCUT_EXPLORE   = new Set(['haircut', 'color', 'highlights', 'curly', 'straight']);
const HAIRCUT_PREFS     = new Set(['professional', 'trendy', 'low_maintenance', 'natural', 'bold']);

function normalizeHaircutAudience(v) {
  v = String(v || '').toLowerCase().trim();
  if (v === 'male' || v === 'men') v = 'man';
  if (v === 'female' || v === 'women') v = 'woman';
  if (v === 'kid' || v === 'kids' || v === 'children') v = 'child';
  if (v === 'no_preference' || v === 'none' || v === 'any' || v === '') v = 'neutral';
  return HAIRCUT_AUDIENCES.has(v) ? v : 'neutral';
}
function normalizeHaircutExplore(v) {
  var arr = Array.isArray(v) ? v : (v ? [v] : []);
  var out = [];
  arr.forEach(function (x) {
    var k = String(x || '').toLowerCase().trim();
    if (k === 'colour') k = 'color';
    if (HAIRCUT_EXPLORE.has(k) && out.indexOf(k) < 0) out.push(k);
  });
  if (!out.length) out.push('haircut');
  return out;
}
function normalizeHaircutPref(v) {
  v = String(v || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (v === 'low' || v === 'lowmaintenance') v = 'low_maintenance';
  return HAIRCUT_PREFS.has(v) ? v : '';
}

const IDENTITY_CLAUSE = 'CRITICAL — IDENTITY LOCK: keep the EXACT SAME PERSON from the photo — same face, same facial features and bone structure, same ethnicity and skin tone, same age, same gender presentation, same eyes, nose, mouth and complexion. Do NOT swap in a different model and do NOT beautify or change the face. Change ONLY the hair (and hair color where stated). Photorealistic, natural lighting, head-and-shoulders portrait, sharp focus.';
// Wig + hair-system modes are full-hair REPLACEMENTS, not in-place edits. The
// in-place IDENTITY_CLAUSE ("change ONLY the hair") contradicts the task and
// makes the image model produce weak/empty output, so those modes use this
// replacement-forcing clause instead (still locks identity).
// NATURAL-HAIR framing (do NOT say "wig"/"hairpiece"/"costume" — image models key
// on those nouns even when negated, which produces costume output). Describe the
// RESULT as the person's own fuller, salon-quality growing hair, and preserve the
// whole photo (identity + head angle + lighting + shadows + background + neck).
const REPLACE_HAIR_CLAUSE = 'NATURAL HAIR EDIT — this is a photo retouch of this EXACT photograph: change ONLY the hair, nothing else. Keep the identical person and identity (same face, eyes, nose, lips, skin tone, age, ethnicity, head shape and facial structure), the SAME head tilt and camera angle, the SAME lighting direction, highlights and shadows, the SAME background, and the SAME neck and shoulders. Give them a fuller, natural, salon-fresh head of hair that looks exactly like their OWN healthy growing hair: a soft, slightly irregular hairline that melts into the forehead and temples with fine baby hairs (never a hard edge or straight band), a realistic part and scalp where visible, natural density and volume with strand-level detail and natural movement, and a hair colour and shine matched to their complexion and the photo light so the roots read as truly their own. The hair must sit with correct scale and perspective on the head and cast natural shadows. Keep it photorealistic and seamlessly blended — no pasted-on edge, no helmet shape, no flat cap line, no plastic or glossy synthetic sheen.';
// Two-pass realism refine prompt for wig/hair-system: the first-pass image is
// fed BACK into the image model with this realism-only instruction to dissolve
// the wig seam and remove the "costume" look without changing the style.
const WIG_REFINE_CLAUSE = 'REFINE PASS — keep the EXACT SAME PERSON and the SAME hairstyle, cut, length and colour in this image; do NOT change the face, the style, the lighting, the head angle or the background. Make ONLY the hair read as 100% real, naturally-growing human hair: dissolve any hard hairline, edge or band into the forehead and temples with fine baby hairs and soft flyaways; add natural density and individual-strand variation; remove any helmet shape, flat cap line, plastic shine or pasted-on look; integrate the roots, part and scalp and match the hair to the photo\'s exact lighting and skin tone so it reads as the person\'s own hair. Sharp, photorealistic, seamlessly blended.';
// Refine a first-pass replacement edit. Returns the refined dataUrl, or null on
// any failure (caller keeps the first pass). callGeminiImageEdit is hoisted.
async function refineHairRealism(geminiKey, firstPassDataUrl) {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(firstPassDataUrl || '');
  if (!m) return null;
  // attempts=1: this is a best-effort realism polish on an image we already
  // have; the caller keeps the first-pass image on failure, so no retry here
  // (keeps wig run latency bounded — the main edits above already retry).
  const out = await callGeminiImageEdit(geminiKey, m[2], m[1], WIG_REFINE_CLAUSE, 1);
  return (out && out.dataUrl) ? out.dataUrl : null;
}

// Stricter natural-realism instruction appended on a quality-gate RETRY (when the
// first result was judged fake/costume-like). Pushes hard on natural integration.
const REALISM_MAX_CLAUSE = ' MAXIMUM REALISM: the previous attempt looked fake or pasted-on — fix that. Render the hair as THIS person\'s own natural growing hair: dissolve the hairline into the skin with fine baby hairs (no edge, band or cap line), vary density and direction, match colour, sheen and lighting exactly to the face and photo, with correct scale and natural shadows. Absolutely no helmet shape, no plastic or synthetic shine, no pasted-on look. Keep the same person, face, angle, lighting and background.';

// Realism quality gate: ask a fast vision model whether the HAIR in a generated
// result looks like real natural hair or an obvious fake/costume. Returns
// { natural, score, issues }. IMPORTANT: any assessment failure returns
// natural:true (never block a genuine result on a checker hiccup); the gate only
// acts on a confident "fake" verdict.
const REALISM_JUDGE_PROMPT = 'Image 1 is a person\'s ORIGINAL photo. Image 2 is an AI hair makeover of the SAME person. As a strict QA checker, judge two things: (a) IDENTITY — is image 2 clearly the SAME person with the same face (not distorted, not a different or much-younger model, face not changed too much)? (b) HAIR REALISM — does the hair in image 2 look like REAL, natural, growing human hair, or an obvious fake/costume with a visible cap line, hard pasted edge, helmet shape, plastic/synthetic shine, unnatural giant volume, or colour/lighting that does not match the face? Return STRICT JSON only, no markdown: {"identityStable": true|false, "natural": true|false, "score": 0.0, "issues": ["short-tag"]}. Use natural=false and score below 0.5 when the hair looks fake/costume/pasted/over-volumized/mismatched; identityStable=false when the face changed too much; score above 0.7 only when identity holds AND the hair is convincingly real.';
// Pass the ORIGINAL selfie too so the judge can detect identity drift, not just
// costume look. Any assessment failure returns pass=true (never block a genuine
// result on a checker hiccup) — the gate only acts on a confident negative verdict.
async function assessHairRealism(geminiKey, resultDataUrl, originalBase64, originalMime) {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(resultDataUrl || '');
  if (!m) return { natural: true, score: 1, issues: [] };
  try {
    const parts = [];
    if (originalBase64) parts.push({ inline_data: { mime_type: originalMime || 'image/jpeg', data: originalBase64 } });
    parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
    parts.push({ text: REALISM_JUDGE_PROMPT });
    const body = { contents: [{ role: 'user', parts: parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } };
    const raw = await httpsPost('generativelanguage.googleapis.com', `/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {}, body);
    const parsed = JSON.parse(raw);
    const txt = (((parsed.candidates || [])[0] || {}).content && parsed.candidates[0].content.parts || [])
      .map(function (p) { return p.text || ''; }).join('').trim();
    const j = JSON.parse(txt.replace(/^```json\s*|\s*```$/g, ''));
    const score = (typeof j.score === 'number') ? j.score : (j.natural === false ? 0.3 : 0.8);
    const pass = (j.natural !== false) && (j.identityStable !== false) && score >= 0.5;
    return { natural: pass, score: score, issues: Array.isArray(j.issues) ? j.issues : [], identityStable: j.identityStable !== false };
  } catch (e) {
    return { natural: true, score: 1, issues: [] }; // never block on a checker failure
  }
}

// Run the realism gate on a featured image: assess → if it looks fake, RETRY the
// edit once with the max-realism clause → re-assess. Returns the best dataUrl we
// have plus whether it ultimately passed. base64/mime are the ORIGINAL selfie.
async function realismGate(geminiKey, dataUrl, base64, mimeType, editPrompt) {
  let first = await assessHairRealism(geminiKey, dataUrl, base64, mimeType);
  if (first.natural) return { dataUrl: dataUrl, passed: true, score: first.score };
  console.warn('[realismGate] first result judged unnatural', first);
  try {
    const retry = await callGeminiImageEdit(geminiKey, base64, mimeType, editPrompt + REALISM_MAX_CLAUSE, 2);
    const second = await assessHairRealism(geminiKey, retry.dataUrl, base64, mimeType);
    if (second.natural) return { dataUrl: retry.dataUrl, passed: true, score: second.score };
    // Keep the higher-scoring of the two so we still show our best attempt.
    return { dataUrl: (second.score >= first.score ? retry.dataUrl : dataUrl), passed: false, score: Math.max(first.score, second.score) };
  } catch (e) {
    return { dataUrl: dataUrl, passed: false, score: first.score };
  }
}

const CHILD_SAFETY_CLAUSE = ' This subject is a CHILD: keep them clearly the same child of the same age, with wholesome, school-appropriate kid styling only — no adult/edgy looks, no facial hair, no aging.';
// Master Stylist composite edit: lock facial identity but allow hair/color/
// eyebrow/beard enhancement (+ wig/hair-system if beneficial).
const MASTER_STYLIST_CLAUSE = 'NATURAL LOOK EDIT — keep the EXACT SAME PERSON: same face, eyes, nose, lips, age range, ethnicity, skin tone and facial bone structure, and the SAME head angle, lighting, shadows and background; do NOT swap the person or alter facial features. Enhance PRIMARILY with a flattering haircut, natural hair colour, texture/shape, eyebrows and (men) a groomed beard. Only add MORE fullness where the hair genuinely looks thin, and render any added fullness as the person\'s OWN natural growing hair — a soft irregular hairline with fine baby hairs, realistic part/scalp, natural density and matched colour/lighting; never a pasted-on, helmet, cap-line, plastic or synthetic look. Produce the single most flattering, harmonious, youthful, confident and natural result, photorealistic and seamlessly blended.';

// audience → instruction phrasing for the analysis model
const HAIRCUT_AUDIENCE_BRIEF = {
  man:     'a MAN — recommend masculine men’s hairstyles only.',
  woman:   'a WOMAN — recommend feminine women’s hairstyles only; never default to men’s cuts.',
  child:   'a CHILD — recommend age-appropriate children’s hairstyles only; never adult styling.',
  neutral: 'NO STATED PREFERENCE — infer the most fitting gender presentation and age from the photo and recommend accordingly (do not assume male).'
};

// localized maintenance words for the scaffold fallback
const HAIRCUT_MAINT_WORDS = {
  low:    { en: 'Low maintenance',    vi: 'Dễ chăm sóc',       es: 'Bajo mantenimiento' },
  medium: { en: 'Medium maintenance', vi: 'Chăm sóc vừa phải',  es: 'Mantenimiento medio' },
  high:   { en: 'Higher maintenance', vi: 'Cần chăm sóc nhiều', es: 'Mayor mantenimiento' }
};

// Deterministic, AUDIENCE-CORRECT fallback archetypes used only when the vision
// analysis is unavailable or returns junk. Customer-facing text is localized
// (vi/en/es); editPrompt is English and identity-locked. Previews are still
// generated image-to-image from the real selfie — never a static catalog photo.
const HAIRCUT_SCAFFOLD = {
  man: [
    { styleId: 'classic-side-part', maint: 'medium', title: { en: 'Classic Side Part', vi: 'Rẽ ngôi cổ điển', es: 'Raya lateral clásica' },
      editPrompt: 'Give this man a CLASSIC SIDE PART: top about 7-8cm combed to one side along a clean part, tapered sides (not skin-shaved), square neckline, light glossy finish.' },
    { styleId: 'skin-fade-textured-top', maint: 'medium', title: { en: 'Skin Fade + Textured Top', vi: 'Skin fade đỉnh tạo kết cấu', es: 'Degradado con textura' },
      editPrompt: 'Give this man a MODERN SKIN FADE: sides and back faded to the skin near the ears rising to the temples, top about 4cm with visible texture, matte finish.' },
    { styleId: 'textured-crop', maint: 'low', title: { en: 'Textured Crop', vi: 'Crop tạo kết cấu', es: 'Crop texturizado' },
      editPrompt: 'Give this man a FRENCH CROP: short tapered sides, a short textured fringe forward on the forehead, matte finish.' },
    { styleId: 'buzz-crew', maint: 'low', title: { en: 'Buzz / Crew Cut', vi: 'Buzz cut', es: 'Corte al rape' },
      editPrompt: 'Give this man a UNIFORM BUZZ/CREW CUT, about a #2 guard all over, clean neat neckline, no product.' },
    { styleId: 'business-taper', maint: 'medium', title: { en: 'Business Taper', vi: 'Tapered công sở', es: 'Taper ejecutivo' },
      editPrompt: 'Give this man a BUSINESS TAPER: medium top neatly combed back, gradually tapered sides, polished professional finish.' }
  ],
  woman: [
    { styleId: 'long-layers', maint: 'medium', title: { en: 'Long Layers', vi: 'Tóc dài tỉa layer', es: 'Capas largas' },
      editPrompt: 'Give this woman LONG LAYERED HAIR: shoulder-blade length with soft face-framing layers and natural movement.' },
    { styleId: 'face-framing-lob', maint: 'medium', title: { en: 'Face-Framing Lob', vi: 'Lob ôm khuôn mặt', es: 'Lob que enmarca el rostro' },
      editPrompt: 'Give this woman a LONG BOB (LOB) just above the shoulders with face-framing layers and a soft blunt finish.' },
    { styleId: 'soft-waves', maint: 'medium', title: { en: 'Soft Waves', vi: 'Tóc gợn sóng nhẹ', es: 'Ondas suaves' },
      editPrompt: 'Give this woman SOFT LOOSE WAVES at mid-length with a glossy, healthy finish.' },
    { styleId: 'blunt-bob', maint: 'low', title: { en: 'Blunt Bob', vi: 'Bob cắt thẳng', es: 'Bob recto' },
      editPrompt: 'Give this woman a CHIN-LENGTH BLUNT BOB with a clean straight perimeter and a subtle inward bend.' },
    { styleId: 'curtain-bangs-medium', maint: 'medium', title: { en: 'Medium Cut + Curtain Bangs', vi: 'Tóc lửng + mái bay', es: 'Media melena con cortina' },
      editPrompt: 'Give this woman a SHOULDER-LENGTH cut with soft CURTAIN BANGS parted in the middle, framing the face.' }
  ],
  child: [
    { styleId: 'kids-classic', maint: 'low', title: { en: 'Clean Kids Cut', vi: 'Cắt gọn cho bé', es: 'Corte infantil limpio' },
      editPrompt: 'Give this child a CLEAN CLASSIC KIDS CUT: short tapered sides, a little length on top combed neatly, tidy and wholesome.' },
    { styleId: 'kids-school-side', maint: 'low', title: { en: 'School-Friendly Side Part', vi: 'Rẽ ngôi đi học', es: 'Raya lateral escolar' },
      editPrompt: 'Give this child a NEAT SIDE-PART kids cut, short and easy, school-appropriate.' },
    { styleId: 'kids-easy-crop', maint: 'low', title: { en: 'Easy Crop', vi: 'Crop dễ chăm', es: 'Crop fácil' },
      editPrompt: 'Give this child a SHORT EASY CROP with a soft fringe, very low maintenance.' },
    { styleId: 'kids-scissor-short', maint: 'low', title: { en: 'Short Scissor Cut', vi: 'Cắt kéo ngắn', es: 'Corte a tijera corto' },
      editPrompt: 'Give this child a SOFT SCISSOR CUT, short and even all around, gentle and natural.' },
    { styleId: 'kids-textured-fringe', maint: 'low', title: { en: 'Textured Fringe', vi: 'Mái tạo kết cấu', es: 'Flequillo texturizado' },
      editPrompt: 'Give this child a SHORT TEXTURED FRINGE, playful but tidy and age-appropriate.' }
  ],
  neutral: [
    { styleId: 'medium-layered', maint: 'medium', title: { en: 'Medium Layered Cut', vi: 'Tóc lửng tỉa layer', es: 'Corte medio en capas' },
      editPrompt: 'Give this person a versatile MEDIUM-LENGTH LAYERED cut with soft face-framing and natural texture.' },
    { styleId: 'tapered-natural', maint: 'low', title: { en: 'Tapered Natural', vi: 'Tapered tự nhiên', es: 'Degradado natural' },
      editPrompt: 'Give this person a clean TAPERED cut with natural texture left on top, balanced and easy.' },
    { styleId: 'soft-textured-crop', maint: 'low', title: { en: 'Soft Textured Crop', vi: 'Crop mềm tạo kết cấu', es: 'Crop suave texturizado' },
      editPrompt: 'Give this person a SOFT TEXTURED CROP with a gentle fringe, modern and low effort.' },
    { styleId: 'shoulder-length', maint: 'medium', title: { en: 'Shoulder-Length Style', vi: 'Tóc ngang vai', es: 'Estilo a los hombros' },
      editPrompt: 'Give this person a SHOULDER-LENGTH style with soft layers and healthy shine.' },
    { styleId: 'classic-short', maint: 'low', title: { en: 'Classic Short Cut', vi: 'Tóc ngắn cổ điển', es: 'Corte corto clásico' },
      editPrompt: 'Give this person a CLASSIC SHORT cut, neat and timeless, suited to most face shapes.' }
  ]
};

// localized fallback recommendation snippets for optional explore choices
const HAIRCUT_SCAFFOLD_OPT = {
  color: {
    en: 'Ask your barber about a shade that flatters your skin tone — a soft natural brown or subtle dimension reads modern and is easy to maintain.',
    vi: 'Hỏi thợ về tông màu hợp với làn da — nâu tự nhiên nhẹ hoặc thêm chiều sâu nhẹ trông hiện đại và dễ chăm sóc.',
    es: 'Pregunta a tu barbero por un tono que favorezca tu piel — un castaño natural suave o una dimensión sutil se ve moderno y es fácil de mantener.'
  },
  highlights: {
    en: 'Face-framing or balayage highlights add brightness with low upkeep and grow out softly.',
    vi: 'Highlight ôm mặt hoặc balayage tạo điểm sáng, ít phải dặm lại và phai tự nhiên.',
    es: 'Las mechas que enmarcan el rostro o el balayage aportan luz con poco mantenimiento y crecen de forma natural.'
  },
  curly: {
    en: 'Keep length to support the curl pattern; a light layered shape enhances natural curl.',
    vi: 'Giữ độ dài để hỗ trợ lọn xoăn; tỉa layer nhẹ giúp lọn xoăn tự nhiên đẹp hơn.',
    es: 'Mantén el largo para favorecer el rizo; una forma ligera en capas realza el rizo natural.'
  },
  straight: {
    en: 'A clean blunt or lightly layered shape keeps straight hair sleek and easy to style.',
    vi: 'Kiểu cắt thẳng gọn hoặc layer nhẹ giúp tóc thẳng mượt và dễ tạo kiểu.',
    es: 'Una forma recta y limpia o ligeramente en capas mantiene el cabello liso y fácil de peinar.'
  }
};

const HAIRCUT_SCAFFOLD_TXT = {
  descTmpl: {
    en: function (title) { return 'A ' + title.toLowerCase() + ' shaped to suit your features — a reliable, flattering choice.'; },
    vi: function (title) { return 'Kiểu ' + title + ' được tạo dáng hợp với khuôn mặt của bạn — lựa chọn an toàn và tôn dáng.'; },
    es: function (title) { return 'Un ' + title.toLowerCase() + ' adaptado a tus facciones — una opción favorecedora y segura.'; }
  },
  whyTmpl:   { en: 'Balanced proportions that flatter most face shapes.', vi: 'Tỉ lệ cân đối, tôn hầu hết các dáng mặt.', es: 'Proporciones equilibradas que favorecen la mayoría de los rostros.' },
  barberTmpl:{ en: 'Discuss exact lengths and finish with your barber on arrival.', vi: 'Trao đổi độ dài và cách hoàn thiện cụ thể với thợ khi gặp.', es: 'Acuerda los largos exactos y el acabado con tu barbero al llegar.' },
  safetyChild:{ en: 'Age-appropriate kids’ styling.', vi: 'Kiểu phù hợp với trẻ em.', es: 'Estilo apropiado para niños.' }
};

function buildHaircutScaffold(audience, exploreList, lang) {
  var set = HAIRCUT_SCAFFOLD[audience] || HAIRCUT_SCAFFOLD.neutral;
  var wantColor = exploreList.indexOf('color') >= 0;
  var wantHi    = exploreList.indexOf('highlights') >= 0;
  var wantCurly = exploreList.indexOf('curly') >= 0;
  var wantStraight = exploreList.indexOf('straight') >= 0;
  var L = function (tbl) { return tbl[lang] || tbl.en; };
  return set.map(function (s) {
    var title = s.title[lang] || s.title.en;
    var edit = s.editPrompt;
    if (wantColor) edit += ' Apply a natural, flattering hair color that suits the subject’s skin tone.';
    if (wantHi) edit += ' Add subtle face-framing highlights for brightness.';
    if (wantCurly) edit += ' Style with natural-looking curls/waves.';
    if (wantStraight) edit += ' Style sleek and straight.';
    edit += ' ' + IDENTITY_CLAUSE + (audience === 'child' ? CHILD_SAFETY_CLAUSE : '');
    return {
      styleId: s.styleId,
      styleTitle: title,
      targetAudience: audience,
      description: HAIRCUT_SCAFFOLD_TXT.descTmpl[lang] ? HAIRCUT_SCAFFOLD_TXT.descTmpl[lang](title) : HAIRCUT_SCAFFOLD_TXT.descTmpl.en(title),
      whyItFitsFace: L(HAIRCUT_SCAFFOLD_TXT.whyTmpl),
      maintenanceLevel: L(HAIRCUT_MAINT_WORDS[s.maint] || HAIRCUT_MAINT_WORDS.medium),
      haircutInstructionsForBarber: L(HAIRCUT_SCAFFOLD_TXT.barberTmpl),
      colorRecommendation: wantColor ? L(HAIRCUT_SCAFFOLD_OPT.color) : '',
      highlightRecommendation: wantHi ? L(HAIRCUT_SCAFFOLD_OPT.highlights) : '',
      curlStraightRecommendation: wantCurly ? L(HAIRCUT_SCAFFOLD_OPT.curly) : (wantStraight ? L(HAIRCUT_SCAFFOLD_OPT.straight) : ''),
      confidence: 0.6,
      safetyNotes: audience === 'child' ? L(HAIRCUT_SCAFFOLD_TXT.safetyChild) : '',
      imageEditPrompt: edit
    };
  });
}

function buildHaircutAnalysisPrompt(audience, exploreList, preference, lang) {
  var langName = HAIRCUT_LANG_NAME[lang] || 'English';
  var brief = HAIRCUT_AUDIENCE_BRIEF[audience] || HAIRCUT_AUDIENCE_BRIEF.neutral;
  var wantsColorOrHi = exploreList.indexOf('color') >= 0 || exploreList.indexOf('highlights') >= 0;
  var prefTxt = preference ? preference.replace(/_/g, ' ') : 'no specific preference';
  return [
    'You are a master barber and hairstylist. Analyse the ONE attached customer photo and recommend hairstyles.',
    '',
    'CUSTOMER CHOICES:',
    '- Who the style is for: ' + brief,
    '- Wants to explore: ' + exploreList.join(', ') + '.',
    '- Style preference / vibe: ' + prefTxt + '.',
    '',
    'STEP 1 — From the photo, analyse: face shape, facial frame, jawline, forehead, current hair length, hair texture (if visible), current style, age category (adult or child), and masculine/feminine/neutral presentation' + (wantsColorOrHi ? ', and skin tone (for color/highlight matching)' : '') + '.',
    '',
    'STEP 2 — Recommend EXACTLY 5 DISTINCT hairstyles that genuinely fit THIS person and the choices above.',
    'Rules:',
    '- Respect the audience: never recommend men’s cuts for a woman or child, and never adult styling for a child.',
    '- "haircut" is always in scope. Only include a colorRecommendation if "color" was requested; only a highlightRecommendation if "highlights" was requested; only a curlStraightRecommendation if "curly" or "straight" was requested — otherwise return "" for those fields.',
    '- haircutInstructionsForBarber must be concrete, actionable cutting/styling notes a barber can follow.',
    '- whyItFitsFace must reference the analysed face shape / features.',
    '- confidence is a number 0..1 (how well it suits this person).',
    '- safetyNotes: caveats (children: age-appropriateness; bold color: commitment/upkeep). May be "".',
    '- imageEditPrompt: a precise ENGLISH instruction telling an image model how to render THIS exact hairstyle on the customer. It MUST preserve the same person, face, ethnicity, skin tone, age and gender presentation, changing only the hair' + (audience === 'child' ? ' (keep them a same-age child with wholesome kid styling only)' : '') + '.',
    '',
    'LANGUAGE: write every customer-facing field (styleTitle, description, whyItFitsFace, maintenanceLevel, haircutInstructionsForBarber, colorRecommendation, highlightRecommendation, curlStraightRecommendation, safetyNotes, and the top-level analysis) in ' + langName + '. Write imageEditPrompt in ENGLISH only.',
    '',
    'Return STRICT JSON only (no markdown, no commentary) of the form:',
    '{"analysis":"<short summary in ' + langName + '>","styles":[{"styleId":"kebab-id","styleTitle":"","targetAudience":"man|woman|child|neutral","description":"","whyItFitsFace":"","maintenanceLevel":"","haircutInstructionsForBarber":"","colorRecommendation":"","highlightRecommendation":"","curlStraightRecommendation":"","confidence":0.0,"safetyNotes":"","imageEditPrompt":""}]}',
    'The styles array MUST contain exactly 5 items.'
  ].join('\n');
}

function extractHaircutJson(text) {
  var t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(t); }
  catch (e) {
    var a = t.indexOf('{'); var b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error('analysis_unparseable');
  }
}

async function callGeminiHaircutAnalysis(geminiKey, base64, mimeType, promptText) {
  var body = {
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
        { text: promptText }
      ]
    }],
    generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
  };
  var raw = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {},
    body
  );
  var parsed = JSON.parse(raw);
  var cand = parsed.candidates && parsed.candidates[0];
  var parts = cand && cand.content && cand.content.parts;
  if (!parts || !parts.length) throw new Error('analysis_no_parts');
  var text = parts.map(function (p) { return p.text || ''; }).join('').trim();
  if (!text) throw new Error('analysis_empty');
  return extractHaircutJson(text);
}

function normalizeHaircutStyle(s, audience, idx, mode) {
  s = s || {};
  var title = String(s.styleTitle || s.title || '').trim() || ('Style ' + (idx + 1));
  var childClause = (audience === 'child') ? CHILD_SAFETY_CLAUSE : '';
  // wig / hair-system need actual replacement; every other mode is an in-place edit.
  var isReplace = (mode === 'wig' || mode === 'hairsystem');
  var lockClause = isReplace ? REPLACE_HAIR_CLAUSE : IDENTITY_CLAUSE;
  var edit = String(s.imageEditPrompt || s.editPrompt || '').trim();
  // Neutralize costume nouns in the MODEL'S image instruction BEFORE we append our
  // house clause (image models render "wig"/"hairpiece"/"costume" as a costume even
  // in an edit). Run it on the raw model text + the fallback title only — NOT over
  // the house clause (which legitimately uses "synthetic" in a negative). The
  // customer-facing title/description keep their original wording.
  var reframe = function (txt) {
    return String(txt).replace(/\bwigs?\b/gi, 'fuller natural hairstyle')
                      .replace(/\bhair[-\s]?pieces?\b/gi, 'natural hair')
                      .replace(/\bhair[-\s]?replacements?\b/gi, 'fuller natural hair')
                      .replace(/\bcostumes?\b/gi, 'style')
                      .replace(/\blace[-\s]?fronts?\b/gi, 'natural hairline')
                      .replace(/\bsynthetic\b/gi, 'natural');
  };
  if (isReplace && edit) edit = reframe(edit);
  if (isReplace && edit) {
    // Force the replacement clause even if the vision model already emitted an
    // in-place identity lock — wig/hair-system must visibly replace the hair.
    edit += ' ' + lockClause + childClause;
  } else if (edit && edit.toUpperCase().indexOf('IDENTITY LOCK') < 0) {
    edit += ' ' + lockClause + childClause;
  }
  if (!edit) edit = (isReplace ? 'Restyle the subject’s hair into a fuller, natural version of "' + reframe(title) : 'Restyle the subject’s hair into "' + title) + '". ' + lockClause + childClause;
  var aud = String(s.targetAudience || '').toLowerCase();
  var sid = String(s.styleId || ('style-' + (idx + 1))).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return {
    styleId: sid || ('style-' + (idx + 1)),
    styleTitle: title,
    targetAudience: HAIRCUT_AUDIENCES.has(aud) ? aud : audience,
    description: String(s.description || s.explanation || '').trim(),
    whyItFitsFace: String(s.whyItFitsFace || '').trim(),
    maintenanceLevel: String(s.maintenanceLevel || s.maintenance || '').trim(),
    haircutInstructionsForBarber: String(s.haircutInstructionsForBarber || s.barberNotes || '').trim(),
    colorRecommendation: String(s.colorRecommendation || '').trim(),
    highlightRecommendation: String(s.highlightRecommendation || '').trim(),
    curlStraightRecommendation: String(s.curlStraightRecommendation || '').trim(),
    confidence: (typeof s.confidence === 'number' && s.confidence >= 0 && s.confidence <= 1) ? s.confidence : 0.7,
    safetyNotes: String(s.safetyNotes || '').trim(),
    imageEditPrompt: edit
  };
}

// Plan 5 audience-correct styles. Vision analysis is primary; the deterministic
// scaffold pads to 5 (or fully replaces) if analysis is unavailable/incomplete.
async function planHaircutStyles(geminiKey, base64, mimeType, opts) {
  var audience = opts.audience, exploreList = opts.explore, preference = opts.preference, lang = opts.lang;
  var analysisText = '';
  var analysisOk = false;
  var styles = [];
  try {
    var prompt = buildHaircutAnalysisPrompt(audience, exploreList, preference, lang);
    var plan = await callGeminiHaircutAnalysis(geminiKey, base64, mimeType, prompt);
    analysisText = String((plan && plan.analysis) || '').trim();
    var raw = (plan && Array.isArray(plan.styles)) ? plan.styles : [];
    styles = raw.map(function (s, i) { return normalizeHaircutStyle(s, audience, i, 'haircut'); })
                .filter(function (s) { return s.imageEditPrompt; });
    analysisOk = styles.length > 0;
  } catch (e) {
    console.warn('[generateHaircutPreviews] analysis failed, using scaffold:', (e && e.message) || e);
  }
  if (styles.length < 5) {
    var scaffold = buildHaircutScaffold(audience, exploreList, lang)
                     .map(function (s, i) { return normalizeHaircutStyle(s, audience, i, 'haircut'); });
    var seen = {};
    styles.forEach(function (s) { seen[s.styleId] = true; });
    for (var i = 0; i < scaffold.length && styles.length < 5; i++) {
      if (!seen[scaffold[i].styleId]) { styles.push(scaffold[i]); seen[scaffold[i].styleId] = true; }
    }
  }
  return { analysis: analysisText, styles: styles.slice(0, 5), analysisOk: analysisOk };
}

// SP-5 RELIABILITY: Gemini 2.5 Flash Image intermittently returns a text-only /
// empty response for face edits (a refusal/description with no image part) or a
// transient 5xx/429. Previously a single such response was a hard failure that
// surfaced as a text-only / "no image" result. We now RETRY up to `attempts`
// times; on each retry we re-assert "output an edited IMAGE of the SAME person,
// not text" (which both nudges the model off a text-only reply and re-locks
// identity). The function still THROWS after exhausting attempts, so callers'
// existing error handling (clear error, never text-as-result) is preserved.
const IMAGE_RETRY_SUFFIX = ' IMPORTANT: Output an EDITED PHOTOGRAPH (an image) of the SAME person — do NOT reply with text, a caption, or a description. Keep the EXACT same face, eyes, nose, lips, skin tone, age and bone structure; change ONLY the hair / style as instructed. Return the image only.';
// Relaxed safety for the IMAGE edit: this is a benign hair-makeover of a
// consenting adult's own selfie. We turn OFF the four configurable harm
// categories so an ordinary portrait is never refused as a false positive.
// NOTE: the non-configurable child-safety / IMAGE_SAFETY filter still applies
// and CANNOT be disabled — a true child-safety block is surfaced, not bypassed.
const IMAGE_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];
// finishReason values that mean a deterministic content block — retrying with
// the same photo will fail the same way, so we stop and surface it as a block
// rather than burning a second call.
const IMAGE_BLOCK_REASONS = ['SAFETY', 'IMAGE_SAFETY', 'PROHIBITED_CONTENT', 'RECITATION', 'BLOCKLIST', 'SPII'];
async function callGeminiImageEdit(geminiKey, inlineImageBase64, mimeType, editPrompt, attempts) {
  const maxAttempts = Math.max(1, attempts == null ? 2 : attempts);
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const prompt = attempt === 0 ? editPrompt : (editPrompt + IMAGE_RETRY_SUFFIX);
    const body = {
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType || 'image/jpeg', data: inlineImageBase64 } },
          { text: prompt }
        ]
      }],
      generationConfig: { responseModalities: ['IMAGE'] },
      safetySettings: IMAGE_SAFETY_SETTINGS
    };
    try {
      const raw = await httpsPost(
        'generativelanguage.googleapis.com',
        `/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
        {},
        body
      );
      const parsed = JSON.parse(raw);
      const cand = parsed.candidates && parsed.candidates[0];
      const parts = cand && cand.content && cand.content.parts;
      const imagePart = parts && parts.find(p => p.inline_data || p.inlineData);
      if (imagePart) {
        const inline = imagePart.inline_data || imagePart.inlineData;
        return { dataUrl: `data:${inline.mime_type || inline.mimeType || 'image/png'};base64,${inline.data}` };
      }
      // 200 OK but no image part = text-only / safety refusal / empty candidate.
      // Log the model's own diagnostics so production logs reveal WHY (this is
      // the only place that knows the real finishReason + safety verdict).
      const finishReason = (cand && cand.finishReason) || (parsed.promptFeedback && parsed.promptFeedback.blockReason) || 'unknown';
      const safety = (cand && cand.safetyRatings) || (parsed.promptFeedback && parsed.promptFeedback.safetyRatings) || [];
      const code = (!parsed.candidates || !parsed.candidates.length) ? 'no_candidates'
        : (!parts || !parts.length) ? 'no_parts' : 'no_inline_data';
      const blocked = IMAGE_BLOCK_REASONS.indexOf(finishReason) !== -1
        || !!(parsed.promptFeedback && parsed.promptFeedback.blockReason);
      console.warn('[callGeminiImageEdit] no image returned', JSON.stringify({
        attempt, code, finishReason, blocked,
        safetyRatings: safety.map(r => ({ c: r.category, p: r.probability, blocked: r.blocked })),
      }));
      lastErr = new Error(code);
      lastErr.finishReason = finishReason;
      lastErr.blocked = blocked;
      // A deterministic content block won't change on retry — stop now and let
      // the caller show a "try a different photo" message instead of a generic
      // transient error.
      if (blocked) { lastErr.code = 'image_blocked'; break; }
    } catch (e) {
      lastErr = e; // network / non-2xx (5xx, 429) → retry
    }
    if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 500));
  }
  throw lastErr || new Error('image_edit_failed');
}

exports.generateHaircutPreviews = onCall(
  {
    region: 'us-central1',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    cors: true,
  },
  async (request) => {
    // Public endpoint — customers calling from /mobile-barber landing are
    // unauthenticated. The selfie itself is the auth surface; we treat the
    // call as untrusted and clamp the input.
    const data = request.data || {};
    const rawDataUrl = String(data.selfieDataUrl || '');
    const langParam  = String(data.lang || 'en').toLowerCase();
    const lang = HAIRCUT_LANG_NAME[langParam] ? langParam : 'en';
    // Audience + explore + preference are optional (older cached clients omit
    // them). Defaults: neutral audience (model infers from the photo), a
    // haircut-only exploration, and no specific vibe.
    const audience   = normalizeHaircutAudience(data.audience);
    const explore    = normalizeHaircutExplore(data.explore || data.exploreOptions);
    const preference = normalizeHaircutPref(data.preference || data.stylePreference);

    if (!rawDataUrl || rawDataUrl.indexOf('data:image/') !== 0) {
      return { ok: false, vendorMessage: 'Missing or invalid selfie image.', debugCode: 'INVALID_INPUT' };
    }
    // Pull mime + base64 portion. Hard cap input size at 1.5 MB to keep
    // egress to Gemini reasonable.
    const match = rawDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return { ok: false, vendorMessage: 'Selfie format not supported (use JPEG/PNG/WebP).', debugCode: 'BAD_MIME' };
    const mimeType = match[1];
    const base64   = match[2];
    if (base64.length > 1_500_000) {
      return { ok: false, vendorMessage: 'Selfie is too large. Please use a smaller photo.', debugCode: 'IMAGE_TOO_LARGE' };
    }

    // Nano Banana (Gemini 2.5 Flash Image) uses the same Gemini key, read the
    // secured way: config/aiSecrets first, then the Functions secret fallback.
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) {
      return { ok: false, vendorMessage: 'AI preview is temporarily unavailable. Please continue your booking; the barber will suggest a style in person.', debugCode: 'NO_GEMINI_KEY' };
    }

    const t0 = Date.now();

    // STAGE 1 — analyse the selfie + plan 5 audience-correct styles. Always
    // returns 5 styles (vision analysis, padded/replaced by the scaffold).
    let plan;
    try {
      plan = await planHaircutStyles(geminiKey, base64, mimeType, { audience, explore, preference, lang });
    } catch (e) {
      console.error('[generateHaircutPreviews] planning failure', e);
      return { ok: false, vendorMessage: 'AI preview failed. Please try again or continue without a preview.', debugCode: 'PLAN_ERROR' };
    }
    const styles = (plan && plan.styles) || [];
    if (!styles.length) {
      return { ok: false, vendorMessage: 'AI preview did not return styles. Please continue your booking.', debugCode: 'PLAN_EMPTY' };
    }

    // STAGE 2 — generate one image-to-image preview per style (parallel). Each
    // preview is rendered from the customer's OWN selfie so identity, ethnicity,
    // skin tone and age are preserved.
    let results;
    try {
      results = await Promise.all(styles.map(async (style) => {
        const baseRec = {
          styleId: style.styleId,
          title: style.styleTitle,
          styleTitle: style.styleTitle,
          targetAudience: style.targetAudience,
          explanation: style.description,
          description: style.description,
          whyItFitsFace: style.whyItFitsFace,
          maintenance: style.maintenanceLevel,
          maintenanceLevel: style.maintenanceLevel,
          barberNotes: style.haircutInstructionsForBarber,
          haircutInstructionsForBarber: style.haircutInstructionsForBarber,
          colorRecommendation: style.colorRecommendation,
          highlightRecommendation: style.highlightRecommendation,
          curlStraightRecommendation: style.curlStraightRecommendation,
          confidence: style.confidence,
          safetyNotes: style.safetyNotes
        };
        try {
          const edit = await callGeminiImageEdit(geminiKey, base64, mimeType, style.imageEditPrompt);
          return Object.assign({}, baseRec, {
            previewDataUrl: edit.dataUrl,
            // Low-confidence renders are labelled "style inspiration" rather
            // than "your exact preview" so we never over-promise a match.
            previewKind: (style.confidence < 0.45) ? 'style_inspiration' : 'your_preview',
            error: null
          });
        } catch (err) {
          return Object.assign({}, baseRec, {
            previewDataUrl: '',
            previewKind: 'style_inspiration',
            error: (err && err.message) || 'gemini_failed'
          });
        }
      }));
    } catch (e) {
      console.error('[generateHaircutPreviews] catastrophic image failure', e);
      return { ok: false, vendorMessage: 'AI preview failed. Please try again or continue without a preview.', debugCode: 'PROVIDER_ERROR' };
    }

    const successful = results.filter(r => !r.error && r.previewDataUrl);
    if (!successful.length) {
      // Surface the underlying provider error verbatim so dev tools show
      // the real cause; the customer-facing message stays human.
      const firstErr = (results[0] && results[0].error) || 'unknown';
      console.error('[generateHaircutPreviews] all generations failed', results.map(r => r.error));
      return {
        ok: false,
        vendorMessage: 'AI preview did not return a usable image. Please continue your booking; you can discuss styles with the barber in person.',
        debugCode: 'PROVIDER_EMPTY',
        debug: firstErr
      };
    }

    const tookMs = Date.now() - t0;
    return {
      ok: true,
      analysis: (plan && plan.analysis) || '',
      audience: audience,
      explore: explore,
      preference: preference,
      recommendations: results,
      provider: 'gemini-2.5-flash-image',
      generationTimeMs: tookMs,
      successCount: successful.length
    };
  }
);

// ────────────────────────────────────────────────────────────────────────
// AI STYLE STUDIO — vendor-only expansion of the AI hairstyle engine.
// Isolated from generateHaircutPreviews (which stays public + unchanged).
// Reuses the same Gemini vision + image-edit helpers. No images persist.
// ────────────────────────────────────────────────────────────────────────

// Require an authenticated mobile-barber VENDOR. Customers (anonymous on the
// /mobile-barber landing) must NOT be able to call the studio.
async function requireMobileBarberVendor(request) {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Sign in as a vendor to use the Style Studio.');
  }
  const provider = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
  if (provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Anonymous users cannot use the Style Studio.');
  }
  // vendorUsers/{uid} maps an authed user to a vendor (same rule as the portal's
  // isPortalVendorUser()). Uses the module-scoped `db` (admin.firestore()).
  const snap = await db.collection('vendorUsers').doc(auth.uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'This account is not a registered vendor.');
  }
  return snap.data() || {};
}

// Coerce the model's raw analysis object into the studio analysis schema
// (features + scores + strategy + thinning). Factored out of runStudioPlan so
// the Master Stylist path reuses the EXACT same normalization.
function normalizeStudioAnalysis(rawAnalysis) {
  rawAnalysis = rawAnalysis || {};
  return {
    features: (rawAnalysis.features && typeof rawAnalysis.features === 'object' && !Array.isArray(rawAnalysis.features)) ? rawAnalysis.features : {},
    scores: StudioLib.normalizeStudioScores(rawAnalysis.scores),
    strategy: {
      emphasize: Array.isArray(rawAnalysis.strategy && rawAnalysis.strategy.emphasize) ? rawAnalysis.strategy.emphasize.slice(0, 6) : [],
      balance: Array.isArray(rawAnalysis.strategy && rawAnalysis.strategy.balance) ? rawAnalysis.strategy.balance.slice(0, 6) : [],
    },
    thinning: {
      level: ['none', 'mild', 'moderate', 'advanced'].indexOf(String(rawAnalysis.thinning && rawAnalysis.thinning.level)) >= 0
        ? rawAnalysis.thinning.level : 'none',
      note: String((rawAnalysis.thinning && rawAnalysis.thinning.note) || '').trim(),
    },
    // Wig-intelligence: the model first assesses current hair volume, then makes
    // an explicit, transparent wig decision. Coerced to known enums so the client
    // can show "why a wig was / was not recommended" and never over-suggest one.
    hairVolumeAssessment: ['adequate', 'mild_thinning', 'moderate_thinning', 'advanced_thinning']
      .indexOf(String(rawAnalysis.hairVolumeAssessment)) >= 0 ? rawAnalysis.hairVolumeAssessment : '',
    wigDecision: (function () {
      const wd = (rawAnalysis.wigDecision && typeof rawAnalysis.wigDecision === 'object' && !Array.isArray(rawAnalysis.wigDecision)) ? rawAnalysis.wigDecision : {};
      return {
        needed: ['none', 'optional', 'recommended', 'strong_recommend'].indexOf(String(wd.needed)) >= 0 ? wd.needed : 'none',
        reason: String(wd.reason || '').trim(),
        naturalAlternative: String(wd.naturalAlternative || '').trim(),
        selectedApproach: ['haircut', 'color', 'texture', 'eyebrow_beard', 'subtle_volume', 'topper', 'hair_system', 'wig']
          .indexOf(String(wd.selectedApproach)) >= 0 ? wd.selectedApproach : '',
      };
    })(),
  };
}

// Plan analysis + 5 styles for a studio mode. Mirrors planHaircutStyles but
// with the richer analysis schema (features + scores + strategy + thinning).
async function runStudioPlan(geminiKey, base64, mimeType, opts) {
  const prompt = StudioLib.buildStudioAnalysisPrompt(
    opts.mode, opts.options, opts.audience, opts.preference, opts.goal, opts.lang
  );
  const plan = await callGeminiHaircutAnalysis(geminiKey, base64, mimeType, prompt); // reused vision call
  const analysis = normalizeStudioAnalysis(plan && plan.analysis);
  const rawStyles = (plan && Array.isArray(plan.styles)) ? plan.styles : [];
  const styles = rawStyles
    .map((s, i) => normalizeHaircutStyle(s, opts.audience, i, opts.mode)) // mode selects in-place vs replacement clause
    .filter((s) => s.imageEditPrompt)
    .slice(0, 5);
  return { analysis, styles };
}

// Shared studio core used by BOTH the vendor and public callables. Performs the
// analysis + per-mode (5 recs) OR master (1 masterpiece) generation. Returns the
// response object (without ok/auth concerns). The per-mode path is the existing
// vendor studio behavior moved here VERBATIM — response shape is unchanged.
async function runStudioGeneration(params) {
  const { mode, options, audience, preference, goal, lang, base64, mimeType, geminiKey } = params;
  const t0 = Date.now();

  if (mode === 'master') {
    const prompt = StudioLib.buildMasterStylistPrompt(audience, goal, lang);
    let plan;
    try {
      plan = await callGeminiHaircutAnalysis(geminiKey, base64, mimeType, prompt);
    } catch (e) {
      console.error('[runStudioGeneration] master analysis failure', e);
      return { ok: false, vendorMessage: 'Master Stylist analysis failed. Please try again.', debugCode: 'MASTER_PLAN_ERROR' };
    }
    const analysis = normalizeStudioAnalysis(plan && plan.analysis);
    const best = StudioLib.normalizeMasterpiece(plan && plan.bestLook);
    if (!best.imageEditPrompt) {
      return { ok: false, vendorMessage: 'Master Stylist could not design a look. Try a clearer photo.', debugCode: 'MASTER_EMPTY' };
    }
    let edit;
    try {
      edit = await callGeminiImageEdit(
        geminiKey, base64, mimeType,
        best.imageEditPrompt + ' ' + MASTER_STYLIST_CLAUSE + (audience === 'child' ? CHILD_SAFETY_CLAUSE : '')
      );
    } catch (e) {
      console.error('[runStudioGeneration] master edit failure', e && e.message, 'finishReason=' + (e && e.finishReason), 'blocked=' + (e && e.blocked));
      // A deterministic content block (the model refused THIS photo) gets a
      // distinct, actionable message — retrying the same photo won't help.
      if (e && e.blocked) {
        return { ok: false, vendorMessage: 'This photo couldn’t be processed. Please use a clear, front-facing photo of one person with a plain background — no filters, sunglasses, hats, or group shots.', debugCode: 'MASTER_BLOCKED' };
      }
      return { ok: false, vendorMessage: 'Master Stylist could not render the look. Please try again.', debugCode: 'MASTER_EDIT_ERROR' };
    }
    // Realism quality gate: if the look reads as fake/costume, retry once with the
    // max-realism clause; if it STILL fails, return a clear "try a better photo"
    // error rather than showing an unnatural result.
    const masterGate = await realismGate(
      geminiKey, edit.dataUrl, base64, mimeType,
      best.imageEditPrompt + ' ' + MASTER_STYLIST_CLAUSE + (audience === 'child' ? CHILD_SAFETY_CLAUSE : '')
    );
    if (!masterGate.passed) {
      return { ok: false, vendorMessage: 'We couldn’t create a natural-looking result. Please try another photo with better lighting (face the camera, hair visible, no hat or sunglasses).', debugCode: 'REALISM_FAILED' };
    }
    return {
      ok: true,
      mode: 'master', audience,
      analysis,
      masterpiece: {
        previewDataUrl: masterGate.dataUrl, title: best.title, explanation: best.explanation, attributes: best.attributes,
        // Carry the transparent wig decision to the customer (the analysis object
        // itself stays vendor-scoped); the client shows "why a wig was/wasn't used".
        wigDecision: analysis.wigDecision, hairVolumeAssessment: analysis.hairVolumeAssessment,
        // SP-6 facial-harmony: friendly "AI noticed / AI recommends" + customer-safe
        // style-guidance scores (never attractiveness; not stored unless the user saves).
        harmony: best.harmony, harmonyScores: StudioLib.customerScores(analysis.scores),
      },
      provider: 'gemini-2.5-flash-image',
      generationTimeMs: Date.now() - t0,
    };
  }

  // per-mode path (the existing studio behavior, moved verbatim from the callable)
  let plan;
  try {
    plan = await runStudioPlan(geminiKey, base64, mimeType, { mode, options, audience, preference, goal, lang });
  } catch (e) {
    console.error('[runStudioGeneration] planning failure', e);
    return { ok: false, vendorMessage: 'Style Studio analysis failed. Please try again.', debugCode: 'PLAN_ERROR' };
  }
  const styles = (plan && plan.styles) || [];
  if (!styles.length) {
    return { ok: false, vendorMessage: 'Style Studio returned no styles. Try a clearer photo.', debugCode: 'PLAN_EMPTY' };
  }

  let recommendations;
  try {
    recommendations = await Promise.all(styles.map(async (style) => {
      const baseRec = {
        styleId: style.styleId, title: style.styleTitle, styleTitle: style.styleTitle,
        targetAudience: style.targetAudience, explanation: style.description, description: style.description,
        whyItFitsFace: style.whyItFitsFace, maintenance: style.maintenanceLevel, maintenanceLevel: style.maintenanceLevel,
        barberNotes: style.haircutInstructionsForBarber, haircutInstructionsForBarber: style.haircutInstructionsForBarber,
        colorRecommendation: style.colorRecommendation, highlightRecommendation: style.highlightRecommendation,
        curlStraightRecommendation: style.curlStraightRecommendation, confidence: style.confidence,
        safetyNotes: style.safetyNotes,
      };
      try {
        const edit = await callGeminiImageEdit(geminiKey, base64, mimeType, style.imageEditPrompt); // first pass
        return Object.assign({}, baseRec, {
          previewDataUrl: edit.dataUrl,
          // Intentional: studio uses a slightly stricter "your_preview" bar (>=0.5)
          // than generateHaircutPreviews (<0.45). Do not "fix" to match.
          previewKind: (style.confidence >= 0.5) ? 'your_preview' : 'style_inspiration',
        });
      } catch (e) {
        return Object.assign({}, baseRec, { previewDataUrl: '', previewKind: 'style_inspiration', error: (e && e.message) || 'edit_failed' });
      }
    }));
  } catch (e) {
    console.error('[runStudioGeneration] image edit failure', e);
    return { ok: false, vendorMessage: 'Style Studio could not render previews. Please try again.', debugCode: 'EDIT_ERROR' };
  }

  // Realism refine for wig/hair-system: refine ONLY the best-match (highest
  // confidence) preview — one extra pass, not five. This keeps the realism gain
  // on the featured "best natural match" the client shows, while avoiding the
  // multi-pass latency that pushed full wig runs past the timeout. Refine failure
  // keeps the first-pass image.
  if (mode === 'wig' || mode === 'hairsystem') {
    let bestIdx = -1, bestConf = -1;
    recommendations.forEach((r, i) => {
      const c = Number(r.confidence) || 0;
      if (r.previewDataUrl && !r.error && c > bestConf) { bestConf = c; bestIdx = i; }
    });
    if (bestIdx >= 0) {
      // Realism refine polish, THEN the quality gate (assess → stricter retry →
      // re-assess) on the featured best-match the client shows.
      try {
        const refined = await refineHairRealism(geminiKey, recommendations[bestIdx].previewDataUrl);
        if (refined) recommendations[bestIdx] = Object.assign({}, recommendations[bestIdx], { previewDataUrl: refined });
      } catch (e) { /* keep the first-pass best image */ }
      let gatePassed = true;
      try {
        const gate = await realismGate(geminiKey, recommendations[bestIdx].previewDataUrl, base64, mimeType, (styles[bestIdx] && styles[bestIdx].imageEditPrompt) || '');
        recommendations[bestIdx] = Object.assign({}, recommendations[bestIdx], { previewDataUrl: gate.dataUrl });
        gatePassed = gate.passed;
      } catch (e) { /* checker error → don't block */ }
      if (!gatePassed) {
        // The featured best-match still reads as fake after a stricter retry —
        // don't present an unnatural wig result; ask for a better photo.
        return { ok: false, vendorMessage: 'We couldn’t create a natural-looking result. Please try another photo with better lighting (face the camera, hair visible, no hat or sunglasses).', debugCode: 'REALISM_FAILED' };
      }
    }
  }

  // SP-5 RELIABILITY (goal 3 — never a text-only "success"): if EVERY style's
  // image edit failed (all retries exhausted → empty previewDataUrl), the run
  // produced no usable image. Do NOT return ok:true with text-only recs (the
  // old contract let wig "succeed" with zero images). Fail explicitly so the
  // client shows a clear retry message instead of a text-only result.
  const usable = recommendations.filter(r => r.previewDataUrl && !r.error);
  if (!usable.length) {
    console.error('[runStudioGeneration] all image edits failed for mode', mode);
    return { ok: false, vendorMessage: 'Could not generate a preview image. Please try again with a clear, well-lit photo.', debugCode: 'EDIT_ALL_FAILED' };
  }

  return {
    ok: true,
    mode, audience, options, preference, goal,
    analysis: plan.analysis,            // vendor-only; caller must NOT persist
    recommendations,
    provider: 'gemini-2.5-flash-image',
    generationTimeMs: Date.now() - t0,
  };
}

exports.generateStyleStudio = onCall(
  {
    region: 'us-central1',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    cors: true,
  },
  async (request) => {
    await requireMobileBarberVendor(request); // throws HttpsError on non-vendor

    const data = request.data || {};
    const mode = StudioLib.normalizeStudioMode(data.mode);
    const audience = StudioLib.audienceForMode(mode, data.audience);
    const options = StudioLib.normalizeStudioOptions(mode, data.options);
    const preference = StudioLib.normalizeStudioPref(data.preference);
    const goal = StudioLib.normalizeStudioGoal(data.goal);
    const langParam = String(data.lang || 'en').toLowerCase();
    const lang = HAIRCUT_LANG_NAME[langParam] ? langParam : 'en';

    const rawDataUrl = String(data.selfieDataUrl || '');
    if (rawDataUrl.indexOf('data:image/') !== 0) {
      return { ok: false, vendorMessage: 'Missing or invalid selfie image.', debugCode: 'INVALID_INPUT' };
    }
    const match = rawDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return { ok: false, vendorMessage: 'Selfie format not supported (use JPEG/PNG/WebP).', debugCode: 'BAD_MIME' };
    const mimeType = match[1];
    const base64 = match[2];
    if (base64.length > 1_500_000) {
      return { ok: false, vendorMessage: 'Selfie is too large. Please use a smaller photo.', debugCode: 'IMAGE_TOO_LARGE' };
    }

    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) {
      return { ok: false, vendorMessage: 'AI Style Studio is temporarily unavailable.', debugCode: 'NO_GEMINI_KEY' };
    }

    return runStudioGeneration({ mode, options, audience, preference, goal, lang, base64, mimeType, geminiKey });
  }
);

// ────────────────────────────────────────────────────────────────────────
// PUBLIC AI STYLE STUDIO — anon-auth, promo-gated reuse of the studio engine.
// Same Gemini engine as the vendor studio (runStudioGeneration), but open to
// anonymous customers on /style-studio, capped by a launch promo window and a
// per-uid daily counter. Privacy-first: only an integer counter is stored, never
// an image. The vendor callable above is UNCHANGED.
// ────────────────────────────────────────────────────────────────────────

// 5-min cache of the `config/styleStudioPromo` doc (clone of the getAiKey/
// _loadFirestoreAiKeys pattern). Reads via the module-scoped Admin SDK `db`,
// which bypasses the rules `allow read: if false` on this doc.
let _promoCache = null, _promoCacheAt = 0;
async function getStyleStudioPromo() {
  if (_promoCache && (Date.now() - _promoCacheAt) < 5 * 60 * 1000) return _promoCache;
  let promo = {};
  try {
    const snap = await db.collection('config').doc('styleStudioPromo').get();
    if (snap.exists) promo = snap.data() || {};
  } catch (e) { /* fall back to empty (limit resolves to 0) */ }
  _promoCache = promo;
  _promoCacheAt = Date.now();
  return _promoCache;
}

// Require an authenticated guest. Anonymous Firebase Auth is OK (the public page
// signs the visitor in anonymously); only a fully-unauthenticated call is rejected.
function requireAuthedGuest(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Open the page so we can start a free session.');
  }
  return request.auth.uid;
}

// READ-ONLY: resolve today's free-preview limit and how many this uid has used.
// No write — the counter is incremented AFTER a successful generation so a failed
// render does not consume a free preview.
async function checkPublicQuota(uid, isAnonymous) {
  const promo = await getStyleStudioPromo();
  const todayISO = new Date().toISOString().slice(0, 10);
  // GUEST (anonymous) = the 14-day launch promo limit (resolveDailyLimit → 0
  // once the promo ends, which triggers the create-account wall). A logged-in
  // MEMBER is NOT a guest: they get a generous member daily limit and must NEVER
  // be shown "create a free account" — they already have one. Member limit is
  // configurable via config/styleStudioPromo.memberGenerationsPerUser (default 100).
  const guestLimit = StudioLib.resolveDailyLimit(promo, todayISO);
  const memberLimit = (promo && Number(promo.memberGenerationsPerUser) > 0)
    ? Math.floor(promo.memberGenerationsPerUser) : 100;
  const limit = isAnonymous ? guestLimit : memberLimit;
  let used = 0;
  try {
    const snap = await db.collection('styleStudioUsage').doc(uid).collection('days').doc(todayISO).get();
    used = (snap.exists && Number(snap.data().count)) || 0;
  } catch (e) { used = 0; }
  return { allowed: used < limit, limit, used, today: todayISO, isAnonymous: !!isAnonymous };
}

// Transactionally bump the per-uid daily counter (called only on ok:true).
async function incrementPublicUsage(uid, today) {
  const ref = db.collection('styleStudioUsage').doc(uid).collection('days').doc(today);
  await ref.set({
    count: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

exports.generateStyleStudioPublic = onCall(
  {
    region: 'us-central1',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    cors: true,
  },
  async (request) => {
    const uid = requireAuthedGuest(request); // anonymous OK; throws only if unauthenticated
    // Distinguish a GUEST (anonymous session) from a logged-in MEMBER (real
    // account). Members are never subject to the guest promo/create-account wall.
    const signInProvider = request.auth && request.auth.token && request.auth.token.firebase &&
      request.auth.token.firebase.sign_in_provider;
    const isAnonymous = (signInProvider === 'anonymous');

    const data = request.data || {};
    // The public callable allows the flagship 'master' mode (the vendor studio
    // does not). normalizeStudioMode would fall back to 'haircut' for 'master',
    // so accept it explicitly; otherwise normalize to one of the 9 modes.
    const mode = (data.mode === 'master') ? 'master' : StudioLib.normalizeStudioMode(data.mode);
    // Master mode auto-decides everything: pass audience through the plain
    // normalizer (no beard-forcing, which only applies to mode 'beard').
    const audience = (mode === 'master')
      ? StudioLib.normalizeStudioAudience(data.audience)
      : StudioLib.audienceForMode(mode, data.audience);
    const options = StudioLib.normalizeStudioOptions(mode === 'master' ? 'haircut' : mode, data.options);
    const preference = StudioLib.normalizeStudioPref(data.preference);
    const goal = StudioLib.normalizeStudioGoal(data.goal);
    const langParam = String(data.lang || 'en').toLowerCase();
    const lang = HAIRCUT_LANG_NAME[langParam] ? langParam : 'en';

    const rawDataUrl = String(data.selfieDataUrl || '');
    if (rawDataUrl.indexOf('data:image/') !== 0) {
      return { ok: false, vendorMessage: 'Missing or invalid selfie image.', debugCode: 'INVALID_INPUT' };
    }
    const match = rawDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return { ok: false, vendorMessage: 'Selfie format not supported (use JPEG/PNG/WebP).', debugCode: 'BAD_MIME' };
    const mimeType = match[1];
    const base64 = match[2];
    if (base64.length > 1_500_000) {
      return { ok: false, vendorMessage: 'Selfie is too large. Please use a smaller photo.', debugCode: 'IMAGE_TOO_LARGE' };
    }

    // READ-ONLY quota check first (no write yet — count only after a success).
    const q = await checkPublicQuota(uid, isAnonymous);
    // SP-8: quota METADATA for the conversion/membership UI (NOT generation logic).
    // Lets the client show "N free previews left today" + member status.
    const quotaMeta = function (usedAfter) {
      return { used: usedAfter, limit: q.limit, remaining: Math.max(0, q.limit - usedAfter), isAnonymous: isAnonymous };
    };
    if (!q.allowed) {
      if (isAnonymous) {
        // Guest over the free-preview limit → the create-account wall.
        return {
          ok: false, code: 'LIMIT_REACHED', requireLogin: true,
          vendorMessage: 'You have used your free previews. Create a free account to keep going.',
          limit: q.limit, quota: quotaMeta(q.used),
        };
      }
      // Logged-in MEMBER over their generous daily limit → a "try again
      // tomorrow" message, NOT a create-account prompt (they already have one).
      return {
        ok: false, code: 'DAILY_LIMIT', requireLogin: false,
        vendorMessage: 'You have reached today\'s limit. Please try again tomorrow.',
        limit: q.limit, quota: quotaMeta(q.used),
      };
    }

    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) {
      return { ok: false, vendorMessage: 'AI Style Studio is temporarily unavailable.', debugCode: 'NO_GEMINI_KEY' };
    }

    const result = await runStudioGeneration({ mode, options, audience, preference, goal, lang, base64, mimeType, geminiKey });
    if (result && result.ok) {
      // Count this success against the daily quota. Best-effort: never fail the
      // response if the counter write hiccups.
      try { await incrementPublicUsage(uid, q.today); } catch (e) { /* ignore */ }
      result.quota = quotaMeta(q.used + 1); // metadata only — generation unchanged
    }
    return result;
  }
);

// ── Phase 13: Automatic Driver Dispatch ──────────────────────────────────────
//
// Flow:
//   1. workflowEngine.js writes dispatchQueue/{bookingId}_0 when a ride is created.
//   2. onDispatchQueue fires, selects best eligible driver, creates bookingOffers/{bookingId}.
//   3. driver-admin.html listens to bookingOffers; driver accepts/rejects via callables.
//   4. acceptOffer (onCall): Firestore transaction — assigns driver to booking.
//   5. rejectOffer (onCall): marks offer rejected, queues next dispatch attempt.
//   6. expireRideOffers (scheduler, every 2 min): finds stale pending offers, triggers retry.
//
// Race-condition safety: acceptOffer uses a transaction that verifies
//   bookingOffers.status === 'pending' AND bookingOffers.driverId === caller
//   AND bookings.status === 'offered_to_driver' before committing.
//
// Idempotency: dispatchQueue docs use {bookingId}_{timestamp} IDs — each
//   rejection/expiry creates a NEW doc, so onDocumentCreated fires exactly once per attempt.
//   Max 5 attempts before falling back to awaiting_driver (manual admin).

// ── onRideBookingCreated — server-side dispatch trigger ───────────────────────
// Fires the moment any booking document is created. If it's a ride booking in a
// dispatchable state, creates the dispatchQueue doc here on the server — no
// client-side auth or version issues can prevent it.
//
// This is the authoritative trigger. Client-side dispatchQueue writes in
// workflowEngine.js / ride-intake.js are faster-path attempts but not required.
// Uses doc.create() so if the client already wrote the doc, this is a no-op
// (ALREADY_EXISTS) and onDispatchQueue still fires from the client's write.
const RIDE_SERVICE_TYPES = new Set([
  'pickup', 'dropoff', 'private_ride',         // workflowEngine / current ride-intake
  'airport_pickup', 'airport_dropoff',          // legacy ride-intake (old cached clients)
]);

exports.onRideBookingCreated = onDocumentCreated(
  {
    document:       'bookings/{bookingId}',
    region:         'us-central1',
    timeoutSeconds: 30,
    retry:          false,
  },
  async (event) => {
    const bookingId = event.params.bookingId;
    const booking   = event.data.data();
    const log = (msg) => console.log(`[onRideBookingCreated][${bookingId}] ${msg}`);

    // Skip non-ride bookings (nail, hair, food, etc.)
    if (!RIDE_SERVICE_TYPES.has(booking.serviceType)) {
      log(`skipped — not a ride (serviceType=${booking.serviceType})`);
      return;
    }

    const TERMINAL = new Set(['assigned','driver_confirmed','on_the_way','arrived','in_progress','completed','cancelled']);
    if (TERMINAL.has(booking.status)) {
      log(`skipped — already terminal (status=${booking.status})`);
      return;
    }

    log(`ride booking created — serviceType=${booking.serviceType} status=${booking.status} airport=${booking.airport||'—'}`);

    const queueRef = db.collection('dispatchQueue').doc(bookingId + '_0');
    try {
      await queueRef.create({
        bookingId,
        skipDriverIds: [],
        attempt:       1,
        status:        'pending',
        source:        'server_trigger',
        createdAt:     admin.firestore.FieldValue.serverTimestamp(),
      });
      log(`dispatchQueue/${bookingId}_0 created by server trigger`);
    } catch (e) {
      // ALREADY_EXISTS means client wrote it first — fine, onDispatchQueue will fire from that write
      if (e.code === 6 || (e.message && e.message.toLowerCase().includes('already'))) {
        log(`dispatchQueue/${bookingId}_0 already exists (client wrote first) — OK`);
      } else {
        log(`ERROR: ${e.message}`);
        throw e;
      }
    }
  }
);

// ── Shared helper: query eligible drivers ─────────────────────────────────────
// Logs each filter stage for debugging. Falls back to any active+approved driver
// if region filtering yields 0 (prevents silent no-dispatch on region mismatch).
async function _queryEligibleDrivers(serviceType, airport, skipDriverIds) {
  const regionId = airport ? (AIRPORT_REGION_CF[(airport || '').toUpperCase()] || null) : null;
  const log = (msg) => console.log(`[_queryEligibleDrivers] ${msg}`);

  log(`serviceType=${serviceType} airport=${airport} regionId=${regionId} skip=[${(skipDriverIds||[]).join(',')}]`);

  // Step 1 — fetch ALL active drivers (broaden query; filter compliance in-memory for logging)
  const allSnap = await db.collection('drivers')
    .where('adminStatus', '==', 'active')
    .get();
  log(`Stage 1 — adminStatus=active: ${allSnap.size} driver(s)`);

  const skip = new Set(skipDriverIds || []);

  // Step 2 — compliance filter
  const afterCompliance = allSnap.docs.filter(d => {
    const cs = d.data().complianceStatus;
    const ok = cs === 'approved';
    if (!ok) log(`  SKIP ${d.id} — complianceStatus=${cs}`);
    return ok;
  });
  log(`Stage 2 — complianceStatus=approved: ${afterCompliance.length} driver(s)`);

  // Step 3 — skip list
  const afterSkip = afterCompliance.filter(d => {
    if (skip.has(d.id)) { log(`  SKIP ${d.id} — in skipDriverIds`); return false; }
    return true;
  });
  log(`Stage 3 — after skip list: ${afterSkip.length} driver(s)`);

  if (afterSkip.length === 0) {
    log('No active+approved drivers at all — cannot dispatch');
    return [];
  }

  // Step 4 — region filter (airport rides only)
  if (regionId) {
    const afterRegion = afterSkip.filter(d => {
      const regions = d.data().regions || [];
      const ok = regions.includes(regionId);
      log(`  Driver ${d.id} regions=${JSON.stringify(regions)} — ${ok ? 'PASS' : 'SKIP (region mismatch)'}`);
      return ok;
    });
    log(`Stage 4 — region=${regionId}: ${afterRegion.length} driver(s)`);

    if (afterRegion.length > 0) {
      return afterRegion.map(d => Object.assign({ id: d.id }, d.data()));
    }

    // Fallback: region filter yielded 0 but active+approved drivers exist → dispatch anyway
    log(`FALLBACK — region filter empty; dispatching to any active+approved driver (${afterSkip.length} available)`);
    return afterSkip.map(d => Object.assign({ id: d.id }, d.data()));
  }

  // No region constraint (private_ride) — use all after skip
  log(`Stage 4 — no region constraint (serviceType=${serviceType}): ${afterSkip.length} driver(s) eligible`);
  return afterSkip.map(d => Object.assign({ id: d.id }, d.data()));
}

// ── onMobileBarberBookingCreated — server-side OWNER-WIDE conflict guard ──────
//
// The public booking flow signs in anonymously and therefore CANNOT run the
// client-side BookingGuard (its transaction reads owner-scoped bookings, which
// Firestore rules deny for anonymous customers). So customer barber bookings are
// written with a plain create. This Cloud Function restores the owner-wide
// cross-vendor / cross-service conflict check on the server (Admin SDK bypasses
// rules): when an owner is the SAME person across multiple vendors/services
// (barber + ride + tour), a new barber booking that overlaps any of the owner's
// other bookings is elevated to `vendor_review` so the human resolves it — it is
// NEVER auto-deleted. Mirrors the client guard's service buffers + blocking
// statuses; checks TIME OVERLAP only (no distance / working-hours elevation).
//
// Idempotent: fires once on create; the elevation is an update (no re-fire).
const MB_SVC_DUR    = { barber: 45, ride: 90, tour: 480, airport: 90, pickup: 90, dropoff: 90, private_ride: 120 };
const MB_SVC_BUFFER = { barber: 20, ride: 15, tour: 30 };
const MB_NON_BLOCKING = new Set(['cancelled', 'rejected', 'declined', 'completed', 'expired', 'no_show']);
// Default service radius (miles) for the route-aware confirm gate. Beyond this the
// guard routes a booking to vendor_review rather than auto-confirming.
const MB_SERVICE_RADIUS_DEFAULT = 30;

function mbNormSvc(s) {
  s = String(s || '').toLowerCase().trim();
  if (s === 'airport' || s === 'pickup' || s === 'dropoff' || s === 'private_ride') return 'ride';
  if (s === 'travel') return 'tour';
  return s;
}
function mbParseDT(dateStr, timeStr) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  var t = /^(\d{1,2}):(\d{2})$/.exec(String(timeStr || ''));
  if (!m || !t) return null;
  // UTC keeps the comparison timezone-consistent (conflict detection is relative).
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
}
function mbBookingWindow(row, collection) {
  var svc = mbNormSvc(row.serviceType || row.rawServiceType ||
    (collection === 'travel_bookings' ? 'tour' : (collection === 'mobileBarberBookings' ? 'barber' : 'ride')));
  if (svc === 'tour') {
    var sd = row.startDate || row.requestedDate || row.date;
    var ed = row.endDate || sd;
    var ts = mbParseDT(sd, '00:00');
    if (ts == null) return null;
    var te = mbParseDT(ed, '23:59');
    return { start: ts, end: (te == null ? ts + 86400000 : te), svc: svc };
  }
  var start = mbParseDT(row.requestedDate || row.date, row.startTime || row.pickupTime || row.scheduledTime || row.time);
  if (start == null) return null;
  var end = mbParseDT(row.requestedDate || row.date, row.endTime);
  if (end == null) end = start + (MB_SVC_DUR[svc] || 90) * 60000;
  return { start: start, end: end + (MB_SVC_BUFFER[svc] || 15) * 60000, svc: svc };
}
function mbOverlaps(a, b) { return a && b && a.start < b.end && b.start < a.end; }
// ── Smart duplicate / spam intent helpers ────────────────────────────────────
function mbLower(v) { return String(v == null ? '' : v).toLowerCase().trim(); }
// US 10-digit normalization (strip non-digits, drop a leading country 1).
function mbNormPhone(v) {
  var d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return d.length >= 10 ? d.slice(-10) : d;
}
// Same customer = same normalized phone OR same email (the strong, low-false-positive
// signals). Name alone is too weak; address is only a soft risk signal (below).
function mbSameCustomer(reqId, row) {
  var op = mbNormPhone(row.customerPhone || row.phone || row.customerPhoneNumber);
  if (reqId.phone && op && reqId.phone === op) return true;
  var oe = mbLower(row.customerEmail || row.email);
  if (reqId.email && oe && reqId.email === oe) return true;
  return false;
}

// ── Web Push booking alert → the vendor's installed PWA device(s) ────────────
// Fires on every new mobile-barber booking. Sends a Web Push to each registered
// subscription for that vendor (stored under mobileBarberVendors/{id}/pushSubscriptions
// by the portal PWA). Dead subscriptions are pruned. Uses the Admin SDK so it
// bypasses Firestore rules; VAPID private key comes from a Functions secret.
exports.sendMobileBarberBookingPush = onDocumentCreated(
  {
    document:       'mobileBarberBookings/{bookingId}',
    region:         'us-central1',
    secrets:        [VAPID_PRIVATE_KEY],
    timeoutSeconds: 60,
    retry:          false,
  },
  async (event) => {
    const bookingId = event.params.bookingId;
    const booking = event.data && event.data.data();
    if (!booking) return;
    const vendorId = String(booking.vendorId || '').trim();
    if (!vendorId) return;

    let webpush;
    try { webpush = require('web-push'); } catch (e) { console.warn('[mb-push] web-push unavailable'); return; }
    const priv = VAPID_PRIVATE_KEY.value();
    if (!priv) { console.warn('[mb-push] VAPID_PRIVATE_KEY not set — skipping'); return; }
    webpush.setVapidDetails('mailto:dulichcali21@gmail.com', VAPID_PUBLIC_KEY, priv);

    const db = admin.firestore();
    const subsSnap = await db.collection('mobileBarberVendors').doc(vendorId)
      .collection('pushSubscriptions').get();
    if (subsSnap.empty) { console.log(`[mb-push][${bookingId}] no subscriptions for ${vendorId}`); return; }

    // Count the vendor's actionable (un-actioned) bookings so the push can badge the
    // home-screen app icon with the pending count via the service worker (Badging API).
    let badgeCount = 0;
    try {
      const ACTIONABLE = new Set(['pending_confirmation', 'pending_barber_confirmation', 'vendor_review']);
      const pend = await db.collection('mobileBarberBookings').where('vendorId', '==', vendorId).limit(250).get();
      pend.forEach((d) => { if (ACTIONABLE.has(String((d.data() || {}).status || '').toLowerCase())) badgeCount++; });
    } catch (e) { badgeCount = 0; }

    const parts = [booking.customerName, booking.serviceName, booking.requestedDate, booking.startTime]
      .filter(Boolean).join(' · ');
    const payload = JSON.stringify({
      title: 'New booking request',
      body: parts || 'Tap to review the booking in your portal.',
      url: '/mobile-barber/dashboard.html',
      tag: 'mb-booking-' + bookingId,
      badgeCount: badgeCount
    });

    await Promise.all(subsSnap.docs.map(async (doc) => {
      const s = doc.data() || {};
      if (!s.endpoint || !s.keys) return;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 3600 });
      } catch (err) {
        const code = err && err.statusCode;
        if (code === 404 || code === 410) {
          await doc.ref.delete().catch(() => {});   // expired/unsubscribed — prune
          console.log(`[mb-push][${bookingId}] pruned dead subscription ${doc.id}`);
        } else {
          console.warn(`[mb-push][${bookingId}] send failed (${code}):`, err && err.message);
        }
      }
    }));
    console.log(`[mb-push][${bookingId}] dispatched to ${subsSnap.size} subscription(s) for ${vendorId}`);
  }
);

// ── Web Push ride offer alert → the selected driver's device(s) ─────────────
// Best-effort background push for newly-created bookingOffers. Foreground
// PortalNotify listeners remain primary; this does not alter the offer window
// or accept/decline lifecycle. Dead subscriptions are pruned.
exports.sendDriverRidePush = onDocumentCreated(
  {
    document:       'bookingOffers/{bookingId}',
    region:         'us-central1',
    secrets:        [VAPID_PRIVATE_KEY],
    timeoutSeconds: 60,
    retry:          false,
  },
  async (event) => {
    const bookingId = event.params.bookingId;
    try {
      const offer = event.data && event.data.data();
      if (!offer) return;
      const driverId = String(offer.driverId || '').trim();
      if (!driverId) return;

      let webpush;
      try { webpush = require('web-push'); } catch (e) { console.warn('[driver-push] web-push unavailable'); return; }
      const priv = VAPID_PRIVATE_KEY.value();
      if (!priv) { console.warn('[driver-push] VAPID_PRIVATE_KEY not set — skipping'); return; }
      webpush.setVapidDetails('mailto:dulichcali21@gmail.com', VAPID_PUBLIC_KEY, priv);

      const db = admin.firestore();
      const subsSnap = await db.collection('drivers').doc(driverId).collection('pushSubscriptions').get();
      if (subsSnap.empty) { console.log(`[driver-push][${bookingId}] no subscriptions for ${driverId}`); return; }

      let booking = {};
      const sourceBookingId = String(offer.bookingId || bookingId || '').trim();
      if (sourceBookingId) {
        try {
          const bookingSnap = await db.collection('bookings').doc(sourceBookingId).get();
          booking = bookingSnap.exists ? (bookingSnap.data() || {}) : {};
        } catch (e) { booking = {}; }
      }

      let badgeCount = 0;
      try {
        const pendingOffers = await db.collection('bookingOffers')
          .where('driverId', '==', driverId)
          .where('status', '==', 'pending')
          .limit(50)
          .get();
        const activeRides = await db.collection('bookings')
          .where('driver.driverId', '==', driverId)
          .where('status', 'in', ['assigned', 'driver_confirmed'])
          .limit(50)
          .get();
        badgeCount = pendingOffers.size + activeRides.size;
      } catch (e) { badgeCount = 0; }

      const service = offer.serviceType || offer.serviceLabel || booking.serviceType || booking.serviceLabel || 'Ride';
      const airport = offer.airport || booking.airport || '';
      const pickupRaw = offer.pickupTime || offer.datetime || offer.rideTime || offer.arrivalTime || offer.departureTime ||
        booking.pickupTime || booking.datetime || booking.rideTime || booking.arrivalTime || booking.departureTime || '';
      const pickupDate = offer.pickupDate || offer.rideDate || offer.arrivalDate || offer.departureDate ||
        booking.pickupDate || booking.rideDate || booking.arrivalDate || booking.departureDate || '';
      const pickup = [pickupDate, pickupRaw].filter(Boolean).join(' ');
      const body = [service, airport, pickup].filter(Boolean).join(' · ') || 'Tap to review the offer in your driver dashboard.';
      const payload = JSON.stringify({
        title: 'New ride offer',
        body: body,
        url: '/driver/dashboard.html',
        tag: 'dlc-ride-offer',
        audience: 'driver',
        badgeCount: badgeCount
      });

      await Promise.all(subsSnap.docs.map(async (doc) => {
        const s = doc.data() || {};
        if (!s.endpoint || !s.keys) return;
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 3600 });
        } catch (err) {
          const code = err && err.statusCode;
          if (code === 404 || code === 410) {
            await doc.ref.delete().catch(() => {});
            console.log(`[driver-push][${bookingId}] pruned dead subscription ${doc.id}`);
          } else {
            console.warn(`[driver-push][${bookingId}] send failed (${code}):`, err && err.message);
          }
        }
      }));
      console.log(`[driver-push][${bookingId}] dispatched to ${subsSnap.size} subscription(s) for ${driverId}`);
    } catch (err) {
      console.warn(`[driver-push][${bookingId}] skipped after error:`, err && err.message);
    }
  }
);

function mbNormLang(lang) {
  const l = String(lang || '').toLowerCase().slice(0, 2);
  return (l === 'vi' || l === 'es') ? l : 'en';
}
// Localized customer notification copy (RULE #2 — no hardcoded single-language user text).
// Picked by the customer's preferredLanguage; English is the default/fallback.
function mbCustomerNotifStrings(lang) {
  const T = {
    en: {
      confirmedTitle: 'Booking confirmed', confirmedBody: 'Your haircut appointment is confirmed.',
      infoTitle: 'More information needed', infoBody: 'Your barber needs more information about your appointment.',
      reschedTitle: 'Appointment changed', reschedBody: 'Your appointment time has changed.',
      cancelTitle: 'Appointment cancelled', cancelBody: 'Your haircut appointment was cancelled.',
      rejectTitle: 'Appointment not accepted', rejectBody: 'Your barber could not accept this appointment.',
      completeTitle: 'Haircut completed', completeBody: 'Your haircut is complete. We can remind you when it may be time to book again.',
      haircutTitle: 'Time for your next haircut?', haircutBody: 'It may be time for your next haircut. Would you like to book again?',
      apptTitle: 'Appointment tomorrow', apptBody: 'Reminder: your haircut is scheduled for {when}.',
    },
    vi: {
      confirmedTitle: 'Đã xác nhận lịch', confirmedBody: 'Lịch cắt tóc của bạn đã được xác nhận.',
      infoTitle: 'Cần thêm thông tin', infoBody: 'Thợ cần thêm thông tin về lịch hẹn của bạn.',
      reschedTitle: 'Lịch hẹn đã đổi', reschedBody: 'Giờ hẹn của bạn đã thay đổi.',
      cancelTitle: 'Lịch hẹn đã huỷ', cancelBody: 'Lịch cắt tóc của bạn đã bị huỷ.',
      rejectTitle: 'Lịch hẹn không được nhận', rejectBody: 'Thợ không thể nhận lịch hẹn này.',
      completeTitle: 'Đã cắt xong', completeBody: 'Bạn đã cắt tóc xong. Chúng tôi có thể nhắc khi đến lúc đặt lại.',
      haircutTitle: 'Đến lúc cắt tóc chưa?', haircutBody: 'Có thể đã đến lúc cắt tóc tiếp theo. Bạn muốn đặt lại không?',
      apptTitle: 'Lịch hẹn ngày mai', apptBody: 'Nhắc nhở: lịch cắt tóc của bạn vào {when}.',
    },
    es: {
      confirmedTitle: 'Reserva confirmada', confirmedBody: 'Su cita de corte está confirmada.',
      infoTitle: 'Se necesita más información', infoBody: 'Su barbero necesita más información sobre su cita.',
      reschedTitle: 'Cita modificada', reschedBody: 'La hora de su cita ha cambiado.',
      cancelTitle: 'Cita cancelada', cancelBody: 'Su cita de corte fue cancelada.',
      rejectTitle: 'Cita no aceptada', rejectBody: 'Su barbero no pudo aceptar esta cita.',
      completeTitle: 'Corte completado', completeBody: 'Su corte está completo. Podemos recordarle cuando sea hora de reservar de nuevo.',
      haircutTitle: '¿Hora de su próximo corte?', haircutBody: 'Puede ser hora de su próximo corte. ¿Desea reservar de nuevo?',
      apptTitle: 'Cita mañana', apptBody: 'Recordatorio: su corte está programado para {when}.',
    },
  };
  return T[mbNormLang(lang)] || T.en;
}
function mbCustomerNotificationCopy(status, lang) {
  const s = String(status || '').toLowerCase();
  const S = mbCustomerNotifStrings(lang);
  if (s === 'confirmed') return { type: 'booking_confirmed', title: S.confirmedTitle, body: S.confirmedBody };
  if (s === 'vendor_review' || s === 'needs_info' || s === 'more_info_needed') return { type: 'booking_needs_info', title: S.infoTitle, body: S.infoBody };
  if (s === 'rescheduled') return { type: 'booking_rescheduled', title: S.reschedTitle, body: S.reschedBody };
  if (s === 'cancelled') return { type: 'booking_cancelled', title: S.cancelTitle, body: S.cancelBody };
  if (s === 'rejected' || s === 'declined') return { type: 'booking_rejected', title: S.rejectTitle, body: S.rejectBody };
  if (s === 'completed') return { type: 'booking_completed', title: S.completeTitle, body: S.completeBody };
  return null;
}
// Map a notification type → the customer toggle key that controls it (see
// NOTIF_TYPE_KEYS in mobile-barber-customer.js). Empty string = always send.
function mbCustomerNotifPrefKey(type) {
  const t = String(type || '');
  if (t === 'booking_confirmed') return 'confirmations';
  if (t === 'booking_rescheduled') return 'reschedules';
  if (t === 'future_haircut_reminder') return 'haircutReminders';
  if (t === 'appointment_reminder') return 'appointmentReminders';
  if (t.indexOf('booking_') === 0) return 'bookingUpdates';
  return '';
}
function mbNotifTypeEnabled(prefs, prefKey) {
  if (!prefKey) return true;
  return !prefs || prefs[prefKey] !== false; // default ON
}
// One read of the customer profile → both the toggle prefs and preferred language.
async function mbGetCustomerNotifContext(customerId) {
  try {
    const snap = await db.collection('mobileBarberCustomers').doc(customerId).get();
    const data = (snap.exists && snap.data()) || {};
    return { prefs: data.notificationPreferences || {}, lang: mbNormLang(data.preferredLanguage) };
  } catch (e) { return { prefs: {}, lang: 'en' }; }
}

async function mbWriteCustomerNotification(bookingId, booking, copy) {
  const customerId = String(booking.customerId || booking.customerUid || '').trim();
  if (!customerId || !copy) return;
  const id = `${bookingId}_${copy.type}`;
  await db.collection('customerNotifications').doc(id).set({
    id,
    customerId,
    bookingId,
    vendorId: String(booking.vendorId || ''),
    ownerId: String(booking.ownerId || ''),
    type: copy.type,
    title: copy.title,
    body: copy.body,
    status: String(booking.status || ''),
    read: false,
    openUrl: `/mobile-barber?panel=notifications&bookingId=${encodeURIComponent(bookingId)}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function mbScheduleHaircutReminder(bookingId, booking) {
  const customerId = String(booking.customerId || booking.customerUid || '').trim();
  if (!customerId) return;
  const customerRef = db.collection('mobileBarberCustomers').doc(customerId);
  const prefRef = db.collection('customerReminderPreferences').doc(customerId);
  const prefSnap = await prefRef.get().catch(() => null);
  const customerSnap = await customerRef.get().catch(() => null);
  const pref = prefSnap && prefSnap.exists ? (prefSnap.data() || {}) : {};
  const customer = customerSnap && customerSnap.exists ? (customerSnap.data() || {}) : {};
  const weeks = Number(pref.reminderPreferenceWeeks || customer.reminderPreferenceWeeks || 4);
  const enabled = pref.enabled !== false && weeks > 0;
  const lastDate = String(booking.requestedDate || '').trim() || new Date().toISOString().slice(0, 10);
  const next = new Date(`${lastDate}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + (enabled ? weeks * 7 : 0));
  const payload = {
    id: customerId,
    customerId,
    reminderPreferenceWeeks: weeks,
    enabled,
    lastHaircutDate: lastDate,
    nextReminderDate: enabled ? next.toISOString().slice(0, 10) : '',
    preferredBarber: String(booking.assignedBarberId || booking.vendorId || ''),
    lastService: String(booking.serviceName || ''),
    lastBookingId: bookingId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await prefRef.set(Object.assign({ createdAt: admin.firestore.FieldValue.serverTimestamp() }, payload), { merge: true });
  await customerRef.set({
    lastHaircutDate: payload.lastHaircutDate,
    nextReminderDate: payload.nextReminderDate,
    preferredBarber: payload.preferredBarber,
    lastService: payload.lastService,
    lastBookingId: bookingId,
    reminderPreferenceWeeks: weeks,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

// ── Customer profile memory: upsert the profile from a booking, on EVERY booking
// write (create + status change), for BOTH logged-in (uid) and anonymous (phone)
// customers. Admin SDK bypasses rules — the only write path that can serve the
// anonymous-by-phone case. Stores ONLY text style references (never AI hairstyle
// images / selfies — per product rule). Also maintains a vendorAccess marker so the
// Firestore read rule can scope vendor reads to customers they actually booked.
async function mbUpsertCustomerProfileFromBooking(booking, bookingId) {
  booking = booking || {};
  const uid = String(booking.customerUid || booking.customerId || '').trim();
  const phone = mbNormPhone(booking.customerPhone || booking.phone || booking.normalizedPhone || '');
  if (!uid && !phone) return; // nothing to key on
  const docId = uid || ('phone_' + phone);
  const vendorId = String(booking.vendorId || '').trim();
  const ref = db.collection('mobileBarberCustomers').doc(docId);

  let existing = {};
  try { const s = await ref.get(); existing = (s.exists && s.data()) || {}; } catch (e) {}

  const trimv = (x) => String(x == null ? '' : x).trim();
  const set = {};
  const put = (k, v) => { const t = trimv(v); if (t) set[k] = t; };
  put('customerName', booking.customerName || booking.name);
  put('name', booking.customerName || booking.name);
  if (phone) { set.phone = booking.customerPhone || booking.phone || phone; set.normalizedPhone = phone; set.customerPhone = booking.customerPhone || phone; set.customerPhoneNormalized = phone; }
  put('email', booking.customerEmail || booking.email);
  if (uid) { set.customerId = uid; set.customerUid = uid; }
  set.id = docId;
  if (vendorId) set.vendorId = vendorId;
  put('preferredBarber', booking.assignedBarberId || booking.preferredBarber || vendorId);
  put('preferredAddress', booking.address);
  put('address', booking.address);
  put('city', booking.city);
  put('zip', booking.zip);
  put('lastServiceId', booking.serviceId || booking.lastServiceId);
  put('lastServiceName', booking.serviceName || booking.lastServiceName);
  if (bookingId) set.lastBookingId = bookingId;
  put('paymentMethod', booking.paymentMethod);
  put('paymentPreference', booking.paymentMethod);
  put('confirmationPreference', booking.confirmationPreference);
  // Language: NEVER overwrite a value the customer set — only fill when absent.
  if (!trimv(existing.preferredLanguage)) {
    const lng = mbNormLang(booking.preferredLanguage || (booking.customerProfileSnapshot && booking.customerProfileSnapshot.preferredLanguage) || booking.lang);
    if (lng) set.preferredLanguage = lng;
  }

  // Style memory — TEXT references only (no images/selfies).
  const style = Object.assign({}, existing.haircutPreferences || {});
  const styleMap = {
    styleId: booking.selectedAiStyleId, styleName: booking.selectedAiStyleName,
    styleDescription: booking.selectedAiStyleDescription, color: booking.selectedColorRecommendation,
    highlight: booking.selectedHighlightRecommendation, texture: booking.selectedTexturePreference,
    stylePreference: booking.stylePreference, barberNotes: booking.selectedHaircutBarberNotes,
  };
  let styleChanged = false;
  Object.keys(styleMap).forEach((k) => { const v = trimv(styleMap[k]); if (v) { style[k] = v; styleChanged = true; } });
  if (styleChanged) set.haircutPreferences = style;

  // Bounded booking history (last 20, de-duped by bookingId).
  const history = Array.isArray(existing.bookingHistory) ? existing.bookingHistory.slice() : [];
  if (bookingId) {
    const entry = {
      bookingId,
      serviceId: trimv(booking.serviceId || booking.lastServiceId),
      serviceName: trimv(booking.serviceName || booking.lastServiceName),
      requestedDate: trimv(booking.requestedDate),
      startTime: trimv(booking.startTime),
      status: trimv(booking.status),
      vendorId,
      price: Number(booking.totalPrice || booking.amountDue || 0) || 0,
    };
    const idx = history.findIndex((h) => h && h.bookingId === bookingId);
    if (idx >= 0) history[idx] = entry; else history.push(entry);
    set.bookingHistory = history.slice(-20);
  }

  set.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  if (!existing || !Object.keys(existing).length) set.createdAt = admin.firestore.FieldValue.serverTimestamp();

  await ref.set(set, { merge: true });

  // vendorAccess marker → lets the read rule scope vendor reads to assigned customers.
  if (vendorId) {
    await ref.collection('vendorAccess').doc(vendorId).set({
      vendorId, lastBookingId: bookingId || '', updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }
}

exports.onMobileBarberCustomerBookingStatus = onDocumentWritten(
  {
    document: 'mobileBarberBookings/{bookingId}',
    region: 'us-central1',
    timeoutSeconds: 60,
    retry: false,
  },
  async (event) => {
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    if (!after) return;
    // Save/refresh the customer profile memory after EVERY booking write (create +
    // any update), before the status-change short-circuit so it also fires on create.
    try { await mbUpsertCustomerProfileFromBooking(after, event.params.bookingId); }
    catch (e) { console.warn('[mb-customer-profile] upsert failed', e && e.message); }
    const prevStatus = before ? String(before.status || '').toLowerCase() : '';
    const nextStatus = String(after.status || '').toLowerCase();
    if (!nextStatus || prevStatus === nextStatus) return;
    const customerId = String(after.customerId || after.customerUid || '').trim();
    if (customerId) {
      const ctx = await mbGetCustomerNotifContext(customerId);
      const copy = mbCustomerNotificationCopy(nextStatus, ctx.lang);
      // Respect the customer's per-type notification preferences (default ON).
      if (copy && mbNotifTypeEnabled(ctx.prefs, mbCustomerNotifPrefKey(copy.type))) {
        await mbWriteCustomerNotification(event.params.bookingId, after, copy);
      } else if (copy) {
        console.log(`[mb-customer-notif] suppressed ${copy.type} for ${customerId} (toggle off)`);
      }
    }
    if (nextStatus === 'completed') await mbScheduleHaircutReminder(event.params.bookingId, after);
  }
);

exports.sendMobileBarberCustomerPush = onDocumentCreated(
  {
    document: 'customerNotifications/{notificationId}',
    region: 'us-central1',
    secrets: [VAPID_PRIVATE_KEY],
    timeoutSeconds: 60,
    retry: false,
  },
  async (event) => {
    const notification = event.data && event.data.data();
    if (!notification) return;
    const customerId = String(notification.customerId || '').trim();
    if (!customerId) return;
    let webpush;
    try { webpush = require('web-push'); } catch (e) { console.warn('[mb-customer-push] web-push unavailable'); return; }
    const priv = VAPID_PRIVATE_KEY.value();
    if (!priv) { console.warn('[mb-customer-push] VAPID_PRIVATE_KEY not set — skipping'); return; }
    webpush.setVapidDetails('mailto:dulichcali21@gmail.com', VAPID_PUBLIC_KEY, priv);
    const subsSnap = await db.collection('mobileBarberCustomers').doc(customerId).collection('pushSubscriptions').get();
    if (subsSnap.empty) return;
    let badgeCount = 0;
    try {
      const unread = await db.collection('customerNotifications').where('customerId', '==', customerId).where('read', '==', false).limit(100).get();
      badgeCount = unread.size;
    } catch (e) {}
    const payload = JSON.stringify({
      audience: 'customer',
      title: String(notification.title || 'Mobile Barber update'),
      body: String(notification.body || 'Tap to review your booking update.'),
      url: String(notification.openUrl || '/mobile-barber?panel=notifications'),
      tag: 'mb-customer-' + event.params.notificationId,
      badgeCount,
    });
    await Promise.all(subsSnap.docs.map(async (docSnap) => {
      const s = docSnap.data() || {};
      if (!s.endpoint || !s.keys) return;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 3600 });
      } catch (err) {
        const code = err && err.statusCode;
        if (code === 404 || code === 410) await docSnap.ref.delete().catch(() => {});
      }
    }));
  }
);

exports.checkMobileBarberCustomerReminders = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'America/Los_Angeles',
    region: 'us-central1',
    retryCount: 0,
  },
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = (() => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();

    // ── Haircut "time to book again" reminders (interval-based) ──
    const snap = await db.collection('customerReminderPreferences')
      .where('enabled', '==', true)
      .where('nextReminderDate', '<=', today)
      .limit(100)
      .get();
    await Promise.all(snap.docs.map(async (docSnap) => {
      const pref = docSnap.data() || {};
      const customerId = String(pref.customerId || docSnap.id || '').trim();
      if (!customerId) return;
      const ctx = await mbGetCustomerNotifContext(customerId);
      const weeks = Number(pref.reminderPreferenceWeeks || 4);
      const next = new Date(`${today}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + Math.max(1, weeks) * 7);
      // Always advance the schedule so we don't re-fire daily, but only write the
      // notification if the customer still has haircut reminders enabled.
      await docSnap.ref.set({
        nextReminderDate: next.toISOString().slice(0, 10),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      if (!mbNotifTypeEnabled(ctx.prefs, 'haircutReminders')) {
        console.log(`[mb-customer-reminder] haircut reminder suppressed for ${customerId} (toggle off)`);
        return;
      }
      const S = mbCustomerNotifStrings(ctx.lang);
      const id = `${customerId}_haircut_reminder_${today}`;
      await db.collection('customerNotifications').doc(id).set({
        id,
        customerId,
        bookingId: String(pref.lastBookingId || ''),
        vendorId: String(pref.preferredBarber || ''),
        ownerId: '',
        type: 'future_haircut_reminder',
        title: S.haircutTitle,
        body: S.haircutBody,
        status: 'reminder_due',
        read: false,
        openUrl: '/mobile-barber?panel=notifications&reminder=haircut',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }));

    // ── Appointment reminders (day before a still-active appointment) ──
    const TERMINAL = ['cancelled', 'canceled', 'declined', 'rejected', 'completed', 'no_show', 'expired'];
    try {
      const apptSnap = await db.collection('mobileBarberBookings')
        .where('requestedDate', '==', tomorrow)
        .limit(300)
        .get();
      await Promise.all(apptSnap.docs.map(async (d) => {
        const bk = d.data() || {};
        const customerId = String(bk.customerId || bk.customerUid || '').trim();
        if (!customerId) return; // anonymous bookings get no customer reminder
        if (TERMINAL.indexOf(String(bk.status || '').toLowerCase()) >= 0) return;
        const ctx = await mbGetCustomerNotifContext(customerId);
        if (!mbNotifTypeEnabled(ctx.prefs, 'appointmentReminders')) return;
        const S = mbCustomerNotifStrings(ctx.lang);
        const when = [bk.requestedDate, bk.startTime].filter(Boolean).join(' ');
        const id = `${d.id}_appointment_reminder`;
        await db.collection('customerNotifications').doc(id).set({
          id,
          customerId,
          bookingId: d.id,
          vendorId: String(bk.vendorId || ''),
          ownerId: String(bk.ownerId || ''),
          type: 'appointment_reminder',
          title: S.apptTitle,
          body: S.apptBody.replace('{when}', when),
          status: String(bk.status || ''),
          read: false,
          openUrl: `/mobile-barber?panel=notifications&bookingId=${encodeURIComponent(d.id)}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }));
    } catch (e) {
      console.warn('[mb-customer-reminder] appointment scan failed', e && e.message);
    }
  }
);

exports.onMobileBarberBookingCreated = onDocumentCreated(
  {
    document:       'mobileBarberBookings/{bookingId}',
    region:         'us-central1',
    timeoutSeconds: 60,
    retry:          false,
  },
  async (event) => {
    const bookingId = event.params.bookingId;
    const snap = event.data;
    const booking = snap && snap.data();
    const log = (msg) => console.log(`[mb-server-conflict-check][${bookingId}] ${msg}`);
    if (!booking) return;

    const ownerId = String(booking.ownerId || '').trim();
    if (!ownerId) { log('skip — no ownerId'); return; }
    const status = String(booking.status || '').toLowerCase();
    if (MB_NON_BLOCKING.has(status)) { log(`skip — terminal status (${status})`); return; }
    // NOTE: a booking created directly as 'vendor_review' (client guard / agent) is
    // NOT skipped — it must still be conflict-checked so a true time overlap
    // auto-declines it instead of lingering as an actionable "Upcoming" card. This is
    // an UPDATE (not a create), so it never re-triggers this onCreate handler; and the
    // earliest-by-createTime winner logic below guarantees only the LATER overlapping
    // booking declines (the earliest always stands → no double-booking).
    if (status === 'vendor_review') { log('vendor_review — still running owner-wide conflict check'); }

    const win = mbBookingWindow(booking, 'mobileBarberBookings');
    if (!win) { log('skip — no usable time window'); return; }

    // Owner-wide sweep across all service collections (Admin SDK bypasses rules).
    const conflicts = [];
    const cols = ['mobileBarberBookings', 'bookings', 'travel_bookings'];
    for (const col of cols) {
      let qs;
      try {
        qs = await db.collection(col).where('ownerId', '==', ownerId).limit(250).get();
      } catch (e) {
        log(`query ${col} failed (non-fatal): ${e.message}`);
        continue;
      }
      qs.forEach((d) => {
        if (col === 'mobileBarberBookings' && d.id === bookingId) return; // exclude self
        const other = d.data() || {};
        if (MB_NON_BLOCKING.has(String(other.status || '').toLowerCase())) return;
        const ow = mbBookingWindow(other, col);
        if (mbOverlaps(win, ow)) {
          conflicts.push({
            collection: col,
            bookingId: d.id,
            serviceType: String(other.serviceType || ow.svc || ''),
            status: String(other.status || ''),
            start: ow.start,
            end: ow.end,
            createMs: (d.createTime && d.createTime.toMillis) ? d.createTime.toMillis() : (Date.parse(other.createdAt || '') || 0),
          });
        }
      });
    }

    const myCreateMs = (snap.createTime && snap.createTime.toMillis) ? snap.createTime.toMillis()
      : (Date.parse(booking.createdAt || '') || Date.now());

    console.log('[booking-conflict-guard]', JSON.stringify({
      source: booking.source || booking.bookingSource || booking.channel || 'unknown',
      vendorId: booking.vendorId || '', ownerId,
      requestedStart: win.start, requestedEnd: win.end,
      existingBookingsChecked: 'owner-wide(mobileBarberBookings,bookings,travel_bookings)',
      conflictsFound: conflicts.length,
      result: conflicts.length ? 'overlap' : 'clear',
    }));

    if (!conflicts.length) { log('no owner-wide conflict — left as-is'); return; }

    // Race-safe winner: the EARLIEST-created booking in an overlap set wins; any
    // later overlapping booking auto-declines ITSELF. Each trigger decides
    // independently by Firestore createTime, so exactly the later one(s) get
    // declined and the earliest stands — no double-booking, no mutual-decline race.
    const earlier = conflicts.find((c) =>
      c.createMs < myCreateMs || (c.createMs === myCreateMs && String(c.bookingId) < String(bookingId)));

    if (!earlier) {
      log(`earliest of ${conflicts.length} overlap(s) — stands`);
      return;
    }

    console.log('[booking-write-blocked]', JSON.stringify({
      bookingId,
      reason: 'time_conflict',
      conflicts: conflicts.slice(0, 10).map((c) => ({ bookingId: c.bookingId, collection: c.collection, status: c.status })),
      conflictWith: earlier.bookingId,
    }));

    try {
      await snap.ref.update({
        status: 'declined',
        declineReason: 'time_conflict',
        declinedBy: 'system',
        conflictBookingId: earlier.bookingId,
        reviewConflicts: conflicts.slice(0, 10),
        ownerConflictCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: new Date().toISOString(),
      });
      log(`AUTO-DECLINED — overlaps earlier booking ${earlier.bookingId} (${conflicts.length} conflict(s))`);
    } catch (e) {
      log(`failed to auto-decline: ${e.message}`);
    }
  }
);

// ── createMobileBarberBookingGuarded (onCall) ────────────────────────────────
// Authoritative PRE-WRITE conflict guard for the CUSTOMER booking flow. The public
// frontend signs in anonymously and (under Firestore rules) cannot run the
// owner-scoped conflict query itself, so it used to write the booking directly and
// only get auto-declined AFTER the fact — the customer saw "success" for a booking
// that overlapped another. This callable runs the SAME owner-wide time-overlap
// check the trigger uses, BEFORE writing, and REFUSES to create an overlapping
// booking (returning suggested free times instead). Every customer booking path
// (manual / AI chat / voice / AI-style / promo) routes through it, so a second
// booking for a taken slot is blocked before the success screen. The onCreate
// trigger above stays as a race-safety net for the rare simultaneous double-write.
function mbFmtHHMM(ms) {
  const d = new Date(ms);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}
function mbSuggestAlternativeTimes(win, allBusy) {
  // Step forward from the requested start by the service's duration+buffer and
  // return up to 3 same-day start times that overlap NO existing blocking booking.
  const stepMin = (MB_SVC_DUR[win.svc] || 45) + (MB_SVC_BUFFER[win.svc] || 15);
  const durMs = win.end - win.start; // already includes the service buffer
  const baseDay = new Date(win.start).getUTCDate();
  const out = [];
  for (let k = 1; k <= 24 && out.length < 3; k++) {
    const s = win.start + k * stepMin * 60000;
    if (new Date(s).getUTCDate() !== baseDay) break; // same calendar day only
    const cand = { start: s, end: s + durMs };
    const clash = allBusy.some((b) => cand.start < b.end && b.start < cand.end);
    if (!clash) out.push(mbFmtHHMM(s));
  }
  return out;
}
exports.createMobileBarberBookingGuarded = onCall(
  { region: 'us-central1', cors: true, timeoutSeconds: 30 },
  async (request) => {
    const booking = (request.data && request.data.booking) || null;
    if (!booking || typeof booking !== 'object') {
      return { ok: false, code: 'invalid_request', reason: 'missing booking payload' };
    }
    const bookingId = String(booking.id || booking.bookingId || '').trim();
    const ownerId = String(booking.ownerId || '').trim();
    const vendorId = String(booking.vendorId || '').trim();
    if (!bookingId) return { ok: false, code: 'invalid_request', reason: 'missing booking id' };
    if (!ownerId)   return { ok: false, code: 'invalid_request', reason: 'missing ownerId' };
    if (!vendorId)  return { ok: false, code: 'invalid_request', reason: 'missing vendorId' };

    const win = mbBookingWindow(booking, 'mobileBarberBookings');
    if (!win) return { ok: false, code: 'invalid_request', reason: 'invalid date/time' };

    const ref = db.collection('mobileBarberBookings').doc(bookingId);

    // Idempotency: the same submission (deterministic id) retried is NOT a double
    // booking — return the existing doc as success (unless it is terminal, in which
    // case the slot is free to re-book).
    const existingSnap = await ref.get();
    if (existingSnap.exists) {
      const ex = existingSnap.data() || {};
      if (!MB_NON_BLOCKING.has(String(ex.status || '').toLowerCase())) {
        console.log('[booking-guard-callable]', JSON.stringify({ bookingId, vendorId, ownerId, result: 'idempotent' }));
        return { ok: true, idempotent: true, booking: Object.assign({ id: bookingId }, ex) };
      }
    }

    // ── Identity + intent inputs for smart duplicate/spam detection ─────────────
    const reqId = { phone: mbNormPhone(booking.customerPhone), email: mbLower(booking.customerEmail) };
    const reqSvc = mbNormSvc(booking.serviceType || 'barber');
    const reqDate = String(booking.requestedDate || booking.date || '');
    const reqStart = win.start;
    const nowMs = Date.now();
    const DAY_MS = 86400000, FOUR_H_MS = 4 * 3600 * 1000;
    const intentType = String(booking.duplicateIntentType || '').trim();
    // Reschedule mode: "change my existing appointment" — move the linked booking IN
    // PLACE (no second booking). Its new window is still overlap-checked (excluded below).
    const rescheduleId = intentType === 'self_reschedule'
      ? String(booking.linkedExistingBookingId || '').trim() : '';

    // Owner-wide bookings (Admin SDK bypasses rules). Capture customer identity so the
    // same person's duplicates are detectable; count this customer's 24h activity (any
    // status) for spam limits. allBusy holds ACTIVE windows only.
    const cols = ['mobileBarberBookings', 'bookings', 'travel_bookings'];
    const allBusy = [];
    let recent24h = 0;
    for (const col of cols) {
      let qs;
      try { qs = await db.collection(col).where('ownerId', '==', ownerId).limit(250).get(); }
      catch (e) { continue; }
      qs.forEach((d) => {
        if (col === 'mobileBarberBookings' && (d.id === bookingId || d.id === rescheduleId)) return;
        const other = d.data() || {};
        const isSame = mbSameCustomer(reqId, other);
        if (isSame) {
          const cMs = (d.createTime && d.createTime.toMillis) ? d.createTime.toMillis() : (Date.parse(other.createdAt || '') || 0);
          if (cMs && nowMs - cMs <= DAY_MS) recent24h++;
        }
        if (MB_NON_BLOCKING.has(String(other.status || '').toLowerCase())) return;
        const ow = mbBookingWindow(other, col);
        if (!ow) return;
        allBusy.push({
          collection: col, bookingId: d.id, status: String(other.status || ''),
          start: ow.start, end: ow.end, svc: ow.svc, sameCust: isSame,
          serviceName: String(other.serviceName || ''),
          requestedDate: String(other.requestedDate || other.date || ''), startTime: String(other.startTime || ''),
        });
      });
    }

    const conflicts = allBusy.filter((b) => mbOverlaps(win, b));
    const sameCust = allBusy.filter((b) => b.sameCust);
    const sameCustExact = sameCust.find((b) => b.start === reqStart);
    const sameCustOverlap = sameCust.find((b) => mbOverlaps(win, b));
    const sameDayCuts = sameCust.filter((b) => b.svc === 'barber' && b.requestedDate === reqDate);
    const within4h = sameDayCuts.filter((b) => Math.abs(b.start - reqStart) < FOUR_H_MS);

    const riskReasons = [];
    if (within4h.length) riskReasons.push('within_4h');
    if (sameDayCuts.length >= 2) riskReasons.push('multiple_same_day');
    if (reqSvc === 'barber' && sameDayCuts.length >= 1) riskReasons.push('same_service_same_day');
    const riskScore = riskReasons.length;
    const verifiedFamily = booking.duplicateIntentVerified === true
      && String(booking.bookingFor || '') === 'family_member'
      && !!String(booking.familyMemberName || '').trim();
    const tooManySameDay = sameDayCuts.length >= 3;

    const logCheck = (result) => console.log('[duplicate-intent-check]', JSON.stringify({
      customerPhone: reqId.phone, requestedStart: reqStart, existingActiveBookings: sameCust.length,
      sameDayHaircuts: sameDayCuts.length, recent24h, riskScore, riskReasons, result,
    }));
    const existingOf = (b) => ({ bookingId: b.bookingId, serviceName: b.serviceName, date: b.requestedDate, startTime: b.startTime, time: mbFmtHHMM(b.start) });

    // 1) SPAM / ABUSE — same customer hard limits (>5 attempts/24h, or >3 same-day
    //    haircuts when not a verified family booking). Blocks before slot allocation.
    if (recent24h >= 5 || (tooManySameDay && !verifiedFamily)) {
      logCheck('spam_blocked');
      return { ok: false, code: 'TOO_MANY_REQUESTS', reason: 'rate_limited', recent24h, sameDayHaircuts: sameDayCuts.length };
    }

    // 2) Same person, exact or overlapping time → hard block (one barber, one chair —
    //    a family member can't occupy an overlapping slot either).
    if (sameCustExact || sameCustOverlap) {
      const hit = sameCustExact || sameCustOverlap;
      logCheck(sameCustExact ? 'duplicate_exact' : 'customer_overlap');
      return {
        ok: false, code: sameCustExact ? 'DUPLICATE_EXACT' : 'CUSTOMER_OVERLAP',
        reason: 'same_customer_time_conflict', existing: [existingOf(hit)],
        suggestions: mbSuggestAlternativeTimes(win, allBusy),
      };
    }

    // 3) Generic owner time-overlap — a DIFFERENT customer holds the slot → time_conflict.
    if (conflicts.length) {
      logCheck('time_conflict');
      console.log('[booking-write-blocked]', JSON.stringify({ bookingId, reason: 'time_conflict', via: 'callable' }));
      return {
        ok: false, code: 'time_conflict', reason: 'slot_unavailable',
        conflicts: conflicts.slice(0, 5).map((c) => ({ bookingId: c.bookingId, status: c.status })),
        suggestions: mbSuggestAlternativeTimes(win, allBusy),
      };
    }

    // 4) Same person, same day, NON-overlapping haircut → require intent (self vs family)
    //    unless already verified as a family member or this is an explicit reschedule.
    if (riskScore > 0 && !verifiedFamily && !rescheduleId) {
      logCheck('needs_intent');
      return {
        ok: false, code: 'SAME_DAY_DUPLICATE_NEEDS_INTENT', reason: 'duplicate_intent_required',
        riskScore, riskReasons, existing: sameDayCuts.slice(0, 3).map(existingOf),
      };
    }

    // ── Cleared. Reschedule in place, or write the new booking. ─────────────────
    const ts = admin.firestore.FieldValue.serverTimestamp();
    if (rescheduleId) {
      const rRef = db.collection('mobileBarberBookings').doc(rescheduleId);
      const rSnap = await rRef.get();
      if (!rSnap.exists) return { ok: false, code: 'invalid_request', reason: 'reschedule target not found' };
      await rRef.set({
        requestedDate: reqDate, startTime: String(booking.startTime || ''), endTime: String(booking.endTime || ''),
        rescheduledAt: ts, updatedAt: new Date().toISOString(), ownerConflictCheckedAt: ts,
      }, { merge: true });
      logCheck('rescheduled');
      const merged = Object.assign({ id: rescheduleId }, rSnap.data() || {}, {
        requestedDate: reqDate, startTime: String(booking.startTime || ''), endTime: String(booking.endTime || ''),
      });
      return { ok: true, code: 'OK_RESCHEDULED', rescheduled: true, booking: merged };
    }

    const writeDoc = Object.assign({}, booking, {
      ownerConflictCheckedAt: ts, duplicateRiskScore: riskScore, duplicateRiskReasons: riskReasons,
    });
    if (verifiedFamily) {
      writeDoc.bookingFor = 'family_member';
      writeDoc.duplicateIntentVerified = true;
      writeDoc.duplicateIntentType = 'family_member';
      // A verified family booking that pushes the same-day count high is allowed but
      // routed to the barber for a sanity check rather than silently piling up.
      if (tooManySameDay && !MB_NON_BLOCKING.has(String(writeDoc.status || '').toLowerCase())) {
        writeDoc.status = 'vendor_review';
        writeDoc.reviewReason = 'high_volume_family';
      }
    } else if (!writeDoc.bookingFor) {
      writeDoc.bookingFor = 'self';
    }

    // ── Route-aware confirm gate (server-authoritative) ─────────────────────────
    // The server is the source of truth for "can this be confirmed?". An
    // unvalidated address or a job beyond the service radius is routed to
    // vendor_review (NOT hard-rejected — keeps customer churn low while flagging
    // the barber). Hard travel-gap infeasibility is handled upstream by the slot
    // scorer (those slots are never offered) and window overlaps by mbOverlaps above.
    (function applyRouteGate() {
      if (MB_NON_BLOCKING.has(String(writeDoc.status || '').toLowerCase())) return;
      const av = String(booking.addressValidationStatus || '').toLowerCase();
      const distanceMiles = Number(booking.distanceMiles || 0);
      const radius = MB_SERVICE_RADIUS_DEFAULT;
      if (!av || av === 'invalid') {
        writeDoc.status = 'vendor_review';
        writeDoc.reviewReason = writeDoc.reviewReason || 'address_unvalidated';
      } else if (distanceMiles > radius) {
        writeDoc.status = 'vendor_review';
        writeDoc.reviewReason = writeDoc.reviewReason || 'beyond_service_radius';
      }
    })();

    await ref.set(writeDoc);
    logCheck(verifiedFamily ? 'ok_family_member' : 'ok');
    console.log('[booking-write-guarded]', JSON.stringify({ bookingId, vendorId, ownerId, status: writeDoc.status, bookingFor: writeDoc.bookingFor }));
    return { ok: true, code: verifiedFamily ? 'OK_FAMILY_MEMBER' : 'OK', booking: Object.assign({ id: bookingId }, writeDoc) };
  }
);

// ── onDispatchQueue ──────────────────────────────────────────────────────────
// Triggered when a new dispatchQueue doc is created (booking creation or rejection retry).
exports.onDispatchQueue = onDocumentCreated(
  {
    document:       'dispatchQueue/{queueId}',
    region:         'us-central1',
    timeoutSeconds: 60,
    retry:          false,
  },
  async (event) => {
    const { queueId } = event.params;
    const queueRef    = event.data.ref;
    const data        = event.data.data();
    const log = (msg) => console.log(`[onDispatchQueue][${queueId}] ${msg}`);
    log('triggered');

    if (data.status === 'done') { log('already done — skip'); return; }

    const bookingId    = data.bookingId;
    const skipDriverIds= data.skipDriverIds || [];
    if (!bookingId) { log('no bookingId'); await queueRef.update({ status: 'done', reason: 'no_booking_id' }); return; }

    // Fetch booking
    const bookingSnap = await db.collection('bookings').doc(bookingId).get();
    if (!bookingSnap.exists) { log('booking not found'); await queueRef.update({ status: 'done', reason: 'booking_not_found' }); return; }
    const booking = bookingSnap.data();

    // Don't dispatch to already-assigned bookings
    const TERMINAL = new Set(['assigned','driver_confirmed','on_the_way','arrived','in_progress','completed','cancelled']);
    if (TERMINAL.has(booking.status)) {
      log(`booking already in terminal state: ${booking.status}`);
      await queueRef.update({ status: 'done', reason: 'already_terminal' });
      return;
    }

    // Find eligible drivers
    log(`booking.serviceType=${booking.serviceType} booking.airport=${booking.airport} skip=[${skipDriverIds}]`);
    const eligible = await _queryEligibleDrivers(booking.serviceType, booking.airport, skipDriverIds);
    log(`${eligible.length} eligible driver(s) after full filter`);

    if (eligible.length === 0) {
      await db.collection('bookings').doc(bookingId).update({
        status: 'awaiting_driver',
        dispatchNote: 'No eligible drivers available. Admin assignment required.',
        statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await queueRef.update({ status: 'done', reason: 'no_eligible_drivers' });
      log('no eligible drivers — set awaiting_driver');
      return;
    }

    // Select first driver (TODO: add GPS/last-active ranking in future phase)
    const selected = eligible[0];
    const expiresAt = new Date(Date.now() + 35 * 1000); // 35-second offer window

    // Write or overwrite the offer doc for this booking
    const offerRef = db.collection('bookingOffers').doc(bookingId);
    await offerRef.set({
      bookingId,
      driverId:      selected.id,
      driverName:    selected.fullName || selected.name || '',
      status:        'pending',
      skipDriverIds,
      attempt:       data.attempt || 1,
      createdAt:     admin.firestore.FieldValue.serverTimestamp(),
      expiresAt:     admin.firestore.Timestamp.fromDate(expiresAt),
      respondedAt:   null,
    });

    // Update booking to offered_to_driver
    await db.collection('bookings').doc(bookingId).update({
      status:               'offered_to_driver',
      currentOfferDriverId: selected.id,
      statusUpdatedAt:      admin.firestore.FieldValue.serverTimestamp(),
    });

    await queueRef.update({ status: 'processing', selectedDriverId: selected.id });
    log(`offer sent to driver ${selected.id} — expires in 35s`);
  }
);

// ── acceptOffer (HTTPS callable) ──────────────────────────────────────────────
// Transactional: verifies offer still pending for this driver before assigning.
exports.acceptOffer = onCall(
  { region: 'us-central1' },
  async (req) => {
    if (!req.auth) return { ok: false, reason: 'unauthenticated' };
    const uid       = req.auth.uid;
    const bookingId = req.data && req.data.bookingId;
    const log = (msg) => console.log(`[acceptOffer][${bookingId}] ${msg}`);
    if (!bookingId) return { ok: false, reason: 'bookingId_required' };

    // Resolve driverId from uid
    const duSnap = await db.collection('driverUsers').doc(uid).get();
    if (!duSnap.exists) return { ok: false, reason: 'driver_not_found' };
    const driverId   = duSnap.data().driverId || uid;
    const dSnap      = await db.collection('drivers').doc(driverId).get();
    const dData      = dSnap.exists ? dSnap.data() : {};
    const driverName = dData.fullName || dData.name || '';
    const driverPhone= dData.phone || '';

    const offerRef   = db.collection('bookingOffers').doc(bookingId);
    const bookingRef = db.collection('bookings').doc(bookingId);

    try {
      await db.runTransaction(async (t) => {
        const offerSnap   = await t.get(offerRef);
        const bookingSnap = await t.get(bookingRef);

        if (!offerSnap.exists)                          throw new Error('offer_not_found');
        if (offerSnap.data().status !== 'pending')      throw new Error('offer_not_pending:' + offerSnap.data().status);
        if (offerSnap.data().driverId !== driverId)     throw new Error('not_your_offer');
        if (!bookingSnap.exists)                        throw new Error('booking_not_found');
        const bst = bookingSnap.data().status;
        if (bst !== 'offered_to_driver')                throw new Error('booking_wrong_state:' + bst);

        const ts = admin.firestore.FieldValue.serverTimestamp();
        t.update(offerRef,   { status: 'accepted', respondedAt: ts });
        t.update(bookingRef, {
          status:               'assigned',
          driver:               { driverId, name: driverName, phone: driverPhone },
          currentOfferDriverId: driverId,
          statusUpdatedAt:      ts,
          statusUpdatedBy:      'driver:' + driverId,
          statusHistory:        admin.firestore.FieldValue.arrayUnion({
            status: 'assigned', by: 'driver:' + driverId, at: new Date().toISOString(),
          }),
        });
      });
      log(`accepted by driver ${driverId}`);

      // Queue driver-assigned email (non-blocking, idempotent via fixed doc ID)
      const freshSnap = await bookingRef.get();
      const fresh = freshSnap.data();
      if (fresh && fresh.customerEmail) {
        const VENDOR_ID = 'admin-dlc';
        await db.collection('vendors').doc(VENDOR_ID).collection('emailQueue')
          .doc(`${bookingId}_assigned`)
          .set({
            bookingId, eventType: 'assigned', bookingType: 'ride', status: 'pending',
            createdAt:     admin.firestore.FieldValue.serverTimestamp(),
            customerEmail: fresh.customerEmail,
            customerName:  fresh.customerName || fresh.name || '',
            serviceType:   fresh.serviceType  || '',
            airport:       fresh.airport       || '',
            terminal:      fresh.terminal      || '',
            datetime:      fresh.datetime      || '',
            address:       fresh.address       || '',
            pickupAddress: fresh.pickupAddress  || '',
            dropoffAddress:fresh.dropoffAddress || '',
            trackingToken: fresh.trackingToken  || '',
            driverName, driverPhone,
            lang: fresh.lang || 'en',
          }, { merge: false })
          .catch(() => {}); // ignore ALREADY_EXISTS
      }
      return { ok: true };
    } catch (e) {
      log('failed: ' + e.message);
      return { ok: false, reason: e.message };
    }
  }
);

// ── rejectOffer (HTTPS callable) ──────────────────────────────────────────────
// Driver declines — triggers dispatch to next eligible driver.
exports.rejectOffer = onCall(
  { region: 'us-central1' },
  async (req) => {
    if (!req.auth) return { ok: false, reason: 'unauthenticated' };
    const uid       = req.auth.uid;
    const bookingId = req.data && req.data.bookingId;
    const log = (msg) => console.log(`[rejectOffer][${bookingId}] ${msg}`);
    if (!bookingId) return { ok: false, reason: 'bookingId_required' };

    const duSnap = await db.collection('driverUsers').doc(uid).get();
    if (!duSnap.exists) return { ok: false, reason: 'driver_not_found' };
    const driverId = duSnap.data().driverId || uid;

    const offerRef = db.collection('bookingOffers').doc(bookingId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists)                         return { ok: false, reason: 'offer_not_found' };
    if (offerSnap.data().status !== 'pending')     return { ok: false, reason: 'offer_not_pending' };
    if (offerSnap.data().driverId !== driverId)    return { ok: false, reason: 'not_your_offer' };

    const ts = admin.firestore.FieldValue.serverTimestamp();
    await offerRef.update({ status: 'rejected', respondedAt: ts });

    const skipDriverIds = [...(offerSnap.data().skipDriverIds || []), driverId];
    const nextAttempt   = (offerSnap.data().attempt || 1) + 1;
    const MAX_ATTEMPTS  = 5;

    const bookingRef  = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (bookingSnap.exists && bookingSnap.data().status === 'offered_to_driver') {
      if (nextAttempt > MAX_ATTEMPTS) {
        await bookingRef.update({
          status: 'awaiting_driver',
          dispatchNote: 'Max dispatch attempts reached. Admin assignment required.',
          statusUpdatedAt: ts,
        });
        log(`max attempts — awaiting_driver`);
      } else {
        await bookingRef.update({ status: 'dispatching', statusUpdatedAt: ts });
        await db.collection('dispatchQueue').doc(`${bookingId}_${Date.now()}`).set({
          bookingId, skipDriverIds, attempt: nextAttempt, status: 'pending', createdAt: ts,
        });
        log(`rejected — attempt ${nextAttempt} queued, skip=[${skipDriverIds}]`);
      }
    }

    return { ok: true };
  }
);

// ── expireRideOffers (scheduled every 2 minutes) ──────────────────────────────
// Finds pending bookingOffers past their expiresAt and triggers next dispatch.
// Privacy sweep for live trip location sharing: hard-delete any liveLocations doc past its
// expiresAt (or with none) so no location persists after a trip / share window. Belt-and-
// suspenders on top of client delete-on-stop + readers-ignore-expired + members-only rules.
exports.cleanupExpiredLiveLocations = onSchedule(
  { schedule: 'every 24 hours', region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' },
  async () => {
    const now = Date.now();
    let removed = 0, batch = db.batch(), n = 0;
    const snap = await db.collectionGroup('liveLocations').limit(2000).get();
    for (const d of snap.docs) {
      const exp = d.get('expiresAt');
      const expMs = (typeof exp === 'number') ? exp : (exp && exp.toMillis ? exp.toMillis() : 0);
      if (!expMs || expMs < now) { batch.delete(d.ref); n++; removed++; if (n >= 400) { await batch.commit(); batch = db.batch(); n = 0; } }
    }
    if (n > 0) await batch.commit();
    console.log('[cleanupExpiredLiveLocations] removed ' + removed + ' expired/stale live location(s)');
  }
);
exports.expireRideOffers = onSchedule(
  { schedule: 'every 2 minutes', region: 'us-central1', timeoutSeconds: 60 },
  async () => {
    const log = (msg) => console.log('[expireRideOffers]', msg);
    const now  = admin.firestore.Timestamp.now();
    const snap = await db.collection('bookingOffers')
      .where('status',    '==', 'pending')
      .where('expiresAt', '<',  now)
      .limit(20)
      .get();
    log(`found ${snap.size} stale offer(s)`);

    const MAX_ATTEMPTS = 5;
    for (const docSnap of snap.docs) {
      const offer = docSnap.data();
      const { bookingId, driverId, skipDriverIds: prevSkip = [], attempt = 1 } = offer;
      const ts           = admin.firestore.FieldValue.serverTimestamp();
      const skipDriverIds= [...prevSkip, driverId];
      const nextAttempt  = attempt + 1;

      await docSnap.ref.update({ status: 'expired', expiredAt: ts });

      const bookingRef  = db.collection('bookings').doc(bookingId);
      const bookingSnap = await bookingRef.get();
      if (!bookingSnap.exists) continue;
      const bst = bookingSnap.data().status;
      if (bst !== 'offered_to_driver' && bst !== 'dispatching') {
        log(`booking ${bookingId} is ${bst} — skip`);
        continue;
      }

      if (nextAttempt > MAX_ATTEMPTS) {
        await bookingRef.update({
          status: 'awaiting_driver',
          dispatchNote: 'Max dispatch attempts (offer expired). Admin assignment required.',
          statusUpdatedAt: ts,
        });
        log(`${bookingId}: max attempts — awaiting_driver`);
      } else {
        await bookingRef.update({ status: 'dispatching', statusUpdatedAt: ts });
        await db.collection('dispatchQueue').doc(`${bookingId}_${Date.now()}`).set({
          bookingId, skipDriverIds, attempt: nextAttempt, status: 'pending', createdAt: ts,
        });
        log(`${bookingId}: expired, queued attempt ${nextAttempt}`);
      }
    }
  }
);

// ── Phase 12: Pre-pickup ride reminders ───────────────────────────────────────
//
// Runs every 15 minutes.  For every active ride booking whose pickup time falls
// inside a reminder window, writes one emailQueue doc (idempotent via .create())
// and one in-app notification doc.
//
// Reminder windows:
//   reminder_30min  — ride is 20–40 minutes away
//   reminder_2hr    — ride is 110–130 minutes away
//
// Idempotency:
//   emailQueue doc ID    = "{bookingId}_reminder_{type}"
//   notification doc ID  = "{bookingId}_reminder_{type}_customer_{safePhone}"
//   Admin SDK .create() throws ALREADY_EXISTS if the doc is already there — caught
//   and silently skipped.  Even if a doc is re-created (e.g. after manual delete),
//   the onEmailQueue guard (emailSent === true) prevents a duplicate email send.
//
// Datetime parsing:
//   Stored as "YYYY-MM-DDTHH:mm:ss" in Pacific local time (no timezone suffix).
//   We append a best-effort Pacific offset (PDT UTC-7 Mar–Oct, PST UTC-8 Nov–Feb)
//   before calling new Date() so the comparison against server UTC is correct.
//
exports.checkRideReminders = onSchedule(
  {
    schedule:       'every 15 minutes',
    region:         'us-central1',
    timeoutSeconds: 60,
  },
  async () => {
    const log = (msg) => console.log('[checkRideReminders]', msg);
    const VENDOR_ID = 'admin-dlc';
    const now = Date.now();

    const RIDE_SERVICE_TYPES = ['pickup', 'dropoff', 'private_ride'];
    const SKIP_STATUSES      = new Set(['cancelled', 'completed']);

    // Two reminder windows: {type, minMs, maxMs} — ride must be within [min,max] ms away
    const WINDOWS = [
      { type: 'reminder_30min', minMs:  20 * 60 * 1000, maxMs:  40 * 60 * 1000 },
      { type: 'reminder_2hr',   minMs: 110 * 60 * 1000, maxMs: 130 * 60 * 1000 },
    ];

    // Parse stored datetime string as Pacific Time.
    // Month-based approximation: PDT (UTC-7) Mar–Oct, PST (UTC-8) Nov–Feb.
    // Good enough for reminders — DST boundary edge cases off by ≤ 1h.
    function parsePacificMs(dtStr) {
      if (!dtStr || !dtStr.includes('T')) return null;
      const m = dtStr.match(/^(\d{4})-(\d{2})-/);
      const month  = m ? parseInt(m[2], 10) : 6;
      const offset = (month >= 3 && month <= 10) ? '-07:00' : '-08:00';
      const d = new Date(dtStr + offset);
      return isNaN(d.getTime()) ? null : d.getTime();
    }

    // Query active ride bookings (no datetime range filter — filter in memory
    // to avoid composite-index requirements and timezone complexity)
    let snap;
    try {
      snap = await db.collection('bookings')
        .where('serviceType', 'in', RIDE_SERVICE_TYPES)
        .limit(300)
        .get();
    } catch (e) {
      log('Firestore query failed: ' + e.message);
      return;
    }

    log(`checking ${snap.size} ride bookings`);
    let queued = 0;

    for (const docSnap of snap.docs) {
      const bk        = docSnap.data();
      const bookingId = docSnap.id;

      // Skip rides that are already done or cancelled
      if (SKIP_STATUSES.has(bk.status)) continue;

      // Parse pickup time in Pacific
      const rideMs = parsePacificMs(bk.datetime);
      if (!rideMs) continue;

      const msUntil = rideMs - now;

      for (const win of WINDOWS) {
        if (msUntil < win.minMs || msUntil > win.maxMs) continue;

        // ── Email reminder ──────────────────────────────────────────────────
        if (bk.customerEmail) {
          const emailDocId = `${bookingId}_${win.type}`;
          const emailRef   = db.collection('vendors').doc(VENDOR_ID)
            .collection('emailQueue').doc(emailDocId);

          try {
            await emailRef.create({
              bookingId:      bookingId,
              eventType:      win.type,
              bookingType:    'ride',
              status:         'pending',
              createdAt:      admin.firestore.FieldValue.serverTimestamp(),
              customerEmail:  bk.customerEmail,
              customerName:   bk.customerName  || bk.name  || '',
              serviceType:    bk.serviceType   || '',
              airport:        bk.airport        || '',
              terminal:       bk.terminal       || '',
              datetime:       bk.datetime       || '',
              address:        bk.address        || '',
              pickupAddress:  bk.pickupAddress   || '',
              dropoffAddress: bk.dropoffAddress  || '',
              passengers:     bk.passengers      || 1,
              trackingToken:  bk.trackingToken   || '',
              driverName:     (bk.driver && bk.driver.name)  ? bk.driver.name  : (bk.driverName  || null),
              driverPhone:    (bk.driver && bk.driver.phone) ? bk.driver.phone : '',
              lang:           bk.lang            || 'en',
            });
            log(`queued email ${win.type} for ${bookingId} (${Math.round(msUntil/60000)} min away)`);
            queued++;
          } catch (e) {
            // ALREADY_EXISTS (gRPC code 6) means reminder was already queued — skip silently
            if (!e.message || !e.message.includes('ALREADY_EXISTS')) {
              log(`emailRef.create failed for ${bookingId}: ${e.message}`);
            }
          }
        }

        // ── In-app notification ─────────────────────────────────────────────
        if (bk.customerPhone) {
          const safePhone  = String(bk.customerPhone).replace(/[^a-zA-Z0-9_-]/g, '');
          const notifDocId = `${bookingId}_${win.type}_customer_${safePhone}`;
          const notifRef   = db.collection('vendors').doc(VENDOR_ID)
            .collection('notifications').doc(notifDocId);

          const timeLabel = win.type === 'reminder_2hr' ? '2 hours' : '30 minutes';
          try {
            await notifRef.create({
              type:       win.type,
              targetType: 'customer',
              targetId:   bk.customerPhone,
              bookingId:  bookingId,
              title:      'Upcoming Ride Reminder',
              message:    `Your ride is in ${timeLabel}. Please be ready at your pickup location.`,
              read:       false,
              createdAt:  admin.firestore.FieldValue.serverTimestamp(),
            });
          } catch (e) {
            // ALREADY_EXISTS expected on repeat runs — ignore
          }
        }
      }
    }

    log(`done — ${queued} reminder(s) queued`);
  }
);

// ── Travel booking confirmation email (to customer) ───────────────────────────
function buildTravelConfirmationEmail(data) {
  const name        = data.customerName || 'Guest';
  const bookingId   = data.bookingId    || '';
  const pkgName     = data.packageName  || 'California Tour';
  const travelDate  = data.travelDate   || '';
  const travelers   = data.travelers    || 1;
  const mode        = data.bookingMode  === 'private' ? 'Private (exclusive vehicle)' : 'Group tour';
  const pickup      = data.pickupLocation || '';
  const vehicle     = data.vehicle        || '';
  const subtotal    = data.subtotal != null ? `$${data.subtotal}` : '';
  const taxes       = data.taxes    != null ? `$${data.taxes}`    : '';
  const total       = data.total    != null ? `$${data.total}`    : '';
  const contactEmail = 'dulichcali21@gmail.com';

  // ── Plain text ─────────────────────────────────────────────────────────────
  const textLines = [
    `Hi ${name},`,
    '',
    `Your tour booking has been confirmed! Here are your details:`,
    '',
    `  Booking ID:   ${bookingId}`,
    `  Tour:         ${pkgName}`,
    `  Date:         ${travelDate || '(to be confirmed)'}`,
    `  Travelers:    ${travelers}`,
    `  Tour type:    ${mode}`,
    pickup  ? `  Pickup:       ${pickup}` : null,
    vehicle ? `  Vehicle:      ${vehicle}` : null,
    subtotal ? `  Subtotal:     ${subtotal}` : null,
    taxes    ? `  Taxes:        ${taxes}`    : null,
    total    ? `  Total:        ${total}`    : null,
    '',
    `We will call you within 2 hours to confirm your pickup details.`,
    '',
    `Questions? Call us: ${phone}`,
    `  www.dulichcali21.com`,
    '',
    `Thank you for choosing Du Lịch Cali!`,
    `— Du Lịch Cali Tours`,
  ].filter(l => l !== null).join('\n');

  // ── HTML ───────────────────────────────────────────────────────────────────
  const rows = [
    ['Booking ID',  bookingId],
    ['Tour',        pkgName],
    ['Date',        travelDate || '(to be confirmed)'],
    ['Travelers',   travelers],
    ['Tour type',   mode],
    pickup  ? ['Pickup location', pickup]  : null,
    vehicle ? ['Vehicle',         vehicle] : null,
    subtotal ? ['Subtotal', subtotal] : null,
    taxes    ? ['Taxes',    taxes]    : null,
    total    ? ['<strong>Total</strong>', `<strong>${total}</strong>`] : null,
  ].filter(Boolean);

  const tableRows = rows.map(([label, val]) =>
    `<tr><td style="padding:6px 12px;color:#666;white-space:nowrap">${label}</td>` +
    `<td style="padding:6px 12px;font-weight:500">${val}</td></tr>`
  ).join('');

  const htmlBody = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px">
  <!-- Header -->
  <tr><td style="background:#0a2344;padding:24px 32px">
    <p style="margin:0;color:#fff;font-size:20px;font-weight:600">Du Lịch Cali</p>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.7);font-size:13px">California Tour Booking</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:28px 32px">
    <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0a2344">Tour Confirmed!</p>
    <p style="margin:0 0 20px;color:#444">Hi ${name}, your booking is confirmed.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;margin-bottom:20px">
      ${tableRows}
    </table>
    <p style="margin:0 0 8px;color:#444;font-size:14px">We will call you within 2 hours to confirm your pickup details.</p>
    <p style="margin:0;color:#444;font-size:14px">Questions? <a href="mailto:${contactEmail}" style="color:#0a2344;font-weight:600">Email us</a></p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px">Du Lịch Cali · <a href="https://www.dulichcali21.com" style="color:#999">www.dulichcali21.com</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { textBody, htmlBody };
}

// ── Travel booking owner-notification email ───────────────────────────────────
function buildTravelOwnerEmail(data) {
  const bookingId  = data.bookingId      || '';
  const pkgName    = data.packageName    || 'California Tour';
  const travelDate = data.travelDate     || '';
  const travelers  = data.travelers      || 1;
  const mode       = data.bookingMode    === 'private' ? 'Private' : 'Group';
  const custName   = data.customerName          || '';
  const custPhone  = data.customerPhone         || '';
  const custEmail  = data.bookingCustomerEmail  || '';
  const pickup     = data.pickupAddress || data.pickupLocation || '';
  const vehicle    = data.vehicle        || '';
  const total      = data.total    != null ? `$${data.total}`    : '';
  const subtotal   = data.subtotal != null ? `$${data.subtotal}` : '';
  const taxes      = data.taxes    != null ? `$${data.taxes}`    : '';

  // ── Plain text ─────────────────────────────────────────────────────────────
  const textBody = [
    `NEW TRAVEL BOOKING`,
    '',
    `  Booking ID:   ${bookingId}`,
    `  Tour:         ${pkgName}`,
    `  Date:         ${travelDate || 'TBD'}`,
    `  Type:         ${mode}`,
    `  Travelers:    ${travelers}`,
    `  Customer:     ${custName}`,
    `  Phone:        ${custPhone}`,
    custEmail ? `  Email:        ${custEmail}` : null,
    pickup  ? `  Pickup:       ${pickup}`  : null,
    vehicle ? `  Vehicle:      ${vehicle}` : null,
    subtotal ? `  Subtotal:     ${subtotal}` : null,
    taxes    ? `  Taxes:        ${taxes}`    : null,
    total    ? `  Total:        ${total}`    : null,
    '',
    `View in Firebase: https://console.firebase.google.com/`,
  ].filter(l => l !== null).join('\n');

  // ── HTML ───────────────────────────────────────────────────────────────────
  const rows = [
    ['Booking ID',  bookingId],
    ['Tour',        pkgName],
    ['Date',        travelDate || 'TBD'],
    ['Type',        mode],
    ['Travelers',   travelers],
    ['Customer',    custName],
    ['Phone',       `<a href="tel:${custPhone}" style="color:#0a2344">${custPhone}</a>`],
    custEmail ? ['Email', `<a href="mailto:${custEmail}" style="color:#0a2344">${custEmail}</a>`] : null,
    pickup  ? ['Pickup',   pickup]  : null,
    vehicle ? ['Vehicle',  vehicle] : null,
    subtotal ? ['Subtotal', subtotal] : null,
    taxes    ? ['Taxes',    taxes]    : null,
    total    ? ['<strong>Total</strong>', `<strong>${total}</strong>`] : null,
  ].filter(Boolean);

  const tableRows = rows.map(([label, val]) =>
    `<tr><td style="padding:6px 12px;color:#666;white-space:nowrap">${label}</td>` +
    `<td style="padding:6px 12px;font-weight:500">${val}</td></tr>`
  ).join('');

  const htmlBody = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px">
  <tr><td style="background:#c0392b;padding:20px 32px">
    <p style="margin:0;color:#fff;font-size:18px;font-weight:700">New Tour Booking</p>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px">Du Lịch Cali — Action Required</p>
  </td></tr>
  <tr><td style="padding:28px 32px">
    <p style="margin:0 0 16px;color:#333;font-size:15px">A new tour booking has been submitted. Please call the customer to confirm pickup details.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;margin-bottom:20px">
      ${tableRows}
    </table>
    <p style="margin:0;color:#666;font-size:13px">
      <a href="https://console.firebase.google.com/u/0/project/dullichcali21/firestore/data/~2Ftravel_bookings~2F${bookingId}"
         style="color:#0a2344;font-weight:600">View in Firestore →</a>
    </p>
  </td></tr>
  <tr><td style="background:#f9f9f9;padding:14px 32px;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px">Du Lịch Cali internal notification</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { textBody, htmlBody };
}

// ── Driver assignment notification email ──────────────────────────────────────
// Sent to each assigned driver when a new tour booking is dispatched to them.
function buildDriverNotifyEmail(data) {
  const driverName  = data.driverName    || 'Driver';
  const bookingId   = data.bookingId     || '';
  const custName    = data.customerName  || '';
  const custPhone   = data.customerPhone || '';
  const custEmail   = data.customerEmail || '';
  const pickup      = data.pickupAddress || data.pickupRegion || '';
  const travelDate  = data.travelDate    || '';
  const travelers   = data.travelers     || 1;
  const mode        = data.bookingMode === 'private' ? 'Private (exclusive)' : 'Group tour';
  const pkgName     = data.packageName   || 'California Tour';
  const notes       = data.notes         || '';
  const coDrivers   = data.coDrivers     || null;
  const isMulti     = data.assignmentType === 'multi';

  // ── Plain text ─────────────────────────────────────────────────────────────
  const textBody = [
    `Hi ${driverName},`,
    '',
    `You have been assigned to a new tour booking. Please contact the customer to confirm pickup details.`,
    '',
    `CUSTOMER`,
    `  Name:    ${custName}`,
    `  Phone:   ${custPhone}`,
    custEmail ? `  Email:   ${custEmail}` : null,
    '',
    `TOUR DETAILS`,
    `  Booking ID:  ${bookingId}`,
    `  Tour:        ${pkgName}`,
    `  Date:        ${travelDate || '(see booking)'}`,
    `  Passengers:  ${travelers}`,
    `  Tour type:   ${mode}`,
    pickup ? `  Pickup:      ${pickup}` : null,
    notes  ? `  Notes:       ${notes}`  : null,
    '',
    isMulti && coDrivers ? `SHARED ASSIGNMENT\n  Co-drivers: ${coDrivers}` : null,
    '',
    `ACTION REQUIRED: Call the customer at ${custPhone} to confirm the exact pickup address and time.`,
    '',
    `Questions? Contact dispatch: dulichcali21@gmail.com`,
    `— Du Lịch Cali`,
    `https://www.dulichcali21.com`,
  ].filter(l => l !== null).join('\n');

  // ── HTML ───────────────────────────────────────────────────────────────────
  const row = (label, value) => value
    ? `<tr><td style="padding:6px 12px;color:#666;white-space:nowrap;font-size:14px">${label}</td>` +
      `<td style="padding:6px 12px;font-weight:500;font-size:14px">${value}</td></tr>`
    : '';

  const htmlBody = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px">
  <tr><td style="background:#0a2344;padding:20px 32px">
    <p style="margin:0;color:#c9a84c;font-size:18px;font-weight:700">Tour Assignment</p>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px">Du Lịch Cali — Driver Notification</p>
  </td></tr>
  <tr><td style="padding:28px 32px">
    <p style="margin:0 0 20px;color:#333;font-size:15px">Hi <strong>${driverName}</strong>, you have been assigned to a new tour. Please call the customer to confirm.</p>

    <p style="margin:0 0 8px;color:#0a2344;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Customer</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;margin-bottom:20px">
      ${row('Name',  custName)}
      ${row('Phone', `<a href="tel:${custPhone.replace(/\D/g,'')}" style="color:#0a2344;font-weight:600">${custPhone}</a>`)}
      ${custEmail ? row('Email', `<a href="mailto:${custEmail}" style="color:#0a2344">${custEmail}</a>`) : ''}
    </table>

    <p style="margin:0 0 8px;color:#0a2344;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Tour Details</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;margin-bottom:20px">
      ${row('Booking ID',  `<span style="font-family:monospace;font-weight:600">${bookingId}</span>`)}
      ${row('Tour',        pkgName)}
      ${row('Date',        travelDate || '(see booking)')}
      ${row('Passengers',  String(travelers))}
      ${row('Tour type',   mode)}
      ${pickup ? row('Pickup', pickup) : ''}
      ${notes  ? row('Notes',  notes)  : ''}
    </table>

    ${isMulti && coDrivers ? `
    <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:14px 16px;margin-bottom:20px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0a2344">Shared Assignment</p>
      <p style="margin:0;font-size:13px;color:#555">Co-drivers: ${coDrivers}</p>
    </div>` : ''}

    <div style="background:#e8f4fd;border:1px solid #bee3f8;border-radius:6px;padding:16px;margin-bottom:20px">
      <p style="margin:0;font-size:14px;font-weight:700;color:#0a2344">Action Required</p>
      <p style="margin:6px 0 0;font-size:14px;color:#333">Call the customer at <a href="tel:${custPhone.replace(/\D/g,'')}" style="color:#0a2344;font-weight:600">${custPhone}</a> to confirm the exact pickup address and time.</p>
    </div>

    <p style="margin:0;color:#666;font-size:13px">Questions? Contact dispatch: <a href="mailto:dulichcali21@gmail.com" style="color:#0a2344">dulichcali21@gmail.com</a></p>
  </td></tr>
  <tr><td style="background:#f9f9f9;padding:14px 32px;border-top:1px solid #eee">
    <p style="margin:0;color:#999;font-size:12px">Du Lịch Cali driver dispatch</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { textBody, htmlBody };
}

// ── Immutable audit log ───────────────────────────────────────────────────────
// Cloud Function triggers record sensitive changes (status, payment, price,
// promotion, vendor settings) to the immutable `auditLogs` collection with
// before/after. Written via the Admin SDK, so no client can forge or delete an
// entry (firestore.rules: auditLogs create/update/delete = false). Admins read
// all; vendors read their own (scoped by vendorId).
const AUDIT_FIELDS = {
  mobileBarberBookings: ['status', 'paymentStatus', 'servicePrice', 'amountDue', 'totalPrice',
    'discountPercent', 'discountedPrice', 'promotionId', 'promoApplied', 'vendorId', 'ownerId', 'assignedBarberId'],
  mobileBarberVendors:  ['active', 'promotions', 'zellePhone', 'zelleQrUrl', 'zelleEmail', 'workingHours', 'unavailableBlocks'],
  mobileBarberServices: ['price', 'active', 'name', 'durationMinutes'],
};
function _auditEq(a, b) { try { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); } catch (e) { return a === b; } }
function makeAuditTrigger(collection) {
  return onDocumentWritten(
    { document: `${collection}/{docId}`, region: 'us-central1', timeoutSeconds: 30, retry: false },
    async (event) => {
      const beforeSnap = event.data && event.data.before;
      const afterSnap  = event.data && event.data.after;
      const before = beforeSnap && beforeSnap.exists ? beforeSnap.data() : null;
      const after  = afterSnap  && afterSnap.exists  ? afterSnap.data()  : null;
      const action = !before ? 'create' : (!after ? 'delete' : 'update');
      const fields = AUDIT_FIELDS[collection] || [];
      const changedFields = [], beforeSub = {}, afterSub = {};
      fields.forEach((f) => {
        const b = before ? before[f] : undefined;
        const a = after ? after[f] : undefined;
        if (!_auditEq(b, a)) { changedFields.push(f); beforeSub[f] = b === undefined ? null : b; afterSub[f] = a === undefined ? null : a; }
      });
      // Only log meaningful changes (skip no-op updates / non-audited field churn).
      if (action === 'update' && changedFields.length === 0) return;
      const vendorId = (after && (after.vendorId || after.ownerId)) || (before && (before.vendorId || before.ownerId)) || '';
      const actor = (after && (after.lastModifiedBy || after.updatedBy)) ||
                    (before && (before.lastModifiedBy || before.updatedBy)) || 'system_or_unknown';
      try {
        await db.collection('auditLogs').add({
          collection,
          docId: event.params.docId,
          vendorId: String(vendorId),
          action,
          changedFields,
          before: action === 'create' ? null : beforeSub,
          after:  action === 'delete' ? null : afterSub,
          actor: String(actor).slice(0, 128),
          at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        console.error('[audit] log write failed for', collection, event.params.docId, e && e.message);
      }
    }
  );
}
exports.onMobileBarberBookingAudit = makeAuditTrigger('mobileBarberBookings');
exports.onMobileBarberVendorAudit  = makeAuditTrigger('mobileBarberVendors');
exports.onMobileBarberServiceAudit = makeAuditTrigger('mobileBarberServices');

// ── Vendor membership claim — server-side setup-code (PIN) verification ────────
// Closes the vendorUsers self-map takeover: the PIN is verified HERE (Admin SDK),
// not in the browser, and the mapping is written server-side. The client can no
// longer self-map to an arbitrary vendor (firestore.rules: vendorUsers write is
// admin OR an existing member only — the FIRST member is created by this CF).
exports.claimVendorMembership = onCall(
  { region: 'us-central1', cors: true, timeoutSeconds: 30 },
  async (request) => {
    const auth = request.auth;
    const uid = auth && auth.uid;
    const provider = auth && auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
    if (!uid || provider === 'anonymous') {
      return { ok: false, code: 'UNAUTHENTICATED', error: 'Sign in with an email account first.' };
    }
    const email = (auth.token && auth.token.email) || '';
    const vendorId = String((request.data && request.data.vendorId) || '').trim();
    const setupCode = String((request.data && request.data.setupCode) || '').trim();
    if (!vendorId || !setupCode) return { ok: false, code: 'INVALID', error: 'Missing vendorId or setup code.' };

    // Resolve the vendor's stored setup code: mobile-barber first, then legacy vendors.
    let vendor = null;
    const mb = await db.doc(`mobileBarberVendors/${vendorId}`).get();
    if (mb.exists) vendor = mb.data();
    else {
      const v = await db.doc(`vendors/${vendorId}`).get();
      if (v.exists) vendor = v.data();
    }
    if (!vendor) return { ok: false, code: 'NOT_FOUND', error: 'Vendor not found.' };

    const status = vendor.adminStatus || 'active';
    if (status !== 'active') return { ok: false, code: 'INACTIVE', error: 'Vendor is not active. Contact admin.' };

    const expected = String(vendor.setupCode || '');
    if (!expected || setupCode !== expected) {
      return { ok: false, code: 'BAD_CODE', error: 'Incorrect setup code.' };
    }

    // Verified — write the mapping (Admin SDK bypasses the client-write-blocked rule).
    await db.doc(`vendorUsers/${uid}`).set({
      vendorIds: admin.firestore.FieldValue.arrayUnion(vendorId),
      vendorId: vendorId,                 // legacy single-field for older readers
      email: email,
      role: 'owner',
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.info('[claimVendorMembership] ok', { uid, vendorId });
    return { ok: true, vendorId };
  }
);
