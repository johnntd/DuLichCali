'use strict';
// ─────────────────────────────────────────────────────────────────────────
// AI Group Travel Concierge — client module  (travel-concierge.js?v=20260618a)
//
// Powers /travel-concierge: multiple families plan one shared trip, answer
// intake (incl. per-family transportation), and get an AI day-by-day visual
// itinerary + a synchronized Family Arrival Plan. Mobile-first, isolated.
//
// AI: calls the `generateGroupTripPlan` callable (server-side keys). If that is
// unavailable or fails, falls back to a MOCK plan from window.TC_SAMPLES so the
// UI always works and never crashes (clearly labelled).
//
// PROVIDERS (mock-first, swappable): MapLinkProvider builds REAL Google/Apple
// Maps search URLs (allowed); PlaceMediaProvider uses safe placeholders;
// Travel/BusTicketProvider produce search links + "price pending verification"
// (never fake prices); ReservationLinkProvider only emits known/official links.
//
// PERSIST/SHARE: trip saved to localStorage AND best-effort Firestore
// groupTrips/{tripId} (unguessable id = capability). Share via ?trip=<id>.
// No login required; anonymous auth used if available.
// ─────────────────────────────────────────────────────────────────────────
(function (root) {
  if (!root || !root.document) return;
  var doc = root.document;

  // ── i18n (vi / en / es) — UI chrome only; AI content arrives in the user's language ──
  var T = {
    en: {
      backHome: '← Back to Du Lich Cali',
      heroChip: 'AI Group Travel Concierge', heroTitle: 'Plan a Group Trip with AI',
      heroSub: 'Two families or ten friends — one shared, visual, day-by-day plan with maps, reservations, and a synchronized arrival plan for every family.',
      start: 'Start planning', step: 'Step', of: 'of', day: 'Day', watchClip: 'Watch clip',
      // Create
      createTitle: 'Create your group trip', groupName: 'Trip / group name', destination: 'Destination',
      dates: 'Travel dates', departureCity: 'Main departure area', numFamilies: 'How many families / groups?',
      tripStyle: 'Trip pace', budget: 'Overall budget', createBtn: 'Next: add families',
      style_relaxed: 'Relaxed', style_balanced: 'Balanced', style_packed: 'Packed',
      budget_budget: 'Budget', budget_moderate: 'Moderate', budget_luxury: 'Luxury',
      // Family intake
      familiesTitle: 'Who is coming?', familySub: 'Add each family or group — ages and needs shape the plan.',
      familyName: 'Family / group name', adults: 'Adults', childrenAges: 'Children ages (comma-separated)',
      seniors: 'Seniors', foodPrefs: 'Food preferences', interests: 'Activity interests',
      accessibility: 'Accessibility needs', napNeeds: 'Nap / rest needs', roomNeeds: 'Hotel room needs',
      addFamily: 'Add another family', removeFamily: 'Remove',
      // Transportation (per family)
      transportTitle: 'How will this family get there?', method: 'Travel method',
      m_car: 'Car', m_plane: 'Plane', m_bus: 'Bus', m_other: 'Other',
      origin: 'Starting city / address', travelers: 'Travelers', departureWindow: 'Preferred departure',
      arrivalDeadline: 'Arrival deadline', luggage: 'Luggage needs', carSeat: 'Toddler car seat needed',
      numCars: 'Number of cars', transportBudget: 'Transport budget',
      // Preferences
      prefsTitle: 'Fine-tune the plan', prefsSub: 'Tell the AI what matters most.',
      pace: 'Pace', kidPriority: 'Kid-friendly priority', foodiePriority: 'Foodie priority',
      photoPriority: 'Photo / video spots', minDriving: 'Minimize driving', hiddenGems: 'Include hidden gems',
      freeActivities: 'Include free activities', reservationActivities: 'Include reservation-required spots',
      backupPlans: 'Include backup plans', generate: 'Generate AI trip plan',
      // Generating / plan
      generating: 'Designing your group trip…', genFail: 'AI is busy — here is a sample plan you can edit.',
      tab_itinerary: 'Itinerary', tab_arrival: 'Family Arrival Plan', tab_group: 'Group',
      summary: 'Trip summary', assumptions: 'Assumptions', warnings: 'Good to know',
      costRange: 'Estimated cost', meetup: 'Meetup', regenDay: 'Regenerate day',
      // Place card / modal
      whySelected: 'Why we picked it', bestTime: 'Best time', duration: 'Time here', parking: 'Parking',
      kidFriendly: 'Kid-friendly', walking: 'Walking', cost: 'Cost', details: 'Details', replace: 'Replace',
      mapG: 'Google Maps', mapA: 'Apple Maps', website: 'Website', reserve: 'Reserve', ticket: 'Tickets',
      backup: 'Backup nearby', tips: 'Tips', close: 'Close',
      walk_low: 'Low walking', walk_medium: 'Some walking', walk_high: 'Lots of walking',
      pending: 'Pending verification', unverified: 'AI suggestion — verify details before booking',
      // Vote / booking
      vote: 'Vote', v_like: 'Like', v_maybe: 'Maybe', v_skip: 'Skip', save: 'Save', saved: 'Saved',
      youAre: 'You are:', pickFamilyHint: 'Pick your family above to vote.',
      suggestionsTitle: 'Group suggestions', addSuggestion: 'Suggest a place or activity', suggestionPh: 'e.g. Sunset dinner at the pier', suggest: 'Add', suggestedBy: 'by', noSuggestions: 'No suggestions yet — add one!',
      booking: 'Booking', b_not_needed: 'Not needed', b_needed: 'Needed', b_booked: 'Booked', b_skipped: 'Skipped',
      markBooked: 'Mark booked', markArrived: 'Mark arrived', completed: 'Done',
      // Arrival plan
      recDeparture: 'Recommended departure', eta: 'Estimated arrival', route: 'Route', restStops: 'Rest stops',
      ticketSearch: 'Search tickets', status: 'Status', st_planning: 'Planning', st_booked: 'Booked',
      st_on_the_way: 'On the way', st_arrived: 'Arrived', notes: 'Notes', addNote: 'Add a group note', send: 'Send',
      // Group / share
      shareTitle: 'Share this trip', shareSub: 'Anyone with the link can view and vote — no login needed.',
      copyLink: 'Copy link', copied: 'Link copied!', viewOnly: 'Shared trip (view & vote)',
      newTrip: 'New trip', editTrip: 'Edit trip',
      required: 'Please fill the required fields.',
    },
    vi: {
      backHome: '← Quay lại Du Lich Cali',
      heroChip: 'Trợ Lý Du Lịch Nhóm AI', heroTitle: 'Lên Kế Hoạch Chuyến Đi Nhóm Bằng AI',
      heroSub: 'Hai gia đình hay mười người bạn — một kế hoạch chung, trực quan, theo từng ngày, kèm bản đồ, đặt chỗ và lịch trình đến nơi đồng bộ cho từng gia đình.',
      start: 'Bắt đầu lên kế hoạch', step: 'Bước', of: 'trên', day: 'Ngày', watchClip: 'Xem clip',
      createTitle: 'Tạo chuyến đi nhóm', groupName: 'Tên chuyến đi / nhóm', destination: 'Điểm đến',
      dates: 'Ngày đi', departureCity: 'Khu vực khởi hành chính', numFamilies: 'Bao nhiêu gia đình / nhóm?',
      tripStyle: 'Nhịp độ', budget: 'Ngân sách tổng', createBtn: 'Tiếp: thêm gia đình',
      style_relaxed: 'Thư giãn', style_balanced: 'Cân bằng', style_packed: 'Dày đặc',
      budget_budget: 'Tiết kiệm', budget_moderate: 'Vừa phải', budget_luxury: 'Sang trọng',
      familiesTitle: 'Ai sẽ đi?', familySub: 'Thêm từng gia đình — độ tuổi và nhu cầu định hình kế hoạch.',
      familyName: 'Tên gia đình / nhóm', adults: 'Người lớn', childrenAges: 'Tuổi các bé (cách nhau dấu phẩy)',
      seniors: 'Người cao tuổi', foodPrefs: 'Sở thích ăn uống', interests: 'Sở thích hoạt động',
      accessibility: 'Nhu cầu hỗ trợ di chuyển', napNeeds: 'Nhu cầu nghỉ ngơi', roomNeeds: 'Nhu cầu phòng khách sạn',
      addFamily: 'Thêm gia đình khác', removeFamily: 'Xóa',
      transportTitle: 'Gia đình này đến bằng cách nào?', method: 'Phương tiện',
      m_car: 'Ô tô', m_plane: 'Máy bay', m_bus: 'Xe khách', m_other: 'Khác',
      origin: 'Thành phố / địa chỉ xuất phát', travelers: 'Số người', departureWindow: 'Giờ khởi hành mong muốn',
      arrivalDeadline: 'Hạn giờ đến', luggage: 'Nhu cầu hành lý', carSeat: 'Cần ghế ngồi cho bé',
      numCars: 'Số xe', transportBudget: 'Ngân sách di chuyển',
      prefsTitle: 'Tinh chỉnh kế hoạch', prefsSub: 'Cho AI biết điều gì quan trọng nhất.',
      pace: 'Nhịp độ', kidPriority: 'Ưu tiên trẻ em', foodiePriority: 'Ưu tiên ẩm thực',
      photoPriority: 'Điểm chụp ảnh / quay phim', minDriving: 'Giảm lái xe', hiddenGems: 'Gồm điểm độc đáo',
      freeActivities: 'Gồm hoạt động miễn phí', reservationActivities: 'Gồm nơi cần đặt trước',
      backupPlans: 'Gồm phương án dự phòng', generate: 'Tạo kế hoạch bằng AI',
      generating: 'Đang thiết kế chuyến đi nhóm…', genFail: 'AI đang bận — đây là kế hoạch mẫu bạn có thể chỉnh.',
      tab_itinerary: 'Lịch trình', tab_arrival: 'Kế Hoạch Đến Nơi', tab_group: 'Nhóm',
      summary: 'Tóm tắt chuyến đi', assumptions: 'Giả định', warnings: 'Cần lưu ý',
      costRange: 'Chi phí ước tính', meetup: 'Điểm hẹn', regenDay: 'Tạo lại ngày',
      whySelected: 'Vì sao chọn', bestTime: 'Thời điểm tốt', duration: 'Thời gian', parking: 'Đỗ xe',
      kidFriendly: 'Hợp trẻ em', walking: 'Đi bộ', cost: 'Chi phí', details: 'Chi tiết', replace: 'Thay đổi',
      mapG: 'Google Maps', mapA: 'Apple Maps', website: 'Website', reserve: 'Đặt chỗ', ticket: 'Vé',
      backup: 'Dự phòng gần đó', tips: 'Mẹo', close: 'Đóng',
      walk_low: 'Ít đi bộ', walk_medium: 'Đi bộ vừa', walk_high: 'Đi bộ nhiều',
      pending: 'Chờ xác minh', unverified: 'Gợi ý AI — hãy kiểm tra trước khi đặt',
      vote: 'Bình chọn', v_like: 'Thích', v_maybe: 'Có thể', v_skip: 'Bỏ qua', save: 'Lưu', saved: 'Đã lưu',
      youAre: 'Bạn là:', pickFamilyHint: 'Chọn gia đình của bạn ở trên để bình chọn.',
      suggestionsTitle: 'Đề xuất từ nhóm', addSuggestion: 'Đề xuất địa điểm hoặc hoạt động', suggestionPh: 'vd: Ăn tối ngắm hoàng hôn ở bến tàu', suggest: 'Thêm', suggestedBy: 'bởi', noSuggestions: 'Chưa có đề xuất — hãy thêm một cái!',
      booking: 'Đặt chỗ', b_not_needed: 'Không cần', b_needed: 'Cần', b_booked: 'Đã đặt', b_skipped: 'Bỏ qua',
      markBooked: 'Đánh dấu đã đặt', markArrived: 'Đánh dấu đã đến', completed: 'Xong',
      recDeparture: 'Giờ khởi hành đề xuất', eta: 'Giờ đến dự kiến', route: 'Lộ trình', restStops: 'Điểm dừng',
      ticketSearch: 'Tìm vé', status: 'Trạng thái', st_planning: 'Đang lên kế hoạch', st_booked: 'Đã đặt',
      st_on_the_way: 'Đang đi', st_arrived: 'Đã đến', notes: 'Ghi chú', addNote: 'Thêm ghi chú nhóm', send: 'Gửi',
      shareTitle: 'Chia sẻ chuyến đi', shareSub: 'Bất kỳ ai có liên kết đều xem và bình chọn được — không cần đăng nhập.',
      copyLink: 'Sao chép liên kết', copied: 'Đã sao chép!', viewOnly: 'Chuyến đi được chia sẻ (xem & bình chọn)',
      newTrip: 'Chuyến đi mới', editTrip: 'Sửa chuyến đi',
      required: 'Vui lòng điền các trường bắt buộc.',
    },
    es: {
      backHome: '← Volver a Du Lich Cali',
      heroChip: 'Concierge de Viajes Grupales AI', heroTitle: 'Planea un Viaje Grupal con AI',
      heroSub: 'Dos familias o diez amigos — un plan compartido, visual, día a día, con mapas, reservas y un plan de llegada sincronizado para cada familia.',
      start: 'Empezar a planear', step: 'Paso', of: 'de', day: 'Día', watchClip: 'Ver clip',
      createTitle: 'Crea tu viaje grupal', groupName: 'Nombre del viaje / grupo', destination: 'Destino',
      dates: 'Fechas de viaje', departureCity: 'Zona principal de salida', numFamilies: '¿Cuántas familias / grupos?',
      tripStyle: 'Ritmo del viaje', budget: 'Presupuesto general', createBtn: 'Siguiente: añadir familias',
      style_relaxed: 'Relajado', style_balanced: 'Equilibrado', style_packed: 'Intenso',
      budget_budget: 'Económico', budget_moderate: 'Moderado', budget_luxury: 'Lujo',
      familiesTitle: '¿Quiénes van?', familySub: 'Añade cada familia — edades y necesidades moldean el plan.',
      familyName: 'Nombre de familia / grupo', adults: 'Adultos', childrenAges: 'Edades de niños (separadas por comas)',
      seniors: 'Personas mayores', foodPrefs: 'Preferencias de comida', interests: 'Intereses de actividades',
      accessibility: 'Necesidades de accesibilidad', napNeeds: 'Necesidades de descanso', roomNeeds: 'Necesidades de habitación',
      addFamily: 'Añadir otra familia', removeFamily: 'Quitar',
      transportTitle: '¿Cómo llegará esta familia?', method: 'Medio de transporte',
      m_car: 'Auto', m_plane: 'Avión', m_bus: 'Autobús', m_other: 'Otro',
      origin: 'Ciudad / dirección de salida', travelers: 'Viajeros', departureWindow: 'Salida preferida',
      arrivalDeadline: 'Hora límite de llegada', luggage: 'Necesidades de equipaje', carSeat: 'Silla para niño',
      numCars: 'Número de autos', transportBudget: 'Presupuesto de transporte',
      prefsTitle: 'Ajusta el plan', prefsSub: 'Dile a la AI qué importa más.',
      pace: 'Ritmo', kidPriority: 'Prioridad niños', foodiePriority: 'Prioridad gastronómica',
      photoPriority: 'Lugares para foto / video', minDriving: 'Minimizar conducción', hiddenGems: 'Incluir joyas ocultas',
      freeActivities: 'Incluir actividades gratis', reservationActivities: 'Incluir lugares con reserva',
      backupPlans: 'Incluir planes de respaldo', generate: 'Generar plan con AI',
      generating: 'Diseñando tu viaje grupal…', genFail: 'La AI está ocupada — aquí tienes un plan de muestra editable.',
      tab_itinerary: 'Itinerario', tab_arrival: 'Plan de Llegada', tab_group: 'Grupo',
      summary: 'Resumen del viaje', assumptions: 'Supuestos', warnings: 'Bueno saber',
      costRange: 'Costo estimado', meetup: 'Punto de encuentro', regenDay: 'Regenerar día',
      whySelected: 'Por qué lo elegimos', bestTime: 'Mejor hora', duration: 'Tiempo aquí', parking: 'Estacionamiento',
      kidFriendly: 'Apto para niños', walking: 'Caminata', cost: 'Costo', details: 'Detalles', replace: 'Reemplazar',
      mapG: 'Google Maps', mapA: 'Apple Maps', website: 'Sitio web', reserve: 'Reservar', ticket: 'Boletos',
      backup: 'Respaldo cercano', tips: 'Consejos', close: 'Cerrar',
      walk_low: 'Poca caminata', walk_medium: 'Algo de caminata', walk_high: 'Mucha caminata',
      pending: 'Pendiente de verificación', unverified: 'Sugerencia AI — verifica antes de reservar',
      vote: 'Votar', v_like: 'Me gusta', v_maybe: 'Quizás', v_skip: 'Omitir', save: 'Guardar', saved: 'Guardado',
      youAre: 'Eres:', pickFamilyHint: 'Elige tu familia arriba para votar.',
      suggestionsTitle: 'Sugerencias del grupo', addSuggestion: 'Sugiere un lugar o actividad', suggestionPh: 'ej. Cena al atardecer en el muelle', suggest: 'Añadir', suggestedBy: 'por', noSuggestions: 'Aún no hay sugerencias — ¡añade una!',
      booking: 'Reserva', b_not_needed: 'No necesaria', b_needed: 'Necesaria', b_booked: 'Reservado', b_skipped: 'Omitido',
      markBooked: 'Marcar reservado', markArrived: 'Marcar llegada', completed: 'Listo',
      recDeparture: 'Salida recomendada', eta: 'Llegada estimada', route: 'Ruta', restStops: 'Paradas',
      ticketSearch: 'Buscar boletos', status: 'Estado', st_planning: 'Planeando', st_booked: 'Reservado',
      st_on_the_way: 'En camino', st_arrived: 'Llegó', notes: 'Notas', addNote: 'Añadir nota de grupo', send: 'Enviar',
      shareTitle: 'Comparte este viaje', shareSub: 'Cualquiera con el enlace puede ver y votar — sin iniciar sesión.',
      copyLink: 'Copiar enlace', copied: '¡Enlace copiado!', viewOnly: 'Viaje compartido (ver y votar)',
      newTrip: 'Nuevo viaje', editTrip: 'Editar viaje',
      required: 'Completa los campos obligatorios.',
    },
  };

  var DESTINATIONS = ['San Diego', 'Las Vegas', 'Orange County', 'Los Angeles', 'Napa', 'Yosemite', 'San Francisco'];
  var INTERESTS = ['beach', 'zoo', 'shows', 'shopping', 'casino', 'museums', 'food', 'nightlife', 'theme_park', 'scenic', 'family_friendly'];
  var TIME_ORDER = ['morning', 'lunch', 'afternoon', 'dinner', 'night'];

  var state = {
    lang: 'en', screen: 'hero', step: 1, trip: null, activeDay: 0, activeTab: 'itinerary',
    readonly: false, generating: false,
  };

  function t(k) { return (T[state.lang] && T[state.lang][k]) || T.en[k] || k; }
  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function uid(p) { return (p || 'tc') + '_' + Math.random().toString(36).slice(2, 10); }

  // ── Providers (mock-first; swappable) ──────────────────────────────────
  var MapLinkProvider = {
    google: function (name, addr) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((name || '') + (addr ? ', ' + addr : '')); },
    apple: function (name, addr) { return 'https://maps.apple.com/?q=' + encodeURIComponent((name || '') + (addr ? ', ' + addr : '')); },
    dayRoute: function (places) {
      var pts = (places || []).map(function (p) { return p.address || p.name; }).filter(Boolean);
      if (pts.length < 2) return pts.length ? MapLinkProvider.google(places[0].name, places[0].address) : '';
      return 'https://www.google.com/maps/dir/' + pts.map(encodeURIComponent).join('/');
    },
  };
  // Real place photos: try the AI-provided imageUrl, then a REAL Wikipedia/Wikimedia
  // photo of the actual place (free, no key, CORS via origin=*), then a relevant
  // AI-generated category image (beach/restaurant/zoo/…), then a gradient. Every card
  // ends up with a relevant picture; nothing fake is fabricated.
  var CAT_IMG = '/assets/travel-concierge/cat/';
  var CAT_KEYS = { beach:1, restaurant:1, nightlife:1, shopping:1, museum:1, theme_park:1, zoo:1, scenic:1, hotel:1, landmark:1 };
  var _mediaCache = {};
  function categoryKey(p) {
    var s = (((p && p.category) || '') + ' ' + ((p && p.name) || '')).toLowerCase();
    if (/zoo|safari|wildlife|aquarium|\banimal/.test(s)) return 'zoo';
    if (/theme ?park|amusement|disney|legoland|seaworld|knott|universal|roller|water ?park/.test(s)) return 'theme_park';
    if (/restaurant|food|dining|cafe|café|eatery|buffet|grill|kitchen|brunch|seafood|taco|pho|noodle|bbq/.test(s)) return 'restaurant';
    if (/museum|gallery|science center|art|history|cultural|exhibit/.test(s)) return 'museum';
    if (/shop|mall|outlet|market|store|boutique|plaza/.test(s)) return 'shopping';
    if (/night|\bbar\b|club|casino|lounge|pub|cocktail|rooftop/.test(s)) return 'nightlife';
    if (/beach|coast|pier|\bbay\b|shore|boardwalk|cove|harbor/.test(s)) return 'beach';
    if (/hotel|resort|lodge|\binn\b|suites/.test(s)) return 'hotel';
    if (/park|garden|trail|scenic|view|lookout|canyon|mountain|lake|nature|cliff|island/.test(s)) return 'scenic';
    return 'landmark';
  }
  var PlaceMediaProvider = {
    categoryImage: function (p) { return CAT_IMG + categoryKey(p) + '.webp'; },
    // Resolve a real photo of the ACTUAL place from Wikipedia. Promise<url|null>, cached.
    resolveReal: function (p) {
      var name = ((p && p.name) || '').trim();
      if (!name || typeof fetch !== 'function') return Promise.resolve(null);
      var ck = 'w_' + name.toLowerCase();
      if (_mediaCache[ck] !== undefined) return Promise.resolve(_mediaCache[ck]);
      var u = 'https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=640&redirects=1&titles=' + encodeURIComponent(name) + '&origin=*';
      return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
        var pages = j && j.query && j.query.pages, thumb = null;
        if (pages) for (var k in pages) { if (pages[k].thumbnail && pages[k].thumbnail.source) { thumb = pages[k].thumbnail.source; break; } }
        _mediaCache[ck] = thumb; return thumb;
      }).catch(function () { _mediaCache[ck] = null; return null; });
    },
  };
  // Build a media element that shows a relevant picture for the place (real → category → gradient).
  function placeMedia(p, cls) {
    var media = el('div', cls || 'tc-place__media');
    var img = doc.createElement('img'); img.className = 'tc-place__img'; img.alt = (p && p.name) || ''; img.loading = 'lazy';
    var catUrl = PlaceMediaProvider.categoryImage(p);
    var stage = 0; // 0 = primary, 1 = category, 2 = gradient
    img.addEventListener('error', function () {
      if (stage === 0) { stage = 1; img.src = catUrl; }
      else { stage = 2; media.classList.add('tc-place__media--ph'); if (img.parentNode) img.parentNode.removeChild(img); }
    });
    img.src = (p && p.imageUrl) || catUrl;
    media.appendChild(img);
    if (p && p.category) media.appendChild(el('span', 'tc-place__cat', p.category));
    // Swap in the REAL place photo when Wikipedia resolves one.
    PlaceMediaProvider.resolveReal(p).then(function (real) { if (real && stage < 2) { stage = 0; img.src = real; } });
    return media;
  }
  var TravelTicketProvider = { // plane — search links only, never fake prices
    flightSearch: function (origin, dest, date) { return 'https://www.google.com/travel/flights?q=' + encodeURIComponent('flights from ' + (origin || '') + ' to ' + (dest || '') + (date ? ' on ' + date : '')); },
  };
  var BusTicketProvider = { // Vietnamese bus services — manual/search, never fake prices
    knownCompanies: ['Xe Hoàng (Hoang Express)', 'Xe Đông Hưng', 'Khác / Other'],
    search: function (origin, dest) { return 'https://www.google.com/search?q=' + encodeURIComponent('xe khách ' + (origin || '') + ' đi ' + (dest || '') + ' Hoang Express'); },
  };

  // ── Mock TravelPlanGenerator — used when the AI callable is unavailable ──
  function mockPlan(trip) {
    var samples = root.TC_SAMPLES || {};
    var key = /vegas/i.test(trip.destination) ? 'las_vegas' : 'san_diego';
    var base = samples[key] || samples.san_diego || samples[Object.keys(samples)[0]];
    if (!base) return null;
    var plan = JSON.parse(JSON.stringify(base));
    plan.groupName = trip.groupName || plan.groupName;
    plan.dateRange = trip.dateRange || plan.dateRange;
    plan.dataSource = 'mock_sample_pending_verification';
    return plan;
  }

  function generatePlan(trip) {
    // Try the server AI; gracefully fall back to a mock sample.
    var payload = { trip: trip, lang: state.lang };
    var callable = null;
    try {
      if (root.firebase && root.firebase.functions) callable = root.firebase.functions().httpsCallable('generateGroupTripPlan', { timeout: 120000 });
    } catch (e) {}
    if (!callable) return Promise.resolve({ plan: mockPlan(trip), fallback: true });
    return callable(payload).then(function (res) {
      var d = (res && res.data) || {};
      if (d.ok && d.plan && d.plan.days && d.plan.days.length) return { plan: d.plan, fallback: false };
      return { plan: mockPlan(trip), fallback: true };
    }).catch(function () { return { plan: mockPlan(trip), fallback: true }; });
  }

  // ── Persistence (localStorage + best-effort Firestore) ─────────────────
  function saveTrip(trip) {
    try { root.localStorage.setItem('tc_trip_' + trip.id, JSON.stringify(trip)); } catch (e) {}
    try {
      if (root.dlcDb) root.dlcDb.collection('groupTrips').doc(trip.id).set(trip, { merge: true }).catch(function () {});
    } catch (e) {}
  }
  function loadTrip(id) {
    return new Promise(function (resolve) {
      var local = null;
      try { var raw = root.localStorage.getItem('tc_trip_' + id); if (raw) local = JSON.parse(raw); } catch (e) {}
      if (root.dlcDb) {
        root.dlcDb.collection('groupTrips').doc(id).get().then(function (snap) {
          resolve(snap && snap.exists ? snap.data() : local);
        }).catch(function () { resolve(local); });
      } else resolve(local);
    });
  }

  // ── Mount / router ─────────────────────────────────────────────────────
  function app() { return doc.getElementById('tcApp'); }
  function render() {
    var host = app(); if (!host) return;
    host.innerHTML = '';
    if (state.screen === 'hero') host.appendChild(renderHero());
    else if (state.screen === 'create') host.appendChild(renderCreate());
    else if (state.screen === 'families') host.appendChild(renderFamilies());
    else if (state.screen === 'prefs') host.appendChild(renderPrefs());
    else if (state.screen === 'plan') host.appendChild(renderPlan());
    applyI18n(host);
    try { root.scrollTo(0, 0); } catch (e) {}
  }
  function applyI18n(scope) {
    (scope || doc).querySelectorAll('[data-tc-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-tc-i18n')); });
  }

  // ── Screen: hero ───────────────────────────────────────────────────────
  function renderHero() {
    var s = el('section', 'tc-hero');
    s.appendChild(el('span', 'tc-hero__chip', t('heroChip')));
    s.appendChild(el('h1', 'tc-hero__title', t('heroTitle')));
    s.appendChild(el('p', 'tc-hero__sub', t('heroSub')));
    var cta = el('button', 'tc-cta tc-hero__cta', t('start')); cta.type = 'button';
    cta.addEventListener('click', function () { newTrip(); state.screen = 'create'; render(); });
    s.appendChild(cta);
    // Demo entries
    var demos = el('div', 'tc-hero__demos');
    Object.keys(root.TC_SAMPLES || {}).forEach(function (k) {
      var sample = root.TC_SAMPLES[k];
      var d = el('button', 'tc-hero__demo'); d.type = 'button';
      d.innerHTML = '<strong>' + (sample.destination || k) + '</strong><span>' + (sample.families ? sample.families.length : 2) + ' families · ' + (sample.days ? sample.days.length : 3) + ' days</span>';
      d.addEventListener('click', function () { openDemo(k); });
      demos.appendChild(d);
    });
    if (demos.children.length) { s.appendChild(el('p', 'tc-hero__demos-lbl', 'Try a sample')); s.appendChild(demos); }
    return s;
  }
  function openDemo(key) {
    var sample = root.TC_SAMPLES[key];
    newTrip();
    state.trip.groupName = sample.groupName; state.trip.destination = sample.destination;
    state.trip.dateRange = sample.dateRange; state.trip.plan = JSON.parse(JSON.stringify(sample));
    state.trip.plan.dataSource = 'mock_sample_pending_verification';
    state.screen = 'plan'; state.activeDay = 0; state.activeTab = 'itinerary';
    saveTrip(state.trip); pushTripUrl(state.trip.id); render();
  }

  function newTrip() {
    state.trip = {
      id: uid('trip'), groupName: '', destination: '', dateRange: '', departureCity: '',
      tripStyle: 'balanced', budget: 'moderate', families: [newFamily()], preferences: defaultPrefs(),
      plan: null, votes: {}, notes: [], booking: {}, transportStatus: {}, suggestions: [], createdAt: Date.now(),
    };
    state.readonly = false;
  }
  function newFamily() {
    return { id: uid('fam'), name: '', adults: 2, childrenAges: '', seniors: 0, foodPrefs: '', interests: [],
             accessibility: '', napNeeds: '', roomNeeds: '',
             transport: { method: 'car', origin: '', travelers: 2, departureWindow: '', arrivalDeadline: '',
                          budgetPref: 'moderate', luggage: '', carSeat: false, accessibility: '', numCars: 1 } };
  }
  function defaultPrefs() {
    return { pace: 'balanced', budgetLevel: 'moderate', kidPriority: true, foodiePriority: false,
             photoPriority: true, minDriving: false, hiddenGems: true, freeActivities: true,
             reservationActivities: true, backupPlans: true };
  }

  // ── Screen: create ─────────────────────────────────────────────────────
  function field(label, node) { var w = el('label', 'tc-field'); w.appendChild(el('span', 'tc-field__lbl', label)); w.appendChild(node); return w; }
  function input(val, ph, type) { var i = doc.createElement('input'); i.className = 'tc-input'; i.type = type || 'text'; if (val != null) i.value = val; if (ph) i.placeholder = ph; return i; }
  function selectFrom(opts, val, labelFn) {
    var s = doc.createElement('select'); s.className = 'tc-input';
    opts.forEach(function (o) { var op = doc.createElement('option'); op.value = o; op.textContent = labelFn ? labelFn(o) : o; if (o === val) op.selected = true; s.appendChild(op); });
    return s;
  }
  function seg(opts, val, labelKey, onPick) {
    var wrap = el('div', 'tc-seg');
    opts.forEach(function (o) {
      var b = el('button', 'tc-seg__btn' + (o === val ? ' tc-seg__btn--on' : ''), t(labelKey + o)); b.type = 'button';
      b.addEventListener('click', function () { onPick(o); wrap.querySelectorAll('.tc-seg__btn').forEach(function (x) { x.classList.remove('tc-seg__btn--on'); }); b.classList.add('tc-seg__btn--on'); });
      wrap.appendChild(b);
    });
    return wrap;
  }
  function stepHeader(n) {
    var h = el('div', 'tc-stephead');
    h.appendChild(el('span', 'tc-stephead__step', t('step') + ' ' + n + ' ' + t('of') + ' 3'));
    var bar = el('div', 'tc-stephead__bar'); var fill = el('i'); fill.style.width = (n / 3 * 100) + '%'; bar.appendChild(fill); h.appendChild(bar);
    return h;
  }
  function renderCreate() {
    var tr = state.trip;
    var s = el('section', 'tc-screen'); s.appendChild(stepHeader(1));
    s.appendChild(el('h2', 'tc-screen__title', t('createTitle')));
    var gn = input(tr.groupName, ''); gn.addEventListener('input', function () { tr.groupName = gn.value; });
    s.appendChild(field(t('groupName'), gn));
    var dest = selectFrom([''].concat(DESTINATIONS), tr.destination); dest.addEventListener('change', function () { tr.destination = dest.value; });
    s.appendChild(field(t('destination'), dest));
    var dates = input(tr.dateRange, 'Jul 2–5, 2026'); dates.addEventListener('input', function () { tr.dateRange = dates.value; });
    s.appendChild(field(t('dates'), dates));
    var dep = input(tr.departureCity, 'San Jose, CA'); dep.addEventListener('input', function () { tr.departureCity = dep.value; });
    s.appendChild(field(t('departureCity'), dep));
    s.appendChild(field(t('tripStyle'), seg(['relaxed', 'balanced', 'packed'], tr.tripStyle, 'style_', function (v) { tr.tripStyle = v; })));
    s.appendChild(field(t('budget'), seg(['budget', 'moderate', 'luxury'], tr.budget, 'budget_', function (v) { tr.budget = v; })));
    var next = el('button', 'tc-cta', t('createBtn')); next.type = 'button';
    next.addEventListener('click', function () {
      if (!tr.groupName || !tr.destination) { toast(t('required')); return; }
      saveTrip(tr); state.screen = 'families'; render();
    });
    s.appendChild(next);
    return s;
  }

  // ── Screen: families (incl. per-family transportation) ─────────────────
  function chipMulti(opts, selected, labelKey, onToggle) {
    var wrap = el('div', 'tc-chips');
    opts.forEach(function (o) {
      var on = selected.indexOf(o) !== -1;
      var c = el('button', 'tc-chip' + (on ? ' tc-chip--on' : ''), t(labelKey + o) !== (labelKey + o) ? t(labelKey + o) : o.replace(/_/g, ' ')); c.type = 'button';
      c.addEventListener('click', function () { var idx = selected.indexOf(o); if (idx === -1) selected.push(o); else selected.splice(idx, 1); c.classList.toggle('tc-chip--on'); onToggle && onToggle(); });
      wrap.appendChild(c);
    });
    return wrap;
  }
  function familyCard(fam, idx) {
    var c = el('article', 'tc-famcard');
    var head = el('div', 'tc-famcard__head');
    head.appendChild(el('strong', 'tc-famcard__n', '#' + (idx + 1)));
    if (state.trip.families.length > 1) { var rm = el('button', 'tc-famcard__rm', t('removeFamily')); rm.type = 'button'; rm.addEventListener('click', function () { state.trip.families.splice(idx, 1); render(); }); head.appendChild(rm); }
    c.appendChild(head);
    var nm = input(fam.name, ''); nm.addEventListener('input', function () { fam.name = nm.value; }); c.appendChild(field(t('familyName'), nm));
    var row = el('div', 'tc-row2');
    var ad = input(fam.adults, '', 'number'); ad.min = 0; ad.addEventListener('input', function () { fam.adults = +ad.value || 0; }); row.appendChild(field(t('adults'), ad));
    var sn = input(fam.seniors, '', 'number'); sn.min = 0; sn.addEventListener('input', function () { fam.seniors = +sn.value || 0; }); row.appendChild(field(t('seniors'), sn));
    c.appendChild(row);
    var ch = input(fam.childrenAges, '3, 14'); ch.addEventListener('input', function () { fam.childrenAges = ch.value; }); c.appendChild(field(t('childrenAges'), ch));
    var fp = input(fam.foodPrefs, ''); fp.addEventListener('input', function () { fam.foodPrefs = fp.value; }); c.appendChild(field(t('foodPrefs'), fp));
    c.appendChild(el('span', 'tc-field__lbl', t('interests')));
    c.appendChild(chipMulti(INTERESTS, fam.interests, 'int_'));
    var acc = input(fam.accessibility, ''); acc.addEventListener('input', function () { fam.accessibility = acc.value; }); c.appendChild(field(t('accessibility'), acc));
    var rn = input(fam.roomNeeds, ''); rn.addEventListener('input', function () { fam.roomNeeds = rn.value; }); c.appendChild(field(t('roomNeeds'), rn));
    // Transportation
    c.appendChild(el('div', 'tc-famcard__tsep', ''));
    c.appendChild(el('strong', 'tc-famcard__tt', t('transportTitle')));
    var tp = fam.transport;
    c.appendChild(field(t('method'), seg(['car', 'plane', 'bus', 'other'], tp.method, 'm_', function (v) { tp.method = v; render(); })));
    var og = input(tp.origin, ''); og.addEventListener('input', function () { tp.origin = og.value; }); c.appendChild(field(t('origin'), og));
    var tr2 = el('div', 'tc-row2');
    var tv = input(tp.travelers, '', 'number'); tv.min = 1; tv.addEventListener('input', function () { tp.travelers = +tv.value || 1; }); tr2.appendChild(field(t('travelers'), tv));
    var dw = input(tp.departureWindow, ''); dw.addEventListener('input', function () { tp.departureWindow = dw.value; }); tr2.appendChild(field(t('departureWindow'), dw));
    c.appendChild(tr2);
    if (tp.method === 'car') {
      var nc = input(tp.numCars, '', 'number'); nc.min = 1; nc.addEventListener('input', function () { tp.numCars = +nc.value || 1; }); c.appendChild(field(t('numCars'), nc));
      var cs = el('label', 'tc-check'); var cb = doc.createElement('input'); cb.type = 'checkbox'; cb.checked = !!tp.carSeat; cb.addEventListener('change', function () { tp.carSeat = cb.checked; }); cs.appendChild(cb); cs.appendChild(el('span', null, t('carSeat'))); c.appendChild(cs);
    }
    if (tp.method === 'bus') {
      var bc = selectFrom(BusTicketProvider.knownCompanies, tp.providerName || BusTicketProvider.knownCompanies[0]); bc.addEventListener('change', function () { tp.providerName = bc.value; }); c.appendChild(field('Bus service', bc));
    }
    var ad2 = input(tp.arrivalDeadline, ''); ad2.addEventListener('input', function () { tp.arrivalDeadline = ad2.value; }); c.appendChild(field(t('arrivalDeadline'), ad2));
    return c;
  }
  function renderFamilies() {
    var s = el('section', 'tc-screen'); s.appendChild(stepHeader(2));
    s.appendChild(el('h2', 'tc-screen__title', t('familiesTitle')));
    s.appendChild(el('p', 'tc-screen__sub', t('familySub')));
    state.trip.families.forEach(function (f, i) { s.appendChild(familyCard(f, i)); });
    var add = el('button', 'tc-addbtn', '+ ' + t('addFamily')); add.type = 'button';
    add.addEventListener('click', function () { state.trip.families.push(newFamily()); render(); });
    s.appendChild(add);
    var next = el('button', 'tc-cta', t('createBtn').replace(/.*: ?/, '') ? t('prefsTitle') : t('prefsTitle')); next.textContent = t('prefsTitle'); next.type = 'button';
    next.addEventListener('click', function () { saveTrip(state.trip); state.screen = 'prefs'; render(); });
    s.appendChild(next);
    return s;
  }

  // ── Screen: preferences ────────────────────────────────────────────────
  function toggleRow(labelKey, val, onSet) {
    var w = el('label', 'tc-toggle');
    w.appendChild(el('span', null, t(labelKey)));
    var cb = doc.createElement('input'); cb.type = 'checkbox'; cb.checked = !!val; cb.addEventListener('change', function () { onSet(cb.checked); });
    w.appendChild(cb); return w;
  }
  function renderPrefs() {
    var p = state.trip.preferences;
    var s = el('section', 'tc-screen'); s.appendChild(stepHeader(3));
    s.appendChild(el('h2', 'tc-screen__title', t('prefsTitle')));
    s.appendChild(el('p', 'tc-screen__sub', t('prefsSub')));
    s.appendChild(field(t('pace'), seg(['relaxed', 'balanced', 'packed'], p.pace, 'style_', function (v) { p.pace = v; })));
    s.appendChild(field(t('budget'), seg(['budget', 'moderate', 'luxury'], p.budgetLevel, 'budget_', function (v) { p.budgetLevel = v; })));
    [['kidPriority', 'kidPriority'], ['foodiePriority', 'foodiePriority'], ['photoPriority', 'photoPriority'], ['minDriving', 'minDriving'], ['hiddenGems', 'hiddenGems'], ['freeActivities', 'freeActivities'], ['reservationActivities', 'reservationActivities'], ['backupPlans', 'backupPlans']].forEach(function (pair) {
      s.appendChild(toggleRow(pair[1], p[pair[0]], function (v) { p[pair[0]] = v; }));
    });
    var gen = el('button', 'tc-cta tc-cta--big', t('generate')); gen.type = 'button';
    gen.addEventListener('click', function () { doGenerate(); });
    s.appendChild(gen);
    return s;
  }
  function doGenerate() {
    state.generating = true; renderGenerating();
    saveTrip(state.trip);
    generatePlan(state.trip).then(function (res) {
      state.generating = false;
      if (!res.plan) { toast(t('genFail')); state.screen = 'prefs'; render(); return; }
      state.trip.plan = res.plan; state.trip._fallback = !!res.fallback;
      state.screen = 'plan'; state.activeDay = 0; state.activeTab = 'itinerary';
      saveTrip(state.trip); pushTripUrl(state.trip.id); render();
    });
  }
  function renderGenerating() {
    var host = app(); if (!host) return; host.innerHTML = '';
    var s = el('section', 'tc-gen');
    s.appendChild(el('div', 'tc-gen__spinner'));
    s.appendChild(el('p', 'tc-gen__msg', t('generating')));
    host.appendChild(s);
  }

  // ── Screen: plan (itinerary + arrival + group) ─────────────────────────
  function renderPlan() {
    var tr = state.trip, plan = tr.plan || {};
    var s = el('section', 'tc-plan');
    // Hero
    var hero = el('div', 'tc-planhero');
    hero.appendChild(el('span', 'tc-planhero__chip', plan.destination || tr.destination));
    hero.appendChild(el('h1', 'tc-planhero__title', plan.groupName || tr.groupName));
    hero.appendChild(el('p', 'tc-planhero__dates', (plan.dateRange || tr.dateRange) + (plan.departureCity ? ' · ' + plan.departureCity : '')));
    if (plan.summary) hero.appendChild(el('p', 'tc-planhero__summary', plan.summary));
    var meta = el('div', 'tc-planhero__meta');
    if (plan.totalEstimatedCostRange) meta.appendChild(chip('tc-chip--cost', t('costRange') + ': ' + plan.totalEstimatedCostRange));
    if (plan.meetupPoint) meta.appendChild(chip('tc-chip--meet', '📍 ' + t('meetup') + ': ' + plan.meetupPoint + (plan.meetupTime ? ' · ' + plan.meetupTime : '')));
    hero.appendChild(meta);
    if (tr._fallback || (plan.dataSource && /pending/.test(plan.dataSource))) hero.appendChild(el('p', 'tc-unverified', t('unverified')));
    s.appendChild(hero);
    // "You are this family" — attributes votes/suggestions per family (no login).
    s.appendChild(familyPicker());
    // Tabs
    var tabs = el('div', 'tc-tabs');
    [['itinerary', 'tab_itinerary'], ['arrival', 'tab_arrival'], ['group', 'tab_group']].forEach(function (pair) {
      var b = el('button', 'tc-tab' + (state.activeTab === pair[0] ? ' tc-tab--on' : ''), t(pair[1])); b.type = 'button';
      b.addEventListener('click', function () { state.activeTab = pair[0]; render(); });
      tabs.appendChild(b);
    });
    s.appendChild(tabs);
    if (state.activeTab === 'itinerary') s.appendChild(renderItinerary(plan));
    else if (state.activeTab === 'arrival') s.appendChild(renderArrival(plan));
    else s.appendChild(renderGroup(plan));
    return s;
  }
  function chip(cls, txt) { return el('span', 'tc-chip ' + (cls || ''), txt); }

  function renderItinerary(plan) {
    var wrap = el('div', 'tc-itin');
    var days = plan.days || [];
    var daytabs = el('div', 'tc-daytabs');
    days.forEach(function (d, i) {
      var b = el('button', 'tc-daytab' + (i === state.activeDay ? ' tc-daytab--on' : '')); b.type = 'button';
      b.innerHTML = '<strong>' + t('day') + ' ' + (i + 1) + '</strong><span>' + (d.title || '') + '</span>';
      b.addEventListener('click', function () { state.activeDay = i; render(); });
      daytabs.appendChild(b);
    });
    wrap.appendChild(daytabs);
    var day = days[state.activeDay]; if (!day) { wrap.appendChild(el('p', 'tc-empty', '—')); return wrap; }
    var dh = el('div', 'tc-dayhead');
    dh.appendChild(el('h3', 'tc-dayhead__t', day.title));
    if (day.summary) dh.appendChild(el('p', 'tc-dayhead__s', day.summary));
    var dm = el('div', 'tc-dayhead__meta');
    if (day.estimatedDrivingTime) dm.appendChild(chip('', '🚗 ' + day.estimatedDrivingTime));
    if (day.estimatedWalkingLevel) dm.appendChild(chip('', '🚶 ' + day.estimatedWalkingLevel));
    var allPlaces = []; (day.sections || []).forEach(function (sec) { (sec.places || []).forEach(function (p) { allPlaces.push(p); }); });
    var routeUrl = MapLinkProvider.dayRoute(allPlaces);
    if (routeUrl) { var rb = el('a', 'tc-chip tc-chip--route', '🗺 ' + t('route')); rb.href = routeUrl; rb.target = '_blank'; rb.rel = 'noopener'; dm.appendChild(rb); }
    dh.appendChild(dm); wrap.appendChild(dh);
    // Timeline sections
    var sorted = (day.sections || []).slice().sort(function (a, b) { return TIME_ORDER.indexOf(a.timeOfDay) - TIME_ORDER.indexOf(b.timeOfDay); });
    sorted.forEach(function (sec) {
      var sb = el('div', 'tc-section');
      var sh = el('div', 'tc-section__head');
      sh.appendChild(el('span', 'tc-section__dot', ''));
      sh.appendChild(el('span', 'tc-section__time', (sec.startTime || '') + (sec.endTime ? '–' + sec.endTime : '')));
      sh.appendChild(el('strong', 'tc-section__title', sec.title || sec.timeOfDay));
      sb.appendChild(sh);
      (sec.places || []).forEach(function (p) { sb.appendChild(placeCard(p)); });
      wrap.appendChild(sb);
    });
    return wrap;
  }

  function scoreChip(label, score) { var lv = score >= 4 ? 'hi' : (score >= 2 ? 'mid' : 'lo'); return el('span', 'tc-chip tc-chip--score tc-chip--' + lv, label + ' ' + score + '/5'); }
  function placeCard(p) {
    var c = el('article', 'tc-place');
    c.appendChild(placeMedia(p));
    var body = el('div', 'tc-place__body');
    body.appendChild(el('strong', 'tc-place__name', p.name));
    if (p.address) body.appendChild(el('p', 'tc-place__addr', p.address));
    if (p.whySelected) { var why = el('p', 'tc-place__why'); why.appendChild(el('span', 'tc-place__why-k', t('whySelected') + ': ')); why.appendChild(doc.createTextNode(p.whySelected)); body.appendChild(why); }
    var chips = el('div', 'tc-place__chips');
    if (p.estimatedCost) chips.appendChild(chip('tc-chip--cost', '💵 ' + p.estimatedCost));
    if (p.estimatedDuration) chips.appendChild(chip('', '⏱ ' + p.estimatedDuration));
    if (typeof p.kidFriendlyScore === 'number') chips.appendChild(scoreChip('🧒', p.kidFriendlyScore));
    if (p.walkingLevel) chips.appendChild(chip('tc-chip--walk', t('walk_' + p.walkingLevel) || p.walkingLevel));
    body.appendChild(chips);
    // Action buttons
    var acts = el('div', 'tc-place__acts');
    acts.appendChild(linkBtn(t('mapG'), p.googleMapsUrl || MapLinkProvider.google(p.name, p.address)));
    acts.appendChild(linkBtn(t('mapA'), p.appleMapsUrl || MapLinkProvider.apple(p.name, p.address)));
    if (p.websiteUrl) acts.appendChild(linkBtn(t('website'), p.websiteUrl));
    if (p.reservationUrl) acts.appendChild(linkBtn('🎟 ' + t('reserve'), p.reservationUrl, 'tc-pbtn--accent'));
    if (p.videoUrl) acts.appendChild(linkBtn('▶ ' + t('watchClip'), p.videoUrl, 'tc-pbtn--accent'));
    var det = el('button', 'tc-pbtn', t('details')); det.type = 'button'; det.addEventListener('click', function () { openPlaceModal(p); }); acts.appendChild(det);
    body.appendChild(acts);
    body.appendChild(voteRow(p));
    c.appendChild(body);
    return c;
  }
  function linkBtn(label, href, cls) { var a = el('a', 'tc-pbtn ' + (cls || ''), label); a.href = href || '#'; a.target = '_blank'; a.rel = 'noopener'; return a; }
  // ── Per-family collaboration: "who am I" + family-attributed votes ──────
  function tripFamilies() {
    var out = [];
    ((state.trip && state.trip.families) || []).forEach(function (f, i) { if (f && (f.name || '').trim()) out.push({ id: f.id || ('f' + i), name: f.name.trim() }); });
    if (!out.length) ((state.trip && state.trip.plan && state.trip.plan.families) || []).forEach(function (n, i) { out.push({ id: 'pf' + i, name: String(n).split('(')[0].split('—')[0].trim() || ('#' + (i + 1)) }); });
    if (!out.length) out.push({ id: 'me', name: 'Me' });
    return out;
  }
  function meKey() { return 'tc_me_' + (state.trip && state.trip.id); }
  function getMe() { try { return root.localStorage.getItem(meKey()) || ''; } catch (e) { return ''; } }
  function setMe(id) { try { root.localStorage.setItem(meKey(), id); } catch (e) {} }
  function familyPicker() {
    var wrap = el('div', 'tc-famsel');
    wrap.appendChild(el('span', 'tc-famsel__lbl', t('youAre')));
    var me = getMe();
    tripFamilies().forEach(function (f) {
      var b = el('button', 'tc-famsel__btn' + (f.id === me ? ' tc-famsel__btn--on' : ''), f.name); b.type = 'button';
      b.addEventListener('click', function () { setMe(f.id); render(); });
      wrap.appendChild(b);
    });
    return wrap;
  }
  function voteRow(p) {
    var pid = p.id || p.name;
    var v = state.trip.votes[pid];
    if (typeof v !== 'object' || v === null) { v = {}; state.trip.votes[pid] = v; } // per-family map {familyId: status}
    var me = getMe();
    var counts = { like: 0, maybe: 0, skip: 0 };
    Object.keys(v).forEach(function (fid) { if (counts[v[fid]] != null) counts[v[fid]]++; });
    var row = el('div', 'tc-vote');
    [['like', '👍'], ['maybe', '🤔'], ['skip', '👎']].forEach(function (pair) {
      var st = pair[0], mine = me && v[me] === st;
      var b = el('button', 'tc-vbtn' + (mine ? ' tc-vbtn--on' : ''), pair[1] + ' ' + t('v_' + st) + (counts[st] ? ' ' + counts[st] : '')); b.type = 'button';
      b.addEventListener('click', function () {
        if (!me) { toast(t('pickFamilyHint')); return; }
        if (v[me] === st) delete v[me]; else v[me] = st;
        saveTrip(state.trip); render();
      });
      row.appendChild(b);
    });
    var bk = state.trip.booking[pid] || 'not_needed';
    var bsel = selectFrom(['not_needed', 'needed', 'booked', 'skipped'], bk, function (o) { return t('b_' + o); });
    bsel.className = 'tc-input tc-booksel';
    bsel.addEventListener('change', function () { state.trip.booking[pid] = bsel.value; saveTrip(state.trip); });
    row.appendChild(bsel);
    return row;
  }
  // Group suggestions: any family can propose a place/activity; others up-vote.
  function suggestionsBlock() {
    var b = el('div', 'tc-suggest');
    b.appendChild(el('strong', 'tc-suggest__t', t('suggestionsTitle')));
    var me = getMe();
    var list = state.trip.suggestions || [];
    if (!list.length) b.appendChild(el('p', 'tc-suggest__empty', t('noSuggestions')));
    list.forEach(function (s) {
      var c = el('div', 'tc-suggest__item');
      var txt = el('div', 'tc-suggest__main');
      txt.appendChild(el('p', 'tc-suggest__text', s.text));
      txt.appendChild(el('span', 'tc-suggest__by', t('suggestedBy') + ' ' + (s.familyName || '—')));
      c.appendChild(txt);
      var likes = Object.keys(s.votes || {}).length;
      var lb = el('button', 'tc-vbtn' + (me && s.votes && s.votes[me] ? ' tc-vbtn--on' : ''), '👍 ' + (likes || '')); lb.type = 'button';
      lb.addEventListener('click', function () { if (!me) { toast(t('pickFamilyHint')); return; } s.votes = s.votes || {}; if (s.votes[me]) delete s.votes[me]; else s.votes[me] = 1; saveTrip(state.trip); render(); });
      c.appendChild(lb);
      b.appendChild(c);
    });
    var row = el('div', 'tc-suggest__row');
    var ip = input('', t('suggestionPh')); row.appendChild(ip);
    var add = el('button', 'tc-cta', t('suggest')); add.type = 'button';
    add.addEventListener('click', function () {
      if (!ip.value.trim()) return;
      var fam = tripFamilies().filter(function (f) { return f.id === me; })[0];
      state.trip.suggestions = state.trip.suggestions || [];
      state.trip.suggestions.push({ id: uid('sug'), text: ip.value.trim(), familyId: me || '', familyName: fam ? fam.name : '', votes: {}, ts: Date.now() });
      saveTrip(state.trip); render();
    });
    row.appendChild(add); b.appendChild(row);
    return b;
  }

  function openPlaceModal(p) {
    closeModal();
    var ov = el('div', 'tc-modal'); ov.id = 'tcModal';
    var card = el('div', 'tc-modal__card');
    var head = el('div', 'tc-modal__head');
    head.appendChild(el('strong', 'tc-modal__title', p.name));
    var x = el('button', 'tc-modal__x', '×'); x.type = 'button'; x.addEventListener('click', closeModal); head.appendChild(x);
    card.appendChild(head);
    card.appendChild(placeMedia(p, 'tc-modal__media'));
    if (p.address) card.appendChild(row2('📍', p.address));
    if (p.description) card.appendChild(el('p', 'tc-modal__desc', p.description));
    if (p.whySelected) card.appendChild(kv(t('whySelected'), p.whySelected));
    if (p.bestTime) card.appendChild(kv(t('bestTime'), p.bestTime));
    if (p.estimatedDuration) card.appendChild(kv(t('duration'), p.estimatedDuration));
    if (p.estimatedCost) card.appendChild(kv(t('cost'), p.estimatedCost));
    if (p.parkingNotes) card.appendChild(kv(t('parking'), p.parkingNotes));
    if (p.tips) card.appendChild(kv(t('tips'), p.tips));
    if (p.backupPlace) card.appendChild(kv(t('backup'), p.backupPlace));
    var acts = el('div', 'tc-modal__acts');
    acts.appendChild(linkBtn(t('mapG'), p.googleMapsUrl || MapLinkProvider.google(p.name, p.address)));
    acts.appendChild(linkBtn(t('mapA'), p.appleMapsUrl || MapLinkProvider.apple(p.name, p.address)));
    if (p.websiteUrl) acts.appendChild(linkBtn(t('website'), p.websiteUrl));
    if (p.reservationUrl) acts.appendChild(linkBtn('🎟 ' + t('reserve'), p.reservationUrl, 'tc-pbtn--accent'));
    if (p.videoUrl) acts.appendChild(linkBtn('▶ ' + t('watchClip'), p.videoUrl, 'tc-pbtn--accent'));
    card.appendChild(acts);
    card.appendChild(el('p', 'tc-unverified', t('unverified')));
    ov.appendChild(card);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    doc.body.appendChild(ov);
  }
  function kv(k, v) { var d = el('div', 'tc-kv'); d.appendChild(el('span', 'tc-kv__k', k)); d.appendChild(el('span', 'tc-kv__v', v)); return d; }
  function row2(icon, v) { var d = el('p', 'tc-modal__row'); d.textContent = icon + ' ' + v; return d; }
  function closeModal() { var m = doc.getElementById('tcModal'); if (m && m.parentNode) m.parentNode.removeChild(m); }

  // ── Family Arrival Plan ────────────────────────────────────────────────
  function renderArrival(plan) {
    var wrap = el('div', 'tc-arrival');
    if (plan.meetupPoint) wrap.appendChild(el('div', 'tc-meetbar', '📍 ' + t('meetup') + ': ' + plan.meetupPoint + (plan.meetupTime ? ' · ' + plan.meetupTime : '')));
    (plan.transportation || []).forEach(function (tp, i) {
      var c = el('article', 'tc-arr');
      var head = el('div', 'tc-arr__head');
      head.appendChild(el('strong', 'tc-arr__fam', tp.familyName || ('Family ' + (i + 1))));
      head.appendChild(chip('tc-chip--method', methodIcon(tp.method) + ' ' + t('m_' + tp.method)));
      c.appendChild(head);
      c.appendChild(el('p', 'tc-arr__route', (tp.origin || '') + ' → ' + (tp.destination || plan.destination || '')));
      var g = el('div', 'tc-arr__grid');
      g.appendChild(kv(t('recDeparture'), tp.recommendedDepartureTime || '—'));
      g.appendChild(kv(t('eta'), tp.estimatedArrivalTime || '—'));
      g.appendChild(kv(t('cost'), tp.estimatedCost || t('pending')));
      c.appendChild(g);
      if (tp.routeSummary) c.appendChild(kv(t('route'), tp.routeSummary));
      if (tp.restStops && tp.restStops.length) c.appendChild(kv(t('restStops'), tp.restStops.join(' · ')));
      if (tp.notes) c.appendChild(kv(t('notes'), tp.notes));
      if (tp.backupPlan) c.appendChild(kv(t('backup'), tp.backupPlan));
      // provider links (search only)
      var links = el('div', 'tc-arr__links');
      if (tp.method === 'plane') links.appendChild(linkBtn('✈ ' + t('ticketSearch'), tp.ticketSearchUrl || TravelTicketProvider.flightSearch(tp.origin, tp.destination || plan.destination), 'tc-pbtn--accent'));
      if (tp.method === 'bus') links.appendChild(linkBtn('🚌 ' + t('ticketSearch'), tp.ticketSearchUrl || BusTicketProvider.search(tp.origin, tp.destination || plan.destination), 'tc-pbtn--accent'));
      if (tp.method === 'car') links.appendChild(linkBtn('🗺 ' + t('route'), tp.routeMapUrl || MapLinkProvider.google(tp.destination || plan.destination, ''), ''));
      if (tp.providerWebsite) links.appendChild(linkBtn(t('website'), tp.providerWebsite));
      if (tp.providerPhone) links.appendChild(linkBtn('📞 ' + tp.providerPhone, 'tel:' + String(tp.providerPhone).replace(/[^0-9+]/g, '')));
      c.appendChild(links);
      // status
      var key = tp.familyName || ('f' + i);
      var cur = state.trip.transportStatus[key] || tp.bookingStatus || 'planning';
      var stWrap = el('div', 'tc-arr__status');
      stWrap.appendChild(el('span', 'tc-field__lbl', t('status')));
      var ssel = selectFrom(['planning', 'booked', 'on_the_way', 'arrived'], normStatus(cur), function (o) { return t('st_' + o); });
      ssel.className = 'tc-input';
      ssel.addEventListener('change', function () { state.trip.transportStatus[key] = ssel.value; saveTrip(state.trip); });
      stWrap.appendChild(ssel);
      c.appendChild(stWrap);
      if (tp.estimatedCost && /pending/i.test(tp.estimatedCost)) c.appendChild(el('p', 'tc-unverified', t('pending')));
      wrap.appendChild(c);
    });
    if (!(plan.transportation || []).length) wrap.appendChild(el('p', 'tc-empty', '—'));
    return wrap;
  }
  function methodIcon(m) { return ({ car: '🚗', plane: '✈', bus: '🚌', other: '🧭' })[m] || '🧭'; }
  function normStatus(s) { var ok = ['planning', 'booked', 'on_the_way', 'arrived']; return ok.indexOf(s) !== -1 ? s : 'planning'; }

  // ── Group tab: share + notes ───────────────────────────────────────────
  function renderGroup(plan) {
    var wrap = el('div', 'tc-group');
    // Share
    var sh = el('div', 'tc-share');
    sh.appendChild(el('strong', 'tc-share__t', t('shareTitle')));
    sh.appendChild(el('p', 'tc-share__s', t('shareSub')));
    var url = shareUrl(state.trip.id);
    var urow = el('div', 'tc-share__row');
    var ui = input(url, ''); ui.readOnly = true; urow.appendChild(ui);
    var cp = el('button', 'tc-cta', t('copyLink')); cp.type = 'button'; cp.addEventListener('click', function () { copyText(url); toast(t('copied')); });
    urow.appendChild(cp);
    sh.appendChild(urow);
    wrap.appendChild(sh);
    // Assumptions / warnings
    if (plan.assumptions && plan.assumptions.length) wrap.appendChild(listBlock(t('assumptions'), plan.assumptions));
    if (plan.warnings && plan.warnings.length) wrap.appendChild(listBlock('⚠ ' + t('warnings'), plan.warnings));
    // Group suggestions (add + vote)
    wrap.appendChild(suggestionsBlock());
    // Notes
    var nb = el('div', 'tc-notes');
    nb.appendChild(el('strong', 'tc-notes__t', t('notes')));
    (state.trip.notes || []).forEach(function (n) { nb.appendChild(el('p', 'tc-notes__item', '• ' + n.text)); });
    var nrow = el('div', 'tc-notes__row');
    var ni = input('', t('addNote')); nrow.appendChild(ni);
    var ns = el('button', 'tc-cta', t('send')); ns.type = 'button';
    ns.addEventListener('click', function () { if (!ni.value.trim()) return; state.trip.notes.push({ text: ni.value.trim(), ts: Date.now() }); saveTrip(state.trip); render(); });
    nrow.appendChild(ns); nb.appendChild(nrow);
    wrap.appendChild(nb);
    // New trip
    var nt = el('button', 'tc-addbtn', t('newTrip')); nt.type = 'button'; nt.addEventListener('click', function () { newTrip(); state.screen = 'create'; pushTripUrl(null); render(); });
    wrap.appendChild(nt);
    return wrap;
  }
  function listBlock(title, items) { var b = el('div', 'tc-listblock'); b.appendChild(el('strong', 'tc-listblock__t', title)); var ul = el('ul', 'tc-listblock__ul'); items.forEach(function (it) { ul.appendChild(el('li', null, it)); }); b.appendChild(ul); return b; }

  // ── Utilities ──────────────────────────────────────────────────────────
  function shareUrl(id) { try { return root.location.origin + '/travel-concierge?trip=' + id; } catch (e) { return '/travel-concierge?trip=' + id; } }
  function pushTripUrl(id) { try { var u = id ? ('/travel-concierge?trip=' + id) : '/travel-concierge'; root.history.replaceState({}, '', u); } catch (e) {} }
  function copyText(txt) { try { if (root.navigator && root.navigator.clipboard) { root.navigator.clipboard.writeText(txt).catch(function () {}); return; } } catch (e) {} try { var ta = doc.createElement('textarea'); ta.value = txt; doc.body.appendChild(ta); ta.select(); doc.execCommand('copy'); doc.body.removeChild(ta); } catch (e) {} }
  function toast(msg) { try { var x = el('div', 'tc-toast', msg); doc.body.appendChild(x); root.setTimeout(function () { x.classList.add('tc-toast--on'); }, 10); root.setTimeout(function () { x.classList.remove('tc-toast--on'); root.setTimeout(function () { if (x.parentNode) x.parentNode.removeChild(x); }, 300); }, 1700); } catch (e) {} }

  // ── i18n add interest labels dynamically ───────────────────────────────
  ['en', 'vi', 'es'].forEach(function (lng) {
    var labels = {
      en: { beach: 'Beach', zoo: 'Zoo', shows: 'Shows', shopping: 'Shopping', casino: 'Casino', museums: 'Museums', food: 'Food', nightlife: 'Nightlife', theme_park: 'Theme park', scenic: 'Scenic', family_friendly: 'Family-friendly' },
      vi: { beach: 'Biển', zoo: 'Sở thú', shows: 'Biểu diễn', shopping: 'Mua sắm', casino: 'Casino', museums: 'Bảo tàng', food: 'Ẩm thực', nightlife: 'Về đêm', theme_park: 'Công viên', scenic: 'Cảnh đẹp', family_friendly: 'Hợp gia đình' },
      es: { beach: 'Playa', zoo: 'Zoológico', shows: 'Espectáculos', shopping: 'Compras', casino: 'Casino', museums: 'Museos', food: 'Comida', nightlife: 'Vida nocturna', theme_park: 'Parque temático', scenic: 'Paisajes', family_friendly: 'Familiar' },
    }[lng];
    Object.keys(labels).forEach(function (k) { T[lng]['int_' + k] = labels[k]; });
  });

  // ── Lang switch + init ─────────────────────────────────────────────────
  function detectLang() { try { var p = new URLSearchParams(root.location.search).get('lang'); if (T[p]) return p; var sv = root.localStorage.getItem('dlc_lang'); if (T[sv]) return sv; var nv = (root.navigator.language || '').slice(0, 2); if (T[nv]) return nv; } catch (e) {} return 'vi'; }
  function setLang(l) { if (!T[l]) return; state.lang = l; try { root.localStorage.setItem('dlc_lang', l); } catch (e) {} doc.documentElement.setAttribute('lang', l); syncLangBtns(); render(); }
  function syncLangBtns() { doc.querySelectorAll('#tcLang .tc-lang__btn').forEach(function (b) { b.classList.toggle('tc-lang__btn--on', b.getAttribute('data-lang') === state.lang); }); }

  // Resolve when anonymous auth is ready (so Firestore reads pass the rules), with
  // a hard timeout so the UI never hangs if auth is unavailable.
  function ensureAuth() {
    return new Promise(function (resolve) {
      try {
        if (!root.firebase || !root.firebase.auth) return resolve();
        var a = root.firebase.auth();
        if (a.currentUser) return resolve();
        var done = false; function fin() { if (!done) { done = true; resolve(); } }
        try { a.onAuthStateChanged(function (u) { if (u) fin(); }); } catch (e) {}
        a.signInAnonymously().catch(function () { fin(); });
        root.setTimeout(fin, 3000);
      } catch (e) { resolve(); }
    });
  }
  function init() {
    state.lang = detectLang(); doc.documentElement.setAttribute('lang', state.lang);
    doc.querySelectorAll('#tcLang .tc-lang__btn').forEach(function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });
    syncLangBtns();
    var tripId = null; try { tripId = new URLSearchParams(root.location.search).get('trip'); } catch (e) {}
    if (tripId) {
      // Recipient of a shared link: WAIT for anonymous auth before the Firestore
      // read (rules require request.auth != null), so the shared plan loads reliably
      // on a device with no local copy.
      ensureAuth().then(function () {
        loadTrip(tripId).then(function (tr) {
          if (tr && tr.plan) { state.trip = tr; state.readonly = false; state.screen = 'plan'; state.activeTab = 'itinerary'; }
          else { newTrip(); state.screen = 'hero'; }
          render();
        });
      });
    } else {
      // Normal entry — render immediately; anon auth in the background enables save/share.
      ensureAuth();
      newTrip(); state.screen = 'hero'; render();
    }
  }

  root.TravelConcierge = { init: init, setLang: setLang, _state: state, _strings: T, _mockPlan: mockPlan, _generatePlan: generatePlan, _MapLinkProvider: MapLinkProvider, _TravelTicketProvider: TravelTicketProvider, _BusTicketProvider: BusTicketProvider };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);
