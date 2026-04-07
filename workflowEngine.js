/**
 * Du Lịch Cali — Workflow Engine v1.0
 *
 * True multi-step state-machine for all service types.
 * Replaces the old FLOW_STEPS/flowState system in chat.js.
 *
 * Workflows: food_order · airport_pickup · airport_dropoff
 *            nail_appointment · hair_appointment · tour_request
 *
 * Public API:
 *   DLCWorkflow.detectIntent(text)           → intent key | null
 *   DLCWorkflow.isActive()                   → boolean
 *   DLCWorkflow.startWorkflow(intent, seed)  → void
 *   DLCWorkflow.process(text)                → string | {type:'finalize'} | null
 *   DLCWorkflow.finalize()                   → Promise<orderId>
 *   DLCWorkflow.cancel()                     → void
 *   DLCWorkflow.getDraft()                   → object | null
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'dlc_wf_draft';

  // ── Formatters ─────────────────────────────────────────────────────────────

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso + 'T12:00:00');
      var DOW = ['CN','T2','T3','T4','T5','T6','T7'];
      var MON = ['tháng 1','tháng 2','tháng 3','tháng 4','tháng 5','tháng 6',
                 'tháng 7','tháng 8','tháng 9','tháng 10','tháng 11','tháng 12'];
      return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()];
    } catch (e) { return iso; }
  }

  function fmtTime(hhmm) {
    if (!hhmm) return '—';
    try {
      var parts = hhmm.split(':');
      var h = parseInt(parts[0]), m = parseInt(parts[1] || 0);
      var p = h >= 12 ? 'PM' : 'AM';
      var h12 = h % 12 || 12;
      return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + p;
    } catch (e) { return hhmm; }
  }

  function fmtPhone(p) {
    if (!p) return '';
    var d = String(p).replace(/\D/g, '');
    return d.length === 10 ? '(' + d.slice(0,3) + ') ' + d.slice(3,6) + '-' + d.slice(6) : p;
  }

  function genId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var id = 'DLC-';
    for (var i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  // ── Field Extractors ───────────────────────────────────────────────────────

  var X = {

    quantity: function(text) {
      // "a tray" or "one tray" → 1; "2 trays" → 2
      var trayM = text.match(/(\d+)\s*tray/i);
      if (trayM) return parseInt(trayM[1]);
      if (/\btray\b/i.test(text)) return 1;
      var m = text.match(/(\d+)\s*(?:cuốn|cái|tô|phần|piece|roll|order|chiếc|serving|bowl)/i)
           || text.match(/^(\d+)$/);
      var n = m ? parseInt(m[1]) : NaN;
      return (isNaN(n) || n < 1 || n > 9999) ? null : n;
    },

    foodVariant: function(text) {
      var t = text.toLowerCase();
      // Eggroll: raw vs fresh-cooked
      if (/raw|sống|chưa chiên|uncooked/.test(t)) return 'Sống (Raw)';
      if (/\bfresh\b|tươi\b/.test(t) && !/unfresh/.test(t)) return 'Tươi (Fresh)';
      if (/fried|chiên|chín|cooked|sẵn/.test(t)) return 'Chiên Sẵn (Fried)';
      // Bún Chả variants
      if (/lá\s*lốt|la\s*lot|lolot|betel|leaf/.test(t)) return 'Chả Lá Lốt';
      if (/chả\s*viên|cha\s*vien|patties|patty|\bviên\b/.test(t)) return 'Chả Viên';
      // Phở variants
      if (/tái.*viên|rare.*meatball|viên.*tái|meatball.*rare/.test(t)) return 'Tái + Bò Viên';
      if (/\btái\b|rare\s*beef|\btai\b/.test(t)) return 'Tái';
      return null;
    },

    fulfillment: function(text) {
      var t = text.toLowerCase();
      if (/pickup|tự lấy|\blấy\b|pick.?up|đến lấy/.test(t)) return 'pickup';
      if (/delivery|giao|ship|mang.?đến|giao.?hàng/.test(t)) return 'delivery';
      return null;
    },

    date: function(text) {
      var today = new Date();
      var t = text.toLowerCase();

      if (/hôm nay|today/.test(t)) return AIEngine.localISODate(today);
      if (/ngày mai|tomorrow/.test(t)) {
        var tm = new Date(today); tm.setDate(tm.getDate() + 1);
        return AIEngine.localISODate(tm);
      }

      var DOW_VI = ['chủ nhật','thứ hai','thứ ba','thứ tư','thứ năm','thứ sáu','thứ bảy'];
      var DOW_EN = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      var DOW_SH = ['sun','mon','tue','wed','thu','fri','sat'];
      for (var i = 0; i < 7; i++) {
        if (t.indexOf(DOW_VI[i]) !== -1 || t.indexOf(DOW_EN[i]) !== -1 ||
            new RegExp('\\b' + DOW_SH[i] + '\\b').test(t)) {
          var dd = new Date(today);
          var diff = i - dd.getDay();
          if (diff <= 0) diff += 7;
          dd.setDate(dd.getDate() + diff);
          return AIEngine.localISODate(dd);
        }
      }

      // M/D — parse at local noon to avoid UTC-midnight off-by-one
      var m = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
      if (m) {
        var yr = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : today.getFullYear();
        var d2 = new Date(yr + '-' + pad(m[1]) + '-' + pad(m[2]) + 'T12:00:00');
        if (!isNaN(d2)) return AIEngine.localISODate(d2);
      }

      // "April 10" — parse at local noon to avoid UTC-midnight off-by-one
      var MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
        january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
      var m2 = text.match(/([a-zA-Z]+)\s+(\d{1,2})/i) || text.match(/(\d{1,2})\s+([a-zA-Z]+)/i);
      if (m2) {
        var word = m2[1].toLowerCase(), num = parseInt(m2[2]);
        var word2 = m2[2] ? m2[2].toLowerCase() : '', num2 = parseInt(m2[1]);
        var mo = MONTHS[word] || MONTHS[word2];
        var dy = MONTHS[word] ? num : (MONTHS[word2] ? num2 : null);
        if (mo && dy) {
          var d3 = new Date(today.getFullYear() + '-' + pad(mo) + '-' + pad(dy) + 'T12:00:00');
          if (!isNaN(d3)) return AIEngine.localISODate(d3);
        }
      }
      return null;
    },

    time: function(text) {
      var m = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
      if (m) {
        var h = parseInt(m[1]), min = parseInt(m[2]);
        var p = (m[3] || '').toLowerCase();
        if (p === 'pm' && h < 12) h += 12;
        if (p === 'am' && h === 12) h = 0;
        if (h > 23 || min > 59) return null;
        return pad(h) + ':' + pad(min);
      }
      m = text.match(/(\d{1,2})\s*(?:h|g|giờ)?\s*(am|pm|sáng|chiều|tối|sa|ch)\b/i);
      if (m) {
        var h2 = parseInt(m[1]);
        var p2 = (m[2] || '').toLowerCase();
        if (/pm|chiều|tối|ch/.test(p2) && h2 < 12) h2 += 12;
        if (/am|sáng|sa/.test(p2) && h2 === 12) h2 = 0;
        if (h2 < 0 || h2 > 23) return null;
        return pad(h2) + ':00';
      }
      // bare number like "3" treated as hour — only if 1-12
      m = text.match(/^(\d{1,2})(?:\s*(?:h|g|giờ))?$/);
      if (m) {
        var h3 = parseInt(m[1]);
        if (h3 >= 1 && h3 <= 12) return pad(h3) + ':00';
      }
      return null;
    },

    phone: function(text) {
      var m = text.match(/\+?1?\s*\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
      if (!m) return null;
      var digits = m[0].replace(/\D/g,'').replace(/^1/,'');
      return digits.length === 10 ? digits : null;
    },

    name: function(text) {
      var clean = text.trim()
        .replace(/^(tôi là|tên tôi là|my name is|i am|i'm|name:|tên:)\s+/i, '').trim();
      if (clean.length < 2 || clean.length > 50) return null;
      if (/\d/.test(clean)) return null;
      if (clean.split(/\s+/).length > 6) return null;
      return clean;
    },

    address: function(text) {
      var clean = text.trim();
      if (clean.length < 4) return null;
      if (/\d/.test(clean)) return clean;
      if (/\b(st|ave|blvd|dr|ln|way|ct|rd|đường|số)\b/i.test(clean)) return clean;
      if (clean.length >= 4) return clean;
      return null;
    },

    airport: function(text) {
      var t = text.toUpperCase();
      if (/\bLAX\b|LOS ANGELES INT/i.test(t)) return 'LAX';
      if (/\bSNA\b|JOHN WAYNE|ORANGE COUNTY/i.test(t)) return 'SNA';
      if (/\bONT\b|ONTARIO/i.test(t)) return 'ONT';
      if (/\bSFO\b|SAN FRANCISCO INT/i.test(t)) return 'SFO';
      if (/\bSJC\b|SAN JOSE INT/i.test(t)) return 'SJC';
      if (/\bOAK\b|OAKLAND/i.test(t)) return 'OAK';
      if (/\bBUR\b|BURBANK|BOB HOPE/i.test(t)) return 'BUR';
      if (/\bLGB\b|LONG BEACH/i.test(t)) return 'LGB';
      if (/\bPSP\b|PALM SPRINGS/i.test(t)) return 'PSP';
      if (/\bSAN\b|SAN DIEGO INT/i.test(t)) return 'SAN';
      if (/\bSMF\b|SACRAMENTO/i.test(t)) return 'SMF';
      return null;
    },

    passengers: function(text) {
      var m = text.match(/(\d+)\s*(?:người|people|pax|passenger|person|khách|guest)/i)
           || text.match(/nhóm\s*(\d+)/i)
           || text.match(/^(\d+)$/);
      var n = m ? parseInt(m[1]) : NaN;
      return (isNaN(n) || n < 1 || n > 30) ? null : n;
    },

    days: function(text) {
      var m = text.match(/(\d+)\s*(?:ngày|day|night|đêm)/i) || text.match(/^(\d+)$/);
      var n = m ? parseInt(m[1]) : NaN;
      return (isNaN(n) || n < 1 || n > 30) ? null : n;
    },

    yesNo: function(text) {
      var t = text.trim().toLowerCase();
      if (/^(yes|yeah|yep|ok|okay|xác nhận|đồng ý|có\b|ừ|đúng|correct|right|confirm|sure|được)/.test(t)) return true;
      if (/^(no|nope|không\b|chưa|cancel|hủy|sai|wrong|change|thay đổi|sửa)/.test(t)) return false;
      return null;
    },

    foodItem: function(text) {
      // Dynamic: read from live MARKETPLACE data so prices/items stay in sync
      var t = text.toLowerCase();
      var businesses = (window.MARKETPLACE && window.MARKETPLACE.businesses) ? window.MARKETPLACE.businesses : [];
      var foodVendors = businesses.filter(function(b) {
        return b.vendorType === 'foodvendor' && b.active !== false;
      });
      for (var e = 0; e < foodVendors.length; e++) {
        var biz = foodVendors[e];
        var products = (biz.products || []).filter(function(p) { return p.active !== false; });
        for (var i = 0; i < products.length; i++) {
          var p = products[i];
          var terms = [
            (p.name || '').toLowerCase(),
            (p.nameEn || '').toLowerCase(),
            (p.displayNameVi || '').toLowerCase(),
            (p.id || '').replace(/-/g, ' '),
          ];
          var matched = terms.some(function(term) {
            if (!term) return false;
            if (t.includes(term)) return true;
            // Require at least 2 significant words to all match (avoids false positives)
            var words = term.split(/\s+/).filter(function(w) { return w.length >= 4; });
            return words.length >= 2 && words.every(function(w) { return t.includes(w); });
          });
          if (!matched) continue;
          // Build variant info from live data
          var pricedV = (p.variants || []).filter(function(v) {
            return v && typeof v === 'object' && v.price != null && Number(v.price) > 0;
          });
          var labelledV = (p.variants || []).filter(function(v) {
            return v && typeof v === 'object' && (v.label || v.labelEn);
          });
          var hasVariant = pricedV.length > 0 || labelledV.length > 0;
          var variantOpts = pricedV.length > 0
            ? pricedV.map(function(v) { return (v.labelEn || v.label) + ' ($' + Number(v.price).toFixed(2) + ')'; }).join(' hoặc ')
            : labelledV.map(function(v) { return v.labelEn || v.label; }).filter(Boolean).join(' hoặc ');
          return {
            id:              p.id,
            name:            p.name || p.nameEn || '',
            nameEn:          p.nameEn || '',
            price:           Number(p.pricePerUnit || 0),
            unit:            p.unit || 'phần',
            unitEn:          p.unitEn || 'serving',
            minOrder:        Number(p.minimumOrderQty || 1),
            vendorId:        biz.id,
            vendorName:      biz.name,
            hasVariant:      hasVariant,
            variantOptions:  variantOpts,
            variantQuestion: hasVariant
              ? 'Bạn muốn loại nào?\n• ' + variantOpts.replace(' hoặc ', '\n• ')
              : null,
          };
        }
      }
      return null;
    },

    nailService: function(text) {
      var t = text.toLowerCase();
      if (/^1$|manicure|móng tay|\bmani\b/.test(t)) return 'Manicure';
      if (/^2$|pedicure|móng chân|\bpedi\b/.test(t)) return 'Pedicure';
      if (/mani.?pedi/.test(t)) return 'Mani + Pedi';
      if (/^3$|\bgel\b/.test(t)) return 'Gel Nails';
      if (/^4$|acrylic/.test(t)) return 'Acrylic';
      if (/^5$|full.?set|bộ móng/.test(t)) return 'Full Set';
      if (/dip|powder/.test(t)) return 'Dip Powder';
      return null;
    },

    hairService: function(text) {
      var t = text.toLowerCase();
      if (/^1$|cắt|\bhaircut\b|\bcut\b/.test(t)) return 'Cắt tóc';
      if (/^2$|nhuộm|\bcolor\b|colour/.test(t)) return 'Nhuộm tóc';
      if (/^3$|uốn|duỗi|\bperm\b|straighten/.test(t)) return 'Uốn / Duỗi';
      if (/^4$|keratin/.test(t)) return 'Keratin Treatment';
      if (/^5$|balayage|highlight/.test(t)) return 'Balayage / Highlights';
      if (/toner|toning/.test(t)) return 'Toner / Toning';
      return null;
    },

    destination: function(text) {
      var t = text.toLowerCase();
      if (/yosemite/.test(t)) return { id:'yosemite', name:'Yosemite National Park' };
      if (/\bvegas\b|las vegas/.test(t)) return { id:'lasvegas', name:'Las Vegas' };
      if (/san francisco|sf\b|frisco|golden gate|cầu vàng/.test(t)) return { id:'sanfrancisco', name:'San Francisco' };
      if (/napa valley|\bnapa\b/.test(t)) return { id:'napa', name:'Napa Valley' };
      if (/big sur/.test(t)) return { id:'bigsur', name:'Big Sur' };
      if (/monterey/.test(t)) return { id:'monterey', name:'Monterey' };
      if (/santa barbara/.test(t)) return { id:'santabarbara', name:'Santa Barbara' };
      if (/palm springs/.test(t)) return { id:'palmsprings', name:'Palm Springs' };
      if (/joshua tree/.test(t)) return { id:'joshuatree', name:'Joshua Tree' };
      if (/grand canyon/.test(t)) return { id:'grandcanyon', name:'Grand Canyon' };
      if (/san diego/.test(t)) return { id:'sandiego', name:'San Diego' };
      if (/los angeles|\bla\b/.test(t)) return { id:'losangeles', name:'Los Angeles' };
      if (/17.?mile|pebble beach/.test(t)) return { id:'17mile', name:'17-Mile Drive' };
      if (/\bsolvang\b/.test(t)) return { id:'solvang', name:'Solvang' };
      if (/sequoia|kings canyon/.test(t)) return { id:'sequoia', name:'Sequoia / Kings Canyon' };
      if (/disneyland/.test(t)) return { id:'disneyland', name:'Disneyland' };
      return null;
    },

    lodging: function(text) {
      var t = text.toLowerCase();
      if (/\b(không cần|tự túc|none|no lodging|self.?book|tôi tự đặt)\b/.test(t)) return 'none';
      if (/^(không|no)$/i.test(t.trim())) return 'none';
      if (/\b(airbnb|nhà thuê|house rental|home rental|thuê nhà)\b/.test(t)) return 'airbnb';
      // Strip / casino / resort → hotel
      if (/\b(strip|the strip|on the strip|vegas strip|casino|resort)\b/.test(t)) return 'hotel';
      if (/\b(hotel|khách sạn|motel|lodge|inn|hostel)\b/.test(t)) return 'hotel';
      if (/\b(4[\s-]?star|5[\s-]?star|four[\s-]?star|five[\s-]?star|luxury|sang trọng|cao cấp|budget hotel)\b/.test(t)) return 'hotel';
      if (/\b(cần\b|need|muốn|có\b|yes\b|chỗ ở|chỗ ngủ|overnight|stay)\b/.test(t)) return 'hotel';
      return null;
    },

    hotelArea: function(text) {
      var t = text.toLowerCase();
      if (/\b(strip|the strip|on the strip|vegas strip|mid.?strip|south.?strip|north.?strip)\b/.test(t)) return 'strip';
      if (/\b(downtown|fremont|fremont street|old vegas)\b/.test(t)) return 'downtown';
      if (/\b(off.?strip|off the strip|henderson|summerlin)\b/.test(t)) return 'off_strip';
      if (/\b(near airport|airport area)\b/.test(t)) return 'airport';
      if (/\b(city center|union square|trung tâm|fisherman|wharf|pier)\b/.test(t)) return 'city_center';
      if (/\b(beach|biển|waterfront)\b/.test(t)) return 'beach';
      return null;
    },

    hotelBudget: function(text) {
      var t = text.toLowerCase();
      if (/\b(budget|cheap|affordable|rẻ|tiết kiệm|economy|value)\b/.test(t)) return 'budget';
      if (/\b(luxury|5[\s-]?star|five[\s-]?star|upscale|premium|sang trọng|cao cấp|vip)\b/.test(t)) return 'premium';
      if (/\b(mid.?range|moderate|trung bình|4[\s-]?star|four[\s-]?star|reasonable|decent|standard)\b/.test(t)) return 'midrange';
      var nums = (text.match(/\$\s*(\d+)/g)||[]).map(function(s){return parseInt(s.replace(/\D/g,''));});
      if (nums.length) {
        var avg = nums.reduce(function(a,b){return a+b;},0)/nums.length;
        return avg < 110 ? 'budget' : avg < 220 ? 'midrange' : 'premium';
      }
      return null;
    },

    bookingMode: function(text) {
      var t = text.toLowerCase();
      if (/\b(tự|myself|self|tôi tự|tự đặt|tự lo|book myself|tôi sẽ đặt)\b/.test(t)) return 'self';
      if (/\b(vendor|giúp|lo cho|handle|nhờ|book for me|du lịch cali lo|các bạn lo|hộ tôi)\b/.test(t)) return 'vendor';
      if (/\b(tôi chọn|chọn|i want|i choose|muốn ở)\b/.test(t)) return 'vendor';
      return null;
    },

    luggage: function(text) {
      var t = text.trim().toLowerCase();
      if (/^(0|không có|none|no|xách tay|không)$/.test(t)) return 0;
      var m = text.match(/(\d+)\s*(?:kiện|bag|bags|suitcase|vali|piece|chiếc)/i);
      if (!m) m = text.match(/^(\d+)$/);
      var n = m ? parseInt(m[1]) : NaN;
      return (isNaN(n) || n < 0 || n > 50) ? null : n;
    },

    terminal: function(text) {
      var t = text.trim();
      if (/không biết|bỏ qua|skip|chưa biết|chưa|không nhớ/i.test(t)) return '';
      if (/TBIT|Tom Bradley|international terminal/i.test(t)) return 'TBIT (Tom Bradley Intl)';
      var m = t.match(/\b(?:terminal|cổng|T)\s*([1-9][0-9]?|[A-E])\b/i);
      if (m) return 'Terminal ' + m[1].toUpperCase();
      if (/^T?[1-9][A-Z]?$/i.test(t)) return 'Terminal ' + t.toUpperCase().replace(/^T/, '');
      return null;
    },

    region: function(text) {
      var t = text.toLowerCase();
      if (/bay area|san jose|sjc|san francisco|sfo|oakland|fremont|santa clara|sunnyvale|milpitas|cupertino|palo alto/.test(t)) return 'Bay Area';
      if (/orange county|\boc\b|anaheim|irvine|garden grove|santa ana|westminster|fountain valley|los angeles|\bla\b|san diego|socal|southern/.test(t)) return 'Southern CA';
      if (/^1$/.test(t.trim())) return 'Bay Area';
      if (/^2$/.test(t.trim())) return 'Southern CA';
      return null;
    },
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // ── Correction Detection ───────────────────────────────────────────────────
  // Returns true when the message looks like the user is correcting a
  // previously supplied value rather than answering a new question.
  function isCorrectionText(text) {
    return /thay đổi|sửa lại|sửa thành|đổi thành|đổi lại|nhầm|lầm rồi|thực ra|actually|wait,?\s|change.*to|no[,.\s]|không phải|không là|là \d+ người|đổi.*người|đổi.*ngày|update|not \d|lại \d|nhóm \d+ người/i
           .test(text);
  }

  // ── Field label map (for correction acknowledgements) ─────────────────────
  var FIELD_LABELS = {
    passengers:     'Số người',
    requestedDate:  'Ngày',
    arrivalTime:    'Giờ đến',
    departureTime:  'Giờ đi',
    requestedTime:  'Giờ hẹn',
    airport:        'Sân bay',
    airline:        'Hãng bay',
    customerName:   'Tên',
    customerPhone:  'Điện thoại',
    dropoffAddress: 'Địa chỉ đến',
    pickupAddress:  'Điểm đón',
    address:        'Địa chỉ giao',
    quantity:       'Số lượng',
    serviceType:    'Dịch vụ',
    days:           'Số ngày',
    destination:    'Điểm đến',
    fulfillment:    'Hình thức nhận',
    variant:        'Loại',
    lodging:        'Chỗ ở',
  };

  function fmtFieldLabel(key) {
    return FIELD_LABELS[key] || key;
  }

  function fmtFieldVal(key, val) {
    if (val === null || val === undefined) return '—';
    if (key === 'requestedDate') return fmtDate(val);
    if (key === 'arrivalTime' || key === 'requestedTime' || key === 'departureTime') return fmtTime(val);
    if (typeof val === 'object' && val.name) return val.name;
    return String(val);
  }

  // ── Hotel Suggestion Data ──────────────────────────────────────────────────

  var HOTEL_SUGGESTIONS = {
    lasvegas: {
      strip: [
        { name:'Bellagio',          area:'Mid Strip',   budgetTier:'premium',  stars:5, priceFrom:180, priceTo:380, highlight:'Đài phun nước huyền thoại, sòng bạc sang trọng' },
        { name:'The Cosmopolitan',  area:'Mid Strip',   budgetTier:'premium',  stars:5, priceFrom:160, priceTo:350, highlight:'Thiết kế hiện đại, nhà hàng nổi tiếng' },
        { name:'MGM Grand',         area:'South Strip', budgetTier:'midrange', stars:4, priceFrom:90,  priceTo:220, highlight:'Casino lớn nhất Mỹ, đa dạng nhà hàng & show' },
        { name:'Paris Las Vegas',   area:'Mid Strip',   budgetTier:'midrange', stars:4, priceFrom:80,  priceTo:195, highlight:'Tháp Eiffel thu nhỏ, view The Strip đẹp' },
        { name:'New York-New York', area:'South Strip', budgetTier:'midrange', stars:4, priceFrom:70,  priceTo:165, highlight:'Roller coaster, nhiều show, không khí sôi động' },
        { name:'Excalibur Hotel',   area:'South Strip', budgetTier:'budget',   stars:3, priceFrom:45,  priceTo:120, highlight:'Thân thiện gia đình, vị trí tốt trên Strip' },
        { name:'Luxor Las Vegas',   area:'South Strip', budgetTier:'budget',   stars:3, priceFrom:50,  priceTo:130, highlight:'Thiết kế kim tự tháp độc đáo, giá hợp lý' },
      ],
      downtown: [
        { name:'Golden Nugget',     area:'Fremont St',  budgetTier:'midrange', stars:4, priceFrom:60,  priceTo:150, highlight:'Khách sạn nổi tiếng nhất Downtown Las Vegas' },
      ],
      off_strip: [
        { name:'Red Rock Casino Resort', area:'Summerlin', budgetTier:'midrange', stars:4, priceFrom:70, priceTo:160, highlight:'Gần Red Rock Canyon, yên tĩnh hơn Strip' },
      ],
    },
    sanfrancisco: {
      city_center: [
        { name:'Hotel Nikko SF',         area:'Union Square', budgetTier:'midrange', stars:4, priceFrom:140, priceTo:280, highlight:'Trung tâm thành phố, gần cửa hàng' },
        { name:'Marriott Union Square',  area:'Union Square', budgetTier:'premium',  stars:4, priceFrom:200, priceTo:400, highlight:'Gần cửa hàng, nhà hàng, giao thông thuận tiện' },
      ],
      beach: [
        { name:"Hyatt Fisherman's Wharf", area:"Fisherman's Wharf", budgetTier:'midrange', stars:4, priceFrom:160, priceTo:320, highlight:"Gần Fisherman's Wharf và Ghirardelli Square" },
      ],
    },
    yosemite: {
      city_center: [
        { name:'Yosemite Valley Lodge', area:'Yosemite Valley', budgetTier:'midrange', stars:3, priceFrom:180, priceTo:325, highlight:'Ngay trong công viên, gần Yosemite Falls' },
        { name:'Tenaya Lodge',          area:'Fish Camp',       budgetTier:'premium',  stars:4, priceFrom:220, priceTo:450, highlight:'Resort cao cấp, gần lối vào phía Nam' },
      ],
    },
    grandcanyon: {
      city_center: [
        { name:'El Tovar Hotel',        area:'South Rim',       budgetTier:'premium',  stars:4, priceFrom:200, priceTo:350, highlight:'Khách sạn lịch sử ngay tại vành miệng' },
        { name:'Bright Angel Lodge',    area:'South Rim',       budgetTier:'budget',   stars:3, priceFrom:80,  priceTo:160, highlight:'Cạnh bờ vực, hướng tới đoàn hiking' },
      ],
    },
  };

  function getHotelSuggestions(destId, area, budgetTier) {
    var dest = destId && HOTEL_SUGGESTIONS[destId];
    if (!dest) return [];
    var hotels = [];
    if (area && dest[area]) {
      hotels = dest[area].slice();
    } else {
      var keys = Object.keys(dest);
      for (var i = 0; i < keys.length; i++) hotels = hotels.concat(dest[keys[i]]);
    }
    if (budgetTier) {
      var filtered = hotels.filter(function(h){ return h.budgetTier === budgetTier; });
      if (filtered.length > 0) hotels = filtered;
    }
    return hotels.slice(0, 5);
  }

  // ── Rough estimate helpers ─────────────────────────────────────────────────

  function estimateTransfer(passengers, airport) {
    if (!passengers) return null;
    if (typeof DLCPricing !== 'undefined' && DLCPricing.estimateTransfer) {
      var r = DLCPricing.estimateTransfer({ airport: airport||'LAX', fromCity: 'Orange County', passengers: passengers, direction: 'pickup' });
      return r ? '~$' + r.total + ' (' + r.vehicle + ')' : null;
    }
    var base = passengers <= 4 ? 65 : passengers <= 7 ? 85 : 110;
    return '~$' + base + '–$' + (base + 25) + ' (ước tính sơ bộ)';
  }

  function estimateTour(passengers, days, destId) {
    if (!passengers || !days) return null;
    if (typeof DLCPricing !== 'undefined' && DLCPricing.estimateTour) {
      var r = DLCPricing.estimateTour({ destId: destId||'lasvegas', passengers: passengers, days: days, lodging: null });
      return r ? '~$' + r.total + ' (~$' + r.perPerson + '/người · ' + r.vehicle + ')' : null;
    }
    return null;
  }

  // Returns Uber comparison pricing for a private ride (A→B, no airport)
  function estimateRide(passengers, fromCity, toCity) {
    var p = Math.max(1, passengers || 2);
    if (typeof DLCPricing !== 'undefined') {
      // Try to look up distance using fromCity/toCity in pricing tables
      var r = DLCPricing.estimateTransfer({ fromCity: fromCity || '', airport: toCity || '', passengers: p, direction: 'dropoff' });
      if (r && r.miles) {
        var cmp = DLCPricing.transferCostWithComparison(r.miles, p);
        return {
          ourPrice: cmp.ourPrice,
          uberEst:  cmp.uberEstimate,
          savings:  cmp.savings,
          vehicle:  DLCPricing.getVehicle ? DLCPricing.getVehicle(p) : (p > 3 ? 'Mercedes Van' : 'Tesla Model Y'),
          miles:    r.miles,
          approx:   false,
        };
      }
    }
    // Fallback rough estimate based on passenger count
    var isVan   = p > 3;
    var minFare = isVan ? 120 : 100;
    var uberEst = Math.round(minFare / 0.8);
    return {
      ourPrice: minFare,
      uberEst:  uberEst,
      savings:  uberEst - minFare,
      vehicle:  isVan ? 'Mercedes Van' : 'Tesla Model Y',
      approx:   true,
    };
  }

  // ── Maps & Address Helpers ─────────────────────────────────────────────────

  function buildMapsLink(address) {
    if (!address) return null;
    return 'https://maps.google.com/?q=' + encodeURIComponent(address);
  }

  var AIRPORT_LOCATIONS = {
    LAX: { name:'Los Angeles International Airport', address:'1 World Way, Los Angeles, CA 90045' },
    SNA: { name:'John Wayne Airport',                address:'18601 Airport Way, Santa Ana, CA 92707' },
    ONT: { name:'Ontario International Airport',     address:'2900 E Airport Dr, Ontario, CA 91761' },
    BUR: { name:'Hollywood Burbank Airport',         address:'2627 N Hollywood Way, Burbank, CA 91505' },
    LGB: { name:'Long Beach Airport',                address:'4100 Donald Douglas Dr, Long Beach, CA 90808' },
    SFO: { name:'San Francisco International Airport', address:'San Francisco, CA 94128' },
    SJC: { name:'San Jose International Airport',    address:'1701 Airport Blvd, San Jose, CA 95110' },
    OAK: { name:'Oakland International Airport',     address:'1 Airport Dr, Oakland, CA 94621' },
    PSP: { name:'Palm Springs International Airport', address:'3400 E Tahquitz Canyon Way, Palm Springs, CA 92262' },
    SAN: { name:'San Diego International Airport',   address:'3225 N Harbor Dr, San Diego, CA 92101' },
    SMF: { name:'Sacramento International Airport',  address:'6900 Airport Blvd, Sacramento, CA 95837' },
  };

  function buildAirportMapsLink(airportCode, terminal) {
    var ap = AIRPORT_LOCATIONS[airportCode];
    if (!ap) return null;
    var query = terminal ? ap.name + ' ' + terminal : ap.name;
    return 'https://maps.google.com/?q=' + encodeURIComponent(query);
  }

  // ── Workflow Definitions ───────────────────────────────────────────────────

  var WORKFLOWS = {

    food_order: {
      label: 'Đặt Món Ăn',
      intro: '🥟 Tôi sẽ giúp bạn đặt món. Gõ "hủy" bất cứ lúc nào để thoát.\n',
      detectKeywords: /(?:\border\b|đặt\s*(?:mua\s*|hàng\s*)?(?:\d+\s*)?|muốn\s+(?:đặt|mua|order)|can\s+i\s+(?:order|get)|i\s+(?:want|need)\s+to|cho\s+(?:tôi|mình)|i'd\s+like)\s*\d*\s*(?:a\s+)?(?:tray\s+of\s+)?(?:egg.?roll|chả\s*giò|cha\s*gio|chuối\s*đậu|chuoi\s*dau|ốc\b|snail|bún\s*chả|bun\s*cha|bún\s*đậu|bun\s*dau|phở|pho\b)|\b(?:egg.?roll|chả\s*giò|cha\s*gio|bún\s*chả|bun\s*cha|phở\s*bắc|pho\s*bac|chuối\s*đậu)\b.*\b(?:order|đặt|mua|\d+\s*(?:cuốn|phần|tô|piece|tray))\b/i,
      fields: [
        {
          key: 'item',
          question: function() { return 'Bạn muốn đặt món gì?\n(VD: Chả Giò, Chuối Đậu Nấu Ốc)'; },
          extract: function(t) { return X.foodItem(t); },
          optional: false,
        },
        {
          key: 'quantity',
          question: function(f) {
            var item = f.item || {};
            return 'Bạn muốn đặt bao nhiêu ' + (item.unit||'cái') + '?' +
              (item.minOrder ? ' (Tối thiểu: ' + item.minOrder + ' ' + item.unit + ')' : '');
          },
          extract: function(t) { return X.quantity(t); },
          optional: false,
          validate: function(v, f) {
            var min = (f.item||{}).minOrder || 1;
            if (v < min) return '❗ Đơn tối thiểu là ' + min + ' ' + ((f.item||{}).unit||'cái') + '. Bạn muốn đặt ' + min + ' không?';
            return null;
          },
        },
        {
          key: 'variant',
          question: function(f) {
            var item = f.item || {};
            if (!item.hasVariant) return null;
            return item.variantQuestion || ('Bạn muốn chọn loại nào?\n• ' + (item.variantOptions || ''));
          },
          extract: function(t) { return X.foodVariant(t); },
          optional: function(f) { return !(f.item && f.item.hasVariant); },
          showIf: function(f) { return !!(f.item && f.item.hasVariant); },
        },
        {
          key: 'fulfillment',
          question: function() { return 'Bạn muốn tự đến lấy (pickup) hay giao hàng tận nơi (delivery)?'; },
          extract: function(t) { return X.fulfillment(t); },
          optional: false,
        },
        {
          key: 'requestedDate',
          question: function() { return 'Bạn muốn nhận vào ngày nào?\n(VD: thứ Bảy, 15/4, "ngày mai")'; },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'requestedTime',
          question: function() { return 'Mấy giờ bạn muốn lấy/nhận?\n(VD: 2pm, 14:00)'; },
          extract: function(t) { return X.time(t); },
          optional: false,
        },
        {
          key: 'customerName',
          question: function() { return 'Tên của bạn là gì?'; },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return 'Số điện thoại liên lạc?'; },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'address',
          question: function() { return 'Địa chỉ giao hàng của bạn?'; },
          extract: function(t) { return X.address(t); },
          optional: false,
          showIf: function(f) { return f.fulfillment === 'delivery'; },
        },
        {
          key: 'notes',
          question: function() { return 'Có yêu cầu đặc biệt nào không? (Gõ "không" nếu không có)'; },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var item = f.item || {};
        // Use variant price if available, else base price
        var unitPrice = item.price || 0;
        var sub = (unitPrice * (f.quantity||0)).toFixed(2);
        var lines = [
          '📋 Tóm tắt đơn hàng:',
          item.vendorName ? '• Nhà hàng:  ' + item.vendorName : null,
          '• Món:       ' + (item.name||''),
          '• Số lượng:  ' + f.quantity + ' ' + (item.unit||'cái'),
          f.variant ? '• Loại:      ' + f.variant : null,
          '• Nhận hàng: ' + (f.fulfillment==='delivery' ? 'Giao hàng tận nơi' : 'Tự đến lấy'),
          f.address  ? '• Địa chỉ:   ' + f.address : null,
          '• Ngày:      ' + fmtDate(f.requestedDate),
          '• Giờ:       ' + fmtTime(f.requestedTime),
          '• Tên:       ' + (f.customerName||''),
          '• SĐT:       ' + fmtPhone(f.customerPhone),
          f.notes    ? '• Ghi chú:   ' + f.notes : null,
          '',
          unitPrice > 0 ? '💰 Tổng: $' + sub + ' (' + f.quantity + ' × $' + unitPrice + '/' + (item.unit||'cái') + ')' : null,
        ];
        return lines.filter(function(v) { return v !== null; }).join('\n');
      },
    },

    airport_pickup: {
      label: 'Đón Tại Sân Bay',
      intro: '✈️ Tôi sẽ giúp bạn đặt dịch vụ đón sân bay. Gõ "hủy" để thoát.\n',
      detectKeywords: /pick.?up.*airport|airport.*pick.?up|đón.*sân bay|sân bay.*đón|từ.*sân bay|bay về|bay đến|cần đón.*sân bay/i,
      fields: [
        {
          key: 'airport',
          question: function() {
            var hint = '';
            if (window.DLCLocation && DLCLocation.state && DLCLocation.state.lat) {
              var near = DLCLocation.nearestAirports(2).map(function(a) { return a.code; }).join(', ');
              hint = '\n(Gần bạn nhất: ' + near + ')';
            }
            return '✈️ Bạn đến sân bay nào?' + hint + '\n(LAX · SNA · ONT · BUR · SFO · SJC · OAK...)';
          },
          extract: function(t) { return X.airport(t); },
          optional: false,
        },
        {
          key: 'airline',
          question: function() { return 'Hãng bay và số hiệu chuyến? (VD: United 714)\nGõ "bỏ qua" nếu chưa có.'; },
          extract: function(t) {
            if (/bỏ qua|skip|chưa|không biết/i.test(t)) return '';
            var m = t.match(/[A-Z]{2,3}\s*\d{2,4}/i);
            return m ? m[0].trim() : (t.trim().length >= 2 ? t.trim().slice(0,40) : null);
          },
          optional: true,
        },
        {
          key: 'requestedDate',
          question: function() { return 'Ngày đến? (VD: 15/4, thứ Sáu)'; },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'arrivalTime',
          question: function() { return 'Giờ máy bay hạ cánh? (VD: 2:30 PM, 14:30)'; },
          extract: function(t) { return X.time(t); },
          optional: false,
        },
        {
          key: 'passengers',
          question: function() { return 'Có bao nhiêu hành khách?'; },
          extract: function(t) { return X.passengers(t) || X.quantity(t); },
          optional: false,
        },
        {
          key: 'terminal',
          question: function() { return 'Cổng/Terminal bạn đến? (VD: Terminal 4, TBIT)\nGõ "không biết" nếu chưa rõ.'; },
          extract: function(t) { return X.terminal(t); },
          optional: true,
        },
        {
          key: 'luggageCount',
          question: function() { return 'Có bao nhiêu kiện hành lý ký gửi? (Gõ "0" nếu chỉ xách tay)'; },
          extract: function(t) { return X.luggage(t); },
          optional: true,
        },
        {
          key: 'dropoffAddress',
          question: function() {
            var hint = '';
            if (window.DLCLocation && DLCLocation.pickupHint()) {
              hint = '\n(Vị trí hiện tại: ' + DLCLocation.pickupHint() + ' — gõ "đây" để dùng)';
            }
            return 'Địa chỉ điểm đến sau sân bay?' + hint + '\n(thành phố hoặc địa chỉ cụ thể)';
          },
          extract: function(t) {
            if (/\bđây\b|\bhere\b|chỗ tôi|vị trí.*tôi|current.?loc/i.test(t)) {
              var loc = window.DLCLocation && DLCLocation.pickupHint();
              if (loc) return loc;
            }
            return X.address(t) || (t.trim().length >= 3 ? t.trim() : null);
          },
          optional: false,
        },
        {
          key: 'customerName',
          question: function() { return 'Tên hành khách chính?'; },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return 'Số điện thoại liên lạc?'; },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'notes',
          question: function() { return 'Yêu cầu đặc biệt?\n(Gõ "không" nếu không có)'; },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var est = estimateTransfer(f.passengers, f.airport);
        var lines = [
          '📋 Tóm tắt đặt đón sân bay:',
          '• Sân bay:      ' + (f.airport||''),
          f.terminal      ? '• Terminal:     ' + f.terminal : null,
          f.airline       ? '• Chuyến bay:   ' + f.airline : null,
          '• Ngày đến:     ' + fmtDate(f.requestedDate),
          '• Giờ hạ cánh:  ' + fmtTime(f.arrivalTime),
          '• Hành khách:   ' + (f.passengers||'') + ' người',
          f.luggageCount !== undefined && f.luggageCount !== null
            ? '• Hành lý:      ' + (f.luggageCount === 0 ? 'Xách tay (không ký gửi)' : f.luggageCount + ' kiện') : null,
          '• Điểm đến:     ' + (f.dropoffAddress||''),
          '• Tên:          ' + (f.customerName||''),
          '• SĐT:          ' + fmtPhone(f.customerPhone),
          f.notes         ? '• Ghi chú:      ' + f.notes : null,
          '',
          est             ? '💰 Ước tính: ' + est : null,
          '⏱ Tài xế chờ tại cửa Arrivals/Baggage Claim.',
        ];
        return lines.filter(function(v) { return v !== null; }).join('\n');
      },
    },

    airport_dropoff: {
      label: 'Ra Sân Bay',
      intro: '✈️ Tôi sẽ giúp bạn đặt dịch vụ đưa ra sân bay. Gõ "hủy" để thoát.\n',
      detectKeywords: /drop.?off.*airport|airport.*drop.?off|đưa.*sân bay|ra sân bay|đi airport|đi sân bay|cần xe ra sân bay/i,
      fields: [
        {
          key: 'airport',
          question: function() {
            var hint = '';
            if (window.DLCLocation && DLCLocation.state && DLCLocation.state.lat) {
              var near = DLCLocation.nearestAirports(2).map(function(a) { return a.code; }).join(', ');
              hint = '\n(Gần bạn nhất: ' + near + ')';
            }
            return '✈️ Bạn cần đưa tới sân bay nào?' + hint + '\n(LAX · SNA · ONT · BUR · SFO · SJC · OAK...)';
          },
          extract: function(t) { return X.airport(t); },
          optional: false,
        },
        {
          key: 'airline',
          question: function() { return 'Hãng bay và số hiệu chuyến? (Gõ "bỏ qua" nếu chưa có)'; },
          extract: function(t) {
            if (/bỏ qua|skip|chưa|không biết/i.test(t)) return '';
            var m = t.match(/[A-Z]{2,3}\s*\d{2,4}/i);
            return m ? m[0].trim() : (t.trim().length >= 2 ? t.trim().slice(0,40) : null);
          },
          optional: true,
        },
        {
          key: 'requestedDate',
          question: function() { return 'Ngày bay? (VD: 20/4, thứ Hai)'; },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'departureTime',
          question: function() { return 'Giờ máy bay cất cánh? (VD: 6:00 AM)'; },
          extract: function(t) { return X.time(t); },
          optional: false,
        },
        {
          key: 'pickupAddress',
          question: function() {
            var hint = '';
            if (window.DLCLocation && DLCLocation.pickupHint()) {
              hint = '\n(Vị trí hiện tại: ' + DLCLocation.pickupHint() + ' — gõ "đây" để dùng)';
            }
            return 'Địa chỉ đón bạn (điểm xuất phát)?' + hint;
          },
          extract: function(t) {
            if (/\bđây\b|\bhere\b|chỗ tôi|vị trí.*tôi|current.?loc/i.test(t)) {
              var loc = window.DLCLocation && DLCLocation.pickupHint();
              if (loc) return loc;
            }
            return X.address(t) || (t.trim().length >= 3 ? t.trim() : null);
          },
          optional: false,
        },
        {
          key: 'passengers',
          question: function() { return 'Có bao nhiêu hành khách?'; },
          extract: function(t) { return X.passengers(t) || X.quantity(t); },
          optional: false,
        },
        {
          key: 'terminal',
          question: function() { return 'Cổng/Terminal cần đến? (VD: Terminal 2, TBIT)\nGõ "không biết" nếu chưa rõ.'; },
          extract: function(t) { return X.terminal(t); },
          optional: true,
        },
        {
          key: 'luggageCount',
          question: function() { return 'Có bao nhiêu kiện hành lý ký gửi? (Gõ "0" nếu chỉ xách tay)'; },
          extract: function(t) { return X.luggage(t); },
          optional: true,
        },
        {
          key: 'customerName',
          question: function() { return 'Tên hành khách chính?'; },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return 'Số điện thoại liên lạc?'; },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'notes',
          question: function() { return 'Yêu cầu đặc biệt?\n(Gõ "không" nếu không có)'; },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var est = estimateTransfer(f.passengers, f.airport);
        var lines = [
          '📋 Tóm tắt đặt ra sân bay:',
          '• Sân bay:      ' + (f.airport||''),
          f.terminal      ? '• Terminal:     ' + f.terminal : null,
          f.airline       ? '• Chuyến bay:   ' + f.airline : null,
          '• Ngày bay:     ' + fmtDate(f.requestedDate),
          '• Giờ cất cánh: ' + fmtTime(f.departureTime),
          '• Điểm đón:     ' + (f.pickupAddress||''),
          '• Hành khách:   ' + (f.passengers||'') + ' người',
          f.luggageCount !== undefined && f.luggageCount !== null
            ? '• Hành lý:      ' + (f.luggageCount === 0 ? 'Xách tay (không ký gửi)' : f.luggageCount + ' kiện') : null,
          '• Tên:          ' + (f.customerName||''),
          '• SĐT:          ' + fmtPhone(f.customerPhone),
          f.notes         ? '• Ghi chú:      ' + f.notes : null,
          '',
          est             ? '💰 Ước tính: ' + est : null,
        ];
        return lines.filter(function(v) { return v !== null; }).join('\n');
      },
    },

    private_ride: {
      label: 'Xe Riêng Cao Cấp',
      intro: '🚗 Tôi sẽ giúp bạn đặt xe riêng cao cấp. Gõ "hủy" bất cứ lúc nào để thoát.\n',
      detectKeywords: /\bxe riêng\b|private.?ride|luxury.?ride|đặt xe.*điểm|thuê xe điểm đến/i,
      fields: [
        {
          key: 'pickupAddress',
          question: function() {
            var hint = '';
            if (window.DLCLocation && DLCLocation.pickupHint()) {
              hint = '\n(Vị trí hiện tại: ' + DLCLocation.pickupHint() + ' — gõ "đây" để dùng)';
            }
            return '📍 Địa chỉ đón bạn?' + hint + '\n(Thành phố hoặc địa chỉ cụ thể — VD: San Jose, 1234 Main St, Orange County...)';
          },
          extract: function(t) {
            if (/\bđây\b|\bhere\b|chỗ tôi|vị trí.*tôi|current.?loc/i.test(t)) {
              var loc = window.DLCLocation && DLCLocation.pickupHint();
              if (loc) return loc;
            }
            return X.address(t) || (t.trim().length >= 3 ? t.trim() : null);
          },
          optional: false,
        },
        {
          key: 'dropoffAddress',
          question: function() { return '🏁 Điểm đến của bạn?\n(Thành phố hoặc địa chỉ cụ thể)'; },
          extract: function(t) { return X.address(t) || (t.trim().length >= 3 ? t.trim() : null); },
          optional: false,
        },
        {
          key: 'requestedDate',
          question: function() { return 'Ngày đi? (VD: 15/4, thứ Sáu, ngày mai)'; },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'requestedTime',
          question: function() { return 'Mấy giờ xuất phát? (VD: 9:00 AM, 14:30)'; },
          extract: function(t) { return X.time(t); },
          optional: false,
        },
        {
          key: 'passengers',
          question: function() { return 'Có bao nhiêu hành khách?'; },
          extract: function(t) { return X.passengers(t) || X.quantity(t); },
          optional: false,
        },
        {
          key: 'customerName',
          question: function() { return 'Tên của bạn?'; },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return 'Số điện thoại liên lạc?'; },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'notes',
          question: function() { return 'Yêu cầu đặc biệt?\n(Gõ "không" nếu không có)'; },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var est = estimateRide(f.passengers, f.pickupAddress, f.dropoffAddress);
        var lines = [
          '📋 Tóm tắt đặt xe riêng cao cấp:',
          '• Điểm đón:   ' + (f.pickupAddress || ''),
          '• Điểm đến:   ' + (f.dropoffAddress || ''),
          '• Ngày:       ' + fmtDate(f.requestedDate),
          '• Giờ:        ' + fmtTime(f.requestedTime),
          '• Hành khách: ' + (f.passengers || '') + ' người',
          '• Tên:        ' + (f.customerName || ''),
          '• SĐT:        ' + fmtPhone(f.customerPhone),
          f.notes ? '• Ghi chú:    ' + f.notes : null,
          '',
        ];
        if (est) {
          lines.push('💰 So sánh giá (' + est.vehicle + '):');
          lines.push('   Uber/Lyft ước tính: ~$' + est.uberEst);
          lines.push('   DuLịchCali (-20%):  ~$' + est.ourPrice + '  ← tiết kiệm ~$' + est.savings);
          if (est.approx) lines.push('   ⚠️ Giá sơ bộ — đội sẽ xác nhận sau khi đặt.');
        }
        return lines.filter(function(v) { return v !== null; }).join('\n');
      },
    },

    nail_appointment: {
      label: 'Đặt Lịch Nail',
      intro: '💅 Tôi sẽ giúp bạn đặt lịch nail. Gõ "hủy" để thoát.\n',
      detectKeywords: /\b(?:đặt\s+)?(?:lịch\s+)?(?:nail|manicure|pedicure|gel nail|acrylic|dip powder|mani\b|pedi\b)\b|đặt.*nail|tiệm nail/i,
      fields: [
        {
          key: 'serviceType',
          question: function() {
            return 'Bạn muốn làm dịch vụ gì?\n1. Manicure (móng tay)\n2. Pedicure (móng chân)\n3. Gel Nails\n4. Acrylic\n5. Full Set\n(hoặc Mani+Pedi, Dip Powder...)';
          },
          extract: function(t) { return X.nailService(t); },
          optional: false,
        },
        {
          key: 'region',
          question: function() { return 'Bạn ở khu vực nào tại California?'; },
          extract: function(t) { return X.region(t); },
          optional: true,
          chips: function() {
            return [
              { label: '🌉 Bay Area (San Jose / SF)',   value: 'Bay Area' },
              { label: '☀️ Southern CA (OC / LA)',      value: 'Southern CA' },
            ];
          },
        },
        {
          key: 'requestedDate',
          question: function() { return 'Ngày nào bạn muốn hẹn?'; },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'requestedTime',
          question: function() { return 'Giờ nào? (VD: 10am, 2:30pm)'; },
          extract: function(t) { return X.time(t); },
          optional: false,
        },
        {
          key: 'customerName',
          question: function() { return 'Tên của bạn?'; },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return 'Số điện thoại liên lạc?'; },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'notes',
          question: function() { return 'Màu sắc, kiểu nail, hoặc yêu cầu đặc biệt?\n(Gõ "không" nếu không có)'; },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        return [
          '📋 Tóm tắt lịch hẹn nail:',
          '• Dịch vụ:   ' + (f.serviceType||''),
          f.region    ? '• Khu vực:   ' + f.region : null,
          '• Ngày:      ' + fmtDate(f.requestedDate),
          '• Giờ:       ' + fmtTime(f.requestedTime),
          '• Tên:       ' + (f.customerName||''),
          '• SĐT:       ' + fmtPhone(f.customerPhone),
          f.notes     ? '• Yêu cầu:   ' + f.notes : null,
        ].filter(function(v) { return v !== null; }).join('\n');
      },
    },

    hair_appointment: {
      label: 'Đặt Lịch Tóc',
      intro: '✂️ Tôi sẽ giúp bạn đặt lịch làm tóc. Gõ "hủy" để thoát.\n',
      detectKeywords: /\b(?:đặt\s+)?(?:lịch\s+)?(?:cắt tóc|nhuộm tóc|hair salon|tiệm tóc|keratin|balayage|uốn tóc|duỗi tóc|haircut|hair cut|hair color)\b|đặt.*tóc/i,
      fields: [
        {
          key: 'serviceType',
          question: function() {
            return 'Bạn muốn làm gì?\n1. Cắt tóc\n2. Nhuộm tóc\n3. Uốn / Duỗi\n4. Keratin Treatment\n5. Balayage / Highlights';
          },
          extract: function(t) { return X.hairService(t); },
          optional: false,
        },
        {
          key: 'region',
          question: function() { return 'Bạn ở khu vực nào tại California?'; },
          extract: function(t) { return X.region(t); },
          optional: true,
          chips: function() {
            return [
              { label: '🌉 Bay Area (San Jose / SF)',   value: 'Bay Area' },
              { label: '☀️ Southern CA (OC / LA)',      value: 'Southern CA' },
            ];
          },
        },
        {
          key: 'requestedDate',
          question: function() { return 'Ngày nào bạn muốn hẹn?'; },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'requestedTime',
          question: function() { return 'Giờ nào? (VD: 10am, 2:30pm)'; },
          extract: function(t) { return X.time(t); },
          optional: false,
        },
        {
          key: 'customerName',
          question: function() { return 'Tên của bạn?'; },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return 'Số điện thoại liên lạc?'; },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'notes',
          question: function() { return 'Kiểu tóc, màu muốn nhuộm, hoặc yêu cầu đặc biệt?\n(Gõ "không" nếu không có)'; },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        return [
          '📋 Tóm tắt lịch hẹn tóc:',
          '• Dịch vụ:   ' + (f.serviceType||''),
          f.region    ? '• Khu vực:   ' + f.region : null,
          '• Ngày:      ' + fmtDate(f.requestedDate),
          '• Giờ:       ' + fmtTime(f.requestedTime),
          '• Tên:       ' + (f.customerName||''),
          '• SĐT:       ' + fmtPhone(f.customerPhone),
          f.notes     ? '• Yêu cầu:   ' + f.notes : null,
        ].filter(function(v) { return v !== null; }).join('\n');
      },
    },

    tour_request: {
      label: 'Đặt Tour Du Lịch',
      intro: '🗺️ Tôi sẽ giúp bạn lên kế hoạch tour. Gõ "hủy" để thoát.\n',
      detectKeywords: /\b(?:đặt\s+)?tour\b.*\b(?:yosemite|vegas|las vegas|san francisco|napa|big sur|monterey|santa barbara|palm springs|joshua tree|grand canyon|san diego|sequoia|solvang|disneyland|17.?mile)\b|\b(?:yosemite|las vegas|grand canyon)\b.*\b(?:tour|đặt|đi|chuyến)\b/i,
      fields: [
        {
          key: 'destination',
          question: function() {
            return '🗺️ Bạn muốn đi đâu?\n(Las Vegas · Yosemite · San Francisco · Napa · Big Sur · Grand Canyon...)';
          },
          extract: function(t) { return X.destination(t); },
          optional: false,
        },
        {
          key: 'requestedDate',
          question: function() { return 'Ngày khởi hành dự kiến?'; },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'days',
          question: function() { return 'Chuyến đi bao nhiêu ngày?'; },
          extract: function(t) { return X.days(t); },
          optional: false,
        },
        {
          key: 'passengers',
          question: function() { return 'Nhóm bạn có bao nhiêu người?'; },
          extract: function(t) { return X.passengers(t) || X.quantity(t); },
          optional: false,
        },
        {
          key: 'startingPoint',
          question: function() { return 'Điểm xuất phát của bạn ở đâu?\n(thành phố hoặc địa chỉ)'; },
          extract: function(t) { return t.trim().length >= 2 ? t.trim() : null; },
          optional: false,
        },
        {
          key: 'lodging',
          question: function() {
            return 'Bạn có cần hỗ trợ chỗ ở không?';
          },
          extract: function(t) { return X.lodging(t); },
          optional: true,
          chips: function() {
            return [
              { label: '🏨 Có, cần khách sạn', value: 'hotel' },
              { label: '🏠 Airbnb / Nhà thuê',  value: 'airbnb' },
              { label: '✅ Không cần (tự túc)', value: 'không cần chỗ ở' },
            ];
          },
        },
        {
          key: 'hotelArea',
          question: function(f) {
            var dest = typeof f.destination === 'object' ? f.destination.id : '';
            if (dest === 'lasvegas') return 'Bạn muốn ở khu vực nào tại Las Vegas?';
            if (dest === 'sanfrancisco') return 'Bạn muốn ở khu vực nào tại San Francisco?';
            return 'Bạn muốn ở khu vực nào?';
          },
          extract: function(t) { return X.hotelArea(t); },
          optional: function(f) {
            var dest = typeof f.destination === 'object' ? f.destination.id : '';
            return f.lodging !== 'hotel' || !HOTEL_SUGGESTIONS[dest];
          },
          showIf: function(f) {
            var dest = typeof f.destination === 'object' ? f.destination.id : '';
            return f.lodging === 'hotel' && !!HOTEL_SUGGESTIONS[dest];
          },
          chips: function(f) {
            var dest = typeof f.destination === 'object' ? f.destination.id : '';
            if (dest === 'lasvegas') return [
              { label: '✨ The Strip',              value: 'strip' },
              { label: '🏙️ Downtown (Fremont St)',  value: 'downtown' },
              { label: '🏷️ Off Strip (rẻ hơn)',    value: 'off_strip' },
            ];
            if (dest === 'sanfrancisco') return [
              { label: '🏙️ City Center',            value: 'city_center' },
              { label: "🐟 Fisherman's Wharf",      value: 'beach' },
            ];
            return null;
          },
        },
        {
          key: 'hotelBudget',
          question: function() { return 'Ngân sách khách sạn mỗi đêm?'; },
          extract: function(t) { return X.hotelBudget(t); },
          optional: function(f) { return f.lodging !== 'hotel'; },
          showIf: function(f) { return f.lodging === 'hotel'; },
          chips: function() {
            return [
              { label: '💰 Tiết kiệm (~$50-120/đêm)',  value: 'budget' },
              { label: '⭐ Tầm trung (~$120-220/đêm)', value: 'midrange' },
              { label: '✨ Cao cấp ($220+/đêm)',        value: 'premium' },
              { label: 'Không có sở thích đặc biệt',   value: 'midrange' },
            ];
          },
        },
        {
          key: 'bookingMode',
          question: function() {
            return 'Bạn muốn tự đặt khách sạn, hay nhờ Du Lịch Cali hỗ trợ đặt giúp?';
          },
          extract: function(t) { return X.bookingMode(t); },
          optional: function(f) { return f.lodging !== 'hotel'; },
          showIf: function(f) { return f.lodging === 'hotel'; },
          chips: function() {
            return [
              { label: '🤝 Du Lịch Cali lo giúp tôi',   value: 'vendor' },
              { label: '🔗 Tôi tự đặt (cần gợi ý link)', value: 'self' },
            ];
          },
        },
        {
          key: 'chosenHotel',
          question: null,
          extract: function(t) {
            var m = t.match(/(?:muốn ở|chọn|ở|stay at|book)\s+([A-Za-zÀ-ỹ\s\-&'The]+?)(?:,|\s*nhờ|\s*và|\s*$)/i);
            if (m && m[1] && m[1].trim().length >= 3) return m[1].trim().slice(0,60);
            return null;
          },
          optional: true,
          showIf: function(f) { return f.lodging === 'hotel'; },
        },
        {
          key: 'customerName',
          question: function() { return 'Tên liên lạc chính?'; },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return 'Số điện thoại liên lạc?'; },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'notes',
          question: function() { return 'Yêu cầu đặc biệt?\n(Gõ "không" nếu không có)'; },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var dest = typeof f.destination === 'object' ? f.destination.name : (f.destination||'');
        var destId = typeof f.destination === 'object' ? f.destination.id : '';
        var est = estimateTour(f.passengers, f.days, destId);
        var lodgeLabel = { hotel:'Khách sạn', airbnb:'Airbnb', none:'Tự túc' }[f.lodging] || (f.lodging||'');
        var areaLabel  = { strip:'The Strip', downtown:'Downtown', off_strip:'Off Strip', city_center:'City Center', beach:'Near Beach', airport:'Near Airport' }[f.hotelArea] || (f.hotelArea||'');
        var budgLabel  = { budget:'Tiết kiệm', midrange:'Tầm trung', premium:'Cao cấp' }[f.hotelBudget] || (f.hotelBudget||'');
        var modeLabel  = f.bookingMode === 'vendor' ? 'Du Lịch Cali hỗ trợ đặt' : f.bookingMode === 'self' ? 'Tự đặt' : '';
        var lines = [
          '📋 Tóm tắt yêu cầu tour:',
          '• Điểm đến:  ' + dest,
          '• Ngày đi:   ' + fmtDate(f.requestedDate),
          '• Số ngày:   ' + (f.days||'') + ' ngày',
          '• Số người:  ' + (f.passengers||'') + ' người',
          '• Xuất phát: ' + (f.startingPoint||''),
          lodgeLabel                      ? '• Chỗ ở:     ' + lodgeLabel  : null,
          f.chosenHotel                   ? '  Khách sạn: ' + f.chosenHotel : null,
          areaLabel && !f.chosenHotel     ? '  Khu vực:   ' + areaLabel   : null,
          budgLabel && !f.chosenHotel     ? '  Ngân sách: ' + budgLabel   : null,
          modeLabel                       ? '  Đặt phòng: ' + modeLabel   : null,
          '• Tên:       ' + (f.customerName||''),
          '• SĐT:       ' + fmtPhone(f.customerPhone),
          f.notes ? '• Ghi chú:   ' + f.notes : null,
          '',
          est ? '💰 Ước tính transport: ' + est : null,
        ];
        return lines.filter(function(v) { return v !== null; }).join('\n');
      },
    },

  };

  // ── Draft Persistence ──────────────────────────────────────────────────────

  function saveDraft(d) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) {}
  }

  function loadDraft() {
    try {
      var r = sessionStorage.getItem(STORAGE_KEY);
      return r ? JSON.parse(r) : null;
    } catch(e) { return null; }
  }

  function clearDraft() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch(e) {}
  }

  // ── Engine State ───────────────────────────────────────────────────────────

  var draft = loadDraft();

  function isActive()  { return draft !== null; }
  function getDraft()  { return draft; }

  // ── Intent Detection ───────────────────────────────────────────────────────

  function detectIntent(text) {
    var keys = Object.keys(WORKFLOWS);
    for (var i = 0; i < keys.length; i++) {
      if (WORKFLOWS[keys[i]].detectKeywords.test(text)) return keys[i];
    }
    return null;
  }

  // ── Extract all possible fields from text ──────────────────────────────────

  function extractAllFromText(text, intent) {
    var wf = WORKFLOWS[intent];
    if (!wf) return {};
    var collected = {};
    var baseFields = Object.assign({}, draft ? draft.collectedFields : {});

    for (var i = 0; i < wf.fields.length; i++) {
      var fd = wf.fields[i];
      var merged = Object.assign({}, baseFields, collected);

      if (merged[fd.key] !== undefined) continue;
      if (!fd.extract) continue;
      if (fd.showIf && !fd.showIf(merged)) continue;

      try {
        var val = fd.extract(text, merged);
        if (val !== null && val !== undefined) {
          // Run validation — skip if invalid (will be asked explicitly later)
          if (fd.validate) {
            var err = fd.validate(val, merged);
            if (err) continue;
          }
          collected[fd.key] = val;
        }
      } catch(e) {}
    }
    return collected;
  }

  // ── Extract fields that OVERWRITE already-collected values (corrections) ───
  // Used only when isCorrectionText() is true.  Unlike extractAllFromText,
  // this DOES re-examine already-collected fields so that "change 6 → 3 people"
  // can update an existing passengers value.
  function extractCorrectedFields(text, intent) {
    var wf = WORKFLOWS[intent];
    if (!wf || !draft) return {};
    var updates = {};
    var currentFields = draft.collectedFields;

    for (var i = 0; i < wf.fields.length; i++) {
      var fd = wf.fields[i];
      if (!fd.extract) continue;
      if (fd.showIf && !fd.showIf(currentFields)) continue;
      if (currentFields[fd.key] === undefined) continue; // only update *existing* fields

      try {
        var val = fd.extract(text, currentFields);
        if (val === null || val === undefined) continue;
        // Ignore if same as current
        if (JSON.stringify(val) === JSON.stringify(currentFields[fd.key])) continue;
        // Validate
        if (fd.validate) {
          var err = fd.validate(val, Object.assign({}, currentFields, updates));
          if (err) continue;
        }
        updates[fd.key] = val;
      } catch(e) {}
    }
    return updates;
  }

  // ── Find next required field missing ──────────────────────────────────────

  function findNextField(intent) {
    var wf = WORKFLOWS[intent];
    if (!wf) return null;
    var f = draft.collectedFields;
    for (var i = 0; i < wf.fields.length; i++) {
      var fd = wf.fields[i];
      if (fd.showIf && !fd.showIf(f)) continue;
      var isOptional = typeof fd.optional === 'function' ? fd.optional(f) : fd.optional;
      if (isOptional) continue;
      if (f[fd.key] === undefined) return fd;
    }
    return null;
  }

  function getQ(fd) {
    if (!fd.question) return null;
    return typeof fd.question === 'function' ? fd.question(draft.collectedFields) : fd.question;
  }

  // ── Start Workflow ─────────────────────────────────────────────────────────

  function startWorkflow(intent, seedText) {
    var wf = WORKFLOWS[intent];
    if (!wf) return false;

    draft = {
      intent:          intent,
      label:           wf.label,
      collectedFields: {},
      awaitingField:   null,
      awaitingConfirm: false,
      createdAt:       Date.now(),
      updatedAt:       Date.now(),
    };

    if (seedText) {
      var seeded = extractAllFromText(seedText, intent);
      Object.assign(draft.collectedFields, seeded);
    }

    saveDraft(draft);
    return true;
  }

  // ── Main Process ───────────────────────────────────────────────────────────

  function process(userText) {
    if (!draft) return null;
    draft.updatedAt = Date.now();

    // Cancel
    if (/^(hủy|cancel|quit|thoát|dừng|thôi|stop)\b/i.test((userText||'').trim())) {
      clearDraft(); draft = null;
      return 'Đã hủy. Bạn cần tôi giúp gì khác không?';
    }

    var wf = WORKFLOWS[draft.intent];
    if (!wf) { clearDraft(); draft = null; return null; }

    // ── Mid-flow correction: user is updating a previously answered field ──
    // Check BEFORE awaiting-confirm so "actually 3 people" works at any stage.
    if (!draft.awaitingConfirm && isCorrectionText(userText) &&
        Object.keys(draft.collectedFields).length > 0) {
      var corr = extractCorrectedFields(userText, draft.intent);
      if (Object.keys(corr).length > 0) {
        Object.assign(draft.collectedFields, corr);
        draft.awaitingField = null;    // re-evaluate which field to ask next
        var corrKeys = Object.keys(corr);
        var corrAck = '✅ Đã cập nhật — ' + corrKeys.map(function(k) {
          return fmtFieldLabel(k) + ': ' + fmtFieldVal(k, corr[k]);
        }).join(', ') + '.';
        saveDraft(draft);
        // Fall through to normal field-finding logic below (do not return here).
        // We prepend the ack by storing it and appending to the next question.
        draft._correctionAck = corrAck;
      }
    }

    // ── Awaiting confirmation ──────────────────────────────────────────────
    if (draft.awaitingConfirm) {
      var yn = X.yesNo(userText);
      if (yn === true) {
        return { type: 'finalize' };
      } else if (yn === false) {
        draft.awaitingConfirm = false;
        // Also try to pick up new values / corrections from this reply
        var corrAtConf = extractCorrectedFields(userText, draft.intent);
        var newAtConf  = extractAllFromText(userText, draft.intent);
        Object.assign(draft.collectedFields, corrAtConf, newAtConf);
        var next2 = findNextField(draft.intent);
        if (!next2) {
          // All fields still complete — re-show summary
          draft.awaitingConfirm = true;
          saveDraft(draft);
          return wf.summary(draft.collectedFields) +
            '\n\nBạn có muốn xác nhận không?\nGõ "có" để đặt hoặc "không" để chỉnh sửa.';
        }
        draft.awaitingField = next2.key;
        saveDraft(draft);
        return 'Đã cập nhật. Vui lòng tiếp tục: ' + (getQ(next2)||'');
      } else {
        return { type:'message', text:'Bạn muốn xác nhận hay chỉnh sửa?', chips:[
          { label:'✅ Xác nhận đặt chỗ',     value:'xác nhận' },
          { label:'✏️ Chỉnh sửa thông tin',  value:'không' },
        ]};
      }
    }

    // ── Extract awaited field first ────────────────────────────────────────
    if (draft.awaitingField) {
      var awFd = null;
      for (var i = 0; i < wf.fields.length; i++) {
        if (wf.fields[i].key === draft.awaitingField) { awFd = wf.fields[i]; break; }
      }
      if (awFd && awFd.extract) {
        var val = awFd.extract(userText, draft.collectedFields);
        if (val !== null && val !== undefined) {
          if (awFd.validate) {
            var err = awFd.validate(val, draft.collectedFields);
            if (err) { saveDraft(draft); return err; }
          }
          draft.collectedFields[draft.awaitingField] = val;
          draft.awaitingField = null;
        }
      }
    }

    // ── Proactively extract any other bonus fields ─────────────────────────
    var extras = extractAllFromText(userText, draft.intent);
    Object.assign(draft.collectedFields, extras);

    // ── Find next missing required field ──────────────────────────────────
    var nextFd = findNextField(draft.intent);
    if (nextFd) {
      draft.awaitingField = nextFd.key;
      saveDraft(draft);
      var q = getQ(nextFd);
      if (!q) {
        // Skip fields with no question (auto-handled) — recurse
        draft.collectedFields[nextFd.key] = '';
        return process(userText);
      }
      // Prepend any correction acknowledgment
      var ack = draft._correctionAck || '';
      delete draft._correctionAck;
      if (ack) q = ack + '\n' + q;

      // Build chips if field defines them
      var fieldChips = null;
      if (nextFd.chips) {
        try { fieldChips = typeof nextFd.chips === 'function' ? nextFd.chips(draft.collectedFields) : nextFd.chips; } catch(e) {}
      }
      // For bookingMode: also inject hotel suggestions when lodging=hotel
      var fieldHotels = null;
      if (nextFd.key === 'bookingMode' && draft.collectedFields.lodging === 'hotel') {
        var destId = typeof draft.collectedFields.destination === 'object' ? draft.collectedFields.destination.id : '';
        var sugg = getHotelSuggestions(destId, draft.collectedFields.hotelArea, draft.collectedFields.hotelBudget);
        if (sugg.length) fieldHotels = sugg;
      }
      if ((fieldChips && fieldChips.length) || fieldHotels) {
        var richText = fieldHotels
          ? 'Đây là các khách sạn phù hợp với yêu cầu của bạn:\n\n' + q
          : q;
        return { type:'message', text:richText, chips:fieldChips||null, hotels:fieldHotels||null };
      }
      return q;
    }

    // ── All required fields collected ──────────────────────────────────────
    draft.awaitingConfirm = true;
    draft.awaitingField   = null;
    var ackFinal = draft._correctionAck || '';
    delete draft._correctionAck;
    saveDraft(draft);
    var summaryText = (ackFinal ? ackFinal + '\n\n' : '') +
      wf.summary(draft.collectedFields) + '\n\n✅ Thông tin đầy đủ! Bạn có muốn xác nhận không?';
    return { type:'message',
      text: summaryText,
      chips: [
        { label:'✅ Xác nhận đặt chỗ',     value:'xác nhận' },
        { label:'✏️ Chỉnh sửa thông tin',  value:'không' },
      ],
    };
  }

  // ── Finalize ───────────────────────────────────────────────────────────────

  async function finalize() {
    if (!draft) throw new Error('No active workflow');
    if (typeof firebase === 'undefined' || !firebase.firestore) throw new Error('Firestore unavailable');

    var fv = firebase.firestore.FieldValue;
    var db = firebase.firestore();
    var f  = draft.collectedFields;
    var orderId = genId();
    var trackingToken = null;

    if (draft.intent === 'food_order') {
      var item     = typeof f.item === 'object' ? f.item : {};
      var vendorId = item.vendorId || 'nha-bep-emily';
      var subtotal = (item.price||0) * (f.quantity||0);
      var deliveryAddr = f.fulfillment === 'delivery' ? (f.address||'') : null;
      var deliveryMapsLink = deliveryAddr ? buildMapsLink(deliveryAddr) : null;

      // Build rich notification body
      var msgLines = [
        '📦 ' + (f.quantity||0) + ' × ' + (item.name||''),
        f.variant               ? '   Loại: ' + f.variant : null,
        '📅 ' + fmtDate(f.requestedDate) + ' lúc ' + fmtTime(f.requestedTime),
        f.fulfillment === 'delivery'
          ? ('🚗 Giao đến: ' + (deliveryAddr||'') + (deliveryMapsLink ? '\n   Map: ' + deliveryMapsLink : ''))
          : '🏪 Khách tự đến lấy',
        '👤 ' + (f.customerName||'') + ' · ' + fmtPhone(f.customerPhone),
        f.notes                 ? '📝 ' + f.notes : null,
        '💰 Tổng: $' + subtotal.toFixed(2),
        '🔖 Mã đơn: ' + orderId,
      ];
      var msg = msgLines.filter(function(v){return v!==null;}).join('\n');

      await db.collection('vendors').doc(vendorId).collection('bookings').add({
        type:'food_order', bookingId:orderId, vendorId,
        itemId:item.id||'', itemName:item.name||'', quantity:f.quantity||0,
        variant:f.variant||'', fulfillment:f.fulfillment||'pickup',
        requestedDate:f.requestedDate||'', requestedTime:f.requestedTime||'',
        subtotal, customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        deliveryAddress:deliveryAddr,
        notes:f.notes||'', status:'pending', source:'ai_chat',
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc(vendorId).collection('notifications').add({
        type:'new_order',
        title:'🛒 Đơn hàng mới — ' + (f.customerName||''),
        message: msg,
        bookingId:orderId, customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        itemName:item.name||'', quantity:f.quantity||0, subtotal,
        requestedDate:f.requestedDate||'', fulfillment:f.fulfillment||'pickup',
        deliveryAddress:deliveryAddr||'', deliveryMapsLink:deliveryMapsLink||'',
        read:false, createdAt:fv.serverTimestamp(),
      });

    } else if (draft.intent === 'airport_pickup' || draft.intent === 'airport_dropoff') {
      var isPickup      = draft.intent === 'airport_pickup';
      var timeField     = isPickup ? f.arrivalTime : f.departureTime;
      var datetime      = (f.requestedDate && timeField) ? f.requestedDate + 'T' + timeField + ':00' : (f.requestedDate||'');
      var addrField     = isPickup ? (f.dropoffAddress||'') : (f.pickupAddress||'');
      trackingToken     = genId().replace('DLC-','')+genId().replace('DLC-','');

      var airportMapsLink  = buildAirportMapsLink(f.airport, f.terminal);
      var addrMapsLink     = buildMapsLink(addrField);
      var luggageStr       = f.luggageCount === 0 ? 'Xách tay' : (f.luggageCount ? f.luggageCount + ' kiện' : '');
      var timeLabel        = isPickup ? 'Hạ cánh' : 'Cất cánh';

      var driverBriefLines = [
        (isPickup ? '✈️ ĐÓN SÂN BAY' : '✈️ ĐƯA RA SÂN BAY') + ' — ' + orderId,
        '',
        '👤 Khách: ' + (f.customerName||'') + ' · ' + fmtPhone(f.customerPhone),
        '🛫 Sân bay: ' + (f.airport||'') + (f.terminal ? ' · ' + f.terminal : ''),
        airportMapsLink ? '   Map sân bay: ' + airportMapsLink : null,
        f.airline       ? '✈️  Bay: ' + f.airline : null,
        '📅 ' + fmtDate(f.requestedDate) + ' · ' + timeLabel + ': ' + fmtTime(timeField),
        '👥 ' + (f.passengers||1) + ' người' + (luggageStr ? ' · ' + luggageStr : ''),
        isPickup
          ? ('📍 Điểm đến: ' + addrField + (addrMapsLink ? '\n   Map: ' + addrMapsLink : ''))
          : ('🚗 Đón tại: ' + addrField + (addrMapsLink ? '\n   Map: ' + addrMapsLink : '')),
        f.notes         ? '📝 ' + f.notes : null,
        isPickup        ? '⏱ Chờ tại cửa Arrivals/Baggage Claim.' : null,
      ];
      var driverBrief = driverBriefLines.filter(function(v){return v!==null;}).join('\n');

      await db.collection('bookings').doc(orderId).set({
        bookingId:orderId, trackingToken,
        status:'pending', serviceType:isPickup?'pickup':'dropoff', datetime,
        airport:f.airport||'', airline:f.airline||'', terminal:f.terminal||'',
        address:addrField, passengers:f.passengers||1, luggageCount:f.luggageCount||0,
        name:f.customerName||'', phone:f.customerPhone||'',
        notes:f.notes||'', source:'ai_chat',
        driver:null,vehicleLat:null,vehicleLng:null,vehicleHeading:null,etaMinutes:null,
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add({
        type:'new_booking',
        title:(isPickup?'✈️ Đón sân bay':'✈️ Ra sân bay')+' — '+(f.customerName||''),
        message: driverBrief,
        bookingId:orderId, customerPhone:f.customerPhone||'',
        requestedDate:f.requestedDate||'', airport:f.airport||'', terminal:f.terminal||'',
        airline:f.airline||'', passengers:f.passengers||1, luggageCount:f.luggageCount||0,
        pickupAddress:isPickup?'':addrField, dropoffAddress:isPickup?addrField:'',
        airportMapsLink:airportMapsLink||'', addrMapsLink:addrMapsLink||'',
        read:false, createdAt:fv.serverTimestamp(),
      });

    } else if (draft.intent === 'nail_appointment' || draft.intent === 'hair_appointment') {
      var isNail    = draft.intent === 'nail_appointment';
      var svcEmoji  = isNail ? '💅' : '✂️';
      var svcLabel2 = isNail ? 'Nail' : 'Tóc';

      var apptMsgLines = [
        svcEmoji + ' LỊCH HẸN ' + svcLabel2.toUpperCase() + ' — ' + orderId,
        '',
        '💆 Dịch vụ: ' + (f.serviceType||''),
        f.region      ? '📍 Khu vực: ' + f.region : null,
        '📅 ' + fmtDate(f.requestedDate) + ' lúc ' + fmtTime(f.requestedTime),
        '👤 ' + (f.customerName||'') + ' · ' + fmtPhone(f.customerPhone),
        f.notes       ? '📝 ' + f.notes : null,
      ];
      var apptMsg = apptMsgLines.filter(function(v){return v!==null;}).join('\n');

      await db.collection('bookings').doc(orderId).set({
        bookingId:orderId, type:draft.intent, serviceType:f.serviceType||'',
        region:f.region||'',
        requestedDate:f.requestedDate||'', requestedTime:f.requestedTime||'',
        name:f.customerName||'', phone:f.customerPhone||'',
        notes:f.notes||'', status:'pending', source:'ai_chat',
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add({
        type:'new_appointment',
        title: svcEmoji + ' Lịch hẹn ' + svcLabel2 + ' — ' + (f.customerName||''),
        message: apptMsg,
        bookingId:orderId, customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        serviceType:f.serviceType||'', region:f.region||'',
        requestedDate:f.requestedDate||'', requestedTime:f.requestedTime||'',
        read:false, createdAt:fv.serverTimestamp(),
      });

    } else if (draft.intent === 'tour_request') {
      var dest   = typeof f.destination === 'object' ? f.destination : { id:'', name:String(f.destination||'') };
      var lodging = f.lodging || 'none';
      trackingToken = genId().replace('DLC-','')+genId().replace('DLC-','');

      var startMapsLink = buildMapsLink(f.startingPoint);
      var lodgeLabel2 = { hotel:'Khách sạn', airbnb:'Airbnb', none:'Tự túc' }[lodging] || lodging;

      var tourMsgLines = [
        '🗺️ TOUR ' + (dest.name||'').toUpperCase() + ' — ' + orderId,
        '',
        '📍 Xuất phát: ' + (f.startingPoint||'') + (startMapsLink ? '\n   Map: ' + startMapsLink : ''),
        '🏁 Điểm đến: ' + (dest.name||''),
        '📅 Khởi hành: ' + fmtDate(f.requestedDate) + ' · ' + (f.days||1) + ' ngày',
        '👥 ' + (f.passengers||1) + ' người',
        '🏨 Chỗ ở: ' + lodgeLabel2 +
          (f.chosenHotel ? ' — ' + f.chosenHotel : '') +
          (f.hotelArea && !f.chosenHotel ? ' (' + f.hotelArea + ')' : '') +
          (f.bookingMode === 'vendor' ? ' — nhờ DLC đặt' : ''),
        '👤 ' + (f.customerName||'') + ' · ' + fmtPhone(f.customerPhone),
        f.notes ? '📝 ' + f.notes : null,
      ];
      var tourMsg = tourMsgLines.filter(function(v){return v!==null;}).join('\n');

      await db.collection('bookings').doc(orderId).set({
        bookingId:orderId, trackingToken,
        status:'pending', serviceType:dest.id||'tour', datetime:f.requestedDate||'',
        address:f.startingPoint||'', passengers:f.passengers||1, days:f.days||1,
        lodging, hotelArea:f.hotelArea||'', hotelBudget:f.hotelBudget||'',
        chosenHotel:f.chosenHotel||'', bookingMode:f.bookingMode||'',
        name:f.customerName||'', phone:f.customerPhone||'',
        notes:f.notes||'', source:'ai_chat',
        driver:null,vehicleLat:null,vehicleLng:null,vehicleHeading:null,etaMinutes:null,
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add({
        type:'new_booking',
        title:'🗺️ Tour ' + (dest.name||'') + ' — ' + (f.customerName||''),
        message: tourMsg,
        bookingId:orderId, customerPhone:f.customerPhone||'',
        requestedDate:f.requestedDate||'', destination:dest.name||'',
        passengers:f.passengers||1, days:f.days||1,
        lodging, hotelArea:f.hotelArea||'', chosenHotel:f.chosenHotel||'', bookingMode:f.bookingMode||'',
        read:false, createdAt:fv.serverTimestamp(),
      });

    } else if (draft.intent === 'private_ride') {
      var datetime = (f.requestedDate && f.requestedTime)
        ? f.requestedDate + 'T' + f.requestedTime + ':00'
        : (f.requestedDate || '');
      var pickupMapsLink  = buildMapsLink(f.pickupAddress);
      var dropoffMapsLink = buildMapsLink(f.dropoffAddress);
      var rideEst = estimateRide(f.passengers, f.pickupAddress, f.dropoffAddress);
      trackingToken = genId().replace('DLC-','') + genId().replace('DLC-','');

      var rideBriefLines = [
        '🚗 XE RIÊNG CAO CẤP — ' + orderId,
        '',
        '👤 Khách: ' + (f.customerName||'') + ' · ' + fmtPhone(f.customerPhone),
        '📍 Đón tại: ' + (f.pickupAddress||'') + (pickupMapsLink ? '\n   Map: ' + pickupMapsLink : ''),
        '🏁 Điểm đến: ' + (f.dropoffAddress||'') + (dropoffMapsLink ? '\n   Map: ' + dropoffMapsLink : ''),
        '📅 ' + fmtDate(f.requestedDate) + ' · ' + fmtTime(f.requestedTime),
        '👥 ' + (f.passengers||1) + ' người · ' + rideEst.vehicle,
        rideEst.ourPrice
          ? '💰 DLC ~$' + rideEst.ourPrice + (rideEst.uberEst ? ' (Uber ~$' + rideEst.uberEst + ')' : '')
          : null,
        f.notes ? '📝 ' + f.notes : null,
      ];
      var rideBrief = rideBriefLines.filter(function(v){return v!==null;}).join('\n');

      await db.collection('bookings').doc(orderId).set({
        bookingId:orderId, trackingToken,
        status:'pending', serviceType:'private_ride', datetime,
        pickupAddress:f.pickupAddress||'', dropoffAddress:f.dropoffAddress||'',
        passengers:f.passengers||1,
        name:f.customerName||'', phone:f.customerPhone||'',
        notes:f.notes||'', source:'ai_chat',
        estimatedPrice: rideEst ? rideEst.ourPrice : null,
        driver:null, vehicleLat:null, vehicleLng:null, vehicleHeading:null, etaMinutes:null,
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add({
        type:'new_booking',
        title:'🚗 Xe riêng — ' + (f.customerName||''),
        message: rideBrief,
        bookingId:orderId, customerPhone:f.customerPhone||'',
        requestedDate:f.requestedDate||'', requestedTime:f.requestedTime||'',
        pickupAddress:f.pickupAddress||'', dropoffAddress:f.dropoffAddress||'',
        pickupMapsLink:pickupMapsLink||'', dropoffMapsLink:dropoffMapsLink||'',
        passengers:f.passengers||1, estimatedPrice:rideEst ? rideEst.ourPrice : null,
        read:false, createdAt:fv.serverTimestamp(),
      });
    }

    clearDraft(); draft = null;
    return { id: orderId, token: trackingToken || null };
  }

  function cancel() { clearDraft(); draft = null; }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.DLCWorkflow = {
    isActive:       isActive,
    getDraft:       getDraft,
    detectIntent:   detectIntent,
    startWorkflow:  startWorkflow,
    process:        process,
    finalize:       finalize,
    cancel:         cancel,
    WORKFLOWS:      WORKFLOWS,
    _X:             X,
  };

})();
