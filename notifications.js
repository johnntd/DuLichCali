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

  // ── Public: in-app notifications for ride status transitions ────────────────
  /**
   * Fires customer (and optionally admin) in-app notifications when a ride
   * status changes. Safe to call from any handler — idempotent per
   * (bookingId × newStatus × targetType).
   *
   * Notified statuses: driver_confirmed, on_the_way, arrived, completed, cancelled
   * All other statuses are silently ignored.
   *
   * Duplicate-prevention: doc ID = "{bookingId}_status_{newStatus}_{targetType}_{safeId}"
   * Each status has a unique doc ID, so retrying the same transition is safe.
   * The toast listener's _seen set prevents re-toasting an already-read doc.
   *
   * @param {string} bookingId   — Firestore booking document ID
   * @param {string} newStatus   — the status just written (e.g. 'on_the_way')
   * @param {object} bookingData — booking doc data (name/phone/driver fields)
   * @param {string} [lang]      — 'vi' | 'en'  (unused now; reserved for future i18n)
   */
  function queueStatusChangeNotification(bookingId, newStatus, bookingData, lang) {
    if (!bookingId || !newStatus || !bookingData) return;

    var NOTIFIABLE = ['driver_confirmed', 'on_the_way', 'arrived', 'completed', 'cancelled'];
    if (NOTIFIABLE.indexOf(newStatus) === -1) return;

    var driverName  = (bookingData.driver && bookingData.driver.name)  || 'tài xế';
    var driverPhone = (bookingData.driver && bookingData.driver.phone) || '';
    var custPhone   = bookingData.customerPhone || bookingData.phone   || '';
    var custEmail   = bookingData.customerEmail || '';
    var custName    = bookingData.customerName  || bookingData.name    || '';

    var MSGS = {
      driver_confirmed: {
        title: 'Tài xế đã xác nhận',
        msg:   'Tài xế ' + driverName + ' đã xác nhận chuyến đi của bạn.' +
               (driverPhone ? ' Liên hệ: ' + driverPhone + '.' : '')
      },
      on_the_way: {
        title: 'Xe đang trên đường đến',
        msg:   'Tài xế ' + driverName + ' đang di chuyển đến điểm đón của bạn.'
      },
      arrived: {
        title: 'Xe đã đến điểm đón!',
        msg:   'Tài xế ' + driverName + ' đã đến. Vui lòng ra xe ngay.'
      },
      completed: {
        title: 'Chuyến đi hoàn thành',
        msg:   'Cảm ơn bạn đã đặt xe qua Du Lịch Cali! Chúc bạn một ngày tốt lành.'
      },
      cancelled: {
        title: 'Chuyến đi đã bị hủy',
        msg:   'Chuyến đi của bạn đã bị hủy. Liên hệ chúng tôi nếu cần hỗ trợ.'
      },
    };

    var m = MSGS[newStatus];
    if (!m) return;

    var type = 'status_' + newStatus;

    // ── In-app notifications ─────────────────────────────────────────────────
    // Customer in-app (all 5 statuses)
    if (custPhone) {
      _writeNotification(bookingId, type, 'customer', custPhone, m.title, m.msg);
    }
    // Admin in-app (completed + cancelled only)
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      var adminTitle = newStatus === 'completed' ? '✓ Chuyến hoàn thành' : '✗ Chuyến đã hủy';
      var adminMsg   = 'Chuyến ' + bookingId.slice(0, 8) + (custName ? ' – ' + custName : '');
      _writeNotification(bookingId, type, 'admin', 'admin', adminTitle, adminMsg);
    }

    // ── Email notification ───────────────────────────────────────────────────
    // Uses same emailQueue infrastructure as booking confirmation / driver assigned.
    // Idempotent: doc ID = "{bookingId}_{type}" (e.g. "abc123_status_on_the_way").
    // Cloud Function guard (emailSent:true) prevents re-send on retry.
    if (custEmail) {
      _queue(bookingId, type, {
        customerEmail:  custEmail,
        customerName:   custName,
        serviceType:    bookingData.serviceType   || '',
        airport:        bookingData.airport       || '',
        address:        bookingData.address       || '',
        pickupAddress:  bookingData.pickupAddress  || '',
        dropoffAddress: bookingData.dropoffAddress || '',
        datetime:       bookingData.datetime       || '',
        trackingToken:  bookingData.trackingToken  || '',
        driverName:     driverName,
        driverPhone:    driverPhone,
      });
    }
  }

  // ── Expose public API ────────────────────────────────────────────────────────
  return {
    queueRideConfirmation:            queueRideConfirmation,
    queueDriverAssigned:              queueDriverAssigned,
    queueRideBookedNotification:      queueRideBookedNotification,
    queueDriverAssignedNotification:  queueDriverAssignedNotification,
    queueStatusChangeNotification:    queueStatusChangeNotification,
  };

}());
