/* Trip Task Tracker — pure helpers (browser IIFE + node-testable, like tc-media.js / tc-tasks.test.js).
 * priority(type)        — P0 urgent / P1 important / P2 optional, per the spec's tiers.
 * computeBalances(...)  — (P2) per-family owed/paid/balance + total-paid/remaining rollup.
 * No DOM / Firebase deps. */
(function (root) {
  'use strict';
  var P0 = { flight: 1, bus: 1, train: 1, rental_car: 1, hotel: 1, airbnb: 1, attraction: 1 };
  var P1 = { ride: 1, restaurant: 1, parking: 1, tour: 1 };

  // Priority for a task type. opts.priority (P0/P1/P2) is an explicit user/AI override.
  function priority(type, opts) {
    opts = opts || {};
    if (opts.priority === 'P0' || opts.priority === 'P1' || opts.priority === 'P2') return opts.priority;
    var t = String(type || '').toLowerCase();
    if (P0[t]) return 'P0';
    if (P1[t]) return 'P1';
    return 'P2'; // packing, payment, confirmation, album, clips, backup, other, unknown
  }

  // (P2) Reconcile estimates/payments into per-family balances.
  //   tasks   = [{ costEstimate?, actualCost?, paidBy?(familyId), splitMode?, splitBetween?[] }]
  //   families= [{ id, name, travelers }] ; split = { mode } default 'per_person'
  //   ledger  = [{ familyId, amount, paid }]  (ad-hoc payments)
  // Returns { perFamily:[{id,name,owed,paid,balance}], totalEstimated, totalActual, totalPaid, remaining }.
  function computeBalances(tasks, families, split, ledger) {
    tasks = tasks || []; families = families || []; split = split || { mode: 'per_person' }; ledger = ledger || [];
    var totalTravelers = families.reduce(function (s, f) { return s + (f.travelers || 1); }, 0) || 1;
    var owed = {}, paid = {};
    families.forEach(function (f) { owed[f.id] = 0; paid[f.id] = 0; });
    function num(x) { var m = String(x == null ? '' : x).replace(/[, $]/g, '').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; }
    var totalEstimated = 0, totalActual = 0;
    tasks.forEach(function (tk) {
      var est = num(tk.costEstimate), act = num(tk.actualCost);
      totalEstimated += est; totalActual += act;
      var amount = act || est; if (!(amount > 0)) return;
      // who owes this task's amount: explicit splitBetween, else the trip split mode.
      var sb = (Array.isArray(tk.splitBetween) && tk.splitBetween.length) ? tk.splitBetween : null;
      var mode = tk.splitMode || split.mode || 'per_person';
      var targets = sb ? families.filter(function (f) { return sb.indexOf(f.id) !== -1; }) : families;
      if (!targets.length) targets = families;
      var tt = targets.reduce(function (s, f) { return s + (f.travelers || 1); }, 0) || 1;
      targets.forEach(function (f) {
        var share = (mode === 'equal') ? amount / targets.length
          : (mode === 'owner_pays') ? 0
          : amount * (f.travelers || 1) / tt; // per_person / per_family default → headcount
        if (owed[f.id] != null) owed[f.id] += share;
      });
      if (mode === 'owner_pays' && targets[0] && owed[targets[0].id] != null) owed[targets[0].id] += amount;
      // who PAID this task: the paidBy family (actual amount).
      if (tk.paidBy && paid[tk.paidBy] != null && act > 0) paid[tk.paidBy] += act;
    });
    // ad-hoc ledger payments
    ledger.forEach(function (e) { if (e && e.paid && paid[e.familyId] != null) paid[e.familyId] += (+e.amount || 0); });
    var perFamily = families.map(function (f) {
      var o = Math.round(owed[f.id] || 0), p = Math.round(paid[f.id] || 0);
      return { id: f.id, name: f.name || '', owed: o, paid: p, balance: o - p };
    });
    var totalPaid = perFamily.reduce(function (s, f) { return s + f.paid; }, 0);
    return { perFamily: perFamily, totalEstimated: Math.round(totalEstimated), totalActual: Math.round(totalActual), totalPaid: totalPaid, remaining: Math.max(0, Math.round(totalActual || totalEstimated) - totalPaid) };
  }

  // Done set + checkbox toggle. A task is "done" when its bookingStatus is a completion state.
  var DONE = { booked: 1, paid: 1, skipped: 1, not_needed: 1, completed: 1 };
  function isDone(task) { return !!(task && DONE[task.bookingStatus]); }
  // Toggle a task's completion (pure mutation of the task object — caller persists + re-renders).
  //   done=true  → remember the prior status (unless already a done-state), set 'completed' + stamp
  //                completedAt / completedBy / completedByName.
  //   done=false → restore the remembered prior status (else 'research_needed') + clear the stamps.
  function setDone(task, done, opts) {
    opts = opts || {};
    if (!task) return task;
    if (done) {
      if (!DONE[task.bookingStatus]) task._prevStatus = task.bookingStatus || 'research_needed';
      task.bookingStatus = 'completed';
      task.completedAt = opts.nowIso || '';
      task.completedBy = opts.by || '';
      task.completedByName = opts.byName || '';
    } else {
      task.bookingStatus = (task._prevStatus && task._prevStatus !== 'completed') ? task._prevStatus : 'research_needed';
      delete task._prevStatus;
      task.completedAt = ''; task.completedBy = ''; task.completedByName = '';
    }
    return task;
  }

  // Per-member cost rollup (V6). Each task's cost is attributed to a named member:
  //  - assignedToMember → that member owes the whole task.
  //  - else assignedToFamily (with a member roster) → split equally among that family's members.
  //  - else → unassigned (no member resolution).
  //   families = [{ id, name, members:[{id,name}] }]
  // Returns { perMember:[{id,name,familyId,familyName,owed}], unassigned, total }.
  function memberCosts(tasks, families) {
    tasks = tasks || []; families = families || [];
    var memById = {}, famById = {}, owed = {};
    families.forEach(function (f) {
      famById[f.id] = f;
      (f.members || []).forEach(function (m) { if (!m || !m.id) return; memById[m.id] = { id: m.id, name: m.name || '', familyId: f.id, familyName: f.name || '' }; owed[m.id] = 0; });
    });
    function num(x) { var m = String(x == null ? '' : x).replace(/[, $]/g, '').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; }
    var unassigned = 0, total = 0;
    tasks.forEach(function (tk) {
      // Cost basis: what was actually paid → estimate → the low end of a "$lo–$hi" priceRange
      // (conservative, so a member is never told they owe an inflated number).
      var amt = num(tk.actualCost) || num(tk.costEstimate) || num(tk.priceRange); if (!(amt > 0)) return;
      total += amt;
      if (tk.assignedToMember && memById[tk.assignedToMember]) { owed[tk.assignedToMember] += amt; return; }
      if (tk.assignedToFamily && famById[tk.assignedToFamily]) {
        var mems = famById[tk.assignedToFamily].members || [];
        if (mems.length) { var share = amt / mems.length; mems.forEach(function (m) { if (owed[m.id] != null) owed[m.id] += share; }); return; }
      }
      unassigned += amt;
    });
    var perMember = Object.keys(owed).map(function (id) { var m = memById[id]; return { id: id, name: m.name, familyId: m.familyId, familyName: m.familyName, owed: Math.round(owed[id]) }; })
      .filter(function (r) { return r.owed > 0; });
    return { perMember: perMember, unassigned: Math.round(unassigned), total: Math.round(total) };
  }

  root.TCTasks = { priority: priority, computeBalances: computeBalances, memberCosts: memberCosts, isDone: isDone, setDone: setDone };
})(typeof window !== 'undefined' ? window : this);
