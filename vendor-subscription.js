// ============================================================
// VENDOR SUBSCRIPTION PAGE — vendor-subscription.js
//
// Renders plan selection cards and handles plan-choice flow.
// Clicking a plan redirects to the vendor self-serve onboarding
// wizard at /vendor-signup?plan={id}. No overlay, no "call us".
// ============================================================

(function () {
  'use strict';

  // ── Plan data ─────────────────────────────────────────────
  // Prices: Starter $99 / Growth $199 / Pro $299
  // Tier differentiator: notification channel
  //   Starter  — app booking + in-app notifications only
  //   Growth   — adds SMS (reminders + confirmations)
  //   Pro      — adds AI phone receptionist (answers calls 24/7)
  var PLANS = [
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

  // ── Mount ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('vsub-cards');
    if (el) el.innerHTML = PLANS.map(_renderCard).join('');
  });

  // ── Public API ────────────────────────────────────────────
  window.vsub = { select: select };

}());
