/**
 * ride-intake.js — Airport & Ride service intake modal
 *
 * Handles: Airport Pickup · Airport Dropoff · Private Ride
 * Pricing: Uber 12-seat charter rate + fuel surcharge + wear/tear → 20% discount
 * Booking: Firestore write + admin notification → user confirmation
 *
 * Field ID scheme (avoids duplicate-ID bugs in multi-fieldset form):
 *   Pickup:  ri_p_airport, ri_p_flight, ri_p_terminal, ri_p_passengers,
 *            ri_p_luggage, ri_p_name, ri_p_phone, ri_p_notes
 *   Dropoff: ri_d_airport, ri_d_flight, ri_d_terminal, ri_d_passengers,
 *            ri_d_luggage, ri_d_name, ri_d_phone, ri_d_notes
 *   Ride:    ri_r_passengers, ri_r_name, ri_r_phone, ri_r_notes
 *   Shared (unique per form): ri_arrival_date, ri_arrival_time,
 *            ri_dropoff_addr, ri_pickup_addr, ri_depart_date, ri_depart_time,
 *            ri_from_addr, ri_to_addr, ri_ride_date, ri_ride_time
 */
window.RideIntake = (function () {
  'use strict';

  // ── 12-Seat Van — only vehicle operated ─────────────────────────────────────
  var VAN = {
    name: '12-Seat Mercedes Sprinter Van',
    seats: 12,
    mpg: 14,
    wearPerMile: 0.22,
    discount: 0.20,
    uber: {
      base: 10.00,
      perMile: 5.50,
      perMin: 0.90,
      bookingFee: 7.50,
      minFare: 65.00,
    },
  };

  // ── Airport lookup ───────────────────────────────────────────────────────────
  var AIRPORTS = {
    SNA: { name: 'John Wayne – Orange County (SNA)', address: '18601 Airport Way, Santa Ana, CA 92707' },
    LAX: { name: 'Los Angeles International (LAX)', address: '1 World Way, Los Angeles, CA 90045' },
    SJC: { name: 'San José Mineta (SJC)',            address: '1701 Airport Blvd, San Jose, CA 95110' },
    SFO: { name: 'San Francisco International (SFO)', address: 'San Francisco, CA 94128' },
    OAK: { name: 'Oakland International (OAK)',       address: '1 Airport Dr, Oakland, CA 94621' },
    ONT: { name: 'Ontario International (ONT)',       address: '2500 E Airport Dr, Ontario, CA 91761' },
    BUR: { name: 'Hollywood Burbank (BUR)',           address: '2627 N Hollywood Way, Burbank, CA 91505' },
    LGB: { name: 'Long Beach (LGB)',                  address: '4100 Donald Douglas Dr, Long Beach, CA 90808' },
    SMF: { name: 'Sacramento International (SMF)',    address: '6900 Airport Blvd, Sacramento, CA 95837' },
    SAN: { name: 'San Diego International (SAN)',     address: '3225 N Harbor Dr, San Diego, CA 92101' },
  };

  // ── State ────────────────────────────────────────────────────────────────────
  var _type   = 'pickup';   // 'pickup' | 'dropoff' | 'ride'
  var _quote  = null;
  var _timer  = null;
  var _acRefs = {};          // Google Places Autocomplete instances
  var _busy   = false;

  // ── Pricing helpers ──────────────────────────────────────────────────────────
  function gasPrice() {
    return window._gasCaliPrice || 4.80;
  }

  function calcQuote(miles, minutes) {
    var gas  = gasPrice();
    var u    = VAN.uber;
    var uberRaw = u.base + u.bookingFee + (miles * u.perMile) + (minutes * u.perMin);
    var uberEst = Math.max(uberRaw, u.minFare);
    var fuel    = (miles / VAN.mpg) * gas;
    var wear    = miles * VAN.wearPerMile;
    var dlcRaw  = uberEst * (1 - VAN.discount);
    var dlcPrice = Math.ceil(dlcRaw / 5) * 5;   // round up to nearest $5
    return {
      miles:        Math.round(miles),
      minutes:      Math.round(minutes),
      uberEstimate: Math.round(uberEst),
      fuel:         Math.round(fuel * 100) / 100,
      wear:         Math.round(wear * 100) / 100,
      dlcPrice:     dlcPrice,
      savings:      Math.round(uberEst) - dlcPrice,
      gas:          gas,
    };
  }

  // ── Origin / destination resolver ───────────────────────────────────────────
  function getOriginDest() {
    if (_type === 'pickup') {
      var ap  = val('ri_p_airport');
      var to  = val('ri_dropoff_addr');
      if (!ap || !to) return null;
      return { origin: AIRPORTS[ap] ? AIRPORTS[ap].address : ap, destination: to };
    }
    if (_type === 'dropoff') {
      var from = val('ri_pickup_addr');
      var ap2  = val('ri_d_airport');
      if (!from || !ap2) return null;
      return { origin: from, destination: AIRPORTS[ap2] ? AIRPORTS[ap2].address : ap2 };
    }
    if (_type === 'ride') {
      var a = val('ri_from_addr');
      var b = val('ri_to_addr');
      if (!a || !b) return null;
      return { origin: a, destination: b };
    }
    return null;
  }

  // ── Google Maps distance request ─────────────────────────────────────────────
  function scheduleDistance() {
    clearTimeout(_timer);
    _timer = setTimeout(fetchDistance, 900);
  }

  function fetchDistance() {
    var pair = getOriginDest();
    if (!pair) { showHint('Nhập địa chỉ đón và điểm đến để xem giá ước tính.'); return; }
    if (typeof google === 'undefined' || !google.maps) {
      showHint('Google Maps chưa tải — thử lại sau.');
      return;
    }
    showLoading();
    new google.maps.DistanceMatrixService().getDistanceMatrix(
      { origins: [pair.origin], destinations: [pair.destination],
        travelMode: google.maps.TravelMode.DRIVING },
      function (resp, status) {
        if (status !== 'OK') { showHint('Không tìm được tuyến đường.'); return; }
        var el = resp.rows[0] && resp.rows[0].elements[0];
        if (!el || el.status !== 'OK') { showHint('Không tìm được tuyến đường.'); return; }
        var miles   = el.distance.value / 1609.34;
        var minutes = el.duration.value / 60;
        _quote = calcQuote(miles, minutes);
        showResult(_quote);
      }
    );
  }

  // ── Estimate panel display ────────────────────────────────────────────────────
  function showHint(msg) {
    setDisplay('riEstLoading', false);
    setDisplay('riEstBody',    false);
    setText('riEstHint', msg);
    setDisplay('riEstHint',    true);
    setDisplay('riFooterPrice', false);
  }

  function showLoading() {
    setDisplay('riEstHint',    false);
    setDisplay('riEstBody',    false);
    setDisplay('riEstLoading', true);
    setDisplay('riFooterPrice', false);
  }

  function showResult(q) {
    setDisplay('riEstLoading', false);
    setDisplay('riEstHint',    false);

    setText('riEstMiles',    q.miles + ' mi  ·  ~' + q.minutes + ' phút lái xe');
    setText('riEstUberBase', '$' + VAN.uber.base.toFixed(2) + ' base + $' + VAN.uber.bookingFee.toFixed(2) + ' booking');
    setText('riEstUberDist', '$' + (q.miles * VAN.uber.perMile).toFixed(2)   + '  (' + q.miles + ' mi × $' + VAN.uber.perMile + ')');
    setText('riEstUberTime', '$' + (q.minutes * VAN.uber.perMin).toFixed(2)  + '  (' + q.minutes + ' min × $' + VAN.uber.perMin + ')');
    setText('riEstFuel',     '$' + q.fuel.toFixed(2) + '  (' + q.miles + ' mi ÷ ' + VAN.mpg + ' mpg × $' + q.gas.toFixed(2) + '/gal)');
    setText('riEstWear',     '$' + q.wear.toFixed(2) + '  (' + q.miles + ' mi × $' + VAN.wearPerMile + ')');
    setText('riEstUberTotal','~$' + q.uberEstimate);
    setText('riEstDiscount', '−$' + (q.uberEstimate - q.dlcPrice));
    setText('riEstFinal',    '$' + q.dlcPrice);
    setText('riFooterAmount','$' + q.dlcPrice);

    setDisplay('riEstBody',    true);
    setDisplay('riFooterPrice', true);
  }

  // ── Open / close ──────────────────────────────────────────────────────────────
  function open(type) {
    _type  = type || 'pickup';
    _quote = null;
    _busy  = false;
    var modal = document.getElementById('rideIntakeModal');
    if (!modal) return;

    resetForm();
    activateTab(_type);
    renderTitle(_type);
    showHint('Nhập địa chỉ đón và điểm đến để xem giá ước tính.');

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var body = document.getElementById('riBody');
    if (body) body.scrollTop = 0;

    setTimeout(initAutocomplete, 80);
  }

  function close() {
    var modal = document.getElementById('rideIntakeModal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
    clearTimeout(_timer);
  }

  function switchType(type) {
    _type  = type;
    _quote = null;
    activateTab(type);
    renderTitle(type);
    resetForm();
    showHint('Nhập địa chỉ đón và điểm đến để xem giá ước tính.');
    setTimeout(initAutocomplete, 60);
  }

  // ── Form helpers ─────────────────────────────────────────────────────────────
  function resetForm() {
    var f = document.getElementById('riForm');
    if (f) f.reset();
    setDisplay('riPickupFields',  _type === 'pickup');
    setDisplay('riDropoffFields', _type === 'dropoff');
    setDisplay('riRideFields',    _type === 'ride');
    setDisplay('riFooterPrice', false);
    var btn = document.getElementById('riSubmit');
    if (btn) {
      btn.textContent = 'Xác Nhận Đặt Xe';
      btn.disabled = false;
      btn.onclick = function () { RideIntake.submit(); };
    }
    setDisplay('riSuccess', false);
    setDisplay('riFormWrap', true);
  }

  function activateTab(type) {
    document.querySelectorAll('.ri-tab').forEach(function (t) {
      t.classList.toggle('ri-tab--active', t.dataset.type === type);
    });
  }

  function renderTitle(type) {
    var titles = { pickup: '🛬 Đón Sân Bay', dropoff: '🛫 Ra Sân Bay', ride: '🚗 Xe Riêng Cao Cấp' };
    setText('riTitle', titles[type] || '');
  }

  // ── Google Places Autocomplete ───────────────────────────────────────────────
  function initAutocomplete() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;

    var ids = {
      pickup:  ['ri_dropoff_addr'],
      dropoff: ['ri_pickup_addr'],
      ride:    ['ri_from_addr', 'ri_to_addr'],
    };

    (ids[_type] || []).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input || _acRefs[id]) return;
      var ac = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry'],
      });
      ac.addListener('place_changed', function () {
        var place = ac.getPlace();
        if (place && place.formatted_address) {
          input.value = place.formatted_address;
        }
        scheduleDistance();
      });
      _acRefs[id] = ac;
    });
  }

  // ── Form validation ───────────────────────────────────────────────────────────
  function validate() {
    var errors = [];

    if (_type === 'pickup') {
      if (!val('ri_p_airport'))       errors.push('Chọn sân bay');
      if (!val('ri_arrival_date'))    errors.push('Ngày đến');
      if (!val('ri_arrival_time'))    errors.push('Giờ đến');
      if (!val('ri_dropoff_addr'))    errors.push('Địa chỉ điểm đến');
      if (!val('ri_p_passengers'))    errors.push('Số hành khách');
      if (!val('ri_p_name'))          errors.push('Tên');
      if (!val('ri_p_phone'))         errors.push('Số điện thoại');
    } else if (_type === 'dropoff') {
      if (!val('ri_pickup_addr'))     errors.push('Địa chỉ đón');
      if (!val('ri_d_airport'))       errors.push('Chọn sân bay');
      if (!val('ri_depart_date'))     errors.push('Ngày bay');
      if (!val('ri_depart_time'))     errors.push('Giờ bay');
      if (!val('ri_d_passengers'))    errors.push('Số hành khách');
      if (!val('ri_d_name'))          errors.push('Tên');
      if (!val('ri_d_phone'))         errors.push('Số điện thoại');
    } else {
      if (!val('ri_from_addr'))       errors.push('Địa chỉ đón');
      if (!val('ri_to_addr'))         errors.push('Điểm đến');
      if (!val('ri_ride_date'))       errors.push('Ngày đi');
      if (!val('ri_ride_time'))       errors.push('Giờ đi');
      if (!val('ri_r_passengers'))    errors.push('Số hành khách');
      if (!val('ri_r_name'))          errors.push('Tên');
      if (!val('ri_r_phone'))         errors.push('Số điện thoại');
    }

    return errors;
  }

  // ── Firestore booking submit ──────────────────────────────────────────────────
  function submit() {
    if (_busy) return;
    var errors = validate();
    if (errors.length) {
      alert('Vui lòng điền đầy đủ: ' + errors.join(', '));
      return;
    }

    _busy = true;
    var btn = document.getElementById('riSubmit');
    if (btn) { btn.textContent = 'Đang xử lý...'; btn.disabled = true; }

    var bookingId = generateId();
    var now       = new Date();
    var data      = buildBookingData(bookingId, now);

    if (typeof firebase === 'undefined' || !firebase.firestore) {
      onSuccess(bookingId);
      return;
    }

    var db = firebase.firestore();
    db.collection('bookings').doc(bookingId).set(data)
      .then(function () {
        return db.collection('vendors').doc('admin-dlc')
          .collection('notifications').add({
            type:      'new_booking',
            title:     '🚐 Đặt Xe Mới — ' + serviceLabel(),
            message:   buildAdminMsg(data),
            bookingId: bookingId,
            read:      false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
      })
      .then(function () { onSuccess(bookingId); })
      .catch(function (err) {
        console.error('Booking save failed:', err);
        onError();
      });
  }

  function buildBookingData(bookingId, now) {
    // Passengers field is type-specific
    var paxId = _type === 'pickup' ? 'ri_p_passengers'
              : _type === 'dropoff' ? 'ri_d_passengers'
              : 'ri_r_passengers';
    var pax = parseInt(val(paxId) || '1', 10);

    var base = {
      bookingId:   bookingId,
      status:      'pending',
      serviceType: _type === 'ride' ? 'private_ride' : (_type === 'pickup' ? 'airport_pickup' : 'airport_dropoff'),
      vehicle:     VAN.name,
      passengers:  pax,
      customerName:  _type === 'pickup' ? val('ri_p_name')
                   : _type === 'dropoff' ? val('ri_d_name')
                   : val('ri_r_name'),
      customerPhone: _type === 'pickup' ? val('ri_p_phone')
                   : _type === 'dropoff' ? val('ri_d_phone')
                   : val('ri_r_phone'),
      notes:         _type === 'pickup' ? (val('ri_p_notes') || '')
                   : _type === 'dropoff' ? (val('ri_d_notes') || '')
                   : (val('ri_r_notes') || ''),
      estimatedPrice: _quote ? _quote.dlcPrice : null,
      estimatedMiles: _quote ? _quote.miles    : null,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (_type === 'pickup') {
      Object.assign(base, {
        airport:        val('ri_p_airport'),
        airline:        val('ri_p_flight')    || '',
        terminal:       val('ri_p_terminal')  || '',
        arrivalDate:    val('ri_arrival_date'),
        arrivalTime:    val('ri_arrival_time'),
        dropoffAddress: val('ri_dropoff_addr'),
        luggageCount:   parseInt(val('ri_p_luggage') || '0', 10),
      });
    } else if (_type === 'dropoff') {
      Object.assign(base, {
        pickupAddress:  val('ri_pickup_addr'),
        airport:        val('ri_d_airport'),
        airline:        val('ri_d_flight')    || '',
        terminal:       val('ri_d_terminal')  || '',
        departureDate:  val('ri_depart_date'),
        departureTime:  val('ri_depart_time'),
        luggageCount:   parseInt(val('ri_d_luggage') || '0', 10),
      });
    } else {
      Object.assign(base, {
        pickupAddress:  val('ri_from_addr'),
        dropoffAddress: val('ri_to_addr'),
        rideDate:       val('ri_ride_date'),
        rideTime:       val('ri_ride_time'),
      });
    }

    return base;
  }

  function buildAdminMsg(d) {
    var lines = [
      'Mã đặt: ' + d.bookingId,
      'Dịch vụ: ' + serviceLabel(),
      'Khách: ' + d.customerName + ' · ' + d.customerPhone,
      'Hành khách: ' + d.passengers,
    ];
    if (d.airport)        lines.push('Sân bay: ' + d.airport);
    if (d.airline)        lines.push('Chuyến bay: ' + d.airline);
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
    setDisplay('riFormWrap', false);
    setDisplay('riEstimate', false);
    setDisplay('riFooterPrice', false);
    setText('riSuccessId', bookingId);
    setDisplay('riSuccess', true);
    var btn = document.getElementById('riSubmit');
    if (btn) { btn.textContent = 'Đóng'; btn.disabled = false; btn.onclick = close; }
  }

  function onError() {
    _busy = false;
    var btn = document.getElementById('riSubmit');
    if (btn) { btn.textContent = 'Xác Nhận Đặt Xe'; btn.disabled = false; }
    alert('Đặt chỗ không thành công. Vui lòng gọi (408) 916-3439 để đặt trực tiếp.');
  }

  // ── Utility ───────────────────────────────────────────────────────────────────
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }
  function setText(id, t) {
    var el = document.getElementById(id);
    if (el) el.textContent = t;
  }
  function setDisplay(id, show) {
    var el = document.getElementById(id);
    if (el) el.hidden = !show;
  }
  function serviceLabel() {
    return { pickup: 'Đón Sân Bay', dropoff: 'Ra Sân Bay', ride: 'Xe Riêng' }[_type] || _type;
  }
  function generateId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var id = 'DLC-';
    var arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    for (var i = 0; i < arr.length; i++) id += chars[arr[i] % chars.length];
    return id;
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  return {
    open:        open,
    close:       close,
    switchType:  switchType,
    submit:      submit,
    schedule:    scheduleDistance,
    AIRPORTS:    AIRPORTS,
  };

}());
