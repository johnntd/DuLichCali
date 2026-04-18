// ============================================================
// VENDOR PRICING PAGE — vendor-pricing-page.js
//
// Reads dlcLang from localStorage (same key as main app).
// All copy, prices, and static page text translate to VI or ES
// when the user has selected that language.
// ============================================================

(function () {
  'use strict';

  // ── Language detection ────────────────────────────────────
  var _lang = 'en';
  try {
    var _stored = localStorage.getItem('dlcLang');
    if (_stored && ['en','vi','es'].indexOf(_stored) !== -1) _lang = _stored;
  } catch(e) {}

  // ── Full locale data ──────────────────────────────────────
  var LOCALES = {

    // ══════════════════════════════════════════════════════════
    // ENGLISH
    // ══════════════════════════════════════════════════════════
    en: {
      // Static page text
      page: {
        navCta:            'Start Free Trial',
        heroPill:          'Your 24/7 AI Receptionist',
        heroH1:            'Never Miss a<br><em>Customer Again</em>',
        heroSub:           'Your AI receptionist books appointments, takes orders, and answers customer questions — even while you sleep. Works in Vietnamese, English, and Spanish.',
        heroCtaPrimary:    'Start Free Trial',
        heroCtaSecondary:  'See How It Works',
        heroTrust:         '<span role="listitem">No setup fee</span><span role="listitem">Cancel anytime</span><span role="listitem">Setup in minutes</span>',
        pricingEyebrow:    'Simple Pricing',
        pricingTitle:      'One platform. Everything you need to grow.',
        pricingSub:        'Start free. Upgrade when you\'re ready. Cancel anytime — no questions asked.',
        roiEyebrow:        'The Math Is Simple',
        roiTitle:          'One tool replaces everything',
        roiSub:            'Compare what you\'re spending now to what you could spend with DuLichCali.',
        roiQuote:          'Just one extra booking can pay for the month.',
        benefitsEyebrow:   'What Your AI Does For You',
        benefitsTitle:     'Less stress. More customers.',
        benefitsSub:       'Your AI handles the repetitive stuff so you can focus on the work that actually grows your business.',
        usecasesEyebrow:   'Built For Your Business',
        usecasesTitle:     'Designed for local service businesses',
        usecasesSub:       'Whether you run a nail salon, food business, or ride service — DuLichCali is built for how you actually work.',
        ctaEyebrow:        'Ready to grow?',
        ctaTitle:          'Start Getting More<br>Customers Today',
        ctaSub:            'Join vendors across California already using DuLichCali to automate their bookings and never miss a customer again.',
        ctaBtn:            'Start Free Trial — It\'s Free',
        ctaTrust:          '<span>No setup fee</span><span>Cancel anytime</span><span>Setup in minutes</span>',
        stickyFrom:        'From <span class="vpp-sticky__price">$99/month</span>',
        stickyBtn:         'Start Free Trial',
        footerTag:         'AI-powered booking for local businesses',
        planCta:           'Start Free Trial',
        planFine:          'No setup fee · Cancel anytime',
        mostPopular:       'Most Popular',
      },
      plans: [
        {
          id: 'starter', name: 'Starter', price: 99, badge: null, highlighted: false,
          description: 'App-based booking and notifications. Everything you need to get started.',
          features: [
            { text: 'AI receptionist (24/7)',         included: true  },
            { text: 'Online booking system',          included: true  },
            { text: 'In-app notifications',           included: true  },
            { text: 'Marketplace listing',            included: true  },
            { text: 'Multi-language AI (VI/EN/ES)',   included: true  },
            { text: 'Smart scheduling',               included: true  },
            { text: 'SMS reminders & confirmations',  included: false },
            { text: 'AI phone receptionist',          included: false },
          ],
        },
        {
          id: 'growth', name: 'Growth', price: 199, badge: 'Most Popular', highlighted: true,
          description: 'Adds SMS so customers get reminders and confirmations by text.',
          features: [
            { text: 'Everything in Starter',          included: true  },
            { text: 'SMS appointment reminders',      included: true  },
            { text: 'SMS booking confirmations',      included: true  },
            { text: 'No double-booking logic',        included: true  },
            { text: 'AI upselling',                   included: true  },
            { text: 'Priority support',               included: true  },
            { text: 'Analytics dashboard',            included: true  },
            { text: 'AI phone receptionist',          included: false },
          ],
        },
        {
          id: 'pro', name: 'Pro', price: 299, badge: null, highlighted: false,
          description: 'Adds a 24/7 AI phone receptionist that answers calls and takes bookings for you.',
          features: [
            { text: 'Everything in Growth',           included: true  },
            { text: 'AI phone receptionist (24/7)',   included: true  },
            { text: 'Answers & books by phone',       included: true  },
            { text: 'Customer follow-up calls',       included: true  },
            { text: 'Custom AI voice training',       included: true  },
            { text: 'White-glove onboarding',         included: true  },
            { text: 'Dedicated account manager',      included: true  },
            { text: 'Advanced analytics',             included: true  },
          ],
        },
      ],
      roi: [
        {
          icon: '👤', label: 'Human Receptionist', value: '$2,500+/mo', highlight: false,
          desc: "Salary, benefits, and training — and they still can't work nights and weekends.",
        },
        {
          icon: '📵', label: 'Missed Customers', value: 'Lost revenue', highlight: false,
          desc: 'Every unanswered message is a booking that went to your competitor. Every single one.',
        },
        {
          icon: '🤖', label: 'DuLichCali AI', value: 'From $99/mo', highlight: true,
          desc: 'Never misses a customer. Works 24/7. Books automatically. Pays for itself with one booking.',
        },
      ],
      benefits: [
        { icon: '⚡', title: 'Answers Instantly',   desc: 'Your AI responds to every customer in seconds — day or night, weekend or holiday.' },
        { icon: '📅', title: 'Books Automatically', desc: 'Customers pick their slot and get confirmed without you lifting a finger.' },
        { icon: '🚫', title: 'Prevents Conflicts',  desc: 'Smart scheduling prevents double-bookings and keeps your calendar perfectly clean.' },
        { icon: '🌍', title: 'Speaks 3 Languages',  desc: 'Serves customers in Vietnamese, English, and Spanish — automatically, mid-conversation.' },
        { icon: '🌙', title: 'Works While You Sleep', desc: '24/7 availability means you capture bookings even when the shop is closed.' },
      ],
      useCases: [
        {
          icon: '💅', type: 'Nail Salons', title: 'Never put a customer on hold again',
          body: 'When a new client texts at 10pm asking for Saturday slots, your AI handles it, confirms the booking, and sends a reminder — all while you rest. Cut front-desk calls by 70%.',
          tags: ['Appointment booking', 'Reminders', 'Walk-in waitlist', '24/7 AI'],
        },
        {
          icon: '🍜', type: 'Food Vendors', title: 'Take orders without answering the phone',
          body: 'Customers text their orders, pick a pickup time, and get a confirmation automatically. No more missed calls during the lunch rush. Focus on cooking — not your phone.',
          tags: ['Order intake', 'Pickup scheduling', 'Menu AI', 'Auto-confirmations'],
        },
        {
          icon: '🚗', type: 'Drivers & Ride Services', title: 'Fill your schedule without the back-and-forth',
          body: 'Airport pickups, private rides, group tours — your AI collects the details, confirms availability, and handles rescheduling. You drive. AI handles the rest.',
          tags: ['Airport rides', 'Pickup scheduling', 'Group tours', 'No phone tag'],
        },
      ],
    },

    // ══════════════════════════════════════════════════════════
    // VIETNAMESE
    // ══════════════════════════════════════════════════════════
    vi: {
      page: {
        navCta:            'Dùng Thử Miễn Phí',
        heroPill:          'Lễ Tân AI 24/7 Của Bạn',
        heroH1:            'Không Bao Giờ Bỏ Lỡ<br><em>Khách Hàng Nữa</em>',
        heroSub:           'Lễ tân AI đặt lịch hẹn, nhận đơn hàng và trả lời câu hỏi của khách — ngay cả khi bạn đang ngủ. Hỗ trợ tiếng Việt, Anh và Tây Ban Nha.',
        heroCtaPrimary:    'Dùng Thử Miễn Phí',
        heroCtaSecondary:  'Xem Cách Hoạt Động',
        heroTrust:         '<span role="listitem">Không phí cài đặt</span><span role="listitem">Hủy bất cứ lúc nào</span><span role="listitem">Cài đặt trong vài phút</span>',
        pricingEyebrow:    'Bảng Giá Đơn Giản',
        pricingTitle:      'Một nền tảng. Tất cả những gì bạn cần để phát triển.',
        pricingSub:        'Bắt đầu miễn phí. Nâng cấp khi bạn sẵn sàng. Hủy bất cứ lúc nào — không hỏi thêm.',
        roiEyebrow:        'Toán Học Rất Đơn Giản',
        roiTitle:          'Một công cụ thay thế tất cả',
        roiSub:            'So sánh chi phí hiện tại của bạn với những gì bạn có thể chi tiêu cùng DuLichCali.',
        roiQuote:          'Chỉ một đơn đặt lịch thêm là đủ trả tiền cho cả tháng.',
        benefitsEyebrow:   'AI Của Bạn Làm Gì',
        benefitsTitle:     'Ít căng thẳng hơn. Nhiều khách hàng hơn.',
        benefitsSub:       'AI của bạn xử lý những việc lặp đi lặp lại để bạn tập trung vào công việc thực sự giúp phát triển doanh nghiệp.',
        usecasesEyebrow:   'Xây Dựng Cho Doanh Nghiệp Của Bạn',
        usecasesTitle:     'Thiết kế cho các doanh nghiệp dịch vụ địa phương',
        usecasesSub:       'Dù bạn điều hành tiệm nail, kinh doanh thực phẩm hay dịch vụ đưa đón — DuLichCali được xây dựng theo cách bạn thực sự làm việc.',
        ctaEyebrow:        'Sẵn sàng phát triển?',
        ctaTitle:          'Bắt Đầu Có Nhiều<br>Khách Hàng Hơn Ngay Hôm Nay',
        ctaSub:            'Tham gia cùng các nhà cung cấp trên khắp California đang sử dụng DuLichCali để tự động đặt lịch và không bao giờ bỏ lỡ khách hàng.',
        ctaBtn:            'Dùng Thử Miễn Phí — Hoàn Toàn Miễn Phí',
        ctaTrust:          '<span>Không phí cài đặt</span><span>Hủy bất cứ lúc nào</span><span>Cài đặt trong vài phút</span>',
        stickyFrom:        'Từ <span class="vpp-sticky__price">$99/tháng</span>',
        stickyBtn:         'Dùng Thử Miễn Phí',
        footerTag:         'Đặt lịch AI cho doanh nghiệp địa phương',
        planCta:           'Chọn Gói Này',
        planFine:          'Không phí cài đặt · Hủy bất cứ lúc nào',
        mostPopular:       'Phổ Biến Nhất',
      },
      plans: [
        {
          id: 'starter', name: 'Khởi Đầu', price: 99, badge: null, highlighted: false,
          description: 'Đặt lịch và thông báo qua ứng dụng. Tất cả những gì bạn cần để bắt đầu.',
          features: [
            { text: 'Lễ tân AI (24/7)',                   included: true  },
            { text: 'Hệ thống đặt lịch trực tuyến',      included: true  },
            { text: 'Thông báo trong ứng dụng',           included: true  },
            { text: 'Niêm yết trên Marketplace',          included: true  },
            { text: 'AI đa ngôn ngữ (VI/EN/ES)',          included: true  },
            { text: 'Lên lịch thông minh',                included: true  },
            { text: 'Nhắc nhở & xác nhận qua SMS',        included: false },
            { text: 'Lễ tân AI qua điện thoại',           included: false },
          ],
        },
        {
          id: 'growth', name: 'Tăng Trưởng', price: 199, badge: 'Phổ Biến Nhất', highlighted: true,
          description: 'Thêm SMS để khách hàng nhận nhắc nhở và xác nhận qua tin nhắn.',
          features: [
            { text: 'Tất cả tính năng Khởi Đầu',          included: true  },
            { text: 'Nhắc lịch hẹn qua SMS',              included: true  },
            { text: 'Xác nhận đặt lịch qua SMS',          included: true  },
            { text: 'Tự động tránh đặt trùng lịch',       included: true  },
            { text: 'AI upselling tự động',                included: true  },
            { text: 'Hỗ trợ ưu tiên',                     included: true  },
            { text: 'Bảng phân tích dữ liệu',             included: true  },
            { text: 'Lễ tân AI qua điện thoại',           included: false },
          ],
        },
        {
          id: 'pro', name: 'Chuyên Nghiệp', price: 299, badge: null, highlighted: false,
          description: 'Thêm lễ tân AI 24/7 qua điện thoại — tự động nghe máy và đặt lịch cho bạn.',
          features: [
            { text: 'Tất cả tính năng Tăng Trưởng',       included: true  },
            { text: 'Lễ tân AI qua điện thoại (24/7)',     included: true  },
            { text: 'Nghe máy & đặt lịch tự động',        included: true  },
            { text: 'Gọi theo dõi khách hàng',            included: true  },
            { text: 'Huấn luyện giọng AI riêng',          included: true  },
            { text: 'Hỗ trợ onboarding tận tay',          included: true  },
            { text: 'Quản lý tài khoản chuyên biệt',      included: true  },
            { text: 'Phân tích nâng cao',                 included: true  },
          ],
        },
      ],
      roi: [
        {
          icon: '👤', label: 'Lễ Tân Người Thật', value: '$2,500+/tháng', highlight: false,
          desc: 'Lương, phúc lợi và đào tạo — và họ vẫn không thể làm việc đêm và cuối tuần.',
        },
        {
          icon: '📵', label: 'Khách Hàng Bỏ Lỡ', value: 'Doanh thu mất', highlight: false,
          desc: 'Mỗi tin nhắn không trả lời là một đơn đặt lịch đã sang tay đối thủ. Từng cái một.',
        },
        {
          icon: '🤖', label: 'DuLichCali AI', value: 'Từ $99/tháng', highlight: true,
          desc: 'Không bao giờ bỏ lỡ khách hàng. Hoạt động 24/7. Đặt lịch tự động. Một lần đặt lịch là đủ hoàn vốn.',
        },
      ],
      benefits: [
        { icon: '⚡', title: 'Phản Hồi Ngay Lập Tức',   desc: 'AI của bạn trả lời mọi khách hàng trong vài giây — ngày hay đêm, ngày thường hay cuối tuần.' },
        { icon: '📅', title: 'Đặt Lịch Tự Động',        desc: 'Khách hàng chọn khung giờ và nhận xác nhận mà không cần bạn làm gì.' },
        { icon: '🚫', title: 'Ngăn Đặt Trùng Lịch',     desc: 'Lên lịch thông minh ngăn đặt trùng và giữ lịch của bạn luôn gọn gàng.' },
        { icon: '🌍', title: 'Nói 3 Ngôn Ngữ',           desc: 'Phục vụ khách hàng bằng tiếng Việt, Anh và Tây Ban Nha — tự động, ngay giữa cuộc trò chuyện.' },
        { icon: '🌙', title: 'Làm Việc Khi Bạn Ngủ',    desc: 'Luôn sẵn sàng 24/7 — bạn nhận được đơn đặt lịch ngay cả khi cửa hàng đã đóng.' },
      ],
      useCases: [
        {
          icon: '💅', type: 'Tiệm Nail', title: 'Không bao giờ để khách hàng chờ máy nữa',
          body: 'Khi khách nhắn tin lúc 10 giờ đêm hỏi lịch thứ Bảy, AI của bạn xử lý, xác nhận đặt lịch và gửi nhắc nhở — tất cả trong khi bạn nghỉ ngơi. Giảm 70% cuộc gọi cho lễ tân.',
          tags: ['Đặt lịch hẹn', 'Nhắc nhở', 'Danh sách chờ', 'AI 24/7'],
        },
        {
          icon: '🍜', type: 'Bán Thức Ăn', title: 'Nhận đơn hàng mà không cần nghe điện thoại',
          body: 'Khách nhắn tin đặt hàng, chọn giờ lấy hàng và nhận xác nhận tự động. Không còn bỏ lỡ cuộc gọi giờ cao điểm. Tập trung nấu ăn — không phải cầm điện thoại.',
          tags: ['Nhận đơn hàng', 'Đặt giờ lấy hàng', 'AI thực đơn', 'Xác nhận tự động'],
        },
        {
          icon: '🚗', type: 'Tài Xế & Dịch Vụ Đưa Đón', title: 'Lấp đầy lịch mà không cần qua lại nhiều lần',
          body: 'Đón sân bay, xe riêng, tour nhóm — AI của bạn thu thập thông tin, xác nhận lịch và xử lý đổi lịch. Bạn lái xe. AI lo phần còn lại.',
          tags: ['Đón sân bay', 'Đặt lịch đón', 'Tour nhóm', 'Không qua lại nhiều lần'],
        },
      ],
    },

    // ══════════════════════════════════════════════════════════
    // SPANISH
    // ══════════════════════════════════════════════════════════
    es: {
      page: {
        navCta:            'Prueba Gratis',
        heroPill:          'Tu Recepcionista AI 24/7',
        heroH1:            'Nunca Pierdas<br><em>un Cliente Más</em>',
        heroSub:           'Tu recepcionista AI agenda citas, toma pedidos y responde preguntas de clientes — incluso mientras duermes. Funciona en vietnamita, inglés y español.',
        heroCtaPrimary:    'Prueba Gratis',
        heroCtaSecondary:  'Ver Cómo Funciona',
        heroTrust:         '<span role="listitem">Sin tarifa de configuración</span><span role="listitem">Cancela cuando quieras</span><span role="listitem">Configuración en minutos</span>',
        pricingEyebrow:    'Precios Simples',
        pricingTitle:      'Una plataforma. Todo lo que necesitas para crecer.',
        pricingSub:        'Empieza gratis. Actualiza cuando estés listo. Cancela cuando quieras — sin preguntas.',
        roiEyebrow:        'Las Matemáticas Son Simples',
        roiTitle:          'Una herramienta que reemplaza todo',
        roiSub:            'Compara lo que gastas ahora con lo que podrías gastar con DuLichCali.',
        roiQuote:          'Una sola reserva extra puede pagar el mes.',
        benefitsEyebrow:   'Lo Que Tu AI Hace Por Ti',
        benefitsTitle:     'Menos estrés. Más clientes.',
        benefitsSub:       'Tu AI maneja las tareas repetitivas para que puedas enfocarte en lo que realmente hace crecer tu negocio.',
        usecasesEyebrow:   'Construido Para Tu Negocio',
        usecasesTitle:     'Diseñado para negocios de servicios locales',
        usecasesSub:       'Ya sea que tengas un salón de uñas, negocio de comida o servicio de transporte — DuLichCali está hecho para cómo realmente trabajas.',
        ctaEyebrow:        '¿Listo para crecer?',
        ctaTitle:          'Empieza a Conseguir Más<br>Clientes Hoy',
        ctaSub:            'Únete a los vendedores en California que ya usan DuLichCali para automatizar sus reservas y nunca perder un cliente.',
        ctaBtn:            'Prueba Gratis — Es Gratis',
        ctaTrust:          '<span>Sin tarifa de configuración</span><span>Cancela cuando quieras</span><span>Configuración en minutos</span>',
        stickyFrom:        'Desde <span class="vpp-sticky__price">$99/mes</span>',
        stickyBtn:         'Prueba Gratis',
        footerTag:         'Reservas con AI para negocios locales',
        planCta:           'Elegir Este Plan',
        planFine:          'Sin tarifa de configuración · Cancela cuando quieras',
        mostPopular:       'Más Popular',
      },
      plans: [
        {
          id: 'starter', name: 'Básico', price: 99, badge: null, highlighted: false,
          description: 'Reservas y notificaciones por app. Todo lo que necesitas para empezar.',
          features: [
            { text: 'Recepcionista AI (24/7)',              included: true  },
            { text: 'Sistema de reservas en línea',         included: true  },
            { text: 'Notificaciones en la app',             included: true  },
            { text: 'Listado en el Marketplace',            included: true  },
            { text: 'AI multilingüe (VI/EN/ES)',            included: true  },
            { text: 'Programación inteligente',             included: true  },
            { text: 'Recordatorios y confirmaciones SMS',   included: false },
            { text: 'Recepcionista AI por teléfono',        included: false },
          ],
        },
        {
          id: 'growth', name: 'Crecimiento', price: 199, badge: 'Más Popular', highlighted: true,
          description: 'Agrega SMS para que los clientes reciban recordatorios y confirmaciones.',
          features: [
            { text: 'Todo lo del plan Básico',              included: true  },
            { text: 'Recordatorios de citas por SMS',       included: true  },
            { text: 'Confirmaciones de reservas por SMS',   included: true  },
            { text: 'Sin doble reserva',                    included: true  },
            { text: 'Ventas adicionales con AI',            included: true  },
            { text: 'Soporte prioritario',                  included: true  },
            { text: 'Panel de análisis',                    included: true  },
            { text: 'Recepcionista AI por teléfono',        included: false },
          ],
        },
        {
          id: 'pro', name: 'Profesional', price: 299, badge: null, highlighted: false,
          description: 'Agrega un recepcionista AI 24/7 por teléfono que contesta llamadas y hace reservas.',
          features: [
            { text: 'Todo lo del plan Crecimiento',         included: true  },
            { text: 'Recepcionista AI por teléfono (24/7)', included: true  },
            { text: 'Responde y reserva por teléfono',      included: true  },
            { text: 'Llamadas de seguimiento a clientes',   included: true  },
            { text: 'Entrenamiento de voz AI personalizado',included: true  },
            { text: 'Incorporación personalizada',          included: true  },
            { text: 'Gerente de cuenta dedicado',           included: true  },
            { text: 'Análisis avanzado',                    included: true  },
          ],
        },
      ],
      roi: [
        {
          icon: '👤', label: 'Recepcionista Humano', value: '$2,500+/mes', highlight: false,
          desc: 'Salario, beneficios y capacitación — y aún así no pueden trabajar de noche ni los fines de semana.',
        },
        {
          icon: '📵', label: 'Clientes Perdidos', value: 'Ingresos perdidos', highlight: false,
          desc: 'Cada mensaje sin respuesta es una reserva que fue a tu competidor. Cada uno.',
        },
        {
          icon: '🤖', label: 'DuLichCali AI', value: 'Desde $99/mes', highlight: true,
          desc: 'Nunca pierde un cliente. Trabaja 24/7. Reserva automáticamente. Se paga solo con una reserva.',
        },
      ],
      benefits: [
        { icon: '⚡', title: 'Responde al Instante',    desc: 'Tu AI responde a cada cliente en segundos — de día o de noche, entre semana o en fin de semana.' },
        { icon: '📅', title: 'Reserva Automáticamente', desc: 'Los clientes eligen su horario y reciben confirmación sin que tú hagas nada.' },
        { icon: '🚫', title: 'Evita Conflictos',        desc: 'La programación inteligente evita dobles reservas y mantiene tu calendario perfectamente limpio.' },
        { icon: '🌍', title: 'Habla 3 Idiomas',         desc: 'Atiende clientes en vietnamita, inglés y español — automáticamente, en medio de la conversación.' },
        { icon: '🌙', title: 'Trabaja Mientras Duermes', desc: 'Disponibilidad 24/7 significa que capturas reservas incluso cuando el local está cerrado.' },
      ],
      useCases: [
        {
          icon: '💅', type: 'Salones de Uñas', title: 'Nunca más pongas a un cliente en espera',
          body: 'Cuando un nuevo cliente escribe a las 10pm preguntando por el sábado, tu AI lo atiende, confirma la reserva y envía un recordatorio — todo mientras descansas. Reduce las llamadas en un 70%.',
          tags: ['Reservas de citas', 'Recordatorios', 'Lista de espera', 'AI 24/7'],
        },
        {
          icon: '🍜', type: 'Vendedores de Comida', title: 'Toma pedidos sin contestar el teléfono',
          body: 'Los clientes escriben sus pedidos, eligen una hora de recogida y reciben confirmación automáticamente. Sin llamadas perdidas durante la hora pico. Enfócate en cocinar — no en tu teléfono.',
          tags: ['Recepción de pedidos', 'Programación de recogida', 'AI de menú', 'Auto-confirmaciones'],
        },
        {
          icon: '🚗', type: 'Choferes y Servicios de Transporte', title: 'Llena tu agenda sin tantas idas y vueltas',
          body: 'Recogidas en aeropuerto, viajes privados, tours grupales — tu AI recopila los detalles, confirma disponibilidad y gestiona reprogramaciones. Tú manejas. AI maneja el resto.',
          tags: ['Viajes al aeropuerto', 'Programación de recogida', 'Tours grupales', 'Sin llamadas innecesarias'],
        },
      ],
    },

  }; // end LOCALES

  // ── Active locale ──────────────────────────────────────────
  var L = LOCALES[_lang] || LOCALES['en'];

  // ── Helpers ───────────────────────────────────────────────
  function _set(id, prop, val) {
    var el = document.getElementById(id);
    if (el) el[prop] = val;
  }

  // ── COMPONENT: Pricing Card ───────────────────────────────
  function _renderPlanCard(plan) {
    var badge = plan.badge
      ? '<div class="vpp-plan-badge">' + plan.badge + '</div>'
      : '';
    var featureList = plan.features.map(function (f) {
      return '<li class="vpp-plan-feature' + (f.included ? '' : ' vpp-plan-feature--off') + '">' +
        '<span class="vpp-plan-feature__dot' + (f.included ? '' : ' vpp-plan-feature__dot--off') + '" aria-hidden="true">' +
        (f.included ? '✓' : '–') + '</span>' + f.text + '</li>';
    }).join('');
    var ctaClass = plan.highlighted
      ? 'vpp-plan-cta vpp-plan-cta--highlight'
      : 'vpp-plan-cta vpp-plan-cta--secondary';
    return '<div class="vpp-plan-card' + (plan.highlighted ? ' vpp-plan-card--highlight' : '') + '">' +
      badge +
      '<div class="vpp-plan-name">' + plan.name + '</div>' +
      '<div class="vpp-plan-price">' +
        '<span class="vpp-plan-price__sign">$</span>' +
        '<span class="vpp-plan-price__num">' + plan.price + '</span>' +
        '<span class="vpp-plan-price__mo">/month</span>' +
      '</div>' +
      '<p class="vpp-plan-desc">' + plan.description + '</p>' +
      '<hr class="vpp-plan-rule" aria-hidden="true">' +
      '<ul class="vpp-plan-features" aria-label="' + plan.name + '">' + featureList + '</ul>' +
      '<a href="/vendor-subscription" class="' + ctaClass + '">' + L.page.planCta + '</a>' +
      '<p class="vpp-plan-fine">' + L.page.planFine + '</p>' +
      '</div>';
  }

  // ── COMPONENT: ROI Card ───────────────────────────────────
  function _renderROICard(item) {
    return '<div class="vpp-roi-card' + (item.highlight ? ' vpp-roi-card--highlight' : '') + '">' +
      '<span class="vpp-roi-card__icon" aria-hidden="true">' + item.icon + '</span>' +
      '<div class="vpp-roi-card__label">' + item.label + '</div>' +
      '<div class="vpp-roi-card__value">' + item.value + '</div>' +
      '<p class="vpp-roi-card__desc">' + item.desc + '</p>' +
      '</div>';
  }

  // ── COMPONENT: Benefit Card ───────────────────────────────
  function _renderBenefitCard(b) {
    return '<div class="vpp-benefit-card">' +
      '<div class="vpp-benefit-card__icon" aria-hidden="true">' + b.icon + '</div>' +
      '<div class="vpp-benefit-card__title">' + b.title + '</div>' +
      '<p class="vpp-benefit-card__desc">' + b.desc + '</p>' +
      '</div>';
  }

  // ── COMPONENT: Use-Case Card ──────────────────────────────
  function _renderUseCaseCard(uc) {
    var tags = uc.tags.map(function (t) {
      return '<span class="vpp-uc-tag">' + t + '</span>';
    }).join('');
    return '<div class="vpp-uc-card">' +
      '<div class="vpp-uc-card__header">' +
        '<span class="vpp-uc-card__icon" aria-hidden="true">' + uc.icon + '</span>' +
        '<div>' +
          '<div class="vpp-uc-card__type">' + uc.type + '</div>' +
          '<div class="vpp-uc-card__title">' + uc.title + '</div>' +
        '</div>' +
      '</div>' +
      '<p class="vpp-uc-card__body">' + uc.body + '</p>' +
      '<div class="vpp-uc-card__tags">' + tags + '</div>' +
      '</div>';
  }

  // ── Mount dynamic sections ────────────────────────────────
  function _mountSection(id, items, renderer) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = items.map(renderer).join('');
  }

  // ── Patch static HTML text ────────────────────────────────
  function _patchStatic() {
    var p = L.page;
    _set('vpp-nav-cta',           'textContent', p.navCta);
    _set('vpp-hero-pill',         'innerHTML',   '<span class="vpp-hero__pill-dot"></span>' + p.heroPill);
    _set('vpp-hero-h1',           'innerHTML',   p.heroH1);
    _set('vpp-hero-sub',          'textContent', p.heroSub);
    _set('vpp-hero-cta-primary',  'textContent', p.heroCtaPrimary);
    _set('vpp-hero-cta-secondary','textContent', p.heroCtaSecondary);
    _set('vpp-hero-trust',        'innerHTML',   p.heroTrust);
    _set('vpp-pricing-eyebrow',   'textContent', p.pricingEyebrow);
    _set('pricing-title',         'textContent', p.pricingTitle);
    _set('vpp-pricing-sub',       'textContent', p.pricingSub);
    _set('vpp-roi-eyebrow',       'textContent', p.roiEyebrow);
    _set('roi-title',             'textContent', p.roiTitle);
    _set('vpp-roi-sub',           'textContent', p.roiSub);
    _set('vpp-roi-quote',         'textContent', p.roiQuote);
    _set('vpp-benefits-eyebrow',  'textContent', p.benefitsEyebrow);
    _set('benefits-title',        'textContent', p.benefitsTitle);
    _set('vpp-benefits-sub',      'textContent', p.benefitsSub);
    _set('vpp-usecases-eyebrow',  'textContent', p.usecasesEyebrow);
    _set('usecases-title',        'textContent', p.usecasesTitle);
    _set('vpp-usecases-sub',      'textContent', p.usecasesSub);
    _set('vpp-cta-eyebrow',       'textContent', p.ctaEyebrow);
    _set('final-cta-title',       'innerHTML',   p.ctaTitle);
    _set('vpp-cta-sub',           'textContent', p.ctaSub);
    _set('vpp-cta-btn',           'textContent', p.ctaBtn);
    _set('vpp-cta-trust',         'innerHTML',   p.ctaTrust);
    _set('vpp-sticky-from',       'innerHTML',   p.stickyFrom);
    _set('vpp-sticky-btn',        'textContent', p.stickyBtn);
    _set('vpp-footer-tag',        'textContent', p.footerTag);
  }

  // ── Nav scroll behavior ───────────────────────────────────
  function _initNavScroll() {
    var nav      = document.getElementById('vpp-nav');
    var sentinel = document.getElementById('vpp-hero-sentinel');
    if (!nav || !sentinel) return;
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('vpp-nav--scrolled', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }

  // ── Sticky bar behavior ───────────────────────────────────
  function _initStickyBar() {
    var bar  = document.getElementById('vpp-sticky');
    var hero = document.querySelector('.vpp-hero');
    if (!bar || !hero) return;
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('vpp-sticky--visible', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

  // ── Init ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    _patchStatic();
    _mountSection('vpp-cards',    L.plans,    _renderPlanCard);
    _mountSection('vpp-roi',      L.roi,      _renderROICard);
    _mountSection('vpp-benefits', L.benefits, _renderBenefitCard);
    _mountSection('vpp-usecases', L.useCases, _renderUseCaseCard);
    _initNavScroll();
    _initStickyBar();
  });

}());
