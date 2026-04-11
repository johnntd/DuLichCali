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

  // ── Internal: write one in-app notification doc ─────────────────────────────
  /**
   * Idempotent: doc ID = "{bookingId}_{type}_{targetType}_{targetId}"
   * Writes to vendors/admin-dlc/notifications/{docId}
   */
  function _writeNotification(bookingId, type, targetType, targetId, title, message) {
    if (typeof firebase === 'undefined') return;
    var db    = firebase.firestore();
    var safeId = String(targetId).replace(/[^a-zA-Z0-9_-]/g, '');
    var docId = bookingId + '_' + type + '_' + targetType + '_' + safeId;
    db.collection('vendors').doc(VENDOR_ID).collection('notifications').doc(docId)
      .set({
        type:       type,
        targetType: targetType,
        targetId:   targetId,
        bookingId:  bookingId,
        title:      title,
        message:    message,
        read:       false,
        createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: false })
      .then(function () {
        console.log('[DLCNotifications] in-app', type, targetType, 'for', bookingId);
      })
      .catch(function (e) {
        console.warn('[DLCNotifications] notification write failed:', e.message);
      });
  }

  // ── Public: in-app notifications for new ride booking ───────────────────────
  /**
   * Writes admin + customer in-app notification docs.
   * Call immediately after a ride booking is saved to Firestore.
   * Separate from queueRideConfirmation (which writes to emailQueue).
   *
   * @param {object} booking  — must include bookingId, serviceType, customerName, customerPhone, datetime
   * @param {string} lang     — 'vi' | 'en' | 'es'
   */
  function queueRideBookedNotification(booking, lang) {
    if (!booking || !booking.bookingId) return;
    var id   = booking.bookingId;
    var svcMap = { airport_pickup: 'Airport Pickup', airport_dropoff: 'Airport Dropoff', private_ride: 'Private Ride' };
    var svc  = svcMap[booking.serviceType] || booking.serviceType || 'Ride';
    var name = booking.customerName || booking.name || '';
    var pax  = booking.passengers   ? ' · ' + booking.passengers + ' pax' : '';
    var when = booking.datetime || booking.requestedDate || '';

    // Admin gets a notification for every new ride
    _writeNotification(id, 'ride_confirmed', 'admin', 'admin',
      'New Ride: ' + svc,
      (name ? name + ' · ' : '') + when + pax
    );

    // Customer in-app (keyed by phone — customer may not have a logged-in session)
    if (booking.customerPhone) {
      _writeNotification(id, 'ride_confirmed', 'customer', booking.customerPhone,
        'Booking Confirmed',
        'Your ' + svc + ' booking has been received. We are finding you a driver.'
      );
    }
  }

  // ── Public: in-app notifications for driver assignment ──────────────────────
  /**
   * Writes driver + customer in-app notification docs.
   * Call when a driver is assigned to a ride booking.
   * Separate from queueDriverAssigned (which writes to emailQueue).
   *
   * @param {object} booking  — booking doc data (must include bookingId, serviceType)
   * @param {object} driver   — { driverId, name, phone }
   * @param {string} lang     — 'vi' | 'en' | 'es'
   */
  function queueDriverAssignedNotification(booking, driver, lang) {
    if (!booking || !booking.bookingId) return;
    var id          = booking.bookingId;
    var driverId    = driver ? (driver.driverId || '') : '';
    var driverName  = driver ? (driver.name || driver.fullName || 'Your driver') : 'Your driver';
    var driverPhone = driver ? (driver.phone || '') : '';
    var svcMap      = { airport_pickup: 'Airport Pickup', airport_dropoff: 'Airport Dropoff', private_ride: 'Private Ride' };
    var svc         = svcMap[booking.serviceType] || booking.serviceType || 'Ride';
    var name        = booking.customerName || booking.name || '';
    var pax         = booking.passengers   ? ' · ' + booking.passengers + ' pax' : '';
    var when        = booking.datetime || booking.requestedDate || '';

    // Driver notification — REQUIRED: driver must know a ride was assigned
    if (driverId) {
      _writeNotification(id, 'ride_assigned', 'driver', driverId,
        'Ride Assigned: ' + svc,
        (name ? name + ' · ' : '') + when + pax
      );
    }

    // Customer in-app — inform them their driver is confirmed
    if (booking.customerPhone) {
      _writeNotification(id, 'ride_assigned', 'customer', booking.customerPhone,
        'Driver Assigned',
        driverName + (driverPhone ? ' (' + driverPhone + ')' : '') + ' is your driver.'
      );
    }
  }

  // ── Expose public API ────────────────────────────────────────────────────────
  return {
    queueRideConfirmation:          queueRideConfirmation,
    queueDriverAssigned:            queueDriverAssigned,
    queueRideBookedNotification:    queueRideBookedNotification,
    queueDriverAssignedNotification: queueDriverAssignedNotification,
  };

}());
