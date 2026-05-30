PRE-PRODUCTION SECURITY AUDIT + FIX — DuLichCali

We are preparing for real production launch. Run a thorough security audit across
the webapp and backend rules, then FIX any critical/high issue found.

Goal: find and fix any flaw that lets a malicious user take over the webapp,
modify vendor data, modify bookings, impersonate vendors/drivers, view private
customer data, create fake bookings/spam, abuse AI endpoints, change
promotions/prices/services, inject scripts/content, access admin/vendor portals
without permission, exploit Firestore rules, abuse Storage uploads, expose API
keys/secrets, or damage production data.

Do NOT deploy until this audit is complete.

== SCOPE ==
Audit all public + private areas: homepage, marketplace, mobile barber, barber
vendor portal, unified owner portal, driver/admin portal, ride/airport booking,
tour booking, food vendor, salon vendor, AI chat/voice agents, notifications,
promotions, payments/Zelle, Firebase/Firestore, Firebase Storage, Cloud
Functions/API routes, deployment config, env variables, static assets/scripts.

== SECURITY AREAS ==
1. Authentication — vendor/owner/driver/admin portals require login; anonymous
   users can only create safe booking requests; no portal reachable by URL only.
2. Authorization — ownership isolation enforced by Firestore rules, not just UI.
3. Firestore rules — per-collection create/read/update/delete correctness.
4. Booking abuse / spam — idempotency, duplicate guard, rate limiting.
5. Data validation — phone/name/address/serviceId/vendorId/date/price/status/etc.
6. XSS / script injection — textContent vs innerHTML; sanitize/escape.
7. AI prompt / tool abuse — no price/status/vendorId trust; live guard; no secret leak.
8. API keys / secrets — no private keys/service accounts committed; backend-only secrets.
9. Storage security — path/owner/type/size constraints; no arbitrary uploads.
10. Payment security — only vendor/owner marks paid; Zelle info vendor-owned.
11. Inactive provider visibility — hidden publicly, manageable in portals.
12. CORS / CSP / headers — CSP, X-Frame-Options/frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy.
13. Admin / owner escalation — URL/localStorage/console tampering blocked by rules.
14. Notification security — scoped by ownerId/vendorId.
15. Dependency / build security — npm audit; untrusted external scripts.

== FIX REQUIREMENTS ==
Fix every CRITICAL/HIGH. Add a regression test + document root cause. Severity:
CRITICAL = data takeover / admin bypass / secret exposure / arbitrary vendor mod.
HIGH = private data leak / booking or payment tampering / stored XSS.
MEDIUM = spam weakness / weak validation / missing headers. LOW = hardening.

== REPORT ==
Create docs/pre_production_security_audit.md with: executive summary; critical /
high / medium / low findings; files changed; tests run; Firestore rules results;
XSS results; auth/authorization results; remaining risks; GO / NO-GO.

== PASS CRITERIA ==
No critical/high remain; vendor/admin portals auth-protected; Firestore rules
enforce ownership; public users cannot modify vendor/admin data; customers cannot
tamper with booking status/price; XSS payloads do not execute; secrets not
exposed; Storage uploads restricted; inactive vendors cannot receive bookings;
GO recommendation justified.

Run `scripts/ai/full_system_dry_run.sh` after every patch and require FINAL: PASS.

== Allowed files ==
- firestore.rules
- storage.rules
- firebase.json
- functions/index.js
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber-agent.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber-dashboard.js
- mobile-barber/mobile-barber-data.js
- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/dashboard.html
- tests/lib/mobile-barber-landing.js
- tests/lib/security-rules.js
- tests/lib/security-xss.js
- docs/pre_production_security_audit.md
