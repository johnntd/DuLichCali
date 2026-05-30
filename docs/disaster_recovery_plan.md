# DuLichCali — Disaster Recovery Plan

**Scope:** Firestore data (bookings, vendors, services, promotions, notifications, customers), Firebase Storage, Cloud Functions, Hosting.
**Project:** `dulichcali-booking-calendar` · **Production:** `https://www.dulichcali21.com`

---

## 1. Backup strategy

### 1a. Point-in-Time Recovery (PITR) — first line of defense
Enable Firestore PITR (continuous backup, recover to any minute in the last 7 days):
```
gcloud firestore databases update --database='(default)' --enable-pitr
```
Use for accidental deletes/overwrites discovered within 7 days. Recover a snapshot to a *new* database, inspect, then copy the needed docs back (never overwrite prod blind).

### 1b. Scheduled daily exports to GCS — long-term + offsite
```
# one-time: create a bucket with a retention/lifecycle policy
gsutil mb -l us-west1 gs://dulichcali-firestore-backups
# scheduled daily export (Cloud Scheduler → a small CF or gcloud)
gcloud firestore export gs://dulichcali-firestore-backups/$(date +%Y-%m-%d) \
  --collection-ids='mobileBarberBookings,mobileBarberVendors,mobileBarberServices,mobileBarberAvailability,mobileBarberCustomers,bookings,travel_bookings,vendors,drivers,securityAlerts,auditLogs'
```
Recommended: **daily** exports, **30-day** GCS lifecycle retention, in a *separate* bucket with object-versioning on.

### 1c. Change history — the immutable `auditLogs` collection
Cloud Function triggers (`onMobileBarberBookingAudit` / `…VendorAudit` / `…ServiceAudit`) record every sensitive change (status, payment, price, promotion, vendor settings) with **before/after + actor + timestamp** to `auditLogs`, which is **immutable** (rules: client create/update/delete = false). Use it to see *what changed and revert a specific field* without a full restore.

### Backup schedule (summary)
| Layer | Frequency | Retention | Use |
|---|---|---|---|
| PITR | continuous | 7 days | fast recovery of recent mistakes |
| GCS export | daily | 30 days | full restore / offsite / older incidents |
| auditLogs | per-change | indefinite | field-level history + targeted revert |
| Git | per-commit | indefinite | code/rules/functions rollback |

---

## 2. Recovery procedures

### 2a. Accidental data deletion / corruption
1. Identify *when* and *what* (check `auditLogs` for the change + actor).
2. If < 7 days: PITR — restore to a new DB, export the affected docs, re-import only those.
3. If older: restore the relevant collection from the most recent GCS export to a *staging* database, verify, then copy the docs back.
4. Never `import` over the whole production DB — restore to staging, diff, copy selectively.

### 2b. Booking recovery
- A single booking: read it from PITR/export and re-create via the Admin SDK (rules `delete: if false` already prevents client deletion).
- The immutable `auditLogs` shows the booking's status/payment history for reconstruction.

### 2c. Vendor data + promotion recovery
- `mobileBarberVendors` / `mobileBarberServices` (incl. `promotions`) restore from PITR/export.
- `auditLogs` (VendorAudit/ServiceAudit) shows promo/price changes with before/after → revert a single field by writing the `before` value back (Admin SDK).

### 2d. Vendor account recovery (auth)
- Vendor login = Firebase Auth (email/password) + `vendorUsers/{uid}` mapping (+ `vendors/{id}.setupCode` PIN).
- If a vendor loses access: admin re-issues the `setupCode` and (if needed) resets the Firebase Auth password via the admin panel; the vendor re-registers. The `vendorUsers` mapping is re-created on next login (or by admin, who is allowlisted in the rules).

### 2e. Notification recovery
- Notifications are derived state — they are re-generated from bookings. No separate restore needed; if a notification doc set is lost, re-trigger from the source booking. (Email/SMS sends are fire-and-forget; no replay required.)

### 2f. AI keys
- Keys live in the secured `config/aiSecrets` doc (`read: if false`) and/or Functions secrets — restore from the admin secured form or `functions:secrets:set`. They are NOT in regular backups' readable surface.

---

## 3. Rollback procedure (code / rules / functions)
All code, `firestore.rules`, `storage.rules`, and `functions/` are in Git (`johnntd/DuLichCali`), deployed via Firebase.
- **Hosting:** `git revert <bad-commit>` → `firebase deploy --only hosting`. (Hosting also keeps release history in the console for one-click rollback.)
- **Rules:** revert `firestore.rules`/`storage.rules` in Git → `firebase deploy --only firestore:rules,storage`. The Firebase console also shows rules history.
- **Functions:** revert `functions/` → `firebase deploy --only functions`.
- Always run `node tests/runner.js` + `firebase emulators:exec --only firestore "node tests/security-rules/rules.test.js"` before re-deploying.

---

## 4. Pre-incident checklist (do these once before launch)
- [ ] Enable PITR (`databases update --enable-pitr`).
- [ ] Create the backups bucket + the daily export schedule (Cloud Scheduler).
- [ ] Confirm the audit triggers are deployed (`onMobileBarberBookingAudit` etc.).
- [ ] Verify an export → restore-to-staging dry run succeeds once.
- [ ] Confirm admin can read `auditLogs` (admin email allowlist).

## 5. Contacts / ownership
- Operator/admin: `johnntd@gmail.com` (Firestore `isAdmin()` allowlist).
- Owners: Michael (Orange County), Tim (Bay Area) — vendor-scoped data only.
