/* security-alerts.js — client-side security event logger (defense-in-depth).
 *
 * Records suspicious events to the `securityAlerts` Firestore collection so an
 * admin/owner can review them. This is a MONITORING aid, NOT a security
 * boundary — Firestore rules + the server enforce real security. Logging is
 * best-effort and never throws into the calling flow.
 *
 *   SecurityAlerts.log({ severity, type, message, route, vendorId, ownerId, userId, metadata })
 *   SecurityAlerts.looksLikeXss(value)        -> bool
 *   SecurityAlerts.scanInput(value, ctx)      -> bool (logs xss alert if suspicious)
 *   SecurityAlerts.guardProtectedFields(obj, ctx) -> bool (logs if protected booking fields present)
 */
(function (root) {
  'use strict';
  var COLLECTION = 'securityAlerts';
  var SEVERITIES = ['critical', 'high', 'medium', 'low'];
  var TYPES = [
    'secret_exposure_suspected', 'unauthorized_portal_access', 'permission_denied_spike',
    'failed_vendor_login', 'booking_spam', 'protected_field_modify', 'xss_payload_detected',
    'suspicious_admin_route', 'vendor_owner_mismatch', 'ai_prompt_injection',
    'storage_upload_rejected', 'device_booking_flood'
  ];
  // Booking fields a customer must never set/modify (mirrors the Firestore rules).
  var PROTECTED_BOOKING_FIELDS = [
    'status', 'paymentStatus', 'servicePrice', 'travelFee', 'amountDue', 'totalPrice',
    'discountPercent', 'originalPrice', 'discountedPrice', 'promoApplied', 'promotionId',
    'vendorId', 'ownerId', 'assignedBarberId'
  ];

  function _db() {
    try { return (root.firebase && root.firebase.firestore) ? root.firebase.firestore() : null; }
    catch (e) { return null; }
  }
  function _str(v, max) { return String(v == null ? '' : v).slice(0, max || 200); }
  function _uid() { try { return (root.firebase && root.firebase.auth && root.firebase.auth().currentUser && root.firebase.auth().currentUser.uid) || ''; } catch (e) { return ''; } }
  function _nowIso() { try { return new Date().toISOString(); } catch (e) { return ''; } }

  function log(alert) {
    alert = alert || {};
    var db = _db();
    var doc = {
      severity: SEVERITIES.indexOf(alert.severity) >= 0 ? alert.severity : 'low',
      type: _str(alert.type || 'unknown', 80),
      message: _str(alert.message || '', 1000),
      route: _str(alert.route || (root.location && root.location.pathname) || '', 200),
      userId: _str(alert.userId || _uid(), 128),
      vendorId: _str(alert.vendorId || '', 128),
      ownerId: _str(alert.ownerId || '', 128),
      userAgent: _str((root.navigator && root.navigator.userAgent) || '', 300),
      metadata: alert.metadata ? _str(JSON.stringify(alert.metadata), 1000) : '',
      resolved: false,
      createdAt: _nowIso()
    };
    if (root.console && root.console.warn) root.console.warn('[security-alert]', doc.severity, doc.type, '-', doc.message);
    if (!db) return Promise.resolve(null);
    return db.collection(COLLECTION).add(doc).catch(function (e) {
      if (root.console) root.console.warn('[security-alerts] could not record alert:', e && e.message);
      return null;
    });
  }

  function looksLikeXss(value) {
    var s = String(value == null ? '' : value);
    return /<\s*script\b|on(?:error|load|click|mouseover)\s*=|javascript:\s*[^/\s]|<\s*img[^>]*\bon\w+\s*=|<\s*svg[^>]*\bon\w+\s*=|<\s*iframe\b|<\s*svg[^>]*onload|"\s*>\s*<\s*script/i.test(s);
  }

  function scanInput(value, ctx) {
    ctx = ctx || {};
    if (!looksLikeXss(value)) return false;
    log({
      severity: 'high', type: 'xss_payload_detected',
      message: 'XSS-looking input detected and treated as text',
      route: ctx.route, vendorId: ctx.vendorId, ownerId: ctx.ownerId,
      metadata: { field: ctx.field || '', sample: String(value).slice(0, 100) }
    });
    return true;
  }

  function guardProtectedFields(obj, ctx) {
    ctx = ctx || {};
    if (!obj || typeof obj !== 'object') return false;
    var hit = PROTECTED_BOOKING_FIELDS.filter(function (f) { return Object.prototype.hasOwnProperty.call(obj, f); });
    if (!hit.length) return false;
    log({
      severity: 'high', type: 'protected_field_modify',
      message: 'Client attempted to set protected booking field(s): ' + hit.join(', '),
      route: ctx.route, vendorId: ctx.vendorId, ownerId: ctx.ownerId,
      metadata: { fields: hit }
    });
    return true;
  }

  function guardVendorOwnerMismatch(expectedVendorId, actualVendorId, ctx) {
    ctx = ctx || {};
    if (!expectedVendorId || !actualVendorId || expectedVendorId === actualVendorId) return false;
    log({
      severity: 'medium', type: 'vendor_owner_mismatch',
      message: 'vendorId mismatch: expected ' + expectedVendorId + ' got ' + actualVendorId,
      route: ctx.route, vendorId: actualVendorId, metadata: { expected: expectedVendorId, actual: actualVendorId }
    });
    return true;
  }

  root.SecurityAlerts = {
    log: log, looksLikeXss: looksLikeXss, scanInput: scanInput,
    guardProtectedFields: guardProtectedFields, guardVendorOwnerMismatch: guardVendorOwnerMismatch,
    SEVERITIES: SEVERITIES, TYPES: TYPES, COLLECTION: COLLECTION, PROTECTED_BOOKING_FIELDS: PROTECTED_BOOKING_FIELDS
  };
})(typeof window !== 'undefined' ? window : this);
