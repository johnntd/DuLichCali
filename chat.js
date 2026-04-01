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
  const MAX_TOKENS   = 550;

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
    const codes = ['lax', 'sna', 'lgb', 'ont', 'bur', 'san', 'sfo', 'sjc', 'smf'];
    for (const code of codes) {
      if (new RegExp(`\\b${code}\\b`).test(t)) return code;
    }
    if (/john wayne/i.test(text))           return 'sna';
    if (/long beach.*airport/i.test(text))  return 'lgb';
    if (/burbank.*airport/i.test(text))     return 'bur';
    if (/san francisco.*airport/i.test(text)) return 'sfo';
    if (/san jose.*airport|mineta/i.test(text)) return 'sjc';
    if (/sacramento.*airport/i.test(text))  return 'smf';
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
      return `Tôi chưa có dữ liệu khoảng cách cho tuyến ${titleCase(from)} → ${titleCase(to)}.\n\nVui lòng nhập địa chỉ đầy đủ trong tab Đặt chỗ để tính giá chính xác, hoặc gọi 714-227-6007.`;
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
      'Nhập địa chỉ trong tab Đặt chỗ hoặc gọi 714-227-6007.',
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
    lines.push(``, `Đây là ước tính sơ bộ. Giá cuối phụ thuộc vào địa chỉ đón thực tế.`, `Gọi 714-227-6007 để nhận báo giá trọn gói.`);
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
      'Gọi 714-227-6007 để nhận báo giá trọn gói.',
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
      fromCity ? 'Giá là ước tính sơ bộ — gọi 714-227-6007 để nhận báo giá chính xác.' : 'Cho tôi biết thành phố đón để ước tính chính xác hơn.',
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
      'Bạn có thể dùng tab Đặt chỗ để nhập thông tin và nhận ước tính ngay, hoặc gọi 714-227-6007.',
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
      reply: () => 'Không có gì! Nếu cần ước tính chi tiết hơn, cứ hỏi tôi. Để đặt chỗ chính thức, gọi Duy Hoa: 714-227-6007 😊'
    },
    {
      match: [/điện thoại|số điện|phone|contact|liên hệ/i],
      reply: () => 'Liên hệ Du Lịch Cali:\n📞 Duy Hoa: 714-227-6007\n📞 Dinh: 562-331-3809\n📧 dulichcali21@gmail.com\n\nPhục vụ 7 ngày / tuần.'
    },
    {
      match: [/đặt|book|reserve/i],
      reply: () => 'Để đặt chỗ:\n• Bấm tab "Đặt chỗ" trong ứng dụng này — nhập thông tin và nhận ước tính tức thì\n• Hoặc gọi: Duy Hoa 714-227-6007\n\nSau khi gửi form, chúng tôi xác nhận trong 2 tiếng.'
    },
    {
      match: [/giờ|mấy giờ|open|hours|working/i],
      reply: () => 'Phục vụ 7 ngày/tuần. Gọi bất kỳ lúc nào:\n• Duy Hoa: 714-227-6007\n• Dinh: 562-331-3809\nThường phản hồi trong 1–2 tiếng.'
    },
    {
      match: [/xe|vehicle|car|tesla|van|mercedes/i],
      reply: () => 'Đội xe Du Lịch Cali:\n🚗 Tesla Model Y — 1–3 khách (điện, cao cấp, yên tĩnh)\n🚐 Mercedes-Benz Van — 4–12 khách (rộng rãi, thoải mái)\n\nXe sạch sẽ, mới, đầy đủ tiện nghi.'
    },
    {
      match: [/sân bay|airport/i],
      reply: () => 'Đưa đón 6 sân bay vùng Southern California:\n• LAX (Los Angeles) · SNA (John Wayne/OC)\n• LGB (Long Beach) · ONT (Ontario)\n• BUR (Burbank) · SAN (San Diego)\n\nGiá từ $100. Cho tôi biết thành phố đón của bạn để ước tính cụ thể hơn!'
    },
  ];

  function staticReply(text) {
    for (const rule of STATIC_RULES) {
      if (rule.match.some(r => r.test(text))) return rule.reply(text);
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════
  //  CLAUDE API INTEGRATION
  //  Enriched system prompt with current estimates + form state
  // ══════════════════════════════════════════════════════════════

  function buildSystemPrompt() {
    const staticCtx = typeof buildAIContext === 'function' ? buildAIContext() : '';

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
- Transfer (pickup/dropoff): base $100 + $0.22/mile (Tesla ≤3 pax) or + surcharges (Van ≥4 pax)
- Tour: (180 + roundtrip_miles × fuel/VAN_MPG) × days + service $50/day + optional lodging
- Vehicle: Tesla Model Y (1–3 pax), Mercedes Van (4–12 pax)
- Always label estimates; recommend calling 714-227-6007 for exact quotes`;
    }

    return `You are a smart, trustworthy AI travel concierge for Du Lịch Cali, a professional Vietnamese transportation and tour service in Southern California. You speak both Vietnamese and English fluently.

${staticCtx}
${pricingSnapshot}

BEHAVIOR GUIDELINES:
- Respond in the SAME LANGUAGE the user writes in (Vietnamese ↔ English)
- For pricing questions: use the estimate data above, never invent numbers outside that range
- Always distinguish between rough estimate (sơ bộ), better estimate (tốt hơn), and confirmed quote
- Explicitly state estimates may change based on exact pickup/dropoff addresses
- Ask for missing info (pax count, city, days) only when needed — don't overwhelm
- Compare options when helpful ("San Francisco may be cheaper than Yosemite for X people")
- Explain pricing logic clearly when asked (fuel, distance, vehicle size)
- For exact quotes, recommend calling 714-227-6007 or using the Đặt chỗ tab
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
        messages:   history.slice(-14),
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
  //  MAIN SEND HANDLER
  //  Priority: 1) pricing engine  2) static rules  3) Claude API  4) fallback
  // ══════════════════════════════════════════════════════════════

  async function getReply(text, history) {
    const intent = parseIntent(text);

    // 1. Pricing engine — always runs first for pricing/route questions
    if (intent.isRoute || intent.isPricing || intent.isComparison || intent.isExplain ||
        intent.isInfoNeeded || (intent.isTour && intent.destId) ||
        (intent.isTransfer && (intent.city || intent.airport)) ||
        (intent.destId && intent.city)) {
      const pricingReply = buildPricingReply(intent, text);
      if (pricingReply) return pricingReply;
    }

    // 2. Static rules — greetings, contacts, vehicles
    const staticR = staticReply(text);
    if (staticR && !CLAUDE_KEY) return staticR;
    if (staticR && !intent.isPricing) return staticR;

    // 3. Claude AI (if key configured)
    if (CLAUDE_KEY) {
      return await callClaude(history);
    }

    // 4. Fallback
    return 'Cảm ơn bạn đã liên hệ Du Lịch Cali! Để được hỗ trợ nhanh nhất, gọi Duy Hoa: 714-227-6007 hoặc dùng tab "Đặt chỗ" để đặt dịch vụ và xem ước tính ngay.';
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

  function pushMsg(role, content) {
    state.history.push({ role, content });
    renderAll();
  }

  function renderAll() {
    if (!state.msgsEl) return;
    state.msgsEl.innerHTML = state.history.map(m => `
      <div class="cmsg cmsg--${m.role}">
        ${m.role === 'assistant' ? '<div class="cmsg__avatar">✦</div>' : ''}
        <div class="cmsg__bubble">${escapeHtml(m.content).replace(/\n/g, '<br>')}</div>
      </div>`).join('');

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
           || 'Xin lỗi, có lỗi xảy ra. Vui lòng gọi 714-227-6007 để được hỗ trợ ngay.';
    }

    state.loading = false;
    pushMsg('assistant', reply);
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

    // Welcome message — show live estimates if DLCPricing is ready
    let welcome = 'Xin chào! Tôi là trợ lý du lịch của Du Lịch Cali.\n\nTôi có thể:\n• Ước tính chi phí tour (Las Vegas, Yosemite, San Francisco)\n• Ước tính đưa đón sân bay theo địa chỉ của bạn\n• Giải thích cách tính giá\n• So sánh các lựa chọn\n\nBạn muốn đi đâu? Cho tôi biết số người đi để tôi ước tính ngay!';
    pushMsg('assistant', welcome);
  }

  function submitInput() {
    if (!state.inputEl) return;
    const text = state.inputEl.value.trim();
    if (text) { send(text); state.inputEl.value = ''; }
  }

  window.DLChat = { init, send };
})();
