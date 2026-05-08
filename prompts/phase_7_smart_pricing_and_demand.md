# Phase 7 — Smart Pricing + Demand Suggestions

Goal:
Help salons optimize pricing based on demand, day/time, staff load, and service popularity.

Important:
Do NOT automatically change prices.
Only suggest price changes unless vendor approves.

Analyze:
- Busy days
- Slow days
- Busy time slots
- Staff utilization
- Service popularity
- No-show rate
- Revenue by hour/day

Pricing recommendations:
- Discount slow hours
- Premium peak hours
- Bundle services
- Increase price for high-demand services
- Promote underused services

Firestore:
vendors/{vendorId}/pricingRecommendations/{id}

Fields:
- serviceId
- serviceName
- currentPrice
- suggestedPrice
- reason
- confidence
- status: suggested | approved | dismissed
- createdAt

Vendor admin UI:
Add Pricing Insights:
- Suggested changes
- Reason
- Approve/dismiss
- Impact estimate

Acceptance tests:
- Pricing suggestions generated
- Vendor must approve before price changes
- Existing service prices unchanged unless approved
- AI explains each recommendation
