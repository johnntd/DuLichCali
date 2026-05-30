'use strict';

// Mobile Barber — shared full-screen image lightbox.
//
// Page-agnostic so the SAME lightbox serves the customer landing AND the
// vendor dashboard. Callers pass their own translated strings (caption / hint /
// closeLabel / ariaLabel) so it stays multilingual (vi/en/es) without owning an
// i18n table. Uses MBIcons for the close glyph when available, with an inline
// fallback. Closes on backdrop tap, the X button, or Escape; locks background
// scroll and restores focus to the trigger.
//
// API:
//   MBLightbox.open(src, { caption, hint, closeLabel, ariaLabel, returnFocus })
//   MBLightbox.close()

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MBLightbox = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {

  var OVERLAY_ID = 'mbImageLightbox';
  var _prevOverflow = '';
  var _returnFocus = null;

  function _onKeydown(e) { if (e.key === 'Escape' || e.keyCode === 27) close(); }

  function close() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById(OVERLAY_ID);
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    document.removeEventListener('keydown', _onKeydown);
    try { document.body.style.overflow = _prevOverflow || ''; } catch (e) {}
    if (_returnFocus && _returnFocus.focus) { try { _returnFocus.focus(); } catch (e) {} }
    _returnFocus = null;
  }

  function _xMarkup() {
    var I = (typeof window !== 'undefined') && window.MBIcons;
    if (I && I.markup) { var m = I.markup('x'); if (m) return m; }
    return '<svg class="mb-ico-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  }

  function open(src, opts) {
    if (!src || typeof document === 'undefined') return;
    opts = opts || {};
    close(); // single instance

    _returnFocus = opts.returnFocus || null;

    var overlay = document.createElement('div');
    overlay.className = 'mb-lightbox';
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', opts.ariaLabel || opts.caption || 'Enlarged image');

    var inner = document.createElement('div');
    inner.className = 'mb-lightbox__inner';

    var img = document.createElement('img');
    img.className = 'mb-lightbox__img';
    img.src = src;
    img.alt = opts.caption || '';
    inner.appendChild(img);

    if (opts.caption) {
      var cap = document.createElement('p');
      cap.className = 'mb-lightbox__caption';
      cap.textContent = opts.caption;
      inner.appendChild(cap);
    }
    if (opts.hint) {
      var hint = document.createElement('p');
      hint.className = 'mb-lightbox__hint';
      hint.textContent = opts.hint;
      inner.appendChild(hint);
    }

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'mb-lightbox__close mb-ico';
    closeBtn.setAttribute('aria-label', opts.closeLabel || 'Close');
    closeBtn.innerHTML = _xMarkup();
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); close(); });

    overlay.appendChild(inner);
    overlay.appendChild(closeBtn);
    // Backdrop / non-image area closes.
    overlay.addEventListener('click', function (e) { if (e.target === overlay || e.target === inner) close(); });

    try { _prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; } catch (e) {}
    document.body.appendChild(overlay);
    document.addEventListener('keydown', _onKeydown);

    var raf = (typeof window !== 'undefined' && window.requestAnimationFrame) || function (f) { return f(); };
    raf(function () {
      overlay.classList.add('mb-lightbox--open');
      try { closeBtn.focus({ preventScroll: true }); } catch (e) {}
    });
  }

  return { open: open, close: close };
});
