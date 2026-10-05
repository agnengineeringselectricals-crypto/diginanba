# DigiNanba MVP 0.2

Global digital-product marketplace foundation for **diginanba.com**.

## Included
- Next.js App Router foundation
- Public marketplace landing page
- US/UK market detection and manual switching
- Customer login/signup/account UI placeholders
- Private admin route separated from public navigation
- Health API route
- PostgreSQL Phase 1 schema for users, RBAC, catalog, markets, editions, prices, orders and downloads
- Environment variable template

## Local development
Requires Node.js 20.9+.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Production security note
The `/admin` page is a UI scaffold only in this package. Production authorization must be enforced server-side before deployment, including authenticated sessions, RBAC/ABAC checks, MFA/re-authentication for sensitive actions, rate limits and audit logs.

Next.js 16.3.8 is pinned because it is the current Active LTS security release as of October 2026.

## v0.3 Authentication Foundation

Credentials authentication uses JWT sessions. Passwords are hashed with bcryptjs. PostgreSQL stores users and roles. `/account` requires authentication; `/admin` requires an admin role. Apply `db/schema.sql`, configure `.env.local`, then run `npm install && npm run dev`.

Never commit `.env.local` or production secrets. Store production secrets in Vercel environment variables.


## v0.4 Catalog + Order Foundation
- Public marketplace exploration and product detail routes.
- US/UK market-aware pricing.
- Catalog API with database-first and safe demo fallback.
- Cart foundation and authenticated order creation API.
- Seed catalog SQL for categories, products, editions and prices.
- Admin-ready category → subcategory → product taxonomy. `db/schema.sql` is idempotent and adds ordered/enabled subcategories plus a category-safe product subcategory association. Apply it to existing databases before enabling the taxonomy there.
- Real payment processing is intentionally not enabled yet.

Vercel can connect this Next.js project to GitHub so pushes can generate preview/production deployments.


## v0.5 — Checkout + Payment Foundation
- authenticated checkout route
- server-side price revalidation
- orders and order items persisted in PostgreSQL
- payment and payment-event tables
- webhook endpoint with optional secret
- entitlement table foundation
- demo checkout mode (no real payment credentials)
- secure separation of server-only checkout logic

Before production payments, configure a payment provider, merchant/KYC settings, tax rules, webhook signing, and Vercel environment variables. Vercel recommends keeping secrets server-side and scoping environment variables by Production/Preview/Development; changes to environment variables require a redeploy.

## Autonomous Factory — Stages 1–5 foundation

`db/schema.sql` contains the private product-factory and marketing/growth records, the zero-cost financial policy, provider cost catalog, durable agent job queue, approvals, and aggregated feedback signals. Apply it to an existing database before using `/admin/factory`.

The private factory dashboard is restricted to the existing `Super Admin`, `Operations Admin`, and `AI Factory Manager` roles; read-only analysts may view it. Its authenticated API supports idempotent admin-triggered runs. Free deterministic modules can inspect published catalog coverage, score opportunities, create structured product briefs and private Markdown worksheet drafts, validate asset bytes/checksums, prepare taxonomy/search metadata, run quality checks, and draft organic-first marketing strategy/content. Every stage writes database-backed jobs and audit events. Operator-submitted research references are stored as references only; the system does not scrape/fetch them.

The Stage 1 policy constrains autonomous spending to ₹0. Paid and unknown-cost resources fail closed. There are no AI keys, payment secrets, external marketing accounts, or activated schedules. Localization, traffic analytics, external research acquisition, external campaign execution, and public publication wait for an authorized provider or human review. Generated products remain private drafts; publishing also requires a reviewed market edition/price and working fulfillment. No autonomous agent is operational outside explicitly triggered, free internal work. Existing authentication, marketplace, cart, checkout, payment foundation, taxonomy, and public homepage are unchanged.
