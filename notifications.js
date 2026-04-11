/**
 * notifications.js — DLCNotifications  v1.0
 *
 * Client-side notification layer for ride bookings.
 * Writes email-queue documents to Firestore → picked up by the
 * `onEmailQueue` Cloud Function (functions/index.js) which sends via Resend.
 *
 * Design rules:
 *   • Idempotent: doc ID = "{bookingId}_{eventType}" — double-calls are safe.
 *   • Never duplicates: Firestore .set() with a fixed ID is idempotent by default;
 *     the Cloud Function also guards with emailSent === true check.
 *   • Silent on missing email: if customerEmail is absent, no queue doc is written.
 *   • Non-blocking: all Firestore writes are fire-and-forget (no await at call site).
 *
 * Supported events:
 *   confirmed  — sent immediately after booking is saved
 *   assigned   — sent when a driver is assigned to the booking
 */
window.DLCNotifications = (function () {
  'use strict';

  var VENDOR_ID = 'admin-dlc';

  // ── Internal: write one email-queue doc ──────────────────────────────────────
  function _queue(bookingId, eventType, payload) {
    if (typeof firebase === 'undefined') return;
    var db    = firebase.firestore();
    var docId = bookingId + '_' + eventType;
    db.collection('vendors').doc(VENDOR_ID).collection('emailQueue').doc(docId)
      .set(
        Object.assign({}, payload, {
          bookingId:   bookingId,
          eventType:   eventType,
          bookingType: 'ride',    // routes Cloud Function to ride email templates
          status:      'pending',
          createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        }),
        { merge: false }  // never merge — fixed ID is the idempotency key
      )
      .then(function () {
        console.log('[DLCNotifications] queued', eventType, 'for', bookingId);
      })
      .catch(function (e) {
        console.warn('[DLCNotifications] emailQueue write failed:', e.message);
      });
  }

  // ── Public: queue booking-confirmation email ─────────────────────────────────
  /**
   * Call immediately after a ride booking is saved to Firestore.
   * If customerEmail is absent or empty, this is a no-op.
   *
   * @param {object} booking  — flat object with all booking fields
   * @param {string} lang     — 'vi' | 'en' | 'es'
   */
  function queueRideConfirmation(booking, lang) {
    if (!booking || !booking.customerEmail) return;
    _queue(booking.bookingId, 'confirmed', {
      customerEmail:  booking.customerEmail,
      customerName:   booking.customerName || booking.name || '',
      lang:           lang || 'en',
      serviceType:    booking.serviceType   || '',
      // Airport-ride fields (may be empty for private_ride)
      airport:        booking.airport       || '',
      airline:        booking.airline       || '',
      terminal:       booking.terminal      || '',
      datetime:       booking.datetime      || '',
      address:        booking.address       || '',
      // Private-ride fields (may be empty for airport)
      pickupAddress:  booking.pickupAddress  || '',
      dropoffAddress: booking.dropoffAddress || '',
      passengers:     booking.passengers     || 1,
      estimatedPrice: booking.estimatedPrice || null,
      trackingToken:  booking.trackingToken  || '',
      dispatchStatus: booking.status         || 'awaiting_driver',
      driverName:     booking.driver ? (booking.driver.name || '') : null,
    });
  }

  // ── Public: queue driver-assigned email ──────────────────────────────────────
  /**
   * Call when a driver is assigned to a ride booking.
   * Reads customerEmail from the booking object — if absent, this is a no-op.
   *
   * @param {object} booking  — booking doc data (must include bookingId + customerEmail)
   * @param {object} driver   — { name, phone }
   * @param {string} lang     — 'vi' | 'en' | 'es'
   */
  function queueDriverAssigned(booking, driver, lang) {
    if (!booking || !booking.customerEmail) return;
    _queue(booking.bookingId, 'assigned', {
      customerEmail:  booking.customerEmail,
      customerName:   booking.customerName || booking.name || '',
      lang:           lang || 'en',
      serviceType:    booking.serviceType   || '',
      airport:        booking.airport       || '',
      datetime:       booking.datetime      || '',
      address:        booking.address       || '',
      pickupAddress:  booking.pickupAddress  || '',
      dropoffAddress: booking.dropoffAddress || '',
      passengers:     booking.passengers     || 1,
      trackingToken:  booking.trackingToken  || '',
      driverName:     driver ? (driver.name  || driver.fullName || '') : '',
      driverPhone:    driver ? (driver.phone || '') : '',
    });
  }

  // ── Expose public API ────────────────────────────────────────────────────────
  return {
    queueRideConfirmation: queueRideConfirmation,
    queueDriverAssigned:   queueDriverAssigned,
  };

}());
