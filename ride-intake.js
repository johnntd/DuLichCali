/**
 * ride-intake.js  v3 — Airport & Ride Intake Modal
 * 3-step picker → 3-substep progressive form  |  Location-sorted airports  |  Simple price display
 */
window.RideIntake = (function () {
  'use strict';

  // ── Van constants ────────────────────────────────────────────────────────────
  var VAN = {
    name: '12-Seat Mercedes Sprinter Van',
    mpg: 14, wearPerMile: 0.22, discount: 0.20,
    uber: { base: 10.00, perMile: 5.50, perMin: 0.90, bookingFee: 7.50, minFare: 65.00 },
  };

  // ── Airport data ─────────────────────────────────────────────────────────────
  var AIRPORTS = {
    SNA: { name: 'John Wayne – Orange County', address: '18601 Airport Way, Santa Ana, CA 92707' },
    LAX: { name: 'Los Angeles International',  address: '1 World Way, Los Angeles, CA 90045' },
    SJC: { name: 'San José Mineta',            address: '1701 Airport Blvd, San Jose, CA 95110' },
    SFO: { name: 'San Francisco International',address: 'San Francisco, CA 94128' },
    OAK: { name: 'Oakland International',      address: '1 Airport Dr, Oakland, CA 94621' },
    ONT: { name: 'Ontario International',      address: '2500 E Airport Dr, Ontario, CA 91761' },
    BUR: { name: 'Hollywood Burbank',          address: '2627 N Hollywood Way, Burbank, CA 91505' },
    LGB: { name: 'Long Beach',                 address: '4100 Donald Douglas Dr, Long Beach, CA 90808' },
    SMF: { name: 'Sacramento International',   address: '6900 Airport Blvd, Sacramento, CA 95837' },
    SAN: { name: 'San Diego International',    address: '3225 N Harbor Dr, San Diego, CA 92101' },
    PSP: { name: 'Palm Springs International', address: '3400 E Tahquitz Canyon Way, Palm Springs, CA 92262' },
  };

  // ── State ────────────────────────────────────────────────────────────────────
  var _type    = 'pickup';
  var _subStep = 1;   // 1, 2, or 3 — sub-step within form
  var _quote   = null;
  var _timer   = null;
  var _ac      = {};
  var _busy    = false;
  var _driverVehicle = null; // { name, seats } loaded from Firestore active driver

  // ── Step management ───────────────────────────────────────────────────────────
  function open(type) {
    // Block if driver availability has been checked and no driver is available
    if (window._rideServiceAvailable === false) {
      showUnavailable();
      return;
    }
    _quote = null;
    _busy  = false;
    var modal = document.getElementById('rideIntakeModal');
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    if (type) {
      goForm(type);  // skip picker, go straight to form
    } else {
      showPicker();
    }
    _fetchDriverVehicle(); // async, non-blocking
  }

  function _fetchDriverVehicle() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    firebase.firestore().collection('drivers')
      .where('active', '==', true)
      .get()
      .then(function(snap) {
        if (snap.empty) return;
        // Find first driver that has vehicle info filled in
        var doc = snap.docs.find(function(d) {
          var v = d.data().vehicle;
          return v && v.make;
        }) || snap.docs[0];
        var d = doc.data();
        var v = d.vehicle || {};
        _driverVehicle = {
          name:     [v.make, v.model, v.year].filter(Boolean).join(' ') || 'Tesla Model Y',
          seats:    v.seats || 4,
          driverId: doc.id,
          driverName: d.fullName || ''
        };
        // Update hardcoded vehicle labels in the UI
        var sub = document.getElementById('riPickerSub');
        if (sub) sub.textContent = 'Tài xế chuyên nghiệp · ' + _driverVehicle.name + ' ' + _driverVehicle.seats + ' chỗ';
        var box = document.getElementById('riVehicleBox');
        if (box) box.innerHTML = _driverVehicle.name + '<br>' + _driverVehicle.seats + ' chỗ<br>Chưa bao gồm tip';
      }).catch(function(err) { console.error('[RideIntake] _fetchDriverVehicle failed:', err); });
  }

  function showUnavailable() {
    var modal = document.getElementById('rideIntakeModal');
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setHide('riPicker', true);
    setHide('riFormWrap', true);
    setHide('riSuccess', true);
    setHide('riFooter', true);
    setHide('riBackBtn', true);
    setText('riTitle', 'Dịch Vụ Xe');
    var body = document.getElementById('riBody');
    if (body) body.innerHTML =
      '<div style="text-align:center;padding:2.5rem 1.5rem">' +
        '<div style="font-size:2.5rem;margin-bottom:1rem">🚫</div>' +
        '<p style="font-size:1.05rem;font-weight:600;color:var(--cream);margin:0 0 .5rem">Hiện Không Có Xe</p>' +
        '<p style="font-size:.85rem;color:var(--muted);margin:0 0 1.5rem">Tài xế chưa có lịch trống lúc này.<br>Vui lòng liên hệ trực tiếp để đặt xe.</p>' +
        '<a href="tel:+14089163439" style="display:inline-flex;align-items:center;gap:.45rem;background:var(--gold);color:#07101e;font-weight:700;font-size:.9rem;padding:.7rem 1.4rem;border-radius:999px;text-decoration:none">📞 Gọi Ngay</a>' +
      '</div>';
  }

  function close() {
    var modal = document.getElementById('rideIntakeModal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
    clearTimeout(_timer);
  }

  function showPicker() {
    setHide('riPicker', false);
    setHide('riFormWrap', true);
    setHide('riSuccess', true);
    setHide('riFooter', true);
    setHide('riBackBtn', true);
    setText('riTitle', 'Đặt Xe Đưa Đón');
    var body = document.getElementById('riBody');
    if (body) body.scrollTop = 0;
  }

  function goForm(type) {
    _type    = type;
    _subStep = 1;
    _quote   = null;
    _busy    = false;

    setHide('riPicker', true);
    setHide('riFormWrap', false);
    setHide('riSuccess', true);
    setHide('riFooter', false);
    setHide('riBackBtn', false);

    var titles = { pickup: 'Đón Sân Bay', dropoff: 'Ra Sân Bay', ride: 'Xe Riêng Cao Cấp' };
    setText('riTitle', titles[type] || '');

    resetForm();
    buildAirportOptions();
    showPriceHint();
    goSubStep(1);

    var body = document.getElementById('riBody');
    if (body) body.scrollTop = 0;
    setTimeout(initAutocomplete, 80);
  }

  function backToPicker() {
    clearTimeout(_timer);
    if (_subStep > 1) {
      goSubStep(_subStep - 1);
    } else {
      showPicker();
    }
  }

  // ── Sub-step navigation (progressive disclosure) ──────────────────────────────
  var STEP_LABELS = {
    pickup:  ['Chuyến Bay', 'Điểm Đến', 'Liên Hệ'],
    dropoff: ['Chuyến Bay', 'Điểm Đón', 'Liên Hệ'],
    ride:    ['Lộ Trình',   'Lịch Đi',  'Liên Hệ'],
  };

  function goSubStep(n) {
    _subStep = n;
    var pfx = _type === 'pickup' ? 'ri_p' : _type === 'dropoff' ? 'ri_d' : 'ri_r';

    // Show only the active sub-step
    for (var i = 1; i <= 3; i++) {
      var el = document.getElementById(pfx + '_s' + i);
      if (el) el.hidden = (i !== n);
    }

    // Step indicator
    var labels = STEP_LABELS[_type] || ['', '', ''];
    var ind = document.getElementById('riStepInd');
    if (ind) ind.textContent = 'Bước ' + n + ' / 3  —  ' + labels[n - 1];

    // Footer button: Next on steps 1-2, Confirm on step 3
    var btn = document.getElementById('riSubmit');
    if (btn) {
      var arrowSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
      if (n === 3) {
        btn.innerHTML = 'Xác Nhận Đặt Xe ' + arrowSvg;
        btn.onclick = function () { RideIntake.submit(); };
      } else {
        btn.innerHTML = 'Tiếp theo ' + arrowSvg;
        btn.onclick = function () { RideIntake.nextSubStep(); };
      }
      btn.disabled = false;
    }

    // Price: show hint/box on step 2 (addresses entered)
    if (n === 2) {
      scheduleDistance();
      // Sync vehicle label with actual driver vehicle (may have resolved after modal opened)
      if (_driverVehicle) {
        var box2 = document.getElementById('riVehicleBox');
        if (box2) box2.innerHTML = _driverVehicle.name + '<br>' + _driverVehicle.seats + ' chỗ<br>Chưa bao gồm tip';
      }
    }
    if (n !== 2) { showPriceHint(); }

    // Scroll top
    var body = document.getElementById('riBody');
    if (body) body.scrollTop = 0;

    // Init autocomplete on step where address fields appear
    var acStep = (_type === 'ride') ? 1 : 2;
    if (n === acStep) setTimeout(initAutocomplete, 60);
  }

  function nextSubStep() {
    var errors = validateSubStep(_subStep);
    if (errors.length) {
      showInlineError(errors[0]);
      return;
    }
    if (_subStep < 3) {
      goSubStep(_subStep + 1);
    }
  }

  function validateSubStep(step) {
    var errors = [];
    if (_type === 'pickup') {
      if (step === 1) {
        if (!val('ri_p_airport'))     errors.push('Vui lòng chọn sân bay đến');
        if (!val('ri_arrival_date'))  errors.push('Vui lòng nhập ngày đến');
        if (!val('ri_arrival_time'))  errors.push('Vui lòng nhập giờ hạ cánh');
      } else if (step === 2) {
        if (!val('ri_dropoff_addr'))  errors.push('Vui lòng nhập địa chỉ điểm đến');
        if (!val('ri_p_passengers')) errors.push('Vui lòng chọn số hành khách');
      }
    } else if (_type === 'dropoff') {
      if (step === 1) {
        if (!val('ri_d_airport'))     errors.push('Vui lòng chọn sân bay cần đến');
        if (!val('ri_depart_date'))   errors.push('Vui lòng nhập ngày bay');
        if (!val('ri_depart_time'))   errors.push('Vui lòng nhập giờ cất cánh');
      } else if (step === 2) {
        if (!val('ri_pickup_addr'))   errors.push('Vui lòng nhập địa chỉ đón');
        if (!val('ri_d_passengers')) errors.push('Vui lòng chọn số hành khách');
      }
    } else if (_type === 'ride') {
      if (step === 1) {
        if (!val('ri_from_addr'))     errors.push('Vui lòng nhập điểm đón');
        if (!val('ri_to_addr'))       errors.push('Vui lòng nhập điểm đến');
      } else if (step === 2) {
        if (!val('ri_ride_date'))     errors.push('Vui lòng nhập ngày đi');
        if (!val('ri_ride_time'))     errors.push('Vui lòng nhập giờ xuất phát');
        if (!val('ri_r_passengers')) errors.push('Vui lòng chọn số hành khách');
      }
    }
    return errors;
  }

  function showInlineError(msg) {
    var ind = document.getElementById('riStepInd');
    if (!ind) return;
    var orig = ind.textContent;
    ind.textContent = '⚠ ' + msg;
    ind.style.color = '#e05a5a';
    setTimeout(function () {
      ind.textContent = orig;
      ind.style.color = '';
    }, 2800);
  }

  // ── Airport options sorted by proximity ──────────────────────────────────────
  function buildAirportOptions() {
    if (_type === 'ride') return;

    var selId   = _type === 'pickup' ? 'ri_p_airport' : 'ri_d_airport';
    var badgeId = _type === 'pickup' ? 'riLocBadgeP'  : 'riLocBadgeD';
    var sel     = document.getElementById(selId);
    if (!sel) return;

    // Get sorted airports
    var sorted = [];
    var hasLoc = false;

    if (window.DLCLocation && DLCLocation.state && DLCLocation.state.lat) {
      // Sort by proximity from DLCLocation
      var near = DLCLocation.nearestAirports(20);  // get all, sorted
      sorted = near.filter(function (a) { return !!AIRPORTS[a.code]; });
      hasLoc = true;
    } else {
      // Default order (NorCal first, then SoCal)
      sorted = ['SJC','SFO','OAK','SMF','LAX','SNA','BUR','LGB','ONT','SAN','PSP'].map(function (code) {
        return { code: code, km: null };
      });
    }

    // Build options
    sel.innerHTML = '<option value="">— Chọn sân bay —</option>';
    sorted.forEach(function (a) {
      var ap = AIRPORTS[a.code];
      if (!ap) return;
      var distMi  = a.km !== null ? Math.round(a.km * 0.621371) : null;
      var distTxt = distMi !== null ? '  (' + distMi + ' mi)' : '';
      var opt = document.createElement('option');
      opt.value = a.code;
      opt.textContent = a.code + ' — ' + ap.name + distTxt;
      sel.appendChild(opt);
    });

    // Show/hide location badge
    var badge = document.getElementById(badgeId);
    if (badge) badge.hidden = !hasLoc;
  }

  // ── Form reset ───────────────────────────────────────────────────────────────
  function resetForm() {
    var f = document.getElementById('riForm');
    if (f) f.reset();

    setHide('riPickupFields',  _type !== 'pickup');
    setHide('riDropoffFields', _type !== 'dropoff');
    setHide('riRideFields',    _type !== 'ride');
    // Button state managed by goSubStep()
  }

  // ── Google Places Autocomplete ────────────────────────────────────────────────
  function initAutocomplete() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;
    var ids = { pickup: ['ri_dropoff_addr'], dropoff: ['ri_pickup_addr'], ride: ['ri_from_addr','ri_to_addr'] };
    (ids[_type] || []).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input || _ac[id]) return;
      var ac = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address'],
      });
      ac.addListener('place_changed', function () {
        var p = ac.getPlace();
        if (p && p.formatted_address) input.value = p.formatted_address;
        scheduleDistance();
      });
      _ac[id] = ac;
    });
  }

  // ── Pricing ──────────────────────────────────────────────────────────────────
  function gasPrice() { return window._gasCaliPrice || 4.80; }

  function calcQuote(miles, minutes) {
    var gas  = gasPrice();
    var u    = VAN.uber;
    var uberRaw = u.base + u.bookingFee + (miles * u.perMile) + (minutes * u.perMin);
    var uberEst = Math.max(uberRaw, u.minFare);
    var fuel    = (miles / VAN.mpg) * gas;
    var wear    = miles * VAN.wearPerMile;
    var dlcRaw  = (uberEst + fuel + wear) * (1 - VAN.discount);
    var dlcPrice = Math.ceil(dlcRaw / 5) * 5;
    return {
      miles: Math.round(miles), minutes: Math.round(minutes),
      uberEstimate: Math.round(uberEst + fuel + wear),
      dlcPrice: dlcPrice,
      savings: Math.round(uberEst + fuel + wear) - dlcPrice,
    };
  }

  // ── Distance fetch ────────────────────────────────────────────────────────────
  function scheduleDistance() {
    clearTimeout(_timer);
    _timer = setTimeout(fetchDistance, 900);
  }

  function getOriginDest() {
    if (_type === 'pickup') {
      var ap = val('ri_p_airport');
      var to = val('ri_dropoff_addr');
      if (!ap || !to) return null;
      return { origin: AIRPORTS[ap] ? AIRPORTS[ap].address : ap, destination: to };
    }
    if (_type === 'dropoff') {
      var from = val('ri_pickup_addr');
      var ap2  = val('ri_d_airport');
      if (!from || !ap2) return null;
      return { origin: from, destination: AIRPORTS[ap2] ? AIRPORTS[ap2].address : ap2 };
    }
    var a = val('ri_from_addr'), b = val('ri_to_addr');
    if (!a || !b) return null;
    return { origin: a, destination: b };
  }

  function fetchDistance() {
    var pair = getOriginDest();
    if (!pair) { showPriceHint(); return; }
    if (typeof google === 'undefined' || !google.maps) { showPriceHint(); return; }
    showPriceLoading();

    // ── Try new Routes API first; fall back to DistanceMatrixService ──
    function legacyDistance() {
      new google.maps.DistanceMatrixService().getDistanceMatrix(
        { origins: [pair.origin], destinations: [pair.destination], travelMode: google.maps.TravelMode.DRIVING },
        function (resp, status) {
          if (status !== 'OK') { showPriceHint('Không tìm được tuyến đường.'); return; }
          var el = resp.rows[0] && resp.rows[0].elements[0];
          if (!el || el.status !== 'OK') { showPriceHint('Không tìm được tuyến đường.'); return; }
          _quote = calcQuote(el.distance.value / 1609.34, el.duration.value / 60);
          showPrice(_quote);
        }
      );
    }

    google.maps.importLibrary('routes').then(function (lib) {
      // RouteMatrix may be a direct export OR under the global google.maps.routes namespace
      var RouteMatrix = (lib && lib.RouteMatrix)
                     || (google.maps.routes && google.maps.routes.RouteMatrix);
      if (!RouteMatrix) { legacyDistance(); return; }
      new RouteMatrix().computeRouteMatrix({
        origins:      [{ waypoint: { address: pair.origin } }],
        destinations: [{ waypoint: { address: pair.destination } }],
        travelMode:   'DRIVE',
      }).then(function (resp) {
        if (!resp || !resp.length || !resp[0].distanceMeters) throw new Error('no-route');
        var el        = resp[0];
        var distMiles = el.distanceMeters / 1609.34;
        var durSec    = typeof el.duration === 'number'            ? el.duration
                      : (el.duration && 'seconds' in el.duration) ? Number(el.duration.seconds)
                      : parseInt(String(el.duration));
        _quote = calcQuote(distMiles, durSec / 60);
        showPrice(_quote);
      }).catch(legacyDistance);
    }).catch(legacyDistance);
  }

  // ── Price display ─────────────────────────────────────────────────────────────
  function showPriceHint(msg) {
    setHide('riPriceLoading', true);
    setHide('riPriceBox',     true);
    setText('riPriceHint', msg || 'Nhập địa chỉ để xem giá ước tính');
    setHide('riPriceHint', false);
    setHide('riFooterEst', true);
  }

  function showPriceLoading() {
    setHide('riPriceHint',    true);
    setHide('riPriceBox',     true);
    setHide('riPriceLoading', false);
    setHide('riFooterEst',    true);
  }

  function showPrice(q) {
    setHide('riPriceHint',    true);
    setHide('riPriceLoading', true);

    setText('riPriceAmt',  '~$' + q.dlcPrice);
    setText('riPriceSave', 'Tiết kiệm ~$' + q.savings + ' so với Uber');
    setHide('riPriceBox', false);

    setText('riFooterAmt', '~$' + q.dlcPrice);
    setHide('riFooterEst', false);
  }

  // ── Validation ────────────────────────────────────────────────────────────────
  function validate() {
    var e = [];
    if (_type === 'pickup') {
      if (!val('ri_p_airport'))    e.push('Chọn sân bay');
      if (!val('ri_arrival_date')) e.push('Ngày đến');
      if (!val('ri_arrival_time')) e.push('Giờ đến');
      if (!val('ri_dropoff_addr')) e.push('Địa chỉ điểm đến');
      if (!val('ri_p_passengers')) e.push('Số hành khách');
      if (!val('ri_p_name'))       e.push('Tên');
      if (!val('ri_p_phone'))      e.push('Số điện thoại');
    } else if (_type === 'dropoff') {
      if (!val('ri_pickup_addr'))  e.push('Địa chỉ đón');
      if (!val('ri_d_airport'))    e.push('Chọn sân bay');
      if (!val('ri_depart_date'))  e.push('Ngày bay');
      if (!val('ri_depart_time'))  e.push('Giờ bay');
      if (!val('ri_d_passengers')) e.push('Số hành khách');
      if (!val('ri_d_name'))       e.push('Tên');
      if (!val('ri_d_phone'))      e.push('Số điện thoại');
    } else {
      if (!val('ri_from_addr'))    e.push('Điểm đón');
      if (!val('ri_to_addr'))      e.push('Điểm đến');
      if (!val('ri_ride_date'))    e.push('Ngày đi');
      if (!val('ri_ride_time'))    e.push('Giờ đi');
      if (!val('ri_r_passengers')) e.push('Số hành khách');
      if (!val('ri_r_name'))       e.push('Tên');
      if (!val('ri_r_phone'))      e.push('Số điện thoại');
    }
    return e;
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  function submit() {
    if (_busy) return;
    var errors = validate();
    if (errors.length) {
      alert('Vui lòng điền đầy đủ:\n• ' + errors.join('\n• '));
      return;
    }
    _busy = true;
    var btn = document.getElementById('riSubmit');
    if (btn) { btn.textContent = 'Đang xử lý...'; btn.disabled = true; }

    var bookingId = generateId();
    var data      = buildBookingData(bookingId);

    if (typeof firebase === 'undefined' || !firebase.firestore) {
      onSuccess(bookingId);
      return;
    }
    var db = firebase.firestore();
    var ts = firebase.firestore.FieldValue.serverTimestamp();
    db.collection('bookings').doc(bookingId).set(data)
      .then(function () {
        // Admin notification
        return db.collection('vendors').doc('admin-dlc').collection('notifications').add({
          type: 'new_booking', title: '🚐 Đặt Xe Mới — ' + svcLabel(),
          message: buildAdminMsg(data), bookingId: bookingId, read: false, createdAt: ts,
        });
      })
      .then(function () {
        // Driver notification — active drivers will see this in their dashboard
        return db.collection('rideNotifications').add({
          bookingId:    bookingId,
          serviceType:  data.serviceType,
          serviceLabel: svcLabel(),
          passengers:   data.passengers || 1,
          customerName: data.customerName || '',
          estimatedPrice: data.estimatedPrice || null,
          estimatedMiles: data.estimatedMiles || null,
          airport:      data.airport || null,
          arrivalDate:  data.arrivalDate || data.departureDate || null,
          arrivalTime:  data.arrivalTime || data.departureTime || null,
          status:       'new',
          createdAt:    ts,
        });
      })
      .then(function () { onSuccess(bookingId); })
      .catch(function (err) { console.error(err); onError(); });
  }

  function buildBookingData(bookingId) {
    var paxId = _type === 'pickup' ? 'ri_p_passengers' : _type === 'dropoff' ? 'ri_d_passengers' : 'ri_r_passengers';
    var base = {
      bookingId: bookingId, status: 'pending',
      vehicle: _driverVehicle ? _driverVehicle.name : VAN.name,
      driverId: _driverVehicle ? _driverVehicle.driverId : null,
      serviceType: _type === 'ride' ? 'private_ride' : (_type === 'pickup' ? 'airport_pickup' : 'airport_dropoff'),
      passengers:    parseInt(val(paxId) || '1', 10),
      customerName:  val(_type === 'pickup' ? 'ri_p_name'  : _type === 'dropoff' ? 'ri_d_name'  : 'ri_r_name'),
      customerPhone: val(_type === 'pickup' ? 'ri_p_phone' : _type === 'dropoff' ? 'ri_d_phone' : 'ri_r_phone'),
      notes:         val(_type === 'pickup' ? 'ri_p_notes' : _type === 'dropoff' ? 'ri_d_notes' : 'ri_r_notes') || '',
      estimatedPrice: _quote ? _quote.dlcPrice : null,
      estimatedMiles: _quote ? _quote.miles    : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (_type === 'pickup') {
      Object.assign(base, {
        airport: val('ri_p_airport'), airline: val('ri_p_flight') || '',
        terminal: val('ri_p_terminal') || '', arrivalDate: val('ri_arrival_date'),
        arrivalTime: val('ri_arrival_time'), dropoffAddress: val('ri_dropoff_addr'),
        luggageCount: parseInt(val('ri_p_luggage') || '0', 10),
      });
    } else if (_type === 'dropoff') {
      Object.assign(base, {
        pickupAddress: val('ri_pickup_addr'), airport: val('ri_d_airport'),
        airline: val('ri_d_flight') || '', terminal: val('ri_d_terminal') || '',
        departureDate: val('ri_depart_date'), departureTime: val('ri_depart_time'),
        luggageCount: parseInt(val('ri_d_luggage') || '0', 10),
      });
    } else {
      Object.assign(base, {
        pickupAddress: val('ri_from_addr'), dropoffAddress: val('ri_to_addr'),
        rideDate: val('ri_ride_date'), rideTime: val('ri_ride_time'),
      });
    }
    return base;
  }

  function buildAdminMsg(d) {
    var lines = ['Mã đặt: ' + d.bookingId, 'Dịch vụ: ' + svcLabel(),
      'Khách: ' + d.customerName + ' · ' + d.customerPhone, 'Hành khách: ' + d.passengers];
    if (d.airport)        lines.push('Sân bay: ' + d.airport);
    if (d.arrivalDate)    lines.push('Ngày đến: ' + d.arrivalDate + ' ' + (d.arrivalTime || ''));
    if (d.departureDate)  lines.push('Ngày bay: ' + d.departureDate + ' ' + (d.departureTime || ''));
    if (d.dropoffAddress) lines.push('Điểm đến: ' + d.dropoffAddress);
    if (d.pickupAddress)  lines.push('Điểm đón: ' + d.pickupAddress);
    if (d.rideDate)       lines.push('Ngày đi: ' + d.rideDate + ' ' + (d.rideTime || ''));
    if (d.estimatedPrice) lines.push('Giá ước tính: $' + d.estimatedPrice);
    if (d.notes)          lines.push('Ghi chú: ' + d.notes);
    return lines.join('\n');
  }

  function onSuccess(bookingId) {
    _busy = false;
    setHide('riFormWrap', true);
    setHide('riFooter',   true);
    setText('riSuccessId', bookingId);
    setHide('riSuccess',   false);
    setHide('riBackBtn',   true);
    setText('riTitle', 'Đặt Xe Thành Công!');
    // Repurpose footer as close button
    var footer = document.getElementById('riFooter');
    if (footer) {
      footer.hidden = false;
      var btn = document.getElementById('riSubmit');
      if (btn) { btn.textContent = 'Đóng'; btn.disabled = false; btn.onclick = close; }
    }
  }

  function onError() {
    _busy = false;
    var btn = document.getElementById('riSubmit');
    if (btn) {
      btn.innerHTML = 'Xác Nhận Đặt Xe <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
      btn.disabled = false;
    }
    alert('Đặt chỗ không thành công. Vui lòng gọi (408) 916-3439 để đặt trực tiếp.');
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function val(id)         { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function setText(id, t)  { var e = document.getElementById(id); if (e) e.textContent = t; }
  function setHide(id, h)  { var e = document.getElementById(id); if (e) e.hidden = !!h; }
  function svcLabel()      { return { pickup:'Đón Sân Bay', dropoff:'Ra Sân Bay', ride:'Xe Riêng' }[_type] || _type; }
  function generateId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', id = 'DLC-', arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    for (var i = 0; i < arr.length; i++) id += chars[arr[i] % chars.length];
    return id;
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  return {
    open:         open,
    close:        close,
    goForm:       goForm,
    backToPicker: backToPicker,
    nextSubStep:  nextSubStep,
    submit:       submit,
    schedule:     scheduleDistance,
    AIRPORTS:     AIRPORTS,
  };

}());
