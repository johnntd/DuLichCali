'use strict';

(function(root) {
  var DATA = root.MobileBarberData;

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
      trustHomeTitle: 'In-home service',
      trustHomeCopy: 'The barber travels to your selected address.',
      trustVerifiedTitle: 'Verified barber',
      trustVerifiedCopy: 'Profiles show service area and language support.',
      trustPricingTitle: 'Transparent pricing',
      trustPricingCopy: 'Each card shows price, duration, and travel fee.',
      trustConfirmTitle: 'Appointment confirmation',
      trustConfirmCopy: 'Bookings stay pending until availability is checked.',
      servicesKicker: 'Services',
      servicesTitle: 'Choose a mobile barber service',
      vendorsKicker: 'Barbers',
      vendorsTitle: 'Available mobile barber profiles',
      priceLabel: 'Price',
      durationLabel: 'Duration',
      travelBufferLabel: 'Travel buffer',
      cleanupLabel: 'Cleanup',
      minutes: 'min',
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
      trustHomeTitle: 'Dịch vụ tận nhà',
      trustHomeCopy: 'Thợ cắt tóc sẽ đến địa chỉ bạn chọn.',
      trustVerifiedTitle: 'Thợ đã xác minh',
      trustVerifiedCopy: 'Hồ sơ hiển thị khu vực phục vụ và ngôn ngữ hỗ trợ.',
      trustPricingTitle: 'Giá minh bạch',
      trustPricingCopy: 'Mỗi thẻ hiển thị giá, thời lượng, và phí di chuyển.',
      trustConfirmTitle: 'Xác nhận lịch hẹn',
      trustConfirmCopy: 'Lịch giữ trạng thái chờ cho đến khi kiểm tra chỗ trống.',
      servicesKicker: 'Dịch vụ',
      servicesTitle: 'Chọn dịch vụ cắt tóc tại nhà',
      vendorsKicker: 'Thợ cắt tóc',
      vendorsTitle: 'Hồ sơ thợ cắt tóc đang phục vụ',
      priceLabel: 'Giá',
      durationLabel: 'Thời lượng',
      travelBufferLabel: 'Thời gian di chuyển',
      cleanupLabel: 'Dọn dẹp',
      minutes: 'phút',
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
      trustHomeTitle: 'Servicio a domicilio',
      trustHomeCopy: 'El barbero viaja a la dirección seleccionada.',
      trustVerifiedTitle: 'Barbero verificado',
      trustVerifiedCopy: 'Los perfiles muestran área de servicio e idiomas.',
      trustPricingTitle: 'Precios transparentes',
      trustPricingCopy: 'Cada tarjeta muestra precio, duración, y tarifa de viaje.',
      trustConfirmTitle: 'Confirmación de cita',
      trustConfirmCopy: 'Las reservas quedan pendientes hasta revisar disponibilidad.',
      servicesKicker: 'Servicios',
      servicesTitle: 'Elija un servicio de barbero móvil',
      vendorsKicker: 'Barberos',
      vendorsTitle: 'Perfiles de barberos móviles disponibles',
      priceLabel: 'Precio',
      durationLabel: 'Duración',
      travelBufferLabel: 'Tiempo de viaje',
      cleanupLabel: 'Limpieza',
      minutes: 'min',
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

  var state = { lang: 'en' };

  function getLang() {
    try {
      var saved = localStorage.getItem('dlcLang') || localStorage.getItem('dlc_lang');
      if (saved && STRINGS[saved]) return saved;
    } catch (e) {}
    var param = new URLSearchParams(root.location.search).get('lang');
    return STRINGS[param] ? param : 'en';
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

  function renderServices() {
    var list = document.getElementById('mbServiceList');
    if (!list) return;
    list.innerHTML = '';
    var services = DATA && DATA.sampleServices ? DATA.sampleServices.filter(function(service) {
      return service.active !== false;
    }) : [];
    services.forEach(function(service) {
      var card = el('article', 'mb-service-card');
      var media = el('div', 'mb-service-card__media');
      var body = el('div', 'mb-service-card__body');
      var title = el('h3');
      var desc = el('p');
      var row = el('div', 'mb-meta-row');
      var cta = el('a', 'mb-button mb-button--primary');

      title.textContent = serviceCopy(service, 'name');
      desc.textContent = serviceCopy(service, 'desc');
      row.appendChild(metaChip(t('priceLabel'), formatMoney(service.price)));
      row.appendChild(metaChip(t('durationLabel'), service.durationMinutes + ' ' + t('minutes')));
      row.appendChild(metaChip(t('travelBufferLabel'), service.travelBufferMinutes + ' ' + t('minutes')));
      row.appendChild(metaChip(t('cleanupLabel'), service.cleanupBufferMinutes + ' ' + t('minutes')));

      body.appendChild(title);
      body.appendChild(desc);
      body.appendChild(row);
      card.appendChild(media);
      card.appendChild(body);
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

      title.textContent = vendor.businessName;
      barber.textContent = vendor.barberName;
      area.textContent = t('serviceAreaLabel') + ': ' + vendor.serviceAreas.join(', ');
      row.appendChild(metaChip(t('radiusLabel'), vendor.travelRadiusMiles + ' mi'));
      row.appendChild(metaChip(t('travelFeeLabel'), formatMoney(vendor.baseTravelFee)));
      row.appendChild(metaChip(t('languagesLabel'), vendor.languages.join(', ').toUpperCase()));
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
        var panel = document.getElementById('mbAssistantPanel');
        panel.hidden = false;
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    document.querySelector('[data-action="closeAssistant"]').addEventListener('click', function() {
      document.getElementById('mbAssistantPanel').hidden = true;
    });
  }

  function init() {
    state.lang = getLang();
    bind();
    setLang(state.lang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
