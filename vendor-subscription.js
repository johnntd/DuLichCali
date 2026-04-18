// ============================================================
// VENDOR SUBSCRIPTION PAGE — vendor-subscription.js
//
// Renders plan selection cards and handles plan-choice flow.
// Clicking a plan redirects to the vendor self-serve onboarding
// wizard at /vendor-signup?plan={id}. No overlay, no "call us".
// ============================================================

(function () {
  'use strict';

  // ── Language ──────────────────────────────────────────────
  var _lang = 'en';
  try {
    var _stored = localStorage.getItem('dlcLang');
    if (_stored && ['en','vi','es'].indexOf(_stored) !== -1) _lang = _stored;
  } catch(e) {}

  // ── i18n strings ──────────────────────────────────────────
  var T = {
    en: {
      eyebrow:      'Platform Plans',
      h1:           'Choose Your Plan',
      sub:          'Subscribe to the plan that fits your business. Start with Starter and upgrade anytime — no lock-in, cancel anytime.',
      availPlans:   'Available plans',
      howTitle:     'How It Works',
      howBody:      'Click a plan to start your <strong style="color:var(--gold-lt)">AI-powered setup wizard</strong>. Tell us about your business — our AI builds your page in minutes. We review it and you\'re <strong style="color:var(--gold-lt)">live within 24 hours</strong>. No payment collected until your page is approved. Questions? Call <a href="tel:+14089163439" style="color:var(--gold-lt)">(408) 916-3439</a>.',
      choosePlan:   'Choose This Plan',
      noSetup:      'No setup fee · Cancel anytime',
      mostPopular:  'Most Popular',
      plans: [
        {
          id:          'starter',
          name:        'Starter',
          price:       99,
          description: 'App-based booking and notifications. Everything you need to get started.',
          badge:       null,
          highlighted: false,
          features: [
            { text: 'AI receptionist (24/7)',          included: true  },
            { text: 'Online booking system',           included: true  },
            { text: 'In-app notifications',            included: true  },
            { text: 'Marketplace listing',             included: true  },
            { text: 'Multi-language AI (VI/EN/ES)',    included: true  },
            { text: 'Smart scheduling',                included: true  },
            { text: 'SMS reminders & confirmations',   included: false },
            { text: 'AI phone receptionist',           included: false },
          ],
        },
        {
          id:          'growth',
          name:        'Growth',
          price:       199,
          description: 'Adds SMS so customers get reminders and confirmations by text. Most popular.',
          badge:       'Most Popular',
          highlighted: true,
          features: [
            { text: 'Everything in Starter',           included: true  },
            { text: 'SMS appointment reminders',       included: true  },
            { text: 'SMS booking confirmations',       included: true  },
            { text: 'No double-booking logic',         included: true  },
            { text: 'AI upselling',                    included: true  },
            { text: 'Priority support',                included: true  },
            { text: 'Analytics dashboard',             included: true  },
            { text: 'AI phone receptionist',           included: false },
          ],
        },
        {
          id:          'pro',
          name:        'Pro',
          price:       299,
          description: 'Adds a 24/7 AI phone receptionist that answers calls and takes bookings for you.',
          badge:       null,
          highlighted: false,
          features: [
            { text: 'Everything in Growth',            included: true  },
            { text: 'AI phone receptionist (24/7)',    included: true  },
            { text: 'Answers & books by phone',        included: true  },
            { text: 'Customer follow-up calls',        included: true  },
            { text: 'Custom AI voice training',        included: true  },
            { text: 'White-glove onboarding',          included: true  },
            { text: 'Dedicated account manager',       included: true  },
            { text: 'Advanced analytics',              included: true  },
          ],
        },
      ],
    },

    vi: {
      eyebrow:      'Gói Dịch Vụ',
      h1:           'Chọn Gói Của Bạn',
      sub:          'Đăng ký gói phù hợp với doanh nghiệp của bạn. Bắt đầu với Khởi Đầu và nâng cấp bất cứ lúc nào — không ràng buộc, hủy bất cứ lúc nào.',
      availPlans:   'Các gói có sẵn',
      howTitle:     'Cách Thức Hoạt Động',
      howBody:      'Chọn một gói để bắt đầu <strong style="color:var(--gold-lt)">trình hướng dẫn AI</strong>. Cho chúng tôi biết về doanh nghiệp của bạn — AI sẽ xây dựng trang của bạn trong vài phút. Chúng tôi xem xét và bạn <strong style="color:var(--gold-lt)">ra mắt trong 24 giờ</strong>. Không thu tiền cho đến khi trang được duyệt. Liên hệ: <a href="tel:+14089163439" style="color:var(--gold-lt)">(408) 916-3439</a>.',
      choosePlan:   'Chọn Gói Này',
      noSetup:      'Không phí cài đặt · Hủy bất cứ lúc nào',
      mostPopular:  'Phổ Biến Nhất',
      plans: [
        {
          id:          'starter',
          name:        'Khởi Đầu',
          price:       99,
          description: 'Đặt lịch và thông báo qua ứng dụng. Tất cả những gì bạn cần để bắt đầu.',
          badge:       null,
          highlighted: false,
          features: [
            { text: 'Lễ tân AI (24/7)',                    included: true  },
            { text: 'Hệ thống đặt lịch trực tuyến',       included: true  },
            { text: 'Thông báo trong ứng dụng',            included: true  },
            { text: 'Niêm yết trên Marketplace',           included: true  },
            { text: 'AI đa ngôn ngữ (VI/EN/ES)',           included: true  },
            { text: 'Lên lịch thông minh',                 included: true  },
            { text: 'Nhắc nhở & xác nhận qua SMS',         included: false },
            { text: 'Lễ tân AI qua điện thoại',            included: false },
          ],
        },
        {
          id:          'growth',
          name:        'Tăng Trưởng',
          price:       199,
          description: 'Thêm SMS để khách hàng nhận nhắc nhở và xác nhận qua tin nhắn. Phổ biến nhất.',
          badge:       'Phổ Biến Nhất',
          highlighted: true,
          features: [
            { text: 'Tất cả tính năng Khởi Đầu',           included: true  },
            { text: 'Nhắc lịch hẹn qua SMS',               included: true  },
            { text: 'Xác nhận đặt lịch qua SMS',           included: true  },
            { text: 'Tự động tránh đặt trùng lịch',        included: true  },
            { text: 'AI upselling tự động',                 included: true  },
            { text: 'Hỗ trợ ưu tiên',                      included: true  },
            { text: 'Bảng phân tích dữ liệu',              included: true  },
            { text: 'Lễ tân AI qua điện thoại',            included: false },
          ],
        },
        {
          id:          'pro',
          name:        'Chuyên Nghiệp',
          price:       299,
          description: 'Thêm lễ tân AI 24/7 qua điện thoại — tự động nghe máy và đặt lịch cho bạn.',
          badge:       null,
          highlighted: false,
          features: [
            { text: 'Tất cả tính năng Tăng Trưởng',        included: true  },
            { text: 'Lễ tân AI qua điện thoại (24/7)',      included: true  },
            { text: 'Nghe máy & đặt lịch tự động',         included: true  },
            { text: 'Gọi theo dõi khách hàng',             included: true  },
            { text: 'Huấn luyện giọng AI riêng',           included: true  },
            { text: 'Hỗ trợ onboarding tận tay',           included: true  },
            { text: 'Quản lý tài khoản chuyên biệt',       included: true  },
            { text: 'Phân tích nâng cao',                  included: true  },
          ],
        },
      ],
    },

    es: {
      eyebrow:      'Planes de Plataforma',
      h1:           'Elige Tu Plan',
      sub:          'Suscríbete al plan que se adapta a tu negocio. Empieza con Básico y actualiza cuando quieras — sin compromiso, cancela cuando quieras.',
      availPlans:   'Planes disponibles',
      howTitle:     'Cómo Funciona',
      howBody:      'Elige un plan para iniciar tu <strong style="color:var(--gold-lt)">asistente de configuración AI</strong>. Cuéntanos sobre tu negocio — nuestra AI crea tu página en minutos. La revisamos y estás <strong style="color:var(--gold-lt)">en línea en 24 horas</strong>. Sin cobro hasta que tu página sea aprobada. ¿Preguntas? Llama al <a href="tel:+14089163439" style="color:var(--gold-lt)">(408) 916-3439</a>.',
      choosePlan:   'Elegir Este Plan',
      noSetup:      'Sin tarifa de configuración · Cancela cuando quieras',
      mostPopular:  'Más Popular',
      plans: [
        {
          id:          'starter',
          name:        'Básico',
          price:       99,
          description: 'Reservas y notificaciones por app. Todo lo que necesitas para empezar.',
          badge:       null,
          highlighted: false,
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
          id:          'growth',
          name:        'Crecimiento',
          price:       199,
          description: 'Agrega SMS para que los clientes reciban recordatorios y confirmaciones. El más popular.',
          badge:       'Más Popular',
          highlighted: true,
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
          id:          'pro',
          name:        'Profesional',
          price:       299,
          description: 'Agrega un recepcionista AI 24/7 por teléfono que contesta llamadas y hace reservas.',
          badge:       null,
          highlighted: false,
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
    },
  };

  // ── Active locale ─────────────────────────────────────────
  var LOCALE = T[_lang] || T['en'];

  // ── Card renderer ─────────────────────────────────────────
  function _renderCard(plan) {
    var badge = plan.badge
      ? '<div class="vpp-plan-badge">' + plan.badge + '</div>'
      : '';

    var featureList = plan.features.map(function (f) {
      return (
        '<li class="vpp-plan-feature' + (f.included ? '' : ' vpp-plan-feature--off') + '">' +
          '<span class="vpp-plan-feature__dot' + (f.included ? '' : ' vpp-plan-feature__dot--off') + '" aria-hidden="true">' +
            (f.included ? '&#10003;' : '&ndash;') +
          '</span>' +
          f.text +
        '</li>'
      );
    }).join('');

    var ctaClass = plan.highlighted
      ? 'vpp-plan-cta vpp-plan-cta--highlight vsub-cta'
      : 'vpp-plan-cta vpp-plan-cta--secondary vsub-cta';

    return (
      '<div class="vpp-plan-card' + (plan.highlighted ? ' vpp-plan-card--highlight' : '') + '">' +
        badge +
        '<div class="vpp-plan-name">' + plan.name + '</div>' +
        '<div class="vpp-plan-price">' +
          '<span class="vpp-plan-price__sign">$</span>' +
          '<span class="vpp-plan-price__num">' + plan.price + '</span>' +
          '<span class="vpp-plan-price__mo">/month</span>' +
        '</div>' +
        '<p class="vpp-plan-desc">' + plan.description + '</p>' +
        '<hr class="vpp-plan-rule" aria-hidden="true">' +
        '<ul class="vpp-plan-features" aria-label="Features included in ' + plan.name + ' plan">' +
          featureList +
        '</ul>' +
        '<button class="' + ctaClass + '" onclick="vsub.select(\'' + plan.id + '\')">' +
          LOCALE.choosePlan +
        '</button>' +
        '<p class="vpp-plan-fine">' + LOCALE.noSetup + '</p>' +
      '</div>'
    );
  }

  // ── Plan selection ────────────────────────────────────────
  function select(planId) {
    var valid = false;
    for (var i = 0; i < LOCALE.plans.length; i++) {
      if (LOCALE.plans[i].id === planId) { valid = true; break; }
    }
    if (!valid) return;
    window.location.href = '/vendor-signup?plan=' + encodeURIComponent(planId);
  }

  // ── Mount ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // Patch static page text
    var patches = {
      'vsub-eyebrow':      { prop: 'textContent', val: LOCALE.eyebrow    },
      'vsub-h1':           { prop: 'textContent', val: LOCALE.h1         },
      'vsub-sub':          { prop: 'textContent', val: LOCALE.sub        },
      'vsub-plans-label':  { prop: 'textContent', val: LOCALE.availPlans },
      'vsub-plans-visible':{ prop: 'textContent', val: LOCALE.availPlans },
      'vsub-notice-title': { prop: 'textContent', val: LOCALE.howTitle   },
      'vsub-notice-body':  { prop: 'innerHTML',   val: LOCALE.howBody    },
    };
    Object.keys(patches).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el[patches[id].prop] = patches[id].val;
    });

    // Render plan cards
    var cards = document.getElementById('vsub-cards');
    if (cards) cards.innerHTML = LOCALE.plans.map(_renderCard).join('');
  });

  // ── Public API ────────────────────────────────────────────
  window.vsub = { select: select };

}());
