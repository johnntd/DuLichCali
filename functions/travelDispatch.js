'use strict';

/**
 * travelDispatch.js — Intelligent travel booking dispatch service
 *
 * Assigns the best available driver(s) to a travel_bookings document,
 * respects per-driver capacity and date availability, and queues
 * driver-notification emails via the existing emailQueue pipeline.
 *
 * Design principles:
 *  - Additive only: does NOT modify or replace any existing booking logic
 *  - No hardcoded capacities, driver names, or vehicle types
 *  - Greedy capacity matching: fewest drivers needed to cover group size
 *  - Fail-safe: dispatch failure never blocks or corrupts the booking
 *  - Future-proof: add new drivers/vehicles to Firestore; logic auto-adjusts
 *
 * Firestore collections used:
 *  travel_drivers/{id}                      — driver profiles + capacity
 *  travel_vehicles/{id}                     — vehicle seat counts
 *  travel_drivers/{id}/assigned_dates/{date}— per-driver availability calendar
 *  travel_dispatch/{bookingId}              — dispatch audit trail
 *  travel_bookings/{bookingId}              — updated with assignment result
 *  vendors/admin-dlc/emailQueue/{docId}     — existing email queue pipeline
 */

const admin = require('firebase-admin');

// ── Collection name constants — change here if Firestore schema changes ──────
const COL_DRIVERS     = 'travel_drivers';
const COL_VEHICLES    = 'travel_vehicles';
const COL_BOOKINGS    = 'travel_bookings';
const COL_DISPATCH    = 'travel_dispatch';
const COL_ASSIGNMENTS = 'travelAssignments';

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Assign drivers to a travel booking, mark their calendars, and send
 * notification emails. Called from onTravelBookingCreated cloud function.
 *
 * @param {object} booking   - Booking document data
 * @param {string} bookingId - Booking document ID
 * @returns {Promise<object>} - Dispatch result object
 */
