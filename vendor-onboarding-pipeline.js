/**
 * vendor-onboarding-pipeline.js
 *
 * Core pipeline for automatic vendor generation.
 * Exposes a single global: window.VendorOnboarding
 *
 * Sections:
 *   1. SCHEMA    — canonical defaults & category packs
 *   2. NORMALIZE — deterministic input → structured data (rules-first)
 *   3. AI        — Claude-via-aiProxy content generation + fallbacks
 *   4. VALIDATE  — output validation before any Firestore write
 *   5. PUBLISH   — writes vendor doc + subcollections to Firestore
 *   6. PREVIEW   — build pre-publish HTML summary
 */

/* global firebase */
'use strict';

window.VendorOnboarding = (() => {

  // ============================================================
  // 1. SCHEMA — canonical defaults + category module packs
  // ============================================================

  /**
   * All valid top-level fields with safe defaults.
   * AI may only populate keys in GENERATED_FIELDS.
   * All other fields must come from normalized input or defaults.
   */
  const SCHEMA_DEFAULTS = {
    // Core identity
    id:              '',
    name:            '',
    category:        '',          // 'nails' | 'hair' | 'food'
    adminStatus:     'pending',   // 'pending' → 'active' on publish
    active:          false,

    // Business details
    businessName:    '',
    tagline:         '',
    taglineI18n:     { en: '', vi: '', es: '' },
    phone:           '',
    phoneDisplay:    '',
    email:           '',
    website:         '',
    contactPerson:   '',

    // Location
    address:         '',
    city:            '',
    state:           'CA',
    zip:             '',
    region:          '',          // 'Orange County' | 'Bay Area' | 'Los Angeles'
    serviceArea:     [],

    // Languages
    primaryLanguage:     'vi',
    supportedLanguages:  ['vi', 'en'],

    // Hours (weekly schedule)
    hours: {
      mon: { open: '09:00', close: '18:00', closed: false },
      tue: { open: '09:00', close: '18:00', closed: false },
      wed: { open: '09:00', close: '18:00', closed: false },
      thu: { open: '09:00', close: '18:00', closed: false },
      fri: { open: '09:00', close: '18:00', closed: false },
      sat: { open: '09:00', close: '18:00', closed: false },
      sun: { open: '10:00', close: '16:00', closed: false },
    },
    specialHoursNotes: '',

    // Media
    heroImage:     '',
    logoUrl:       '',
    galleryImages: [],
    heroGradient:  'linear-gradient(135deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.25) 100%)',

    // Platform config
    setupCode:         '',
    featured:          false,
    featuredPriority:  0,
    featuredRegions:   [],
    homepageActive:    false,

    // AI-generated storefront content (all editable after publish)
    storefront: {
      shortDescription: '',
      longDescription:  '',
      heroText:         '',
      tags:             [],
      faqs:             [],        // [{q, a}, ...]
      policies: {
        cancellation: '',
        deposit:      '',
        leadTime:     '',
        notes:        '',
      },
      suggestedUpsells: [],
    },

    // AI context block — powers the AI receptionist for this vendor
    aiContext: {
      greeting:          '',
      businessSummary:   '',
      tone:              'friendly',  // 'friendly' | 'professional' | 'casual'
      upsellInstructions: '',
      specialInstructions: '',
    },

    // Onboarding state (not shown to customers, used internally)
    onboarding: {
      status:         'draft',   // 'draft' | 'ai_generated' | 'review' | 'published'
      rawInput:       {},        // exactly what vendor/admin entered
      normalizedAt:   null,
      aiGeneratedAt:  null,
      publishedAt:    null,
    },

    // Category-specific offerings (see CATEGORY_PACKS for defaults)
    // Salons: services array (also written to /services subcollection)
    services: [],
    // Food: menuItems written directly to /menuItems subcollection
    // (not embedded in vendor doc — matches existing architecture)
    defaultDailyCapacity: 300,

    // Standard timestamps
    createdAt: null,
    updatedAt: null,
    createdBy: 'admin',
  };

  /**
   * Fields that AI is allowed to populate.
   * Any AI output key NOT in this list is silently dropped.
   */
  const GENERATED_FIELDS = new Set([
    'tagline',
    'taglineI18n',
    'storefront.shortDescription',
    'storefront.longDescription',
    'storefront.heroText',
    'storefront.tags',
    'storefront.faqs',
    'storefront.policies.cancellation',
    'storefront.policies.deposit',
    'storefront.policies.notes',
    'storefront.suggestedUpsells',
    'aiContext.greeting',
    'aiContext.businessSummary',
    'aiContext.upsellInstructions',
  ]);

  /**
   * Category-specific module packs.
   * Each pack includes:
   *   - modules[]  : feature modules enabled for this category
   *   - defaultServices[] : seed services for salons
   *   - portalAdmin: which admin page to use
   *   - marketplaceInit: Marketplace.init() arg
   */
  const CATEGORY_PACKS = {

    nails: {
      modules: ['profile', 'hours', 'gallery', 'services', 'staff',
                'booking', 'policies', 'ai_receptionist', 'notifications'],
      portalAdmin: '/salon-admin.html',
      marketplaceInit: 'nails',
      vendorType: null,
      defaultServices: [
        { category: 'manicure',  name: 'Basic Manicure',   priceFrom: 18,  durationMins: 30,  active: true, desc: 'Classic manicure with nail shaping, cuticle care, and polish.' },
        { category: 'manicure',  name: 'Gel Manicure',     priceFrom: 35,  durationMins: 45,  active: true, desc: 'Long-lasting gel polish with UV cure. Chip-free for up to 3 weeks.' },
        { category: 'pedicure',  name: 'Basic Pedicure',   priceFrom: 25,  durationMins: 45,  active: true, desc: 'Relaxing foot soak, exfoliation, massage, and polish.' },
        { category: 'pedicure',  name: 'Spa Pedicure',     priceFrom: 45,  durationMins: 60,  active: true, desc: 'Deluxe pedicure with extended massage, hot towel, and mask.' },
        { category: 'acrylic',   name: 'Acrylic Full Set', priceFrom: 45,  durationMins: 75,  active: true, desc: 'Full set acrylic nails, length and shape of your choice.' },
        { category: 'gel',       name: 'Gel Full Set',     priceFrom: 55,  durationMins: 75,  active: true, desc: 'Beautiful gel nail extensions for natural-looking length.' },
        { category: 'addon',     name: 'Nail Art (per nail)', priceFrom: 5, durationMins: 15, active: true, desc: 'Custom nail art designs. Price per nail.' },
      ],
      defaultStaff: [],
    },

    hair: {
      modules: ['profile', 'hours', 'gallery', 'services', 'staff',
                'booking', 'policies', 'ai_receptionist', 'notifications'],
      portalAdmin: '/salon-admin.html',
      marketplaceInit: 'hair',
      vendorType: null,
      defaultServices: [
        { category: 'cut',     name: 'Haircut (Women)',   priceFrom: 45,  durationMins: 60,  active: true, desc: 'Professional cut and style with blowout finish.' },
        { category: 'cut',     name: 'Haircut (Men)',     priceFrom: 25,  durationMins: 30,  active: true, desc: 'Clean, precise haircut tailored to your style.' },
        { category: 'blowout', name: 'Blowout',           priceFrom: 35,  durationMins: 45,  active: true, desc: 'Professional blowout for smooth, shiny, voluminous results.' },
        { category: 'color',   name: 'Single Process Color', priceFrom: 65, durationMins: 90, active: true, desc: 'Full color application for a fresh, vibrant look.' },
        { category: 'color',   name: 'Highlights',        priceFrom: 85,  durationMins: 120, active: true, desc: 'Partial or full highlights for dimension and brightness.' },
        { category: 'treatment', name: 'Deep Conditioning', priceFrom: 30, durationMins: 30, active: true, desc: 'Intensive moisture treatment for healthy, nourished hair.' },
      ],
      defaultStaff: [],
    },

    food: {
      modules: ['profile', 'hours', 'gallery', 'menu', 'order',
                'policies', 'notifications'],
      portalAdmin: '/vendor-admin.html',
      marketplaceInit: 'food',
      vendorType: 'foodvendor',
      defaultMenuItems: [],  // Food vendors add their own menu — no defaults
    },

  };

  // ============================================================
  // 2. NORMALIZE — deterministic, rules-first normalization
  // ============================================================

  const Normalizer = {

    /** Convert business name to URL-safe vendor ID */
    normalizeId(name, region) {
      const base = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 35);

      const regionSlug = {
        'Orange County': 'oc', 'Bay Area': 'ba', 'Los Angeles': 'la'
      }[region] || '';

      return regionSlug ? `${base}-${regionSlug}` : base;
    },

    /** Normalize category string to canonical value */
    normalizeCategory(raw) {
      const v = (raw || '').toLowerCase().trim();
      if (v === 'nails' || v === 'nail')  return 'nails';
      if (v === 'hair')                   return 'hair';
      if (v === 'food' || v === 'restaurant' || v === 'foodvendor') return 'food';
      return v;
    },

    /** Normalize region string */
    normalizeRegion(raw) {
      const v = (raw || '').toLowerCase().trim();
      if (v === 'oc' || v === 'orange county' || v === 'irvine' || v === 'anaheim') return 'Orange County';
      if (v === 'bay area' || v === 'sf' || v === 'san francisco' || v === 'san jose' || v === 'ba') return 'Bay Area';
      if (v === 'la' || v === 'los angeles' || v === 'socal') return 'Los Angeles';
      return raw || 'Orange County';
    },

    /** Normalize phone number to display format */
    normalizePhone(raw) {
      if (!raw) return { phone: '', phoneDisplay: '' };
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 10) {
        return {
          phone: digits,
          phoneDisplay: `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`,
        };
      }
      if (digits.length === 11 && digits[0] === '1') {
        const d = digits.slice(1);
        return {
          phone: d,
          phoneDisplay: `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`,
        };
      }
      return { phone: digits, phoneDisplay: raw };
    },

    /** Normalize language list to canonical codes */
    normalizeLanguages(raw) {
      if (!raw) return ['vi', 'en'];
      const input = Array.isArray(raw) ? raw : [raw];
      const MAP = {
        'vietnamese': 'vi', 'tiếng việt': 'vi', 'vi': 'vi',
        'english':    'en', 'en': 'en',
        'spanish':    'es', 'español': 'es', 'es': 'es',
      };
      const out = new Set();
      input.forEach(lang => {
        const code = MAP[(lang || '').toLowerCase().trim()];
        if (code) out.add(code);
      });
      if (out.size === 0) out.add('vi');
      return Array.from(out);
    },

    /** Normalize raw hours input (object with day keys) into structured schedule */
    normalizeHours(rawHours) {
      const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
      const defaults = SCHEMA_DEFAULTS.hours;
      if (!rawHours || typeof rawHours !== 'object') return Object.assign({}, defaults);

      const out = {};
      DAYS.forEach(day => {
        const raw = rawHours[day] || {};
        out[day] = {
          open:   raw.open   || defaults[day].open,
          close:  raw.close  || defaults[day].close,
          closed: !!raw.closed,
        };
      });
      return out;
    },

    /** Build a salon service record from raw input */
    _normalizeService(raw) {
      return {
        category:      raw.category    || 'manicure',
        name:          raw.name        || 'Service',
        price:         raw.price       || '',
        priceFrom:     Number(raw.priceFrom || raw.price || 0),
        duration:      raw.duration    || '30 mins',
        durationMins:  Number(raw.durationMins || 30),
        active:        raw.active !== false,
        assignedStaff: Array.isArray(raw.assignedStaff) ? raw.assignedStaff : [],
        imageUrl:      raw.imageUrl    || '',
        desc:          raw.desc        || '',
        createdAt:     null,
      };
    },

    /** Build a food menu item record from raw input */
    _normalizeMenuItem(raw) {
      return {
        canonicalId:  raw.canonicalId || raw.id || '',
        name:         raw.name        || raw.nameEn || 'Item',
        nameEn:       raw.nameEn      || raw.name  || '',
        nameVi:       raw.nameVi      || '',
        description:  raw.description || '',
        price:        Number(raw.price || 0),
        priceFrom:    Number(raw.priceFrom || raw.price || 0),
        category:     raw.category    || 'mains',
        active:       raw.active !== false,
        imageUrl:     raw.imageUrl    || '',
        variants:     Array.isArray(raw.variants) ? raw.variants : [],
        createdAt:    null,
        updatedAt:    null,
      };
    },

    /**
     * Main normalization pipeline.
     * @param {Object} rawInput — raw form data from onboarding UI
     * @returns {Object} normalized vendor data
     */
    run(rawInput) {
      const r = rawInput || {};
      const category  = this.normalizeCategory(r.category);
      const region    = this.normalizeRegion(r.region);
      const phones    = this.normalizePhone(r.phone);
      const languages = this.normalizeLanguages(r.languages);
      const name      = (r.name || r.businessName || '').trim();
      const id        = r.id
        ? r.id.toLowerCase().replace(/[^a-z0-9-]/g, '-')
        : this.normalizeId(name, region);

      const pack = CATEGORY_PACKS[category] || {};

      // Services: use provided list or category defaults
      const services = Array.isArray(r.services) && r.services.length > 0
        ? r.services.map(s => this._normalizeService(s))
        : (pack.defaultServices || []).map(s => this._normalizeService(s));

      // Menu items: only for food vendors
      const menuItems = category === 'food' && Array.isArray(r.menuItems)
        ? r.menuItems.map(m => this._normalizeMenuItem(m))
        : [];

      // Deep-clone SCHEMA_DEFAULTS to start from a clean base
      const out = JSON.parse(JSON.stringify(SCHEMA_DEFAULTS));

      // Apply normalized values
      Object.assign(out, {
        id,
        name,
        category,
        businessName:         name,
        region,
        city:                 (r.city || '').trim(),
        state:                (r.state || 'CA').trim(),
        zip:                  (r.zip  || '').trim(),
        address:              (r.address || '').trim(),
        phone:                phones.phone,
        phoneDisplay:         phones.phoneDisplay,
        email:                (r.email   || '').trim(),
        website:              (r.website || '').trim(),
        contactPerson:        (r.contactPerson || '').trim(),
        setupCode:            String(r.setupCode || '').trim(),
        primaryLanguage:      languages[0] || 'vi',
        supportedLanguages:   languages,
        heroImage:            (r.heroImage || '').trim(),
        logoUrl:              (r.logoUrl   || '').trim(),
        galleryImages:        Array.isArray(r.galleryImages) ? r.galleryImages : [],
        heroGradient:         r.heroGradient || SCHEMA_DEFAULTS.heroGradient,
        hours:                this.normalizeHours(r.hours),
        specialHoursNotes:    (r.specialHoursNotes || '').trim(),
        serviceArea:          Array.isArray(r.serviceArea) ? r.serviceArea : [region],
        services,
        menuItems,
        defaultDailyCapacity: Number(r.defaultDailyCapacity || 300),
      });

      // food vendor flag (for marketplace.js food rendering)
      if (category === 'food') {
        out.vendorType = 'foodvendor';
      }

      // Policies from raw input (these go into storefront.policies)
      out.storefront.policies = {
        cancellation: (r.cancellation || '').trim(),
        deposit:      (r.deposit      || '').trim(),
        leadTime:     (r.leadTime     || '').trim(),
        notes:        (r.policyNotes  || '').trim(),
      };

      // AI context hints from raw input
      out.aiContext.tone               = r.tone               || 'friendly';
      out.aiContext.upsellInstructions = (r.upsellPreferences || '').trim();
      out.aiContext.specialInstructions = (r.specialInstructions || '').trim();

      // Onboarding metadata
      out.onboarding.rawInput = JSON.parse(JSON.stringify(r));
      out.onboarding.normalizedAt = new Date().toISOString();

      return out;
    },
  };

  // ============================================================
  // 3. AI GENERATOR — calls aiProxy Firebase Function
  // ============================================================

  const AIGenerator = {

    /**
     * Build the AI prompt from normalized vendor data.
     * Returns { system, userContent }.
     */
    buildPrompt(normalized) {
      const cat = normalized.category;
      const catLabel = { nails: 'nail salon', hair: 'hair salon', food: 'food vendor' }[cat] || cat;
      const region = normalized.region || 'California';
      const services = (normalized.services || [])
        .slice(0, 6)
        .map(s => `${s.name} ($${s.priceFrom})`)
        .join(', ');
      const menuItems = (normalized.menuItems || [])
        .slice(0, 6)
        .map(m => m.name)
        .join(', ');
      const offerings = cat === 'food' ? menuItems : services;
      const langs = (normalized.supportedLanguages || ['vi','en'])
        .map(l => ({ vi:'Vietnamese', en:'English', es:'Spanish' }[l] || l))
        .join(' and ');

      const system = [
        'You are a professional business content writer for Du Lịch Cali, a Vietnamese-American service platform in California.',
        'Write natural, warm, conversion-focused copy for local small businesses serving Vietnamese and English-speaking customers.',
        'Keep all text concise. Use inclusive, welcoming language.',
        'Return ONLY valid JSON. No explanation, no markdown, no code fences.',
      ].join(' ');

      const userContent = JSON.stringify({
        task: 'Generate vendor storefront content. Return JSON with exactly these keys.',
        vendorName: normalized.name,
        category: catLabel,
        region,
        offerings: offerings || 'professional services',
        languages: langs,
        tone: normalized.aiContext.tone || 'friendly',
        customNotes: normalized.aiContext.specialInstructions || '',
        requiredOutput: {
          tagline: 'Short catchy tagline (max 12 words). Vietnamese-inspired if applicable.',
          taglineEn: 'Same tagline in English.',
          taglineVi: 'Same tagline in Vietnamese.',
          taglineEs: 'Same tagline in Spanish.',
          shortDescription: '2-3 sentence business description (max 80 words). Focus on quality and welcome.',
          longDescription: '4-6 sentence detailed description (max 200 words). Mention services, experience, customer focus.',
          heroText: 'Short hero section tagline (max 10 words). Exciting, action-oriented.',
          tags: 'Array of 5-8 relevant category/service/location tags.',
          faqs: 'Array of 3-4 FAQ objects: [{q: string, a: string}]',
          policyCancel: 'Friendly 1-sentence cancellation policy for a small business.',
          policyDeposit: 'Friendly 1-sentence deposit note (or "No deposit required." if none).',
          greeting: 'AI receptionist greeting (1-2 sentences). Warm, multilingual-aware.',
          businessSummary: 'AI knowledge base summary of this vendor (3-5 sentences). Factual, includes offerings and location.',
          upsells: 'Array of 2-3 natural upsell suggestions appropriate for this vendor type.',
        },
      });

      return { system, userContent };
    },

    /**
     * Call aiProxy Firebase Function to generate content.
     * Falls back to deterministic defaults if AI fails or returns invalid JSON.
     */
    async generate(normalized) {
      const { system, userContent } = this.buildPrompt(normalized);

      let aiRaw = null;
      let aiError = null;

      try {
        const fn = firebase.functions().httpsCallable('aiProxy');
        const result = await fn({
          provider: 'claude',
          system,
          messages: [{ role: 'user', content: userContent }],
          maxTokens: 1200,
          jsonMode: true,
        });

        if (result.data && result.data.ok && result.data.text) {
          const text = result.data.text.trim();
          // Strip any accidental markdown code fences
          const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
          aiRaw = JSON.parse(clean);
        } else {
          aiError = (result.data && result.data.debugCode) || 'AI_FAILED';
        }
      } catch (err) {
        aiError = err.message || 'CALL_ERROR';
        console.warn('[VendorAI] aiProxy call failed:', aiError);
      }

      // Validate AI output — only keep safe, schema-defined keys
      const validated = aiRaw ? this._validateOutput(aiRaw, normalized) : null;

      if (!validated) {
        console.warn('[VendorAI] Falling back to deterministic defaults. Error:', aiError);
        return this._buildFallback(normalized);
      }

      return validated;
    },

    /**
     * Validate and sanitize AI output.
     * Returns null if output is fundamentally malformed.
     */
    _validateOutput(raw, normalized) {
      if (!raw || typeof raw !== 'object') return null;

      const name = normalized.name || 'us';
      const region = normalized.region || 'California';

      // Each field is validated individually; malformed → fallback
      const s = str => (typeof raw[str] === 'string' && raw[str].trim().length > 0)
        ? raw[str].trim().substring(0, 500)
        : null;

      const arr = key => Array.isArray(raw[key]) ? raw[key] : null;

      const shortDesc = s('shortDescription');
      const longDesc  = s('longDescription');
      const heroText  = s('heroText');
      const tagline   = s('tagline');

      // Must have at least the basic generated fields
      if (!shortDesc || !tagline) return null;

      // Validate FAQs structure
      let faqs = [];
      if (arr('faqs')) {
        faqs = raw.faqs
          .filter(f => f && typeof f.q === 'string' && typeof f.a === 'string')
          .slice(0, 5)
          .map(f => ({ q: f.q.trim().substring(0, 200), a: f.a.trim().substring(0, 400) }));
      }

      // Validate tags
      let tags = [];
      if (arr('tags')) {
        tags = raw.tags
          .filter(t => typeof t === 'string')
          .slice(0, 10)
          .map(t => t.trim().toLowerCase().substring(0, 40));
      }

      // Validate upsells
      let upsells = [];
      if (arr('upsells')) {
        upsells = raw.upsells
          .filter(u => typeof u === 'string')
          .slice(0, 4)
          .map(u => u.trim().substring(0, 100));
      }

      const fb = this._buildFallback(normalized);

      return {
        tagline:                tagline  || fb.tagline,
        taglineI18n: {
          en: s('taglineEn') || tagline  || fb.taglineI18n.en,
          vi: s('taglineVi') || tagline  || fb.taglineI18n.vi,
          es: s('taglineEs') || tagline  || fb.taglineI18n.es,
        },
        storefront: {
          shortDescription: shortDesc || fb.storefront.shortDescription,
          longDescription:  longDesc  || fb.storefront.longDescription,
          heroText:         heroText  || fb.storefront.heroText,
          tags,
          faqs,
          policies: {
            cancellation: s('policyCancel')   || fb.storefront.policies.cancellation,
            deposit:      s('policyDeposit')  || fb.storefront.policies.deposit,
            leadTime:     '',
            notes:        '',
          },
          suggestedUpsells: upsells,
        },
        aiContext: {
          greeting:          s('greeting')         || fb.aiContext.greeting,
          businessSummary:   s('businessSummary')  || fb.aiContext.businessSummary,
          upsellInstructions: upsells.join('; '),
          specialInstructions: normalized.aiContext.specialInstructions || '',
          tone: normalized.aiContext.tone || 'friendly',
        },
      };
    },

    /** Deterministic fallback content when AI is unavailable */
    _buildFallback(normalized) {
      const name     = normalized.name  || 'Our Business';
      const city     = normalized.city  || normalized.region || 'California';
      const cat      = normalized.category;
      const catLabel = { nails: 'nail salon', hair: 'hair salon', food: 'food vendor' }[cat] || 'business';

      const catCopy = {
        nails: {
          tagline: `Professional nail care in ${city}`,
          short: `${name} is a professional nail salon in ${city}. We provide high-quality nail services in a clean, welcoming environment, serving customers in Vietnamese and English.`,
          hero: 'Beautiful nails. Happy customers.',
          greeting: `Welcome to ${name}! I'm your AI assistant — I can help you book a nail appointment or answer any questions. How can I help?`,
          cancel: 'Please cancel at least 24 hours in advance to avoid a cancellation fee.',
        },
        hair: {
          tagline: `Expert hair care in ${city}`,
          short: `${name} is a professional hair salon in ${city}. Our skilled stylists offer cuts, color, and treatments in a relaxing atmosphere, serving clients in Vietnamese and English.`,
          hero: 'Great hair starts here.',
          greeting: `Welcome to ${name}! I can help you book a haircut or styling appointment. What service are you looking for?`,
          cancel: 'Please cancel or reschedule at least 24 hours in advance.',
        },
        food: {
          tagline: `Authentic flavors in ${city}`,
          short: `${name} offers authentic cuisine in ${city}. We prepare our food fresh daily with quality ingredients, serving our community with love and tradition.`,
          hero: 'Fresh. Authentic. Delicious.',
          greeting: `Welcome to ${name}! I can help you place an order or check our menu. What would you like today?`,
          cancel: 'Orders can be cancelled up to 1 hour before the scheduled pickup time.',
        },
      };

      const copy = catCopy[cat] || catCopy.food;

      return {
        tagline: copy.tagline,
        taglineI18n: { en: copy.tagline, vi: copy.tagline, es: copy.tagline },
        storefront: {
          shortDescription: copy.short,
          longDescription:  copy.short + ` We are conveniently located in ${city} and committed to excellent service for every customer.`,
          heroText:         copy.hero,
          tags:             [cat, city.toLowerCase(), 'vietnamese', 'professional', 'local'],
          faqs: [
            { q: 'Do I need an appointment?',    a: 'Walk-ins are welcome, but appointments are recommended for the best availability.' },
            { q: 'What payment methods do you accept?', a: 'We accept cash, Zelle, Venmo, and major credit cards.' },
            { q: 'Do you speak Vietnamese?',     a: 'Yes! We serve customers in Vietnamese, English, and Spanish.' },
          ],
          policies: {
            cancellation: copy.cancel,
            deposit:      'No deposit required.',
            leadTime:     '',
            notes:        '',
          },
          suggestedUpsells: [],
        },
        aiContext: {
          greeting:           copy.greeting,
          businessSummary:    `${name} is a ${catLabel} located in ${city}, ${normalized.region || 'California'}. ` +
                              `They serve customers in ${(normalized.supportedLanguages||['vi','en']).join(' and ')} ` +
                              `and specialize in providing quality ${catLabel} services to the local community.`,
          upsellInstructions: '',
          specialInstructions: normalized.aiContext.specialInstructions || '',
          tone: normalized.aiContext.tone || 'friendly',
        },
      };
    },
  };

  // ============================================================
  // 4. VALIDATE — gates writing to Firestore
  // ============================================================

  const Validator = {

    /**
     * Validate a fully assembled vendor object before publishing.
     * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
     */
    /**
     * @param {Object} vendor
     * @param {Object} [opts]
     * @param {boolean} [opts.skipSetupCode] — pass true in vendor-facing contexts where
     *   the setup code is not yet generated (admin assigns it on approval).
     */
    validate(vendor, opts) {
      opts = opts || {};
      const errors   = [];
      const warnings = [];

      if (!vendor.id)        errors.push('Vendor ID is required.');
      if (!vendor.name)      errors.push('Vendor name is required.');
      if (!vendor.category)  errors.push('Category is required.');
      if (!opts.skipSetupCode) {
        if (!vendor.setupCode) errors.push('Setup code (PIN) is required.');
        if (vendor.setupCode && vendor.setupCode.length < 4) errors.push('Setup code must be at least 4 characters.');
      }

      if (!['nails','hair','food'].includes(vendor.category)) {
        errors.push(`Unknown category "${vendor.category}". Must be nails, hair, or food.`);
      }

      if (!vendor.phone) warnings.push('No phone number provided — customers cannot call directly.');
      if (!vendor.heroImage) warnings.push('No hero image set — the storefront will show a placeholder.');
      if (!vendor.storefront.shortDescription) warnings.push('Short description is empty — add one in the vendor portal.');

      if (vendor.category !== 'food' && vendor.services.length === 0) {
        warnings.push('No services defined — vendor portal will show default services.');
      }

      const idRegex = /^[a-z0-9][a-z0-9-]{1,44}[a-z0-9]$/;
      if (vendor.id && !idRegex.test(vendor.id)) {
        errors.push(`Vendor ID "${vendor.id}" is invalid. Use only lowercase letters, numbers, and hyphens.`);
      }

      return { valid: errors.length === 0, errors, warnings };
    },
  };

  // ============================================================
  // 5. PUBLISHER — write to Firestore
  // ============================================================

  const Publisher = {

    /**
     * Merge normalized data + AI output into the final vendor document.
     * This is what gets written to Firestore.
     */
    buildVendorDocument(normalized, aiOutput) {
      const doc = JSON.parse(JSON.stringify(normalized));

      // Apply AI-generated content (safe merge — only schema-defined fields)
      if (aiOutput) {
        doc.tagline    = aiOutput.tagline    || doc.tagline;
        doc.taglineI18n = Object.assign({}, doc.taglineI18n, aiOutput.taglineI18n || {});

        if (aiOutput.storefront) {
          Object.assign(doc.storefront, aiOutput.storefront);
          // Keep vendor-entered policy text if AI left blanks
          const docPol = doc.onboarding.rawInput;
          if (!doc.storefront.policies.cancellation && docPol) {
            doc.storefront.policies.cancellation = docPol.cancellation || '';
          }
        }

        if (aiOutput.aiContext) {
          Object.assign(doc.aiContext, aiOutput.aiContext);
        }
      }

      // Derived convenience fields (what marketplace.js reads for listing)
      doc.description   = doc.storefront.shortDescription;
      doc.shortPromoText = doc.tagline;

      // Onboarding status
      doc.onboarding.status = 'review';
      if (aiOutput) doc.onboarding.aiGeneratedAt = new Date().toISOString();

      return doc;
    },

    /**
     * Publish vendor to Firestore.
     * Creates/updates:
     *   vendors/{id}                    — main vendor document
     *   vendors/{id}/services/{n}       — salon services (nails/hair)
     *   vendors/{id}/menuItems/{n}      — food menu items
     *   vendors/{id}/staff/placeholder  — empty staff doc (initializes collection)
     *
     * Does NOT overwrite an already-active vendor's data.
     */
    async publish(vendorDoc) {
      if (!window.firebase || !firebase.firestore) {
        throw new Error('Firestore not available');
      }

      const db   = firebase.firestore();
      const ts   = firebase.firestore.FieldValue.serverTimestamp();
      const id   = vendorDoc.id;
      const ref  = db.collection('vendors').doc(id);

      // Check if vendor already exists and is active — refuse overwrite
      const existing = await ref.get();
      if (existing.exists && existing.data().adminStatus === 'active') {
        throw new Error(`Vendor "${id}" is already active. Edit through the vendor portal instead.`);
      }

      // Build Firestore-safe document (remove transient fields)
      const { services, menuItems, ...docData } = vendorDoc;

      docData.adminStatus       = 'pending';
      docData.active            = false;
      docData.createdAt         = existing.exists ? existing.data().createdAt : ts;
      docData.updatedAt         = ts;
      docData.onboarding.status = 'published';
      docData.onboarding.publishedAt = new Date().toISOString();

      // Batch all writes
      const batch = db.batch();

      // 1. Main vendor document
      batch.set(ref, docData, { merge: true });

      // 2. Services subcollection (salons only)
      if ((vendorDoc.category === 'nails' || vendorDoc.category === 'hair') && services.length > 0) {
        services.forEach((svc, i) => {
          const svcRef = ref.collection('services').doc(`svc_${String(i).padStart(3,'0')}`);
          batch.set(svcRef, Object.assign({}, svc, { updatedAt: ts }));
        });
      }

      // 3. Menu items subcollection (food only)
      if (vendorDoc.category === 'food' && menuItems.length > 0) {
        menuItems.forEach((item, i) => {
          const itemRef = ref.collection('menuItems').doc(`item_${String(i).padStart(3,'0')}`);
          batch.set(itemRef, Object.assign({}, item, { updatedAt: ts }));
        });
      }

      // 4. Staff placeholder (initializes the staff subcollection for salon portals)
      if (vendorDoc.category === 'nails' || vendorDoc.category === 'hair') {
        batch.set(ref.collection('staff').doc('_placeholder'), {
          _placeholder: true, createdAt: ts,
        });
      }

      await batch.commit();
      return { id, adminStatus: 'pending' };
    },

    /**
     * Save as draft only (adminStatus: 'draft', active: false).
     * Safe to call at any time — never activates the vendor.
     */
    async saveDraft(vendorDoc) {
      if (!window.firebase || !firebase.firestore) {
        throw new Error('Firestore not available');
      }

      const db  = firebase.firestore();
      const ts  = firebase.firestore.FieldValue.serverTimestamp();
      const ref = db.collection('vendors').doc(vendorDoc.id);

      await ref.set({
        ...vendorDoc,
        services:    undefined,   // subcollections written separately
        menuItems:   undefined,
        adminStatus: 'draft',
        active:      false,
        updatedAt:   ts,
        onboarding:  {
          ...vendorDoc.onboarding,
          status: 'draft',
        },
      }, { merge: true });

      return { id: vendorDoc.id };
    },

    /**
     * Save vendor submission to `vendor_signups/{id}` for admin review.
     * Does NOT write to `vendors/` — admin approval does that.
     * Services and menuItems are stored as arrays inside this document
     * so the admin approval function can reconstruct the full subcollections.
     *
     * @param {Object} vendorDoc — assembled vendor document (from assemble())
     * @param {string} plan      — selected plan id: 'starter' | 'growth' | 'pro'
     * @returns {Promise<{id: string}>}
     */
    async saveSignup(vendorDoc, plan) {
      if (!window.firebase || !firebase.firestore) {
        throw new Error('Firestore not available');
      }

      const db  = firebase.firestore();
      const ts  = firebase.firestore.FieldValue.serverTimestamp();
      const id  = vendorDoc.id;
      const ref = db.collection('vendor_signups').doc(id);

      // Refuse if already approved or rejected
      const existing = await ref.get();
      if (existing.exists) {
        const st = existing.data().status;
        if (st === 'approved') {
          throw new Error('This business has already been approved. Check your email for login details or email dulichcali21@gmail.com for help.');
        }
        if (st === 'rejected') {
          throw new Error('This submission was previously rejected. Email dulichcali21@gmail.com for assistance.');
        }
      }

      // Store the complete vendor doc.
      // services/menuItems are kept as arrays so admin approval can write them
      // to proper subcollections via the batch write in approveSubmission().
      await ref.set(Object.assign({}, vendorDoc, {
        plan:        plan || 'starter',
        status:      'submitted',
        adminStatus: 'pending',
        active:      false,
        submittedAt: ts,
        updatedAt:   ts,
        onboarding:  Object.assign({}, vendorDoc.onboarding || {}, {
          status: 'submitted',
        }),
      }), { merge: true });

      return { id };
    },
  };

  // ============================================================
  // 6. PREVIEW BUILDER — HTML summary for review step
  // ============================================================

  const PreviewBuilder = {

    build(vendorDoc) {
      const d  = vendorDoc;
      const sf = d.storefront || {};
      const ai = d.aiContext  || {};
      const pack = CATEGORY_PACKS[d.category] || {};

      const faqsHtml = (sf.faqs || []).map(f =>
        `<div class="vob-prev-faq"><strong>Q: ${f.q}</strong><p>A: ${f.a}</p></div>`
      ).join('');

      const servicesHtml = (d.services || []).slice(0, 5).map(s =>
        `<div class="vob-prev-svc"><span class="vob-prev-svc-name">${s.name}</span> <span class="vob-prev-svc-price">from $${s.priceFrom}</span></div>`
      ).join('');

      const tagsHtml = (sf.tags || []).map(t =>
        `<span class="vob-prev-tag">${t}</span>`
      ).join('');

      const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const dayKeys = ['mon','tue','wed','thu','fri','sat','sun'];
      const hoursHtml = dayKeys.map((k, i) => {
        const h = (d.hours || {})[k] || {};
        return `<tr><td>${days[i]}</td><td>${h.closed ? 'Closed' : `${h.open||''}–${h.close||''}`}</td></tr>`;
      }).join('');

      const policiesHtml = Object.entries(sf.policies || {})
        .filter(([, v]) => v)
        .map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`)
        .join('');

      const warnings = Validator.validate(vendorDoc);
      const warningsHtml = warnings.warnings.length
        ? `<div class="vob-prev-warn">
             <strong>⚠ Warnings (not blocking):</strong>
             <ul>${warnings.warnings.map(w => `<li>${w}</li>`).join('')}</ul>
           </div>`
        : '';

      const errorsHtml = warnings.errors.length
        ? `<div class="vob-prev-err">
             <strong>✗ Errors — fix before publishing:</strong>
             <ul>${warnings.errors.map(e => `<li>${e}</li>`).join('')}</ul>
           </div>`
        : '';

      return `
        <div class="vob-prev-wrap">
          ${errorsHtml}
          ${warningsHtml}

          <div class="vob-prev-section">
            <h3>Identity</h3>
            <p><strong>ID:</strong> <code>${d.id}</code></p>
            <p><strong>Name:</strong> ${d.name}</p>
            <p><strong>Category:</strong> ${d.category} · ${d.region}</p>
            <p><strong>Phone:</strong> ${d.phoneDisplay || '—'}</p>
            <p><strong>Address:</strong> ${d.address || '—'}, ${d.city}</p>
            <p><strong>Languages:</strong> ${(d.supportedLanguages||[]).join(', ')}</p>
            <p><strong>Portal URL:</strong> <code>${pack.portalAdmin}?id=${d.id}</code></p>
          </div>

          <div class="vob-prev-section">
            <h3>Storefront Content (AI-generated)</h3>
            <p><strong>Tagline:</strong> ${d.tagline}</p>
            <p><strong>Hero text:</strong> ${sf.heroText}</p>
            <p><strong>Short description:</strong> ${sf.shortDescription}</p>
            <div class="vob-prev-tags">${tagsHtml}</div>
          </div>

          ${servicesHtml ? `<div class="vob-prev-section"><h3>Services (first 5)</h3>${servicesHtml}</div>` : ''}

          ${faqsHtml ? `<div class="vob-prev-section"><h3>FAQs</h3>${faqsHtml}</div>` : ''}

          ${policiesHtml ? `<div class="vob-prev-section"><h3>Policies</h3>${policiesHtml}</div>` : ''}

          <div class="vob-prev-section">
            <h3>Business Hours</h3>
            <table class="vob-prev-hours">${hoursHtml}</table>
          </div>

          <div class="vob-prev-section">
            <h3>AI Receptionist</h3>
            <p><strong>Greeting:</strong> ${ai.greeting}</p>
            <p><strong>Tone:</strong> ${ai.tone}</p>
          </div>
        </div>
      `;
    },
  };

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    // Schema / constants
    SCHEMA_DEFAULTS,
    CATEGORY_PACKS,
    GENERATED_FIELDS,

    // Pipeline stages
    Normalizer,
    AIGenerator,
    Validator,
    Publisher,
    PreviewBuilder,

    /**
     * Convenience: run the full pipeline and return the assembled vendor doc.
     * @param {Object} rawInput     — raw form data
     * @param {Object|null} aiOutput — AI-generated content (or null to skip)
     * @returns {Object}  vendor document ready for validation + publish
     */
    assemble(rawInput, aiOutput) {
      const normalized = Normalizer.run(rawInput);
      return Publisher.buildVendorDocument(normalized, aiOutput);
    },
  };

})();
