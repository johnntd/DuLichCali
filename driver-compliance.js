// driver-compliance.js — DuLichCali Driver Compliance Utilities
// Loaded by: driver-admin.html (driver document submission) and admin.html (admin review)
// Provides shared status computation, expiration tracking, and label helpers.
//
// Data model — driver_compliance/{driverId}:
//   license:      { legalName, number, expirationDate, fileFrontUrl, fileBackUrl,
//                   status, rejectionReason, reviewedAt, reviewedBy,
//                   verificationSource, verificationStatus,         ← future DMV hooks
//                   verificationReference, verificationCheckedAt }
//   registration: { plate, vin, vehicleMake, vehicleModel, vehicleYear,
//                   expirationDate, fileUrl, status, rejectionReason,
//                   reviewedAt, reviewedBy }
//   insurance:    { insurer, policyNumber, namedInsured, coveredVehicle,
//                   expirationDate, fileUrl, status, rejectionReason,
//                   reviewedAt, reviewedBy }
//   overallStatus:       'pending_documents'|'pending_review'|'approved'|'rejected'|'expired'
//   complianceNotes:     string  (admin internal note)
//   lastReviewAt:        Timestamp
//   lastReviewBy:        string
//   nextRequiredAction:  string
//   expirationWarning:   null|'expiring_soon_30'|'expiring_soon_14'|'expiring_soon_7'
//   updatedAt:           Timestamp
//
// Mirror fields on drivers/{driverId} (for availability queries without joins):
//   complianceStatus:  mirrors overallStatus
//   licExpiry:         mirrors license.expirationDate
//   regExpiry:         mirrors registration.expirationDate
//   insExpiry:         mirrors insurance.expirationDate

