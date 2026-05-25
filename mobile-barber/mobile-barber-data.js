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
    serviceImages: 'mobileBarberServiceImages',
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
    'reviewCount', 'serviceBadges', 'createdAt', 'updatedAt',
    'bio', 'region', 'yearsExperience', 'zipCoverage', 'travelFeeTiers',
    'wearRatePerMile', 'freeTravelMiles', 'customQuoteMiles',
    'minimumMobileVisitPrice', 'minimumHourlyTarget',
    'homeBaseAddress',
    'geminiKey', 'openaiKey'
  ]);

  var SERVICE_FIELDS = Object.freeze([
    'id', 'vendorId', 'name', 'description', 'durationMinutes', 'price',
    'cleanupBufferMinutes', 'travelBufferMinutes', 'category', 'active',
    'imageUrl', 'imagePrompt', 'imageAlt', 'isAIGenerated'
  ]);

  var SERVICE_IMAGE_FIELDS = Object.freeze([
    'serviceId', 'vendorId', 'imageUrl', 'imagePrompt', 'imageAlt',
    'category', 'isAIGenerated', 'active'
  ]);

  var BOOKING_FIELDS = Object.freeze([
    'id', 'vendorId', 'customerName', 'customerPhone', 'customerEmail',
    'serviceId', 'serviceName', 'servicePrice', 'travelFee',
    'vehicleWearCost', 'distanceAdjustment', 'peakAdjustment',
    'amountDue', 'totalPrice', 'estimatedDistanceMiles',
    'estimatedTravelMinutes', 'pricingExplanation', 'quoteType',
    'paymentMethod', 'paymentStatus', 'zellePhone', 'paymentNote',
    'address', 'city', 'zip',
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
    'afterImageUrl', 'alt', 'displayOrder', 'hidden', 'createdAt', 'updatedAt',
    'category', 'active', 'isAIGenerated', 'requiresReplacementWithRealWork',
    'beforeImagePrompt', 'afterImagePrompt'
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
  var MICHAEL_VENDOR_ID = 'michael-nguyen-oc';
  var TIM_VENDOR_ID = 'tim-nguyen-bay';

  // Canonical schema for every haircut-style preview record.
  // Renderers must read displayOrder/category/clipUrl/isAIGenerated/active from
  // here, not synthesise them at render time.
  var SERVICE_IMAGE_TEMPLATES = Object.freeze({
    'classic-haircut': Object.freeze({
      id: 'classic-haircut',
      title: 'Classic Haircut',
      category: 'classic',
      displayOrder: 1,
      imageUrl: '/assets/mobile-barber/styles/classic-haircut.jpg',
      clipUrl: '',
      imagePrompt: 'realistic mobile barber in-home classic men haircut, clean professional result, natural lighting, modern grooming photography',
      imageAlt: 'Classic haircut style preview for mobile barber service',
      isAIGenerated: true,
      active: true
    }),
    'fade-haircut': Object.freeze({
      id: 'fade-haircut',
      title: 'Fade Haircut',
      category: 'fade',
      displayOrder: 2,
      imageUrl: '/assets/mobile-barber/styles/fade-haircut.jpg',
      clipUrl: '',
      imagePrompt: 'realistic sharp fade haircut result, mobile barber service, clean blend, professional haircut photography, no celebrity, no logo',
      imageAlt: 'Fade haircut style preview with clean blended sides',
      isAIGenerated: true,
      active: true
    }),
    'skin-fade': Object.freeze({
      id: 'skin-fade',
      title: 'Skin Fade',
      category: 'fade',
      displayOrder: 3,
      imageUrl: '/assets/mobile-barber/styles/skin-fade.jpg',
      clipUrl: '',
      imagePrompt: 'realistic skin fade haircut close-up, sharp blend, professional barber result, indoor mobile haircut service',
      imageAlt: 'Skin fade haircut close-up style preview',
      isAIGenerated: true,
      active: true
    }),
    'taper-fade': Object.freeze({
      id: 'taper-fade',
      title: 'Taper Fade',
      category: 'taper',
      displayOrder: 4,
      imageUrl: '/assets/mobile-barber/styles/taper-fade.jpg',
      clipUrl: '',
      imagePrompt: 'realistic taper fade haircut, clean neckline and side blend, professional mobile barber promotional photo',
      imageAlt: 'Taper fade haircut style preview with clean neckline',
      isAIGenerated: true,
      active: true
    }),
    'haircut-beard': Object.freeze({
      id: 'haircut-beard',
      title: 'Haircut + Beard',
      category: 'beard',
      displayOrder: 5,
      imageUrl: '/assets/mobile-barber/styles/haircut-beard.jpg',
      clipUrl: '',
      imagePrompt: 'realistic men haircut and beard trim result, clean beard line, fresh haircut, mobile barber promotion',
      imageAlt: 'Haircut and beard trim style preview',
      isAIGenerated: true,
      active: true
    }),
    'beard-trim': Object.freeze({
      id: 'beard-trim',
      title: 'Beard Trim',
      category: 'beard',
      displayOrder: 6,
      imageUrl: '/assets/mobile-barber/styles/beard-trim.jpg',
      clipUrl: '',
      imagePrompt: 'realistic beard trim and lineup, clean neck line, professional grooming service, mobile barber',
      imageAlt: 'Beard trim and lineup grooming preview',
      isAIGenerated: true,
      active: true
    }),
    'kids-haircut': Object.freeze({
      id: 'kids-haircut',
      title: 'Kids Haircut',
      category: 'kids',
      displayOrder: 7,
      imageUrl: '/assets/mobile-barber/styles/kids-haircut.jpg',
      clipUrl: '',
      imagePrompt: 'realistic child haircut at home, clean kids haircut, family-friendly mobile barber service, warm natural lighting',
      imageAlt: 'Kids haircut at home style preview',
      isAIGenerated: true,
      active: true
    }),
    'senior-haircut': Object.freeze({
      id: 'senior-haircut',
      title: 'Senior Haircut',
      category: 'senior',
      displayOrder: 8,
      imageUrl: '/assets/mobile-barber/styles/senior-haircut.jpg',
      clipUrl: '',
      imagePrompt: 'realistic senior gentleman haircut at home, clean classic haircut, respectful professional mobile barber service',
      imageAlt: 'Senior haircut at home style preview',
      isAIGenerated: true,
      active: true
    }),
    'business-haircut': Object.freeze({
      id: 'business-haircut',
      title: 'Business Haircut',
      category: 'business',
      displayOrder: 9,
      imageUrl: '/assets/mobile-barber/styles/business-haircut.jpg',
      clipUrl: '',
      imagePrompt: 'realistic professional business haircut, clean executive style, neat side part, mobile barber finished result',
      imageAlt: 'Business style haircut preview with neat executive finish',
      isAIGenerated: true,
      active: true
    }),
    'buzz-cut': Object.freeze({
      id: 'buzz-cut',
      title: 'Buzz Cut',
      category: 'classic',
      displayOrder: 10,
      imageUrl: '/assets/mobile-barber/styles/buzz-cut.jpg',
      clipUrl: '',
      imagePrompt: 'realistic buzz cut haircut result, clean even guard length, simple professional mobile barber service',
      imageAlt: 'Buzz cut haircut style preview',
      isAIGenerated: true,
      active: true
    }),
    'line-up': Object.freeze({
      id: 'line-up',
      title: 'Line Up',
      category: 'lineup',
      displayOrder: 11,
      imageUrl: '/assets/mobile-barber/styles/line-up.jpg',
      clipUrl: '',
      imagePrompt: 'realistic hairline edge up lineup haircut, sharp clean edges, professional barber close-up',
      imageAlt: 'Line up haircut preview with clean hairline edge',
      isAIGenerated: true,
      active: true
    }),
    'modern-styling': Object.freeze({
      id: 'modern-styling',
      title: 'Modern Styling',
      category: 'styling',
      displayOrder: 12,
      imageUrl: '/assets/mobile-barber/styles/modern-styling.jpg',
      clipUrl: '',
      imagePrompt: 'realistic modern men hairstyle with product styling, clean texture, professional mobile barber result',
      imageAlt: 'Modern styled haircut preview with textured finish',
      isAIGenerated: true,
      active: true
    }),
    'home-family-package': Object.freeze({
      id: 'home-family-package',
      title: 'Family Package',
      category: 'family',
      displayOrder: 13,
      imageUrl: '/assets/mobile-barber/styles/home-family-package.jpg',
      clipUrl: '',
      imagePrompt: 'realistic family mobile haircut service at home, barber setup, father and child haircut theme, warm professional promotional photo',
      imageAlt: 'Home family haircut package preview',
      isAIGenerated: true,
      active: true
    })
  });

  // Ordered list for renderers — single source of truth for promo carousel
  function listStyleTemplates() {
    return Object.keys(SERVICE_IMAGE_TEMPLATES)
      .map(function(k) { return SERVICE_IMAGE_TEMPLATES[k]; })
      .filter(function(s) { return s.active !== false; })
      .sort(function(a, b) { return (a.displayOrder || 999) - (b.displayOrder || 999); });
  }

  var SERVICE_IMAGE_DISCLOSURE = 'Sample AI-generated style preview. Real barber portfolio coming soon.';

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
    }),
    Object.freeze({
      id: MICHAEL_VENDOR_ID,
      businessName: 'Michael Mobile Barber OC',
      barberName: 'Michael Nguyen',
      phone: '(714) 227-6007',
      email: 'duyhoa9256@gmail.com',
      profilePhoto: '/assets/mobile-barber/michael-profile-placeholder.jpg',
      heroImage: '/assets/mobile-barber/michael-hero-placeholder.jpg',
      serviceAreas: Object.freeze([
        'Irvine', 'Garden Grove', 'Westminster', 'Santa Ana', 'Fountain Valley',
        'Huntington Beach', 'Costa Mesa', 'Anaheim', 'Tustin', 'Orange'
      ]),
      travelRadiusMiles: 25,
      baseTravelFee: 0,
      addressOptional: true,
      languages: Object.freeze(['en', 'vi']),
      active: true,
      rating: 4.9,
      reviewCount: 5,
      serviceBadges: Object.freeze(['fade', 'beardTrim', 'kidsCut', 'vietnameseSpeaking']),
      bio: 'Professional mobile barber serving Orange County with in-home haircut services. Specializing in fades, tapers, beard work, family cuts, kids haircuts, and clean professional styles.',
      region: 'Orange County',
      yearsExperience: 8,
      zipCoverage: Object.freeze(['92647', '92683', '92627', '92704', '92840', '92843', '92703', '92868']),
      homeBaseAddress: 'Westminster, CA 92683',
      travelFeeTiers: Object.freeze([
        Object.freeze({ maxMiles: 10, fee: 0 }),
        Object.freeze({ maxMiles: 20, fee: 10 }),
        Object.freeze({ maxMiles: 25, fee: 20 })
      ]),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP
    }),
    Object.freeze({
      id: TIM_VENDOR_ID,
      businessName: 'Tim Mobile Barber Bay Area',
      barberName: 'Tim Nguyen',
      phone: '(408) 504-3684',
      email: 'tuananhnta@gmail.com',
      profilePhoto: '/assets/mobile-barber/tim-profile-placeholder.jpg',
      heroImage: '/assets/mobile-barber/tim-hero-placeholder.jpg',
      serviceAreas: Object.freeze([
        'San Jose', 'Santa Clara', 'Sunnyvale', 'Milpitas', 'Campbell',
        'Cupertino', 'Mountain View', 'Los Gatos', 'Fremont'
      ]),
      travelRadiusMiles: 30,
      baseTravelFee: 0,
      addressOptional: true,
      languages: Object.freeze(['en', 'vi']),
      active: true,
      rating: 4.9,
      reviewCount: 5,
      serviceBadges: Object.freeze(['fade', 'beardTrim', 'kidsCut', 'seniorCut', 'vietnameseSpeaking']),
      bio: 'Mobile barber providing premium in-home haircut services across the Bay Area with modern fades, beard trims, family cuts, and professional grooming.',
      region: 'Bay Area',
      yearsExperience: 10,
      zipCoverage: Object.freeze(['95112', '95122', '95050', '95051', '95035', '94085', '94040']),
      homeBaseAddress: 'San Jose, CA 95112',
      travelFeeTiers: Object.freeze([
        Object.freeze({ maxMiles: 15, fee: 0 }),
        Object.freeze({ maxMiles: 25, fee: 10 }),
        Object.freeze({ maxMiles: 30, fee: 20 })
      ]),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP
    })
  ]);

  function makeService(vendorId, slug, name, description, price, mins, category) {
    var image = SERVICE_IMAGE_TEMPLATES[slug] || SERVICE_IMAGE_TEMPLATES['classic-haircut'];
    return Object.freeze({
      id: vendorId + '-' + slug,
      vendorId: vendorId,
      name: name,
      description: description,
      durationMinutes: mins,
      price: price,
      cleanupBufferMinutes: 10,
      travelBufferMinutes: 20,
      category: category,
      active: true,
      imageUrl: image.imageUrl,
      imagePrompt: image.imagePrompt,
      imageAlt: image.imageAlt,
      isAIGenerated: true
    });
  }

  var MOBILE_BARBER_MENU = [
    { slug: 'classic-haircut',     name: 'Classic Haircut',         desc: 'In-home classic haircut with neckline and cleanup.',           price: 40,  mins: 45, cat: 'haircut'  },
    { slug: 'fade-haircut',        name: 'Fade Haircut',            desc: 'Mobile fade haircut with clean blend and finish.',             price: 45,  mins: 45, cat: 'fade'     },
    { slug: 'skin-fade',           name: 'Skin Fade',               desc: 'Bald fade taken to skin with precise blend.',                  price: 50,  mins: 50, cat: 'fade'     },
    { slug: 'taper-fade',          name: 'Taper Fade',              desc: 'Clean taper around ears and neckline with soft blend.',        price: 45,  mins: 45, cat: 'fade'     },
    { slug: 'haircut-beard',       name: 'Haircut and Beard',       desc: 'Full haircut plus beard shape, lineup, and cleanup.',          price: 65,  mins: 60, cat: 'combo'    },
    { slug: 'beard-trim',          name: 'Beard Trim',              desc: 'Beard shape, neckline cleanup, and detail.',                   price: 25,  mins: 25, cat: 'beard'    },
    { slug: 'kids-haircut',        name: 'Kids Haircut',            desc: 'In-home haircut for kids in a comfortable setting.',           price: 35,  mins: 35, cat: 'kids'     },
    { slug: 'senior-haircut',      name: 'Senior Haircut',          desc: 'In-home haircut for seniors with extra care and patience.',    price: 35,  mins: 35, cat: 'senior'   },
    { slug: 'business-haircut',    name: 'Business Style Haircut',  desc: 'Clean professional cut tailored for the workplace.',           price: 45,  mins: 45, cat: 'business' },
    { slug: 'buzz-cut',            name: 'Buzz Cut',                desc: 'Quick clipper cut with even guard length.',                    price: 30,  mins: 25, cat: 'haircut'  },
    { slug: 'line-up',             name: 'Line Up',                 desc: 'Edge-up around hairline, sideburns, and neck.',                price: 20,  mins: 20, cat: 'detail'   },
    { slug: 'modern-styling',      name: 'Modern Styling',          desc: 'Stylish modern haircut with product styling and finish.',      price: 55,  mins: 60, cat: 'haircut'  },
    { slug: 'home-family-package', name: 'Home Family Package',     desc: 'Two adults included. Three or more family members from $100+.',price: 75,  mins: 90, cat: 'package'  }
  ];

  function buildMenuForVendor(vendorId) {
    return MOBILE_BARBER_MENU.map(function(item) {
      return makeService(vendorId, item.slug, item.name, item.desc, item.price, item.mins, item.cat);
    });
  }

  function makeServiceImage(vendorId, serviceId, slug, category) {
    var image = SERVICE_IMAGE_TEMPLATES[slug] || SERVICE_IMAGE_TEMPLATES['classic-haircut'];
    return Object.freeze({
      serviceId: serviceId,
      vendorId: vendorId,
      imageUrl: image.imageUrl,
      imagePrompt: image.imagePrompt,
      imageAlt: image.imageAlt,
      category: category,
      isAIGenerated: true,
      active: true
    });
  }

  function buildServiceImagesForVendor(vendorId) {
    return MOBILE_BARBER_MENU.map(function(item) {
      return makeServiceImage(vendorId, vendorId + '-' + item.slug, item.slug, item.cat);
    });
  }

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
      imageUrl: SERVICE_IMAGE_TEMPLATES['classic-haircut'].imageUrl,
      imagePrompt: SERVICE_IMAGE_TEMPLATES['classic-haircut'].imagePrompt,
      imageAlt: SERVICE_IMAGE_TEMPLATES['classic-haircut'].imageAlt,
      isAIGenerated: true
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
      imageUrl: SERVICE_IMAGE_TEMPLATES['haircut-beard'].imageUrl,
      imagePrompt: SERVICE_IMAGE_TEMPLATES['haircut-beard'].imagePrompt,
      imageAlt: SERVICE_IMAGE_TEMPLATES['haircut-beard'].imageAlt,
      isAIGenerated: true
    })
  ].concat(buildMenuForVendor(MICHAEL_VENDOR_ID)).concat(buildMenuForVendor(TIM_VENDOR_ID)));

  var sampleServiceImages = Object.freeze([
    makeServiceImage(SAMPLE_VENDOR_ID, 'classic-mobile-cut', 'classic-haircut', 'haircut'),
    makeServiceImage(SAMPLE_VENDOR_ID, 'mobile-haircut-beard', 'haircut-beard', 'combo')
  ].concat(buildServiceImagesForVendor(MICHAEL_VENDOR_ID)).concat(buildServiceImagesForVendor(TIM_VENDOR_ID)));

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
    }),
    Object.freeze({
      id: 'michael-weekly-default',
      vendorId: MICHAEL_VENDOR_ID,
      timezone: 'America/Los_Angeles',
      weeklyHours: Object.freeze({
        monday:    Object.freeze({ active: true,  start: '09:00', end: '19:00' }),
        tuesday:   Object.freeze({ active: true,  start: '09:00', end: '19:00' }),
        wednesday: Object.freeze({ active: true,  start: '09:00', end: '19:00' }),
        thursday:  Object.freeze({ active: true,  start: '09:00', end: '19:00' }),
        friday:    Object.freeze({ active: true,  start: '09:00', end: '19:00' }),
        saturday:  Object.freeze({ active: true,  start: '09:00', end: '17:00' }),
        sunday:    Object.freeze({ active: false, start: null,    end: null })
      }),
      blackoutDates: Object.freeze([]),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP
    }),
    Object.freeze({
      id: 'tim-weekly-default',
      vendorId: TIM_VENDOR_ID,
      timezone: 'America/Los_Angeles',
      weeklyHours: Object.freeze({
        monday:    Object.freeze({ active: true, start: '09:00', end: '20:00' }),
        tuesday:   Object.freeze({ active: true, start: '09:00', end: '20:00' }),
        wednesday: Object.freeze({ active: true, start: '09:00', end: '20:00' }),
        thursday:  Object.freeze({ active: true, start: '09:00', end: '20:00' }),
        friday:    Object.freeze({ active: true, start: '09:00', end: '20:00' }),
        saturday:  Object.freeze({ active: true, start: '10:00', end: '17:00' }),
        sunday:    Object.freeze({ active: true, start: '10:00', end: '15:00' })
      }),
      blackoutDates: Object.freeze([]),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP
    })
  ]);

  var AI_PORTFOLIO_CATEGORIES = [
    {
      id: 'fade',
      title: 'Fade haircut',
      description: 'Mobile fade haircut transformation in a home setting.',
      beforeBase: 'Generic young adult male customer at home before mobile fade haircut, overgrown sides, natural indoor lighting, neutral background, realistic stock-style portrait, no logos, no real-person likeness',
      afterBase: 'Same generic young adult male customer after sharp clean fade haircut, crisp blend on sides, finished mobile barber result, natural indoor lighting, realistic stock-style portrait, no logos, no real-person likeness'
    },
    {
      id: 'skin-fade',
      title: 'Skin fade',
      description: 'Bald skin-fade taken to skin with precise blend.',
      beforeBase: 'Generic adult male customer at home before skin fade, longer sides, natural lighting, realistic stock-style portrait, no logos, no real-person likeness',
      afterBase: 'Same generic adult male customer after bald skin fade, taken to skin with seamless blend, finished mobile barber result, realistic stock-style portrait, no logos, no real-person likeness'
    },
    {
      id: 'kids-haircut',
      title: 'Kids haircut',
      description: 'Friendly in-home kids haircut transformation.',
      beforeBase: 'Generic young child customer in home environment before haircut, overgrown hair, realistic family portrait stock-style, no logos, no real-person likeness',
      afterBase: 'Same generic young child after a clean tidy kids haircut, smiling at home, friendly mobile barber result, realistic stock-style portrait, no logos, no real-person likeness'
    },
    {
      id: 'senior-haircut',
      title: 'Senior haircut',
      description: 'In-home senior haircut with extra care.',
      beforeBase: 'Generic senior adult customer at home before haircut, gray hair, neutral lighting, realistic stock-style portrait, no logos, no real-person likeness',
      afterBase: 'Same generic senior adult after a clean dignified haircut, comfortable home setting, neat finish, realistic stock-style portrait, no logos, no real-person likeness'
    },
    {
      id: 'business-haircut',
      title: 'Business haircut',
      description: 'Clean professional cut tailored for the workplace.',
      beforeBase: 'Generic adult professional male customer with longer unkept hair before business haircut, neutral indoor background, realistic stock-style portrait, no logos, no real-person likeness',
      afterBase: 'Same generic professional after clean executive business haircut, tidy sides, polished workplace-ready finish, realistic stock-style portrait, no logos, no real-person likeness'
    },
    {
      id: 'beard-cleanup',
      title: 'Beard cleanup',
      description: 'Beard shape, neckline cleanup, and detail.',
      beforeBase: 'Generic adult male customer with messy untrimmed beard before mobile beard cleanup, realistic stock-style portrait, neutral indoor background, no logos, no real-person likeness',
      afterBase: 'Same generic adult male after clean trimmed beard with shaped neckline and cheekline, finished mobile grooming result, realistic stock-style portrait, no logos, no real-person likeness'
    },
    {
      id: 'modern-taper',
      title: 'Modern taper',
      description: 'Clean modern taper with soft blend.',
      beforeBase: 'Generic young adult male customer before modern taper, longer top and overgrown sides, neutral indoor background, realistic stock-style portrait, no logos, no real-person likeness',
      afterBase: 'Same generic young adult male after modern taper haircut with clean soft blend around ears and neckline, finished mobile barber result, realistic stock-style portrait, no logos, no real-person likeness'
    },
    {
      id: 'line-up',
      title: 'Line up',
      description: 'Sharp hairline edge-up and detail.',
      beforeBase: 'Generic adult male customer before hairline edge-up, soft uneven hairline, neutral indoor lighting, realistic stock-style portrait, no logos, no real-person likeness',
      afterBase: 'Same generic adult male after crisp line-up around forehead, sideburns, and neckline, finished mobile barber result, realistic stock-style portrait, no logos, no real-person likeness'
    },
    {
      id: 'hair-beard',
      title: 'Hair and beard',
      description: 'Haircut plus beard shaping in one mobile appointment.',
      beforeBase: 'Generic adult male customer before combined haircut and beard service, longer hair and untrimmed beard, neutral indoor lighting, realistic stock-style portrait, no logos, no real-person likeness',
      afterBase: 'Same generic adult male after combined clean haircut and shaped beard, polished mobile barber result, realistic stock-style portrait, no logos, no real-person likeness'
    },
    {
      id: 'family-haircut',
      title: 'Family haircut',
      description: 'In-home family haircut session.',
      beforeBase: 'Generic family group at home before haircuts, parent and child, casual home environment, realistic family stock-style portrait, no logos, no real-person likeness',
      afterBase: 'Same generic family group after fresh in-home haircuts, smiling together at home, realistic family stock-style portrait, no logos, no real-person likeness'
    }
  ];

  var AI_PORTFOLIO_VARIANTS = [
    { suffix: '1', tag: 'set 1', extra: 'natural daylight, living room background, warm tone' },
    { suffix: '2', tag: 'set 2', extra: 'cooler indoor lighting, neutral wall background, soft contrast' }
  ];

  // Shared AI-generated before/after assets — same image set is referenced
  // from every vendor row to avoid duplicating ~3 MB JPGs per vendor.
  function portfolioAssetUrl(categoryId, variantSuffix, kind) {
    return '/assets/mobile-barber/portfolio/' + categoryId + '-' + variantSuffix + '-' + kind + '.jpg';
  }
  function portfolioClipUrl(categoryId, variantSuffix) {
    return '/assets/mobile-barber/clips/' + categoryId + '-' + variantSuffix + '.mp4';
  }

  function buildAIPortfolioForVendor(vendorId, vendorOrderOffset) {
    var rows = [];
    AI_PORTFOLIO_CATEGORIES.forEach(function(category, categoryIndex) {
      AI_PORTFOLIO_VARIANTS.forEach(function(variant, variantIndex) {
        var beforeUrl = portfolioAssetUrl(category.id, variant.suffix, 'before');
        var afterUrl = portfolioAssetUrl(category.id, variant.suffix, 'after');
        var clipUrl = portfolioClipUrl(category.id, variant.suffix);
        rows.push(Object.freeze({
          id: vendorId + '-ai-' + category.id + '-' + variant.suffix,
          vendorId: vendorId,
          title: category.title + ' — before and after (' + variant.tag + ')',
          description: category.description + ' AI-generated style preview. Real barber portfolio coming soon.',
          imageUrl: afterUrl,
          beforeImageUrl: beforeUrl,
          afterImageUrl: afterUrl,
          clipUrl: clipUrl,
          alt: category.title + ' before and after sample preview',
          displayOrder: vendorOrderOffset + (categoryIndex * 10) + variantIndex + 1,
          hidden: false,
          createdAt: SEED_TIMESTAMP,
          updatedAt: SEED_TIMESTAMP,
          category: category.id,
          active: true,
          isAIGenerated: true,
          requiresReplacementWithRealWork: true,
          beforeImagePrompt: category.beforeBase + ', ' + variant.extra,
          afterImagePrompt: category.afterBase + ', ' + variant.extra
        }));
      });
    });
    return rows;
  }

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
  ].concat(buildAIPortfolioForVendor(MICHAEL_VENDOR_ID, 100))
   .concat(buildAIPortfolioForVendor(TIM_VENDOR_ID, 100)));

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
    }),
    Object.freeze({
      id: 'michael-review-1',
      vendorId: MICHAEL_VENDOR_ID,
      customerName: 'Hung P.',
      rating: 5,
      body: 'Great fade service at home. Sharp blend and clean lineup.',
      serviceName: 'Fade Haircut',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-20T17:00:00.000Z',
      updatedAt: '2026-05-20T17:00:00.000Z'
    }),
    Object.freeze({
      id: 'michael-review-2',
      vendorId: MICHAEL_VENDOR_ID,
      customerName: 'Linda V.',
      rating: 5,
      body: 'Very convenient. My son sat still the whole time and his cut looked great.',
      serviceName: 'Kids Haircut',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-18T15:30:00.000Z',
      updatedAt: '2026-05-18T15:30:00.000Z'
    }),
    Object.freeze({
      id: 'michael-review-3',
      vendorId: MICHAEL_VENDOR_ID,
      customerName: 'David N.',
      rating: 4.8,
      body: 'Professional and punctual. Easy to book and clean in-home service.',
      serviceName: 'Business Style Haircut',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-15T14:00:00.000Z',
      updatedAt: '2026-05-15T14:00:00.000Z'
    }),
    Object.freeze({
      id: 'michael-review-4',
      vendorId: MICHAEL_VENDOR_ID,
      customerName: 'Anh Q.',
      rating: 5,
      body: 'Great beard cleanup and fade combo. Will book again.',
      serviceName: 'Haircut and Beard',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-12T18:00:00.000Z',
      updatedAt: '2026-05-12T18:00:00.000Z'
    }),
    Object.freeze({
      id: 'michael-review-5',
      vendorId: MICHAEL_VENDOR_ID,
      customerName: 'Bao L.',
      rating: 4.9,
      body: 'Excellent with kids and seniors. Did my dad and son back to back.',
      serviceName: 'Home Family Package',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-10T16:00:00.000Z',
      updatedAt: '2026-05-10T16:00:00.000Z'
    }),
    Object.freeze({
      id: 'tim-review-1',
      vendorId: TIM_VENDOR_ID,
      customerName: 'Kevin H.',
      rating: 5,
      body: 'Clean modern taper and very professional. Showed up right on time.',
      serviceName: 'Taper Fade',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-19T19:00:00.000Z',
      updatedAt: '2026-05-19T19:00:00.000Z'
    }),
    Object.freeze({
      id: 'tim-review-2',
      vendorId: TIM_VENDOR_ID,
      customerName: 'Maria S.',
      rating: 4.9,
      body: 'Great beard cleanup at home in San Jose. Tidy setup and easy booking.',
      serviceName: 'Beard Trim',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-17T17:30:00.000Z',
      updatedAt: '2026-05-17T17:30:00.000Z'
    }),
    Object.freeze({
      id: 'tim-review-3',
      vendorId: TIM_VENDOR_ID,
      customerName: 'Tony M.',
      rating: 5,
      body: 'Excellent with my dad in the senior community. Patient and very kind.',
      serviceName: 'Senior Haircut',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-14T15:00:00.000Z',
      updatedAt: '2026-05-14T15:00:00.000Z'
    }),
    Object.freeze({
      id: 'tim-review-4',
      vendorId: TIM_VENDOR_ID,
      customerName: 'Jenny T.',
      rating: 5,
      body: 'Very convenient mobile service. Family of four done in one visit.',
      serviceName: 'Home Family Package',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-11T18:30:00.000Z',
      updatedAt: '2026-05-11T18:30:00.000Z'
    }),
    Object.freeze({
      id: 'tim-review-5',
      vendorId: TIM_VENDOR_ID,
      customerName: 'Ricardo V.',
      rating: 4.8,
      body: 'Professional and punctual. Clean fade and great line up.',
      serviceName: 'Fade Haircut',
      lang: 'en',
      hidden: false,
      vendorResponse: '',
      createdAt: '2026-05-09T16:00:00.000Z',
      updatedAt: '2026-05-09T16:00:00.000Z'
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
    ['wearRatePerMile', 'freeTravelMiles', 'customQuoteMiles', 'minimumMobileVisitPrice', 'minimumHourlyTarget'].forEach(function(field) {
      if (vendor[field] != null) requireNumber(vendor, field, errors, { min: 0 });
    });
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
    var hasMedia = hasText(image.imageUrl) || hasText(image.beforeImageUrl) || hasText(image.afterImageUrl);
    var hasPrompt = hasText(image.beforeImagePrompt) || hasText(image.afterImagePrompt);
    if (!hasMedia && !hasPrompt) {
      errors.push('portfolio image must include imageUrl, before/after URLs, or AI image prompt metadata.');
    }
    if (image.active != null && typeof image.active !== 'boolean') {
      errors.push('active must be boolean when present.');
    }
    if (image.isAIGenerated != null && typeof image.isAIGenerated !== 'boolean') {
      errors.push('isAIGenerated must be boolean when present.');
    }
    if (image.requiresReplacementWithRealWork != null && typeof image.requiresReplacementWithRealWork !== 'boolean') {
      errors.push('requiresReplacementWithRealWork must be boolean when present.');
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

  function validateServiceImage(image, opts) {
    var errors = [];
    opts = opts || {};
    if (!isPlainObject(image)) return { valid: false, errors: ['service image must be an object.'] };
    hasOnlyKnownFields(image, SERVICE_IMAGE_FIELDS, errors, 'service image');
    ['serviceId', 'vendorId', 'imageUrl', 'imagePrompt', 'imageAlt', 'category'].forEach(function(field) {
      requireText(image, field, errors);
    });
    if (typeof image.isAIGenerated !== 'boolean') errors.push('isAIGenerated must be boolean.');
    if (typeof image.active !== 'boolean') errors.push('active must be boolean.');
    if (opts.vendorIds && opts.vendorIds.indexOf(image.vendorId) < 0) {
      errors.push('service image vendorId does not match a known mobile barber vendor.');
    }
    if (opts.serviceIds && opts.serviceIds.indexOf(image.serviceId) < 0) {
      errors.push('service image serviceId does not match a known mobile barber service.');
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
    if (booking.travelFee != null) requireNumber(booking, 'travelFee', errors, { min: 0 });
    ['vehicleWearCost', 'distanceAdjustment', 'peakAdjustment', 'amountDue', 'totalPrice', 'estimatedDistanceMiles', 'estimatedTravelMinutes'].forEach(function(field) {
      if (booking[field] != null) requireNumber(booking, field, errors, { min: 0 });
    });
    if (hasText(booking.paymentMethod) && ['cash', 'zelle', 'unknown'].indexOf(booking.paymentMethod) < 0) {
      errors.push('paymentMethod is not supported.');
    }
    if (hasText(booking.paymentStatus) && ['unpaid', 'pending', 'paid', 'waived'].indexOf(booking.paymentStatus) < 0) {
      errors.push('paymentStatus is not supported.');
    }

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

  function listServiceImagesForVendor(vendorId, images) {
    images = images || sampleServiceImages;
    return images.filter(function(image) {
      return image.vendorId === vendorId && image.active !== false;
    });
  }

  function findServiceImageByServiceId(serviceId, images) {
    images = images || sampleServiceImages;
    for (var i = 0; i < images.length; i++) {
      if (images[i].serviceId === serviceId && images[i].active !== false) return images[i];
    }
    return null;
  }

  // Maps an AI portfolio category id to a SERVICE_IMAGE_TEMPLATES slug so the
  // empty before/after placeholder cards can carry a representative photo.
  // Portfolio category vocabulary is similar but not identical to the service
  // slug vocabulary, so we map explicitly and fall back to classic-haircut.
  var PORTFOLIO_CATEGORY_TO_SERVICE_SLUG = Object.freeze({
    'fade':             'fade-haircut',
    'skin-fade':        'skin-fade',
    'taper-fade':       'taper-fade',
    'modern-taper':     'taper-fade',
    'kids-haircut':     'kids-haircut',
    'senior-haircut':   'senior-haircut',
    'business-haircut': 'business-haircut',
    'beard-cleanup':    'beard-trim',
    'beard-trim':       'beard-trim',
    'hair-beard':       'haircut-beard',
    'line-up':          'line-up',
    'family-haircut':   'home-family-package',
    'classic-haircut':  'classic-haircut',
    'modern-styling':   'modern-styling',
    'buzz-cut':         'buzz-cut'
  });

  function findServiceImageByPortfolioCategory(category) {
    var slug = PORTFOLIO_CATEGORY_TO_SERVICE_SLUG[category] || 'classic-haircut';
    var tmpl = SERVICE_IMAGE_TEMPLATES[slug] || SERVICE_IMAGE_TEMPLATES['classic-haircut'];
    if (!tmpl) return null;
    return {
      imageUrl:    tmpl.imageUrl,
      imageAlt:    tmpl.imageAlt,
      imagePrompt: tmpl.imagePrompt
    };
  }

  function listPortfolioForVendor(vendorId, images, includeHidden) {
    images = images || samplePortfolioImages;
    return images.filter(function(image) {
      if (image.vendorId !== vendorId) return false;
      if (includeHidden) return true;
      if (image.hidden === true) return false;
      if (image.active === false) return false;
      return true;
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
      serviceImages: sampleServiceImages.slice(),
      availability: sampleAvailability.slice(),
      portfolioImages: samplePortfolioImages.slice(),
      reviews: sampleReviews.slice(),
      bookings: [],
      customers: [],
      agentSessions: []
    };
  }

  function cloneForFirestore(doc) {
    var copy = JSON.parse(JSON.stringify(doc || {}));
    delete copy.geminiKey;
    delete copy.openaiKey;
    return copy;
  }

  function seedCollectionFromSamples(db, collectionName, rows) {
    rows = rows || [];
    return rows.map(function(row) {
      var doc = cloneForFirestore(row);
      return db.collection(collectionName).doc(doc.id).set(doc, { merge: true });
    });
  }

  function seedFirestoreFromSamples(db) {
    if (!db || typeof db.collection !== 'function') {
      return Promise.reject(new Error('Firestore db is required.'));
    }
    var writes = []
      .concat(seedCollectionFromSamples(db, COLLECTIONS.vendors, sampleVendors))
      .concat(seedCollectionFromSamples(db, COLLECTIONS.services, sampleServices))
      .concat(seedCollectionFromSamples(db, COLLECTIONS.availability, sampleAvailability));
    return Promise.all(writes);
  }

  return {
    COLLECTIONS: COLLECTIONS,
    VENDOR_FIELDS: VENDOR_FIELDS,
    SERVICE_FIELDS: SERVICE_FIELDS,
    SERVICE_IMAGE_FIELDS: SERVICE_IMAGE_FIELDS,
    BOOKING_FIELDS: BOOKING_FIELDS,
    CUSTOMER_FIELDS: CUSTOMER_FIELDS,
    PORTFOLIO_IMAGE_FIELDS: PORTFOLIO_IMAGE_FIELDS,
    REVIEW_FIELDS: REVIEW_FIELDS,
    SERVICE_BADGES: SERVICE_BADGES,
    BOOKING_STATUSES: BOOKING_STATUSES,
    BOOKING_SOURCES: BOOKING_SOURCES,
    SAMPLE_VENDOR_ID: SAMPLE_VENDOR_ID,
    MICHAEL_VENDOR_ID: MICHAEL_VENDOR_ID,
    TIM_VENDOR_ID: TIM_VENDOR_ID,
    SERVICE_IMAGE_TEMPLATES: SERVICE_IMAGE_TEMPLATES,
    SERVICE_IMAGE_DISCLOSURE: SERVICE_IMAGE_DISCLOSURE,
    listStyleTemplates: listStyleTemplates,
    AI_PORTFOLIO_CATEGORIES: AI_PORTFOLIO_CATEGORIES,
    buildAIPortfolioForVendor: buildAIPortfolioForVendor,
    sampleVendors: sampleVendors,
    sampleServices: sampleServices,
    sampleServiceImages: sampleServiceImages,
    sampleAvailability: sampleAvailability,
    samplePortfolioImages: samplePortfolioImages,
    sampleReviews: sampleReviews,
    validateVendor: validateVendor,
    validateService: validateService,
    validateServiceImage: validateServiceImage,
    validateBooking: validateBooking,
    validateCustomer: validateCustomer,
    validatePortfolioImage: validatePortfolioImage,
    validateReview: validateReview,
    findVendorById: findVendorById,
    listServicesForVendor: listServicesForVendor,
    listServiceImagesForVendor: listServiceImagesForVendor,
    findServiceImageByServiceId: findServiceImageByServiceId,
    findServiceImageByPortfolioCategory: findServiceImageByPortfolioCategory,
    PORTFOLIO_CATEGORY_TO_SERVICE_SLUG: PORTFOLIO_CATEGORY_TO_SERVICE_SLUG,
    listPortfolioForVendor: listPortfolioForVendor,
    listReviewsForVendor: listReviewsForVendor,
    createSeedPayload: createSeedPayload,
    seedFirestoreFromSamples: seedFirestoreFromSamples
  };
});
