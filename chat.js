/**
 * Du Lịch Cali — AI Travel Chat Module  v2.0
 *
 * Pricing-aware AI assistant. Uses DLCPricing (pricing.js) as the shared
 * estimate engine — same logic as the booking wizard calculator.
 *
 * Modes:
 *   1. Rule-based + pricing engine  — instant, no API key needed
 *   2. Claude AI + pricing context  — rich conversation when key configured
 *
 * To enable Claude: open browser console and run:
 *   localStorage.setItem('dlc_claude_key', 'sk-ant-...')
 *   then reload.
 */

(function () {
  'use strict';

  // ── Config ───────────────────────────────────────────────────
  const CLAUDE_KEY   = localStorage.getItem('dlc_claude_key') || null;
  const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
  const MAX_TOKENS   = 900;

  // ── Marketplace Vendor Catalog ───────────────────────────────
  // Compact reference for rule-based pricing; mirrors services-data.js.
  // Update here when vendor data changes.
  const VENDOR_CATALOG = [
    {
      id: 'nha-bep-cua-emily', name: 'Nhà Bếp Của Emily',
      category: 'food', region: 'Bay Area', city: 'San Jose',
      contact: 'Loan', phone: '408-931-2438',
      products: [
        {
          keywords: ['egg roll','eggroll','chả giò','cha gio','emily','nhà bếp'],
          name: 'Chả Giò', nameEn: 'Eggroll',
          pricePerUnit: 0.75, unit: 'cuốn', unitEn: 'piece',
          minOrder: 30, maxPerDay: 300,
          variants: 'Sống (Raw) hoặc Tươi (Fresh)',
          orderNote: 'Đặt trước 24h. Gọi Loan: 408-931-2438.',
          preparationInstructions: 'Chiên trong dầu nóng 350°F (175°C) trong 8–10 phút, lật đều. Khi vàng giòn là được. Không cần rã đông — chiên thẳng từ tủ lạnh.',
          reheatingInstructions:   'Lò nướng 325°F 5–7 phút, hoặc air fryer 320°F 4 phút. Tránh lò vi sóng — làm mất độ giòn.',
          storageInstructions:     'Tủ lạnh: tối đa 3 ngày. Đông lạnh: tối đa 2 tháng. Chiên thẳng từ đông lạnh, không cần rã đông.',
          servingNotes:            'Ăn nóng khi mới chiên. Dùng kèm tương ớt, hoisin, hoặc nước chấm chua ngọt.',
          allergenNotes:           'Thịt heo, nấm hương, cà rốt, hành tây, bún tàu. Vỏ bánh tráng gạo (không gluten). Không đậu phộng.',
        },
        {
          keywords: ['chuối đậu','chuoi dau','nau oc','ốc','snail','tofu','banana stew','bắc'],
          name: 'Chuối Đậu Nấu Ốc', nameEn: 'Northern Vietnamese Snail, Tofu & Green Banana Stew',
          pricePerUnit: 15, unit: 'phần', unitEn: 'serving',
          minOrder: 1, maxPerDay: 30,
          tags: ['Miền Bắc', 'Homemade', 'Comfort Food', 'Limited Batch'],
          orderNote: 'Đặt trước — số lượng có hạn. Gọi Loan: 408-931-2438.',
          preparationInstructions: 'Hâm nóng trên bếp nhỏ lửa 5–8 phút. Thêm rau thơm tươi trước khi dùng.',
          storageInstructions:     'Tủ lạnh: tối đa 2 ngày. Không đông lạnh — ốc tươi mất kết cấu.',
          servingNotes:            'Dùng nóng với bún hoặc cơm trắng. Thêm mắm tôm và ớt tươi theo khẩu vị.',
          allergenNotes:           'Ốc (shellfish), đậu phụ (soy), hành, ớt. Không gluten. Không ăn được cho người ăn chay (có ốc).',
        },
      ],
    },
    {
      id: 'dung-nails', name: 'Dung Nails & Spa',
      category: 'nails', region: 'Bay Area', city: 'San Jose',
      contact: 'Dung Pham', phone: '408-859-6718',
      hours: 'T2-6: 9am-7pm · T7: 9am-6pm · CN: 10am-5pm',
      bookingNote: 'Đặt lịch: 408-859-6718.',
      services: [
        { keywords: ['manicure','làm móng tay'],          name: 'Manicure',         priceMin: 20 },
        { keywords: ['pedicure','làm móng chân'],          name: 'Pedicure',         priceMin: 30 },
        { keywords: ['gel nails','gel color','gel'],       name: 'Gel Nails',        priceMin: 35 },
        { keywords: ['acrylic','full set'],                name: 'Acrylic Full Set', priceMin: 45 },
        { keywords: ['nail art','vẽ móng'],                name: 'Nail Art',         priceMin: 10 },
        { keywords: ['spa package','spa nails'],           name: 'Spa Package',      priceMin: 65 },
      ],
    },
    {
      id: 'beauty-nails-oc', name: 'Beauty Nails OC',
      category: 'nails', region: 'Orange County', city: 'Westminster',
      contact: 'Duy Hoa', phone: '714-227-6007',
      hours: 'T2-6: 9:30am-7:30pm · T7: 9am-7pm · CN: 10am-6pm',
      bookingNote: 'Đặt lịch: 714-227-6007.',
      services: [
        { keywords: ['manicure','làm móng tay'],          name: 'Manicure',         priceMin: 18 },
        { keywords: ['pedicure','làm móng chân'],          name: 'Pedicure',         priceMin: 28 },
        { keywords: ['gel color','gel'],                  name: 'Gel Color',         priceMin: 30 },
        { keywords: ['acrylic','full set'],               name: 'Full Set Acrylic',  priceMin: 40 },
        { keywords: ['ombre'],                            name: 'Ombre Nails',       priceMin: 55 },
        { keywords: ['nail art','vẽ móng'],               name: 'Nail Art',          priceMin:  8 },
      ],
    },
    {
      id: 'viet-hair-bayarea', name: 'Việt Hair Studio',
      category: 'hair', region: 'Bay Area', city: 'San Jose',
      contact: 'John', phone: '408-439-7522',
      hours: 'T3-6: 10am-7pm · T7: 9am-6pm · CN: 10am-5pm · Nghỉ T2',
      bookingNote: 'Đặt lịch: 408-439-7522.',
      services: [
        { keywords: ['men haircut','cắt tóc nam'],               name: 'Cắt Tóc Nam',    priceMin:  20 },
        { keywords: ['women haircut','cắt tóc nữ','cắt tóc'],   name: 'Cắt Tóc Nữ',    priceMin:  30 },
        { keywords: ['perm','uốn tóc','uốn'],                   name: 'Uốn Tóc',        priceMin:  80 },
        { keywords: ['straighten','duỗi','thẳng tóc'],          name: 'Duỗi/Thẳng',    priceMin: 100 },
        { keywords: ['hair color','nhuộm tóc','nhuộm'],         name: 'Nhuộm Tóc',     priceMin:  60 },
        { keywords: ['highlight'],                               name: 'Highlight',      priceMin:  80 },
      ],
    },
    {
      id: 'cali-hair-oc', name: 'Cali Hair & Beauty',
      category: 'hair', region: 'Orange County', city: 'Garden Grove',
      contact: 'Duy Hoa', phone: '714-227-6007',
      hours: 'T2-6: 9am-7pm · T7: 8:30am-7pm · CN: 10am-6pm',
      bookingNote: 'Đặt lịch: 714-227-6007.',
      services: [
        { keywords: ['men haircut','cắt tóc nam'],               name: 'Cắt Tóc Nam',       priceMin:  18 },
        { keywords: ['women haircut','cắt tóc nữ','cắt tóc'],   name: 'Cắt Tóc Nữ',       priceMin:  28 },
        { keywords: ['korean perm','uốn hàn','uốn'],            name: 'Uốn Hàn Quốc',     priceMin: 120 },
        { keywords: ['keratin','duỗi'],                         name: 'Keratin Treatment',  priceMin: 150 },
        { keywords: ['balayage','nhuộm'],                       name: 'Nhuộm Balayage',    priceMin: 100 },
        { keywords: ['conditioning','dưỡng tóc'],               name: 'Deep Conditioning',  priceMin:  40 },
      ],
    },
    {
      id: 'pho-bac-bayarea', name: 'Phở Bắc Bay Area',
      category: 'food', region: 'Bay Area', city: 'San Jose',
      contact: 'John', phone: '408-439-7522',
      hours: 'T2-5: 10am-9pm · T6-7: 9am-10pm · CN: 9am-9pm',
      bookingNote: 'Đặt bàn: 408-439-7522.',
      services: [
        { keywords: ['phở','pho'],                              name: 'Phở Bò Đặc Biệt', priceMin: 15 },
        { keywords: ['bún bò','bun bo'],                       name: 'Bún Bò Huế',       priceMin: 14 },
        { keywords: ['cơm tấm bay area','com tam'],            name: 'Cơm Tấm Sườn',    priceMin: 16 },
        { keywords: ['bún chả','bun cha'],                     name: 'Bún Chả',          priceMin: 15 },
        { keywords: ['gỏi cuốn','fresh roll'],                 name: 'Gỏi Cuốn',         priceMin:  8 },
        { keywords: ['catering bay area'],                     name: 'Catering',          priceMin: null },
      ],
    },
    {
      id: 'com-tam-oc', name: 'Cơm Tấm Dì Tám',
      category: 'food', region: 'Orange County', city: 'Westminster',
      contact: 'Duy Hoa', phone: '714-227-6007',
      hours: 'T2-6: 10am-9:30pm · T7: 8am-10pm · CN: 8am-9pm',
      bookingNote: 'Đặt bàn: 714-227-6007.',
      services: [
        { keywords: ['cơm tấm dì tám','com tam oc'],           name: 'Cơm Tấm Đặc Biệt', priceMin: 14 },
        { keywords: ['hủ tiếu','hu tieu'],                     name: 'Hủ Tiếu Nam Vang',  priceMin: 14 },
        { keywords: ['bánh mì','banh mi'],                     name: 'Bánh Mì',            priceMin:  8 },
        { keywords: ['chả giò oc'],                            name: 'Chả Giò',            priceMin: 10 },
        { keywords: ['catering oc','catering sự kiện'],        name: 'Catering',           priceMin: null },
      ],
    },
  ];

  // ── Region helpers ───────────────────────────────────────────
  // Always read from DLCRegion.current at call time so replies reflect
  // the live region without needing to restart the chat session.

  function regionPhone() {
    return window.DLCRegion ? DLCRegion.current.hosts[0].display : '714-227-6007';
  }
  function regionHostName() {
    return window.DLCRegion ? DLCRegion.current.hosts[0].name : 'Duy Hoa';
  }
  // Resolve region from query text; falls back to current UI region.
  function resolveRegion(text) {
    if (!window.DLCRegion) return null;
    return DLCRegion.detectFromText(text || '') || DLCRegion.current;
  }

  // ══════════════════════════════════════════════════════════════
  //  NATURAL LANGUAGE PARSER
  //  Extracts intent + parameters from free-text questions
  // ══════════════════════════════════════════════════════════════

  function parseIntent(text) {
    const route = extractRoute(text);
    return {
      // Service intent
      isTour:       /tour|chuyến|du lịch|trip|visit|thăm|đi|yosemite|vegas|san francisco|sf\b|golden gate|cầu vàng|disneyland|disney|anaheim|napa|tahoe|monterey|big sur|sequoia|kings canyon|santa barbara|solvang|palm springs|joshua tree|grand canyon|17.?mile|pebble beach|los angeles|san diego/i.test(text),
      isTransfer:   /airport|sân bay|đón|pickup|pick.?up|dropoff|drop.?off|đưa|limo|transfer|đưa đón/i.test(text),
      isComparison: /cheaper|rẻ hơn|so sánh|compare|which|cái nào|nào rẻ|nào tốt|difference|khác nhau/i.test(text),
      isPricing:    /bao nhiêu|giá|cost|price|how much|estimate|ước tính|khoảng|phí|tiền|fee|charge/i.test(text),
      isExplain:    /why|tại sao|how.*calc|tính như thế nào|explain|breakdown|gồm gì|bao gồm|cấu thành/i.test(text),
      isInfoNeeded: /what.*need|cần gì|info.*exact|exact.*quote|thông tin|need.*quote|để.*chính xác/i.test(text),
      isGreeting:   /^(xin chào|chào|hello|hi\b|hey\b|alo)/i.test(text.trim()),
      isContact:    /điện thoại|số điện|phone|contact|liên hệ|gọi|email/i.test(text),
      isBook:       /đặt|book|reserve|đặt chỗ|đặt tour/i.test(text),
      isTracking:   /track|theo dõi|kiểm tra|check.*order|check.*status|tình trạng|đơn hàng|đơn đặt|mã đặt|booking.*id|trạng thái|status|DLC-/i.test(text),
      isVehicle:    /xe|vehicle|car|tesla|van|mercedes/i.test(text),
      isRoute:      route !== null,

      // Extracted values
      destId:     extractDestId(text),
      passengers: extractPassengers(text),
      days:       extractDays(text),
      city:       extractCity(text),
      airport:    extractAirport(text),
      lodging:    extractLodging(text),
      route,      // { from, to } or null
      isMarketplace:   /egg.?roll|chả giò|cha gio|nail|manicure|pedicure|gel nails|acrylic|nail art|hair salon|tiệm tóc|tiệm nail|cắt tóc|uốn tóc|nhuộm tóc|keratin|balayage|phở|bún bò|cơm tấm|catering|nhà bếp|emily|how.*fry|fry.*roll|chiên.*chả|chả.*chiên|reheat|hâm nóng|air fryer|bảo quản|tủ lạnh|đông lạnh|thành phần|dị ứng|allergen/i.test(text),
      isQuantityQuery: !!extractQuantity(text),
    };
  }

  /**
   * Extracts explicit "from X to Y" / "từ X đến Y" routing patterns.
   * Returns { from, to } or null.
   */
  function extractRoute(text) {
    // English: "from San Jose to Las Vegas", "San Jose to San Francisco for 3 people"
    const enMatch = text.match(
      /(?:from\s+)?([\w\s]+?)\s+to\s+([\w\s]+?)(?:\s+for\b|\s+with\b|\s+airport\b|\s*[?,]|$)/i
    );
    if (enMatch) {
      const from = enMatch[1].trim();
      const to   = enMatch[2].trim();
      // Filter out too-short or obviously wrong matches
      if (from.length >= 3 && to.length >= 3 &&
          !/^(how|what|when|where|the|a|an|i|we|you)$/i.test(from)) {
        return { from, to };
      }
    }
    // Vietnamese: "từ San Jose đến Las Vegas", "từ Anaheim tới SF"
    const viMatch = text.match(/từ\s+([\w\s]+?)\s+(?:đến|tới)\s+([\w\s]+?)(?:\s+cho|\s+với|\s*[,?]|$)/i);
    if (viMatch) {
      return { from: viMatch[1].trim(), to: viMatch[2].trim() };
    }
    return null;
  }

  function extractDestId(text) {
    // Most specific patterns first to avoid partial matches
    if (/yosemite/i.test(text))                                        return 'yosemite';
    if (/\bvegas\b|las vegas/i.test(text))                             return 'lasvegas';
    if (/san francisco|sf\b|golden gate|cầu vàng/i.test(text))        return 'sanfrancisco';
    if (/grand canyon/i.test(text))                                    return 'grandcanyon';
    if (/17.?mile.*drive|pebble beach/i.test(text))                    return '17miledrive';
    if (/palm springs|joshua tree/i.test(text))                        return 'palmsprings';
    if (/lake tahoe|\btahoe\b/i.test(text))                            return 'laketahoe';
    if (/napa valley|\bnapa\b/i.test(text))                            return 'napavalley';
    if (/monterey|big sur/i.test(text))                                return 'monterey';
    if (/santa barbara/i.test(text))                                   return 'santabarbara';
    if (/sequoia|kings canyon/i.test(text))                            return 'sequoia';
    if (/\bsolvang\b/i.test(text))                                     return 'solvang';
    if (/disneyland|disney.*park|\banaheim\b/i.test(text))             return 'anaheim';
    if (/san diego/i.test(text))                                       return 'sandiego';
    if (/los angeles/i.test(text))                                     return 'losangeles';
    return null;
  }

  function extractPassengers(text) {
    // "4 people", "6 passengers", "4 người", "nhóm 5", "for 3"
    const m = text.match(/(\d+)\s*(người|khách|person|people|passenger|pax|guests?)\b/i)
           || text.match(/\bfor\s+(\d+)\b/i)
           || text.match(/\bnhóm\s+(\d+)\b/i)
           || text.match(/\b(\d+)\s+of us\b/i);
    const n = m ? parseInt(m[1]) : null;
    return (n && n >= 1 && n <= 20) ? n : null;
  }

  function extractDays(text) {
    // "3 days", "2 ngày", "3-day trip"
    const m = text.match(/(\d+)[- ]?(ngày|days?|đêm|nights?)\b/i);
    const n = m ? parseInt(m[1]) : null;
    return (n && n >= 1 && n <= 14) ? n : null;
  }

  function extractCity(text) {
    if (!window.DLCPricing) return null;
    const t = text.toLowerCase();
    const cities = Object.keys(DLCPricing.CITY_TO_OC).sort((a, b) => b.length - a.length);
    for (const city of cities) {
      if (t.includes(city)) return city;
    }
    return null;
  }

  function extractAirport(text) {
    const t = text.toLowerCase();
    const codes = ['lax', 'sna', 'lgb', 'ont', 'bur', 'san', 'sfo', 'oak', 'sjc', 'smf'];
    for (const code of codes) {
      if (new RegExp(`\\b${code}\\b`).test(t)) return code;
    }
    if (/john wayne/i.test(text))                    return 'sna';
    if (/long beach.*airport/i.test(text))           return 'lgb';
    if (/burbank.*airport/i.test(text))              return 'bur';
    if (/san francisco.*airport/i.test(text))        return 'sfo';
    if (/oakland.*airport/i.test(text))              return 'oak';
    if (/san jose.*airport|mineta/i.test(text))      return 'sjc';
    if (/sacramento.*airport/i.test(text))           return 'smf';
    return null;
  }

  function extractLodging(text) {
    if (/hotel|khách sạn/i.test(text)) return 'hotel';
    if (/airbnb|nhà thuê/i.test(text)) return 'airbnb';
    return null;
  }

  // ══════════════════════════════════════════════════════════════
  //  PRICING REPLY BUILDER
  //  Generates a natural, informative estimate response using DLCPricing
  // ══════════════════════════════════════════════════════════════

  // Conversation memory: persist extracted params across turns
  const chatCtx = { passengers: null, days: null, destId: null };

  function buildPricingReply(intent, rawText) {
    if (typeof DLCPricing === 'undefined') return null;

    // Merge intent values with conversation memory (explicit question wins)
    const form       = DLCPricing.getCurrentFormState();
    const passengers = intent.passengers || chatCtx.passengers || form.passengers || 2;
    const days       = intent.days       || chatCtx.days       || form.days       || 2;
    const destId     = intent.destId     || chatCtx.destId;
    const lodging    = intent.lodging    || form.lodging || '';

    // Persist for next turn
    if (intent.passengers) chatCtx.passengers = intent.passengers;
    if (intent.days)       chatCtx.days       = intent.days;
    if (intent.destId)     chatCtx.destId     = intent.destId;

    // ── Route (FROM X TO Y) — highest priority ────────────────
    // Must check BEFORE single-city tour logic so "San Jose to SF" doesn't
    // silently fall into an OC-based tour estimate.
    if (intent.isRoute && intent.route) {
      return buildRouteReply(intent.route.from, intent.route.to, passengers, days, lodging);
    }

    // ── Destination + known origin city ──────────────────────
    // e.g. "How much Yosemite from San Jose" (no explicit "to" keyword)
    if (destId && intent.city && (intent.isPricing || intent.isTour)) {
      return buildCityToDestReply(intent.city, destId, passengers, days, lodging);
    }

    // ── Comparison ────────────────────────────────────────────
    if (intent.isComparison && !destId) {
      return buildComparisonReply(passengers, days, lodging, intent.city);
    }

    // ── Transfer / Airport ────────────────────────────────────
    if (intent.isTransfer && (intent.city || intent.airport)) {
      return buildTransferReply(intent, passengers);
    }

    // ── Tour estimate (OC-based default) ─────────────────────
    if (destId && (intent.isPricing || intent.isTour)) {
      return buildTourReply(destId, passengers, days, lodging, form.hasAddress);
    }

    // ── "What info do you need?" ──────────────────────────────
    if (intent.isInfoNeeded) {
      return buildInfoNeededReply();
    }

    // ── Explain pricing breakdown ─────────────────────────────
    if (intent.isExplain && destId) {
      return buildExplainReply(destId, passengers, days, lodging);
    }

    // ── Generic pricing — no destination yet ─────────────────
    if (intent.isPricing && !destId && !intent.isTransfer) {
      return buildAllEstimatesReply(passengers, days);
    }

    return null; // No pricing match — fall through to static rules
  }

  /**
   * Handles explicit "from X to Y" queries.
   * Routes to the right estimator depending on whether "to" is a known destination.
   */
  function buildRouteReply(from, to, passengers, days, lodging) {
    const toDestId = detectDestIdInText(to);

    if (toDestId) {
      // "from San Jose to Las Vegas" → city-to-destination tour estimate
      return buildCityToDestReply(from, toDestId, passengers, days, lodging);
    }

    // "from San Jose to San Francisco" → point-to-point transfer
    const est = DLCPricing.estimateCityToCity({ from, to, passengers, roundTrip: false });
    if (!est) {
      return `Tôi chưa có dữ liệu khoảng cách cho tuyến ${titleCase(from)} → ${titleCase(to)}.\n\nVui lòng nhập địa chỉ đầy đủ trong tab Đặt chỗ để tính giá chính xác, hoặc gọi ${regionPhone()}.`;
    }
    const rtEst = DLCPricing.estimateCityToCity({ from, to, passengers, roundTrip: true });
    return [
      `Ước tính di chuyển ${titleCase(from)} → ${titleCase(to)}:`,
      '',
      `💰 Một chiều: ~$${est.total}`,
      rtEst ? `💰 Khứ hồi: ~$${rtEst.total}` : '',
      `🚗 ${est.vehicle} (${passengers} khách) · ~${est.miles} dặm`,
      '',
      'Đây là ước tính sơ bộ. Giá chính xác phụ thuộc vào địa chỉ đón/trả cụ thể.',
      `Nhập địa chỉ trong tab Đặt chỗ hoặc gọi ${regionPhone()}.`,
    ].filter(Boolean).join('\n');
  }

  /**
   * Handles "from [city] to [destination]" — uses actual city→dest distance.
   */
  function buildCityToDestReply(fromCity, destId, passengers, days, lodging) {
    const est = DLCPricing.estimateFromCity({ fromCity, destId, passengers, days, lodging });
    if (!est) {
      // Fallback to OC-based estimate with a caveat
      return buildTourReply(destId, passengers, days, lodging, false);
    }
    const dest = typeof DESTINATIONS !== 'undefined'
      ? DESTINATIONS.find(d => d.id === destId) : null;
    const destName = dest ? dest.name.vi : destId;
    const lodge    = lodging
      ? `(bao gồm chỗ ở ${lodging === 'hotel' ? 'khách sạn' : 'Airbnb'})`
      : '(chưa bao gồm chỗ ở)';
    const ocEst = DLCPricing.estimateTour({ destId, passengers, days, lodging });

    const lines = [
      `Ước tính tour ${destName} từ ${titleCase(fromCity)}, ${passengers} người × ${days} ngày:`,
      '',
      `💰 ~$${est.total} ${lodge}`,
      `👤 ~$${est.perPerson}/người`,
      `🚗 ${est.vehicle} · ~${est.miles} dặm từ ${titleCase(fromCity)}`,
      `⛽ Xăng CA: ~$${est.gasPrice.toFixed(2)}/gal`,
    ];
    if (ocEst && Math.abs(ocEst.total - est.total) > 50) {
      lines.push(``, `ℹ️ So với Orange County (~$${ocEst.total}): ${est.total < ocEst.total ? 'rẻ hơn' : 'đắt hơn'} khoảng $${Math.abs(ocEst.total - est.total)}.`);
    }
    lines.push(``, `Đây là ước tính sơ bộ. Giá cuối phụ thuộc vào địa chỉ đón thực tế.`, `Gọi ${regionPhone()} để nhận báo giá trọn gói.`);
    return lines.join('\n');
  }

  function detectDestIdInText(s) {
    const t = (s || '').toLowerCase();
    if (/yosemite/.test(t))                          return 'yosemite';
    if (/\bvegas\b|las vegas/.test(t))               return 'lasvegas';
    if (/san francisco|sf\b|golden gate|sfo/.test(t)) return 'sanfrancisco';
    return null;
  }

  function titleCase(s) {
    return (s || '').replace(/\b\w/g, c => c.toUpperCase());
  }

  function buildTourReply(destId, passengers, days, lodging, hasAddress) {
    const est  = DLCPricing.estimateTour({ destId, passengers, days, lodging });
    if (!est) return null;
    const dest = typeof DESTINATIONS !== 'undefined'
      ? DESTINATIONS.find(d => d.id === destId) : null;
    const name  = dest ? dest.name.vi : destId;
    const lodge = lodging
      ? `(${lodging === 'hotel' ? 'khách sạn' : 'Airbnb'} ước tính ${
          lodging === 'hotel'
            ? (passengers > 8 ? 3 : passengers > 4 ? 2 : 1) * 150
            : Math.ceil(passengers / 8) * 165
        }$/đêm)`
      : '(chưa bao gồm chỗ ở)';

    const lines = [
      `Ước tính tour ${name} cho ${passengers} người × ${days} ngày:`,
      '',
      `💰 ~$${est.total} ${lodge}`,
      `👤 ~$${est.perPerson}/người`,
      `🚗 ${est.vehicle} · ${est.miles} dặm từ OC`,
      `⛽ Xăng CA: ~$${est.gasPrice.toFixed(2)}/gal`,
      '',
      hasAddress
        ? 'Đây là ước tính từ vị trí bạn đã nhập. Giá chính xác sẽ được xác nhận sau khi đặt.'
        : 'Đây là ước tính sơ bộ từ Orange County. Giá có thể thay đổi theo địa chỉ đón thực tế.',
      `Gọi ${regionPhone()} để nhận báo giá trọn gói.`,
    ];
    return lines.join('\n');
  }

  function buildTransferReply(intent, passengers) {
    const est = DLCPricing.estimateTransfer({
      fromCity:  intent.city    || '',
      airport:   intent.airport || '',
      passengers,
      direction: intent.isTransfer ? 'pickup' : 'dropoff',
    });
    if (!est) {
      return `Để ước tính giá đưa đón sân bay, cho tôi biết:\n• Địa chỉ đón của bạn (thành phố hoặc địa chỉ cụ thể)\n• Sân bay muốn đến/đi (LAX, SNA, LGB, ONT, BUR, SAN)\n• Số hành khách`;
    }
    const airportName = intent.airport
      ? intent.airport.toUpperCase()
      : 'sân bay';
    const fromName = intent.city
      ? intent.city.replace(/\b\w/g, c => c.toUpperCase())
      : 'địa chỉ của bạn';

    return [
      `Ước tính đưa đón ${airportName} từ ${fromName}:`,
      '',
      `💰 ~$${est.total}`,
      `🚗 ${est.vehicle} (${passengers} khách)`,
      `📍 ~${est.miles} dặm`,
      '',
      'Đây là ước tính sơ bộ. Nhập địa chỉ chính xác trong tab Đặt chỗ để có báo giá chính xác hơn.',
    ].join('\n');
  }

  function buildComparisonReply(passengers, days, lodging, fromCity = null) {
    let sorted, originLabel;
    if (fromCity) {
      // Use city-specific distances if we have them
      const ids = ['lasvegas', 'yosemite', 'sanfrancisco'];
      const results = ids.map(id => {
        const est = DLCPricing.estimateFromCity({ fromCity, destId: id, passengers, days, lodging })
                 || DLCPricing.estimateTour({ destId: id, passengers, days, lodging });
        return { id, est };
      }).filter(x => x.est).sort((a, b) => a.est.total - b.est.total);
      sorted = results;
      originLabel = `từ ${titleCase(fromCity)}`;
    } else {
      sorted = DLCPricing.compareTours({ passengers, days, lodging });
      originLabel = 'từ Orange County';
    }
    const lines = sorted.map(({ id, est }) => {
      const dest = typeof DESTINATIONS !== 'undefined'
        ? DESTINATIONS.find(d => d.id === id) : null;
      const name = dest ? dest.name.vi : id;
      return `• ${name}: ~$${est.total} (~${est.miles} dặm · ${est.vehicle})`;
    });
    const cheapest  = sorted[0];
    const cheapName = (typeof DESTINATIONS !== 'undefined'
      ? DESTINATIONS.find(d => d.id === cheapest.id)?.name.vi : null) || cheapest.id;

    return [
      `So sánh cho ${passengers} người × ${days} ngày (${originLabel}):`,
      '',
      ...lines,
      '',
      `${cheapName} là lựa chọn tiết kiệm nhất.`,
      fromCity ? `Giá là ước tính sơ bộ — gọi ${regionPhone()} để nhận báo giá chính xác.` : 'Cho tôi biết thành phố đón để ước tính chính xác hơn.',
    ].join('\n');
  }

  function buildExplainReply(destId, passengers, days, lodging) {
    const explanation = DLCPricing.explainTour({ destId, passengers, days, lodging });
    const est = DLCPricing.estimateTour({ destId, passengers, days, lodging });
    if (!est) return null;
    return [
      `Cách tính ước tính ~$${est.total}:`,
      '',
      explanation || '',
      '',
      'Lưu ý: đây là ước tính chưa bao gồm phí cầu đường, phí đỗ xe, và các chi phí phát sinh tại điểm đến.',
    ].join('\n');
  }

  function buildAllEstimatesReply(passengers, days) {
    const sorted = DLCPricing.compareTours({ passengers, days });
    const lines  = sorted.map(({ id, est }) => {
      const dest = typeof DESTINATIONS !== 'undefined'
        ? DESTINATIONS.find(d => d.id === id) : null;
      const name = dest ? dest.name.vi : id;
      return `• Tour ${name}: ~$${est.total} (${days} ngày · ${passengers} người)`;
    });
    return [
      `Ước tính dịch vụ Du Lịch Cali (${passengers} người):`,
      '',
      ...lines,
      '• Đưa đón sân bay: từ $100 (tùy khoảng cách)',
      '',
      'Giá trên là ước tính sơ bộ xe khứ hồi từ Orange County. Bạn muốn biết chi tiết cho điểm đến nào?',
    ].join('\n');
  }

  function buildInfoNeededReply() {
    return [
      'Để báo giá chính xác, tôi cần:',
      '• Điểm đến (Las Vegas, Yosemite, San Francisco)',
      '• Địa chỉ đón của bạn (thành phố hoặc địa chỉ cụ thể)',
      '• Số hành khách',
      '• Số ngày (cho tour)',
      '• Loại chỗ ở nếu muốn tính luôn (khách sạn / Airbnb)',
      '',
      `Bạn có thể dùng tab Đặt chỗ để nhập thông tin và nhận ước tính ngay, hoặc gọi ${regionPhone()}.`,
    ].join('\n');
  }

  // ══════════════════════════════════════════════════════════════
  //  STATIC RULE-BASED RESPONSES
  //  Non-pricing / greeting / contact / vehicle questions
  // ══════════════════════════════════════════════════════════════

  const STATIC_RULES = [
    {
      match: [/xin chào|^chào|^hello|^hi\b|^hey\b/i],
      reply: () => 'Xin chào! Tôi là trợ lý du lịch của Du Lịch Cali.\n\nTôi có thể giúp bạn:\n• Ước tính chi phí tour và đưa đón sân bay\n• Tư vấn Las Vegas, Yosemite, San Francisco\n• Giải thích cách tính giá\n\nBạn muốn đi đâu, và cho tôi biết số người đi để tôi ước tính ngay nhé!'
    },
    {
      match: [/cảm ơn|thank/i],
      reply: () => `Không có gì! Nếu cần ước tính chi tiết hơn, cứ hỏi tôi. Để đặt chỗ chính thức, gọi ${regionHostName()}: ${regionPhone()} 😊`
    },
    {
      match: [/điện thoại|số điện|phone|contact|liên hệ/i],
      reply: (text) => {
        const r     = resolveRegion(text);
        const hosts = r ? r.hosts : [{ name: 'Duy Hoa', display: '714-227-6007' }];
        return [
          'Liên hệ Du Lịch Cali:',
          ...hosts.map(h => `📞 ${h.name}: ${h.display}`),
          '📧 dulichcali21@gmail.com',
          '',
          'Phục vụ 7 ngày / tuần.',
        ].join('\n');
      }
    },
    {
      match: [/đặt|book|reserve/i],
      reply: () => `Để đặt chỗ:\n• Bấm tab "Đặt chỗ" trong ứng dụng này — nhập thông tin và nhận ước tính tức thì\n• Hoặc gọi: ${regionHostName()} ${regionPhone()}\n\nSau khi gửi form, chúng tôi xác nhận trong 2 tiếng.`
    },
    {
      match: [/giờ|mấy giờ|open|hours|working/i],
      reply: () => {
        const r = resolveRegion('');
        const hosts = r ? r.hosts : [{ name: 'Duy Hoa', display: '714-227-6007' }];
        return `Phục vụ 7 ngày/tuần. Gọi bất kỳ lúc nào:\n${hosts.map(h => `• ${h.name}: ${h.display}`).join('\n')}\nThường phản hồi trong 1–2 tiếng.`;
      }
    },
    {
      match: [/xe|vehicle|car|toyota|sienna|tesla|van|mercedes/i],
      reply: (text) => {
        const r = resolveRegion(text);
        if (r && r.id === 'bayarea') {
          const hosts = r.hosts.map(h => `${h.name} (${h.display})`).join(', ');
          return `Xe phục vụ vùng Bay Area:\n🚐 ${r.vehicle.name} — tối đa ${r.vehicle.seats} ghế\n\nLiên hệ: ${hosts}`;
        }
        return 'Đội xe Du Lịch Cali:\n🚗 Tesla Model Y — 1–3 khách (điện, cao cấp, yên tĩnh)\n🚐 Mercedes-Benz Van — 4–12 khách (rộng rãi, thoải mái)\n\nXe sạch sẽ, mới, đầy đủ tiện nghi.';
      }
    },
    {
      match: [/sân bay|airport/i],
      reply: (text) => {
        const r = resolveRegion(text);
        if (r && r.id === 'bayarea') {
          return `Đưa đón sân bay vùng Bay Area:\n• SFO (San Francisco) · SJC (San Jose) · OAK (Oakland)\n\nGiá từ $100. Cho tôi biết địa chỉ đón để ước tính cụ thể!`;
        }
        return 'Đưa đón 6 sân bay Nam California:\n• LAX (Los Angeles) · SNA (John Wayne/OC)\n• LGB (Long Beach) · ONT (Ontario)\n• BUR (Burbank) · SAN (San Diego)\n\nGiá từ $100. Cho tôi biết thành phố đón để ước tính cụ thể hơn!';
      }
    },
  ];

  function staticReply(text) {
    for (const rule of STATIC_RULES) {
      if (rule.match.some(r => r.test(text))) return rule.reply(text);
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════
  //  ORDER TRACKING BY PHONE NUMBER
  //  Queries Firestore bookings collection by customer phone
  // ══════════════════════════════════════════════════════════════

  /** Extract a phone number from user text (US formats) */
  function extractPhone(text) {
    // Match patterns: 408-859-6718, (408) 859-6718, 4088596718, 408.859.6718
    const m = text.match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
    return m ? m[0].replace(/[\s.\-()]/g, '') : null;
  }

  /** Extract a booking ID like DLC-XXXXXX */
  function extractBookingId(text) {
    const m = text.match(/DLC-[A-Z0-9]{5,8}/i);
    return m ? m[0].toUpperCase() : null;
  }

  /** Status labels in Vietnamese */
  const STATUS_LABELS = {
    pending:    '⏳ Chờ xác nhận',
    confirmed:  '✅ Đã xác nhận',
    enroute:    '🚗 Đang trên đường',
    completed:  '✔️ Hoàn thành',
    cancelled:  '❌ Đã hủy',
  };

  /**
   * Look up bookings by phone number or booking ID from Firestore.
   * Returns a formatted status string for the chat.
   */
  async function lookupBooking(text) {
    if (typeof firebase === 'undefined' || !firebase.firestore) return null;
    const db = firebase.firestore();

    const bookingId = extractBookingId(text);
    const phone     = extractPhone(text);

    if (!bookingId && !phone) {
      return 'Để kiểm tra đơn đặt chỗ, vui lòng cho tôi biết:\n• **Số điện thoại** bạn đã dùng khi đặt chỗ\n• Hoặc **mã đặt chỗ** (ví dụ: DLC-ABC123)\n\nVí dụ: "Kiểm tra đơn 408-859-6718"';
    }

    try {
      let snapshot;
      if (bookingId) {
        // Direct lookup by booking ID
        const doc = await db.collection('bookings').doc(bookingId).get();
        if (!doc.exists) return `Không tìm thấy đơn với mã **${bookingId}**. Vui lòng kiểm tra lại mã đặt chỗ.`;
        snapshot = { docs: [doc] };
      } else {
        // Query by phone number
        snapshot = await db.collection('bookings')
          .where('phone', '==', phone)
          .orderBy('createdAt', 'desc')
          .limit(5)
          .get();

        if (snapshot.empty) {
          // Try with formatted phone variations
          const formatted = phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
          snapshot = await db.collection('bookings')
            .where('phone', '==', formatted)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        }

        if (snapshot.empty) {
          return `Không tìm thấy đơn đặt chỗ nào với số điện thoại **${phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}**.\n\nVui lòng kiểm tra lại số điện thoại hoặc cung cấp mã đặt chỗ (ví dụ: DLC-ABC123).`;
        }
      }

      const results = snapshot.docs.map(doc => {
        const d = doc.data();
        const status = STATUS_LABELS[d.status] || d.status || '⏳ Chờ xác nhận';
        const dt = d.datetime ? new Date(d.datetime).toLocaleString('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true
        }) : 'Chưa xác định';
        const svc = d.serviceType || '';
        const pax = d.passengers || '';

        return [
          `📋 **Mã: ${d.bookingId || doc.id}**`,
          `   Trạng thái: ${status}`,
          `   Dịch vụ: ${svc}`,
          `   Thời gian: ${dt}`,
          pax ? `   Số khách: ${pax}` : '',
          d.airport ? `   Sân bay: ${d.airport}` : '',
          d.address ? `   Địa chỉ: ${d.address}` : '',
        ].filter(Boolean).join('\n');
      });

      const header = results.length === 1
        ? 'Đây là thông tin đơn đặt chỗ của bạn:'
        : `Tìm thấy **${results.length}** đơn đặt chỗ:`;

      return [
        header,
        '',
        ...results,
        '',
        `Nếu cần hỗ trợ thêm, gọi ${regionHostName()}: ${regionPhone()}`,
      ].join('\n');

    } catch (err) {
      console.error('Booking lookup error:', err);
      return `Xin lỗi, không thể tra cứu lúc này. Vui lòng gọi ${regionHostName()}: ${regionPhone()} để kiểm tra trực tiếp.`;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  MARKETPLACE ENGINE — product pricing, vendor orders, AI context
  // ══════════════════════════════════════════════════════════════

  /** Extract a numeric quantity from text: "30 egg rolls", "50 cuốn", "order 100" */
  function extractQuantity(text) {
    const m = text.match(/(\d+)\s*(?:cuốn|cái|piece|roll|phần|tô|dĩa)/i)
           || text.match(/(?:order|đặt|mua|cần)\s+(\d+)\b/i)
           || text.match(/\b(\d+)\s+(?:egg|chả|spring|bánh)\b/i);
    const n = m ? parseInt(m[1], 10) : null;
    return n && n > 0 ? n : null;
  }

  /**
   * Find the matching vendor product or service from free text.
   * Returns { vendor, product, isService:false } or { vendor, service, isService:true } or null.
   */
  function findProductMatch(text) {
    const t = text.toLowerCase();
    for (const vendor of VENDOR_CATALOG) {
      if (vendor.products) {
        for (const product of vendor.products) {
          if (product.keywords.some(kw => t.includes(kw))) {
            return { vendor, product, isService: false };
          }
        }
      }
      if (vendor.services) {
        for (const svc of vendor.services) {
          if (svc.keywords.some(kw => t.includes(kw))) {
            return { vendor, service: svc, isService: true };
          }
        }
      }
    }
    return null;
  }

  /**
   * Build a marketplace pricing or info reply.
   * Handles: food product unit pricing, salon/restaurant service pricing,
   * category listings by region.
   * Returns a formatted string or null (fall-through to Claude/fallback).
   */
  function buildMarketplaceReply(text) {
    const t     = text.toLowerCase();
    const qty   = extractQuantity(text);
    const match = findProductMatch(text);

    // ── Buyer instruction queries (cook/reheat/store/allergen) ────────────
    if (match && !match.isService) {
      const { vendor, product } = match;

      if (/fry|chiên|cook|nấu|prepare|chế biến|how.*make|làm.*thế nào|bao lâu|how long|minute|phút/i.test(t)
          && product.preparationInstructions) {
        return [
          `🍳 **Cách Chế Biến** — ${product.name}`,
          '',
          product.preparationInstructions,
          product.servingNotes ? `\n🍽️ ${product.servingNotes}` : '',
          '',
          `📞 ${vendor.contact}: ${vendor.phone}`,
        ].filter(Boolean).join('\n');
      }

      if (/reheat|hâm|warm.*up|heat.*up|microwave|air.?fryer|oven|lò nướng/i.test(t)
          && product.reheatingInstructions) {
        return [
          `♨️ **Hâm Nóng** — ${product.name}`,
          '',
          product.reheatingInstructions,
        ].filter(Boolean).join('\n');
      }

      if (/stor|bảo quản|tủ lạnh|fridge|freeze|đông lạnh|refrigerat|how long.*keep|bao lâu.*giữ/i.test(t)
          && product.storageInstructions) {
        return [
          `🧊 **Bảo Quản** — ${product.name}`,
          '',
          product.storageInstructions,
        ].filter(Boolean).join('\n');
      }

      if (/allergen|thành phần|ingredient|gluten|pork|thịt heo|nấm|peanut|đậu phộng|mushroom/i.test(t)
          && product.allergenNotes) {
        return [
          `⚠️ **Thành Phần** — ${product.name}`,
          '',
          product.allergenNotes,
        ].filter(Boolean).join('\n');
      }

      if (/serv|ăn cùng|dùng với|sauce|nước chấm|tương/i.test(t)
          && product.servingNotes) {
        return [
          `🍽️ **Phục Vụ** — ${product.name}`,
          '',
          product.servingNotes,
        ].filter(Boolean).join('\n');
      }
    }

    // ── Food vendor with unit pricing (e.g. Emily's egg rolls) ────────────
    if (match && !match.isService) {
      const { vendor, product } = match;
      const q     = qty || product.minOrder;
      const total = (q * product.pricePerUnit).toFixed(2);

      if (q < product.minOrder) {
        return [
          `${product.name} — ${vendor.name}`,
          '',
          `Số lượng tối thiểu: **${product.minOrder} ${product.unit}** ($${(product.minOrder * product.pricePerUnit).toFixed(2)}).`,
          `Bạn yêu cầu ${q} — cần đặt thêm ${product.minOrder - q} ${product.unit}.`,
          product.variants ? `Tùy chọn: ${product.variants}` : '',
          '',
          product.orderNote,
        ].filter(Boolean).join('\n');
      }

      const overCapNote = product.maxPerDay && q > product.maxPerDay
        ? `\n⚠️ Sản lượng tối đa ${product.maxPerDay}/ngày — đơn lớn cần đặt trước nhiều ngày.`
        : '';

      return [
        `${product.name} — ${vendor.name}`,
        '',
        `💰 ${q} ${product.unit} = **$${total}**`,
        `   ($${product.pricePerUnit}/${product.unitEn} · tối thiểu ${product.minOrder} ${product.unit})`,
        product.variants ? `   Tùy chọn: ${product.variants}` : '',
        overCapNote,
        '',
        product.orderNote,
      ].filter(Boolean).join('\n');
    }

    // ── Salon / restaurant service pricing ────────────────────────────────
    if (match && match.isService) {
      const { vendor, service } = match;
      const priceStr = service.priceMin != null ? `từ $${service.priceMin}` : 'Liên hệ';
      return [
        `${service.name} — ${vendor.name}`,
        '',
        `💰 ${priceStr} (giá cuối tùy mức độ)`,
        `📍 ${vendor.region} · ${vendor.city}`,
        vendor.hours ? `🕐 ${vendor.hours}` : '',
        '',
        vendor.bookingNote,
      ].filter(Boolean).join('\n');
    }

    // ── Category listing by region ─────────────────────────────────────────
    const regionId   = window.DLCRegion ? DLCRegion.current.id : 'oc';
    const regionName = regionId === 'bayarea' ? 'Bay Area' : 'Orange County';
    let category = null;
    if (/nail|làm móng|tiệm nail/i.test(t))                         category = 'nails';
    else if (/hair|tóc|tiệm tóc|salon tóc/i.test(t))               category = 'hair';
    else if (/food|nhà hàng|ăn|catering|thức ăn|đặt ăn/i.test(t)) category = 'food';

    if (category) {
      const all      = VENDOR_CATALOG.filter(v => v.category === category);
      const hits     = all.filter(v => v.region === regionName);
      const display  = hits.length > 0 ? hits : all;
      const catLabel = category === 'nails' ? 'nail' : category === 'hair' ? 'tóc' : 'ăn uống';
      const lines    = display.map(v => {
        const items = (v.services || []).slice(0, 3)
          .map(s => `${s.name}${s.priceMin != null ? ' $' + s.priceMin + '+' : ''}`).join(' · ');
        const pLine = (v.products || []).map(p =>
          `${p.name} $${p.pricePerUnit}/${p.unitEn} (min ${p.minOrder})`).join(' · ');
        return `📍 **${v.name}** (${v.city})\n   ${items || pLine}\n   ${v.contact}: ${v.phone}`;
      });
      return [`Dịch vụ ${catLabel} tại ${regionName}:`, '', ...lines].join('\n');
    }

    // ── Emily specifically ─────────────────────────────────────────────────
    if (/emily|nhà bếp/i.test(t)) {
      const emily = VENDOR_CATALOG.find(v => v.id === 'nha-bep-cua-emily');
      if (emily) {
        const p = emily.products[0];
        return [
          `${emily.name} — ${emily.city}, Bay Area`,
          '',
          `🥟 ${p.name}: $${p.pricePerUnit}/${p.unitEn} · tối thiểu ${p.minOrder} ${p.unit} ($${(p.minOrder * p.pricePerUnit).toFixed(2)})`,
          `   Tùy chọn: ${p.variants}`,
          `   Sản lượng tối đa: ${p.maxPerDay}/ngày`,
          '',
          p.orderNote,
        ].join('\n');
      }
    }

    return null; // No marketplace match — fall through
  }

  /**
   * Look up marketplace orders (vendor sub-collections) by customer phone.
   * Queries all known vendors in parallel so it's fast.
   */
  async function lookupVendorOrder(text) {
    if (typeof firebase === 'undefined' || !firebase.firestore) return null;
    const phone = extractPhone(text);
    if (!phone) return null;
    const db      = firebase.firestore();
    const queries = VENDOR_CATALOG.map(v =>
      db.collection('vendors').doc(v.id).collection('bookings')
        .where('customerPhone', '==', phone)
        .orderBy('createdAt', 'desc').limit(2).get()
        .then(snap => snap.docs.map(d => ({ vendorName: v.name, ...d.data() })))
        .catch(() => [])
    );
    const results = (await Promise.all(queries)).flat();
    if (!results.length) return null;
    const stLbl = {
      pending:   '⏳ Chờ xác nhận',
      confirmed: '✅ Đã xác nhận',
      completed: '✔️ Hoàn thành',
      cancelled: '❌ Đã hủy',
    };
    const cards = results.map(o => [
      `📋 **${o.vendorName}**`,
      `   ${o.itemName || o.category || ''} × ${o.quantity || ''}`,
      `   ${stLbl[o.status] || o.status || '⏳ Chờ'}`,
      o.requestedDate ? `   Ngày: ${o.requestedDate}` : '',
    ].filter(Boolean).join('\n'));
    const fmt = phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    return [`Đơn marketplace cho ${fmt}:`, '', ...cards].join('\n');
  }

  /**
   * Create a buyer-question notification in the vendor's Firestore sub-collection.
   * The vendor-admin onSnapshot listener picks this up in real-time and shows a popup.
   * Silent fail — notification creation is best-effort.
   */
  async function createBuyerQuestion(vendorId, question, customerPhone) {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    try {
      const user = firebase.auth ? firebase.auth().currentUser : null;
      if (!user) return; // Requires Firebase auth (anonymous is fine)
      await firebase.firestore()
        .collection('vendors').doc(vendorId)
        .collection('notifications').add({
          type:          'buyer_question',
          title:         'Câu Hỏi Từ Khách Hàng',
          message:       question,
          customerPhone: customerPhone || null,
          read:          false,
          createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (_) {}
  }

  /** Compact vendor + product summary injected into the Claude system prompt. */
  function buildVendorContextForAI() {
    return `
MARKETPLACE VENDORS (use exact prices — do NOT guess):

FOOD:
• Nhà Bếp Của Emily [Bay Area/San Jose]
  - Chả Giò (Eggroll): $0.75/piece. Min order: 30 pieces = $22.50. Max 300/day.
  - Options: Raw (Sống) or Cooked (Tươi). 24h advance order. Contact: Loan 408-931-2438.
• Phở Bắc Bay Area [Bay Area/San Jose] — Phở $15 · Bún Bò $14 · Cơm Tấm $16. Catering. John 408-439-7522.
• Cơm Tấm Dì Tám [OC/Westminster] — Cơm Tấm $14 · Hủ Tiếu $14 · Bánh Mì $8. Catering. Duy Hoa 714-227-6007.

NAIL SALONS:
• Dung Nails & Spa [Bay Area/San Jose] — Manicure $20+ · Pedicure $30+ · Gel $35+ · Acrylic $45+ · Spa $65+. Dung Pham 408-859-6718.
• Beauty Nails OC [OC/Westminster] — Manicure $18+ · Pedicure $28+ · Gel $30+ · Acrylic $40+ · Ombre $55+. Duy Hoa 714-227-6007.

HAIR SALONS:
• Việt Hair Studio [Bay Area/San Jose] — Cut $20-30+ · Perm $80+ · Straighten $100+ · Color $60+ · Highlight $80+. John 408-439-7522.
• Cali Hair & Beauty [OC/Garden Grove] — Cut $18-28+ · Korean Perm $120+ · Keratin $150+ · Balayage $100+. Duy Hoa 714-227-6007.

MARKETPLACE PRICING RULES:
- When quantity given, compute exact total: qty × unit_price (30 egg rolls = 30 × $0.75 = $22.50)
- Always enforce minimum orders. Emily min 30 = $22.50.
- Services quoted "from $X" — final price depends on hair length / nail condition
- For ordering food: give contact + remind them to order 24h ahead
- For appointments: give contact + hours`;
  }

  // ══════════════════════════════════════════════════════════════
  //  CLAUDE API INTEGRATION
  //  Enriched system prompt with current estimates + form state
  // ══════════════════════════════════════════════════════════════

  function buildSystemPrompt() {
    const staticCtx  = typeof buildAIContext === 'function' ? buildAIContext() : '';
    const regionCtx  = window.DLCRegion ? DLCRegion.buildAIRegionContext() : '';
    const vendorCtx  = buildVendorContextForAI();

    // Build live pricing snapshot for Claude
    let pricingSnapshot = '';
    if (typeof DLCPricing !== 'undefined') {
      const form   = DLCPricing.getCurrentFormState();
      const gas    = DLCPricing.getFuelPrice();
      const pax    = form.passengers || 2;
      const days   = form.days || 2;
      const sorted = DLCPricing.compareTours({ passengers: pax, days });
      const compLines = sorted.map(({ id, est }) => {
        const dest = typeof DESTINATIONS !== 'undefined'
          ? DESTINATIONS.find(d => d.id === id) : null;
        return `  ${dest ? dest.name.en : id}: ~$${est.total} (${est.miles}mi · ${est.vehicle})`;
      }).join('\n');

      const formLine = form.serviceType
        ? `Currently selected: ${form.serviceType} · ${form.passengers} pax · ${form.days} days${form.lodging ? ' · ' + form.lodging : ''}${form.hasAddress ? ' · address entered' : ''}`
        : 'No service selected yet in the form.';

      pricingSnapshot = `
LIVE ESTIMATE SNAPSHOT (as of this session):
Current CA fuel price: ~$${gas.toFixed(2)}/gal
Comparison estimates for ${pax} pax × ${days} days from Orange County:
${compLines}

BOOKING FORM STATE:
${formLine}

ESTIMATE CONFIDENCE LEVELS:
- "rough estimate" / "ước tính sơ bộ": based on approx OC distance, no exact address
- "better estimate" / "ước tính tốt hơn": exact pickup address known via form
- "confirmed quote" / "báo giá xác nhận": after manual review by our team

PRICING LOGIC SUMMARY:
- Transfer (pickup/dropoff): Uber market rate minus 20% discount
- Tour: driver rate + fuel + service + optional lodging — van pricing is higher than sedan
- Vehicle: Tesla Model Y (1–3 pax), Mercedes Van (4–12 pax), Toyota Sienna (Bay Area)
- Always label estimates; recommend calling ${regionPhone()} for exact quotes

ORDER TRACKING:
- Customers can check order status by providing their phone number or booking ID (e.g. DLC-ABC123)
- The system automatically queries Firestore and returns booking status
- If a customer asks about their order, ask for their phone number or booking ID
- Statuses: pending (chờ xác nhận), confirmed (đã xác nhận), enroute (đang trên đường), completed (hoàn thành), cancelled (đã hủy)`;
    }

    return `You are a smart, bilingual AI receptionist for Du Lịch Cali — a Vietnamese-American travel, transportation, and marketplace service in California. You handle travel bookings AND marketplace vendor questions (food, nails, hair).

${staticCtx}
${regionCtx}
${vendorCtx}
${pricingSnapshot}

BEHAVIOR GUIDELINES:
- Respond in the SAME LANGUAGE the user writes in (Vietnamese ↔ English)
- For pricing questions: use the estimate data above, never invent numbers outside that range
- Always distinguish between rough estimate (sơ bộ), better estimate (tốt hơn), and confirmed quote
- Explicitly state estimates may change based on exact pickup/dropoff addresses
- Ask for missing info (pax count, city, days) only when needed — don't overwhelm
- Compare options when helpful ("San Francisco may be cheaper than Yosemite for X people")
- Explain pricing logic clearly when asked (fuel, distance, vehicle size)
- For exact quotes, recommend calling ${regionPhone()} or using the Đặt chỗ tab
- Keep responses concise — 3–6 lines for estimates, slightly more for complex questions
- Be warm, helpful, and professional — like a knowledgeable travel friend`;
  }

  async function callClaude(history) {
    if (!CLAUDE_KEY) throw new Error('no-key');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system:     buildSystemPrompt(),
        messages:   history.slice(-20),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.content[0].text;
  }

  // ══════════════════════════════════════════════════════════════
  //  WORKFLOW ENGINE INTEGRATION  (see workflowEngine.js)
  // ══════════════════════════════════════════════════════════════


  // ══════════════════════════════════════════════════════════════
  //  MAIN SEND HANDLER
  //  Priority: 0) DLCWorkflow  1) tracking  2) marketplace  3) pricing  4) static  5) Claude  6) fallback
  // ══════════════════════════════════════════════════════════════

  async function getReply(text, history) {
    const WF = window.DLCWorkflow;

    // ── 0. Active workflow takes absolute priority ────────────────
    if (WF && WF.isActive()) {
      const result = WF.process(text);
      if (result && typeof result === 'object' && result.type === 'finalize') {
        try {
          const orderId = await WF.finalize();
          return {
            type: 'message',
            text: [
              '✅ Đặt chỗ thành công!',
              `Mã đơn: ${orderId}`,
              '',
              'Chúng tôi sẽ liên hệ xác nhận trong vòng 2 tiếng.',
              `Cần hỗ trợ ngay: gọi ${regionPhone()}.`,
            ].join('\n'),
            chips: null,
            hotels: null,
          };
        } catch (e) {
          console.error('finalize error', e);
          return `Xin lỗi, có lỗi khi lưu đơn. Vui lòng thử lại hoặc gọi ${regionPhone()}.`;
        }
      }
      if (result && typeof result === 'object' && result.type === 'message') return result;
      if (typeof result === 'string') return result;
      // result === null → fall through to general handlers
    }

    const intent = parseIntent(text);

    // ── 0a. Detect new workflow intent (before marketplace/pricing) ─
    if (WF && !intent.isPricing) {
      const wfIntent = WF.detectIntent(text);
      if (wfIntent) {
        WF.startWorkflow(wfIntent, text);
        const result = WF.process(text);
        if (result && typeof result === 'object' && result.type === 'message') return result;
        if (typeof result === 'string') return result;
      }
    }

    // ── 1. Order tracking ─────────────────────────────────────────
    if (intent.isTracking) {
      const trackingResult = await lookupBooking(text);
      if (trackingResult) return trackingResult;
      const vendorResult = await lookupVendorOrder(text);
      if (vendorResult) return vendorResult;
    }

    // ── 2. Marketplace pricing engine ────────────────────────────
    if (intent.isMarketplace || intent.isQuantityQuery) {
      const mktReply = buildMarketplaceReply(text);
      if (mktReply) return mktReply;
    }

    // ── 3. Travel pricing engine ──────────────────────────────────
    if (intent.isRoute || intent.isPricing || intent.isComparison || intent.isExplain ||
        intent.isInfoNeeded || (intent.isTour && intent.destId) ||
        (intent.isTransfer && (intent.city || intent.airport)) ||
        (intent.destId && intent.city)) {
      const pricingReply = buildPricingReply(intent, text);
      if (pricingReply) return pricingReply;
    }

    // ── 4. Static rules ───────────────────────────────────────────
    const staticR = staticReply(text);
    if (staticR && !CLAUDE_KEY) return staticR;
    if (staticR && !intent.isPricing) return staticR;

    // ── 5. Claude AI ──────────────────────────────────────────────
    if (CLAUDE_KEY) {
      return await callClaude(history);
    }

    // ── 5b. Marketplace fallback ──────────────────────────────────
    if (!CLAUDE_KEY) {
      const mktFallback = buildMarketplaceReply(text);
      if (mktFallback) return mktFallback;
    }

    // ── 6. Fallback ───────────────────────────────────────────────
    const fallbackVendor = findProductMatch(text);
    if (fallbackVendor) {
      createBuyerQuestion(fallbackVendor.vendor.id, text, null);
    }
    return `Cảm ơn bạn đã liên hệ Du Lịch Cali! Để được hỗ trợ nhanh nhất, gọi ${regionHostName()}: ${regionPhone()} hoặc dùng tab "Đặt chỗ" để đặt dịch vụ và xem ước tính ngay.`;
  }

  // ══════════════════════════════════════════════════════════════
  //  CHAT UI STATE
  // ══════════════════════════════════════════════════════════════

  const state = {
    history: [],
    loading: false,
    msgsEl:  null,
    inputEl: null,
  };

  function pushMsg(role, content, extras) {
    const msg = { role, content: String(content || '') };
    if (extras) Object.assign(msg, extras);
    state.history.push(msg);
    renderAll();
  }

  function renderHotelCard(h) {
    const stars = '★'.repeat(h.stars || 0);
    const tierLabel = { budget:'Tiết kiệm', midrange:'Tầm trung', premium:'Cao cấp' }[h.budgetTier] || '';
    const chooseVal = `Tôi muốn ở ${h.name} - nhờ Du Lịch Cali đặt giúp`;
    return `<div class="hotel-card">` +
      `<div class="hotel-card__header">` +
        `<span class="hotel-card__name">${escapeHtml(h.name)}</span>` +
        `<span class="hotel-card__stars">${escapeHtml(stars)}</span>` +
      `</div>` +
      `<div class="hotel-card__meta">` +
        `<span class="hotel-card__area">${escapeHtml(h.area || '')}</span>` +
        `<span class="hotel-card__price">~$${h.priceFrom}–$${h.priceTo}/đêm</span>` +
      `</div>` +
      `<div class="hotel-card__highlight">${escapeHtml(h.highlight || '')}</div>` +
      `<div class="hotel-card__footer">` +
        `<span class="hotel-card__tier">${escapeHtml(tierLabel)}</span>` +
        `<button class="hotel-card__btn" data-value="${escapeHtml(chooseVal)}">Chọn</button>` +
      `</div>` +
    `</div>`;
  }

  function renderAll() {
    if (!state.msgsEl) return;
    const lastIdx = state.history.length - 1;
    state.msgsEl.innerHTML = state.history.map((m, idx) => {
      const isLast = idx === lastIdx;
      let html = `<div class="cmsg cmsg--${m.role}">` +
        (m.role === 'assistant' ? '<div class="cmsg__avatar">✦</div>' : '') +
        `<div class="cmsg__bubble">${escapeHtml(m.content || '').replace(/\n/g, '<br>')}</div>` +
        `</div>`;

      // Hotel cards — only on last assistant message
      if (m.role === 'assistant' && m.hotels && m.hotels.length && isLast) {
        html += `<div class="cmsg-hotels">${m.hotels.map(renderHotelCard).join('')}</div>`;
      }

      // Choice chips — only on last assistant message
      if (m.role === 'assistant' && m.chips && m.chips.length && isLast) {
        html += `<div class="cmsg-chips-row">${
          m.chips.map(c =>
            `<button class="cmsg-chip" data-value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`
          ).join('')
        }</div>`;
      }
      return html;
    }).join('');

    // Bind chip + hotel card button clicks
    state.msgsEl.querySelectorAll('.cmsg-chip, .hotel-card__btn').forEach(btn => {
      btn.addEventListener('click', () => send(btn.dataset.value));
    });

    if (state.loading) {
      const dots = document.createElement('div');
      dots.className = 'cmsg cmsg--assistant cmsg--typing';
      dots.innerHTML = '<div class="cmsg__avatar">✦</div><div class="cmsg__bubble"><span></span><span></span><span></span></div>';
      state.msgsEl.appendChild(dots);
    }
    state.msgsEl.scrollTop = state.msgsEl.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function send(text) {
    text = text.trim();
    if (!text || state.loading) return;

    pushMsg('user', text);
    state.loading = true;
    renderAll();

    let reply;
    try {
      // Pass history without the just-pushed user message (getReply handles it)
      reply = await getReply(text, state.history.slice(0, -1));
    } catch (err) {
      console.warn('Reply error, using fallback:', err.message);
      const intent = parseIntent(text);
      reply = buildPricingReply(intent, text)
           || staticReply(text)
           || `Xin lỗi, có lỗi xảy ra. Vui lòng gọi ${regionPhone()} để được hỗ trợ ngay.`;
    }

    state.loading = false;
    if (reply && typeof reply === 'object' && reply.type === 'message') {
      pushMsg('assistant', reply.text || '', { chips: reply.chips || null, hotels: reply.hotels || null });
    } else {
      pushMsg('assistant', reply || '');
    }
  }

  // ── Public init ──────────────────────────────────────────────
  function init(opts = {}) {
    state.msgsEl = document.getElementById(opts.messagesId || 'chatMessages');
    state.inputEl = document.getElementById(opts.inputId   || 'chatInput');

    const sendBtn = document.getElementById(opts.sendBtnId || 'chatSend');
    if (sendBtn) sendBtn.addEventListener('click', submitInput);

    if (state.inputEl) {
      state.inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitInput(); }
      });
    }

    document.querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        send(chip.dataset.q || chip.textContent);
        const chipWrap = document.getElementById('chatChips');
        if (chipWrap) chipWrap.style.display = 'none';
      });
    });

    // Welcome message
    const welcome = [
      'Xin chào! Tôi là trợ lý Du Lịch Cali.',
      '',
      'Tôi có thể giúp bạn đặt trực tiếp:',
      '• 🥟 Đặt món ăn (chả giò, chuối đậu nấu ốc...)',
      '• ✈️ Đặt dịch vụ đón/đưa sân bay (LAX, SFO, SJC...)',
      '• 💅 Đặt lịch nail (manicure, pedicure...)',
      '• 💇 Đặt lịch làm tóc (cắt, nhuộm...)',
      '• 🗺️ Đặt tour du lịch (Las Vegas, Yosemite, SF...)',
      '',
      'Hoặc hỏi giá, so sánh, kiểm tra đơn hàng.',
      '',
      'Ví dụ: "đặt 50 chả giò", "đón sân bay LAX ngày 20/4", "giá manicure San Jose?"',
    ].join('\n');
    pushMsg('assistant', welcome);
  }

  function submitInput() {
    if (!state.inputEl) return;
    const text = state.inputEl.value.trim();
    if (text) { send(text); state.inputEl.value = ''; }
  }

  window.DLChat = {
    init,
    send,
    /** Start a workflow and inject the first question into chat. */
    startFlow: function(type) {
      const WF = window.DLCWorkflow;
      if (!WF) return;
      const typeMap = {
        airport:         'airport_pickup',
        airport_pickup:  'airport_pickup',
        airport_dropoff: 'airport_dropoff',
        tour:            'tour_request',
        food:            'food_order',
        nail:            'nail_appointment',
        hair:            'hair_appointment',
      };
      const intent = typeMap[type] || type;
      if (!WF.WORKFLOWS[intent]) return;
      WF.startWorkflow(intent, '');
      const result = WF.process('');
      if (typeof result === 'string' && result) pushMsg('assistant', result);
    },
  };
})();
