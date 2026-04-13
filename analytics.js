// analytics.js — DuLichCali Analytics (GA4 wrapper)
// Measurement ID: G-5S0P4XMCJR
(function () {
  'use strict';

  window.DLCAnalytics = {
    // Track a custom event. Silently no-ops if GA4 hasn't loaded yet.
    track: function (eventName, params) {
      try {
        if (typeof gtag === 'function') {
          gtag('event', eventName, params || {});
        }
      } catch (e) {}
    },

    // Convenience: track a phone number click
    phoneClick: function (location) {
      this.track('phone_clicked', { event_category: 'contact', location: location || 'unknown' });
    },

    // Convenience: track a CTA button click
    ctaClick: function (label, page, section) {
      this.track('cta_clicked', { cta_label: label || '', page: page || '', section: section || '' });
    }
  };
})();
