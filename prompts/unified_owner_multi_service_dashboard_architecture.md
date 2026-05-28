Major DuLichCali architecture upgrade.
We are moving from:
1 login = 1 vendor
to:
1 owner account = multiple businesses/services/vendors
==================================================
BUSINESS NEED
==================================================
Example:
Michael Nguyen owns:
- Mobile Barber
- Ride / Airport service
- Tour services
He should NOT need multiple portals/logins.
He should log into ONE dashboard and manage:
- barber bookings
- ride bookings
- tour bookings
- promotions
- notifications
- schedules
==================================================
GOAL
==================================================
Create unified owner account architecture.
One owner account can manage multiple businesses/services/vendors.
==================================================
NEW DATA MODEL
==================================================
Add:
ownerId
Owner example:
ownerId:
michael-nguyen
Businesses/vendors:
- mobile-barber-oc
- airport-rides-oc
- private-tours-oc
Each vendor/service/business maps to ownerId.
==================================================
OWNER DASHBOARD
==================================================
After login:
Michael Nguyen Dashboard
--------------------------------------------------
Mobile Barber
- upcoming bookings
- pending confirmations
Airport Ride
- airport pickups
- ride schedule
Tours
- tour inquiries
Analytics
Notifications
--------------------------------------------------
==================================================
BUSINESS SWITCHER
==================================================
Top navigation:
Current Business:
▼ Mobile Barber
  Airport Ride
  Tours
Switching business changes:
- appointment view
- settings
- promotions
- notifications
- analytics
==================================================
UNIFIED CALENDAR
==================================================
Create shared owner calendar.
Example:
9AM haircut
11AM airport pickup
2PM private tour
Prevent:
- overlapping bookings
- impossible travel schedules
Include:
- travel buffer
- appointment duration
- service type
==================================================
UNIFIED NOTIFICATIONS
==================================================
One inbox:
[Barber]
John Nguyen - Fade Haircut
[Ride]
SJC Pickup 5PM
[Tour]
Monterey inquiry
==================================================
SHARED CUSTOMER DATABASE
==================================================
Customers shared across owner services.
Example:
Customer used airport ride before
→ books barber later
Reuse:
- phone
- address
- language
- preferences
==================================================
IMPORTANT
==================================================
DO NOT merge customer-facing services.
Customer still sees:
- Mobile Barber
- Ride Service
- Tours
Unified architecture is INTERNAL only.
==================================================
KEEP EXISTING
==================================================
Keep:
- existing vendor pages
- vendor routing
- booking flows
- AI booking
- voice booking
- notifications
This is an architecture layer upgrade.
==================================================
PERMISSIONS
==================================================
Support:
Owner
- can manage all businesses
Staff/vendor
- can manage assigned business only
Future-ready for:
- employees
- drivers
- barbers
- assistants
==================================================
REQUIRED IMPLEMENTATION
==================================================
1. Create owner model.
2. Map vendor/service to ownerId.
3. Create unified owner dashboard shell.
4. Create business switcher.
5. Create shared notification center.
6. Create unified calendar foundation.
7. Create shared customer index.
8. Keep backward compatibility.
==================================================
MIGRATION
==================================================
Seed:
Michael owner account:
- mobile barber
- rides/tours
Future:
Tim may own separate businesses later.
Do NOT break existing Firebase records.
Support migration from:
vendor-only
→ owner+vendor structure.
==================================================
UI / UX
==================================================
Dashboard should feel:
- premium
- operator-focused
- expandable
- mobile friendly
- multi-service
==================================================
AUDIT
==================================================
Inspect:
- auth
- vendor model
- driver model
- booking collections
- customer collections
- notifications
- schedules
- dashboards
Find:
- duplicated vendor assumptions
- hardcoded single-vendor logic
- incompatible booking ownership
==================================================
DO NOT BREAK
==================================================
- current bookings
- vendor portals
- AI booking
- voice booking
- promotions
- marketplace routing
- active/inactive filtering
==================================================
PHASED IMPLEMENTATION
==================================================
Phase 1:
ownerId + business switcher
Phase 2:
unified notifications
Phase 3:
shared calendar
Phase 4:
shared customer CRM
==================================================
TESTS
==================================================
Michael:
- sees barber + ride bookings
- can switch businesses
- notifications aggregate correctly
Tim:
- sees only Tim businesses
Backward compatibility:
- old vendor routes still work
==================================================
REPORT
==================================================
Create:
docs/unified_owner_multi_service_dashboard_architecture.md
Include:
- data model
- migration plan
- UI screenshots
- permission model
- future scalability
- PASS/BLOCKED
PASS only if one owner login can manage multiple service businesses cleanly.
