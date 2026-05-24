'use strict';
/*
 * Mobile Barber Phase 1 data model.
 * Additive only: this module does not modify existing vendor or booking models.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MobileBarberData = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function() {
  var COLLECTIONS = Object.freeze({
    vendors: 'mobileBarberVendors',
    services: 'mobileBarberServices',
    availability: 'mobileBarberAvailability',
    bookings: 'mobileBarberBookings',
    customers: 'mobileBarberCustomers',
    agentSessions: 'mobileBarberAgentSessions',
    portfolioImages: 'mobileBarberPortfolioImages',
    reviews: 'mobileBarberReviews'
  });

  var VENDOR_FIELDS = Object.freeze([
    'id', 'businessName', 'barberName', 'phone', 'email',
    'profilePhoto', 'heroImage', 'serviceAreas', 'travelRadiusMiles',
    'baseTravelFee', 'addressOptional', 'languages', 'active', 'rating',
    'reviewCount', 'serviceBadges', 'createdAt', 'updatedAt'
  ]);

  var SERVICE_FIELDS = Object.freeze([
    'id', 'vendorId', 'name', 'description', 'durationMinutes', 'price',
    'cleanupBufferMinutes', 'travelBufferMinutes', 'category', 'active',
    'imageUrl'
  ]);

  var BOOKING_FIELDS = Object.freeze([
    'id', 'vendorId', 'customerName', 'customerPhone', 'customerEmail',
    'serviceId', 'serviceName', 'servicePrice', 'address', 'city', 'zip',
    'requestedDate', 'startTime', 'endTime', 'status', 'source', 'notes',
    'stylePreference', 'photoUrls', 'aiConversationSummary',
    'rebookedFromBookingId', 'previousServiceName', 'customerUid',
    'createdAt', 'updatedAt'
  ]);

  var CUSTOMER_FIELDS = Object.freeze([
    'id', 'vendorId', 'customerName', 'customerPhone', 'customerPhoneNormalized',
    'customerEmail', 'customerUid', 'stylePreference', 'notes', 'photoUrls',
    'lastServiceId', 'lastServiceName', 'lastBookingId', 'createdAt', 'updatedAt'
  ]);

  var PORTFOLIO_IMAGE_FIELDS = Object.freeze([
    'id', 'vendorId', 'title', 'description', 'imageUrl', 'beforeImageUrl',
    'afterImageUrl', 'alt', 'displayOrder', 'hidden', 'createdAt', 'updatedAt'
  ]);

  var REVIEW_FIELDS = Object.freeze([
    'id', 'vendorId', 'customerName', 'rating', 'body', 'serviceName',
    'lang', 'hidden', 'vendorResponse', 'createdAt', 'updatedAt'
  ]);

  var SERVICE_BADGES = Object.freeze({
    fade: Object.freeze({ id: 'fade', labels: Object.freeze({ en: 'Fade', vi: 'Fade', es: 'Fade' }) }),
    beardTrim: Object.freeze({ id: 'beardTrim', labels: Object.freeze({ en: 'Beard trim', vi: 'Tỉa râu', es: 'Barba' }) }),
    kidsCut: Object.freeze({ id: 'kidsCut', labels: Object.freeze({ en: 'Kids cut', vi: 'Cắt tóc trẻ em', es: 'Corte para niños' }) }),
    seniorCut: Object.freeze({ id: 'seniorCut', labels: Object.freeze({ en: 'Senior cut', vi: 'Cắt tóc người lớn tuổi', es: 'Corte para mayores' }) }),
    vietnameseSpeaking: Object.freeze({ id: 'vietnameseSpeaking', labels: Object.freeze({ en: 'Vietnamese-speaking', vi: 'Nói tiếng Việt', es: 'Habla vietnamita' }) }),
    spanishSpeaking: Object.freeze({ id: 'spanishSpeaking', labels: Object.freeze({ en: 'Spanish-speaking', vi: 'Nói tiếng Tây Ban Nha', es: 'Habla español' }) })
  });

  var BOOKING_STATUSES = Object.freeze([
    'pending_confirmation',
    'confirmed',
    'vendor_review',
    'cancelled',
    'completed',
    'rescheduled'
  ]);

  var BOOKING_SOURCES = Object.freeze([
    'customer_form',
    'ai_chat',
    'ai_voice',
    'vendor_admin',
    'seed'
  ]);

  var SEED_TIMESTAMP = '2026-05-23T00:00:00.000Z';
  var SAMPLE_VENDOR_ID = 'oc-mobile-barber-demo';

  var sampleVendors = Object.freeze([
    Object.freeze({
      id: SAMPLE_VENDOR_ID,
      businessName: 'OC Mobile Barber Demo',
      barberName: 'Daniel Nguyen',
      phone: '(714) 555-0148',
      email: 'demo-mobile-barber@dulichcali21.com',
      profilePhoto: '/assets/mobile-barber/profile-placeholder.jpg',
      heroImage: '/assets/mobile-barber/hero-placeholder.jpg',
      serviceAreas: Object.freeze(['Westminster', 'Garden Grove', 'Fountain Valley']),
      travelRadiusMiles: 12,
      baseTravelFee: 15,
      addressOptional: true,
      languages: Object.freeze(['en', 'vi']),
      active: true,
      rating: 4.9,
      reviewCount: 2,
      serviceBadges: Object.freeze(['fade', 'beardTrim', 'kidsCut', 'seniorCut', 'vietnameseSpeaking', 'spanishSpeaking']),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP
    })
  ]);

  var sampleServices = Object.freeze([
    Object.freeze({
      id: 'classic-mobile-cut',
      vendorId: SAMPLE_VENDOR_ID,
      name: 'Classic Mobile Haircut',
      description: 'In-home haircut with cleanup buffer included.',
      durationMinutes: 45,
      price: 45,
      cleanupBufferMinutes: 10,
      travelBufferMinutes: 20,
      category: 'haircut',
      active: true,
      imageUrl: '/assets/mobile-barber/service-haircut-placeholder.jpg'
    }),
    Object.freeze({
      id: 'mobile-haircut-beard',
      vendorId: SAMPLE_VENDOR_ID,
      name: 'Haircut and Beard Trim',
      description: 'Mobile haircut, beard shaping, and light cleanup.',
      durationMinutes: 65,
      price: 65,
      cleanupBufferMinutes: 10,
      travelBufferMinutes: 25,
      category: 'combo',
      active: true,
      imageUrl: '/assets/mobile-barber/service-combo-placeholder.jpg'
    })
  ]);

  var sampleAvailability = Object.freeze([
    Object.freeze({
      id: 'demo-weekly-default',
      vendorId: SAMPLE_VENDOR_ID,
      timezone: 'America/Los_Angeles',
      weeklyHours: Object.freeze({
        monday: Object.freeze({ active: true, start: '10:00', end: '18:00' }),
        tuesday: Object.freeze({ active: true, start: '10:00', end: '18:00' }),
        wednesday: Object.freeze({ active: true, start: '10:00', end: '18:00' }),
        thursday: Object.freeze({ active: true, start: '10:00', end: '18:00' }),
        friday: Object.freeze({ active: true, start: '10:00', end: '18:00' }),
        saturday: Object.freeze({ active: true, start: '09:00', end: '16:00' }),
        sunday: Object.freeze({ active: false, start: null, end: null })
      }),
      blackoutDates: Object.freeze([]),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP
    })
  ]);

  var samplePortfolioImages = Object.freeze([
    Object.freeze({
      id: 'demo-low-fade-before-after',
      vendorId: SAMPLE_VENDOR_ID,
      title: 'Low fade cleanup',
      description: 'Before and after mobile haircut sample.',
      imageUrl: '',
      beforeImageUrl: '/assets/mobile-barber/portfolio-before-placeholder.jpg',
      afterImageUrl: '/assets/mobile-barber/portfolio-after-placeholder.jpg',
      alt: 'Low fade before and after',
      displayOrder: 10,
      hidden: false,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP
    }),
    Object.freeze({
      id: 'demo-beard-trim-finish',
      vendorId: SAMPLE_VENDOR_ID,
      title: 'Beard trim finish',
      description: 'Finished beard trim and neckline cleanup.',
      imageUrl: '/assets/mobile-barber/portfolio-beard-placeholder.jpg',
      beforeImageUrl: '',
      afterImageUrl: '',
      alt: 'Finished beard trim',
      displayOrder: 20,
      hidden: false,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP
    })
  ]);

  var sampleReviews = Object.freeze([
    Object.freeze({
      id: 'demo-review-1',
      vendorId: SAMPLE_VENDOR_ID,
      customerName: 'Minh T.',
      rating: 5,
      body: 'Clean fade, arrived on time, and kept the setup easy at home.',
      serviceName: 'Classic Mobile Haircut',
      lang: 'en',
      hidden: false,
      vendorResponse: 'Thank you, Minh. Glad the home setup worked smoothly.',
      createdAt: '2026-05-22T16:00:00.000Z',
      updatedAt: '2026-05-22T16:00:00.000Z'
    }),
    Object.freeze({
      id: 'demo-review-2',
      vendorId: SAMPLE_VENDOR_ID,
      customerName: 'Carlos R.',
      rating: 5,
      body: 'Good kids cut and beard trim. Easy booking.',
      serviceName: 'Haircut and Beard Trim',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-21T16:00:00.000Z',
      updatedAt: '2026-05-21T16:00:00.000Z'
    })
  ]);

  function isPlainObject(value) {
    return !!value && Object.prototype.toString.call(value) === '[object Object]';
  }

  function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function hasOnlyKnownFields(doc, allowedFields, errors, label) {
    Object.keys(doc || {}).forEach(function(key) {
      if (allowedFields.indexOf(key) < 0) {
        errors.push(label + ' contains unknown field: ' + key);
      }
    });
  }

  function requireText(doc, field, errors) {
    if (!hasText(doc[field])) errors.push(field + ' is required.');
  }

  function requireNumber(doc, field, errors, opts) {
    opts = opts || {};
    if (!isFiniteNumber(doc[field])) {
      errors.push(field + ' must be a number.');
      return;
    }
    if (opts.min !== undefined && doc[field] < opts.min) {
      errors.push(field + ' must be at least ' + opts.min + '.');
    }
  }

  function requireArray(doc, field, errors) {
    if (!Array.isArray(doc[field])) {
      errors.push(field + ' must be an array.');
    }
  }

  function validateVendor(vendor) {
    var errors = [];
    if (!isPlainObject(vendor)) return { valid: false, errors: ['vendor must be an object.'] };
    hasOnlyKnownFields(vendor, VENDOR_FIELDS, errors, 'vendor');

    ['id', 'businessName', 'barberName', 'phone', 'email', 'createdAt', 'updatedAt'].forEach(function(field) {
      requireText(vendor, field, errors);
    });
    requireArray(vendor, 'serviceAreas', errors);
    requireArray(vendor, 'languages', errors);
    if (vendor.serviceBadges != null) requireArray(vendor, 'serviceBadges', errors);
    requireNumber(vendor, 'travelRadiusMiles', errors, { min: 0 });
    requireNumber(vendor, 'baseTravelFee', errors, { min: 0 });
    requireNumber(vendor, 'rating', errors, { min: 0 });
    if (vendor.reviewCount != null) requireNumber(vendor, 'reviewCount', errors, { min: 0 });
    if (typeof vendor.addressOptional !== 'boolean') errors.push('addressOptional must be boolean.');
    if (typeof vendor.active !== 'boolean') errors.push('active must be boolean.');
    if (Array.isArray(vendor.serviceAreas) && vendor.serviceAreas.length === 0) {
      errors.push('serviceAreas must include at least one service area.');
    }
    if (Array.isArray(vendor.languages) && vendor.languages.length === 0) {
      errors.push('languages must include at least one language code.');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function validatePortfolioImage(image, opts) {
    var errors = [];
    opts = opts || {};
    if (!isPlainObject(image)) return { valid: false, errors: ['portfolio image must be an object.'] };
    hasOnlyKnownFields(image, PORTFOLIO_IMAGE_FIELDS, errors, 'portfolio image');
    ['id', 'vendorId', 'title'].forEach(function(field) {
      requireText(image, field, errors);
    });
    requireNumber(image, 'displayOrder', errors, { min: 0 });
    if (typeof image.hidden !== 'boolean') errors.push('hidden must be boolean.');
    if (!hasText(image.imageUrl) && !hasText(image.beforeImageUrl) && !hasText(image.afterImageUrl)) {
      errors.push('portfolio image must include imageUrl or before/after URLs.');
    }
    if (opts.vendorIds && opts.vendorIds.indexOf(image.vendorId) < 0) {
      errors.push('portfolio image vendorId does not match a known mobile barber vendor.');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function validateReview(review, opts) {
    var errors = [];
    opts = opts || {};
    if (!isPlainObject(review)) return { valid: false, errors: ['review must be an object.'] };
    hasOnlyKnownFields(review, REVIEW_FIELDS, errors, 'review');
    ['id', 'vendorId', 'customerName', 'body'].forEach(function(field) {
      requireText(review, field, errors);
    });
    requireNumber(review, 'rating', errors, { min: 1 });
    if (review.rating > 5) errors.push('rating must be no more than 5.');
    if (typeof review.hidden !== 'boolean') errors.push('hidden must be boolean.');
    if (hasText(review.lang) && ['en', 'vi', 'es'].indexOf(review.lang) < 0) {
      errors.push('lang is not supported.');
    }
    if (opts.vendorIds && opts.vendorIds.indexOf(review.vendorId) < 0) {
      errors.push('review vendorId does not match a known mobile barber vendor.');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function validateService(service, vendorIds) {
    var errors = [];
    if (!isPlainObject(service)) return { valid: false, errors: ['service must be an object.'] };
    hasOnlyKnownFields(service, SERVICE_FIELDS, errors, 'service');

    ['id', 'vendorId', 'name', 'description', 'category'].forEach(function(field) {
      requireText(service, field, errors);
    });
    requireNumber(service, 'durationMinutes', errors, { min: 1 });
    requireNumber(service, 'price', errors, { min: 0 });
    requireNumber(service, 'cleanupBufferMinutes', errors, { min: 0 });
    requireNumber(service, 'travelBufferMinutes', errors, { min: 0 });
    if (typeof service.active !== 'boolean') errors.push('active must be boolean.');
    if (vendorIds && vendorIds.indexOf(service.vendorId) < 0) {
      errors.push('service vendorId does not match a known mobile barber vendor.');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function validateBooking(booking, opts) {
    var errors = [];
    opts = opts || {};
    if (!isPlainObject(booking)) return { valid: false, errors: ['booking must be an object.'] };
    hasOnlyKnownFields(booking, BOOKING_FIELDS, errors, 'booking');

    [
      'vendorId', 'customerName', 'customerPhone', 'serviceId', 'serviceName',
      'address', 'city', 'zip', 'requestedDate', 'startTime', 'endTime',
      'status', 'source'
    ].forEach(function(field) {
      requireText(booking, field, errors);
    });
    requireNumber(booking, 'servicePrice', errors, { min: 0 });

    if (booking.id != null && !hasText(booking.id)) errors.push('id must be a non-empty string when present.');
    if (booking.customerEmail != null && booking.customerEmail !== '' && !/.+@.+\..+/.test(booking.customerEmail)) {
      errors.push('customerEmail must be a valid email when present.');
    }
    if (booking.photoUrls != null && !Array.isArray(booking.photoUrls)) {
      errors.push('photoUrls must be an array when present.');
    }
    if (booking.customerUid != null && booking.customerUid !== '' && !hasText(booking.customerUid)) {
      errors.push('customerUid must be a non-empty string when present.');
    }
    if (hasText(booking.requestedDate) && !/^\d{4}-\d{2}-\d{2}$/.test(booking.requestedDate)) {
      errors.push('requestedDate must be YYYY-MM-DD.');
    }
    ['startTime', 'endTime'].forEach(function(field) {
      if (hasText(booking[field]) && !/^\d{1,2}:\d{2}$/.test(booking[field])) {
        errors.push(field + ' must be HH:MM.');
      }
    });
    if (hasText(booking.status) && BOOKING_STATUSES.indexOf(booking.status) < 0) {
      errors.push('status is not supported.');
    }
    if (hasText(booking.source) && BOOKING_SOURCES.indexOf(booking.source) < 0) {
      errors.push('source is not supported.');
    }
    if (opts.vendorIds && opts.vendorIds.indexOf(booking.vendorId) < 0) {
      errors.push('booking vendorId does not match a known mobile barber vendor.');
    }
    if (opts.serviceIds && opts.serviceIds.indexOf(booking.serviceId) < 0) {
      errors.push('booking serviceId does not match a known mobile barber service.');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function validateCustomer(customer, opts) {
    var errors = [];
    opts = opts || {};
    if (!isPlainObject(customer)) return { valid: false, errors: ['customer must be an object.'] };
    hasOnlyKnownFields(customer, CUSTOMER_FIELDS, errors, 'customer');
    ['vendorId', 'customerName', 'customerPhone', 'customerPhoneNormalized'].forEach(function(field) {
      requireText(customer, field, errors);
    });
    if (customer.photoUrls != null && !Array.isArray(customer.photoUrls)) {
      errors.push('photoUrls must be an array when present.');
    }
    if (customer.customerEmail != null && customer.customerEmail !== '' && !/.+@.+\..+/.test(customer.customerEmail)) {
      errors.push('customerEmail must be a valid email when present.');
    }
    if (opts.vendorIds && opts.vendorIds.indexOf(customer.vendorId) < 0) {
      errors.push('customer vendorId does not match a known mobile barber vendor.');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function findVendorById(vendorId, vendors) {
    vendors = vendors || sampleVendors;
    for (var i = 0; i < vendors.length; i++) {
      if (vendors[i].id === vendorId) return vendors[i];
    }
    return null;
  }

  function listServicesForVendor(vendorId, services) {
    services = services || sampleServices;
    return services.filter(function(service) {
      return service.vendorId === vendorId && service.active !== false;
    });
  }

  function listPortfolioForVendor(vendorId, images, includeHidden) {
    images = images || samplePortfolioImages;
    return images.filter(function(image) {
      return image.vendorId === vendorId && (includeHidden || image.hidden !== true);
    }).sort(function(a, b) {
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });
  }

  function listReviewsForVendor(vendorId, reviews, includeHidden) {
    reviews = reviews || sampleReviews;
    return reviews.filter(function(review) {
      return review.vendorId === vendorId && (includeHidden || review.hidden !== true);
    }).sort(function(a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  function createSeedPayload() {
    return {
      collections: COLLECTIONS,
      vendors: sampleVendors.slice(),
      services: sampleServices.slice(),
      availability: sampleAvailability.slice(),
      portfolioImages: samplePortfolioImages.slice(),
      reviews: sampleReviews.slice(),
      bookings: [],
      customers: [],
      agentSessions: []
    };
  }

  return {
    COLLECTIONS: COLLECTIONS,
    VENDOR_FIELDS: VENDOR_FIELDS,
    SERVICE_FIELDS: SERVICE_FIELDS,
    BOOKING_FIELDS: BOOKING_FIELDS,
    CUSTOMER_FIELDS: CUSTOMER_FIELDS,
    PORTFOLIO_IMAGE_FIELDS: PORTFOLIO_IMAGE_FIELDS,
    REVIEW_FIELDS: REVIEW_FIELDS,
    SERVICE_BADGES: SERVICE_BADGES,
    BOOKING_STATUSES: BOOKING_STATUSES,
    BOOKING_SOURCES: BOOKING_SOURCES,
    SAMPLE_VENDOR_ID: SAMPLE_VENDOR_ID,
    sampleVendors: sampleVendors,
    sampleServices: sampleServices,
    sampleAvailability: sampleAvailability,
    samplePortfolioImages: samplePortfolioImages,
    sampleReviews: sampleReviews,
    validateVendor: validateVendor,
    validateService: validateService,
    validateBooking: validateBooking,
    validateCustomer: validateCustomer,
    validatePortfolioImage: validatePortfolioImage,
    validateReview: validateReview,
    findVendorById: findVendorById,
    listServicesForVendor: listServicesForVendor,
    listPortfolioForVendor: listPortfolioForVendor,
    listReviewsForVendor: listReviewsForVendor,
    createSeedPayload: createSeedPayload
  };
});
