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
const { onCall, onRequest } = require('firebase-functions/v2/https');
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

// ── Secrets (Google Cloud Secret Manager) ────────────────────────────────────
// These are injected at runtime — never stored in code or .env files.
const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN  = defineSecret('TWILIO_AUTH_TOKEN');
const TWILIO_FROM_NUMBER = defineSecret('TWILIO_FROM_NUMBER');

// AI provider secrets
const OPENAI_API_KEY  = defineSecret('OPENAI_API_KEY');
const GEMINI_API_KEY  = defineSecret('GEMINI_API_KEY');
const CLAUDE_API_KEY  = defineSecret('CLAUDE_API_KEY');

// Email provider secret (Resend — https://resend.com)
const RESEND_API_KEY      = defineSecret('RESEND_API_KEY');
// Shared token added to inbound webhook URL as ?token=VALUE so random POSTs are rejected.
// Set once:  firebase functions:secrets:set RESEND_WEBHOOK_SECRET
const RESEND_WEBHOOK_SECRET = defineSecret('RESEND_WEBHOOK_SECRET');

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

    const data    = event.data.data();
    const toEmail = data.customerEmail;

    if (!toEmail) {
      await queueRef.update({ emailStatus: 'skipped', emailSkipReason: 'no_customer_email' });
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
    'Questions? Call or text: +1 (408) 916-3439',
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
    <p style="font-size:13px;margin:20px 0 0;color:#5a4a3a;">Questions? Call <a href="tel:4089163439" style="color:#0d2f50;">+1 (408) 916-3439</a></p>
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
    'Questions? Call or text: +1 (408) 916-3439',
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
    <p style="font-size:13px;margin:16px 0 0;color:#5a4a3a;">Questions? <a href="tel:4089163439" style="color:#0d2f50;">+1 (408) 916-3439</a></p>
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
    'Questions? Call or text: +1 (408) 916-3439',
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
    <p style="font-size:13px;margin:0;color:#5a4a3a;">Questions? Call <a href="tel:4089163439" style="color:#0d2f50;">+1 (408) 916-3439</a></p>
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
    'Questions? Call or text: +1 (408) 916-3439',
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
    <p style="font-size:13px;margin:20px 0 0;color:#5a4a3a;">Questions? Call <a href="tel:4089163439" style="color:#0d2f50;">+1 (408) 916-3439</a></p>
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
