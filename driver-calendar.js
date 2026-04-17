/* driver-calendar.js — Weekly calendar view for driver portal
 * Displays ride bookings (blue) and tour assignments (gold) on a 7-day week grid.
 * Multi-day tours span all their dates. Call DLCCalendar.renderCalendar(tours, rides)
 * whenever the underlying data changes.
 */
(function(global) {
  'use strict';

  var _weekOffset = 0; // 0 = current week

  function _mondayOf(offset) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    var dow = d.getDay(); // 0 = Sun
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
    return d;
  }

  function _isoDate(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function _addDays(d, n) {
    var r = new Date(d.getTime());
    r.setDate(r.getDate() + n);
    return r;
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderCalendar(tours, rides) {
    var container = document.getElementById('calendarContent');
    if (!container) return;

    var monday = _mondayOf(_weekOffset);
    var days   = [];
    for (var i = 0; i < 7; i++) days.push(_addDays(monday, i));

    var todayIso = _isoDate(new Date());

    // Build day map: ISO date → [{label, color, status}]
    var dayMap = {};
    days.forEach(function(d) { dayMap[_isoDate(d)] = []; });

    // Tours — block each day in the tour range
    (tours || []).forEach(function(t) {
      if (!t.travelDate) return;
      var dur = Math.max(1, parseInt(t.duration_days || 1, 10));
      var parts = t.travelDate.split('-').map(Number);
      var startD = new Date(parts[0], parts[1] - 1, parts[2]);
      for (var i = 0; i < dur; i++) {
        var dayD = _addDays(startD, i);
        var iso  = _isoDate(dayD);
        if (!dayMap[iso]) continue;
        dayMap[iso].push({
          label:  (t.customerName || 'Tour') + (dur > 1 ? ' D' + (i + 1) + '/' + dur : ''),
          color:  'gold',
          status: t.status || 'assigned',
          detail: (t.packageName || 'Tour') + ' · ' + (t.travelers || 1) + ' khách · ' + (t.pickupAddress || ''),
        });
      }
    });

    // Ride bookings — single day at pickup time
    (rides || []).forEach(function(r) {
      if (r._type === 'tour') return; // skip tour entries already added above
      if (!r._pickupMs) return;
      var iso = _isoDate(new Date(r._pickupMs));
      if (!dayMap[iso]) return;
      var when = r._parsedTime || '';
      dayMap[iso].push({
        label:  (r.name || r.customerName || 'Chuyến Xe') + (when ? ' ' + when : ''),
        color:  'blue',
        status: r.status || 'assigned',
        detail: (r.serviceType || 'Chuyến Xe') + ' · ' + (r.passengers || 1) + ' người · ' + (r.pickupAddress || r.address || ''),
      });
    });

    var DAYS_SHORT  = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    var MONTHS_VI   = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
    var startLabel  = days[0].getDate() + ' ' + MONTHS_VI[days[0].getMonth()];
    var endLabel    = days[6].getDate() + ' ' + MONTHS_VI[days[6].getMonth()] + ' ' + days[6].getFullYear();
    var weekLabel   = startLabel + ' – ' + endLabel;

    var hasAnyBooking = days.some(function(d) { return dayMap[_isoDate(d)].length > 0; });

    container.innerHTML =
      '<div class="cal-nav">' +
        '<button class="cal-nav-btn" onclick="DLCCalendar.prevWeek()">‹</button>' +
        '<span class="cal-week-label">' + _esc(weekLabel) + '</span>' +
        '<button class="cal-nav-btn" onclick="DLCCalendar.nextWeek()">›</button>' +
      '</div>' +
      '<div class="cal-legend">' +
        '<span class="cal-legend-dot cal-legend-dot--gold"></span> Tour ' +
        '<span class="cal-legend-dot cal-legend-dot--blue" style="margin-left:.5rem"></span> Chuyến Xe' +
      '</div>' +
      '<div class="cal-grid">' +
        days.map(function(d, i) {
          var iso    = _isoDate(d);
          var isToday = iso === todayIso;
          var blocks = dayMap[iso] || [];
          return '<div class="cal-day' + (isToday ? ' cal-day--today' : '') + '">' +
            '<div class="cal-day-hdr">' +
              '<div class="cal-day-name">' + DAYS_SHORT[i] + '</div>' +
              '<div class="cal-day-num' + (isToday ? ' cal-day-num--today' : '') + '">' + d.getDate() + '</div>' +
            '</div>' +
            '<div class="cal-day-body">' +
              (blocks.length === 0
                ? '<div class="cal-empty-dot"></div>'
                : blocks.map(function(b) {
                    return '<div class="cal-block cal-block--' + b.color + '" title="' + _esc(b.detail) + '">' +
                      '<span class="cal-block-label">' + _esc(b.label) + '</span>' +
                    '</div>';
                  }).join('')
              ) +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      (!hasAnyBooking
        ? '<div class="cal-empty-week">Không có booking tuần này</div>'
        : ''
      );
  }

  function prevWeek() { _weekOffset--; _triggerRefresh(); }
  function nextWeek() { _weekOffset++; _triggerRefresh(); }

  var _refreshFn = null;
  function setRefreshFn(fn) { _refreshFn = fn; }
  function _triggerRefresh() { if (_refreshFn) _refreshFn(); }

  global.DLCCalendar = {
    renderCalendar: renderCalendar,
    prevWeek:       prevWeek,
    nextWeek:       nextWeek,
    setRefreshFn:   setRefreshFn,
  };

})(window);
