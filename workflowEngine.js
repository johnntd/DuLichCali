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
      var m = text.match(/(\d+)\s*(?:cuốn|cái|tô|phần|piece|roll|order|chiếc)?/i)
           || text.match(/^(\d+)$/);
      var n = m ? parseInt(m[1]) : NaN;
      return (isNaN(n) || n < 1 || n > 9999) ? null : n;
    },

    foodVariant: function(text) {
      var t = text.toLowerCase();
      if (/raw|sống|chưa chiên|tươi\b|uncooked/.test(t)) return 'sống (raw)';
      if (/fried|chiên|chín|cooked|sẵn/.test(t)) return 'chiên sẵn (fried)';
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

      if (/hôm nay|today/.test(t)) return today.toISOString().slice(0,10);
      if (/ngày mai|tomorrow/.test(t)) {
        var tm = new Date(today); tm.setDate(tm.getDate() + 1);
        return tm.toISOString().slice(0,10);
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
          return dd.toISOString().slice(0,10);
        }
      }

      // M/D
      var m = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
      if (m) {
        var yr = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : today.getFullYear();
        var d2 = new Date(yr + '-' + pad(m[1]) + '-' + pad(m[2]));
        if (!isNaN(d2)) return d2.toISOString().slice(0,10);
      }

      // "April 10"
      var MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
        january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
      var m2 = text.match(/([a-zA-Z]+)\s+(\d{1,2})/i) || text.match(/(\d{1,2})\s+([a-zA-Z]+)/i);
      if (m2) {
        var word = m2[1].toLowerCase(), num = parseInt(m2[2]);
        var word2 = m2[2] ? m2[2].toLowerCase() : '', num2 = parseInt(m2[1]);
        var mo = MONTHS[word] || MONTHS[word2];
        var dy = MONTHS[word] ? num : (MONTHS[word2] ? num2 : null);
        if (mo && dy) {
          var d3 = new Date(today.getFullYear() + '-' + pad(mo) + '-' + pad(dy));
          if (!isNaN(d3)) return d3.toISOString().slice(0,10);
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
      if (/egg.?roll|chả\s*giò|cha\s*gio/i.test(text)) {
        return { id:'cha-gio', name:'Chả Giò (Egg Rolls)', price:0.75, unit:'cuốn', minOrder:30, vendorId:'nha-bep-emily', hasVariant:true };
      }
      if (/chuối\s*đậu|chuoi\s*dau|\bốc\b|snail/i.test(text)) {
        return { id:'chuoi-dau-nau-oc', name:'Chuối Đậu Nấu Ốc', price:18.00, unit:'tô', minOrder:1, vendorId:'nha-bep-emily', hasVariant:false };
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
      if (/không\b|no\b|tự túc|không cần|none/.test(t)) return 'none';
      if (/hotel|khách sạn/.test(t)) return 'hotel';
      if (/airbnb|nhà thuê/.test(t)) return 'airbnb';
      if (/có\b|yes\b|cần\b/.test(t)) return 'hotel';
      return null;
    },
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

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

  // ── Workflow Definitions ───────────────────────────────────────────────────

  var WORKFLOWS = {

    food_order: {
      label: 'Đặt Món Ăn',
      intro: '🥟 Tôi sẽ giúp bạn đặt món. Gõ "hủy" bất cứ lúc nào để thoát.\n',
      detectKeywords: /(?:\border\b|đặt\s*(?:mua\s*|hàng\s*)?(?:\d+\s*)?|muốn\s+(?:đặt|mua|order)|can\s+i\s+(?:order|get)|i\s+(?:want|need)\s+to|cho\s+(?:tôi|mình)|i'd\s+like)\s*\d*\s*(?:egg.?roll|chả\s*giò|cha\s*gio|chuối\s*đậu|ốc\b)|\b(?:egg.?roll|chả\s*giò|cha\s*gio)\b.*\b(?:order|đặt|mua|\d+\s*cuốn)\b/i,
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
            if ((f.item||{}).hasVariant) return 'Bạn muốn chả giò sống (raw) để tự chiên hay chiên sẵn (fried)?';
            return null;
          },
          extract: function(t) { return X.foodVariant(t); },
          optional: function(f) { return !(f.item && f.item.hasVariant); },
          showIf: function(f) { return f.item && f.item.hasVariant; },
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
        var sub  = ((item.price||0) * (f.quantity||0)).toFixed(2);
        var lines = [
          '📋 Tóm tắt đơn hàng:',
          '• Món:       ' + (item.name||f.item||''),
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
          '💰 Tổng: $' + sub + ' (' + f.quantity + ' × $' + (item.price||0) + '/' + (item.unit||'cái') + ')',
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
          question: function() { return '✈️ Bạn đến sân bay nào?\n(LAX · SNA · ONT · BUR · SFO · SJC · OAK...)'; },
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
          key: 'dropoffAddress',
          question: function() { return 'Địa chỉ điểm đến sau sân bay?\n(thành phố hoặc địa chỉ cụ thể)'; },
          extract: function(t) { return X.address(t) || (t.trim().length >= 3 ? t.trim() : null); },
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
          question: function() { return 'Số kiện hành lý hoặc yêu cầu đặc biệt?\n(Gõ "không" nếu không có)'; },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-|0)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var est = estimateTransfer(f.passengers, f.airport);
        var lines = [
          '📋 Tóm tắt đặt đón sân bay:',
          '• Sân bay:      ' + (f.airport||''),
          f.airline  ? '• Chuyến bay:   ' + f.airline : null,
          '• Ngày đến:     ' + fmtDate(f.requestedDate),
          '• Giờ hạ cánh:  ' + fmtTime(f.arrivalTime),
          '• Hành khách:   ' + (f.passengers||'') + ' người',
          '• Điểm đến:     ' + (f.dropoffAddress||''),
          '• Tên:          ' + (f.customerName||''),
          '• SĐT:          ' + fmtPhone(f.customerPhone),
          f.notes    ? '• Ghi chú:      ' + f.notes : null,
          '',
          est        ? '💰 Ước tính: ' + est : null,
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
          question: function() { return '✈️ Bạn cần đưa tới sân bay nào?\n(LAX · SNA · ONT · BUR · SFO · SJC · OAK...)'; },
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
          question: function() { return 'Địa chỉ đón bạn (điểm xuất phát)?'; },
          extract: function(t) { return X.address(t) || (t.trim().length >= 3 ? t.trim() : null); },
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
          question: function() { return 'Số kiện hành lý hoặc yêu cầu đặc biệt?\n(Gõ "không" nếu không có)'; },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-|0)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var est = estimateTransfer(f.passengers, f.airport);
        var lines = [
          '📋 Tóm tắt đặt ra sân bay:',
          '• Sân bay:      ' + (f.airport||''),
          f.airline  ? '• Chuyến bay:   ' + f.airline : null,
          '• Ngày bay:     ' + fmtDate(f.requestedDate),
          '• Giờ cất cánh: ' + fmtTime(f.departureTime),
          '• Điểm đón:     ' + (f.pickupAddress||''),
          '• Hành khách:   ' + (f.passengers||'') + ' người',
          '• Tên:          ' + (f.customerName||''),
          '• SĐT:          ' + fmtPhone(f.customerPhone),
          f.notes    ? '• Ghi chú:      ' + f.notes : null,
          '',
          est        ? '💰 Ước tính: ' + est : null,
        ];
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
          '• Ngày:      ' + fmtDate(f.requestedDate),
          '• Giờ:       ' + fmtTime(f.requestedTime),
          '• Tên:       ' + (f.customerName||''),
          '• SĐT:       ' + fmtPhone(f.customerPhone),
          f.notes ? '• Yêu cầu:   ' + f.notes : null,
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
          '• Ngày:      ' + fmtDate(f.requestedDate),
          '• Giờ:       ' + fmtTime(f.requestedTime),
          '• Tên:       ' + (f.customerName||''),
          '• SĐT:       ' + fmtPhone(f.customerPhone),
          f.notes ? '• Yêu cầu:   ' + f.notes : null,
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
            return 'Bạn có cần hỗ trợ chỗ ở không?\n• Có khách sạn\n• Airbnb\n• Không cần (tự túc)';
          },
          extract: function(t) { return X.lodging(t); },
          optional: true,
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
          question: function() { return 'Yêu cầu đặc biệt hoặc ngân sách dự kiến?\n(Gõ "không" nếu không có)'; },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var dest = typeof f.destination === 'object' ? f.destination.name : (f.destination||'');
        var destId = typeof f.destination === 'object' ? f.destination.id : '';
        var est = estimateTour(f.passengers, f.days, destId);
        var lodgeLabel = { hotel:'Khách sạn', airbnb:'Airbnb', none:'Tự túc' }[f.lodging] || '';
        var lines = [
          '📋 Tóm tắt yêu cầu tour:',
          '• Điểm đến:  ' + dest,
          '• Ngày đi:   ' + fmtDate(f.requestedDate),
          '• Số ngày:   ' + (f.days||'') + ' ngày',
          '• Số người:  ' + (f.passengers||'') + ' người',
          '• Xuất phát: ' + (f.startingPoint||''),
          lodgeLabel ? '• Chỗ ở:     ' + lodgeLabel : null,
          '• Tên:       ' + (f.customerName||''),
          '• SĐT:       ' + fmtPhone(f.customerPhone),
          f.notes ? '• Ghi chú:   ' + f.notes : null,
          '',
          est ? '💰 Ước tính: ' + est : null,
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

    // ── Awaiting confirmation ──────────────────────────────────────────────
    if (draft.awaitingConfirm) {
      var yn = X.yesNo(userText);
      if (yn === true) {
        return { type: 'finalize' };
      } else if (yn === false) {
        draft.awaitingConfirm = false;
        // Try to extract a field correction from this reply
        var corrected = extractAllFromText(userText, draft.intent);
        if (Object.keys(corrected).length > 0) {
          Object.assign(draft.collectedFields, corrected);
        }
        var next2 = findNextField(draft.intent);
        if (!next2) {
          // Still all good — re-show summary
          draft.awaitingConfirm = true;
          saveDraft(draft);
          return wf.summary(draft.collectedFields) +
            '\n\nBạn có muốn xác nhận không?\nGõ "có" để đặt hoặc "không" để chỉnh sửa.';
        }
        draft.awaitingField = next2.key;
        saveDraft(draft);
        return 'Đã cập nhật. Vui lòng tiếp tục: ' + (getQ(next2)||'');
      } else {
        return 'Gõ "có" để xác nhận hoặc "không" để chỉnh sửa.';
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
      return q;
    }

    // ── All required fields collected ──────────────────────────────────────
    draft.awaitingConfirm = true;
    draft.awaitingField   = null;
    saveDraft(draft);
    return wf.summary(draft.collectedFields) +
      '\n\n✅ Thông tin đầy đủ! Bạn có muốn xác nhận không?\nGõ "có" để đặt hoặc "không" để chỉnh sửa.';
  }

  // ── Finalize ───────────────────────────────────────────────────────────────

  async function finalize() {
    if (!draft) throw new Error('No active workflow');
    if (typeof firebase === 'undefined' || !firebase.firestore) throw new Error('Firestore unavailable');

    var fv = firebase.firestore.FieldValue;
    var db = firebase.firestore();
    var f  = draft.collectedFields;
    var orderId = genId();

    if (draft.intent === 'food_order') {
      var item     = typeof f.item === 'object' ? f.item : {};
      var vendorId = item.vendorId || 'nha-bep-emily';
      var subtotal = (item.price||0) * (f.quantity||0);

      await db.collection('vendors').doc(vendorId).collection('bookings').add({
        type:'food_order', bookingId:orderId, vendorId,
        itemId:item.id||'', itemName:item.name||'', quantity:f.quantity||0,
        variant:f.variant||'', fulfillment:f.fulfillment||'pickup',
        requestedDate:f.requestedDate||'', requestedTime:f.requestedTime||'',
        subtotal, customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        deliveryAddress:f.fulfillment==='delivery'?(f.address||''):null,
        notes:f.notes||'', status:'pending', source:'ai_chat',
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc(vendorId).collection('notifications').add({
        type:'new_order',
        title:'🛒 Đơn hàng mới — '+(f.customerName||''),
        message:(f.quantity||0)+' '+(item.name||'')+' · '+fmtPhone(f.customerPhone)+' · '+fmtDate(f.requestedDate)+' '+fmtTime(f.requestedTime),
        bookingId:orderId, customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        itemName:item.name||'', quantity:f.quantity||0, subtotal,
        requestedDate:f.requestedDate||'', fulfillment:f.fulfillment||'pickup',
        read:false, createdAt:fv.serverTimestamp(),
      });

    } else if (draft.intent === 'airport_pickup' || draft.intent === 'airport_dropoff') {
      var isPickup  = draft.intent === 'airport_pickup';
      var timeField = isPickup ? f.arrivalTime : f.departureTime;
      var datetime  = (f.requestedDate && timeField) ? f.requestedDate + 'T' + timeField + ':00' : (f.requestedDate||'');
      var addrField = isPickup ? (f.dropoffAddress||'') : (f.pickupAddress||'');

      await db.collection('bookings').doc(orderId).set({
        bookingId:orderId, trackingToken:genId().replace('DLC-','')+genId().replace('DLC-',''),
        status:'pending', serviceType:isPickup?'pickup':'dropoff', datetime,
        airport:f.airport||'', airline:f.airline||'', address:addrField,
        passengers:f.passengers||1, name:f.customerName||'', phone:f.customerPhone||'',
        notes:f.notes||'', source:'ai_chat',
        driver:null,vehicleLat:null,vehicleLng:null,vehicleHeading:null,etaMinutes:null,
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add({
        type:'new_booking',
        title:(isPickup?'✈️ Đón sân bay':'✈️ Ra sân bay')+' — '+(f.customerName||''),
        message:(f.passengers||1)+' người · '+fmtPhone(f.customerPhone)+' · '+(f.airport||'')+' · '+fmtDate(f.requestedDate)+' '+fmtTime(timeField),
        bookingId:orderId, customerPhone:f.customerPhone||'',
        requestedDate:f.requestedDate||'', airport:f.airport||'',
        pickupAddress:isPickup?'':addrField, read:false, createdAt:fv.serverTimestamp(),
      });

    } else if (draft.intent === 'nail_appointment' || draft.intent === 'hair_appointment') {
      var svcLabel2 = draft.intent === 'nail_appointment' ? 'Nail' : 'Tóc';
      await db.collection('bookings').doc(orderId).set({
        bookingId:orderId, type:draft.intent, serviceType:f.serviceType||'',
        requestedDate:f.requestedDate||'', requestedTime:f.requestedTime||'',
        name:f.customerName||'', phone:f.customerPhone||'',
        notes:f.notes||'', status:'pending', source:'ai_chat',
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add({
        type:'new_appointment',
        title:'💅 Lịch hẹn '+svcLabel2+' — '+(f.customerName||''),
        message:(f.serviceType||'')+' · '+fmtPhone(f.customerPhone)+' · '+fmtDate(f.requestedDate)+' '+fmtTime(f.requestedTime),
        bookingId:orderId, customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        serviceType:f.serviceType||'', requestedDate:f.requestedDate||'',
        read:false, createdAt:fv.serverTimestamp(),
      });

    } else if (draft.intent === 'tour_request') {
      var dest   = typeof f.destination === 'object' ? f.destination : { id:'', name:String(f.destination||'') };
      var lodging = f.lodging || 'none';
      await db.collection('bookings').doc(orderId).set({
        bookingId:orderId, trackingToken:genId().replace('DLC-','')+genId().replace('DLC-',''),
        status:'pending', serviceType:dest.id||'tour', datetime:f.requestedDate||'',
        address:f.startingPoint||'', passengers:f.passengers||1, days:f.days||1,
        lodging, name:f.customerName||'', phone:f.customerPhone||'',
        notes:f.notes||'', source:'ai_chat',
        driver:null,vehicleLat:null,vehicleLng:null,vehicleHeading:null,etaMinutes:null,
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add({
        type:'new_booking',
        title:'🗺️ Tour '+(dest.name||'')+' — '+(f.customerName||''),
        message:(f.passengers||1)+' người · '+(f.days||1)+' ngày · '+fmtPhone(f.customerPhone)+' · '+fmtDate(f.requestedDate),
        bookingId:orderId, customerPhone:f.customerPhone||'',
        requestedDate:f.requestedDate||'', destination:dest.name||'',
        read:false, createdAt:fv.serverTimestamp(),
      });
    }

    clearDraft(); draft = null;
    return orderId;
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
