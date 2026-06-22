/* tc-depgraph.js — V6 Dependency Graph + Booking Engine (pure, node-testable; window.TCDepGraph).
 * Derives task dependencies DETERMINISTICALLY from the trip's journey order — no AI, no DOM, no
 * Firebase. The caller tags each booking/task into a node { id, kind, city, journeyIndex, status,
 * dueDate?, daysUntilDue?, votes?, pinned?, locked?, type?, title? } and this module computes
 * dependencies[], blocked/blockedReason, priorityScore, the single nextAction, and per-group progress.
 *
 * Rules (deterministic, journey-ordered):
 *  - transport(K)  depends on the nearest PRIOR transport (largest transport idx < K).
 *  - lodging(node) depends on its INBOUND transport (largest transport idx <= node.idx).
 *  - ticket/activity/food(node) depends on its INBOUND transport AND the lodging at the same segment.
 *  - return transport is covered transitively by the sequential transport chain.
 * A node is BLOCKED when any dependency is not DONE. Derived fields are recomputed every build
 * (self-healing on any status/date/vote change) and are never persisted as truth. */
(function (root) {
  'use strict';
  var DONE = { booked: 1, paid: 1, completed: 1, skipped: 1, not_needed: 1 };
  var KIND_WEIGHT = { transport: 100, lodging: 80, ticket: 60, activity: 45, food: 30, optional: 10 };
  function isDone(n) { return !!(n && DONE[n.status]); }
  function idx(n) { var j = n && n.journeyIndex; return (typeof j === 'number') ? j : 1e9; }
  // Journey sequence position: process the trip in order, and WITHIN a segment do transport →
  // lodging → tickets → activities → food → optional. This places a segment's hotel/tickets BEFORE
  // the NEXT leg (so "Book SD hotel" comes before the SD→OC return leg), matching the success test.
  var KIND_RANK = { transport: 0, lodging: 1, ticket: 2, activity: 3, food: 4, optional: 5 };
  function seq(n) { var k = KIND_RANK[n.kind]; return idx(n) * 10 + (k == null ? 5 : k); }

  function build(nodes) {
    nodes = (nodes || []).slice();
    var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
    var transports = nodes.filter(function (n) { return n.kind === 'transport'; })
      .sort(function (a, b) { return idx(a) - idx(b); });

    // nearest prior transport (strictly before index K)
    function priorTransport(k) { var best = null; transports.forEach(function (tn) { if (idx(tn) < k) best = tn; }); return best; }
    // inbound transport for a segment (largest transport idx <= K)
    function inboundTransport(k) { var best = null; transports.forEach(function (tn) { if (idx(tn) <= k) best = tn; }); return best; }
    // lodging at the same segment index
    function lodgingAt(k, selfId) { return nodes.filter(function (n) { return n.kind === 'lodging' && idx(n) === k && n.id !== selfId; })[0] || null; }

    var inDegree = {};
    nodes.forEach(function (n) {
      var deps = [];
      if (idx(n) >= 1e9) { n.dependencies = []; return; } // unscheduled (no journey position) → no deps
      if (n.kind === 'transport') {
        var pt = priorTransport(idx(n)); if (pt) deps.push(pt.id);
      } else {
        var inb = inboundTransport(idx(n)); if (inb && inb.id !== n.id) deps.push(inb.id);
        if (n.kind !== 'lodging') { var lg = lodgingAt(idx(n), n.id); if (lg) deps.push(lg.id); }
      }
      n.dependencies = deps;
      deps.forEach(function (d) { inDegree[d] = (inDegree[d] || 0) + 1; });
    });

    // blocked + reason (reason from the first not-done dependency's kind)
    nodes.forEach(function (n) {
      var firstMissing = null;
      (n.dependencies || []).forEach(function (d) { if (!firstMissing && byId[d] && !isDone(byId[d])) firstMissing = byId[d]; });
      n.blocked = !!firstMissing && !isDone(n);
      n.blockedReason = !n.blocked ? '' : (firstMissing.kind === 'transport'
        ? (n.kind === 'transport' ? 'missing_prior_leg' : 'missing_transport')
        : (firstMissing.kind === 'lodging' ? 'missing_stay' : 'missing_dependency'));
    });

    // priorityScore = kind weight + due urgency + in-degree (how many wait on it) + votes + pinned
    nodes.forEach(function (n) {
      var w = KIND_WEIGHT[n.kind] != null ? KIND_WEIGHT[n.kind] : 10;
      var due = (typeof n.daysUntilDue === 'number') ? Math.max(0, 30 - n.daysUntilDue) : 0;
      var votes = (typeof n.votes === 'number') ? n.votes : 0;
      n.priorityScore = w + due + (inDegree[n.id] || 0) * 5 + votes * 3 + (n.pinned ? 20 : 0);
    });

    return { nodes: nodes, nextAction: nextAction(nodes), progress: progress(nodes) };
  }

  function nextAction(nodes) {
    var actionable = (nodes || []).filter(function (n) { return !isDone(n) && !n.blocked && idx(n) < 1e9; });
    if (!actionable.length) {
      // fall back to the earliest not-done scheduled node (the unblocking prerequisite)
      var rest = (nodes || []).filter(function (n) { return !isDone(n) && idx(n) < 1e9; })
        .sort(function (a, b) { return seq(a) - seq(b); });
      return rest[0] || null;
    }
    // The next thing to do = the earliest step in the journey (transport→lodging→tickets within a
    // segment). A sooner-due item can jump ahead within the same journey segment (urgency tiebreak).
    actionable.sort(function (a, b) {
      if (seq(a) !== seq(b)) return seq(a) - seq(b);
      return (b.priorityScore || 0) - (a.priorityScore || 0);
    });
    return actionable[0];
  }

  function progress(nodes) {
    nodes = nodes || [];
    var groups = { transport: 'transport', lodging: 'hotels', ticket: 'tickets', activity: 'activities', food: 'food' };
    var tally = { transport: [0, 0], hotels: [0, 0], tickets: [0, 0], activities: [0, 0], food: [0, 0] };
    var dn = 0, tot = 0;
    nodes.forEach(function (n) {
      tot++; if (isDone(n)) dn++;
      var g = groups[n.kind]; if (!g) return;
      tally[g][1]++; if (isDone(n)) tally[g][0]++;
    });
    function pct(p) { return p[1] ? Math.round(100 * p[0] / p[1]) : 100; }
    return {
      transport: pct(tally.transport), hotels: pct(tally.hotels), tickets: pct(tally.tickets),
      activities: pct(tally.activities), food: pct(tally.food),
      overall: tot ? Math.round(100 * dn / tot) : 100,
    };
  }

  root.TCDepGraph = { build: build, nextAction: nextAction, progress: progress, isDone: isDone, _KIND_WEIGHT: KIND_WEIGHT };
})(typeof window !== 'undefined' ? window : this);
