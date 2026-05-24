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
  // payload.bookingType overrides the default 'ride' — travel bookings pass
  // bookingType: 'travel' or 'travel_owner' in their payload.
  function _queue(bookingId, eventType, payload) {
    if (typeof firebase === 'undefined') return;
    var db    = firebase.firestore();
    var docId = bookingId + '_' + eventType;
    db.collection('vendors').doc(VENDOR_ID).collection('emailQueue').doc(docId)
      .set(
        Object.assign({}, { bookingType: 'ride' }, payload, {
          bookingId:   bookingId,
          eventType:   eventType,
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

  // ── Public: driver is heading to pickup — notify customer ───────────────────
  /**
   * Called from driver portal when driver taps "Gửi Khách" on an upcoming-ride card.
   * Queues one email to the customer with a tracking/confirmation link.
   * Idempotent: doc ID = "{bookingId}_driver_on_way".
   *
   * @param {object} booking  — flat object with all booking fields (bookingId required)
   * @param {object} driver   — { name, phone }
   * @param {string} lang     — 'vi' | 'en' | 'es'
   */
  function queueDriverOnWay(booking, driver, lang) {
    if (!booking || !booking.customerEmail) return;
    var bkId = booking.bookingId || '';
    if (!bkId) return;
    var token = booking.trackingToken || bkId;
    _queue(bkId, 'driver_on_way', {
      customerEmail:  booking.customerEmail,
      customerName:   booking.customerName || booking.name || '',
      lang:           lang || 'vi',
      serviceType:    booking.serviceType   || '',
      airport:        booking.airport       || '',
      airline:        booking.airline       || '',
      terminal:       booking.terminal      || '',
      datetime:       booking.datetime      || '',
      address:        booking.address       || '',
      pickupAddress:  booking.pickupAddress  || '',
      dropoffAddress: booking.dropoffAddress || '',
      passengers:     booking.passengers     || 1,
      estimatedPrice: booking.estimatedPrice || null,
      trackingToken:  token,
      driverName:     driver ? (driver.name || driver.fullName || '') : '',
      driverPhone:    driver ? (driver.phone || '') : '',
    });
  }

  // ── Public: queue travel booking confirmation + owner notification ──────────
  /**
   * Call immediately after a travel booking is saved to Firestore.
   * Sends two emails:
   *   1. Customer confirmation (only if customerEmail provided)
   *   2. Owner notification to dulichcali21@gmail.com (always)
   *
   * @param {object} booking  — flat booking object (bookingId required)
   * @param {string} lang     — 'vi' | 'en' | 'es'
   */
  function queueTravelConfirmation(booking, lang) {
    if (!booking || !booking.bookingId) return;
    var bkId = booking.bookingId;

    // 1. Customer confirmation email (only when email was provided)
    if (booking.customerEmail) {
      _queue(bkId, 'confirmed', {
        bookingType:     'travel',
        customerEmail:   booking.customerEmail,
        customerName:    booking.customerName  || booking.customer_name || '',
        lang:            lang || 'en',
        packageName:     booking.packageName   || '',
        travelDate:      booking.date          || booking.travel_date  || '',
        travelers:       booking.travelers     || booking.traveler_count || 1,
        bookingMode:     booking.booking_mode  || booking.type         || 'private',
        pickupLocation:  booking.pickup_location || '',
        vehicle:         booking.vehicle        || '',
        total:           booking.total          || 0,
        subtotal:        booking.subtotal        || 0,
        taxes:           booking.taxes           || 0,
      });
    }

    // 2. Owner notification email (always)
    _queue(bkId, 'owner_notify', {
      bookingType:          'travel_owner',
      customerEmail:        'dulichcali21@gmail.com',   // recipient = owner
      bookingCustomerEmail: booking.customerEmail || booking.customer_email || '',
      customerName:         booking.customerName  || booking.customer_name || '',
      customerPhone:        booking.customerPhone || booking.customer_phone || '',
      lang:                 lang || 'en',
      packageName:          booking.packageName   || '',
      travelDate:           booking.date          || booking.travel_date  || '',
      travelers:            booking.travelers     || booking.traveler_count || 1,
      bookingMode:          booking.booking_mode  || booking.type         || 'private',
      pickupAddress:        booking.pickup_address  || booking.pickup_location || '',
      pickupLocation:       booking.pickup_location || '',
      vehicle:              booking.vehicle        || '',
      total:                booking.total          || 0,
      subtotal:             booking.subtotal        || 0,
      taxes:                booking.taxes           || 0,
    });
  }

  // ── Public: queue mobile barber booking confirmation hooks ─────────────────
  /**
   * Call immediately after a mobile barber booking is saved.
   * Writes customer/vendor in-app notifications and optionally queues one
   * customer email when an email address is present. SMS is intentionally not
   * sent from this client hook; Functions keeps Twilio disabled unless approved.
   *
   * @param {object} booking  — mobile barber booking object (id or bookingId required)
   * @param {object} vendor   — mobile barber vendor profile
   * @param {object} service  — selected service, optional fallback to booking fields
   * @param {string} lang     — 'vi' | 'en' | 'es'
   */
  function queueMobileBarberConfirmation(booking, vendor, service, lang) {
    if (!booking) return;
    var bkId = booking.bookingId || booking.id || '';
    if (!bkId) return;

    lang = lang || 'en';
    vendor = vendor || {};
    service = service || {};

    var barberName = vendor.barberName || vendor.businessName || booking.vendorName || 'Mobile Barber';
    var businessName = vendor.businessName || barberName;
    var serviceName = booking.serviceName || service.name || 'Mobile barber service';
    var dateTime = [booking.requestedDate || '', booking.startTime || ''].filter(Boolean).join(' ');
    var addressSummary = [booking.address, booking.city, booking.zip].filter(Boolean).join(', ');
    var duration = booking.durationMinutes || service.durationMinutes || '';
    var price = booking.servicePrice || service.price || '';
    var contactPhone = vendor.phone || booking.vendorPhone || '';

    var COPY = {
      en: {
        customerTitle: 'Mobile barber request received',
        customerMsg: 'Your request with ' + barberName + ' for ' + serviceName + ' on ' + dateTime + ' was received. The barber will confirm or contact you to reschedule.',
        vendorTitle: 'New mobile barber request',
        vendorMsg: (booking.customerName || 'Customer') + ' requested ' + serviceName + (dateTime ? ' on ' + dateTime : '') + '.',
        note: 'To cancel or reschedule, contact the barber before the appointment time.'
      },
      vi: {
        customerTitle: 'Đã nhận yêu cầu mobile barber',
        customerMsg: 'Yêu cầu với ' + barberName + ' cho ' + serviceName + ' vào ' + dateTime + ' đã được nhận. Thợ sẽ xác nhận hoặc liên hệ đổi lịch nếu cần.',
        vendorTitle: 'Yêu cầu mobile barber mới',
        vendorMsg: (booking.customerName || 'Khách') + ' yêu cầu ' + serviceName + (dateTime ? ' vào ' + dateTime : '') + '.',
        note: 'Muốn hủy hoặc đổi lịch, vui lòng liên hệ thợ trước giờ hẹn.'
      },
      es: {
        customerTitle: 'Solicitud de barbero móvil recibida',
        customerMsg: 'Su solicitud con ' + barberName + ' para ' + serviceName + ' el ' + dateTime + ' fue recibida. El barbero confirmará o se comunicará para cambiar la cita.',
        vendorTitle: 'Nueva solicitud de barbero móvil',
        vendorMsg: (booking.customerName || 'Cliente') + ' solicitó ' + serviceName + (dateTime ? ' el ' + dateTime : '') + '.',
        note: 'Para cancelar o reprogramar, comuníquese con el barbero antes de la cita.'
      }
    };
    var copy = COPY[lang] || COPY.en;

    _writeNotification(bkId, 'mobile_barber_confirmed', 'mobile_barber_vendor', vendor.id || booking.vendorId || 'vendor',
      copy.vendorTitle,
      copy.vendorMsg
    );

    if (booking.customerPhone) {
      _writeNotification(bkId, 'mobile_barber_confirmed', 'customer', booking.customerPhone,
        copy.customerTitle,
        copy.customerMsg
      );
    }

    if (booking.customerEmail) {
      _queue(bkId, 'confirmed', {
        bookingType:       'mobile_barber',
        customerEmail:     booking.customerEmail,
        customerName:      booking.customerName || '',
        customerPhone:     booking.customerPhone || '',
        lang:              lang,
        barberName:        barberName,
        businessName:      businessName,
        vendorPhone:       contactPhone,
        serviceName:       serviceName,
        requestedDate:     booking.requestedDate || '',
        startTime:         booking.startTime || '',
        endTime:           booking.endTime || '',
        durationMinutes:   duration,
        servicePrice:      price,
        addressSummary:    addressSummary,
        cancellationNote:  copy.note,
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
    queueDriverOnWay:                 queueDriverOnWay,
    queueTravelConfirmation:          queueTravelConfirmation,
    queueMobileBarberConfirmation:    queueMobileBarberConfirmation,
  };

}());
