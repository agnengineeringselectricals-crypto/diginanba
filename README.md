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
