/**
 * Du Lịch Cali — Marketing Engine  v1.0
 *
 * Domain-expert marketing layer on top of aiOrchestrator.js.
 * Knows HOW to write Vietnamese-American marketing copy for food, travel,
 * and services — delegates AI calls to DLCOrchestrator.run().
 *
 * Architecture:
 *   vendor-admin.html
 *       ↓ calls
 *   DLCMarketing.enhance(item, vendor, options)
 *       ↓ routes to
 *   domain-specific builder (food / travel / service)
 *       ↓ builds rich prompts + calls
 *   DLCOrchestrator.run(taskType, payload)
 *       ↓ routes to
 *   Claude / OpenAI / Gemini
 *
 * Output shape (EnhancementResult):
 * {
 *   category:    'food' | 'travel' | 'service',
 *   region:      'oc' | 'bayarea',
 *   provider:    string,
 *   latency_ms:  number,
 *   versionId:   string,        // 'v{timestamp}' for A/B tracking
 *
 *   fields: {
 *     title:           { vi, en, ab: [{id:'A',value},{id:'B',value}] },
 *     description:     { vi, en },
 *     adCopy:          { vi, en },
 *     promoText:       { vi },   // urgency line
 *     tags:            { values: [] },
 *     shortDescription:{ vi },   // thumbnail one-liner
 *     voiceoverScript: { vi, en },
 *     videoScript:     { remotionProps },
 *   },
 *
 *   renderJobId:  string | null,
 *   errors:       [],
 * }
 */

