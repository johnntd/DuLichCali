/* tc-overview.js — pure Overview metrics for the Travel Concierge V4 landing tab.
   Browser IIFE exposing window.TCOverview; node-testable (no DOM). Derives readiness %,
   the single highest-priority next action, and per-category status chips from the task
   list produced by deriveTripTasks(tr) (i.e. tr.bookings). Presentation-layer only —
   never fabricates data. */
(function (root) {
  var DONE = { booked: 1, paid: 1, skipped: 1, not_needed: 1 };
  var PRIO = { P0: 0, P1: 1, P2: 2 };
  function isDone(tk) { return !!(tk && DONE[tk.status]); }
  function prioRank(tk) { var p = (tk && tk.priority) || 'P2'; return PRIO[p] == null ? 2 : PRIO[p]; }

  // Which readiness category a task rolls up to. Maps task categories/types to the four
  // hero chips. Unknown categories fall through to 'other' (not shown as a chip).
  function categoryOf(tk) {
    var c = String((tk && (tk.category || tk.type)) || '').toLowerCase();
    if (/stay|hotel|airbnb|lodg/.test(c)) return 'stay';
    if (/transport|flight|bus|train|car|ride|parking/.test(c)) return 'transport';
    if (/activit|attraction|ticket|tour|event/.test(c)) return 'activities';
    if (/food|restaurant|dining/.test(c)) return 'food';
    return 'other';
  }

  function readiness(tasks) {
    var list = tasks || [], total = list.length;
    var done = list.filter(isDone).length;
    return { doneCount: done, totalCount: total, pct: total ? Math.round(100 * done / total) : 100 };
  }

  function nextAction(tasks) {
    var open = (tasks || []).filter(function (tk) { return !isDone(tk); });
    if (!open.length) return null;
    open.sort(function (a, b) {
      var pr = prioRank(a) - prioRank(b); if (pr) return pr;
      var da = a && a.dueDate ? String(a.dueDate) : '~', db = b && b.dueDate ? String(b.dueDate) : '~';
      if (da !== db) return da < db ? -1 : 1;
      return 0;
    });
    var tk = open[0];
    return { title: tk.title || tk.name || '', priority: tk.priority || 'P2', taskKey: tk.key || tk.id || '', category: categoryOf(tk) };
  }

  function statusChips(tasks) {
    var TABS = { stay: 'stay', transport: 'transport', activities: 'itinerary', food: 'food' };
    var groups = {};
    (tasks || []).forEach(function (tk) {
      var cat = categoryOf(tk); if (cat === 'other') return;
      if (!groups[cat]) groups[cat] = { warn: false };
      // warn only if a P0/P1 task is still open; P2 stragglers don't downgrade readiness chips
      if (!isDone(tk) && prioRank(tk) <= 1) groups[cat].warn = true;
    });
    return ['stay', 'transport', 'activities', 'food'].filter(function (k) { return groups[k]; })
      .map(function (k) { return { key: k, state: groups[k].warn ? 'warn' : 'ok', tab: TABS[k] }; });
  }

  root.TCOverview = { readiness: readiness, nextAction: nextAction, statusChips: statusChips, _categoryOf: categoryOf };
})(typeof window !== 'undefined' ? window : this);
