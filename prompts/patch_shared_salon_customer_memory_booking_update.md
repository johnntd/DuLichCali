# Patch: Shared Salon Customer Memory Booking Update

## Execution Rule

This update must be run through the guarded AI auto script:

scripts/ai/ai_dev_loop.sh prompts/patch_shared_salon_customer_memory_booking_update.md --loops 3

Do not implement manually outside the auto script unless the script fails and the user explicitly approves a manual fallback.

## Allowed files

- nailsalon/customer-memory.js
- nailsalon/receptionist.js
- nailsalon/index.html
- hairsalon/index.html
- tests/runner.js
- scripts/ai/targeted_dry_run.sh

## Goal

Improve the shared salon AI receptionist used by both nailsalon and hairsalon so it asks for the customer phone number early in booking flow, uses the normalized phone number to look up previous customer/booking records, greets returning customers by name, and suggests the previous service/staff when safe.

This must work for both:

- /nailsalon?id=...
- /hairsalon?id=...

This is shared salon-agent logic, not a nails-only or hair-only fix.

## Phone-first booking behavior

When the customer expresses booking intent, the AI receptionist should ask for phone number first unless phone is already known in session.

Examples of booking intent:

- I want to book an appointment.
- Can I come today?
- I need my nails done.
- I want a haircut.
- Tôi muốn đặt lịch.
- Em muốn làm móng.
- Tôi muốn cắt tóc.

The phone number is the safest lookup key for returning-customer memory.

Do not ask for name first if the phone number can retrieve the name.

Do not ask for service/staff first if the phone lookup can suggest the prior service/staff.

## Returning customer lookup

After full phone number is captured and normalized:

1. Look up previous booking/customer record for the current vendor.
2. Match by normalized phone number.
3. Prefer same vendor id.
4. If found, use safe customer-facing fields:
   - name
   - last service
   - last staff/stylist/technician
   - last appointment date if useful
5. Do not expose internal notes or private data.
6. Do not reveal booking history before phone is provided and matched.

## Greeting behavior

English:

Welcome back, <name>. Last time you booked <service> with <staff>. Would you like the same service with <staff> again, or something different today?

Vietnamese:

Dạ chào anh/chị <name>, lần trước mình đặt <service> với <staff>. Hôm nay mình muốn đặt lại dịch vụ đó với <staff>, hay chọn dịch vụ khác ạ?

Spanish:

Bienvenido de nuevo, <name>. La última vez reservó <service> con <staff>. ¿Quiere reservar lo mismo otra vez o prefiere algo diferente?

If only name is known:

Welcome back, <name>. What would you like to book today?

If no record found:

Continue normal new-customer flow.

## Booking validation rule

Memory suggestions must not finalize booking.

Even if the customer says yes to same service/staff, the system must still validate:

- service exists
- staff works at this vendor
- staff is available
- business hours allow the appointment
- appointment duration is valid
- no double booking
- date/time confirmed

## Privacy and safety

- Do not reveal customer history before phone is provided.
- Do not match by name alone.
- Do not leak one vendor’s records into another vendor’s page.
- Do not console.log full phone numbers, customer names, or raw booking records.
- Do not write production data during tests.
- Do not deploy.

## Implementation guidance

Preferred helper:

nailsalon/customer-memory.js

Expose:

window.SalonCustomerMemory = {
  lookupReturningSalonCustomer,
  buildReturningCustomerGreeting
};

Load helper before receptionist.js in:

- nailsalon/index.html
- hairsalon/index.html

If a helper already exists inside receptionist.js, use the existing shared path instead, but keep behavior shared across hair and nails.

## Tests required

Add tests in tests/runner.js under:

group('Shared Salon Returning Customer Memory', 'unit');

Required tests:

1. Phone-first booking intent prompts for phone before name/service.
2. Returning customer lookup uses normalized phone.
3. Returning customer greeting English includes name/service/staff.
4. Returning customer greeting Vietnamese includes name/service/staff and “lần trước”.
5. Returning customer greeting Spanish includes name/service/staff and “La última vez”.
6. Name-only returning customer does not invent service/staff.
7. No record found falls back to normal new-customer flow.
8. Vendor scoping prevents cross-vendor leakage.
9. Lookup failure is safe and does not break booking flow.
10. Both nails and hair contexts are covered.

## Targeted validation

Ensure this target works:

scripts/ai/targeted_dry_run.sh salon-memory

It should validate:

- customer memory helper exists or equivalent functions exist
- returning customer tests exist
- vendor scoping is tested
- both hair and nail contexts are covered
- node tests/runner.js passes

Do not remove existing targets:

- hair-salon
- booking
- travel
- marketplace
- ai-receptionist
- phone-intake

## Required commands

Run:

scripts/ai/targeted_dry_run.sh salon-memory
node tests/runner.js
scripts/ai/targeted_dry_run.sh phone-intake
scripts/ai/targeted_dry_run.sh hair-salon
scripts/ai/full_system_dry_run.sh

All must pass.

## Final report

Include:

- files changed
- actual lookup source inspected
- helper location
- vendor scoping behavior
- how phone-first flow works
- how greeting is built in English/Vietnamese/Spanish
- proof memory suggestions do not bypass booking validation
- targeted salon-memory result
- phone-intake result
- hair-salon result
- full dry-run result
- FINAL: PASS or FINAL: FAIL