(function () {
  'use strict';

  // ── Region messaging profiles ────────────────────────────────────────────
  const REGION_PROFILES = {
    bayarea: {
      audience: 'Cộng đồng người Việt vùng Bay Area (San Jose, Santa Clara, Fremont)',
      tone:     'Nhấn mạnh tính xác thực, gia truyền, Việt Nam chính gốc — cộng đồng trân trọng hương vị quê hương',
      urgencyHint: 'Số lượng có hạn mỗi ngày — đặt sớm để không bỏ lỡ',
      convenienceHint: 'Đặt trước, giao tận nơi hoặc tự lấy tại San Jose',
      en: {
        audience: 'Vietnamese Bay Area community (San Jose, Fremont, Santa Clara)',
        tone: 'Emphasize authentic homemade quality — this community values traditional flavors',
      }
    },
    oc: {
      audience: 'Cộng đồng người Việt Nam California (Westminster, Garden Grove, Anaheim)',
      tone:     'Nhấn mạnh sự tiện lợi, đa dạng, và giá trị — khách hàng bận rộn muốn nhanh gọn và đáng tiền',
      urgencyHint: 'Ưu đãi tuần này — đặt ngay hôm nay',
      convenienceHint: 'Giao hàng nhanh · Lấy tại cửa hàng · Tiện lợi 7 ngày',
      en: {
        audience: 'Vietnamese-American community in Orange County (Westminster, Garden Grove)',
        tone: 'Emphasize convenience, variety, and value — busy families want quick and affordable',
      }
    },
  };

  // ── Category detection ───────────────────────────────────────────────────
  function detectCategory(item, vendor) {
    const cat = (vendor && vendor.category) || (item && item.category) || '';
    if (/food|nha.?bep|pho|com|restaurant|bun|banh/i.test(cat + ' ' + (item && item.name || ''))) return 'food';
    if (/nail|spa|manicure|pedicure|beauty|nails/i.test(cat + ' ' + (item && item.name || '')))    return 'service_nails';
    if (/hair|toc|salon|keratin|perm|balayage/i.test(cat + ' ' + (item && item.name || '')))       return 'service_hair';
    if (/tour|travel|airport|sân bay|đưa đón|transfer/i.test(cat + ' ' + (item && item.name || ''))) return 'travel';
    if (cat === 'nails')  return 'service_nails';
    if (cat === 'hair')   return 'service_hair';
    if (cat === 'food')   return 'food';
    return 'food'; // default
  }

  // ── Version ID (for A/B tracking) ───────────────────────────────────────
  function makeVersionId() {
    return 'v' + Date.now().toString(36).toUpperCase();
  }

  // ══════════════════════════════════════════════════════════════
  //  FOOD MARKETING
  // ══════════════════════════════════════════════════════════════

  function buildFoodPrompt(item, vendor, opts) {
    const rp  = REGION_PROFILES[opts.region] || REGION_PROFILES.oc;
    const hasNorth   = /miền bắc|bắc|northern|hanoi|hà nội/i.test([item.name,item.description,item.tags].join(' '));
    const hasSouth   = /miền nam|saigon|sài gòn|southern/i.test([item.name,item.description,item.tags].join(' '));
    const hasHomemade = /homemade|nhà làm|tự làm|handmade|gia truyền/i.test([item.name,item.description].join(' '));
    const hasSeafood = /ốc|seafood|shellfish|tôm|cua|crab|shrimp/i.test([item.name,item.description].join(' '));

    const culturalContext = [
      hasNorth    ? 'Đây là món ăn miền Bắc chính gốc — nhấn mạnh di sản ẩm thực Hà Nội/Bắc.' : '',
      hasSouth    ? 'Đây là món ăn Nam Bộ — nhấn mạnh sự phong phú và hương vị đặc trưng.' : '',
      hasHomemade ? 'Nhấn mạnh tính thủ công, không dây chuyền sản xuất — đây là lợi thế lớn.' : '',
      hasSeafood  ? 'Nhấn mạnh sự tươi sống và hương vị biển cả.' : '',
    ].filter(Boolean).join('\n');

    const urgencyLine = opts.urgency
      ? `\nTHÊM DÒNG URGENCY: "${rp.urgencyHint}" (tạo cảm giác khan hiếm nhẹ, không quá áp lực)`
      : '';

    return {
      systemVi: `Bạn là chuyên gia marketing ẩm thực Việt Nam, chuyên viết nội dung bán hàng cho thị trường Việt kiều Mỹ.

TARGET AUDIENCE: ${rp.audience}
TONE: ${rp.tone}
${culturalContext}
${urgencyLine}

NHIỆM VỤ: Tạo nội dung marketing cho sản phẩm thực phẩm này. Tập trung vào:
- Cảm quan: mùi vị, kết cấu, màu sắc khi nhìn/ngửi/ăn
- Cảm xúc: ký ức tuổi thơ, hương vị quê hương, bữa cơm gia đình
- Niềm tin: gia truyền, không hóa chất, làm từ nguyên liệu tươi
- Hành động: giá rõ ràng, cách đặt hàng dễ

TRẢ VỀ JSON:
{
  "title": "Tên sản phẩm hấp dẫn tiếng Việt (≤8 từ, gợi cảm giác thèm ăn)",
  "titleEn": "English product title (≤8 words, appetizing)",
  "titleVariantB": "Phiên bản thứ hai — khác hướng tiếp cận với title chính",
  "titleVariantBEn": "Second English variant",
  "description": "Mô tả 2-3 câu tiếng Việt — ngôn ngữ cảm quan, ký ức, và lý do mua ngay",
  "descriptionEn": "2-3 sentence English description — sensory, emotional, compelling",
  "adCopy": "Dòng quảng cáo ngắn tiếng Việt (1 câu, gồm giá + lý do hành động)",
  "adCopyEn": "Short English ad copy (1 sentence, price + action reason)",
  "promoText": "Dòng khuyến mãi/urgency tiếng Việt (nếu phù hợp, nếu không để chuỗi rỗng)",
  "shortDescription": "Một câu duy nhất cho thumbnail — không quá 12 từ tiếng Việt",
  "tags": ["tag_vi_1","tag_vi_2","tag_en_1","tag_en_2","tag_en_3","location_tag"],
  "voiceoverVi": "Script voiceover tiếng Việt 15-20 giây — đọc tự nhiên, ấm áp, thuyết phục",
  "voiceoverEn": "English voiceover script 15-20 seconds — warm, natural, mouth-watering",
  "confidence": 0.93
}`,

      systemEn: `You are a Vietnamese-American food marketing expert writing for immigrant communities.

TARGET AUDIENCE: ${rp.en.audience}
TONE: ${rp.en.tone}

Emphasize: authenticity, freshness, no preservatives, family recipes, cultural heritage.
Make it mouth-watering with sensory language. Include a clear price anchor and call to action.

Return the same JSON structure as described.`,
    };
  }

  function buildFoodUserMessage(item, vendor) {
    return [
      `PRODUCT: ${item.name || ''} / ${item.nameEn || ''}`,
      `VENDOR: ${(vendor && vendor.name) || ''}, ${(vendor && vendor.city) || ''}, ${(vendor && vendor.region) || ''}`,
      `PRICE: $${item.pricePerUnit || item.price || '?'}/${item.unit || 'unit'}  |  Min order: ${item.minOrder || item.minimumOrderQty || 1}`,
      `CURRENT DESCRIPTION: ${item.description || 'none'}`,
      `INGREDIENTS/NOTES: ${item.allergenNotes || item.servingNotes || 'not provided'}`,
      `PREPARATION: ${item.preparationInstructions ? item.preparationInstructions.slice(0, 100) + '...' : 'not specified'}`,
      `EXISTING TAGS: ${Array.isArray(item.tags) ? item.tags.join(', ') : ''}`,
      `VARIANTS: ${Array.isArray(item.variants) ? item.variants.map(v => typeof v === 'object' ? v.label : v).join(', ') : ''}`,
    ].filter(l => !l.endsWith(': ')).join('\n');
  }

  // ══════════════════════════════════════════════════════════════
  //  TRAVEL MARKETING
  // ══════════════════════════════════════════════════════════════

  function buildTravelPrompt(item, vendor, opts) {
    const rp = REGION_PROFILES[opts.region] || REGION_PROFILES.oc;
    return {
      systemVi: `Bạn là chuyên gia marketing du lịch cho cộng đồng Việt kiều California.

TARGET AUDIENCE: ${rp.audience}
TONE: Tập trung vào giá trị, an toàn, tiện lợi nhóm gia đình — người Việt thường đi theo nhóm lớn.

CHIẾN LƯỢC:
- Nhấn mạnh trải nghiệm đáng nhớ (không chỉ vận chuyển)
- So sánh: thuê xe tự lái vs dịch vụ trọn gói
- Giá trị nhóm: chia sẻ chi phí → rẻ hơn tự đi
- An toàn: tài xế kinh nghiệm, xe mới, biết đường
- Tiện lợi: không lo đặt vé, không lo đỗ xe

TRẢ VỀ JSON:
{
  "title": "Tên dịch vụ hấp dẫn (≤8 từ, gợi trải nghiệm)",
  "titleEn": "English service title",
  "titleVariantB": "Phiên bản thứ hai — focus vào giá trị hoặc sự tiện lợi",
  "titleVariantBEn": "Second English variant",
  "description": "Mô tả 2-3 câu — nhấn mạnh trải nghiệm, tiện lợi, và giá trị",
  "descriptionEn": "2-3 sentence English description",
  "adCopy": "Dòng quảng cáo ngắn — giá khởi điểm + lý do chọn",
  "adCopyEn": "Short English ad copy",
  "promoText": "Khuyến mãi hoặc điểm nổi bật (1 câu)",
  "shortDescription": "Thumbnail one-liner ≤12 từ",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "voiceoverVi": "Script voiceover 15-20s tiếng Việt",
  "voiceoverEn": "English voiceover script 15-20 seconds",
  "confidence": 0.9
}`,
    };
  }

  function buildTravelUserMessage(item, vendor) {
    return [
      `SERVICE: ${item.name || item.destination || ''} / ${item.nameEn || ''}`,
      `TYPE: ${item.serviceType || item.category || 'travel'}`,
      `PRICE: Từ $${item.priceMin || item.price || '?'} / person or group`,
      `VEHICLE: ${item.vehicle || 'Toyota Sienna or Tesla Model Y'}`,
      `CURRENT DESCRIPTION: ${item.description || 'none'}`,
      `KEY FEATURES: ${item.features ? item.features.join(', ') : 'door-to-door, bilingual driver, new vehicle'}`,
      `ORIGIN REGION: ${item.region || 'Orange County / Bay Area'}`,
    ].filter(l => !l.endsWith(': ')).join('\n');
  }

  // ══════════════════════════════════════════════════════════════
  //  SERVICE MARKETING (NAILS & HAIR)
  // ══════════════════════════════════════════════════════════════

  function buildServicePrompt(item, vendor, opts, serviceType) {
    const rp      = REGION_PROFILES[opts.region] || REGION_PROFILES.oc;
    const isNails = serviceType === 'service_nails';
    const categoryContext = isNails
      ? `Đây là dịch vụ làm móng/spa. Nhấn mạnh: độ chính xác, vệ sinh an toàn, màu sắc đẹp, thư giãn, kỹ thuật cao.`
      : `Đây là dịch vụ làm tóc. Nhấn mạnh: tay nghề chuyên môn, kỹ thuật Hàn Quốc/Việt Nam, sản phẩm chất lượng cao, tư vấn phong cách.`;

    return {
      systemVi: `Bạn là chuyên gia marketing dịch vụ sắc đẹp Việt Nam tại California.

TARGET AUDIENCE: ${rp.audience}
TONE: ${rp.tone}
${categoryContext}

GIÁ TRỊ CỐT LÕI:
- Chất lượng + Giá hợp lý (không phải rẻ nhất — mà đáng tiền nhất)
- Thợ Việt, hiểu thị hiếu người Việt
- Tiện lịch đặt online/điện thoại
- Phục vụ thân thiện, bằng tiếng Việt lẫn tiếng Anh

TRẢ VỀ JSON:
{
  "title": "Tên dịch vụ hấp dẫn (≤8 từ)",
  "titleEn": "English service title",
  "titleVariantB": "Phiên bản thứ hai",
  "titleVariantBEn": "Second English variant",
  "description": "Mô tả 2-3 câu — nhấn mạnh kỹ năng + kết quả + cảm giác sau khi dùng",
  "descriptionEn": "2-3 sentence English description",
  "adCopy": "Dòng quảng cáo ngắn với giá khởi điểm",
  "adCopyEn": "Short English ad copy",
  "promoText": "Điểm khác biệt hoặc lời mời đặt lịch",
  "shortDescription": "Thumbnail one-liner ≤12 từ",
  "tags": ["service_tag","skill_tag","location_tag","Vietnamese","beauty"],
  "voiceoverVi": "Script voiceover 15-20s tiếng Việt",
  "voiceoverEn": "English voiceover 15-20 seconds",
  "confidence": 0.9
}`,
    };
  }

  function buildServiceUserMessage(item, vendor, serviceType) {
    const isNails = serviceType === 'service_nails';
    return [
      `SERVICE: ${item.name || item.keywords?.[0] || ''}`,
      `VENDOR: ${(vendor && vendor.name) || ''}, ${(vendor && vendor.city) || ''}`,
      `PRICE: Từ $${item.priceMin || item.price || '?'}`,
      `TYPE: ${isNails ? 'Nail/Spa service' : 'Hair salon service'}`,
      `HOURS: ${(vendor && vendor.hours) || 'not specified'}`,
      `CONTACT: ${(vendor && vendor.phone) || ''}`,
      `CURRENT DESCRIPTION: ${item.description || 'none'}`,
    ].filter(l => !l.endsWith(': ')).join('\n');
  }

  // ══════════════════════════════════════════════════════════════
  //  VIDEO SCRIPT BUILDER
  //  Generates Remotion FoodPromoSchema-compatible props
  // ══════════════════════════════════════════════════════════════

  function buildVideoScriptPrompt(item, vendor, contentData, opts) {
    const accentHint = detectAccentColor(item, vendor);
    return {
      system: `You are a short-form video director for Vietnamese-American brands.
Generate a Remotion FoodPromo video composition (15 sec, 3 slides, 450 frames @ 30fps, 1080×1920).

SLIDE STRUCTURE:
- Slide 1 (0-150f): Hero — big product name + vendor brand + ambient background
- Slide 2 (150-300f): Story — description, key features/variants
- Slide 3 (300-450f): CTA — price, minimum order, phone, urgency line

Return JSON matching FoodPromoSchema exactly:
{
  "vendorName": "string",
  "vendorTagline": "city + short tagline (≤6 words)",
  "itemName": "Vietnamese product name",
  "itemNameEn": "English name",
  "itemDescription": "1-2 sentence video description (punchy, visual)",
  "pricePerUnit": 0.00,
  "unit": "unit string",
  "minimumOrderQty": 0,
  "variants": [{"label":"Vi label","labelEn":"En label"}],
  "ctaText": "Vietnamese CTA (2-3 words)",
  "ctaSubtext": "English CTA subtitle",
  "phone": "phone number",
  "promoText": "short promo line for slide 3 bottom",
  "tags": ["tag1","tag2"],
  "shortDescription": "thumbnail line",
  "accentColor": "${accentHint}",
  "ui_response": "✅ Video script ready.",
  "confidence": 0.9
}`,
      userMessage: [
        `ITEM: ${item.name} / ${item.nameEn || ''}`,
        `VENDOR: ${(vendor && vendor.name) || ''}, ${(vendor && vendor.city) || ''}`,
        `PHONE: ${(vendor && vendor.phone) || ''}`,
        `PRICE: $${item.pricePerUnit || item.price || '?'}/${item.unit || 'unit'}`,
        `MIN ORDER: ${item.minOrder || item.minimumOrderQty || 1}`,
        `AI TITLE: ${(contentData && contentData.title) || item.name}`,
        `AI DESCRIPTION: ${(contentData && contentData.description) || ''}`,
        `AI PROMO: ${(contentData && contentData.promoText) || ''}`,
        `AI TAGS: ${(contentData && contentData.tags && contentData.tags.join(', ')) || ''}`,
        `VARIANTS: ${Array.isArray(item.variants) ? item.variants.map(v => typeof v === 'object' ? v.label : v).join(', ') : ''}`,
        '',
        `ACCENT COLOR SUGGESTION: ${accentHint}`,
        '(Choose the color that best fits the food personality.)',
      ].join('\n'),
    };
  }

  function detectAccentColor(item, vendor) {
    const text = [(item && item.name) || '', (item && item.description) || ''].join(' ').toLowerCase();
    if (/fried|chiên|giò|crispy|golden|vàng/i.test(text))   return '#f59e0b'; // warm gold
    if (/spicy|cay|hot|ớt|chili/i.test(text))               return '#ef4444'; // red
    if (/fresh|tươi|green|rau|salad|gỏi/i.test(text))        return '#10b981'; // green
    if (/premium|cao cấp|special|đặc biệt/i.test(text))     return '#a78bfa'; // purple
    if (/seafood|ốc|tôm|cua|biển/i.test(text))              return '#06b6d4'; // cyan
    if (/pork|thịt|bún|phở|comfort|ấm/i.test(text))         return '#f97316'; // orange
    return '#f59e0b'; // default gold
  }

  // ══════════════════════════════════════════════════════════════
  //  CORE ENHANCEMENT PIPELINE
  // ══════════════════════════════════════════════════════════════

  /**
   * Full enhancement pipeline. Auto-routes by category.
   *
   * @param {object} item    - The item/service object
   * @param {object} vendor  - Vendor metadata
   * @param {object} opts    - { region, urgency, lang, abVariants }
   * @returns {EnhancementResult}
   */
  async function enhance(item, vendor, opts) {
    if (!window.DLCOrchestrator) {
      return { errors: ['DLCOrchestrator not loaded. Add aiOrchestrator.js before marketingEngine.js.'] };
    }

    opts = Object.assign({
      region:    (window.DLCRegion && DLCRegion.current && DLCRegion.current.id) || 'oc',
      urgency:   false,
      lang:      'bilingual',
      abVariants: true,
    }, opts || {});

    const category  = detectCategory(item, vendor);
    const versionId = makeVersionId();
    const t0        = Date.now();
    const errors    = [];

    // ── 1. Build category-specific task def ───────────────────
    let taskDef;
    if (category === 'food') {
      const prompts = buildFoodPrompt(item, vendor, opts);
      taskDef = {
        taskType: 'content.generate',
        payload:  { item, vendor, _customSystem: prompts.systemVi, _userMessage: buildFoodUserMessage(item, vendor) },
        _system:  prompts.systemVi,
        _user:    buildFoodUserMessage(item, vendor),
      };
    } else if (category === 'travel') {
      const prompts = buildTravelPrompt(item, vendor, opts);
      taskDef = {
        taskType: 'content.generate',
        payload:  { item, vendor },
        _system:  prompts.systemVi,
        _user:    buildTravelUserMessage(item, vendor),
      };
    } else {
      const prompts = buildServicePrompt(item, vendor, opts, category);
      taskDef = {
        taskType: 'content.generate',
        payload:  { item, vendor },
        _system:  prompts.systemVi,
        _user:    buildServiceUserMessage(item, vendor, category),
      };
    }

    // ── 2. Call orchestrator with custom prompt injection ─────
    let contentData = null;
    try {
      const result = await runWithCustomPrompt(taskDef._system, taskDef._user, opts);
      if (result.error) errors.push('content: ' + result.error);
      else contentData = result.data || {};
    } catch (e) {
      errors.push('content: ' + e.message);
    }

    // ── 3. Generate video script ───────────────────────────────
    let videoData = null;
    if (contentData && !errors.length) {
      try {
        const vsPrompt = buildVideoScriptPrompt(item, vendor, contentData, opts);
        const vsResult = await runWithCustomPrompt(vsPrompt.system, vsPrompt.userMessage, opts);
        if (vsResult.error) errors.push('video: ' + vsResult.error);
        else videoData = vsResult.data;
      } catch (e) {
        errors.push('video: ' + e.message);
      }
    }

    // ── 4. Queue render job ────────────────────────────────────
    let renderJobId = null;
    if (videoData && typeof DLCOrchestrator.queueRenderJob === 'function') {
      renderJobId = await DLCOrchestrator.queueRenderJob({
        vendorId: (vendor && vendor.id) || '',
        itemId:   item.id || encodeURIComponent(item.name || 'item'),
        props:    videoData,
      });
    }

    // ── 5. Shape the result ────────────────────────────────────
    const cd = contentData || {};
    const enhancementResult = {
      category,
      region:    opts.region,
      provider:  (contentData && contentData._provider) || 'ai',
      latency_ms: Date.now() - t0,
      versionId,

      fields: {
        title: {
          vi: cd.title || '',
          en: cd.titleEn || '',
          ab: opts.abVariants ? [
            { id: 'A', vi: cd.title || '',         en: cd.titleEn || '' },
            { id: 'B', vi: cd.titleVariantB || cd.title || '', en: cd.titleVariantBEn || cd.titleEn || '' },
          ] : [],
        },
        description: {
          vi: cd.description || '',
          en: cd.descriptionEn || '',
        },
        adCopy: {
          vi: cd.adCopy || '',
          en: cd.adCopyEn || '',
        },
        promoText: {
          vi: cd.promoText || '',
        },
        shortDescription: {
          vi: cd.shortDescription || '',
        },
        tags: {
          values: cd.tags || [],
        },
        voiceoverScript: {
          vi: cd.voiceoverVi || '',
          en: cd.voiceoverEn || '',
        },
        videoScript: {
          remotionProps: videoData || null,
          renderCmd:     videoData && typeof DLCOrchestrator.buildRenderCommand === 'function'
            ? DLCOrchestrator.buildRenderCommand(videoData) : '',
        },
      },

      renderJobId,
      errors,
    };

    return enhancementResult;
  }

  // ── Custom-prompt runner (injects domain prompts into orchestrator call) ──
  async function runWithCustomPrompt(system, userMessage, opts) {
    // Directly call the AI provider that the orchestrator would pick for content.generate
    // We bypass the generic orchestrator task def to inject our expert prompts
    const route = window.DLCOrchestrator && DLCOrchestrator.ROUTES
      ? DLCOrchestrator.ROUTES['content.generate']
      : { primary: 'openai', fallback: 'claude' };

    const taskDef = {
      system,
      messages:   [{ role: 'user', content: userMessage }],
      schema:     true,
      maxTokens:  1000,
    };

    // Try primary provider
    for (const provider of [route.primary, route.fallback].filter(Boolean)) {
      try {
        let rawText;
        if (provider === 'openai')  rawText = await callProviderRaw('openai', taskDef);
        if (provider === 'claude')  rawText = await callProviderRaw('claude', taskDef);
        if (provider === 'gemini')  rawText = await callProviderRaw('gemini', taskDef);
        if (!rawText) continue;

        let data;
        try {
          const clean = rawText.replace(/^```(?:json)?\s*/m,'').replace(/\s*```\s*$/m,'').trim();
          data = JSON.parse(clean);
          data._provider = provider;
        } catch (_) {
          data = { raw: rawText, _provider: provider };
        }
        return { data, error: null };
      } catch (err) {
        console.warn(`[marketing] ${provider} failed:`, err.message);
      }
    }
    return { data: null, error: 'All providers failed' };
  }

  // ── Raw provider calls (mirrors adapters in orchestrator) ─────────────────
  async function callProviderRaw(provider, taskDef) {
    const keyMap = { claude: 'dlc_claude_key', openai: 'dlc_openai_key', gemini: 'dlc_gemini_key' };
    const key = localStorage.getItem(keyMap[provider]);
    if (!key) throw new Error('no-' + provider + '-key');

    if (provider === 'openai') {
      const body = {
        model: 'gpt-4o-mini', max_tokens: taskDef.maxTokens || 1000,
        messages: [
          { role: 'system', content: taskDef.system + '\n\nRespond ONLY with valid JSON. No markdown.' },
          ...(taskDef.messages || []),
        ],
        response_format: { type: 'json_object' },
      };
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `OpenAI ${res.status}`); }
      return (await res.json()).choices[0].message.content;
    }

    if (provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: taskDef.maxTokens || 1000,
          system: taskDef.system + '\n\nRespond ONLY with valid JSON. No markdown.',
          messages: taskDef.messages || [],
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `Claude ${res.status}`); }
      return (await res.json()).content[0].text;
    }

    if (provider === 'gemini') {
      const parts = [
        { text: taskDef.system + '\n\nRespond ONLY with valid JSON.' },
        ...(taskDef.messages || []).map(m => ({ text: m.content })),
      ];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `Gemini ${res.status}`); }
      return (await res.json()).candidates[0].content.parts[0].text;
    }

    throw new Error(`Unknown provider: ${provider}`);
  }

  // ══════════════════════════════════════════════════════════════
  //  INDIVIDUAL FIELD FUNCTIONS
  //  Call these for targeted single-field optimization
  // ══════════════════════════════════════════════════════════════

  async function generateListingContent(item, vendor, opts) {
    const result = await enhance(item, vendor, opts);
    return {
      title:       result.fields.title,
      description: result.fields.description,
      tags:        result.fields.tags,
      errors:      result.errors,
    };
  }

  async function generateAdCopy(item, vendor, opts) {
    const result = await enhance(item, vendor, opts);
    return { adCopy: result.fields.adCopy, errors: result.errors };
  }

  async function generatePromoText(item, vendor, opts) {
    opts = Object.assign({ urgency: true }, opts || {});
    const result = await enhance(item, vendor, opts);
    return { promoText: result.fields.promoText, errors: result.errors };
  }

  async function generateVideoScript(item, vendor, opts) {
    // Fast path: only generate video script (skip content if we already have it)
    if (item.aiDescription || item.aiTitle) {
      const vsPrompt = buildVideoScriptPrompt(item, vendor, {
        title: item.aiTitle || item.name,
        description: item.aiDescription || item.description,
        promoText: item.aiPromoText || '',
        tags: item.aiTags || [],
      }, opts || {});
      const vsResult = await runWithCustomPrompt(vsPrompt.system, vsPrompt.userMessage, opts || {});
      return { videoScript: vsResult.data, error: vsResult.error };
    }
    const result = await enhance(item, vendor, opts);
    return { videoScript: result.fields.videoScript, error: result.errors[0] || null };
  }

  async function optimizeTitle(item, vendor, opts) {
    const result = await enhance(item, vendor, opts);
    return result.fields.title;
  }

  async function optimizeDescription(item, vendor, opts) {
    const result = await enhance(item, vendor, opts);
    return result.fields.description;
  }

  /**
   * Generate N A/B variants for a specific field.
   * Returns array of variant objects { id, vi, en }
   */
  async function generateVariants(item, vendor, field, count, opts) {
    count = Math.min(count || 3, 5);
    opts  = opts || {};
    const category = detectCategory(item, vendor);
    const rp       = REGION_PROFILES[opts.region || 'oc'];

    const system = `You are a marketing copywriter for Vietnamese-American ${category} businesses.
Generate ${count} different variations of the "${field}" field for this item.
Each variation should have a different angle or emphasis.
Return JSON: { "variants": [{"id":"A","vi":"...","en":"..."},{"id":"B","vi":"...","en":"..."},...] }`;

    const userMessage = `Item: ${item.name} | Category: ${category} | Region: ${rp.audience}
Current ${field}: ${item[field] || item['ai' + field.charAt(0).toUpperCase() + field.slice(1)] || 'none'}
Price: $${item.pricePerUnit || item.price || '?'}`;

    const result = await runWithCustomPrompt(system, userMessage, opts);
    return (result.data && result.data.variants) || [];
  }

  // ══════════════════════════════════════════════════════════════
  //  EXAMPLE OUTPUT GENERATOR (for documentation / demo)
  // ══════════════════════════════════════════════════════════════

  /**
   * Returns a hard-coded example enhancement result for demo/testing.
   * Useful when AI keys are not configured.
   */
  function getExampleOutput(category) {
    const examples = {
      food: {
        category: 'food', region: 'bayarea', provider: 'openai', latency_ms: 850, versionId: 'VEXAMPLE',
        fields: {
          title: {
            vi: 'Chả Giò Nhà Làm Của Emily',
            en: "Emily's Handmade Eggrolls",
            ab: [
              { id: 'A', vi: 'Chả Giò Nhà Làm Của Emily',      en: "Emily's Handmade Eggrolls" },
              { id: 'B', vi: 'Chả Giò Gia Truyền Miền Bắc',   en: 'Authentic Northern-Style Eggrolls' },
            ],
          },
          description: {
            vi: 'Từng cuốn chả giò được Emily tự tay gói mỗi sáng — nhân thịt heo tươi, nấm hương Đà Lạt và cà rốt giòn, bọc trong lớp bánh tráng mỏng giòn tan khi chiên. Hương vị miền Bắc chính gốc, không chất bảo quản, không công thức công nghiệp.',
            en: "Each eggroll is hand-rolled fresh every morning by Emily — tender pork, Dalat mushrooms, and crisp carrots wrapped in a thin rice paper skin that shatters beautifully when fried. Authentic Northern Vietnamese recipe, no preservatives, no shortcuts.",
          },
          adCopy: {
            vi: '🥟 Chả giò nhà làm $0.75/cuốn · đặt min 30 cuốn · gọi Loan: 408-931-2438',
            en: '🥟 Handmade eggrolls $0.75 each · 30-piece minimum · Order: 408-931-2438',
          },
          promoText: { vi: '⚡ Số lượng có hạn mỗi ngày — đặt trước để không hết!' },
          shortDescription: { vi: 'Nhà làm mỗi sáng · Miền Bắc chính gốc · Không chất bảo quản' },
          tags: { values: ['chả giò', 'eggroll', 'handmade', 'miền bắc', 'Bay Area', 'San Jose', 'không bảo quản', 'nhà làm'] },
          voiceoverScript: {
            vi: 'Emily làm chả giò từ sáng sớm, mỗi cuốn một tình yêu. Nhân thịt heo tươi, nấm hương thơm, chiên lên giòn rụm. Hương vị miền Bắc giữa lòng San Jose. Chỉ $0.75 một cuốn, đặt ít nhất 30 cuốn. Gọi ngay cho Loan để đặt hàng hôm nay.',
            en: "Emily starts rolling at dawn — fresh pork, fragrant mushrooms, crisp carrots. The moment they hit the oil, the kitchen fills with that irresistible aroma. Northern Vietnamese flavor, right here in San Jose. Just 75 cents each, 30-piece minimum. Call Loan now.",
          },
          videoScript: {
            remotionProps: { vendorName: 'Nhà Bếp Của Emily', vendorTagline: 'Handmade Vietnamese Kitchen · San Jose', itemName: 'Chả Giò', itemNameEn: 'Handmade Eggrolls', itemDescription: 'Nhà làm mỗi sáng · Không chất bảo quản', pricePerUnit: 0.75, unit: 'cuốn', minimumOrderQty: 30, variants: [{label:'Sống (Raw)',labelEn:'Raw — fry at home'},{label:'Tươi (Fresh)',labelEn:'Fresh — ready to serve'}], ctaText: 'Đặt Hàng Ngay', ctaSubtext: 'Perfect for family dinners & parties', phone: '408-931-2438', promoText: 'No preservatives · Handmade every batch', tags: ['handmade','miền bắc'], shortDescription: 'Nhà làm · Miền Bắc · Giòn tan', accentColor: '#f59e0b' },
            renderCmd: "cd remotion-promo && npx remotion render FoodPromo --props='{...}' --output videos/cha-gio-emily.mp4",
          },
        },
        renderJobId: null, errors: [],
      },
      travel: {
        category: 'travel', region: 'oc', provider: 'claude', latency_ms: 920, versionId: 'VEXAMPLE',
        fields: {
          title: { vi: 'Tour Las Vegas Trọn Gói · 2 Ngày', en: 'All-Inclusive Las Vegas Tour · 2 Days', ab: [] },
          description: { vi: 'Khám phá Las Vegas cùng Du Lịch Cali — không lo đặt xe, không lo đường đi. Tài xế song ngữ, xe mới, đón tận nhà đến khách sạn. Chia nhóm 6-12 người: chi phí chia đều, trải nghiệm tối đa.', en: 'Experience Las Vegas stress-free with Du Lịch Cali — no rental car hassles, no navigation. Bilingual driver, new vehicle, door-to-door service. Split 6-12 ways for unbeatable value.' },
          adCopy: { vi: '🎰 Las Vegas từ ~$165/người · Đón tận nhà · Gọi Duy Hoa: 714-227-6007', en: '🎰 Las Vegas from ~$165/person · Door-to-door · Call Duy Hoa: 714-227-6007' },
          promoText: { vi: '✅ Đặt trước 1 tuần để đảm bảo chỗ' },
          tags: { values: ['Las Vegas', 'tour', 'trọn gói', 'nhóm gia đình', 'Orange County', 'tài xế song ngữ'] },
        },
        renderJobId: null, errors: [],
      },
      service: {
        category: 'service_nails', region: 'oc', provider: 'openai', latency_ms: 780, versionId: 'VEXAMPLE',
        fields: {
          title: { vi: 'Acrylic Full Set Cao Cấp', en: 'Premium Acrylic Full Set', ab: [] },
          description: { vi: 'Bộ acrylic hoàn hảo bắt đầu từ $40 — thợ lành nghề với kinh nghiệm 10+ năm, móng đẹp bền lâu, dụng cụ khử trùng 100%. Đặt lịch ngay để không phải chờ đợi.', en: 'Premium acrylic full set from $40 — skilled technicians with 10+ years experience, long-lasting results, fully sterilized tools. Book now and skip the wait.' },
          adCopy: { vi: '💅 Acrylic Full Set từ $40 · Thợ lành nghề · Gọi: 714-227-6007', en: '💅 Acrylic Full Set from $40 · Experienced techs · Call: 714-227-6007' },
          promoText: { vi: '📅 Đặt lịch online — không cần chờ' },
          tags: { values: ['acrylic nails', 'full set', 'nail salon', 'Westminster', 'Orange County', 'Vietnamese nail'] },
        },
        renderJobId: null, errors: [],
      },
    };
    return examples[category] || examples.food;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.DLCMarketing = {
    // Full pipeline
    enhance,

    // Individual functions
    generateListingContent,
    generateAdCopy,
    generatePromoText,
    generateVideoScript,
    optimizeTitle,
    optimizeDescription,
    generateVariants,

    // Utilities
    detectCategory,
    getExampleOutput,
    REGION_PROFILES,
  };

})();
