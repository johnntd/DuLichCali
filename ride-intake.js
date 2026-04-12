/**
 * ride-intake.js  v3 — Airport & Ride Intake Modal
 * 3-step picker → 3-substep progressive form  |  Location-sorted airports  |  Simple price display
 */
window.RideIntake = (function () {
  'use strict';

  // ── i18n strings (fare card, step navigation, review card, success screen) ────
  // Language read from ?lang= URL param; defaults to 'en'.
  var _RIDE_T = {
    en: {
      minSuffix:    'min',
      savings:      function(n) { return 'Save ~$' + n + ' vs Uber'; },
      deadhead:     function(mi) { return ' · Driver ~' + mi + ' mi away'; },
      marketLabel:  'Market rate (UberXL)',
      dlcLabel:     'DLC price',
      mapsLink:     'View route on Maps',
      viewRoute:    'View route',
      pickupLbl:    'Pickup',
      dropoffLbl:   'Dropoff',
      priceEst:     function(p, s) { return '~$' + p + ' est · Save ~$' + s + ' vs Uber'; },
      // Step navigation
      stepPrefix:   function(n) { return 'Step ' + n + ' of 6'; },
      stepLabels:   {
        pickup:  ['Airport', 'Drop-off', 'Arrival Time', 'Trip Details', 'Your Info', 'Review'],
        dropoff: ['Pickup Address', 'Airport', 'Departure Time', 'Trip Details', 'Your Info', 'Review'],
        ride:    ['Pickup', 'Destination', 'Schedule', 'Passengers', 'Your Info', 'Review'],
      },
      stepQuestions: {
        pickup:  ['Arriving at which airport?', 'Where should we take you?', 'When does your flight land?', 'Trip details', 'Your contact info', 'Review your booking'],
        dropoff: ['Where should we pick you up?', 'Flying out of which airport?', 'When does your flight depart?', 'Trip details', 'Your contact info', 'Review your booking'],
        ride:    ['Where are you starting from?', 'Where are you headed?', 'When do you need the ride?', 'How many passengers?', 'Your contact info', 'Review your booking'],
      },
      nextBtn:      'Continue',
      submitBtn:    'Confirm Booking',
      // Booking review card (step 3 pre-submit summary)
      reviewHeading:    'Your Ride Summary',
      reviewRoute:      'Route',
      reviewFare:       'Estimate',
      reviewPassengers: 'Passengers',
      reviewVehicle:    'Vehicle',
      // Success screen
      successTitle: 'Booking Confirmed!',
      successSub:   'Your booking ID:',
      successMsg:   'We\'ll confirm within <strong>30 minutes</strong>.<br>Urgent? Call <a href="tel:4089163439">(408) 916-3439</a>.',
      closeBtn:     'Close',
      // ── Picker, labels, placeholders, validation ──
      pickerTitle:      'Book a Ride',
      pickerSubPfx:     'Professional driver · ',
      pickerSuffix:     ' seats',
      pickupCardTitle:  'Airport Pickup',
      pickupCardDesc:   'Arriving · Driver waits at Arrivals',
      dropoffCardTitle: 'Airport Drop-off',
      dropoffCardDesc:  'Departing · On-time door pickup',
      rideCardTitle:    'Private Ride',
      rideCardDesc:     'Any destination · No airport needed',
      vanBadge:         'Save <strong>20%</strong> vs Uber &nbsp;·&nbsp; Book ahead · Fixed price',
      labelAirportP:    'Arrival airport',    labelAirportD:    'Departure airport',
      labelDropoffAddr: 'Drop-off address',   labelPickupAddr:  'Pickup address',
      labelFromAddr:    'Pickup location',    labelToAddr:      'Destination',
      labelArrivalDate: 'Arrival date',       labelArrivalTime: 'Landing time',
      labelDepartDate:  'Departure date',     labelDepartTime:  'Departure time',
      labelRideDate:    'Ride date',          labelRideTime:    'Pickup time',
      labelPassengers:  'Passengers',         labelLuggage:     'Checked bags',
      labelFlight:      'Flight number',      labelTerminal:    'Terminal',
      labelName:        'Full name',          labelPhone:       'Phone number',
      labelNotes:       'Notes',              optional:         '(optional)',
      phDropoff:        'Address, city, or hotel name',
      phPickup:         'Home or hotel address',
      phFrom:           'Address, city, or location',
      phTo:             'Address, city, or location',
      phName:           'Full name',
      phFlightP:        'e.g. United 714',   phTerminalP:      'e.g. TBIT, T5',
      phFlightD:        'e.g. VN 456',       phTerminalD:      'e.g. Terminal 2',
      phNotesP:         'Wheelchair, children, special requests...',
      phNotesD:         'Luggage, wheelchair, special requests...',
      phNotesR:         'Stops, special requests...',
      optPassengers:    '— Select —',
      airportOpt:       '— Select airport —',
      lugOpts:          ['None (carry-on only)', '1 bag', '2 bags', '3 bags', '4 bags', '5+ bags'],
      gpsBtn:           'My location',
      locationBadge:    'Sorted by distance',
      priceHint:        'Enter address to see price estimate',
      priceLoading:     'Calculating distance...',
      estLabel:         'Estimated',
      backLabel:        'Back',
      closeLabel:       'Close',
      unavailTitle:     'Ride Service',
      unavailHeading:   'No Vehicles Available',
      unavailBody:      'No drivers scheduled right now.<br>Contact us to book.',
      callNow:          'Call Now',
      processing:       'Processing...',
      alertFill:        'Please complete:\n• ',
      errAirportP:      'Please select arrival airport',
      errDropoff:       'Please enter drop-off address',
      errArrivalDate:   'Please enter arrival date',
      errArrivalTime:   'Please enter landing time',
      errPassengers:    'Please select passenger count',
      errName:          'Please enter your name',
      errPhone:         'Please enter your phone number',
      errPickup:        'Please enter pickup address',
      errAirportD:      'Please select departure airport',
      errDepartDate:    'Please enter departure date',
      errDepartTime:    'Please enter departure time',
      errFrom:          'Please enter pickup location',
      errTo:            'Please enter destination',
      errRideDate:      'Please enter ride date',
      errRideTime:      'Please enter pickup time',
      noRoute:          'Route not found.',
      vehicleBox: function(name, seats) { return name + '<br>' + seats + ' seats<br>Tip not included'; },
      errBooking: 'Booking failed. Please call (408) 916-3439 to book directly.',
    },
    vi: {
      minSuffix:    'phút',
      savings:      function(n) { return 'Tiết kiệm ~$' + n + ' so với Uber'; },
      deadhead:     function(mi) { return ' · Tài xế cách ~' + mi + ' mi'; },
      marketLabel:  'Giá thị trường (UberXL)',
      dlcLabel:     'Giá DLC',
      mapsLink:     'Xem tuyến đường trên Maps',
      viewRoute:    'Xem tuyến đường',
      pickupLbl:    'Điểm đón',
      dropoffLbl:   'Điểm đến',
      priceEst:     function(p, s) { return '~$' + p + ' ước tính · Tiết kiệm ~$' + s + ' so với Uber'; },
      // Step navigation
      stepPrefix:   function(n) { return 'Bước ' + n + ' / 6'; },
      stepLabels:   {
        pickup:  ['Sân Bay', 'Điểm Đến', 'Giờ Hạ Cánh', 'Chi Tiết', 'Liên Hệ', 'Xem Lại'],
        dropoff: ['Điểm Đón', 'Sân Bay', 'Giờ Cất Cánh', 'Chi Tiết', 'Liên Hệ', 'Xem Lại'],
        ride:    ['Điểm Đón', 'Điểm Đến', 'Lịch Đi', 'Hành Khách', 'Liên Hệ', 'Xem Lại'],
      },
      stepQuestions: {
        pickup:  ['Bạn đến sân bay nào?', 'Chúng tôi đưa bạn đến đâu?', 'Chuyến bay hạ cánh lúc nào?', 'Chi tiết chuyến đi', 'Thông tin liên hệ', 'Xem lại đặt xe'],
        dropoff: ['Chúng tôi đón bạn ở đâu?', 'Bạn bay từ sân bay nào?', 'Chuyến bay cất cánh lúc nào?', 'Chi tiết chuyến đi', 'Thông tin liên hệ', 'Xem lại đặt xe'],
        ride:    ['Điểm đón của bạn?', 'Bạn muốn đến đâu?', 'Bạn cần xe lúc nào?', 'Bao nhiêu hành khách?', 'Thông tin liên hệ', 'Xem lại đặt xe'],
      },
      nextBtn:      'Tiếp theo',
      submitBtn:    'Xác Nhận Đặt Xe',
      // Booking review card (step 3 pre-submit summary)
      reviewHeading:    'Tóm Tắt Đặt Xe',
      reviewRoute:      'Tuyến đường',
      reviewFare:       'Ước tính',
      reviewPassengers: 'Hành khách',
      reviewVehicle:    'Xe',
      // Success screen
      successTitle: 'Đặt Xe Thành Công!',
      successSub:   'Mã đặt chỗ của bạn:',
      successMsg:   'Chúng tôi sẽ xác nhận trong <strong>30 phút</strong>.<br>Cần gấp? Gọi <a href="tel:4089163439">(408) 916-3439</a>.',
      closeBtn:     'Đóng',
      // ── Picker, labels, placeholders, validation ──
      pickerTitle:      'Đặt Xe Đưa Đón',
      pickerSubPfx:     'Tài xế chuyên nghiệp · ',
      pickerSuffix:     ' chỗ',
      pickupCardTitle:  'Đón Sân Bay',
      pickupCardDesc:   'Bay đến · Tài xế chờ tại cửa Arrivals',
      dropoffCardTitle: 'Ra Sân Bay',
      dropoffCardDesc:  'Bay đi · Đón tận nhà đúng giờ',
      rideCardTitle:    'Xe Riêng Cao Cấp',
      rideCardDesc:     'Đến bất kỳ điểm nào · Không cần sân bay',
      vanBadge:         'Rẻ hơn Uber <strong>20%</strong> &nbsp;·&nbsp; Đặt trước · Giá cố định',
      labelAirportP:    'Sân bay đến',        labelAirportD:    'Sân bay cần đến',
      labelDropoffAddr: 'Địa chỉ điểm đến',   labelPickupAddr:  'Địa chỉ đón',
      labelFromAddr:    'Điểm đón',           labelToAddr:      'Điểm đến',
      labelArrivalDate: 'Ngày đến',           labelArrivalTime: 'Giờ hạ cánh',
      labelDepartDate:  'Ngày bay',           labelDepartTime:  'Giờ cất cánh',
      labelRideDate:    'Ngày đi',            labelRideTime:    'Giờ xuất phát',
      labelPassengers:  'Số hành khách',      labelLuggage:     'Hành lý ký gửi',
      labelFlight:      'Số chuyến bay',      labelTerminal:    'Terminal',
      labelName:        'Họ tên',             labelPhone:       'Số điện thoại',
      labelNotes:       'Ghi chú',            optional:         '(tùy chọn)',
      phDropoff:        'Địa chỉ, thành phố, hoặc tên khách sạn',
      phPickup:         'Địa chỉ nhà hoặc khách sạn',
      phFrom:           'Địa chỉ, thành phố hoặc địa điểm',
      phTo:             'Địa chỉ, thành phố hoặc địa điểm',
      phName:           'Tên đầy đủ',
      phFlightP:        'VD: United 714',     phTerminalP:      'VD: TBIT, T5',
      phFlightD:        'VD: VN 456',         phTerminalD:      'VD: Terminal 2',
      phNotesP:         'Wheelchair, trẻ em, yêu cầu đặc biệt...',
      phNotesD:         'Hành lý, wheelchair, yêu cầu đặc biệt...',
      phNotesR:         'Điểm dừng, yêu cầu đặc biệt...',
      optPassengers:    '— Chọn —',
      airportOpt:       '— Chọn sân bay —',
      lugOpts:          ['Không có (chỉ xách tay)', '1 kiện', '2 kiện', '3 kiện', '4 kiện', '5+ kiện'],
      gpsBtn:           'Vị trí của tôi',
      locationBadge:    'Sắp xếp gần bạn nhất',
      priceHint:        'Nhập địa chỉ để xem giá ước tính',
      priceLoading:     'Đang tính khoảng cách...',
      estLabel:         'Ước tính',
      backLabel:        'Quay lại',
      closeLabel:       'Đóng',
      unavailTitle:     'Dịch Vụ Xe',
      unavailHeading:   'Hiện Không Có Xe',
      unavailBody:      'Tài xế chưa có lịch trống lúc này.<br>Vui lòng liên hệ trực tiếp để đặt xe.',
      callNow:          'Gọi Ngay',
      processing:       'Đang xử lý...',
      alertFill:        'Vui lòng điền đầy đủ:\n• ',
      errAirportP:      'Vui lòng chọn sân bay đến',
      errDropoff:       'Vui lòng nhập địa chỉ điểm đến',
      errArrivalDate:   'Vui lòng nhập ngày đến',
      errArrivalTime:   'Vui lòng nhập giờ hạ cánh',
      errPassengers:    'Vui lòng chọn số hành khách',
      errName:          'Vui lòng nhập họ tên',
      errPhone:         'Vui lòng nhập số điện thoại',
      errPickup:        'Vui lòng nhập địa chỉ đón',
      errAirportD:      'Vui lòng chọn sân bay cần đến',
      errDepartDate:    'Vui lòng nhập ngày bay',
      errDepartTime:    'Vui lòng nhập giờ cất cánh',
      errFrom:          'Vui lòng nhập điểm đón',
      errTo:            'Vui lòng nhập điểm đến',
      errRideDate:      'Vui lòng nhập ngày đi',
      errRideTime:      'Vui lòng nhập giờ xuất phát',
      noRoute:          'Không tìm được tuyến đường.',
      vehicleBox: function(name, seats) { return name + '<br>' + seats + ' chỗ<br>Chưa bao gồm tip'; },
      errBooking: 'Đặt chỗ không thành công. Vui lòng gọi (408) 916-3439 để đặt trực tiếp.',
    },
    es: {
      minSuffix:    'min',
      savings:      function(n) { return 'Ahorra ~$' + n + ' vs Uber'; },
      deadhead:     function(mi) { return ' · Conductor ~' + mi + ' mi'; },
      marketLabel:  'Precio de mercado (UberXL)',
      dlcLabel:     'Precio DLC',
      mapsLink:     'Ver ruta en Maps',
      viewRoute:    'Ver ruta',
      pickupLbl:    'Recogida',
      dropoffLbl:   'Destino',
      priceEst:     function(p, s) { return '~$' + p + ' est · Ahorra ~$' + s + ' vs Uber'; },
      // Step navigation
      stepPrefix:   function(n) { return 'Paso ' + n + ' de 6'; },
      stepLabels:   {
        pickup:  ['Aeropuerto', 'Destino', 'Hora Llegada', 'Detalles', 'Contacto', 'Revisar'],
        dropoff: ['Dirección', 'Aeropuerto', 'Hora Salida', 'Detalles', 'Contacto', 'Revisar'],
        ride:    ['Origen', 'Destino', 'Horario', 'Pasajeros', 'Contacto', 'Revisar'],
      },
      stepQuestions: {
        pickup:  ['¿En qué aeropuerto llegas?', '¿A dónde te llevamos?', '¿Cuándo aterriza tu vuelo?', 'Detalles del viaje', 'Tu información de contacto', 'Revisa tu reserva'],
        dropoff: ['¿Dónde te recogemos?', '¿De qué aeropuerto vuelas?', '¿Cuándo sale tu vuelo?', 'Detalles del viaje', 'Tu información de contacto', 'Revisa tu reserva'],
        ride:    ['¿Desde dónde sales?', '¿A dónde vas?', '¿Cuándo necesitas el auto?', '¿Cuántos pasajeros?', 'Tu información de contacto', 'Revisa tu reserva'],
      },
      nextBtn:      'Continuar',
      submitBtn:    'Confirmar Reserva',
      // Booking review card (step 3 pre-submit summary)
      reviewHeading:    'Resumen del Viaje',
      reviewRoute:      'Ruta',
      reviewFare:       'Estimado',
      reviewPassengers: 'Pasajeros',
      reviewVehicle:    'Vehículo',
      // Success screen
      successTitle: '¡Reserva Confirmada!',
      successSub:   'Tu ID de reserva:',
      successMsg:   'Confirmaremos en <strong>30 minutos</strong>.<br>¿Urgente? Llama al <a href="tel:4089163439">(408) 916-3439</a>.',
      closeBtn:     'Cerrar',
      // ── Picker, labels, placeholders, validation ──
      pickerTitle:      'Reservar un Viaje',
      pickerSubPfx:     'Conductor profesional · ',
      pickerSuffix:     ' asientos',
      pickupCardTitle:  'Recogida en Aeropuerto',
      pickupCardDesc:   'Llegando · Conductor espera en Llegadas',
      dropoffCardTitle: 'Al Aeropuerto',
      dropoffCardDesc:  'Saliendo · Puntual de puerta a puerta',
      rideCardTitle:    'Viaje Privado',
      rideCardDesc:     'Cualquier destino · Sin aeropuerto',
      vanBadge:         'Ahorra <strong>20%</strong> vs Uber &nbsp;·&nbsp; Reserva · Precio fijo',
      labelAirportP:    'Aeropuerto de llegada',  labelAirportD:    'Aeropuerto de salida',
      labelDropoffAddr: 'Dirección de destino',    labelPickupAddr:  'Dirección de recogida',
      labelFromAddr:    'Punto de recogida',       labelToAddr:      'Destino',
      labelArrivalDate: 'Fecha de llegada',        labelArrivalTime: 'Hora de aterrizaje',
      labelDepartDate:  'Fecha de vuelo',          labelDepartTime:  'Hora de salida',
      labelRideDate:    'Fecha del viaje',         labelRideTime:    'Hora de recogida',
      labelPassengers:  'Pasajeros',               labelLuggage:     'Equipaje facturado',
      labelFlight:      'Número de vuelo',         labelTerminal:    'Terminal',
      labelName:        'Nombre completo',         labelPhone:       'Número de teléfono',
      labelNotes:       'Notas',                   optional:         '(opcional)',
      phDropoff:        'Dirección, ciudad o nombre del hotel',
      phPickup:         'Dirección de casa o hotel',
      phFrom:           'Dirección, ciudad o lugar',
      phTo:             'Dirección, ciudad o lugar',
      phName:           'Nombre completo',
      phFlightP:        'ej. United 714',          phTerminalP:      'ej. TBIT, T5',
      phFlightD:        'ej. VN 456',              phTerminalD:      'ej. Terminal 2',
      phNotesP:         'Silla de ruedas, niños, solicitudes especiales...',
      phNotesD:         'Equipaje, silla de ruedas, solicitudes especiales...',
      phNotesR:         'Paradas, solicitudes especiales...',
      optPassengers:    '— Seleccionar —',
      airportOpt:       '— Seleccionar aeropuerto —',
      lugOpts:          ['Sin equipaje (solo carry-on)', '1 maleta', '2 maletas', '3 maletas', '4 maletas', '5+ maletas'],
      gpsBtn:           'Mi ubicación',
      locationBadge:    'Ordenados por distancia',
      priceHint:        'Ingresa dirección para ver precio estimado',
      priceLoading:     'Calculando distancia...',
      estLabel:         'Estimado',
      backLabel:        'Atrás',
      closeLabel:       'Cerrar',
      unavailTitle:     'Servicio de Vehículos',
      unavailHeading:   'Sin Vehículos Disponibles',
      unavailBody:      'No hay conductores disponibles.<br>Contáctenos directamente para reservar.',
      callNow:          'Llamar Ahora',
      processing:       'Procesando...',
      alertFill:        'Por favor completa:\n• ',
      errAirportP:      'Selecciona el aeropuerto de llegada',
      errDropoff:       'Ingresa la dirección de destino',
      errArrivalDate:   'Ingresa la fecha de llegada',
      errArrivalTime:   'Ingresa la hora de aterrizaje',
      errPassengers:    'Selecciona el número de pasajeros',
      errName:          'Ingresa tu nombre',
      errPhone:         'Ingresa tu número de teléfono',
      errPickup:        'Ingresa la dirección de recogida',
      errAirportD:      'Selecciona el aeropuerto de salida',
      errDepartDate:    'Ingresa la fecha de vuelo',
      errDepartTime:    'Ingresa la hora de salida',
      errFrom:          'Ingresa el punto de recogida',
      errTo:            'Ingresa el destino',
      errRideDate:      'Ingresa la fecha del viaje',
      errRideTime:      'Ingresa la hora de recogida',
      noRoute:          'Ruta no encontrada.',
      vehicleBox: function(name, seats) { return name + '<br>' + seats + ' asientos<br>Propina no incluida'; },
      errBooking: 'Reserva fallida. Llama al (408) 916-3439 para reservar directamente.',
    },
  };
  var _lang = (new URLSearchParams(window.location.search).get('lang') || 'en');
  if (!_RIDE_T[_lang]) _lang = 'en';
  var _T = _RIDE_T[_lang];

  // ── i18n DOM updater — applies _T strings to all static modal HTML ────────────
  var _i18nApplied = false;
  var _GPS_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  function _i18nModal() {
    if (_i18nApplied) return;
    _i18nApplied = true;

    // Helper: update label's first text node (preserves required / optional child spans)
    function lbl(forId, txt) {
      var el = document.querySelector('label[for="' + forId + '"]');
      if (!el) return;
      var tn = el.firstChild;
      if (tn && tn.nodeType === 3) tn.textContent = txt + ' ';
    }
    // Helper: update (optional) inline-style spans in labels to current lang
    function updateOptSpans() {
      document.querySelectorAll('#rideIntakeModal label span[style]').forEach(function(s) {
        s.textContent = _T.optional;
      });
    }
    // Helper: set placeholder
    function ph(id, text) { var el = document.getElementById(id); if (el) el.placeholder = text; }
    // Helper: set first select option text
    function opt0(id, text) { var sel = document.getElementById(id); if (sel && sel.options[0]) sel.options[0].text = text; }
    // Helper: set multiple option texts (by index)
    function opts(id, arr) {
      var sel = document.getElementById(id);
      if (!sel) return;
      arr.forEach(function(t, i) { if (sel.options[i]) sel.options[i].text = t; });
    }
    // Helper: set textContent of element by ID
    function txt(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
    // Helper: update location badge (preserves .ri-loc-dot span)
    function locBadge(id) {
      var bdg = document.getElementById(id);
      if (!bdg) return;
      var dot = bdg.querySelector('.ri-loc-dot');
      bdg.textContent = _T.locationBadge;
      if (dot) bdg.insertBefore(dot, bdg.firstChild);
    }

    // ── Picker title (also set by showPicker via setText, this is the initial pass) ──
    txt('riTitle', _T.pickerTitle);

    // ── Service cards ──
    var cards = document.querySelectorAll('#riPicker .ri-svc-card');
    var cardData = [
      [_T.pickupCardTitle,  _T.pickupCardDesc],
      [_T.dropoffCardTitle, _T.dropoffCardDesc],
      [_T.rideCardTitle,    _T.rideCardDesc],
    ];
    cards.forEach(function(card, i) {
      var ct = card.querySelector('.ri-svc-card__text');
      if (ct && cardData[i]) ct.innerHTML = '<strong>' + cardData[i][0] + '</strong><span>' + cardData[i][1] + '</span>';
    });

    // ── Van badge (preserves leading SVG) ──
    var vanBdg = document.querySelector('#riPicker .ri-van-badge');
    if (vanBdg) {
      var svgEl = vanBdg.querySelector('svg');
      vanBdg.innerHTML = '';
      if (svgEl) vanBdg.appendChild(svgEl);
      vanBdg.insertAdjacentHTML('beforeend', ' ' + _T.vanBadge);
    }

    // ── Aria labels ──
    var backBtn = document.getElementById('riBackBtn');
    if (backBtn) backBtn.setAttribute('aria-label', _T.backLabel);
    var closeBtn = document.querySelector('#rideIntakeModal .ri-close-btn');
    if (closeBtn) closeBtn.setAttribute('aria-label', _T.closeLabel);

    // ── Optional spans ──
    updateOptSpans();

    // ── PICKUP form labels + placeholders ──
    lbl('ri_p_airport',    _T.labelAirportP);
    lbl('ri_dropoff_addr', _T.labelDropoffAddr);    ph('ri_dropoff_addr', _T.phDropoff);
    lbl('ri_arrival_date', _T.labelArrivalDate);
    lbl('ri_arrival_time', _T.labelArrivalTime);
    lbl('ri_p_passengers', _T.labelPassengers);     opt0('ri_p_passengers', _T.optPassengers);
    lbl('ri_p_luggage',    _T.labelLuggage);        opts('ri_p_luggage', _T.lugOpts);
    lbl('ri_p_flight',     _T.labelFlight);         ph('ri_p_flight', _T.phFlightP);
    lbl('ri_p_terminal',   _T.labelTerminal);       ph('ri_p_terminal', _T.phTerminalP);
    lbl('ri_p_name',       _T.labelName);           ph('ri_p_name', _T.phName);
    lbl('ri_p_phone',      _T.labelPhone);
    lbl('ri_p_notes',      _T.labelNotes);          ph('ri_p_notes', _T.phNotesP);

    // ── DROPOFF form labels + placeholders ──
    lbl('ri_pickup_addr',  _T.labelPickupAddr);     ph('ri_pickup_addr', _T.phPickup);
    lbl('ri_d_airport',    _T.labelAirportD);
    lbl('ri_depart_date',  _T.labelDepartDate);
    lbl('ri_depart_time',  _T.labelDepartTime);
    lbl('ri_d_passengers', _T.labelPassengers);     opt0('ri_d_passengers', _T.optPassengers);
    lbl('ri_d_luggage',    _T.labelLuggage);        opts('ri_d_luggage', _T.lugOpts);
    lbl('ri_d_flight',     _T.labelFlight);         ph('ri_d_flight', _T.phFlightD);
    lbl('ri_d_terminal',   _T.labelTerminal);       ph('ri_d_terminal', _T.phTerminalD);
    lbl('ri_d_name',       _T.labelName);           ph('ri_d_name', _T.phName);
    lbl('ri_d_phone',      _T.labelPhone);
    lbl('ri_d_notes',      _T.labelNotes);          ph('ri_d_notes', _T.phNotesD);

    // ── RIDE form labels + placeholders ──
    lbl('ri_from_addr',    _T.labelFromAddr);       ph('ri_from_addr', _T.phFrom);
    lbl('ri_to_addr',      _T.labelToAddr);         ph('ri_to_addr', _T.phTo);
    lbl('ri_ride_date',    _T.labelRideDate);
    lbl('ri_ride_time',    _T.labelRideTime);
    lbl('ri_r_passengers', _T.labelPassengers);     opt0('ri_r_passengers', _T.optPassengers);
    lbl('ri_r_name',       _T.labelName);           ph('ri_r_name', _T.phName);
    lbl('ri_r_phone',      _T.labelPhone);
    lbl('ri_r_notes',      _T.labelNotes);          ph('ri_r_notes', _T.phNotesR);

    // ── GPS buttons (replace emoji with SVG + translated text) ──
    var geoBtn  = document.getElementById('riGeoBtn');
    var geoBtnD = document.getElementById('riGeoBtnD');
    if (geoBtn)  geoBtn.innerHTML  = _GPS_SVG + ' ' + _T.gpsBtn;
    if (geoBtnD) geoBtnD.innerHTML = _GPS_SVG + ' ' + _T.gpsBtn;

    // ── Location badges ──
    locBadge('riLocBadgeP');
    locBadge('riLocBadgeD');

    // ── Price hint + loading ──
    txt('riPriceHint', _T.priceHint);
    var ldgEl = document.getElementById('riPriceLoading');
    if (ldgEl) {
      var spinner = ldgEl.querySelector('.ri-price-spinner');
      ldgEl.textContent = _T.priceLoading;
      if (spinner) ldgEl.insertBefore(spinner, ldgEl.firstChild);
    }

    // ── Footer estimate label ──
    var estLbl = document.querySelector('#riFooterEst .ri-footer__est-label');
    if (estLbl) estLbl.textContent = _T.estLabel;
  }

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
  var _driverVehicle = null; // { name, seats, driverId } loaded from Firestore active driver
  var _driverCoords  = null; // { lat, lng } — driver's real-time GPS from Firestore
  var _lastOrigin    = null; // saved for GPS map links
  var _lastDest      = null;

  // ── iOS keyboard / visualViewport shrink ─────────────────────────────────────
  // When the software keyboard opens on iOS the visual viewport shrinks and shifts.
  // We reposition the modal to track the visual viewport (above the keyboard) and
  // clamp the panel height so the footer CTA stays visible.
  var _vpHandler = null;

  function _startViewportWatch() {
    if (_vpHandler) return;
    var panel = document.querySelector('#rideIntakeModal .ri-panel');
    var modal = document.getElementById('rideIntakeModal');
    if (!panel || !modal) return;
    _vpHandler = function() {
      var vvh = window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight;
      var vvTop = window.visualViewport ? Math.round(window.visualViewport.offsetTop) : 0;
      // Reposition modal to sit within the visible area above the keyboard
      modal.style.top    = vvTop + 'px';
      modal.style.height = vvh  + 'px';
      modal.style.bottom = 'auto';
      panel.style.maxHeight = vvh + 'px';
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', _vpHandler);
      window.visualViewport.addEventListener('scroll', _vpHandler);
    }
    _vpHandler(); // apply immediately
  }

  function _stopViewportWatch() {
    if (!_vpHandler) return;
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', _vpHandler);
      window.visualViewport.removeEventListener('scroll', _vpHandler);
    }
    _vpHandler = null;
    var modal = document.getElementById('rideIntakeModal');
    var panel = document.querySelector('#rideIntakeModal .ri-panel');
    if (modal) { modal.style.height = ''; modal.style.bottom = ''; modal.style.top = ''; }
    if (panel) panel.style.maxHeight = '';
  }

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
    _i18nModal();           // apply i18n to all static HTML (no-op after first call)
    _startViewportWatch();  // shrink panel to visual viewport (iOS keyboard safe)

    if (type) {
      goForm(type);  // skip picker, go straight to form
    } else {
      showPicker();
    }
    _fetchDriverVehicle(); // async, non-blocking
  }

  function _applyDriverVehicle(d, driverId) {
    var v = (d && d.vehicle) || {};
    _driverVehicle = {
      name:       [v.make, v.model, v.year].filter(Boolean).join(' ') || (d && d.fullName ? d.fullName + "'s vehicle" : 'Private Ride'),
      seats:      v.seats || 4,
      driverId:   driverId || '',
      driverName: (d && d.fullName) || ''
    };
    // Capture driver's real-time GPS coords if available (updated by driver-admin.html)
    if (d && d.driverLat != null && d.driverLng != null) {
      _driverCoords = { lat: d.driverLat, lng: d.driverLng };
    }
    var sub = document.getElementById('riPickerSub');
    if (sub) sub.textContent = _T.pickerSubPfx + _driverVehicle.name + ' ' + _driverVehicle.seats + _T.pickerSuffix;
    var box = document.getElementById('riVehicleBox');
    if (box) box.innerHTML = _T.vehicleBox(_driverVehicle.name, _driverVehicle.seats);
  }

  function _fetchDriverVehicle() {
    // 1. Use window._activeDrivers (all active, set by checkRideServiceAvailability at page load)
    var pool = window._activeDrivers || window._availableDrivers;
    if (pool && pool.length) {
      var best = pool.find(function(d) { return d.vehicle && d.vehicle.make; }) || pool[0];
      _applyDriverVehicle(best, best.id);
      return;
    }
    // 2. Fallback: query Firestore directly (e.g. page loaded before availability check finished)
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    firebase.firestore().collection('drivers')
      .where('adminStatus', '==', 'active')
      .get()
      .then(function(snap) {
        if (snap.empty) { console.warn('[RideIntake] No active drivers found in Firestore'); return; }
        var best = snap.docs.find(function(d) { return d.data().vehicle && d.data().vehicle.make; }) || snap.docs[0];
        _applyDriverVehicle(best.data(), best.id);
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
    setHide('riProgressWrap', true);
    setHide('riStepQuestion', true);
    setHide('riTitle', false);
    setText('riTitle', _T.unavailTitle);
    var body = document.getElementById('riBody');
    if (body) body.innerHTML =
      '<div style="text-align:center;padding:2.5rem 1.5rem">' +
        '<div style="margin-bottom:1rem"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="color:var(--muted)"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>' +
        '<p style="font-size:1.05rem;font-weight:600;color:var(--cream);margin:0 0 .5rem">' + _T.unavailHeading + '</p>' +
        '<p style="font-size:.85rem;color:var(--muted);margin:0 0 1.5rem">' + _T.unavailBody + '</p>' +
        '<a href="tel:+14089163439" style="display:inline-flex;align-items:center;gap:.45rem;background:var(--gold);color:#07101e;font-weight:700;font-size:.9rem;padding:.7rem 1.4rem;border-radius:999px;text-decoration:none">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11.5 19.79 19.79 0 01.22 2.82 2 2 0 012.22 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.56-.56a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>' +
          ' ' + _T.callNow +
        '</a>' +
      '</div>';
  }

  function close() {
    var modal = document.getElementById('rideIntakeModal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
    clearTimeout(_timer);
    _stopViewportWatch(); // release visualViewport listener
  }

  function showPicker() {
    setHide('riPicker', false);
    setHide('riFormWrap', true);
    setHide('riSuccess', true);
    setHide('riFooter', true);
    setHide('riBackBtn', true);
    setHide('riProgressWrap', true);
    setHide('riTitle', false);
    setText('riTitle', _T.pickerTitle);
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
    // Hide title, show progress bar during form steps
    setHide('riTitle', true);
    setHide('riProgressWrap', false);

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

  function goSubStep(n) {
    _subStep = n;
    var pfx = _type === 'pickup' ? 'ri_p' : _type === 'dropoff' ? 'ri_d' : 'ri_r';

    // Show only the active sub-step (6 steps per type)
    for (var i = 1; i <= 6; i++) {
      var el = document.getElementById(pfx + '_s' + i);
      if (el) el.hidden = (i !== n);
    }

    // Progress bar + counter
    var fill    = document.getElementById('riProgressFill');
    var counter = document.getElementById('riStepCounter');
    if (fill)    fill.style.width = Math.round(n / 6 * 100) + '%';
    if (counter) counter.textContent = _T.stepPrefix(n);

    // Step question headline
    var qEl = document.getElementById('riStepQuestion');
    if (qEl && _T.stepQuestions && _T.stepQuestions[_type]) {
      qEl.textContent = _T.stepQuestions[_type][n - 1] || '';
      qEl.hidden = false;
    }

    // Footer button: Next on steps 1–5, Confirm on step 6
    var btn = document.getElementById('riSubmit');
    if (btn) {
      var arrowSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
      if (n === 6) {
        btn.innerHTML = _T.submitBtn + ' ' + arrowSvg;
        btn.onclick = function () { RideIntake.submit(); };
      } else {
        btn.innerHTML = _T.nextBtn + ' ' + arrowSvg;
        btn.onclick = function () { RideIntake.nextSubStep(); };
      }
      btn.disabled = false;
    }

    // Price: trigger calculation entering step 3 (both addresses now known)
    if (n === 3) {
      scheduleDistance();
      if (_driverVehicle) {
        var box2 = document.getElementById('riVehicleBox');
        if (box2) box2.innerHTML = _T.vehicleBox(_driverVehicle.name, _driverVehicle.seats);
      }
    }
    if (n < 3) { showPriceHint(); }

    // Step 6 (Review): show full price box + review card; hide on all other steps
    if (n === 6) {
      setHide('riPriceHint', true);
      setHide('riPriceLoading', true);
      if (_quote) { setHide('riPriceBox', false); }
      showReviewCard(n);
    } else {
      setHide('riPriceBox', true);
      setHide('riReviewCard', true);
    }

    // Scroll top
    var body = document.getElementById('riBody');
    if (body) body.scrollTop = 0;

    // Init autocomplete on steps where address fields appear
    if (n === 1 || n === 2) setTimeout(initAutocomplete, 60);

    // Attach focus → scroll-into-view for all inputs on this step (iOS keyboard fix)
    var activeStep = document.getElementById(pfx + '_s' + n);
    if (activeStep) {
      activeStep.querySelectorAll('input, select, textarea').forEach(function(inp) {
        inp.addEventListener('focus', function onFocus() {
          setTimeout(function() { _scrollInputIntoView(inp); }, 500);
        }, { once: false, passive: true });
      });
    }
  }

  // ── Booking review card (shown in step 3 so customer can verify before confirming) ─
  function showReviewCard(n) {
    var card = document.getElementById('riReviewCard');
    if (!card) return;
    if (n !== 6 || !_quote || !_lastOrigin || !_lastDest) { card.hidden = true; return; }

    var fromLabel, toLabel;
    if (_type === 'pickup') {
      var ap = val('ri_p_airport');
      fromLabel = ap ? (ap + ' Airport') : _lastOrigin;
      toLabel   = val('ri_dropoff_addr') || _lastDest;
    } else if (_type === 'dropoff') {
      fromLabel = val('ri_pickup_addr') || _lastOrigin;
      var ap2 = val('ri_d_airport');
      toLabel = ap2 ? (ap2 + ' Airport') : _lastDest;
    } else {
      fromLabel = val('ri_from_addr') || _lastOrigin;
      toLabel   = val('ri_to_addr')   || _lastDest;
    }
    var paxId = _type === 'pickup' ? 'ri_p_passengers' : _type === 'dropoff' ? 'ri_d_passengers' : 'ri_r_passengers';
    var pax = val(paxId) || '—';
    var vehicle = _driverVehicle ? _driverVehicle.name :
                  (DLCPricing.RIDE_RATE_CARD && DLCPricing.RIDE_RATE_CARD.vehicleName) || 'Tesla Model Y';

    card.innerHTML =
      '<div class="ri-review__title">' + _T.reviewHeading + '</div>' +
      '<div class="ri-review__row"><span class="ri-review__lbl">' + _T.reviewRoute + '</span>' +
        '<span class="ri-review__val">' + fromLabel + ' → ' + toLabel + '</span></div>' +
      '<div class="ri-review__row"><span class="ri-review__lbl">' + _T.reviewFare + '</span>' +
        '<span class="ri-review__val ri-review__val--price">~$' + _quote.dlcPrice +
        ' <span class="ri-review__save">(' + _T.savings(_quote.savings) + ')</span></span></div>' +
      '<div class="ri-review__row"><span class="ri-review__lbl">' + _T.reviewPassengers + '</span>' +
        '<span class="ri-review__val">' + pax + '</span></div>' +
      '<div class="ri-review__row"><span class="ri-review__lbl">' + _T.reviewVehicle + '</span>' +
        '<span class="ri-review__val">' + vehicle + '</span></div>';
    card.hidden = false;
  }

  function nextSubStep() {
    var errors = validateSubStep(_subStep);
    if (errors.length) {
      showInlineError(errors[0]);
      return;
    }
    if (_subStep < 6) {
      goSubStep(_subStep + 1);
    }
  }

  function validateSubStep(step) {
    var errors = [];
    if (_type === 'pickup') {
      if (step === 1) {
        if (!val('ri_p_airport'))    errors.push(_T.errAirportP);
      } else if (step === 2) {
        if (!val('ri_dropoff_addr')) errors.push(_T.errDropoff);
      } else if (step === 3) {
        if (!val('ri_arrival_date')) errors.push(_T.errArrivalDate);
        if (!val('ri_arrival_time')) errors.push(_T.errArrivalTime);
      } else if (step === 4) {
        if (!val('ri_p_passengers')) errors.push(_T.errPassengers);
      } else if (step === 5) {
        if (!val('ri_p_name'))       errors.push(_T.errName);
        if (!val('ri_p_phone'))      errors.push(_T.errPhone);
      }
      // step 6: no validation — submit() handles final check
    } else if (_type === 'dropoff') {
      if (step === 1) {
        if (!val('ri_pickup_addr'))  errors.push(_T.errPickup);
      } else if (step === 2) {
        if (!val('ri_d_airport'))    errors.push(_T.errAirportD);
      } else if (step === 3) {
        if (!val('ri_depart_date'))  errors.push(_T.errDepartDate);
        if (!val('ri_depart_time'))  errors.push(_T.errDepartTime);
      } else if (step === 4) {
        if (!val('ri_d_passengers')) errors.push(_T.errPassengers);
      } else if (step === 5) {
        if (!val('ri_d_name'))       errors.push(_T.errName);
        if (!val('ri_d_phone'))      errors.push(_T.errPhone);
      }
    } else if (_type === 'ride') {
      if (step === 1) {
        if (!val('ri_from_addr'))    errors.push(_T.errFrom);
      } else if (step === 2) {
        if (!val('ri_to_addr'))      errors.push(_T.errTo);
      } else if (step === 3) {
        if (!val('ri_ride_date'))    errors.push(_T.errRideDate);
        if (!val('ri_ride_time'))    errors.push(_T.errRideTime);
      } else if (step === 4) {
        if (!val('ri_r_passengers')) errors.push(_T.errPassengers);
      } else if (step === 5) {
        if (!val('ri_r_name'))       errors.push(_T.errName);
        if (!val('ri_r_phone'))      errors.push(_T.errPhone);
      }
    }
    return errors;
  }

  function showInlineError(msg) {
    var errEl = document.getElementById('riErrorMsg');
    if (!errEl) return;
    errEl.textContent = '⚠ ' + msg;
    clearTimeout(errEl._t);
    errEl._t = setTimeout(function () { errEl.textContent = ''; }, 2800);
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
      // Filter to airports within 120 miles; fallback to 3 nearest if none qualify
      var near = DLCLocation.airportsWithinMiles(120);
      if (!near || near.length === 0) {
        near = DLCLocation.nearestAirports(3);
      }
      sorted = near.filter(function (a) { return !!AIRPORTS[a.code]; });
      hasLoc = true;
    } else {
      // Region-aware fallback: prioritize current region's airports first
      var regionFirst = (window.DLCRegion && DLCRegion.current && DLCRegion.current.airports)
        ? DLCRegion.current.airports.slice()
        : ['SNA','LAX','LGB','ONT','BUR','SAN'];
      var allCodes = ['SJC','SFO','OAK','SMF','LAX','SNA','BUR','LGB','ONT','SAN','PSP'];
      var remaining = allCodes.filter(function(c) { return regionFirst.indexOf(c) === -1; });
      sorted = regionFirst.concat(remaining).map(function (code) {
        return { code: code, km: null };
      });
    }

    // Build options
    sel.innerHTML = '<option value="">' + _T.airportOpt + '</option>';
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
    // PlaceAutocompleteElement (web component) is not reset by f.reset() — clear manually
    ['ri_dropoff_addr','ri_pickup_addr','ri_from_addr','ri_to_addr'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el && el.tagName === 'GMP-PLACEAUTOCOMPLETE') el.value = '';
    });

    setHide('riPickupFields',  _type !== 'pickup');
    setHide('riDropoffFields', _type !== 'dropoff');
    setHide('riRideFields',    _type !== 'ride');
    // Button state managed by goSubStep()
  }

  // ── Google Places Autocomplete ────────────────────────────────────────────────
  // Always use legacy google.maps.places.Autocomplete — attaches to the existing
  // <input> without replacing it, so .value, CSS, and mobile keyboard all work
  // correctly (same approach as the food order intake form).

  function _scrollInputIntoView(el) {
    if (!el) return;
    // Manually scroll .ri-scrollbody so input stays visible above mobile keyboard.
    // Cannot rely on browser's native scrollIntoView inside position:fixed panels.
    var scrollParent = el.closest ? el.closest('.ri-scrollbody') : null;
    if (!scrollParent) return;
    var elRect = el.getBoundingClientRect();
    var pRect  = scrollParent.getBoundingClientRect();
    var target = scrollParent.scrollTop + (elRect.top - pRect.top) - 80;
    scrollParent.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  function initAutocomplete() {
    if (typeof google === 'undefined' || !google.maps) return;
    var ids = { pickup: ['ri_dropoff_addr'], dropoff: ['ri_pickup_addr'], ride: ['ri_from_addr','ri_to_addr'] };
    (ids[_type] || []).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input || input.tagName !== 'INPUT' || _ac[id]) return;
      _initAutocompleteLegacy(id, input);
    });
  }

  function _initAutocompleteLegacy(id, input) {
    if (!google.maps.places || !google.maps.places.Autocomplete) return;
    var ac = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: 'us' }, fields: ['formatted_address'],
    });
    ac.addListener('place_changed', function() {
      var p = ac.getPlace();
      if (p && p.formatted_address) input.value = p.formatted_address;
      scheduleDistance();
    });
    input.addEventListener('focus', function() {
      setTimeout(function() { _scrollInputIntoView(input); }, 500);
    });
    _ac[id] = ac;
  }

  // ── Pricing — delegates to DLCPricing.quoteRide() (pricing.js) ───────────────
  // Rate card lives in pricing.js RIDE_RATE_CARD; this file no longer owns the numbers.

  // ── Route distance (self-contained — no dependency on script.js) ─────────────
  // Uses Google Maps Routes API (same implementation as window.DLCRouteMatrix in script.js).
  // Returns Promise<{distMiles, durMins}> or rejects on failure.
  function _routeMatrix(origin, destination) {
    return google.maps.importLibrary('routes').then(function (lib) {
      var RouteMatrix = lib.RouteMatrix;
      if (!RouteMatrix) return Promise.reject(new Error('RouteMatrix not available'));
      var travelMode = (lib.TravelMode && lib.TravelMode.DRIVING) || 'DRIVING';
      return RouteMatrix.computeRouteMatrix({
        origins:      [origin],
        destinations: [destination],
        travelMode:   travelMode,
        fields: ['distanceMeters', 'condition', 'localizedValues', 'originIndex', 'destinationIndex'],
      });
    }).then(function (result) {
      var el = result && result.matrix && result.matrix.rows &&
               result.matrix.rows[0] && result.matrix.rows[0].items &&
               result.matrix.rows[0].items[0];
      if (!el || el.condition !== 'ROUTE_EXISTS' || !el.distanceMeters) {
        return Promise.reject(new Error('no-route'));
      }
      var durStr = (el.localizedValues && el.localizedValues.duration) || '';
      var hrM    = durStr.match(/(\d+)\s*hr/i);
      var minM   = durStr.match(/(\d+)\s*min/i);
      var durMins = (hrM ? parseInt(hrM[1]) * 60 : 0) + (minM ? parseInt(minM[1]) : 0);
      return { distMiles: el.distanceMeters / 1609.34, durMins: durMins };
    });
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

    // Save for Maps links in fare card and confirmation screen
    _lastOrigin = pair.origin;
    _lastDest   = pair.destination;

    var ridePromise = _routeMatrix(pair.origin, pair.destination);

    if (_driverCoords) {
      // Two-leg pricing: deadhead (driver → pickup) + ride (pickup → destination)
      var driverOrigin = _driverCoords.lat + ',' + _driverCoords.lng;
      var deadheadPromise = _routeMatrix(driverOrigin, pair.origin);
      Promise.all([ridePromise, deadheadPromise]).then(function(results) {
        var ride     = results[0];
        var deadhead = results[1];
        _quote = DLCPricing.quoteRide(ride.distMiles, ride.durMins, { deadheadMiles: deadhead.distMiles });
        showPrice(_quote);
      }).catch(function() {
        // Deadhead failed — fall back to ride-only price
        ridePromise.then(function(ride) {
          _quote = DLCPricing.quoteRide(ride.distMiles, ride.durMins);
          showPrice(_quote);
        }).catch(function() {
          showPriceHint(_T.noRoute);
        });
      });
    } else {
      // No driver GPS yet — price on ride distance only
      ridePromise.then(function(ride) {
        _quote = DLCPricing.quoteRide(ride.distMiles, ride.durMins);
        showPrice(_quote);
      }).catch(function() {
        showPriceHint(_T.noRoute);
      });
    }
  }

  // ── Maps link helpers ─────────────────────────────────────────────────────────
  function _mapsRoute(from, to) {
    return 'https://www.google.com/maps/dir/?api=1' +
      '&origin=' + encodeURIComponent(from) +
      '&destination=' + encodeURIComponent(to) +
      '&travelmode=driving';
  }
  function _mapsQ(addr) {
    return 'https://maps.google.com/?q=' + encodeURIComponent(addr);
  }
  var _PIN_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  // ── Price display ─────────────────────────────────────────────────────────────
  function showPriceHint(msg) {
    setHide('riPriceLoading', true);
    setHide('riPriceBox',     true);
    setText('riPriceHint', msg || _T.priceHint);
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

    // Route summary line: "35 mi · ~48 min"
    var routeEl = document.getElementById('riRouteSummary');
    if (routeEl) routeEl.textContent = q.miles + ' mi · ~' + q.minutes + ' ' + _T.minSuffix;

    // Fare row labels (language-aware)
    var mktLbl = document.getElementById('riMarketLabel');
    if (mktLbl) mktLbl.textContent = _T.marketLabel;
    var dlcLbl = document.getElementById('riDlcLabel');
    if (dlcLbl) dlcLbl.textContent = _T.dlcLabel;

    // Market rate (strikethrough)
    var marketEl = document.getElementById('riMarketAmt');
    if (marketEl) marketEl.textContent = '~$' + q.uberEstimate;

    // DLC price
    setText('riPriceAmt', '~$' + q.dlcPrice);

    // Savings line
    var saveText = _T.savings(q.savings);
    if (q.deadheadMiles > 0) saveText += _T.deadhead(q.deadheadMiles);
    setText('riPriceSave', saveText);

    // Maps route link text + href
    var linkEl = document.getElementById('riRouteLink');
    if (linkEl && _lastOrigin && _lastDest) {
      linkEl.href = _mapsRoute(_lastOrigin, _lastDest);
      var linkTxt = document.getElementById('riRouteLinkText');
      if (linkTxt) linkTxt.textContent = _T.mapsLink;
      linkEl.hidden = false;
    }

    setHide('riPriceBox', _subStep !== 6);  // price box only on step 6 review
    setText('riFooterAmt', '~$' + q.dlcPrice);
    setHide('riFooterEst', false);
  }

  // ── Validation ────────────────────────────────────────────────────────────────
  function validate() {
    var e = [];
    if (_type === 'pickup') {
      if (!val('ri_p_airport'))    e.push(_T.errAirportP);
      if (!val('ri_arrival_date')) e.push(_T.errArrivalDate);
      if (!val('ri_arrival_time')) e.push(_T.errArrivalTime);
      if (!val('ri_dropoff_addr')) e.push(_T.errDropoff);
      if (!val('ri_p_passengers')) e.push(_T.errPassengers);
      if (!val('ri_p_name'))       e.push(_T.errName);
      if (!val('ri_p_phone'))      e.push(_T.errPhone);
    } else if (_type === 'dropoff') {
      if (!val('ri_pickup_addr'))  e.push(_T.errPickup);
      if (!val('ri_d_airport'))    e.push(_T.errAirportD);
      if (!val('ri_depart_date'))  e.push(_T.errDepartDate);
      if (!val('ri_depart_time'))  e.push(_T.errDepartTime);
      if (!val('ri_d_passengers')) e.push(_T.errPassengers);
      if (!val('ri_d_name'))       e.push(_T.errName);
      if (!val('ri_d_phone'))      e.push(_T.errPhone);
    } else {
      if (!val('ri_from_addr'))    e.push(_T.errFrom);
      if (!val('ri_to_addr'))      e.push(_T.errTo);
      if (!val('ri_ride_date'))    e.push(_T.errRideDate);
      if (!val('ri_ride_time'))    e.push(_T.errRideTime);
      if (!val('ri_r_passengers')) e.push(_T.errPassengers);
      if (!val('ri_r_name'))       e.push(_T.errName);
      if (!val('ri_r_phone'))      e.push(_T.errPhone);
    }
    return e;
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  function submit() {
    if (_busy) return;
    var errors = validate();
    if (errors.length) {
      alert(_T.alertFill + errors.join('\n• '));
      return;
    }
    _busy = true;
    var btn = document.getElementById('riSubmit');
    if (btn) { btn.textContent = _T.processing; btn.disabled = true; }

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
          type: 'new_booking', title: '🚐 New Booking — ' + svcLabel(),
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
          airport:        data.airport || null,
          arrivalDate:    data.arrivalDate || data.departureDate || null,
          arrivalTime:    data.arrivalTime || data.departureTime || null,
          pickupAddress:  data.pickupAddress  || null,
          dropoffAddress: data.dropoffAddress || null,
          status:         'new',
          createdAt:      ts,
        });
      })
      .then(function () {
        // Phase 13: trigger automatic driver dispatch
        return db.collection('dispatchQueue').doc(bookingId + '_0').set({
          bookingId:     bookingId,
          skipDriverIds: [],
          attempt:       1,
          status:        'pending',
          createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
        });
      })
      .then(function () { onSuccess(bookingId); })
      .catch(function (err) { console.error(err); onError(); });
  }

  function buildBookingData(bookingId) {
    var paxId = _type === 'pickup' ? 'ri_p_passengers' : _type === 'dropoff' ? 'ri_d_passengers' : 'ri_r_passengers';
    var base = {
      bookingId: bookingId, status: 'dispatching',
      vehicle: _driverVehicle ? _driverVehicle.name : (DLCPricing.RIDE_RATE_CARD && DLCPricing.RIDE_RATE_CARD.vehicleName) || 'Tesla Model Y',
      driverId: _driverVehicle ? _driverVehicle.driverId : null,
      serviceType: _type === 'ride' ? 'private_ride' : (_type === 'pickup' ? 'pickup' : 'dropoff'),
      passengers:    parseInt(val(paxId) || '1', 10),
      customerName:  val(_type === 'pickup' ? 'ri_p_name'  : _type === 'dropoff' ? 'ri_d_name'  : 'ri_r_name'),
      customerPhone: val(_type === 'pickup' ? 'ri_p_phone' : _type === 'dropoff' ? 'ri_d_phone' : 'ri_r_phone'),
      notes:         val(_type === 'pickup' ? 'ri_p_notes' : _type === 'dropoff' ? 'ri_d_notes' : 'ri_r_notes') || '',
      estimatedPrice:    _quote ? _quote.dlcPrice        : null,
      estimatedMiles:    _quote ? _quote.miles           : null,
      estimatedDuration: _quote ? _quote.minutes         : null,
      routeLink:         (_lastOrigin && _lastDest) ? _mapsRoute(_lastOrigin, _lastDest) : null,
      region:            (window.DLCRegion && window.DLCRegion.current) ? window.DLCRegion.current.id : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (_type === 'pickup') {
      var aDate = val('ri_arrival_date'), aTime = val('ri_arrival_time');
      Object.assign(base, {
        airport: val('ri_p_airport'), airline: val('ri_p_flight') || '',
        terminal: val('ri_p_terminal') || '', arrivalDate: aDate,
        arrivalTime: aTime, dropoffAddress: val('ri_dropoff_addr'),
        luggageCount: parseInt(val('ri_p_luggage') || '0', 10),
        // Normalized combined datetime field (workflowEngine compatible)
        datetime: (aDate && aTime) ? aDate + 'T' + aTime + ':00' : (aDate || ''),
      });
    } else if (_type === 'dropoff') {
      var dDate = val('ri_depart_date'), dTime = val('ri_depart_time');
      Object.assign(base, {
        pickupAddress: val('ri_pickup_addr'), airport: val('ri_d_airport'),
        airline: val('ri_d_flight') || '', terminal: val('ri_d_terminal') || '',
        departureDate: dDate, departureTime: dTime,
        luggageCount: parseInt(val('ri_d_luggage') || '0', 10),
        // Normalized combined datetime field
        datetime: (dDate && dTime) ? dDate + 'T' + dTime + ':00' : (dDate || ''),
      });
    } else {
      var rDate = val('ri_ride_date'), rTime = val('ri_ride_time');
      Object.assign(base, {
        pickupAddress: val('ri_from_addr'), dropoffAddress: val('ri_to_addr'),
        rideDate: rDate, rideTime: rTime,
        // Normalized combined datetime field
        datetime: (rDate && rTime) ? rDate + 'T' + rTime + ':00' : (rDate || ''),
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
    setHide('riBackBtn',   true);
    setHide('riProgressWrap', true);
    setHide('riStepQuestion', true);
    setHide('riTitle', false);
    setText('riTitle', _T.successTitle);
    // Update static success text nodes to current language
    var subEl = document.querySelector('#riSuccess .ri-success__sub');
    if (subEl) subEl.textContent = _T.successSub;
    var msgEl = document.querySelector('#riSuccess .ri-success__msg');
    if (msgEl) msgEl.innerHTML = _T.successMsg;

    // Build booking summary with route + GPS links
    var summaryEl = document.getElementById('riSuccessSummary');
    if (summaryEl && _lastOrigin && _lastDest) {
      var fromLabel, toLabel;
      if (_type === 'pickup') {
        var ap = val('ri_p_airport');
        fromLabel = ap ? (ap + ' Airport') : _lastOrigin;
        toLabel   = val('ri_dropoff_addr') || _lastDest;
      } else if (_type === 'dropoff') {
        fromLabel = val('ri_pickup_addr') || _lastOrigin;
        var ap2 = val('ri_d_airport');
        toLabel = ap2 ? (ap2 + ' Airport') : _lastDest;
      } else {
        fromLabel = val('ri_from_addr') || _lastOrigin;
        toLabel   = val('ri_to_addr')   || _lastDest;
      }

      var routeEl = document.getElementById('riSuccessRoute');
      if (routeEl) routeEl.textContent = fromLabel + ' → ' + toLabel;

      var priceEl = document.getElementById('riSuccessPrice');
      if (priceEl && _quote) {
        priceEl.textContent = _T.priceEst(_quote.dlcPrice, _quote.savings);
      }

      var mapsEl = document.getElementById('riSuccessMaps');
      if (mapsEl) {
        mapsEl.innerHTML =
          '<a class="ri-success__map-btn" href="' + _mapsRoute(_lastOrigin, _lastDest) + '" target="_blank" rel="noopener">' + _PIN_SVG + ' ' + _T.viewRoute + '</a>' +
          '<a class="ri-success__map-btn" href="' + _mapsQ(_lastOrigin) + '" target="_blank" rel="noopener">' + _PIN_SVG + ' ' + _T.pickupLbl + ': ' + fromLabel + '</a>' +
          '<a class="ri-success__map-btn" href="' + _mapsQ(_lastDest) + '" target="_blank" rel="noopener">' + _PIN_SVG + ' ' + _T.dropoffLbl + ': ' + toLabel + '</a>';
      }
      summaryEl.hidden = false;
    }

    setHide('riSuccess', false);
    // Repurpose footer as close button
    var footer = document.getElementById('riFooter');
    if (footer) {
      footer.hidden = false;
      var btn = document.getElementById('riSubmit');
      if (btn) { btn.textContent = _T.closeBtn; btn.disabled = false; btn.onclick = close; }
    }
  }

  function onError() {
    _busy = false;
    var btn = document.getElementById('riSubmit');
    if (btn) {
      var arrowSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
      btn.innerHTML = _T.submitBtn + ' ' + arrowSvg;
      btn.disabled = false;
    }
    alert(_T.errBooking);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function val(id)         { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function setText(id, t)  { var e = document.getElementById(id); if (e) e.textContent = t; }
  function setHide(id, h)  { var e = document.getElementById(id); if (e) e.hidden = !!h; }
  function svcLabel()      { return { pickup:'Airport Pickup', dropoff:'Airport Dropoff', ride:'Private Ride' }[_type] || _type; }
  function generateId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', id = 'DLC-', arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    for (var i = 0; i < arr.length; i++) id += chars[arr[i] % chars.length];
    return id;
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  // ── Geolocation for private ride pickup ──────────────────────────────────
  // Called by the "Use my location" button on the private-ride pickup field.
  // Requests browser location, reverse-geocodes via Google Maps Geocoder, and
  // fills ri_from_addr so the quote engine can calculate the route.
  function useCurrentLocation(targetId, btnId) {
    targetId = targetId || 'ri_from_addr';
    if (!navigator.geolocation) {
      alert('Your browser does not support location services.');
      return;
    }
    var btn = document.getElementById(btnId || 'riGeoBtn');
    if (btn) { btn.textContent = '⏳ Getting location...'; btn.disabled = true; }

    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        var restoreBtn = function() {
          if (btn) { btn.textContent = '📍 My location'; btn.disabled = false; }
        };
        // Use Google Maps Geocoder if available; otherwise fall back to lat,lng string
        if (window.google && google.maps && google.maps.Geocoder) {
          new google.maps.Geocoder().geocode(
            { location: { lat: lat, lng: lng } },
            function(results, status) {
              restoreBtn();
              var addr = (status === 'OK' && results && results[0])
                ? results[0].formatted_address
                : lat.toFixed(5) + ', ' + lng.toFixed(5);
              var input = document.getElementById(targetId);
              if (input) { input.value = addr; scheduleDistance(); }
            }
          );
        } else {
          restoreBtn();
          var input = document.getElementById(targetId);
          if (input) { input.value = lat.toFixed(5) + ', ' + lng.toFixed(5); scheduleDistance(); }
        }
      },
      function(err) {
        if (btn) { btn.textContent = '📍 My location'; btn.disabled = false; }
        console.warn('[RideIntake] geolocation error:', err.message);
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }

  return {
    open:               open,
    close:              close,
    goForm:             goForm,
    backToPicker:       backToPicker,
    nextSubStep:        nextSubStep,
    submit:             submit,
    schedule:           scheduleDistance,
    useCurrentLocation: useCurrentLocation,
    AIRPORTS:           AIRPORTS,
    setLang: function(lang) {
      if (!_RIDE_T[lang]) return;
      _lang = lang;
      _T = _RIDE_T[lang];
      _i18nApplied = false; // force re-apply next open()
    },
  };

}());
