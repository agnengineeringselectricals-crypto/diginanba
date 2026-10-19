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


## AI factory usage and cost controls

- Apply `db/migrations/009_factory_ai_usage_ledger.sql` in the production Neon database before enabling AI factory processing on this version.
- Successful OpenAI responses record input, output, cached-input tokens, model, job, requester, pricing basis and calculated USD cost in `factory_ai_usage`.
- The worker defaults to a **$1.00 rolling 24-hour recorded AI-cost cap**. Override with `PRODUCT_FACTORY_DAILY_BUDGET_USD` only after reviewing the budget.
- Built-in per-million-token rates exist for the current worker defaults `gpt-4o-mini` and `gpt-4.1-mini`; verify these against the current official API pricing before production use. To set explicit prices, use `PRODUCT_FACTORY_MODEL_PRICING_JSON`, keyed by exact API model ID with `input`, `cachedInput`, and `output` USD-per-million-token rates. The worker blocks calls for unknown model IDs or invalid pricing configuration.
- API errors indicating exhausted credits, a reached spend cap, or missing pricing are not automatically retried.
- The usage ledger is for internal cost control and accounting; it does not display token counts on customer invoices or collect a creator/customer charge.
- Customer/creator cost recovery is **not live yet**: checkout remains in demo-payment mode. Before charging, implement and test payment-provider checkout, price disclosure, account/job/order attribution, refunds, and settlement rules. Any recovered cost should be included in the agreed product/creation price or clearly disclosed as a creation service charge—not represented as tokens consumed.
- OpenAI usage dashboard: https://platform.openai.com/usage
