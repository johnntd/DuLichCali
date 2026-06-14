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
const CHILD_SAFETY_CLAUSE = ' This subject is a CHILD: keep them clearly the same child of the same age, with wholesome, school-appropriate kid styling only — no adult/edgy looks, no facial hair, no aging.';

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

function normalizeHaircutStyle(s, audience, idx) {
  s = s || {};
  var title = String(s.styleTitle || s.title || '').trim() || ('Style ' + (idx + 1));
  var childClause = (audience === 'child') ? CHILD_SAFETY_CLAUSE : '';
  var edit = String(s.imageEditPrompt || s.editPrompt || '').trim();
  if (edit && edit.toUpperCase().indexOf('IDENTITY LOCK') < 0) edit += ' ' + IDENTITY_CLAUSE + childClause;
  if (!edit) edit = 'Restyle the subject’s hair into "' + title + '". ' + IDENTITY_CLAUSE + childClause;
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
    styles = raw.map(function (s, i) { return normalizeHaircutStyle(s, audience, i); })
                .filter(function (s) { return s.imageEditPrompt; });
    analysisOk = styles.length > 0;
  } catch (e) {
    console.warn('[generateHaircutPreviews] analysis failed, using scaffold:', (e && e.message) || e);
  }
  if (styles.length < 5) {
    var scaffold = buildHaircutScaffold(audience, exploreList, lang)
                     .map(function (s, i) { return normalizeHaircutStyle(s, audience, i); });
    var seen = {};
    styles.forEach(function (s) { seen[s.styleId] = true; });
    for (var i = 0; i < scaffold.length && styles.length < 5; i++) {
      if (!seen[scaffold[i].styleId]) { styles.push(scaffold[i]); seen[scaffold[i].styleId] = true; }
    }
  }
  return { analysis: analysisText, styles: styles.slice(0, 5), analysisOk: analysisOk };
}

async function callGeminiImageEdit(geminiKey, inlineImageBase64, mimeType, editPrompt) {
  // Gemini 2.5 Flash Image (Nano Banana) — image-to-image edit via the
  // Generative Language REST API. Returns one or more inline_data parts.
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: inlineImageBase64 } },
        { text: editPrompt }
      ]
    }],
    generationConfig: {
      responseModalities: ['IMAGE']
    }
  };
  const raw = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
    {},
    body
  );
  const parsed = JSON.parse(raw);
  if (!parsed.candidates || !parsed.candidates.length) throw new Error('no_candidates');
  const parts = parsed.candidates[0].content && parsed.candidates[0].content.parts;
  if (!parts || !parts.length) throw new Error('no_parts');
  const imagePart = parts.find(p => p.inline_data || p.inlineData);
  if (!imagePart) throw new Error('no_inline_data');
  const inline = imagePart.inline_data || imagePart.inlineData;
  return {
    dataUrl: `data:${inline.mime_type || inline.mimeType || 'image/png'};base64,${inline.data}`
  };
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

// Plan analysis + 5 styles for a studio mode. Mirrors planHaircutStyles but
// with the richer analysis schema (features + scores + strategy + thinning).
async function runStudioPlan(geminiKey, base64, mimeType, opts) {
  const prompt = StudioLib.buildStudioAnalysisPrompt(
    opts.mode, opts.options, opts.audience, opts.preference, opts.goal, opts.lang
  );
  const plan = await callGeminiHaircutAnalysis(geminiKey, base64, mimeType, prompt); // reused vision call
  const rawAnalysis = (plan && plan.analysis) || {};
  const analysis = {
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
  };
  const rawStyles = (plan && Array.isArray(plan.styles)) ? plan.styles : [];
  const styles = rawStyles
    .map((s, i) => normalizeHaircutStyle(s, opts.audience, i)) // reused: appends IDENTITY/CHILD clauses
    .filter((s) => s.imageEditPrompt)
    .slice(0, 5);
  return { analysis, styles };
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

    const t0 = Date.now();
    let plan;
    try {
      plan = await runStudioPlan(geminiKey, base64, mimeType, { mode, options, audience, preference, goal, lang });
    } catch (e) {
      console.error('[generateStyleStudio] planning failure', e);
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
          const edit = await callGeminiImageEdit(geminiKey, base64, mimeType, style.imageEditPrompt); // reused
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
      console.error('[generateStyleStudio] image edit failure', e);
      return { ok: false, vendorMessage: 'Style Studio could not render previews. Please try again.', debugCode: 'EDIT_ERROR' };
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
