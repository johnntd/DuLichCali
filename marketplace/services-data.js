// Du Lịch Cali — Marketplace Services Data
// Central data file for multi-business service marketplace
// Exposed globally as window.MARKETPLACE

(function () {
  'use strict';

  // ── Nail service image URLs (reused across catalog entries) ───────────────
  var _IM_MANI = '/images/unsplash/nails-manicure.jpg';
  var _IM_PEDI = '/images/unsplash/nails-pedicure.jpg';
  var _IM_ACRY = '/images/unsplash/nails-acrylic.jpg';
  var _IM_GEL  = '/images/unsplash/nails-gel.jpg';
  var _IM_ART  = '/images/unsplash/nails-nail-art.jpg';
  var _IM_CARE = '/images/unsplash/nails-care.jpg';

  var categories = {
    nails: {
      id: 'nails',
      slug: 'nailsalon',
      name: 'Nail Salon',
      nameVi: 'Tiệm Nail',
      tagline: 'Dịch vụ chăm sóc móng chuyên nghiệp',
      heroGradient: 'linear-gradient(135deg,#831843 0%,#9d174d 50%,#4c1d95 100%)',
      accent: '#ec4899'
    },
    hair: {
      id: 'hair',
      slug: 'hairsalon',
      name: 'Hair Salon',
      nameVi: 'Tiệm Tóc',
      tagline: 'Làm đẹp tóc theo phong cách hiện đại',
      heroGradient: 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#1e40af 100%)',
      accent: '#34d399'
    },
    food: {
      id: 'food',
      slug: 'foods',
      name: 'Food & Dining',
      nameVi: 'Ẩm Thực',
      tagline: 'Hương vị Việt đích thực tại California',
      heroGradient: 'linear-gradient(135deg,#7f1d1d 0%,#b45309 50%,#92400e 100%)',
      accent: '#fb923c'
    }
  };

  var businesses = [
    // ─── NAIL SALONS ────────────────────────────────────────────────────────────
    {
      id: 'luxurious-nails',
      category: 'nails',
      active: true,
      featured: true,
      featuredPriority: 2,
      featuredRegions: ['bayarea'],
      homepageActive: true,
      shortPromoText: 'Nail cao cấp & spa sang trọng — đặt lịch ngay',
      availabilityType: 'appointment',
      name: 'Luxurious Nails & Spa',
      tagline: 'Nail cao cấp & spa sang trọng · Bay Area',
      taglineI18n: { en: 'Premium nail care & luxury spa · Bay Area', vi: 'Nail cao c\u1ea5p & spa sang tr\u1ecdng · Bay Area', es: 'Cuidado de u\xf1as premium & spa de lujo · Bay Area' },
      region: 'Bay Area',
      city: 'San Jose',
      address: 'San Jose, CA',
      phone: '',
      phoneDisplay: '',
      hosts: [],
      staff: [
        {
          name: 'Helen',
          active: true,
          role: 'Senior Nail Tech',
          specialties: ['Acrylic Full Set', 'Nail Art', 'Gel Nails', 'Chrome Powder', 'Ombre', '3D Art'],
          assignedServices: ['Manicure Cơ Bản', 'French Manicure', 'Hot Oil Manicure', 'Gel Manicure', 'Gel Extensions', 'Shellac', 'Acrylic Full Set', 'Acrylic Fill', 'Pink & White', 'Nail Art Cơ Bản', 'Nail Art Phức Tạp', '3D Nail Art', 'Chrome Powder', 'Ombre Nails', 'Spa Package', 'French Tip Add-on'],
          schedule: {
            mon: { active: true,  start: '09:00', end: '19:00' },
            tue: { active: true,  start: '09:00', end: '19:00' },
            wed: { active: true,  start: '09:00', end: '19:00' },
            thu: { active: true,  start: '09:00', end: '19:00' },
            fri: { active: true,  start: '09:00', end: '19:00' },
            sat: { active: true,  start: '09:00', end: '18:00' },
            sun: { active: false, start: '10:00', end: '17:00' }
          }
        },
        {
          name: 'Tracy',
          active: true,
          role: 'Nail Tech',
          specialties: ['Manicure', 'Pedicure', 'Gel Nails', 'Spa Pedicure'],
          assignedServices: ['Manicure Cơ Bản', 'French Manicure', 'Pedicure Cơ Bản', 'Spa Pedicure', 'Deluxe Pedicure', 'Gel Manicure', 'Shellac', 'Nail Repair', 'Paraffin Wax'],
          schedule: {
            mon: { active: true,  start: '10:00', end: '18:00' },
            tue: { active: true,  start: '10:00', end: '18:00' },
            wed: { active: true,  start: '10:00', end: '18:00' },
            thu: { active: true,  start: '10:00', end: '18:00' },
            fri: { active: true,  start: '10:00', end: '18:00' },
            sat: { active: false, start: '09:00', end: '18:00' },
            sun: { active: false, start: '10:00', end: '17:00' }
          }
        }
      ],
      features: [
        'Hơn 10 năm kinh nghiệm tại Bay Area',
        'Sản phẩm an toàn, không độc hại',
        'Không gian sang trọng, thoải mái',
        'Thợ lành nghề, tỉ mỉ từng chi tiết',
        'Nhận walk-in và đặt lịch trước'
      ],
      featuresI18n: [
        { en: 'Over 10 years of experience in Bay Area',  vi: 'H\u01a1n 10 n\u0103m kinh nghi\u1ec7m t\u1ea1i Bay Area',       es: 'M\xe1s de 10 a\xf1os de experiencia en Bay Area'   },
        { en: 'Safe, non-toxic products',                 vi: 'S\u1ea3n ph\u1ea9m an to\xe0n, kh\xf4ng \u0111\u1ed9c h\u1ea1i', es: 'Productos seguros y no t\xf3xicos'               },
        { en: 'Luxurious, comfortable environment',       vi: 'Kh\xf4ng gian sang tr\u1ecdng, tho\u1ea3i m\xe1i',            es: 'Ambiente lujoso y c\xf3modo'                    },
        { en: 'Skilled technicians, meticulous care',     vi: 'Th\u1ee3 l\xe0nh ngh\u1ec1, t\u1ec9 m\u1ec9 t\u1eebng chi ti\u1ebft', es: 'T\xe9cnicos h\xe1biles, cuidado meticuloso'  },
        { en: 'Walk-ins and appointments welcome',        vi: 'Nh\u1eadn walk-in v\xe0 \u0111\u1eb7t l\u1ecbch tr\u01b0\u1edbc', es: 'Se aceptan clientes sin cita'                   }
      ],
      trustSubtitleI18n: { en: 'Over 10 years of beauty care in Bay Area', vi: 'H\u01a1n 10 n\u0103m ch\u0103m s\xf3c s\u1eafc \u0111\u1eb9p t\u1ea1i Bay Area', es: 'M\xe1s de 10 a\xf1os cuidando tu belleza en Bay Area' },
      description:
        'Tiệm nail sang trọng hơn 10 năm kinh nghiệm tại Bay Area. Sản phẩm an toàn, đội ngũ lành nghề, không gian cao cấp và thoải mái.',
      heroImage: '/images/unsplash/nails-manicure.jpg',
      heroGradient:
        'linear-gradient(135deg,#831843 0%,#9d174d 40%,#4c1d95 100%)',
      // ── Full service catalog — 59 services, all active:false by default ─────
      // Enable individual services from vendor admin (salon-admin.html)
      // Public page and AI only show active:true services (fetched from Firestore)
      services: [
        // ── MANICURE (8) ──────────────────────────────────────────────────
        { category:'manicure', name:'Classic Manicure',      price:'', priceFrom:0, duration:'45 min', durationMins:45,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Traditional manicure — nail shaping, cuticle care, hand massage, and polish of your choice.' },
        { category:'manicure', name:'Express Manicure',      price:'', priceFrom:0, duration:'30 min', durationMins:30,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Quick nail clean-up, shape, and polish. Perfect for a fast refresh on the go.' },
        { category:'manicure', name:'Spa Manicure',          price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Relaxing manicure with exfoliation, mask, hot towel wrap, and extended hand massage.' },
        { category:'manicure', name:'Deluxe Manicure',       price:'', priceFrom:0, duration:'75 min', durationMins:75,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Premium manicure with sugar scrub, paraffin dip, mask, deep conditioning, and polish.' },
        { category:'manicure', name:'Gel Manicure',          price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_GEL,  desc:'Long-lasting gel polish that stays chip-free for 2–3 weeks. Cured under UV light.' },
        { category:'manicure', name:'French Manicure',       price:'', priceFrom:0, duration:'50 min', durationMins:50,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Classic white-tip French style — elegant and timeless for any occasion.' },
        { category:'manicure', name:'American Manicure',     price:'', priceFrom:0, duration:'50 min', durationMins:50,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Softer, more natural look than French — sheer pink base with ivory tips.' },
        { category:'manicure', name:'Paraffin Manicure',     price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Manicure with warm paraffin wax dip to deeply moisturize and soften hands.' },
        // ── PEDICURE (9) ──────────────────────────────────────────────────
        { category:'pedicure', name:'Classic Pedicure',          price:'', priceFrom:0, duration:'60 min',  durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_PEDI, desc:'Essential foot care — soak, scrub, nail shaping, cuticle clean, and polish.' },
        { category:'pedicure', name:'Express Pedicure',          price:'', priceFrom:0, duration:'40 min',  durationMins:40,  active:false, assignedStaff:[], imageUrl:_IM_PEDI, desc:'Quick pedicure with soak, shape, and polish. Perfect for a fast touch-up.' },
        { category:'pedicure', name:'Spa Pedicure',              price:'', priceFrom:0, duration:'75 min',  durationMins:75,  active:false, assignedStaff:[], imageUrl:_IM_PEDI, desc:'Relaxing spa treatment with sea salt soak, mask, and hot stone massage.' },
        { category:'pedicure', name:'Deluxe Pedicure',           price:'', priceFrom:0, duration:'90 min',  durationMins:90,  active:false, assignedStaff:[], imageUrl:_IM_PEDI, desc:'Premium pedicure with scrub, callus removal, mask, paraffin, and deep massage.' },
        { category:'pedicure', name:'Luxury Pedicure',           price:'', priceFrom:0, duration:'105 min', durationMins:105, active:false, assignedStaff:[], imageUrl:_IM_PEDI, desc:'Our most indulgent treatment — collagen soak, crystal mask, paraffin, and gel polish.' },
        { category:'pedicure', name:'Gel Pedicure',              price:'', priceFrom:0, duration:'75 min',  durationMins:75,  active:false, assignedStaff:[], imageUrl:_IM_PEDI, desc:'Pedicure with long-lasting gel polish that stays vibrant for 3–4 weeks.' },
        { category:'pedicure', name:'Jelly Pedicure',            price:'', priceFrom:0, duration:'90 min',  durationMins:90,  active:false, assignedStaff:[], imageUrl:_IM_PEDI, desc:'Fun fizzing jelly soak that softens skin for a deeply moisturizing experience.' },
        { category:'pedicure', name:'Callus Treatment Pedicure', price:'', priceFrom:0, duration:'90 min',  durationMins:90,  active:false, assignedStaff:[], imageUrl:_IM_PEDI, desc:'Targeted callus removal with medical-grade file and intensive softening treatment.' },
        { category:'pedicure', name:'Paraffin Pedicure',         price:'', priceFrom:0, duration:'80 min',  durationMins:80,  active:false, assignedStaff:[], imageUrl:_IM_PEDI, desc:'Pedicure with warm paraffin wax boot for ultra-soft, deeply moisturized feet.' },
        // ── ACRYLIC / ENHANCEMENTS (8) ────────────────────────────────────
        { category:'acrylic', name:'Acrylic Full Set',       price:'', priceFrom:0, duration:'75 min', durationMins:75,  active:false, assignedStaff:[], imageUrl:_IM_ACRY, desc:'Full set of acrylic nails for strength and length. Choose your shape and color.' },
        { category:'acrylic', name:'Acrylic Fill',           price:'', priceFrom:0, duration:'50 min', durationMins:50,  active:false, assignedStaff:[], imageUrl:_IM_ACRY, desc:'Fill in nail growth to maintain your acrylic set — recommended every 2–3 weeks.' },
        { category:'acrylic', name:'Pink & White Full Set',  price:'', priceFrom:0, duration:'90 min', durationMins:90,  active:false, assignedStaff:[], imageUrl:_IM_ACRY, desc:'Classic two-tone acrylic with pink body and white tips — no polish needed.' },
        { category:'acrylic', name:'Pink & White Fill',      price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_ACRY, desc:'Fill in your Pink & White acrylic growth. Keep that flawless look every 2–3 weeks.' },
        { category:'acrylic', name:'Ombre Acrylic Full Set', price:'', priceFrom:0, duration:'90 min', durationMins:90,  active:false, assignedStaff:[], imageUrl:_IM_ACRY, desc:'Gradient fade acrylic — smooth color transition from base to tip.' },
        { category:'acrylic', name:'Ombre Acrylic Fill',     price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_ACRY, desc:'Fill in your ombre acrylic to keep the gradient fade looking fresh.' },
        { category:'acrylic', name:'Color Powder Full Set',  price:'', priceFrom:0, duration:'90 min', durationMins:90,  active:false, assignedStaff:[], imageUrl:_IM_ACRY, desc:'Acrylic full set using vibrant colored acrylic powder — no polish needed.' },
        { category:'acrylic', name:'Color Powder Fill',      price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_ACRY, desc:'Fill in your color powder acrylic — keep the color bold and fresh.' },
        // ── GEL / GEL EXTENSIONS (8) ──────────────────────────────────────
        { category:'gel', name:'Gel Polish Change',          price:'', priceFrom:0, duration:'45 min', durationMins:45,  active:false, assignedStaff:[], imageUrl:_IM_GEL, desc:'Remove old gel and apply fresh color — clean, fast, and chip-free for 2–3 weeks.' },
        { category:'gel', name:'Gel Polish on Hands',        price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_GEL, desc:'Gel polish on natural nails — beautiful chip-free color that lasts 2–3 weeks.' },
        { category:'gel', name:'Gel Polish on Feet',         price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_GEL, desc:'Gel polish on toenails — vibrant and long-lasting for up to 4 weeks.' },
        { category:'gel', name:'Builder Gel Full Set',       price:'', priceFrom:0, duration:'90 min', durationMins:90,  active:false, assignedStaff:[], imageUrl:_IM_GEL, desc:'Strong, flexible builder gel extensions — lighter than acrylic, natural look.' },
        { category:'gel', name:'Builder Gel Fill',           price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_GEL, desc:'Fill in builder gel nail growth. Maintain your extensions every 2–3 weeks.' },
        { category:'gel', name:'Hard Gel Full Set',          price:'', priceFrom:0, duration:'90 min', durationMins:90,  active:false, assignedStaff:[], imageUrl:_IM_GEL, desc:'Extremely durable hard gel extensions — ideal for those wanting maximum strength.' },
        { category:'gel', name:'Hard Gel Fill',              price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_GEL, desc:'Fill in hard gel nail growth — keep extensions strong and looking fresh.' },
        { category:'gel', name:'Gel X / Soft Gel Extensions',price:'', priceFrom:0, duration:'90 min', durationMins:90,  active:false, assignedStaff:[], imageUrl:_IM_GEL, desc:'Full-cover soft gel tips — lightweight, flexible, no drill needed.' },
        // ── DIP POWDER (4) ────────────────────────────────────────────────
        { category:'dip', name:'Dip Powder Natural Nails',   price:'', priceFrom:0, duration:'60 min', durationMins:60,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Dip powder on natural nails — no UV light needed, odorless, lasts 3–4 weeks.' },
        { category:'dip', name:'Dip Powder with Tips',       price:'', priceFrom:0, duration:'75 min', durationMins:75,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Dip powder over nail tips for added length — durable and natural-looking.' },
        { category:'dip', name:'Dip Powder Ombre',           price:'', priceFrom:0, duration:'75 min', durationMins:75,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Gradient ombre effect using dip powder — fade between two or more colors.' },
        { category:'dip', name:'Dip Powder Removal',         price:'', priceFrom:0, duration:'30 min', durationMins:30,  active:false, assignedStaff:[], imageUrl:_IM_MANI, desc:'Safe dip powder removal — gentle process that protects your natural nails.' },
        // ── NAIL ART / DESIGN (10) ────────────────────────────────────────
        { category:'nailart', name:'Basic Nail Art',         price:'', priceFrom:0, duration:'+20 min', durationMins:20, active:false, assignedStaff:[], imageUrl:_IM_ART, desc:'Simple designs — dots, stripes, flowers, geometric. Add to any service.' },
        { category:'nailart', name:'Advanced Nail Art',      price:'', priceFrom:0, duration:'+40 min', durationMins:40, active:false, assignedStaff:[], imageUrl:_IM_ART, desc:'Detailed designs — marble, abstract, detailed florals. Hand-painted artistry.' },
        { category:'nailart', name:'Custom Nail Art',        price:'', priceFrom:0, duration:'by quote', durationMins:0, active:false, assignedStaff:[], imageUrl:_IM_ART, desc:'Fully custom design from your inspiration — consult with our nail artist.' },
        { category:'nailart', name:'French Tip Add-On',      price:'', priceFrom:0, duration:'+15 min', durationMins:15, active:false, assignedStaff:[], imageUrl:_IM_ART, desc:'Add a classic white French tip to any manicure or pedicure service.' },
        { category:'nailart', name:'Ombre Add-On',           price:'', priceFrom:0, duration:'+25 min', durationMins:25, active:false, assignedStaff:[], imageUrl:_IM_ART, desc:'Smooth color-fade gradient — one or multiple color fade.' },
        { category:'nailart', name:'Chrome Add-On',          price:'', priceFrom:0, duration:'+15 min', durationMins:15, active:false, assignedStaff:[], imageUrl:_IM_ART, desc:'Mirror chrome powder for an ultra-glossy metallic finish — silver, gold, rose.' },
        { category:'nailart', name:'Cat Eye Add-On',         price:'', priceFrom:0, duration:'+15 min', durationMins:15, active:false, assignedStaff:[], imageUrl:_IM_ART, desc:'Magnetic cat eye effect — subtle shimmer line that shifts with the light.' },
        { category:'nailart', name:'Rhinestones Add-On',     price:'', priceFrom:0, duration:'+20 min', durationMins:20, active:false, assignedStaff:[], imageUrl:_IM_ART, desc:'Crystal rhinestone accents for a glamorous, sparkly nail look.' },
        { category:'nailart', name:'3D Nail Art',            price:'', priceFrom:0, duration:'+45 min', durationMins:45, active:false, assignedStaff:[], imageUrl:_IM_ART, desc:'Raised 3D designs using gel or acrylic — flowers, bows, and sculptured art.' },
        { category:'nailart', name:'Hand-Painted Design',    price:'', priceFrom:0, duration:'+35 min', durationMins:35, active:false, assignedStaff:[], imageUrl:_IM_ART, desc:'Freehand painted art on nails — portraits, landscapes, illustrations, and more.' },
        // ── ADD-ONS / CARE (12) ───────────────────────────────────────────
        { category:'addon', name:'Nail Repair',              price:'', priceFrom:0, duration:'+15 min', durationMins:15, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Fix one broken or lifted nail — quick repair without a full redo.' },
        { category:'addon', name:'Nail Removal (Acrylic)',   price:'', priceFrom:0, duration:'30 min',  durationMins:30, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Safe acrylic nail removal to protect your natural nails underneath.' },
        { category:'addon', name:'Nail Removal (Gel)',       price:'', priceFrom:0, duration:'30 min',  durationMins:30, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Gentle soak-off removal of gel polish or gel extensions.' },
        { category:'addon', name:'Nail Removal (Dip)',       price:'', priceFrom:0, duration:'30 min',  durationMins:30, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Careful dip powder removal that keeps natural nails intact.' },
        { category:'addon', name:'Cuticle Care',             price:'', priceFrom:0, duration:'+15 min', durationMins:15, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Detailed cuticle trimming and conditioning treatment — add to any service.' },
        { category:'addon', name:'Hand Massage',             price:'', priceFrom:0, duration:'+15 min', durationMins:15, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Relaxing hand and wrist massage with lotion — add to any manicure.' },
        { category:'addon', name:'Foot Massage',             price:'', priceFrom:0, duration:'+15 min', durationMins:15, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Stress-relieving foot and calf massage with oil — add to any pedicure.' },
        { category:'addon', name:'Paraffin Wax Hands',       price:'', priceFrom:0, duration:'+20 min', durationMins:20, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Warm paraffin wax dip for hands — deeply moisturizes and softens skin.' },
        { category:'addon', name:'Paraffin Wax Feet',        price:'', priceFrom:0, duration:'+20 min', durationMins:20, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Warm paraffin wax boot for feet — ultra-soft skin and deep hydration.' },
        { category:'addon', name:'Callus Removal Add-On',    price:'', priceFrom:0, duration:'+20 min', durationMins:20, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Targeted callus and rough skin removal — add to any pedicure service.' },
        { category:'addon', name:'Extra Length Add-On',      price:'', priceFrom:0, duration:'+15 min', durationMins:15, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Add extra length to any nail enhancement — choose your preferred type.' },
        { category:'addon', name:'Shape Change Add-On',      price:'', priceFrom:0, duration:'+15 min', durationMins:15, active:false, assignedStaff:[], imageUrl:_IM_CARE, desc:'Reshape existing nails to a different shape — square, oval, coffin, almond, etc.' }
      ],
      // 7 service categories including Dip Powder
      serviceCategories: [
        { key: 'manicure', label: 'Manicure' },
        { key: 'pedicure', label: 'Pedicure' },
        { key: 'acrylic',  label: 'Acrylic' },
        { key: 'gel',      label: 'Gel / Extensions' },
        { key: 'dip',      label: 'Dip Powder' },
        { key: 'nailart',  label: 'Nail Art' },
        { key: 'addon',    label: 'Add-ons / Care' }
      ],
      hours: {
        'Thứ 2–6':    '9:00 AM – 7:00 PM',
        'Thứ 7':      '9:00 AM – 6:00 PM',
        'Chủ Nhật':   '10:00 AM – 5:00 PM'
      },
      bookingEnabled: true,
      bookingType: 'appointment',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Lily',
        welcomeMessage:
          'Hi! I\'m Lily, your AI receptionist at Luxurious Nails & Spa. I can help with services, pricing, availability, and booking.\n\nTambién hablo español · Tôi cũng nói tiếng Việt',
        quickReplies: ['Services & Pricing', 'Book an Appointment', "Who's available today?", '¿Servicios y precios?', 'Bảng giá'],
        systemExtra:
          'You are Lily, premium nail salon AI receptionist for Luxurious Nails & Spa in San Jose Bay Area. Always warm, professional, and direct. You are fluent in English, Spanish, and Vietnamese — respond in the customer\'s language. Only quote services and prices from the SERVICES section above. For anything not listed, say "please call for current pricing." You also serve as a voice receptionist — keep responses natural and concise.'
      }
    },

    {
      id: 'beauty-nails-oc',
      category: 'nails',
      active: true,
      featured: true,
      featuredPriority: 2,
      featuredRegions: ['oc'],
      homepageActive: true,
      shortPromoText: 'Nail cao cấp Little Saigon — đặt lịch ngay',
      availabilityType: 'appointment',
      name: 'Beauty Nails OC',
      tagline: 'Phong cách sang trọng · Quận Cam',
      taglineI18n: { en: 'Elegant style · Orange County', vi: 'Phong c\xe1ch sang tr\u1ecdng · Qu\u1eadn Cam', es: 'Estilo elegante · Orange County' },
      region: 'Orange County',
      city: 'Westminster',
      address: 'Westminster, CA',
      phone: '4089163439',
      phoneDisplay: '408-916-3439',
      hosts: [
        {
          name: 'Du Lịch Cali',
          phone: '4089163439',
          display: '408-916-3439',
          role: 'Owner'
        }
      ],
      description:
        'Điểm đến làm đẹp tin cậy tại Quận Cam. Không gian thoải mái, sản phẩm an toàn, thợ lành nghề.',
      heroImage: '/images/unsplash/nails-manicure.jpg',
      heroGradient:
        'linear-gradient(135deg,#be185d 0%,#db2777 40%,#7c3aed 100%)',
      serviceCategories: [
        { key: 'manicure', label: 'Manicure' },
        { key: 'pedicure', label: 'Pedicure' },
        { key: 'gel',      label: 'Gel Color' },
        { key: 'acrylic',  label: 'Acrylic & Ombre' },
        { key: 'nailart',  label: 'Nail Art' }
      ],
      services: [
        { name: 'Manicure',        category: 'manicure', durationMins: 40, price: '$18+', duration: '40 phút',      desc: 'Chăm sóc và làm đẹp móng tay',      imageUrl: _IM_MANI },
        { name: 'Pedicure',        category: 'pedicure', durationMins: 55, price: '$28+', duration: '55 phút',      desc: 'Chăm sóc và làm đẹp móng chân',    imageUrl: _IM_PEDI },
        { name: 'Gel Color',       category: 'gel',      durationMins: 55, price: '$30+', duration: '55 phút',      desc: 'Sơn gel bền và đẹp',                imageUrl: _IM_GEL  },
        { name: 'Full Set Acrylic',category: 'acrylic',  durationMins: 70, price: '$40+', duration: '70 phút',      desc: 'Bộ móng acrylic đầy đủ',            imageUrl: _IM_ACRY },
        { name: 'Ombre Nails',     category: 'acrylic',  durationMins: 90, price: '$55+', duration: '90 phút',      desc: 'Móng gradient màu sắc hiện đại',    imageUrl: _IM_ACRY },
        { name: 'Nail Art Design', category: 'nailart',  durationMins: 60, price: '$8+',  duration: 'Tùy thiết kế', desc: 'Nghệ thuật trang trí móng',         imageUrl: _IM_ART  }
      ],
      hours: {
        'Thứ 2–6':  '9:30 AM – 7:30 PM',
        'Thứ 7':    '9:00 AM – 7:00 PM',
        'Chủ Nhật': '10:00 AM – 6:00 PM'
      },
      bookingEnabled: true,
      bookingType: 'appointment',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Amy',
        welcomeMessage:
          'Chào mừng đến Beauty Nails OC! Tôi là Amy, sẵn sàng hỗ trợ đặt lịch hoặc giải đáp thắc mắc. Bạn muốn biết gì ạ?',
        quickReplies: ['Bảng giá', 'Đặt lịch hẹn', 'Giờ hoạt động', 'Dịch vụ'],
        systemExtra:
          'You are Amy, receptionist for Beauty Nails OC in Westminster Orange County. Contact: Du Lịch Cali 408-916-3439. Specializes in nail services. Always warm and professional.'
      }
    },

    // ─── HAIR SALONS ─────────────────────────────────────────────────────────────
    {
      id: 'viet-hair-bayarea',
      category: 'hair',
      active: true,
      featured: true,
      featuredPriority: 3,
      featuredRegions: ['bayarea'],
      homepageActive: true,
      shortPromoText: 'Cắt · Uốn · Nhuộm tóc Á Đông — tư vấn miễn phí',
      availabilityType: 'appointment',
      name: 'Việt Hair Studio',
      tagline: 'Phong cách Á Đông hiện đại · Bay Area',
      region: 'Bay Area',
      city: 'San Jose',
      address: 'San Jose, CA',
      phone: '4089163439',
      phoneDisplay: '408-916-3439',
      hosts: [
        {
          name: 'Du Lịch Cali',
          phone: '4089163439',
          display: '408-916-3439',
          role: 'Senior Stylist'
        }
      ],
      description:
        'Phong cách tóc kết hợp nghệ thuật Á Đông và xu hướng quốc tế. Stylist giàu kinh nghiệm tư vấn kiểu tóc phù hợp với khuôn mặt và phong cách.',
      heroImage: '/images/unsplash/hair-salon-1.jpg',
      heroGradient:
        'linear-gradient(135deg,#064e3b 0%,#065f46 40%,#1e40af 100%)',
      services: [
        { name: 'Cắt Tóc Nam',      price: '$20+',  duration: '30 phút',  desc: 'Cắt và tạo kiểu tóc nam' },
        { name: 'Cắt Tóc Nữ',       price: '$30+',  duration: '45 phút',  desc: 'Cắt tóc và tư vấn kiểu dáng' },
        { name: 'Uốn Tóc',          price: '$80+',  duration: '2-3 giờ',  desc: 'Uốn xoăn tự nhiên hoặc theo ý muốn' },
        { name: 'Duỗi/Thẳng Tóc',  price: '$100+', duration: '2-3 giờ',  desc: 'Duỗi tóc bóng mượt và bền' },
        { name: 'Nhuộm Tóc',        price: '$60+',  duration: '2 giờ',    desc: 'Nhuộm màu tóc thời thượng' },
        { name: 'Highlight',         price: '$80+',  duration: '2.5 giờ', desc: 'Tô sáng từng lọn tóc' }
      ],
      hours: {
        'Thứ 3–6':  '10:00 AM – 7:00 PM',
        'Thứ 7':    '9:00 AM – 6:00 PM',
        'Chủ Nhật': '10:00 AM – 5:00 PM',
        'Thứ 2':    'Nghỉ'
      },
      bookingEnabled: true,
      bookingType: 'appointment',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Mia',
        welcomeMessage:
          'Xin chào! Đây là Việt Hair Studio. Tôi là Mia, trợ lý đặt lịch. Tôi có thể giúp bạn đặt lịch, tư vấn kiểu tóc hoặc báo giá dịch vụ. Bạn cần hỗ trợ gì?',
        quickReplies: ['Đặt lịch cắt tóc', 'Bảng giá', 'Giờ mở cửa', 'Tư vấn kiểu tóc'],
        systemExtra:
          'You are Mia, receptionist for Việt Hair Studio in San Jose Bay Area. Contact: Du Lịch Cali 408-916-3439. Specializes in Asian hair styling cuts perms straightening coloring. Respond in same language as customer.'
      }
    },

    {
      id: 'cali-hair-oc',
      category: 'hair',
      active: true,
      featured: true,
      featuredPriority: 3,
      featuredRegions: ['oc'],
      homepageActive: true,
      shortPromoText: 'Uốn Hàn Quốc · Nhuộm Balayage · Keratin',
      availabilityType: 'appointment',
      name: 'Cali Hair & Beauty',
      tagline: 'Kiểu tóc đẳng cấp · Little Saigon',
      region: 'Orange County',
      city: 'Garden Grove',
      address: 'Garden Grove, CA',
      phone: '4089163439',
      phoneDisplay: '408-916-3439',
      hosts: [
        {
          name: 'Du Lịch Cali',
          phone: '4089163439',
          display: '408-916-3439',
          role: 'Owner'
        }
      ],
      description:
        'Tọa lạc tại Little Saigon Garden Grove. Chuyên cắt uốn nhuộm và chăm sóc tóc theo phong cách Việt–Mỹ hiện đại. Đội ngũ thợ luôn cập nhật xu hướng mới.',
      heroImage: '/images/unsplash/hair-salon-2.jpg',
      heroGradient:
        'linear-gradient(135deg,#92400e 0%,#b45309 40%,#7c2d12 100%)',
      services: [
        { name: 'Cắt Tóc Nam',        price: '$18+',  duration: '25 phút',  desc: 'Cắt gọn và tạo kiểu chuyên nghiệp' },
        { name: 'Cắt Tóc Nữ',         price: '$28+',  duration: '45 phút',  desc: 'Tư vấn và cắt kiểu tóc phù hợp' },
        { name: 'Uốn Hàn Quốc',        price: '$120+', duration: '3 giờ',    desc: 'Kỹ thuật uốn xoăn phong cách Hàn' },
        { name: 'Keratin Treatment',    price: '$150+', duration: '3 giờ',    desc: 'Trị thẳng tóc bằng keratin cao cấp' },
        { name: 'Nhuộm Balayage',       price: '$100+', duration: '2.5 giờ', desc: 'Kỹ thuật nhuộm ombre tự nhiên' },
        { name: 'Deep Conditioning',    price: '$40+',  duration: '60 phút',  desc: 'Dưỡng tóc chuyên sâu phục hồi' }
      ],
      hours: {
        'Thứ 2–6':  '9:00 AM – 7:00 PM',
        'Thứ 7':    '8:30 AM – 7:00 PM',
        'Chủ Nhật': '10:00 AM – 6:00 PM'
      },
      bookingEnabled: true,
      bookingType: 'appointment',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Sophie',
        welcomeMessage:
          'Chào bạn! Cali Hair & Beauty Little Saigon đây. Tôi là Sophie. Mình có thể đặt lịch, báo giá hoặc tư vấn kiểu tóc. Bạn muốn dịch vụ gì?',
        quickReplies: ['Đặt lịch', 'Báo giá nhuộm', 'Xem dịch vụ', 'Giờ làm việc'],
        systemExtra:
          'You are Sophie, receptionist for Cali Hair & Beauty in Garden Grove Orange County near Little Saigon. Contact: Du Lịch Cali 408-916-3439. Specializes in Vietnamese and Korean hair styling techniques.'
      }
    },

    // ─── FOOD & DINING ────────────────────────────────────────────────────────────
    {
      id: 'pho-bac-bayarea',
      category: 'food',
      active: true,
      featured: true,
      featuredPriority: 4,
      featuredRegions: ['bayarea'],
      homepageActive: true,
      shortPromoText: 'Phở Hà Nội gia truyền — đặt bàn & catering',
      availabilityType: 'hours',
      name: 'Phở Bắc Bay Area',
      tagline: 'Phở gia truyền Hà Nội · Đặt bàn & Catering',
      region: 'Bay Area',
      city: 'San Jose',
      address: 'San Jose, CA',
      phone: '4089163439',
      phoneDisplay: '408-916-3439',
      hosts: [
        {
          name: 'Du Lịch Cali',
          phone: '4089163439',
          display: '408-916-3439',
          role: 'Manager'
        }
      ],
      description:
        'Hương vị phở Hà Nội chính gốc, nước dùng hầm xương bò 12 tiếng. Thực đơn phong phú với nhiều món truyền thống Việt Nam. Nhận đặt catering cho sự kiện và tiệc nhà.',
      heroImage: '/images/hero-pho-bac.jpg',
      heroGradient:
        'linear-gradient(135deg,#7f1d1d 0%,#991b1b 40%,#92400e 100%)',
      services: [
        { name: 'Phở Bò Đặc Biệt',     price: '$15',     duration: 'Phục vụ ngay',  desc: 'Phở bò tái chín gầu gân đặc biệt nhất' },
        { name: 'Bún Bò Huế',           price: '$14',     duration: 'Phục vụ ngay',  desc: 'Bún bò cay chuẩn vị Huế' },
        { name: 'Cơm Tấm Sườn',         price: '$16',     duration: 'Phục vụ ngay',  desc: 'Cơm tấm sườn nướng kèm bì chả' },
        { name: 'Bún Chả Hà Nội',       price: '$15',     duration: 'Phục vụ ngay',  desc: 'Bún chả thịt nướng phong cách Bắc' },
        { name: 'Gỏi Cuốn (2 cuốn)',    price: '$8',      duration: 'Phục vụ ngay',  desc: 'Gỏi cuốn tôm thịt tươi mát' },
        { name: 'Catering Đặt Hàng',    price: 'Liên hệ', duration: 'Đặt trước 24h', desc: 'Phục vụ tiệc nhà và sự kiện' }
      ],
      hours: {
        'Thứ 2–5':  '10:00 AM – 9:00 PM',
        'Thứ 6–7':  '9:00 AM – 10:00 PM',
        'Chủ Nhật': '9:00 AM – 9:00 PM'
      },
      bookingEnabled: true,
      bookingType: 'reservation',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Mai',
        welcomeMessage:
          'Chào mừng đến Phở Bắc Bay Area! Tôi là Mai. Tôi có thể giúp bạn đặt bàn, xem thực đơn hoặc đặt catering. Bạn cần gì ạ?',
        quickReplies: ['Thực đơn', 'Đặt bàn', 'Giờ mở cửa', 'Đặt catering'],
        systemExtra:
          'You are Mai, receptionist for Phở Bắc Bay Area restaurant in San Jose. Contact: Du Lịch Cali 408-916-3439. Specializes in traditional Hanoi pho and Vietnamese food. Also offers catering. Respond warmly in same language used.'
      }
    },

    // ─── FOOD VENDORS (home-based / order-by-inquiry) ─────────────────────────────
    {
      id: 'nha-bep-cua-emily',
      category: 'food',
      vendorType: 'foodvendor',   // differentiates home vendor from restaurant
      active: true,
      featured: true,
      featuredPriority: 1,
      featuredRegions: ['bayarea'],
      homepageActive: true,
      shortPromoText: 'Chả giò handmade — đặt 30+ cuốn, giao tận nơi',
      availabilityType: 'order_window',
      name: 'Nhà Bếp Của Emily',
      tagline: 'Chả Giò Handmade · San Jose · Bay Area',
      region: 'Bay Area',
      city: 'San Jose',
      address: '2534 Clarebank Way, San Jose, CA 95121',
      phone: '4089312438',
      phoneDisplay: '408-931-2438',
      heroImage: '/images/hero-cha-gio.jpg',
      hosts: [
        {
          name: 'Loan',
          phone: '4089312438',
          display: '408-931-2438',
          role: 'Owner & Home Chef'
        }
      ],
      description:
        'Mỗi cuốn chả giò là cả tâm huyết của gia đình Emily — nhân thịt heo, nấm hương và cà rốt tươi, gói bằng bánh tráng mỏng, chiên vàng giòn rụm. Làm thủ công từng mẻ, không chất bảo quản, hương vị đậm đà như bà nấu. Có hai lựa chọn: sống để bạn tự chiên tươi tại nhà — giòn tan theo ý bạn, hoặc tươi chín sẵn sàng thưởng thức ngay. Đặt hàng tối thiểu 30 cuốn. Liên hệ Loan để sắp xếp.',
      heroGradient:
        'linear-gradient(135deg,#78350f 0%,#92400e 50%,#7c2d12 100%)',
      orderEnabled: true,
      defaultDailyCapacity: 300,
      formspreeId: 'xeokgbpo',
      // ── Products (food vendor model — replaces services/hours) ─────────────────
      products: [
        {
          id: 'eggroll',
          name: 'Chả Giò (Eggroll)',
          nameEn: 'Eggroll',
          variants: [
            { id: 'raw',   label: 'Sống (Raw)',   labelEn: 'Raw — to fry fresh at home',      price: 0.75, imageUrl: '/images/hero-cha-gio.jpg' },
            { id: 'fresh', label: 'Tươi (Fresh)', labelEn: 'Fresh — cooked & ready to serve', price: 1.00, imageUrl: '' }
          ],
          pricePerUnit: 0.75,  // fallback minimum; variant prices take precedence
          unit: 'cuốn',
          unitEn: 'piece',
          minimumOrderQty: 30,
          image: '/images/hero-cha-gio.jpg',
          videoUrl: null,
          videoStatus: 'none',
          videoGeneratedAt: null,
          remotionTemplate: 'FoodPromo',
          subtitle: 'Handmade Eggrolls',
          shortTagline: 'Gói tay từng chiếc — giòn tan thơm phức',
          description: 'Chả giò nhân thịt heo, nấm hương và cà rốt tươi — gói bằng bánh tráng mỏng, chiên giòn vàng thơm phức. Làm thủ công từng mẻ với nguyên liệu sạch, không chất bảo quản. Perfect for family dinners, gatherings, and parties.',
          active: true,
          preparationInstructions: 'Chiên trong dầu nóng 350°F (175°C) trong 8–10 phút, lật đều. Khi vàng giòn là được. Không cần rã đông — chiên thẳng từ tủ lạnh cho kết quả giòn nhất.',
          reheatingInstructions:   'Lò nướng 325°F 5–7 phút, hoặc nồi chiên không dầu (air fryer) 320°F 4 phút. Tránh dùng lò vi sóng — làm mất độ giòn.',
          storageInstructions:     'Tủ lạnh: tối đa 3 ngày. Đông lạnh: tối đa 2 tháng (không cần rã đông trước khi chiên).',
          servingNotes:            'Ăn nóng khi mới chiên. Dùng kèm tương ớt, hoisin, hoặc nước chấm chua ngọt.',
          allergenNotes:           'Chứa: thịt heo, nấm hương, cà rốt, hành tây, bún tàu (miến). Vỏ bánh tráng gạo (không gluten). Không đậu phộng.'
        },
        {
          id: 'chuoi-dau-nau-oc',
          name: 'Chuối Đậu Nấu Ốc',
          nameEn: 'Northern Vietnamese Snail, Tofu & Green Banana Stew',
          variants: [],
          tags: ['Miền Bắc', 'Homemade', 'Thảo Dược', 'Comfort Food', 'Limited Batch'],
          pricePerUnit: 15,
          unit: 'phần',
          unitEn: 'serving',
          minimumOrderQty: 1,
          sortOrder: 1,
          image: '/images/hero-chuoi-dau-nau-oc.jpg',
          videoUrl: null,
          videoStatus: 'none',
          videoGeneratedAt: null,
          remotionTemplate: 'FoodPromo',
          subtitle: 'Northern Vietnamese Snail Stew',
          shortTagline: 'Hương vị miền Bắc — chuối xanh, đậu phụ, ốc tươi',
          shortDescription: 'Traditional Northern Vietnamese specialty. Fresh snails, tofu & green banana in turmeric broth.',
          description: 'A traditional Northern Vietnamese specialty featuring fresh snails, tofu, and green banana simmered in a rich turmeric broth with herbs and chili. Savory, slightly tangy, and deeply comforting.',
          active: true,
          preparationInstructions: 'Hâm nóng trên bếp nhỏ lửa 5–8 phút. Thêm rau thơm tươi trước khi dùng để giữ hương vị.',
          reheatingInstructions:   'Hâm lại bằng nồi nhỏ lửa, không dùng lò vi sóng để tránh làm mất độ tươi của ốc.',
          storageInstructions:     'Tủ lạnh: tối đa 2 ngày. Không đông lạnh — ốc tươi sẽ mất kết cấu sau khi đông.',
          servingNotes:            'Dùng nóng với bún hoặc cơm trắng. Thêm mắm tôm và ớt tươi theo khẩu vị.',
          allergenNotes:           'Chứa: ốc (shellfish/snail), đậu phụ (đậu nành/soy), hành, ớt. Không gluten. Món chay không ăn được (có ốc).'
        },
        // ── Ingested 2025-04-04 from Vendors_inputs/nha_bep_cua_emily/ ──────────
        {
          id: 'bun-cha-hanoi',
          name: 'Bún Chả Hà Nội',
          nameEn: 'Hanoi Grilled Pork & Vermicelli',
          displayNameVi: 'Bún Chả Hà Nội',
          variants: [
            { id: 'cha-vien',   label: 'Chả Viên',   labelEn: 'Grilled Pork Patties',    price: null, imageUrl: '/images/hero-bun-cha-hanoi-grill1.jpg' },
            { id: 'cha-la-lot', label: 'Chả Lá Lốt', labelEn: 'Pork in Lolot Leaf',       price: null, imageUrl: '/images/hero-bun-cha-hanoi-grill2.jpg' }
          ],
          pricePerUnit: 18,
          unit: 'phần',
          unitEn: 'serving',
          minimumOrderQty: 2,
          sortOrder: 2,
          image: '/images/hero-bun-cha-hanoi.jpg',
          videoUrl: null,
          videoStatus: 'pending',
          videoGeneratedAt: null,
          remotionTemplate: 'FoodPromo',
          tags: ['Miền Bắc', 'Grilled', 'Homemade', 'Bếp Than', 'Iconic'],
          shortTagline: 'Than hồng — thịt nướng — bún trắng mát lạnh',
          shortDescription: 'Pork grilled over charcoal, served over rice vermicelli with fresh herbs. A Hanoi classic.',
          description: 'Bún chả đúng chất Hà Nội — thịt heo ướp gia vị bí truyền, nướng trực tiếp trên bếp than hồng đến khi vàng rộm và thơm phức. Ăn kèm bún trắng mát lạnh, đĩa rau sống xanh mướt gồm dưa leo, giá đỗ và rau thơm tươi. Tất cả handmade từng mẻ bởi bếp nhà Emily.',
          active: true,
          featured: true,
          preparationInstructions: 'Hâm lại chả trên chảo không dầu lửa vừa 3–5 phút mỗi bên. Bún và rau sống dùng nguội.',
          reheatingInstructions:   'Chả: chảo không dầu 3 phút mỗi bên. Không dùng lò vi sóng — mất độ cháy mặt đặc trưng.',
          storageInstructions:     'Tủ lạnh: tối đa 2 ngày. Bún và chả để riêng để bún không bị ướt.',
          servingNotes:            'Ăn kèm nước chấm pha sẵn. Vắt chanh và thêm ớt tươi theo khẩu vị.',
          allergenNotes:           'Chứa: thịt heo, nước mắm (fish sauce). Bún gạo (không gluten). Rau sống đa dạng.'
        },
        {
          id: 'bun-dau-mam-tom',
          name: 'Bún Đậu Mắm Tôm',
          nameEn: 'Vermicelli with Fried Tofu & Shrimp Paste',
          displayNameVi: 'Bún Đậu Mắm Tôm',
          variants: [],
          pricePerUnit: 15,
          unit: 'phần',
          unitEn: 'serving',
          minimumOrderQty: 1,
          sortOrder: 3,
          image: '/images/hero-bun-dau-mam-tom.jpg',
          videoUrl: null,
          videoStatus: 'pending',
          videoGeneratedAt: null,
          remotionTemplate: 'FoodPromo',
          tags: ['Miền Bắc', 'Street Food', 'Homemade', 'Tofu', 'Iconic'],
          shortTagline: 'Đậu chiên giòn — mắm tôm thơm nức — rau sống đủ vị',
          shortDescription: 'Hanoi street food classic: crispy fried tofu, vermicelli, pork and housemade shrimp paste.',
          description: 'Bún đậu mắm tôm — biểu tượng vỉa hè Hà Nội, nay có mặt tại bếp nhà Emily. Đậu phụ chiên vàng giòn bên ngoài, mềm béo bên trong; ăn kèm bún trắng, thịt heo luộc, chả và đĩa rau sống xanh tươi. Điểm nhấn là bát mắm tôm tự pha — đậm đà, thơm nức, đúng chất Bắc.',
          active: true,
          featured: true,
          preparationInstructions: 'Đậu phụ chiên lại trên chảo dầu nóng 2–3 phút để giữ độ giòn. Bún và rau sống ăn nguội.',
          reheatingInstructions:   'Chỉ hâm lại đậu phụ — chảo hoặc nồi chiên không dầu 300°F 5 phút. Bún và rau không hâm.',
          storageInstructions:     'Tủ lạnh: tối đa 2 ngày. Để riêng đậu, bún, rau, và mắm tôm để giữ tươi ngon.',
          servingNotes:            'Thêm ớt tươi và quất vắt vào mắm tôm. Ăn ngay sau khi chiên đậu để đảm bảo độ giòn.',
          allergenNotes:           'Chứa: đậu phụ (soy), thịt heo, mắm tôm (shrimp paste/shellfish), nước mắm. Bún gạo (không gluten).'
        },
        {
          id: 'pho-bac',
          name: 'Phở Bắc',
          nameEn: 'Northern Vietnamese Beef Pho',
          displayNameVi: 'Phở Bắc',
          variants: [
            { id: 'tai',      label: 'Tái',           labelEn: 'Rare Beef',            price: null, imageUrl: '' },
            { id: 'tai-vien', label: 'Tái + Bò Viên', labelEn: 'Rare Beef + Meatballs', price: null, imageUrl: '/images/hero-pho-bac.jpg' }
          ],
          pricePerUnit: 18,
          unit: 'tô',
          unitEn: 'bowl',
          minimumOrderQty: 1,
          sortOrder: 4,
          image: '/images/hero-pho-bac.jpg',
          videoUrl: null,
          videoStatus: 'pending',
          videoGeneratedAt: null,
          remotionTemplate: 'FoodPromo',
          tags: ['Miền Bắc', 'Soup', 'Beef', 'Homemade', 'Iconic'],
          shortTagline: 'Nước dùng trong vắt — thịt bò tươi — hương vị miền Bắc',
          shortDescription: 'Northern-style beef pho: clear bone broth, rice noodles, rare beef and meatballs.',
          description: 'Phở Bắc đúng điệu — nước dùng ninh từ xương bò, trong vắt và ngọt thanh theo phong cách Hà Nội cổ điển. Bánh phở dai mềm, thịt bò tái hồng tươi, bò viên đàn hồi, và rau sống ăn kèm. Handmade từng nồi bởi bếp nhà Emily — không phụ gia.',
          active: true,
          featured: true,
          preparationInstructions: 'Hâm nóng nước dùng đến sôi nhẹ. Trụng bánh phở trong nước sôi 30 giây. Xếp thịt tái vào tô rồi chan nước dùng nóng lên — sức nóng sẽ chín thịt vừa phải.',
          reheatingInstructions:   'Nước dùng hâm trên bếp — không dùng lò vi sóng. Bánh phở trụng riêng qua nước sôi.',
          storageInstructions:     'Tủ lạnh: nước dùng 3 ngày, thịt bò 2 ngày (để riêng). Không đông lạnh thịt tái.',
          servingNotes:            'Ăn nóng ngay sau khi chan. Thêm hành lá và chanh theo khẩu vị. Phở Bắc không dùng tương ngọt — giữ vị thanh tự nhiên.',
          allergenNotes:           'Chứa: thịt bò (beef), nước mắm (fish sauce), hành, gừng. Bánh phở gạo (không gluten). Không phù hợp ăn chay.'
        }
      ],
      aiReceptionist: {
        enabled: true,
        name: 'Emily',
        welcomeMessage:
          'Xin chào! Nhà Bếp Của Emily đây. Chúng tôi có: Chả Giò handmade, Chuối Đậu Nấu Ốc, Bún Chả Hà Nội, Bún Đậu Mắm Tôm, và Phở Bắc. Tôi có thể báo giá, hướng dẫn đặt hàng hoặc trả lời thắc mắc. Bạn muốn thử món gì?',
        quickReplies: ['Xem thực đơn & giá', 'Đặt Bún Chả Hà Nội', 'Đặt Chả Giò', 'Liên hệ Loan'],
        // NOTE: For foodvendor type, _askClaude builds the AI prompt dynamically from
        // biz.products[] at runtime — systemExtra is NOT the pricing source of truth.
        // This field is kept only as a human-readable summary and for the generic fallback.
        // Prices here must stay in sync with products[] above and CANONICAL_ITEMS in vendor-admin.html.
        systemExtra:
          'You are the AI ordering assistant for Nhà Bếp Của Emily, a home-based Vietnamese food vendor in San Jose Bay Area. Contact: Loan at 408-931-2438. Address: 2534 Clarebank Way, San Jose, CA 95121. Menu: Chả Giò (Raw $0.75/cuốn, Fresh $1.00/cuốn, min 30 cuốn), Chuối Đậu Nấu Ốc ($15/phần, min 1), Bún Chả Hà Nội ($18/phần, min 2), Bún Đậu Mắm Tôm ($15/phần, min 1), Phở Bắc ($18/tô, min 1). No preservatives, made fresh each batch. Order at least 1 day in advance. Be warm, friendly, and helpful. Answer in same language as customer (Vietnamese or English).'
      }
    },

    {
      id: 'com-tam-oc',
      category: 'food',
      active: true,
      featured: true,
      featuredPriority: 1,
      featuredRegions: ['oc'],
      homepageActive: true,
      shortPromoText: 'Cơm tấm sườn nướng Sài Gòn — đặt bàn & catering',
      availabilityType: 'hours',
      name: 'Cơm Tấm Dì Tám',
      tagline: 'Cơm tấm sườn nướng chuẩn Sài Gòn · Quận Cam',
      region: 'Orange County',
      city: 'Westminster',
      address: 'Westminster, CA',
      phone: '4089163439',
      phoneDisplay: '408-916-3439',
      hosts: [
        {
          name: 'Du Lịch Cali',
          phone: '4089163439',
          display: '408-916-3439',
          role: 'Manager'
        }
      ],
      description:
        'Cơm tấm sườn nướng công thức gia truyền từ Sài Gòn. Thịt ướp qua đêm nướng than hoa, hương vị thơm lừng không quên. Nhận catering sự kiện và tiệc tùng.',
      heroGradient:
        'linear-gradient(135deg,#dc2626 0%,#b45309 50%,#92400e 100%)',
      services: [
        { name: 'Cơm Tấm Đặc Biệt',   price: '$14',     duration: 'Phục vụ ngay',  desc: 'Sườn + chả + trứng + bì + đồ chua' },
        { name: 'Cơm Tấm Sườn Bì',    price: '$13',     duration: 'Phục vụ ngay',  desc: 'Sườn nướng than + bì + nước mắm' },
        { name: 'Hủ Tiếu Nam Vang',   price: '$14',     duration: 'Phục vụ ngay',  desc: 'Hủ tiếu nước trong veo chuẩn Nam Bộ' },
        { name: 'Bánh Mì Đặc Biệt',   price: '$8',      duration: 'Phục vụ ngay',  desc: 'Bánh mì Sài Gòn với nhân đặc biệt' },
        { name: 'Chả Giò (5 cuốn)',   price: '$10',     duration: 'Phục vụ ngay',  desc: 'Chả giò chiên vàng giòn rụm' },
        { name: 'Catering Sự Kiện',   price: 'Liên hệ', duration: 'Đặt trước 48h', desc: 'Cung cấp thức ăn cho sự kiện tiệc tùng' }
      ],
      hours: {
        'Thứ 2–6':  '10:00 AM – 9:30 PM',
        'Thứ 7':    '8:00 AM – 10:00 PM',
        'Chủ Nhật': '8:00 AM – 9:00 PM'
      },
      bookingEnabled: true,
      bookingType: 'reservation',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Lan',
        welcomeMessage:
          'Xin chào! Cơm Tấm Dì Tám đây! Tôi là Lan, sẵn sàng hỗ trợ đặt bàn, xem thực đơn hoặc hỏi về catering. Bạn cần gì ạ?',
        quickReplies: ['Xem thực đơn', 'Đặt bàn', 'Giờ mở cửa', 'Catering tiệc'],
        systemExtra:
          'You are Lan, receptionist for Cơm Tấm Dì Tám restaurant in Westminster Orange County. Contact: Du Lịch Cali 408-916-3439. Specializes in Southern Vietnamese food especially cơm tấm broken rice with grilled pork. Also does catering.'
      }
    }
  ];

  // ─── Helper Functions ──────────────────────────────────────────────────────────

  /**
   * Get all businesses for a category, optionally filtered by region.
   * @param {string} categoryId
   * @param {string|null} region
   * @returns {Array}
   */
  function getBusinesses(categoryId, region) {
    return businesses.filter(function (b) {
      if (b.category !== categoryId || !b.active) return false;
      if (region && b.region !== region) return false;
      return true;
    });
  }

  /**
   * Get a single business by id.
   * @param {string} id
   * @returns {Object|null}
   */
  function getBusiness(id) {
    for (var i = 0; i < businesses.length; i++) {
      if (businesses[i].id === id) return businesses[i];
    }
    return null;
  }

  /**
   * Get category metadata by id.
   * @param {string} id
   * @returns {Object|null}
   */
  function getCategoryMeta(id) {
    return categories[id] || null;
  }

  // ─── Expose globally ──────────────────────────────────────────────────────────
  window.MARKETPLACE = {
    categories: categories,
    businesses: businesses,
    getBusinesses: getBusinesses,
    getBusiness: getBusiness,
    getCategoryMeta: getCategoryMeta
  };
})();
