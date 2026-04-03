/**
 * Du Lịch Cali — AI Orchestration Layer  v1.0
 *
 * Central module that routes tasks to the best AI engine, normalizes outputs
 * into a structured format, and applies fallback strategies.
 *
 * Supported engines (browser-side, keys in localStorage):
 *   • Claude   — structured reasoning, travel planning, booking workflows
 *   • OpenAI   — content generation, video scripts, ad copy
 *   • Gemini   — multimodal/image understanding, search grounding
 *   • Remotion — video rendering (queued via Firestore → Cloud Function)
 *
 * Admin key setup (run once in browser console on vendor-admin):
 *   DLCOrchestrator.setKey('claude',  'sk-ant-...')
 *   DLCOrchestrator.setKey('openai',  'sk-...')
 *   DLCOrchestrator.setKey('gemini',  'AI...')
 *
 * For server-side orchestration (recommended for production), the Firebase
 * Cloud Function `aiOrchestrate` accepts the same task format and uses
 * keys stored securely in Google Cloud Secret Manager.
 */

(function () {
  'use strict';

  // ── Engine model config ────────────────────────────────────────────────────
  const MODELS = {
    claude: 'claude-haiku-4-5-20251001',
    openai: 'gpt-4o-mini',
    gemini: 'gemini-1.5-flash',
  };

  // ── Key accessors (localStorage — admin-configured) ────────────────────────
  const KEYS = {
    claude: () => localStorage.getItem('dlc_claude_key'),
    openai: () => localStorage.getItem('dlc_openai_key'),
    gemini: () => localStorage.getItem('dlc_gemini_key'),
  };

  // ── Task routing table ─────────────────────────────────────────────────────
  //
  // Each entry: { primary, fallback, strategy }
  //   strategy 'json'      → parse response as JSON
  //   strategy 'text'      → return raw text
  //   strategy 'async'     → queue job, return job ID
  //
  const ROUTES = {
    // Chat & messaging
    'chat.general':           { primary: 'claude',  fallback: 'openai',  strategy: 'text' },
    'chat.marketplace':       { primary: 'claude',  fallback: 'openai',  strategy: 'text' },
    'chat.support':           { primary: 'claude',  fallback: 'openai',  strategy: 'text' },

    // Booking & travel
    'booking.create':         { primary: 'claude',  fallback: 'openai',  strategy: 'json' },
    'booking.analyze':        { primary: 'claude',  fallback: 'openai',  strategy: 'json' },
    'travel.plan':            { primary: 'claude',  fallback: 'gemini',  strategy: 'json' },
    'travel.estimate':        { primary: 'claude',  fallback: null,      strategy: 'json' },

    // Search & multimodal
    'search.web':             { primary: 'gemini',  fallback: 'openai',  strategy: 'json' },
    'image.analyze':          { primary: 'gemini',  fallback: null,      strategy: 'json' },
    'image.describe':         { primary: 'gemini',  fallback: 'openai',  strategy: 'text' },

    // Content generation
    'content.generate':       { primary: 'openai',  fallback: 'claude',  strategy: 'json' },
    'content.title':          { primary: 'openai',  fallback: 'claude',  strategy: 'json' },
    'content.description':    { primary: 'openai',  fallback: 'claude',  strategy: 'json' },
    'content.ad_copy':        { primary: 'openai',  fallback: 'claude',  strategy: 'json' },
    'content.tags':           { primary: 'openai',  fallback: 'claude',  strategy: 'json' },
    'content.translate':      { primary: 'openai',  fallback: 'claude',  strategy: 'text' },

    // Video
    'video.script':           { primary: 'openai',  fallback: 'claude',  strategy: 'json' },
    'video.render':           { primary: 'remotion',fallback: null,      strategy: 'async' },

    // Customer support
    'support.classify':       { primary: 'claude',  fallback: 'openai',  strategy: 'json' },
    'support.draft_reply':    { primary: 'claude',  fallback: 'openai',  strategy: 'text' },
  };

  // ── Standard output format ─────────────────────────────────────────────────
  //
  // All run() calls return this shape:
  // {
  //   intent:      string,   // task type used
  //   data:        object,   // parsed structured data (or { text } for text strategy)
  //   ui_response: string,   // human-readable summary for display
  //   confidence:  number,   // 0–1, from model or default 0.9
  //   provider:    string,   // which engine actually responded
  //   latency_ms:  number,
  //   error:       string|null
  // }
  //
  function makeResult(intent, data, uiResponse, confidence, provider, latencyMs, error) {
    return {
      intent,
      data:        data       || null,
      ui_response: uiResponse || '',
      confidence:  confidence || 0,
      provider:    provider   || null,
      latency_ms:  latencyMs  || 0,
      error:       error      || null,
    };
  }

  // ── JSON parser (handles markdown code fences) ─────────────────────────────
  function parseJSON(text) {
    const clean = String(text)
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();
    return JSON.parse(clean);
  }

  // ══════════════════════════════════════════════════════════════
  //  PROVIDER ADAPTERS
  //  Each adapter accepts a normalized task definition and returns raw text.
  // ══════════════════════════════════════════════════════════════

  async function callClaude(taskDef) {
    const key = KEYS.claude();
    if (!key) throw new Error('no-claude-key');

    let system = taskDef.system || 'You are a helpful AI assistant for Du Lịch Cali.';
    if (taskDef.schema) {
      system += '\n\nRespond ONLY with valid JSON. No explanation, no markdown fences.';
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      MODELS.claude,
        max_tokens: taskDef.maxTokens || 1200,
        system,
        messages:   taskDef.messages || [],
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || `Claude HTTP ${res.status}`);
    }
    const d = await res.json();
    return d.content[0].text;
  }

  async function callOpenAI(taskDef) {
    const key = KEYS.openai();
    if (!key) throw new Error('no-openai-key');

    const system = (taskDef.system || 'You are a helpful AI assistant for Du Lịch Cali.')
      + (taskDef.schema ? '\n\nRespond ONLY with valid JSON matching the requested structure.' : '');

    const body = {
      model:      MODELS.openai,
      max_tokens: taskDef.maxTokens || 1200,
      messages: [
        { role: 'system', content: system },
        ...(taskDef.messages || []),
      ],
    };
    if (taskDef.schema) body.response_format = { type: 'json_object' };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || `OpenAI HTTP ${res.status}`);
    }
    const d = await res.json();
    return d.choices[0].message.content;
  }

  async function callGemini(taskDef) {
    const key = KEYS.gemini();
    if (!key) throw new Error('no-gemini-key');

    // Flatten system + messages into a single prompt
    const parts = [];
    if (taskDef.system) parts.push({ text: taskDef.system });
    (taskDef.messages || []).forEach(m => {
      if (m.parts) parts.push(...m.parts); // multimodal: { inlineData: { mimeType, data } }
      else if (m.content) parts.push({ text: m.content });
    });
    if (taskDef.schema) {
      parts.push({ text: 'Respond ONLY with valid JSON. No explanation.' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || `Gemini HTTP ${res.status}`);
    }
    const d = await res.json();
    return d.candidates[0].content.parts[0].text;
  }

  // ── Provider dispatcher ────────────────────────────────────────────────────
  async function executeProvider(provider, taskDef) {
    switch (provider) {
      case 'claude':  return callClaude(taskDef);
      case 'openai':  return callOpenAI(taskDef);
      case 'gemini':  return callGemini(taskDef);
      default:        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  TASK DEFINITION BUILDERS
  //  Maps task type + payload → { system, messages, schema }
  // ══════════════════════════════════════════════════════════════

  function buildTaskDef(taskType, payload) {
    switch (taskType) {
      case 'content.generate':    return defContentGenerate(payload);
      case 'video.script':        return defVideoScript(payload);
      case 'booking.analyze':     return defBookingAnalyze(payload);
      case 'travel.plan':         return defTravelPlan(payload);
      case 'support.classify':    return defSupportClassify(payload);
      case 'support.draft_reply': return defSupportDraft(payload);
      case 'image.analyze':
      case 'image.describe':      return defImageAnalyze(payload);
      default:
        return {
          system:   'You are a helpful AI assistant for Du Lịch Cali, a Vietnamese-American travel & marketplace service.',
          messages: [{ role: 'user', content: typeof payload === 'string' ? payload : JSON.stringify(payload) }],
          schema:   null,
        };
    }
  }

  function defContentGenerate(p) {
    const { item, vendor } = p;
    return {
      system: `You are a Vietnamese-American food & lifestyle marketing copywriter.
Generate compelling product content for a Vietnamese marketplace app.
Return JSON with exactly these fields:
{
  "title": "Vietnamese title (≤8 words, appetizing)",
  "titleEn": "English title (≤8 words)",
  "description": "2-3 sentence Vietnamese description, authentic and emotional",
  "descriptionEn": "2-3 sentence English description",
  "adCopy": "Social media ad copy in Vietnamese with price hook (1-2 sentences)",
  "adCopyEn": "English social media ad copy",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "shortDescription": "One catchy sentence for thumbnails",
  "ui_response": "✅ AI đã tạo nội dung cho ${(item && item.name) ? item.name : 'sản phẩm'}.",
  "confidence": 0.92
}`,
      messages: [{
        role: 'user',
        content: [
          `Product: ${(item && item.name) || 'Unknown'}`,
          `English name: ${(item && item.nameEn) || ''}`,
          `Vendor: ${(vendor && vendor.name) || ''}, ${(vendor && vendor.city) || ''}, ${(vendor && vendor.region) || ''}`,
          `Price: $${(item && item.pricePerUnit) || '?'}/${(item && item.unit) || 'unit'}`,
          `Min order: ${(item && item.minOrder) || ''}`,
          `Current description: ${(item && item.description) || 'none'}`,
          `Allergen notes: ${(item && item.allergenNotes) || 'none'}`,
          '',
          'Write compelling content that highlights authenticity, flavor, and cultural connection.',
        ].join('\n'),
      }],
      schema: true,
      maxTokens: 800,
    };
  }

  function defVideoScript(p) {
    const { item, vendor, contentData } = p;
    const cd = contentData || {};
    return {
      system: `You are a short-form video director for Vietnamese-American food brands.
Create props for a Remotion FoodPromo video composition (15 seconds, 3 slides).
Return JSON matching the FoodPromo schema exactly:
{
  "vendorName": "string",
  "vendorTagline": "string (city + tagline)",
  "itemName": "Vietnamese product name",
  "itemNameEn": "English product name",
  "itemDescription": "1-2 sentence description for the video",
  "pricePerUnit": 0.00,
  "unit": "unit label",
  "minimumOrderQty": 0,
  "variants": [{"label":"Vietnamese label","labelEn":"English label"}],
  "ctaText": "Vietnamese CTA",
  "ctaSubtext": "English subtitle for CTA",
  "phone": "phone number",
  "promoText": "short promo line",
  "tags": ["tag1","tag2"],
  "shortDescription": "thumbnail line",
  "accentColor": "#hexcolor",
  "ui_response": "✅ Video script sẵn sàng.",
  "confidence": 0.9
}`,
      messages: [{
        role: 'user',
        content: [
          `Product: ${(item && item.name) || ''} / ${(item && item.nameEn) || ''}`,
          `Vendor: ${(vendor && vendor.name) || ''}, ${(vendor && vendor.city) || ''}`,
          `Phone: ${(vendor && vendor.phone) || ''}`,
          `Price: $${(item && item.pricePerUnit) || '?'}/${(item && item.unit) || 'unit'}  Min: ${(item && item.minOrder) || 1}`,
          `AI Title: ${cd.title || ''}`,
          `AI Description: ${cd.description || ''}`,
          `AI Tags: ${(cd.tags || []).join(', ')}`,
          '',
          'Choose an accent color that fits the food personality:',
          '  Fried/golden food → #f59e0b  |  Fresh/green → #10b981',
          '  Spicy/bold → #ef4444  |  Comfort/warm → #f97316  |  Premium → #a78bfa',
        ].join('\n'),
      }],
      schema: true,
      maxTokens: 700,
    };
  }

  function defBookingAnalyze(p) {
    const { booking } = p;
    return {
      system: `You are a travel operations analyst for Du Lịch Cali.
Analyze a booking and return JSON:
{
  "priority": "high|medium|low",
  "flags": ["flag description if any"],
  "suggestedAction": "next best action for the operator",
  "estimatedRevenue": 0,
  "customerInsight": "brief customer profile inference",
  "ui_response": "operator-facing summary",
  "confidence": 0.9
}`,
      messages: [{ role: 'user', content: `Analyze booking: ${JSON.stringify(booking)}` }],
      schema: true,
      maxTokens: 500,
    };
  }

  function defTravelPlan(p) {
    const { destination, days, passengers, lodging, budget, preferences, origin } = p;
    return {
      system: `You are an expert Vietnamese-American travel planner for California.
Return a detailed itinerary as JSON:
{
  "itinerary": [
    {
      "day": 1,
      "title": "Day title",
      "activities": ["activity 1", "activity 2"],
      "meals": ["breakfast suggestion", "dinner suggestion"],
      "tips": "practical tip for Vietnamese families"
    }
  ],
  "totalEstimate": 0,
  "perPersonEstimate": 0,
  "highlights": ["top 3 highlights"],
  "packingTips": ["2-3 packing tips"],
  "bestTime": "best travel window",
  "ui_response": "summary in Vietnamese",
  "confidence": 0.88
}`,
      messages: [{
        role: 'user',
        content: [
          `Destination: ${destination || ''}`,
          `Duration: ${days || 2} days`,
          `Group size: ${passengers || 2} people`,
          `Lodging preference: ${lodging || 'hotel'}`,
          `Budget level: ${budget || 'moderate'}`,
          `Special preferences: ${preferences || 'standard Vietnamese-American family group'}`,
          `Origin: ${origin || 'Orange County, California'}`,
          '',
          'Focus on: Vietnamese-friendly restaurants, family activities, practical logistics.',
        ].join('\n'),
      }],
      schema: true,
      maxTokens: 1800,
    };
  }

  function defSupportClassify(p) {
    const { message, context } = p;
    return {
      system: `You classify customer messages for Du Lịch Cali support.
Return JSON:
{
  "category": "booking|cancel|price|complaint|general|marketplace|unknown",
  "urgency": "high|medium|low",
  "sentiment": "positive|neutral|negative",
  "language": "vi|en|mixed",
  "suggestedTeam": "travel|marketplace|billing|general",
  "ui_response": "one-line classification summary",
  "confidence": 0.9
}`,
      messages: [{ role: 'user', content: `Customer message: "${message}"\nContext: ${context || 'none'}` }],
      schema: true,
      maxTokens: 300,
    };
  }

  function defSupportDraft(p) {
    const { message, category, context, phone } = p;
    return {
      system: `You are a warm, professional customer support agent for Du Lịch Cali.
Draft a reply in the same language the customer used (Vietnamese or English).
Be concise (2-4 sentences), helpful, and offer a clear next step.`,
      messages: [{
        role: 'user',
        content: `Customer: "${message}"\nCategory: ${category || 'general'}\nContext: ${context || ''}\nContact: ${phone || '714-227-6007'}`,
      }],
      schema: null,
      maxTokens: 300,
    };
  }

  function defImageAnalyze(p) {
    const { imageBase64, mimeType, question } = p;
    return {
      system: 'You are a visual analysis assistant for a Vietnamese marketplace.',
      messages: [{
        role: 'user',
        parts: [
          { text: question || 'Describe this image in detail for a food marketplace listing.' },
          ...(imageBase64 ? [{ inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }] : []),
        ],
      }],
      schema: null,
      maxTokens: 400,
    };
  }

  // ══════════════════════════════════════════════════════════════
  //  MAIN RUN FUNCTION
  //  Single entry point for all AI tasks.
  // ══════════════════════════════════════════════════════════════

  async function run(taskType, payload) {
    const route = ROUTES[taskType];
    if (!route) {
      return makeResult(taskType, null, '', 0, null, 0, `Unknown task type: ${taskType}`);
    }

    // Remotion render → queue async job
    if (route.primary === 'remotion') {
      const jobId = await queueRenderJob(payload);
      return makeResult(taskType, { jobId }, jobId ? '🎬 Đã thêm vào hàng chờ render.' : 'Chưa cấu hình Firebase.', 1, 'remotion', 0, null);
    }

    const t0      = Date.now();
    const taskDef = buildTaskDef(taskType, payload);

    // ── Try primary provider ────────────────────────────────────
    let rawText, usedProvider;
    try {
      rawText      = await executeProvider(route.primary, taskDef);
      usedProvider = route.primary;
      _log(taskType, route.primary, 'ok', Date.now() - t0);
    } catch (primaryErr) {
      _log(taskType, route.primary, 'fail: ' + primaryErr.message, Date.now() - t0);

      // ── Fallback provider ─────────────────────────────────────
      if (route.fallback && route.fallback !== 'local') {
        try {
          rawText      = await executeProvider(route.fallback, taskDef);
          usedProvider = route.fallback;
          _log(taskType, route.fallback, 'fallback ok', Date.now() - t0);
        } catch (fallbackErr) {
          _log(taskType, route.fallback, 'fallback fail: ' + fallbackErr.message, Date.now() - t0);
          return makeResult(taskType, null, 'Không thể kết nối AI lúc này.', 0, null, Date.now() - t0,
            `${route.primary}: ${primaryErr.message} | ${route.fallback}: ${fallbackErr.message}`);
        }
      } else {
        return makeResult(taskType, null, 'Không thể kết nối AI lúc này.', 0, null, Date.now() - t0, primaryErr.message);
      }
    }

    // ── Parse output ────────────────────────────────────────────
    let data;
    if (taskDef.schema) {
      try {
        data = parseJSON(rawText);
      } catch (parseErr) {
        console.warn('[orchestrator] JSON parse failed, returning raw:', parseErr.message);
        data = { raw: rawText };
      }
    } else {
      data = { text: rawText };
    }

    const uiResp = data.ui_response || (typeof data.text === 'string' ? data.text : '');
    const conf   = typeof data.confidence === 'number' ? data.confidence : 0.9;

    return makeResult(taskType, data, uiResp, conf, usedProvider, Date.now() - t0, null);
  }

  // ══════════════════════════════════════════════════════════════
  //  FOOD CONTENT + VIDEO PIPELINE
  //  Full pipeline: content → video script → Firestore → render queue
  // ══════════════════════════════════════════════════════════════

  /**
   * Generate AI content + video script for a food item.
   * Persists results to vendors/{vendorId}/items/{itemId} in Firestore.
   *
   * @param {string} vendorId   - Firestore vendor document ID
   * @param {object} item       - item object (name, nameEn, pricePerUnit, unit, description, ...)
   * @param {object} vendor     - vendor object (name, city, region, phone, ...)
   * @returns {object}          - { content, script, renderJobId, errors }
   */
  async function generateFoodContent(vendorId, item, vendor) {
    const errors = [];

    // Step 1 — Content generation
    const contentResult = await run('content.generate', { item, vendor });
    if (contentResult.error || !contentResult.data) {
      errors.push('content: ' + (contentResult.error || 'no data'));
      return { content: contentResult, script: null, renderJobId: null, errors };
    }

    // Step 2 — Video script generation
    const scriptResult = await run('video.script', {
      item, vendor, contentData: contentResult.data,
    });
    if (scriptResult.error) errors.push('script: ' + scriptResult.error);

    // Step 3 — Persist to Firestore
    const itemId = item.id || encodeURIComponent(item.name || 'item');
    let renderJobId = null;

    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const updates = {
          aiTitle:          contentResult.data.title       || '',
          aiTitleEn:        contentResult.data.titleEn     || '',
          aiDescription:    contentResult.data.description || '',
          aiDescriptionEn:  contentResult.data.descriptionEn || '',
          aiAdCopy:         contentResult.data.adCopy      || '',
          aiAdCopyEn:       contentResult.data.adCopyEn    || '',
          aiTags:           contentResult.data.tags        || [],
          aiShortDesc:      contentResult.data.shortDescription || '',
          aiVideoScript:    scriptResult.data || null,
          aiGeneratedAt:    firebase.firestore.FieldValue.serverTimestamp(),
          aiProvider:       contentResult.provider,
          videoStatus:      scriptResult.data ? 'script_ready' : 'no_script',
        };
        await firebase.firestore()
          .collection('vendors').doc(vendorId)
          .collection('items').doc(itemId)
          .set(updates, { merge: true });
      } catch (fsErr) {
        errors.push('firestore: ' + fsErr.message);
      }

      // Step 4 — Queue render job
      if (scriptResult.data && !scriptResult.error) {
        renderJobId = await queueRenderJob({
          vendorId,
          itemId,
          props: scriptResult.data,
        });
      }
    }

    return {
      content:     contentResult,
      script:      scriptResult,
      renderJobId,
      errors,
    };
  }

  // ── Remotion render job queue ──────────────────────────────────────────────
  async function queueRenderJob(payload) {
    if (typeof firebase === 'undefined' || !firebase.firestore) return null;
    try {
      const ref = await firebase.firestore().collection('videoRenderJobs').add({
        status:    'queued',
        vendorId:  payload.vendorId  || null,
        itemId:    payload.itemId    || null,
        props:     payload.props     || payload,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        // Render command (for manual/CLI rendering):
        renderCmd: buildRenderCommand(payload.props || payload),
      });
      return ref.id;
    } catch (e) {
      console.error('[orchestrator] queueRenderJob failed:', e);
      return null;
    }
  }

  /** Generate the Remotion CLI render command from video props */
  function buildRenderCommand(props) {
    if (!props) return '';
    const safeProps = JSON.stringify(props).replace(/'/g, "\\'");
    return `npx remotion render FoodPromo --props='${safeProps}' --output output-${(props.itemName || 'video').replace(/\s+/g,'-')}.mp4`;
  }

  // ══════════════════════════════════════════════════════════════
  //  SERVER-SIDE ORCHESTRATION (Firebase Callable Function)
  //  Call this instead of direct AI APIs when keys should stay server-side.
  //  Requires the `aiOrchestrate` Cloud Function to be deployed.
  // ══════════════════════════════════════════════════════════════

  async function runServerSide(taskType, payload) {
    if (typeof firebase === 'undefined' || !firebase.functions) {
      return makeResult(taskType, null, '', 0, null, 0, 'Firebase Functions not available');
    }
    const t0 = Date.now();
    try {
      const fn     = firebase.functions().httpsCallable('aiOrchestrate');
      const result = await fn({ taskType, payload });
      return Object.assign(result.data, { latency_ms: Date.now() - t0 });
    } catch (err) {
      return makeResult(taskType, null, '', 0, null, Date.now() - t0, err.message);
    }
  }

  // ── Logging ────────────────────────────────────────────────────────────────
  function _log(task, provider, status, ms) {
    console.log(`[orchestrator] ${task} → ${provider} [${status}] ${ms}ms`);
  }

  // ── Provider status (for admin UI) ────────────────────────────────────────
  function getProviderStatus() {
    return {
      claude:   { configured: !!KEYS.claude(), label: 'Claude (Anthropic)', model: MODELS.claude },
      openai:   { configured: !!KEYS.openai(), label: 'OpenAI (GPT-4o mini)', model: MODELS.openai },
      gemini:   { configured: !!KEYS.gemini(), label: 'Google Gemini 1.5 Flash', model: MODELS.gemini },
      remotion: { configured: true,            label: 'Remotion (video rendering)', model: 'local CLI / Lambda' },
    };
  }

  /** Set or clear an API key in localStorage */
  function setKey(provider, key) {
    const map = { claude: 'dlc_claude_key', openai: 'dlc_openai_key', gemini: 'dlc_gemini_key' };
    if (!map[provider]) return false;
    if (key) localStorage.setItem(map[provider], key);
    else localStorage.removeItem(map[provider]);
    return true;
  }

  /** Add or update a custom route */
  function addRoute(taskType, routeDef) {
    ROUTES[taskType] = routeDef;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.DLCOrchestrator = {
    // Core
    run,
    runServerSide,

    // Food pipeline
    generateFoodContent,
    buildRenderCommand,
    queueRenderJob,

    // Admin
    getProviderStatus,
    setKey,
    addRoute,

    // Inspection
    ROUTES,
    MODELS,
  };

})();