async function assignDrivers(booking, bookingId) {
  const db = admin.firestore();

  const region       = booking.pickup_region || 'bayarea';
  const travelDate   = booking.travel_date   || booking.date  || '';
  const travelers    = Math.max(1, parseInt(booking.travelers || booking.traveler_count || 1, 10));
  const durationDays = Math.max(1, parseInt(booking.duration_days || 1, 10));

  // All calendar dates this tour occupies (start date + duration - 1 extra days)
  const bookedDates  = travelDate ? _dateRange(travelDate, durationDays) : [];

  console.log(`[Dispatch] ${bookingId} | region=${region} date=${travelDate} days=${durationDays} travelers=${travelers}`);

  // ── 1. Fetch all active drivers in this region ────────────────────────────
  const driversSnap = await db.collection(COL_DRIVERS)
    .where('active', '==', true)
    .where('region', '==', region)
    .get();

  if (driversSnap.empty) {
    console.log(`[Dispatch] no drivers found for region "${region}"`);
    return _writeDispatch(db, bookingId, {
      assignment_type:     'manual_required',
      reason:              'no_drivers_in_region',
      region,
      travelers,
      assigned_driver_ids: [],
      assigned_drivers:    [],
    });
  }

  const allDrivers = driversSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`[Dispatch] found ${allDrivers.length} driver(s) in region "${region}"`);

  // ── 2. Fetch vehicle seat counts (parallel) ───────────────────────────────
  const vehicleIds = [...new Set(allDrivers.map(d => d.vehicle_id).filter(Boolean))];
  const vehicleMap = {};
  await Promise.all(vehicleIds.map(async vid => {
    const vDoc = await db.collection(COL_VEHICLES).doc(vid).get();
    if (vDoc.exists) vehicleMap[vid] = vDoc.data();
  }));

  // Attach capacity from vehicle seats, falling back to driver.vehicle_capacity
  const driversWithCapacity = allDrivers.map(driver => {
    const vehicle  = vehicleMap[driver.vehicle_id] || null;
    const capacity = vehicle
      ? (parseInt(vehicle.seats, 10) || 0)
      : (parseInt(driver.vehicle_capacity, 10) || 0);
    return { ...driver, _vehicle: vehicle, capacity };
  });

  // ── 3. Filter by date availability (parallel) ─────────────────────────────
  // A driver is available only if ALL days in the tour range are free.
  let available = [];
  if (bookedDates.length) {
    const checks = await Promise.all(
      driversWithCapacity.map(async driver => {
        const calSnaps = await Promise.all(
          bookedDates.map(d =>
            db.collection(COL_DRIVERS).doc(driver.id)
              .collection('assigned_dates').doc(d).get()
          )
        );
        const busyDate = calSnaps.find(s => s.exists);
        return { driver, available: !busyDate, busyDate: busyDate ? busyDate.id : null };
      })
    );
    available = checks.filter(c => c.available).map(c => c.driver);
    const busy = checks.filter(c => !c.available);
    if (busy.length) {
      busy.forEach(c =>
        console.log(`[Dispatch] driver ${c.driver.id} busy on ${c.busyDate}`)
      );
    }
  } else {
    // No date provided — skip calendar check, treat all as available
    available = [...driversWithCapacity];
  }

  if (available.length === 0) {
    console.log(`[Dispatch] all drivers unavailable for dates [${bookedDates.join(', ')}]`);
    return _writeDispatch(db, bookingId, {
      assignment_type:       'manual_required',
      reason:                'no_available_drivers',
      region,
      travelers,
      travel_date:           travelDate,
      total_drivers_checked: allDrivers.length,
      assigned_driver_ids:   [],
      assigned_drivers:      [],
    });
  }

  // ── 4. Greedy capacity assignment (minimize driver count) ─────────────────
  // Sort: largest capacity first (fewest vehicles to cover group).
  // Tie-break: higher rating, then more experience.
  available.sort((a, b) => {
    if (b.capacity !== a.capacity) return b.capacity - a.capacity;
    if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
    return (b.years_experience || 0) - (a.years_experience || 0);
  });

  const assigned = [];
  let remaining  = travelers;

  for (const driver of available) {
    if (remaining <= 0) break;
    assigned.push(driver);
    remaining -= driver.capacity;
  }

  const totalCapacity = assigned.reduce((s, d) => s + d.capacity, 0);
  if (totalCapacity < travelers) {
    console.log(`[Dispatch] insufficient capacity: need ${travelers}, have ${available.reduce((s,d)=>s+d.capacity,0)}`);
    return _writeDispatch(db, bookingId, {
      assignment_type:          'manual_required',
      reason:                   'insufficient_capacity',
      region,
      travelers,
      total_available_capacity: available.reduce((s, d) => s + d.capacity, 0),
      available_driver_count:   available.length,
      travel_date:              travelDate,
      assigned_driver_ids:      [],
      assigned_drivers:         [],
    });
  }

  // ── 5. Build result ───────────────────────────────────────────────────────
  const assignmentType = assigned.length === 1 ? 'single' : 'multi';
  const assignedIds    = assigned.map(d => d.id);

  const assignedDriverSummaries = assigned.map(d => ({
    id:           d.id,
    name:         d.full_name || d.name,
    phone:        d.phone         || '',
    email:        d.email         || null,
    vehicle_id:   d.vehicle_id    || '',
    vehicle_name: d._vehicle ? d._vehicle.name : (d.vehicle_name || ''),
    capacity:     d.capacity,
    region:       d.region,
  }));

  const dispatchResult = {
    assignment_type:     assignmentType,
    assigned_driver_ids: assignedIds,
    assigned_drivers:    assignedDriverSummaries,
    region,
    travelers,
    travel_date:         travelDate,
    booked_dates:        bookedDates,
  };

  // ── 6. Persist dispatch record ────────────────────────────────────────────
  await _writeDispatch(db, bookingId, dispatchResult);

  // ── 7. Atomically mark each assigned driver's calendar (race-safe) ────────
  // Use a transaction per driver: re-verify all tour dates are still free,
  // then write all at once. If another booking just grabbed a date, fall back
  // to manual rather than double-booking.
  if (bookedDates.length) {
    let calendarConflict = false;
    await Promise.all(assigned.map(async driver => {
      const calRefs = bookedDates.map(d =>
        db.collection(COL_DRIVERS).doc(driver.id)
          .collection('assigned_dates').doc(d)
      );
      try {
        await db.runTransaction(async txn => {
          const snaps = await txn.getAll(...calRefs);
          const clash = snaps.find(s => s.exists && s.data().bookingId !== bookingId);
          if (clash) {
            calendarConflict = true;
            console.warn(`[Dispatch] race conflict: driver ${driver.id} on ${clash.id} already taken`);
            throw new Error('calendar_conflict');
          }
          const calPayload = {
            bookingId,
            travelers,
            duration_days:   durationDays,
            assignment_type: assignmentType,
            assigned_at:     admin.firestore.FieldValue.serverTimestamp(),
          };
          calRefs.forEach(ref => txn.set(ref, calPayload));
        });
      } catch (err) {
        if (err.message !== 'calendar_conflict') throw err;
      }
    }));

    if (calendarConflict) {
      console.warn(`[Dispatch] calendar conflict detected for ${bookingId} — marking manual`);
      await db.collection(COL_BOOKINGS).doc(bookingId).update({
        dispatch_status: 'manual_required',
        dispatch_reason: 'calendar_conflict_race',
        dispatched_at:   admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      return _writeDispatch(db, bookingId, {
        assignment_type:     'manual_required',
        reason:              'calendar_conflict_race',
        region,
        travelers,
        travel_date:         travelDate,
        assigned_driver_ids: [],
        assigned_drivers:    [],
      });
    }
  }

  // ── 8. Stamp booking with assignment ─────────────────────────────────────
  await db.collection(COL_BOOKINGS).doc(bookingId).update({
    assigned_driver_ids: assignedIds,
    assignment_type:     assignmentType,
    dispatch_status:     'assigned',
    dispatched_at:       admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── 9. Notify assigned drivers ────────────────────────────────────────────
  await _notifyDrivers(db, booking, bookingId, dispatchResult);

  console.log(`[Dispatch] ${bookingId} → ${assignmentType}: [${assignedIds.join(', ')}]`);
  return dispatchResult;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Return an array of ISO date strings [startDate, ..., startDate + (days-1)].
 * e.g. _dateRange('2026-04-20', 2) → ['2026-04-20', '2026-04-21']
 */
function _dateRange(startDate, days) {
  const dates = [];
  const [y, m, d] = startDate.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  for (let i = 0; i < days; i++) {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + i);
    const iso = dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0');
    dates.push(iso);
  }
  return dates;
}

/**
 * Write a dispatch result to travel_dispatch/{bookingId}.
 * For manual_required results, also stamps the booking.
 */
async function _writeDispatch(db, bookingId, result) {
  await db.collection(COL_DISPATCH).doc(bookingId).set({
    ...result,
    bookingId,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (result.assignment_type === 'manual_required') {
    await db.collection(COL_BOOKINGS).doc(bookingId).update({
      dispatch_status: 'manual_required',
      dispatch_reason: result.reason || 'unknown',
      dispatched_at:   admin.firestore.FieldValue.serverTimestamp(),
    }).catch(err =>
      console.warn(`[Dispatch] could not stamp booking ${bookingId}:`, err.message)
    );
  }

  return result;
}

/**
 * Write a travelAssignments document for each assigned driver so they can
 * see the booking in their driver portal (driver-admin.html).
 * The portal queries travelAssignments where travel_driver_id == driver.travel_driver_id.
 */
async function _notifyDrivers(db, booking, bookingId, dispatch) {
  const { assigned_drivers, assignment_type } = dispatch;
  if (!assigned_drivers || assigned_drivers.length === 0) return;

  const coDriverNames = assignment_type === 'multi'
    ? assigned_drivers.map(d => `${d.name} (${d.vehicle_name || d.vehicle_id || ''})`).join(', ')
    : null;

  const assignRef = db.collection(COL_ASSIGNMENTS);

  await Promise.all(assigned_drivers.map(driver => {
    // Idempotent doc ID — safe to retry if the function re-runs
    const docId = `${bookingId}_driver_${driver.id}`;
    return assignRef.doc(docId).set({
      // Portal query key — matches drivers/{id}.travel_driver_id field
      travel_driver_id: driver.id,

      bookingId,
      driverName:     driver.name,

      // Booking details the driver sees in the portal card
      customerName:   booking.customer_name  || '',
      customerPhone:  booking.customer_phone || '',
      customerEmail:  booking.customer_email || '',
      pickupAddress:  booking.pickup_address || booking.pickup_location || '',
      pickupRegion:   booking.pickup_region  || '',
      travelDate:     booking.travel_date    || booking.date  || '',
      travelers:      parseInt(booking.travelers || booking.traveler_count || 1, 10),
      bookingMode:    booking.booking_mode   || booking.type  || '',
      packageName:    booking.packageName    || booking.package_slug || '',
      notes:          booking.notes          || '',
      total:          booking.total          || 0,
      driverPhone:    driver.phone           || '',

      // Multi-driver coordination
      assignmentType: assignment_type,
      coDrivers:      coDriverNames,

      status:        'assigned',
      notif_status:  'new',
      assignedAt:    admin.firestore.FieldValue.serverTimestamp(),
    });
  }));

  console.log(`[Dispatch] wrote ${assigned_drivers.length} travelAssignment portal doc(s)`);
}

module.exports = { assignDrivers };
