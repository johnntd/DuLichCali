// ============================================================
// VENDOR SUBSCRIPTION PAGE — vendor-subscription.js
//
// Renders plan selection cards and handles plan-choice flow.
// No payment processing — shows a "contact us to activate"
// confirmation when a vendor selects a plan.
// ============================================================

(function () {
  'use strict';

  // ── Plan data ─────────────────────────────────────────────
  // Kept in sync with VENDOR_PRICING_DATA.plans in vendor-pricing-page.js.
  // Update both files if plan names / prices change.
  var PLANS = [
    {
      id:          'starter',
      name:        'Starter',
      price:       39,
      description: 'Perfect for new vendors ready to stop missing customers.',
      badge:       null,
      highlighted: false,
      features: [
        { text: 'AI receptionist (24/7)',          included: true  },
        { text: 'Booking system',                  included: true  },
        { text: 'Marketplace listing',             included: true  },
        { text: 'Basic notifications',             included: true  },
        { text: 'Smart scheduling',                included: false },
        { text: 'Multi-language AI (VI/EN/ES)',    included: false },
        { text: 'AI upselling',                    included: false },
        { text: 'Analytics dashboard',             included: false },
      ],
    },
    {
      id:          'growth',
      name:        'Growth',
      price:       79,
      description: 'For established vendors serious about growth. Most businesses start here.',
      badge:       'Most Popular',
      highlighted: true,
      features: [
        { text: 'Everything in Starter',           included: true  },
        { text: 'Smart scheduling',                included: true  },
        { text: 'No double-booking logic',         included: true  },
        { text: 'Multi-language AI (VI/EN/ES)',    included: true  },
        { text: 'AI upselling',                    included: true  },
        { text: 'Priority support',                included: true  },
        { text: 'Analytics dashboard',             included: false },
        { text: 'Customer follow-ups',             included: false },
      ],
    },
    {
      id:          'pro',
      name:        'Pro',
      price:       129,
      description: 'Full power for high-volume businesses that want every advantage.',
      badge:       null,
      highlighted: false,
      features: [
        { text: 'Everything in Growth',            included: true  },
        { text: 'Analytics dashboard',             included: true  },
        { text: 'Customer follow-ups',             included: true  },
        { text: 'Advanced business tools',         included: true  },
        { text: 'Premium support',                 included: true  },
        { text: 'Custom AI training',              included: true  },
        { text: 'White-glove onboarding',          included: true  },
        { text: 'Dedicated account manager',       included: true  },
      ],
    },
  ];

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
          'Choose This Plan' +
        '</button>' +
        '<p class="vpp-plan-fine">No setup fee &middot; Cancel anytime</p>' +
      '</div>'
    );
  }

  // ── Plan selection ────────────────────────────────────────
  function select(planId) {
    var valid = false;
    for (var i = 0; i < PLANS.length; i++) {
      if (PLANS[i].id === planId) { valid = true; break; }
    }
    if (!valid) return;
    // Redirect vendor to the self-serve onboarding wizard with plan pre-selected.
    // The wizard collects business info, calls AI generation, and saves a draft
    // for admin review — no "call us" dead-end.
    window.location.href = '/vendor-signup?plan=' + encodeURIComponent(planId);
  }

  function dismiss() {
    var overlay = document.getElementById('vsub-confirm');
    if (overlay) overlay.style.display = 'none';
  }

  // Close overlay on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') dismiss();
  });

  // ── Mount ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('vsub-cards');
    if (el) el.innerHTML = PLANS.map(_renderCard).join('');
  });

  // ── Public API ────────────────────────────────────────────
  window.vsub = { select: select, dismiss: dismiss };

}());
