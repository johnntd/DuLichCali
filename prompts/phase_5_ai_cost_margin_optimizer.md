# Phase 5 — AI Cost + Margin Optimizer

Goal:
Show salon owners how much each service costs and where they can save money.

Calculate:
- Material cost per service
- Labor estimate per service
- Gross margin
- Low-margin services
- High-profit services
- Waste risk
- Suggested price adjustment

Service analytics fields:
vendors/{vendorId}/serviceAnalytics/{serviceId}

Fields:
- serviceName
- price
- estimatedMaterialCost
- estimatedLaborCost
- estimatedGrossProfit
- estimatedMarginPercent
- bookingCount30d
- revenue30d
- materialCost30d
- recommendation

Vendor dashboard:
Add Cost Insights:
- Most profitable services
- Low-margin services
- Material cost trend
- Suggested price changes
- Supplier savings opportunities

AI assistant:
Support questions:
- "Which services make the most money?"
- "Which service should I increase price?"
- "Where am I wasting supplies?"
- "How can I save on gel polish?"

Acceptance tests:
- Service margin is calculated
- Low margin services are flagged
- Dashboard displays insights
- AI can explain recommendations
- Existing booking and service pages still work
