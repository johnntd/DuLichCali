'use strict';

(function(root) {
  var DATA = root.MobileBarberData;
  var BOOKING = root.MobileBarberBooking;
  var AGENT = root.MobileBarberAgent;

  var STRINGS = {
    en: {
      pageTitle: 'Mobile Barber | Du Lich Cali',
      languageLabel: 'Choose language',
      heroActionsLabel: 'Mobile barber actions',
      trustLabel: 'Mobile barber trust details',
      heroKicker: 'Orange County house calls',
      heroTitle: 'Mobile Barber — In-Home Haircuts',
      heroCopy: 'Book a verified barber to come to your home, hotel, office, or care facility with clear pricing before the appointment is confirmed.',
      heroStatus: 'Verified barber',
      heroCardTitle: 'Cuts at your address',
      heroCardSub: 'Service area, price, duration, and confirmation shown before booking.',
      bookNow: 'Book Now',
      chatAssistant: 'Chat with AI Barber Assistant',
      talkAssistant: 'Talk to AI Barber Assistant',
      trustChipLicensed: 'Licensed barber',
      trustChipHouseCall: 'House call',
      trustChipVerified: 'Verified vendor',
      trustChipTravel: 'Travel coverage',
      trustChipFamily: 'Family package',
      trustHomeTitle: 'In-home service',
      trustHomeCopy: 'The barber travels to your selected address.',
      trustVerifiedTitle: 'Verified barber',
      trustVerifiedCopy: 'Profiles show service area and language support.',
      trustPricingTitle: 'Transparent pricing',
      trustPricingCopy: 'Each card shows price, duration, and travel fee.',
      trustConfirmTitle: 'Appointment confirmation',
      trustConfirmCopy: 'Bookings stay pending until availability is checked.',
      promoKicker: 'Service preview',
      promoTitle: 'Latest AI Haircut Styles',
      promoCopy: 'Swipe through fade, taper, beard trim, kids cut, business cut, senior cut, line up, and family package previews.',
      promoCta: 'Book an in-home haircut today',
      beforeAfterKicker: 'Style previews',
      beforeAfterTitle: 'AI-generated mobile barber style previews',
      beforeAfterCopy: 'Curated AI previews of mobile barber styles. Real barber portfolio photos coming soon.',
      stylePreviewSuffix: 'Style Preview',
      convenienceKicker: 'Convenience',
      convenienceTitle: 'Mobile Haircut Convenience',
      promoClipsKicker: 'Promo clips',
      promoClipsTitle: 'Animated mobile barber promos',
      promoClipsCopy: 'Video generation is not wired on this page yet, so these cards use motion fallback instead of repeating the hero image.',
      servicesKicker: 'Services',
      servicesTitle: 'Choose a mobile barber service',
      vendorsKicker: 'Barbers',
      vendorsTitle: 'Available mobile barber profiles',
      priceLabel: 'Price',
      durationLabel: 'Duration',
      travelBufferLabel: 'Travel buffer',
      cleanupLabel: 'Cleanup',
      minutes: 'min',
      selectService: 'Select Service',
      selectedServiceLabel: 'Selected service',
      bookThisService: 'Book this service',
      chatThisService: 'Chat with AI to book',
      talkThisService: 'Talk to AI to book',
      locationGateKicker: 'Service area',
      locationGateTitle: 'What city or ZIP should the barber come to?',
      locationGateCopy: 'Enter your city or 5-digit ZIP — either one is enough to match you with the right mobile barber.',
      cityLabel: 'City',
      zipLabel: 'ZIP code',
      findMyBarber: 'Find My Barber',
      changeLocation: 'Change location',
      emailLabel: 'Email',
      notifyMe: 'Notify me',
      noServiceArea: "We don't serve {city} yet. Leave your email and we'll let you know when we expand.",
      waitlistSaved: "Thanks. We'll let you know when we expand there.",
      locationRequired: 'Please enter a city or 5-digit ZIP code.',
      aiPreviewDisclosure: 'Sample AI-generated style preview. Real barber portfolio coming soon.',
      serviceAreaLabel: 'Service area',
      radiusLabel: 'Travel radius',
      travelFeeLabel: 'Base travel fee',
      languagesLabel: 'Languages',
      ratingLabel: 'Rating',
      emptyTitle: 'No mobile barber vendors are available yet.',
      emptyCopy: 'Please check the marketplace or ask Du Lich Cali for the next available in-home service option.',
      emptyCta: 'Back to Du Lich Cali',
      assistantKicker: 'AI assistant',
      assistantTitle: 'Mobile barber assistant is ready for booking intake.',
      assistantCopy: 'This Phase 2 page does not confirm appointments. The assistant CTA will collect service, address, date, time, barber preference, and contact details in a later phase.',
      assistantClose: 'Close',
      serviceClassicName: 'Classic Mobile Haircut',
      serviceClassicDesc: 'In-home haircut with time reserved for setup and cleanup.',
      serviceComboName: 'Haircut and Beard Trim',
      serviceComboDesc: 'Mobile haircut, beard shaping, and light cleanup at your address.'
    },
    vi: {
      pageTitle: 'Thợ Cắt Tóc Tại Nhà | Du Lich Cali',
      languageLabel: 'Chọn ngôn ngữ',
      heroActionsLabel: 'Hành động đặt thợ cắt tóc tại nhà',
      trustLabel: 'Thông tin tin cậy cho dịch vụ cắt tóc tại nhà',
      heroKicker: 'Dịch vụ tận nhà tại Orange County',
      heroTitle: 'Mobile Barber — In-Home Haircuts',
      heroCopy: 'Đặt thợ cắt tóc đã xác minh đến nhà, khách sạn, văn phòng, hoặc cơ sở chăm sóc với giá rõ ràng trước khi xác nhận lịch.',
      heroStatus: 'Thợ đã xác minh',
      heroCardTitle: 'Cắt tóc tại địa chỉ của bạn',
      heroCardSub: 'Khu vực phục vụ, giá, thời lượng, và xác nhận được hiển thị trước khi đặt.',
      bookNow: 'Đặt Ngay',
      chatAssistant: 'Chat với Trợ Lý AI Barber',
      talkAssistant: 'Nói chuyện với Trợ Lý AI Barber',
      trustChipLicensed: 'Thợ có chứng chỉ',
      trustChipHouseCall: 'Phục vụ tại nhà',
      trustChipVerified: 'Vendor đã xác minh',
      trustChipTravel: 'Phạm vi di chuyển',
      trustChipFamily: 'Gói gia đình',
      trustHomeTitle: 'Dịch vụ tận nhà',
      trustHomeCopy: 'Thợ cắt tóc sẽ đến địa chỉ bạn chọn.',
      trustVerifiedTitle: 'Thợ đã xác minh',
      trustVerifiedCopy: 'Hồ sơ hiển thị khu vực phục vụ và ngôn ngữ hỗ trợ.',
      trustPricingTitle: 'Giá minh bạch',
      trustPricingCopy: 'Mỗi thẻ hiển thị giá, thời lượng, và phí di chuyển.',
      trustConfirmTitle: 'Xác nhận lịch hẹn',
      trustConfirmCopy: 'Lịch giữ trạng thái chờ cho đến khi kiểm tra chỗ trống.',
      promoKicker: 'Xem trước dịch vụ',
      promoTitle: 'Kiểu tóc AI mới nhất',
      promoCopy: 'Lướt qua fade, taper, tỉa râu, cắt tóc trẻ em, kiểu công sở, người lớn tuổi, line up, và gói gia đình.',
      promoCta: 'Đặt lịch cắt tóc tại nhà hôm nay',
      beforeAfterKicker: 'Mẫu kiểu tóc',
      beforeAfterTitle: 'Mẫu kiểu tóc thợ cắt tại nhà do AI tạo',
      beforeAfterCopy: 'Mẫu kiểu tóc thợ cắt tại nhà do AI tạo. Hình thật của thợ sẽ được cập nhật sau.',
      stylePreviewSuffix: 'Mẫu Kiểu Tóc',
      convenienceKicker: 'Tiện lợi',
      convenienceTitle: 'Sự tiện lợi của cắt tóc lưu động',
      promoClipsKicker: 'Clip quảng bá',
      promoClipsTitle: 'Thẻ quảng bá barber có chuyển động',
      promoClipsCopy: 'Trang này chưa nối pipeline tạo video, nên dùng thẻ chuyển động thay vì lặp lại hình hero.',
      servicesKicker: 'Dịch vụ',
      servicesTitle: 'Chọn dịch vụ cắt tóc tại nhà',
      vendorsKicker: 'Thợ cắt tóc',
      vendorsTitle: 'Hồ sơ thợ cắt tóc đang phục vụ',
      priceLabel: 'Giá',
      durationLabel: 'Thời lượng',
      travelBufferLabel: 'Thời gian di chuyển',
      cleanupLabel: 'Dọn dẹp',
      minutes: 'phút',
      selectService: 'Chọn Dịch Vụ',
      selectedServiceLabel: 'Dịch vụ đã chọn',
      bookThisService: 'Đặt dịch vụ này',
      chatThisService: 'Chat với AI để đặt',
      talkThisService: 'Nói với AI để đặt',
      locationGateKicker: 'Khu vực phục vụ',
      locationGateTitle: 'Thành phố hoặc mã ZIP nơi muốn thợ đến?',
      locationGateCopy: 'Nhập thành phố hoặc mã ZIP 5 số — chỉ cần một trong hai là đủ để chọn đúng thợ.',
      cityLabel: 'Thành phố',
      zipLabel: 'Mã ZIP',
      findMyBarber: 'Tìm Thợ Cắt Tóc',
      changeLocation: 'Đổi khu vực',
      emailLabel: 'Email',
      notifyMe: 'Báo cho tôi',
      noServiceArea: 'Hiện chưa phục vụ {city}. Để lại email, tụi em sẽ báo khi mở rộng khu vực.',
      waitlistSaved: 'Cảm ơn bạn. Tụi em sẽ báo khi mở rộng khu vực đó.',
      locationRequired: 'Vui lòng nhập thành phố hoặc mã ZIP 5 số.',
      aiPreviewDisclosure: 'Ảnh mẫu tạo bằng AI. Portfolio thật của thợ sẽ có sau.',
      serviceAreaLabel: 'Khu vực phục vụ',
      radiusLabel: 'Bán kính di chuyển',
      travelFeeLabel: 'Phí di chuyển cơ bản',
      languagesLabel: 'Ngôn ngữ',
      ratingLabel: 'Đánh giá',
      emptyTitle: 'Hiện chưa có thợ cắt tóc tại nhà.',
      emptyCopy: 'Vui lòng xem marketplace hoặc hỏi Du Lich Cali về lựa chọn dịch vụ tận nhà sắp tới.',
      emptyCta: 'Về Du Lich Cali',
      assistantKicker: 'Trợ lý AI',
      assistantTitle: 'Trợ lý mobile barber đã sẵn sàng nhận thông tin đặt lịch.',
      assistantCopy: 'Trang Phase 2 này không xác nhận lịch hẹn. CTA trợ lý sẽ thu thập dịch vụ, địa chỉ, ngày, giờ, thợ mong muốn, và thông tin liên hệ ở phase sau.',
      assistantClose: 'Đóng',
      serviceClassicName: 'Cắt Tóc Tận Nhà Cơ Bản',
      serviceClassicDesc: 'Cắt tóc tại nhà với thời gian chuẩn bị và dọn dẹp.',
      serviceComboName: 'Cắt Tóc và Tỉa Râu',
      serviceComboDesc: 'Cắt tóc lưu động, tạo dáng râu, và dọn dẹp nhẹ tại địa chỉ của bạn.'
    },
    es: {
      pageTitle: 'Barbero Móvil | Du Lich Cali',
      languageLabel: 'Elegir idioma',
      heroActionsLabel: 'Acciones de barbero móvil',
      trustLabel: 'Detalles de confianza para barbero móvil',
      heroKicker: 'Servicio a domicilio en Orange County',
      heroTitle: 'Mobile Barber — In-Home Haircuts',
      heroCopy: 'Reserve un barbero verificado para su casa, hotel, oficina, o centro de cuidado con precios claros antes de confirmar la cita.',
      heroStatus: 'Barbero verificado',
      heroCardTitle: 'Cortes en su dirección',
      heroCardSub: 'Área de servicio, precio, duración, y confirmación antes de reservar.',
      bookNow: 'Reservar Ahora',
      chatAssistant: 'Chatear con el Asistente AI Barber',
      talkAssistant: 'Hablar con el Asistente AI Barber',
      trustChipLicensed: 'Barbero con licencia',
      trustChipHouseCall: 'Visita a domicilio',
      trustChipVerified: 'Vendedor verificado',
      trustChipTravel: 'Cobertura de viaje',
      trustChipFamily: 'Paquete familiar',
      trustHomeTitle: 'Servicio a domicilio',
      trustHomeCopy: 'El barbero viaja a la dirección seleccionada.',
      trustVerifiedTitle: 'Barbero verificado',
      trustVerifiedCopy: 'Los perfiles muestran área de servicio e idiomas.',
      trustPricingTitle: 'Precios transparentes',
      trustPricingCopy: 'Cada tarjeta muestra precio, duración, y tarifa de viaje.',
      trustConfirmTitle: 'Confirmación de cita',
      trustConfirmCopy: 'Las reservas quedan pendientes hasta revisar disponibilidad.',
      promoKicker: 'Vista de servicio',
      promoTitle: 'Últimos estilos de corte AI',
      promoCopy: 'Desliza por fade, taper, barba, niños, corte ejecutivo, senior, line up, y paquete familiar.',
      promoCta: 'Reservar corte en casa hoy',
      beforeAfterKicker: 'Estilos de muestra',
      beforeAfterTitle: 'Estilos de barbero móvil generados por AI',
      beforeAfterCopy: 'Vistas previas curadas de estilos de barbero móvil. Las fotos reales del portafolio del barbero estarán disponibles pronto.',
      stylePreviewSuffix: 'Vista de Estilo',
      convenienceKicker: 'Conveniencia',
      convenienceTitle: 'Conveniencia del corte móvil',
      promoClipsKicker: 'Clips promocionales',
      promoClipsTitle: 'Promos animadas de barbero móvil',
      promoClipsCopy: 'La generación de video aún no está conectada aquí, así que usamos tarjetas animadas en vez de repetir el hero.',
      servicesKicker: 'Servicios',
      servicesTitle: 'Elija un servicio de barbero móvil',
      vendorsKicker: 'Barberos',
      vendorsTitle: 'Perfiles de barberos móviles disponibles',
      priceLabel: 'Precio',
      durationLabel: 'Duración',
      travelBufferLabel: 'Tiempo de viaje',
      cleanupLabel: 'Limpieza',
      minutes: 'min',
      selectService: 'Seleccionar Servicio',
      selectedServiceLabel: 'Servicio seleccionado',
      bookThisService: 'Reservar este servicio',
      chatThisService: 'Chatear con AI para reservar',
      talkThisService: 'Hablar con AI para reservar',
      locationGateKicker: 'Área de servicio',
      locationGateTitle: '¿A qué ciudad o código postal debe ir el barbero?',
      locationGateCopy: 'Ingrese su ciudad o código postal de 5 dígitos — basta con uno para conectarle con el barbero correcto.',
      cityLabel: 'Ciudad',
      zipLabel: 'Código ZIP',
      findMyBarber: 'Buscar Mi Barbero',
      changeLocation: 'Cambiar ubicación',
      emailLabel: 'Email',
      notifyMe: 'Avisarme',
      noServiceArea: 'Todavía no servimos {city}. Deje su email y le avisaremos cuando lleguemos.',
      waitlistSaved: 'Gracias. Le avisaremos cuando ampliemos a esa zona.',
      locationRequired: 'Ingrese una ciudad o un código postal de 5 dígitos.',
      aiPreviewDisclosure: 'Vista previa de estilo generada por AI. Portafolio real del barbero próximamente.',
      serviceAreaLabel: 'Área de servicio',
      radiusLabel: 'Radio de viaje',
      travelFeeLabel: 'Tarifa base de viaje',
      languagesLabel: 'Idiomas',
      ratingLabel: 'Calificación',
      emptyTitle: 'Todavía no hay barberos móviles disponibles.',
      emptyCopy: 'Revise el marketplace o pregunte a Du Lich Cali por la próxima opción de servicio a domicilio.',
      emptyCta: 'Volver a Du Lich Cali',
      assistantKicker: 'Asistente AI',
      assistantTitle: 'El asistente de barbero móvil está listo para tomar datos de reserva.',
      assistantCopy: 'Esta página de Phase 2 no confirma citas. El CTA del asistente recopilará servicio, dirección, fecha, hora, preferencia de barbero, y contacto en una fase posterior.',
      assistantClose: 'Cerrar',
      serviceClassicName: 'Corte Móvil Clásico',
      serviceClassicDesc: 'Corte a domicilio con tiempo reservado para preparación y limpieza.',
      serviceComboName: 'Corte y Arreglo de Barba',
      serviceComboDesc: 'Corte móvil, perfilado de barba, y limpieza ligera en su dirección.'
    }
  };

  var SERVICE_COPY = {
    'classic-mobile-cut': { name: 'serviceClassicName', desc: 'serviceClassicDesc' },
    'mobile-haircut-beard': { name: 'serviceComboName', desc: 'serviceComboDesc' }
  };

  var LOCATION_STORAGE_KEY = 'mb_customer_location';
  var LOCATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  var state = {
    lang: 'en',
    selectedServiceId: '',
    pendingServiceId: '',
    agentSession: null,
    lastBooking: null,
    existingBookings: [],
    locationSubmitted: false,
    waitlistLocation: null
  };

  function getLang() {
    var param = new URLSearchParams(root.location.search).get('lang');
    if (param && STRINGS[param]) return param;
    try {
      var saved = localStorage.getItem('dlcLang') || localStorage.getItem('dlc_lang');
      if (saved && STRINGS[saved]) return saved;
    } catch (e) {}
    return 'en';
  }

  function t(key) {
    return (STRINGS[state.lang] && STRINGS[state.lang][key]) || STRINGS.en[key] || '';
  }

  function setText(selectorRoot) {
    selectorRoot.querySelectorAll('[data-i18n]').forEach(function(el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
  }

  function formatMoney(value) {
    return '$' + Number(value || 0).toFixed(0);
  }

  function interpolate(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, function(_, key) {
      return values[key] == null ? '' : values[key];
    });
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function metaChip(label, value) {
    var chip = el('span', 'mb-chip');
    chip.textContent = label + ': ' + value;
    return chip;
  }

  function serviceCopy(service, field) {
    var keys = SERVICE_COPY[service.id];
    if (!keys) return field === 'name' ? service.name : service.description;
    return field === 'name' ? t(keys.name) : t(keys.desc);
  }

  function selectedService() {
    var services = DATA && DATA.sampleServices ? DATA.sampleServices : [];
    return services.filter(function(service) { return service.id === state.selectedServiceId; })[0] || null;
  }

  function readSavedLocation() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.city || !parsed.savedAt) return null;
      if ((Date.now() - Number(parsed.savedAt)) > LOCATION_MAX_AGE_MS) {
        root.localStorage.removeItem(LOCATION_STORAGE_KEY);
        return null;
      }
      return { city: String(parsed.city || ''), zip: String(parsed.zip || ''), savedAt: Number(parsed.savedAt) };
    } catch (e) {
      return null;
    }
  }

  function saveCustomerLocation(location) {
    try {
      root.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
        city: String(location.city || '').trim(),
        zip: String(location.zip || '').trim(),
        savedAt: Date.now()
      }));
    } catch (e) {}
  }

  function clearCustomerLocation() {
    try { root.localStorage.removeItem(LOCATION_STORAGE_KEY); } catch (e) {}
  }

  function currentLocationInput() {
    var zip = String((document.getElementById('mbLocationZip') || {}).value || '').trim();
    var typedCity = String((document.getElementById('mbLocationCity') || {}).value || '').trim();
    // Either field is sufficient. If only ZIP is typed, derive city from
    // the embedded lookup so findVendorForAddress can match on city too.
    return { zip: zip, city: typedCity || cityForZip(zip) };
  }

  // Minimal zip → city fallback so we can keep findVendorForAddress() honest
  // when the gate only collects a ZIP. Covers every ZIP listed in
  // mobile-barber-data.js vendor.zipCoverage. Vendors can extend by adding
  // more zips to their data without code change here.
  var ZIP_TO_CITY = {
    // OC (Michael coverage)
    '92647': 'Huntington Beach', '92683': 'Westminster', '92627': 'Costa Mesa',
    '92704': 'Santa Ana', '92840': 'Garden Grove', '92843': 'Garden Grove',
    '92703': 'Santa Ana', '92868': 'Orange', '92614': 'Irvine',
    '92866': 'Orange', '92867': 'Orange', '92708': 'Fountain Valley',
    // Bay Area (Tim coverage)
    '95112': 'San Jose', '95121': 'San Jose', '95122': 'San Jose',
    '95050': 'Santa Clara', '95051': 'Santa Clara', '95035': 'Milpitas',
    '94085': 'Sunnyvale', '94040': 'Mountain View', '95014': 'Cupertino',
    '95030': 'Los Gatos', '95008': 'Campbell', '94536': 'Fremont'
  };
  function cityForZip(zip) {
    var z = String(zip || '').trim();
    if (!/^\d{5}$/.test(z)) return '';
    return ZIP_TO_CITY[z] || '';
  }

  function setLocationStatus(message) {
    var status = document.getElementById('mbLocationGateStatus');
    if (status) status.textContent = message || '';
  }

  function prefillLocationGate() {
    var saved = readSavedLocation();
    var city = document.getElementById('mbLocationCity');
    var zip = document.getElementById('mbLocationZip');
    var change = document.querySelector('[data-action="changeLocation"]');
    if (saved) {
      if (city && !city.value) city.value = saved.city;
      if (zip && !zip.value) zip.value = saved.zip;
      if (change) change.hidden = false;
    } else if (change) {
      change.hidden = true;
    }
  }

  function vendorUrlForRoute(vendor, serviceId, mode, location) {
    var params = new URLSearchParams();
    serviceId = serviceIdForVendor(vendor, serviceId);
    if (serviceId) params.set('serviceId', serviceId);
    if (mode) params.set('assistant', mode);
    if (location && location.city) params.set('city', location.city);
    if (location && location.zip) params.set('zip', location.zip);
    params.set('from', 'landing');
    if (state.lang) params.set('lang', state.lang);
    return '/mobile-barber/vendor/' + encodeURIComponent(vendor.id) + '?' + params.toString();
  }

  function serviceSlug(serviceId) {
    var vendors = DATA && DATA.sampleVendors ? DATA.sampleVendors : [];
    for (var i = 0; i < vendors.length; i++) {
      var prefix = vendors[i].id + '-';
      if (String(serviceId || '').indexOf(prefix) === 0) return String(serviceId).slice(prefix.length);
    }
    return String(serviceId || '');
  }

  function serviceIdForVendor(vendor, serviceId) {
    if (!vendor || !serviceId) return serviceId || '';
    if (String(serviceId).indexOf(vendor.id + '-') === 0) return serviceId;
    var selected = (DATA.sampleServices || []).filter(function(service) { return service.id === serviceId; })[0] || null;
    var slug = serviceSlug(serviceId);
    var services = DATA.listServicesForVendor ? DATA.listServicesForVendor(vendor.id) : [];
    var matched = services.filter(function(service) {
      return service.id === vendor.id + '-' + slug ||
        (selected && String(service.name || '').toLowerCase() === String(selected.name || '').toLowerCase());
    })[0];
    return (matched && matched.id) || serviceId;
  }

  function routeByLocation(location, serviceId, mode) {
    if (!location) {
      setLocationStatus(t('locationRequired'));
      return false;
    }
    var hasCity = !!(location.city && location.city.trim());
    var hasZip = !!(location.zip && /^\d{5}$/.test(location.zip));
    if (!hasCity && !hasZip) {
      setLocationStatus(t('locationRequired'));
      return false;
    }
    var vendor = BOOKING && BOOKING.findVendorForAddress ? BOOKING.findVendorForAddress(location, {
      vendors: DATA.sampleVendors
    }) : null;
    if (!vendor) {
      state.waitlistLocation = location;
      var copy = document.getElementById('mbWaitlistCopy');
      var waitlist = document.getElementById('mbWaitlistForm');
      if (copy) copy.textContent = interpolate(t('noServiceArea'), { city: location.city });
      if (waitlist) waitlist.hidden = false;
      setLocationStatus('');
      return false;
    }
    saveCustomerLocation(location);
    root.location.href = vendorUrlForRoute(vendor, serviceId, mode, location);
    return true;
  }

  function promptForLocation(serviceId) {
    state.pendingServiceId = serviceId || '';
    var gate = document.getElementById('mbLocationGate');
    var waitlist = document.getElementById('mbWaitlistForm');
    if (waitlist) waitlist.hidden = true;
    prefillLocationGate();
    setLocationStatus('');
    if (gate) {
      gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
      gate.classList.add('mb-location-gate--active');
    }
    var city = document.getElementById('mbLocationCity');
    if (city && typeof city.focus === 'function') setTimeout(function() { city.focus(); }, 120);
  }

  function submitWaitlist() {
    var email = String((document.getElementById('mbWaitlistEmail') || {}).value || '').trim();
    var location = state.waitlistLocation || currentLocationInput();
    if (!email || !location.city) return Promise.resolve(false);
    var db = root.firebase && root.firebase.firestore && root.firebase.apps && root.firebase.apps.length
      ? root.firebase.firestore()
      : null;
    if (!db) {
      setLocationStatus(t('waitlistSaved'));
      return Promise.resolve(false);
    }
    return db.collection('mobileBarberWaitlist').add({
      email: email,
      city: location.city,
      zip: location.zip || '',
      createdAt: root.firebase.firestore.FieldValue.serverTimestamp(),
      source: 'landing_no_match'
    }).then(function() {
      setLocationStatus(t('waitlistSaved'));
      document.getElementById('mbWaitlistForm').hidden = true;
      return true;
    }).catch(function() {
      setLocationStatus(t('waitlistSaved'));
      return false;
    });
  }

  function preferredVendor() {
    var vendors = DATA && DATA.sampleVendors ? DATA.sampleVendors.filter(function(vendor) { return vendor.active !== false; }) : [];
    var sessionState = state.agentSession && state.agentSession.state;
    var preference = String(sessionState && sessionState.barberPreference || '').toLowerCase();
    if (preference) {
      var matched = vendors.filter(function(vendor) {
        return String(vendor.businessName + ' ' + vendor.barberName + ' ' + vendor.id).toLowerCase().indexOf(preference.split(/\s+/)[0]) >= 0;
      })[0];
      if (matched) return matched;
    }
    var service = selectedService();
    if (service && DATA.findVendorById) return DATA.findVendorById(service.vendorId);
    if (DATA.findVendorById && DATA.MICHAEL_VENDOR_ID) return DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    return vendors[0] || null;
  }

  function servicesForVendor(vendorId) {
    if (DATA && typeof DATA.listServicesForVendor === 'function') return DATA.listServicesForVendor(vendorId);
    return (DATA && DATA.sampleServices ? DATA.sampleServices : []).filter(function(service) {
      return service.vendorId === vendorId && service.active !== false;
    });
  }

  function _buildAIBrainProvider() {
    if (!root.AIEngine || typeof root.AIEngine.call !== 'function') return null;
    return function(req) {
      return root.AIEngine.call('nails', '', req.systemPrompt, req.history || [], { intent: 'booking' })
        .then(function(resp) {
          var text = (resp && resp.content && resp.content[0] && resp.content[0].text) || '';
          return { text: text };
        });
    };
  }

  function agentContext(vendor) {
    vendor = vendor || preferredVendor();
    return {
      lang: state.lang,
      vendor: vendor,
      vendorId: vendor && vendor.id,
      services: servicesForVendor(vendor && vendor.id),
      availability: DATA && DATA.sampleAvailability,
      existingBookings: state.existingBookings,
      now: new Date(),
      phoneIntake: root.PhoneIntake || null,
      customerLookupProvider: function(phone) {
        if (!BOOKING || typeof BOOKING.lookupReturningCustomer !== 'function' || !vendor) return Promise.resolve(null);
        return BOOKING.lookupReturningCustomer(vendor.id, phone);
      },
      aiBrainProvider: _buildAIBrainProvider()
    };
  }

  function ensureAgentSession() {
    if (AGENT && !state.agentSession) {
      var vendor = preferredVendor();
      var historyKey = 'mb_h_' + ((vendor && vendor.id) || 'general');
      var restored = (root.AIEngine && typeof root.AIEngine.restoreHistory === 'function')
        ? root.AIEngine.restoreHistory(historyKey)
        : null;
      state.agentSession = {
        state: AGENT.emptyState(state.lang),
        history: restored || [],
        _historyKey: historyKey
      };
    }
    var service = selectedService();
    if (AGENT && service) {
      state.agentSession.state = AGENT.mergeState(
        state.agentSession.state || AGENT.emptyState(state.lang),
        { serviceId: service.id, intent: 'booking_request' },
        new Date()
      );
    }
    return state.agentSession;
  }

  function sendAgentMessage(message, options) {
    options = options || {};
    if (!AGENT || !BOOKING) return Promise.resolve({ response: t('assistantCopy') });
    var vendor = preferredVendor();
    if (!vendor) return Promise.resolve({ response: t('assistantCopy') });
    ensureAgentSession();
    var finish = function(existing) {
      state.existingBookings = existing || [];
      var ctx = agentContext(vendor);
      var runner = typeof AGENT.handleMessageAsync === 'function'
        ? AGENT.handleMessageAsync(state.agentSession, message, ctx)
        : Promise.resolve(AGENT.handleMessage(state.agentSession, message, ctx));
      return runner.then(function(result) {
        state.agentSession = result.session;
        if (state.agentSession && state.agentSession.history && state.agentSession._historyKey
            && root.AIEngine && typeof root.AIEngine.saveHistory === 'function') {
          root.AIEngine.saveHistory(state.agentSession._historyKey, state.agentSession.history.slice(-20));
        }
        if (result.booking) {
          if (options.source) result.booking.source = options.source;
          return BOOKING.saveBooking(result.booking).then(function(saved) {
            state.lastBooking = saved.booking;
            result.booking = saved.booking;
            return result;
          });
        }
        return result;
      });
    };
    return BOOKING.loadExistingBookings(vendor.id).then(finish).catch(function() {
      return finish([]);
    });
  }

  function openAssistantPanel(mode) {
    ensureAgentSession();
    var panel = document.getElementById('mbAssistantPanel');
    panel.hidden = false;
    var copy = panel.querySelector('[data-i18n="assistantCopy"]');
    if (copy && AGENT && typeof AGENT.initialPrompt === 'function') {
      copy.textContent = AGENT.initialPrompt(mode === 'vendor' ? { vendor: preferredVendor() } : {}, state.lang);
    }
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return panel;
  }

  function openVoiceAssistant() {
    openAssistantPanel('general');
    if (!root.MobileBarberVoice) return;
    var controller = {
      getLang: function() { return state.lang; },
      setLang: setLang,
      getSession: function() { return state.agentSession; },
      sendMessage: sendAgentMessage,
      initialPrompt: function() {
        return AGENT && typeof AGENT.initialPrompt === 'function'
          ? AGENT.initialPrompt({}, state.lang)
          : '';
      },
      openTextFallback: function() { openAssistantPanel('general'); },
      vendorId: function() {
        var vendor = preferredVendor();
        return vendor && vendor.id;
      }
    };
    root.MobileBarberVoice.open(controller);
  }

  function landingServices(services) {
    var source = services || [];
    var activeVendorIds = {};
    (DATA && DATA.sampleVendors ? DATA.sampleVendors : []).forEach(function(vendor) {
      if (vendor.active !== false) activeVendorIds[vendor.id] = true;
    });
    var seen = {};
    return source.filter(function(service) {
      var key = String(service.name || service.id).toLowerCase();
      if (service.active === false || !activeVendorIds[service.vendorId] || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function serviceImage(service) {
    if (DATA && DATA.findServiceImageByServiceId) {
      return DATA.findServiceImageByServiceId(service.id) || service;
    }
    return service;
  }

  function promoContentItems(services) {
    // Prefer the canonical style templates (DATA.listStyleTemplates) when
    // available — that's the single source of truth for displayOrder,
    // category, isAIGenerated, active, clipUrl. Fall back to per-vendor
    // services so vendor-specific menus still render.
    if (DATA && typeof DATA.listStyleTemplates === 'function') {
      var templates = DATA.listStyleTemplates();
      if (templates && templates.length) {
        return templates.map(function(tmpl) {
          var service = (services || []).filter(function(s) { return s.id === tmpl.id; })[0] || null;
          return {
            id: tmpl.id,
            title: service ? serviceCopy(service, 'name') : tmpl.title,
            category: tmpl.category,
            imageUrl: tmpl.imageUrl,
            clipUrl: tmpl.clipUrl || '',
            prompt: tmpl.imagePrompt || '',
            isAIGenerated: tmpl.isAIGenerated === true,
            active: tmpl.active !== false,
            displayOrder: tmpl.displayOrder,
            price: service && service.price,
            imageAlt: tmpl.imageAlt || tmpl.title
          };
        }).filter(function(item) { return item.active; });
      }
    }
    return (services || []).map(function(service, index) {
      var imageRecord = serviceImage(service);
      return {
        id: service.id,
        title: serviceCopy(service, 'name'),
        category: service.category || 'haircut',
        imageUrl: imageRecord.imageUrl || service.imageUrl || '',
        clipUrl: imageRecord.clipUrl || service.clipUrl || '',
        prompt: imageRecord.prompt || imageRecord.imagePrompt || service.prompt || service.imagePrompt || '',
        isAIGenerated: true,
        active: service.active !== false,
        displayOrder: index + 1,
        price: service.price,
        imageAlt: imageRecord.imageAlt || service.imageAlt || service.name
      };
    }).filter(function(item) {
      return item.active;
    });
  }

  function vendorUrl(service, mode) {
    var saved = readSavedLocation();
    if (saved && BOOKING && BOOKING.findVendorForAddress) {
      var vendor = BOOKING.findVendorForAddress(saved, { vendors: DATA.sampleVendors });
      if (vendor) return vendorUrlForRoute(vendor, service.id, mode, saved);
    }
    return '#mbLocationGate';
  }

  function renderServiceProgress(services) {
    var progress = document.getElementById('mbServiceProgress');
    if (!progress) return;
    progress.innerHTML = '';
    services.forEach(function(service, index) {
      var dot = el('button', 'mb-service-progress__dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', service.name);
      dot.addEventListener('click', function() {
        var cards = document.querySelectorAll('#mbServiceList .mb-service-card');
        if (cards[index]) cards[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
      progress.appendChild(dot);
    });
  }

  function syncServiceProgress() {
    var list = document.getElementById('mbServiceList');
    var dots = document.querySelectorAll('#mbServiceProgress .mb-service-progress__dot');
    if (!list || !dots.length) return;
    var card = list.querySelector('.mb-service-card');
    var width = card ? card.getBoundingClientRect().width : list.clientWidth;
    var index = width ? Math.round(list.scrollLeft / width) : 0;
    dots.forEach(function(dot, i) {
      dot.classList.toggle('mb-service-progress__dot--active', i === index);
    });
  }

  function selectService(service) {
    state.selectedServiceId = service.id;
    document.querySelectorAll('#mbServiceList .mb-service-card').forEach(function(card) {
      card.classList.toggle('mb-service-card--selected', card.getAttribute('data-service-id') === service.id);
    });
    renderSelectedService(service);
  }

  function renderSelectedService(service) {
    var panel = document.getElementById('mbServiceSelection');
    if (!panel || !service) return;
    panel.innerHTML = '';

    var text = el('div', 'mb-service-selection__text');
    var label = el('span');
    var title = el('strong');
    var actions = el('div', 'mb-service-selection__actions');
    var book = el('a', 'mb-button mb-button--primary');
    var chat = el('button', 'mb-button mb-button--ghost');
    var voice = el('button', 'mb-button mb-button--ghost');

    label.textContent = t('selectedServiceLabel');
    title.textContent = serviceCopy(service, 'name') + ' · ' + formatMoney(service.price);
    book.href = vendorUrl(service, '');
    book.addEventListener('click', function(event) {
      var saved = readSavedLocation();
      if (saved && BOOKING.findVendorForAddress(saved, { vendors: DATA.sampleVendors })) return;
      event.preventDefault();
      promptForLocation(service.id);
    });
    chat.type = 'button';
    voice.type = 'button';
    chat.setAttribute('data-action', 'chatSelectedService');
    voice.setAttribute('data-action', 'voiceSelectedService');
    book.textContent = t('bookThisService');
    chat.textContent = t('chatThisService');
    voice.textContent = t('talkThisService');
    chat.addEventListener('click', function() {
      state.selectedServiceId = service.id;
      openAssistantPanel('general');
    });
    voice.addEventListener('click', function() {
      state.selectedServiceId = service.id;
      openVoiceAssistant();
    });

    text.appendChild(label);
    text.appendChild(title);
    actions.appendChild(book);
    actions.appendChild(chat);
    actions.appendChild(voice);
    panel.appendChild(text);
    panel.appendChild(actions);
    panel.hidden = false;
  }

  function renderServices() {
    var list = document.getElementById('mbServiceList');
    if (!list) return;
    list.innerHTML = '';
    var services = DATA && DATA.sampleServices ? DATA.sampleServices.filter(function(service) {
      return service.active !== false;
    }) : [];
    services = landingServices(services);
    services.forEach(function(service) {
      var card = el('article', 'mb-service-card');
      var media = el('div', 'mb-service-card__media');
      var image = el('img', 'mb-service-card__image');
      var disclosure = el('span', 'mb-service-card__disclosure');
      var body = el('div', 'mb-service-card__body');
      var title = el('h3');
      var desc = el('p');
      var row = el('div', 'mb-meta-row');
      var cta = el('button', 'mb-button mb-button--primary');
      var imageRecord = serviceImage(service);

      card.setAttribute('data-service-id', service.id);
      image.src = imageRecord.imageUrl || service.imageUrl || '';
      image.alt = imageRecord.imageAlt || service.imageAlt || service.name;
      disclosure.textContent = t('aiPreviewDisclosure');
      title.textContent = serviceCopy(service, 'name');
      desc.textContent = serviceCopy(service, 'desc');
      row.appendChild(metaChip(t('priceLabel'), formatMoney(service.price)));
      row.appendChild(metaChip(t('durationLabel'), service.durationMinutes + ' ' + t('minutes')));
      row.appendChild(metaChip(t('travelBufferLabel'), service.travelBufferMinutes + ' ' + t('minutes')));
      row.appendChild(metaChip(t('cleanupLabel'), service.cleanupBufferMinutes + ' ' + t('minutes')));
      cta.type = 'button';
      cta.textContent = t('selectService');
      cta.addEventListener('click', function() {
        selectService(service);
        var saved = readSavedLocation();
        if (!saved || !BOOKING.findVendorForAddress(saved, { vendors: DATA.sampleVendors })) {
          promptForLocation(service.id);
        }
      });

      media.appendChild(image);
      media.appendChild(disclosure);
      body.appendChild(title);
      body.appendChild(desc);
      body.appendChild(row);
      body.appendChild(cta);
      card.appendChild(media);
      card.appendChild(body);
      list.appendChild(card);
    });
    renderServiceProgress(services);
    if (state.selectedServiceId) {
      var selected = services.filter(function(service) { return service.id === state.selectedServiceId; })[0];
      if (selected) renderSelectedService(selected);
    } else {
      var selection = document.getElementById('mbServiceSelection');
      if (selection) selection.hidden = true;
    }
    syncServiceProgress();
  }

  function renderPromoPreview() {
    var list = document.getElementById('mbPromoPreview');
    if (!list) return;
    list.innerHTML = '';
    var services = DATA && DATA.sampleServices ? DATA.sampleServices.filter(function(service) {
      return service.active !== false;
    }) : [];
    promoContentItems(landingServices(services)).forEach(function(item) {
      var card = el('article', 'mb-promo__card');
      var img = document.createElement('img');
      var body = el('div', 'mb-promo__card-body');
      var title = el('strong');
      var price = el('span');
      card.setAttribute('data-promo-id', item.id);
      card.setAttribute('data-promo-category', item.category);
      img.src = item.imageUrl;
      img.alt = item.imageAlt;
      img.loading = 'lazy';
      title.textContent = item.title;
      price.textContent = formatMoney(item.price);
      body.appendChild(title);
      body.appendChild(price);
      card.appendChild(img);
      card.appendChild(body);
      list.appendChild(card);
    });
  }

  function renderStylePreviewGallery() {
    // Truth-first replacement for the old before/after gallery.
    // The image-to-image identity lock for AI before/after pairs is not
    // reliable enough to claim 'same person'. Showing one curated style
    // preview per category avoids misleading the customer until a real
    // barber portfolio is uploaded.
    var list = document.getElementById('mbBeforeAfterGallery');
    if (!list) return;
    list.innerHTML = '';
    var templates = (DATA && typeof DATA.listStyleTemplates === 'function')
      ? DATA.listStyleTemplates()
      : [];
    var picked = templates.filter(function(tmpl) {
      return tmpl && tmpl.active !== false && tmpl.imageUrl;
    }).slice(0, 6);

    picked.forEach(function(tmpl) {
      var card = el('article', 'mb-portfolio-card mb-portfolio-card--ai-sample mb-style-preview-card');

      var media = el('div', 'mb-style-preview-card__media');
      var badge = el('span', 'mb-portfolio-card__ai-badge mb-portfolio-card__ai-badge--clip');
      badge.textContent = 'AI preview';
      media.appendChild(badge);
      if (tmpl.imageUrl) {
        media.style.backgroundImage = "url('" + tmpl.imageUrl + "')";
        media.setAttribute('role', 'img');
        media.setAttribute('aria-label', tmpl.imageAlt || tmpl.title || '');
      }
      card.appendChild(media);

      var chip = el('span', 'mb-portfolio-card__category');
      var title = el('h3');
      var desc = el('p');
      chip.textContent = tmpl.category || 'style';
      title.textContent = (tmpl.title || '') + ' — ' + t('stylePreviewSuffix');
      desc.textContent = t('aiPreviewDisclosure');
      card.appendChild(chip);
      card.appendChild(title);
      card.appendChild(desc);
      list.appendChild(card);
    });
  }

  function renderConvenience() {
    var list = document.getElementById('mbConvenienceList');
    if (!list) return;
    list.innerHTML = '';
    [
      'Barber comes to your home',
      'Good for kids and seniors',
      'Hotel / office / care facility appointments',
      'Transparent pricing',
      'No waiting room',
      'Flexible scheduling',
      'English / Vietnamese support'
    ].forEach(function(text) {
      var card = el('article', 'mb-convenience-card');
      var icon = el('span');
      var body = el('strong');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '✓';
      body.textContent = text;
      card.appendChild(icon);
      card.appendChild(body);
      list.appendChild(card);
    });
  }

  function renderPromoClips() {
    var list = document.getElementById('mbPromoClips');
    if (!list) return;
    list.innerHTML = '';
    var rails = [
      ['Fade at home', 'Fresh fade setup, cleanup, and finish without a waiting room.', '/assets/mobile-barber/clips/fade-1.mp4', '/assets/mobile-barber/portfolio/fade-1-after.jpg'],
      ['Family haircut stop', 'One mobile visit can cover kids, seniors, and parents.', '/assets/mobile-barber/clips/family-haircut-1.mp4', '/assets/mobile-barber/portfolio/family-haircut-1-after.jpg'],
      ['Hotel-ready grooming', 'Business cut and beard detail before meetings or events.', '/assets/mobile-barber/clips/business-haircut-1.mp4', '/assets/mobile-barber/portfolio/business-haircut-1-after.jpg']
    ];
    rails.forEach(function(row, index) {
      var card = el('article', 'mb-promo-clip-card mb-promo-clip-card--video');
      var title = el('strong');
      var copy = el('p');
      card.style.setProperty('--clip-delay', String(index * 120) + 'ms');
      var video = document.createElement('video');
      video.src = row[2];
      video.poster = row[3];
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'metadata');
      video.setAttribute('aria-label', row[0]);
      title.textContent = row[0];
      copy.textContent = row[1];
      card.appendChild(video);
      card.appendChild(title);
      card.appendChild(copy);
      list.appendChild(card);
    });
  }

  function renderVendors() {
    var list = document.getElementById('mbVendorList');
    var empty = document.getElementById('mbEmptyState');
    if (!list || !empty) return;
    list.innerHTML = '';
    var vendors = DATA && DATA.sampleVendors ? DATA.sampleVendors.filter(function(vendor) {
      return vendor.active !== false;
    }) : [];

    empty.hidden = vendors.length > 0;
    vendors.forEach(function(vendor) {
      var card = el('article', 'mb-vendor-card');
      var top = el('div', 'mb-vendor-card__top');
      var avatar = el('div', 'mb-vendor-card__avatar');
      var headingWrap = el('div');
      var title = el('h3');
      var barber = el('p');
      var area = el('p');
      var row = el('div', 'mb-meta-row');
      var cta = el('a', 'mb-button mb-button--primary');

      title.textContent = vendor.businessName;
      barber.textContent = vendor.barberName;
      area.textContent = t('serviceAreaLabel') + ': ' + (vendor.serviceAreas || []).join(', ');
      row.appendChild(metaChip(t('radiusLabel'), vendor.travelRadiusMiles + ' mi'));
      row.appendChild(metaChip(t('travelFeeLabel'), formatMoney(vendor.baseTravelFee)));
      row.appendChild(metaChip(t('languagesLabel'), (vendor.languages || []).join(', ').toUpperCase()));
      row.appendChild(metaChip(t('ratingLabel'), String(vendor.rating || '')));
      cta.href = '/mobile-barber/vendor/' + encodeURIComponent(vendor.id);
      cta.textContent = t('bookNow');

      headingWrap.appendChild(title);
      headingWrap.appendChild(barber);
      top.appendChild(avatar);
      top.appendChild(headingWrap);
      card.appendChild(top);
      card.appendChild(area);
      card.appendChild(row);
      card.appendChild(cta);
      list.appendChild(card);
    });
  }

  function setLang(lang) {
    if (!STRINGS[lang]) return;
    state.lang = lang;
    document.documentElement.lang = lang;
    document.title = t('pageTitle');
    document.getElementById('mbLanguage').setAttribute('aria-label', t('languageLabel'));
    document.querySelector('.mb-hero__actions').setAttribute('aria-label', t('heroActionsLabel'));
    document.querySelector('.mb-trust').setAttribute('aria-label', t('trustLabel'));
    document.querySelector('[data-action="voice"]').setAttribute('aria-label', t('talkAssistant'));
    setText(document);
    renderPromoPreview();
    renderStylePreviewGallery();
    renderConvenience();
    renderPromoClips();
    renderServices();
    renderVendors();
    document.querySelectorAll('.mb-language__button').forEach(function(btn) {
      btn.classList.toggle('mb-language__button--active', btn.getAttribute('data-lang') === lang);
    });
    try {
      localStorage.setItem('dlcLang', lang);
      localStorage.setItem('dlc_lang', lang);
    } catch (e) {}
  }

  function bind() {
    document.querySelectorAll('[data-lang]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setLang(btn.getAttribute('data-lang'));
      });
    });

    document.querySelectorAll('[data-action="chat"], [data-action="voice"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (btn.getAttribute('data-action') === 'voice') openVoiceAssistant();
        else openAssistantPanel('general');
      });
    });

    document.querySelector('[data-action="closeAssistant"]').addEventListener('click', function() {
      document.getElementById('mbAssistantPanel').hidden = true;
    });

    var list = document.getElementById('mbServiceList');
    if (list) {
      list.addEventListener('scroll', function() {
        root.requestAnimationFrame(syncServiceProgress);
      }, { passive: true });
    }

    var gateForm = document.getElementById('mbLocationGateForm');
    if (gateForm) {
      gateForm.addEventListener('submit', function(event) {
        event.preventDefault();
        state.locationSubmitted = true;
        routeByLocation(currentLocationInput(), state.pendingServiceId || state.selectedServiceId, '');
      });
    }

    var waitlist = document.getElementById('mbWaitlistForm');
    if (waitlist) {
      waitlist.addEventListener('submit', function(event) {
        event.preventDefault();
        submitWaitlist();
      });
    }

    var change = document.querySelector('[data-action="changeLocation"]');
    if (change) {
      change.addEventListener('click', function() {
        clearCustomerLocation();
        state.locationSubmitted = false;
        document.getElementById('mbLocationCity').value = '';
        document.getElementById('mbLocationZip').value = '';
        change.hidden = true;
        promptForLocation(state.selectedServiceId);
      });
    }
  }

  var HERO_SLIDES = [
    '/assets/mobile-barber/styles/classic-haircut.jpg',
    '/assets/mobile-barber/styles/fade-haircut.jpg',
    '/assets/mobile-barber/styles/business-haircut.jpg',
    '/assets/mobile-barber/styles/home-family-package.jpg',
    '/assets/mobile-barber/styles/kids-haircut.jpg',
    '/assets/mobile-barber/styles/modern-styling.jpg'
  ];

  function startHeroRotation() {
    var a = document.querySelector('.mb-hero__photo--a');
    var b = document.querySelector('.mb-hero__photo--b');
    if (!a || !b || HERO_SLIDES.length < 2) return;
    var gradient = 'linear-gradient(180deg, rgba(7, 31, 56, .12), rgba(7, 31, 56, .82))';
    var idx = 0;
    var showingA = true;
    a.style.backgroundImage = gradient + ', url("' + HERO_SLIDES[idx] + '")';
    a.style.opacity = '1';
    b.style.opacity = '0';
    setInterval(function() {
      idx = (idx + 1) % HERO_SLIDES.length;
      var next = showingA ? b : a;
      var current = showingA ? a : b;
      next.style.backgroundImage = gradient + ', url("' + HERO_SLIDES[idx] + '")';
      next.style.opacity = '1';
      current.style.opacity = '0';
      showingA = !showingA;
    }, 4500);
  }

  function init() {
    state.lang = getLang();
    state.selectedServiceId = new URLSearchParams(root.location.search).get('serviceId') || '';
    bind();
    prefillLocationGate();
    setLang(state.lang);
    startHeroRotation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
