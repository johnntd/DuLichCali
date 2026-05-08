(function () {
  'use strict';

  // ── SalonInventoryDeduction ────────────────────────────────────────────────
  // Idempotent inventory deduction for completed appointments.
  // Uses `inventoryDeductionStatus` on the booking doc as an idempotency guard:
  // once set to 'deducted', the same booking will never deduct twice.

  function _db() {
    if (!window.firebase || !firebase.firestore) throw new Error('Firebase chưa sẵn sàng.');
    return firebase.firestore();
  }

  function _bookingRef(db, vendorId, bookingId) {
    return db.collection('vendors').doc(vendorId).collection('bookings').doc(bookingId);
  }

  function _serviceMaterialsRef(db, vendorId, serviceId) {
    return db.collection('vendors').doc(vendorId).collection('serviceMaterials').doc(serviceId);
  }

  function _inventoryRef(db, vendorId, productId) {
    return db.collection('vendors').doc(vendorId).collection('inventory').doc(productId);
  }

  // ── deductForBooking ────────────────────────────────────────────────────────
  // Main entry point. Called after a booking is marked completed.
  //
  // vendorId      — string
  // bookingId     — string
  // servicesArray — array of service ID strings (e.g. selectedServices)
  //
  // Returns Promise<{ deducted: boolean, count: number }>
  //   deducted: true  → deduction applied
  //   deducted: false → already deducted (idempotency guard hit)

  function deductForBooking(vendorId, bookingId, servicesArray) {
    if (!vendorId)  return Promise.reject(new Error('Thiếu vendorId.'));
    if (!bookingId) return Promise.reject(new Error('Thiếu bookingId.'));

    var db = _db();
    var bRef = _bookingRef(db, vendorId, bookingId);

    // Step 1 — idempotency guard: read booking doc first
    return bRef.get().then(function (snap) {
      var data = snap.exists ? snap.data() : {};
      if (data.inventoryDeductionStatus === 'deducted') {
        return { deducted: false, count: 0 };
      }

      var services = Array.isArray(servicesArray) ? servicesArray.filter(Boolean) : [];
      if (!services.length) {
        // No services to map — mark deducted with 0 items so we don't retry forever
        return bRef.update({
          inventoryDeductionStatus: 'deducted',
          inventoryDeductedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () {
          return { deducted: true, count: 0 };
        });
      }

      // Step 2 — load serviceMaterials docs for each service in parallel
      var matPromises = services.map(function (svcId) {
        return _serviceMaterialsRef(db, vendorId, svcId).get().then(function (matSnap) {
          if (!matSnap.exists) return [];
          var matData = matSnap.data();
          return (matData.active !== false) ? (matData.materials || []) : [];
        }).catch(function () {
          return []; // if a service mapping is missing, skip it silently
        });
      });

      return Promise.all(matPromises).then(function (allMaterials) {
        // Step 3 — aggregate deductions: sum qtyPerService per productId across services
        var deductMap = {}; // productId → totalQty
        allMaterials.forEach(function (matArray) {
          matArray.forEach(function (mat) {
            var pid = String(mat.productId || '').trim();
            var qty = Number(mat.qtyPerService) || 0;
            if (!pid || qty <= 0) return;
            deductMap[pid] = (deductMap[pid] || 0) + qty;
          });
        });

        var productIds = Object.keys(deductMap);
        if (!productIds.length) {
          // Mappings exist but no valid product entries — mark done
          return bRef.update({
            inventoryDeductionStatus: 'deducted',
            inventoryDeductedAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then(function () {
            return { deducted: true, count: 0 };
          });
        }

        // Step 4 — read current inventory quantities so we can clamp to minimum 0
        var invPromises = productIds.map(function (pid) {
          return _inventoryRef(db, vendorId, pid).get().then(function (invSnap) {
            return { id: pid, data: invSnap.exists ? invSnap.data() : null };
          }).catch(function () {
            return { id: pid, data: null };
          });
        });

        return Promise.all(invPromises).then(function (invItems) {
          // Step 5 — build a batch write
          var batch = db.batch();
          var fv = firebase.firestore.FieldValue;
          var updatedCount = 0;

          invItems.forEach(function (item) {
            if (!item.data) return; // item doesn't exist — skip
            var deductQty   = deductMap[item.id] || 0;
            var currentQty  = Number(item.data.currentQty) || 0;
            var newQty      = Math.max(0, currentQty - deductQty);

            batch.update(_inventoryRef(db, vendorId, item.id), {
              currentQty: newQty,
              updatedAt:  fv.serverTimestamp()
            });
            updatedCount++;
          });

          // Also stamp the booking doc atomically in the same batch
          batch.update(bRef, {
            inventoryDeductionStatus: 'deducted',
            inventoryDeductedAt: fv.serverTimestamp()
          });

          return batch.commit().then(function () {
            return { deducted: true, count: updatedCount };
          });
        });
      });
    }).catch(function (err) {
      // On any error: try to mark the booking with error status, then rethrow
      try {
        _bookingRef(_db(), vendorId, bookingId).update({
          inventoryDeductionStatus: 'error'
        }).catch(function () {}); // best-effort, ignore secondary failure
      } catch (_) {}
      throw err;
    });
  }

  // ── getDeductionStatus ──────────────────────────────────────────────────────
  // Returns the `inventoryDeductionStatus` string from the booking doc,
  // or null if not set / doc doesn't exist.

  function getDeductionStatus(vendorId, bookingId) {
    if (!vendorId || !bookingId) return Promise.resolve(null);
    var db = _db();
    return _bookingRef(db, vendorId, bookingId).get().then(function (snap) {
      if (!snap.exists) return null;
      return snap.data().inventoryDeductionStatus || null;
    }).catch(function () {
      return null;
    });
  }

  // ── getLowStockItems ────────────────────────────────────────────────────────
  // Returns active inventory items where currentQty <= minQty,
  // ordered by category then name.

  function getLowStockItems(vendorId) {
    if (!vendorId) return Promise.resolve([]);
    var db = _db();
    return db.collection('vendors').doc(vendorId).collection('inventory')
      .where('active', '==', true)
      .orderBy('category')
      .orderBy('name')
      .get()
      .then(function (snap) {
        return snap.docs
          .map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); })
          .filter(function (item) {
            return Number(item.currentQty) <= Number(item.minQty);
          });
      })
      .catch(function () {
        return [];
      });
  }

  // ── Expose ─────────────────────────────────────────────────────────────────

  window.SalonInventoryDeduction = {
    deductForBooking:   deductForBooking,
    getDeductionStatus: getDeductionStatus,
    getLowStockItems:   getLowStockItems
  };
})();
