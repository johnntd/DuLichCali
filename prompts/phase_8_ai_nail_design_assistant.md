# Phase 8 — AI Nail Design Assistant

Goal:
Allow customers to show or describe a nail design and let AI help the salon convert it into a service quote.

Features:
- Upload inspiration photo
- Describe design by text or voice
- AI classifies design complexity
- AI estimates service type
- AI estimates add-on price
- AI estimates duration
- AI suggests technician if skills are known

Design attributes:
- color
- shape
- length
- art complexity
- gems/rhinestones
- chrome
- ombre
- French tip
- 3D design
- seasonal design

Booking flow:
Customer uploads design → AI asks clarifying questions → AI estimates price/time → AI checks availability → booking confirmation.

Rules:
- Do not guarantee exact price if vendor requires review.
- Use "estimated price" until salon confirms.
- Support Vietnamese, English, Spanish.

Acceptance tests:
- Customer can upload design
- AI classifies design
- AI gives estimated duration/price
- AI can attach design image to booking
- Vendor can view image in booking detail