var DLCCompliance = (function () {
  'use strict';

  var DOC_KEYS = ['license', 'registration', 'insurance'];

  // ── Status Computation ────────────────────────────────────────────────────

  // Compute overall compliance status from per-document sub-statuses + expiry dates.
  // Priority: expired > rejected > pending_review > pending_documents > approved
  function computeOverall(comp) {
    var today = todayStr();
    var c = comp || {};

    // Any approved doc whose expiry date has already passed → expired
    for (var i = 0; i < DOC_KEYS.length; i++) {
      var d = c[DOC_KEYS[i]] || {};
      if (d.status === 'approved' && d.expirationDate && d.expirationDate < today) {
        return 'expired';
      }
    }

    // Any doc explicitly rejected by admin → rejected
    for (var i = 0; i < DOC_KEYS.length; i++) {
      if ((c[DOC_KEYS[i]] || {}).status === 'rejected') return 'rejected';
    }

    // All three docs approved (and not expired) → fully compliant
    if (DOC_KEYS.every(function (k) { return (c[k] || {}).status === 'approved'; })) {
      return 'approved';
    }

    // All docs submitted (pending or approved) but not all approved → waiting for admin
    if (DOC_KEYS.every(function (k) {
      var s = (c[k] || {}).status;
      return s === 'pending' || s === 'approved';
    })) {
      return 'pending_review';
    }

    // At least one doc has not been submitted yet
    return 'pending_documents';
  }

  // Compute expiration warning based on the soonest-expiring approved document.
  function computeExpirationWarning(comp) {
    var today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    var minDays = null;

    DOC_KEYS.forEach(function (k) {
      var d = ((comp || {})[k]) || {};
      if (!d.expirationDate || d.status !== 'approved') return;
      var days = Math.floor((new Date(d.expirationDate) - today0) / 86400000);
      if (days >= 0 && (minDays === null || days < minDays)) minDays = days;
    });

    if (minDays === null) return null;
    if (minDays <= 7)  return 'expiring_soon_7';
    if (minDays <= 14) return 'expiring_soon_14';
    if (minDays <= 30) return 'expiring_soon_30';
    return null;
  }

  // ── Date Helpers ──────────────────────────────────────────────────────────

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  // Days until expiration date string (YYYY-MM-DD). Negative = already expired.
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    return Math.floor((new Date(dateStr) - today0) / 86400000);
  }

  function formatDays(days) {
    if (days === null || days === undefined) return '—';
    if (days < 0)   return Math.abs(days) + ' ngày đã qua';
    if (days === 0) return 'Hôm nay';
    return days + ' ngày còn lại';
  }

  // ── Labels & CSS Classes ──────────────────────────────────────────────────

  function overallLabel(s) {
    return ({
      pending_documents: 'Thiếu Tài Liệu',
      pending_review:    'Chờ Duyệt',
      approved:          'Đã Duyệt',
      rejected:          'Bị Từ Chối',
      expired:           'Hết Hạn'
    })[s] || 'Chưa Nộp';
  }

  function docLabel(s) {
    return ({
      not_submitted: 'Chưa Nộp',
      pending:       'Chờ Duyệt',
      approved:      'Đã Duyệt',
      rejected:      'Bị Từ Chối'
    })[s] || 'Chưa Nộp';
  }

  // CSS modifier class for status badge elements
  function overallClass(s) {
    return ({
      approved:          'comp-ok',
      pending_review:    'comp-pending',
      pending_documents: 'comp-missing',
      rejected:          'comp-rejected',
      expired:           'comp-expired'
    })[s] || 'comp-missing';
  }

  function docClass(s) {
    return ({
      approved:      'comp-ok',
      pending:       'comp-pending',
      not_submitted: 'comp-missing',
      rejected:      'comp-rejected'
    })[s] || 'comp-missing';
  }

  // ── Compliance Gate ───────────────────────────────────────────────────────

  // Only approved drivers can appear in ride availability.
  // This is the single source of truth for the compliance gate.
  function isCompliant(complianceStatus) {
    return complianceStatus === 'approved';
  }

  // ── Blank Compliance Document ─────────────────────────────────────────────

  // Returns a fresh blank compliance doc for a new driver.
  function blankDoc(driverId) {
    return {
      driverId: driverId || null,
      license: {
        status:        'not_submitted',
        legalName:     '',
        number:        '',
        expirationDate:'',
        fileFrontUrl:  '',
        fileBackUrl:   '',
        rejectionReason: '',
        reviewedAt:    null,
        reviewedBy:    null,
        // ── Future verification hooks (DMV, identity verification vendors) ──
        verificationSource:     null,  // e.g. 'checkr', 'aamva'
        verificationStatus:     null,  // e.g. 'verified', 'failed', 'pending'
        verificationReference:  null,  // external reference ID
        verificationCheckedAt:  null   // Timestamp of last verification check
      },
      registration: {
        status:        'not_submitted',
        plate:         '',
        vin:           '',
        vehicleMake:   '',
        vehicleModel:  '',
        vehicleYear:   '',
        expirationDate:'',
        fileUrl:       '',
        rejectionReason: '',
        reviewedAt:    null,
        reviewedBy:    null
      },
      insurance: {
        status:        'not_submitted',
        insurer:       '',
        policyNumber:  '',
        namedInsured:  '',
        coveredVehicle:'',
        expirationDate:'',
        fileUrl:       '',
        rejectionReason: '',
        reviewedAt:    null,
        reviewedBy:    null
      },
      overallStatus:       'pending_documents',
      complianceNotes:     '',
      lastReviewAt:        null,
      lastReviewBy:        null,
      nextRequiredAction:  'Driver must submit all required compliance documents.',
      expirationWarning:   null,
      updatedAt:           null
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    DOC_KEYS:                 DOC_KEYS,
    computeOverall:           computeOverall,
    computeExpirationWarning: computeExpirationWarning,
    todayStr:                 todayStr,
    daysUntil:                daysUntil,
    formatDays:               formatDays,
    overallLabel:             overallLabel,
    docLabel:                 docLabel,
    overallClass:             overallClass,
    docClass:                 docClass,
    isCompliant:              isCompliant,
    blankDoc:                 blankDoc
  };
})();
