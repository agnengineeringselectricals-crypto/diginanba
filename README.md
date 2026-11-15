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

## Shared platform operating-cost recovery

- Migration `db/migrations/010_platform_cost_allocation.sql` adds an internal ledger for actual provider operating expenses and product/creator/order-level allocations. Categories include AI API, database, hosting/compute, storage/bandwidth, monitoring/security, and other attributable platform costs.
- The default `bundled_platform_operations` policy is **disabled** and has a zero rate. Do not enable cost recovery until the business has entered verified bills, selected a defensible allocation method, configured country/currency/tax handling, and tested checkout and refunds.
- When enabled through a reviewed pricing implementation, eligible costs should be incorporated into the total product price or a plainly described general service/creation price. Do not display provider-specific cost lines such as "OpenAI tokens", "database", "Vercel hosting", or "ChatGPT subscription" on the customer bill. The final total and any general service/creation charge must still be disclosed before purchase; no hidden or surprise fees.
- Allocate only real, documented, business-related costs attributable to DigiNanba. A personal ChatGPT subscription is not the same as API usage and must not be automatically treated as a per-product API charge. Include a shared software subscription in platform overhead only if it is legitimately used for the business and allocation is reasonable, documented, and legally permitted.
- This migration records costs and allocations only; it does not by itself change storefront prices, charge a creator, collect payment, or enable any billing policy. Real payment-provider integration, admin controls, price previews, creator agreements, local tax/consumer-law review, settlement and refund handling are still required before live recovery.

## Launch checklist — Promote & Earn

- Required policy: [DigiNanba Promote & Earn Policy](docs/launch/PROMOTE-AND-EARN-POLICY.md).
- Promotion must be platform-neutral and open to any lawful social platform, messaging service, website, newsletter, podcast, forum, community, offline event, or future channel; examples in the policy are illustrative, not exhaustive.
- Commission rates and milestone rewards are proposals only. Do not advertise or activate paid promotion offers until final rates, eligible net revenue definitions, attribution, refunds/reversals, payout minimums, tax handling, and terms have been reviewed and approved.
- Before launch, implement and verify referral links/codes, attribution, a tamper-resistant commission ledger, promoter dashboard, refund/chargeback reversals, admin controls, payout reconciliation, audit trails, and a dispute/appeal workflow.
- Test valid sales, duplicate events, self-referrals, fraud scenarios, refunds, currency handling, and payout failures end to end.
- This policy documentation does not mean the promoter program is already implemented or active. Do not accrue or pay commissions until implementation, testing, legal/tax review, and explicit business approval are complete.

## Task 5 — Ask AI Nanba project-workflow intelligence

- Ask AI Nanba is a project-scoped, read-only assistant for project managers, department chiefs, stage/team leaders and assigned staff.
- It analyzes recorded WBS/work packages, tasks, dependencies, baseline/forecast/actual progress, milestones, pending approvals, workforce allocations, procurement, quality actions, finance and controlled-document metadata according to the user's project access.
- Assigned-task members receive a narrower context limited to their assigned tasks, related measures, own workforce assignments, assigned quality actions and approvals. Procurement, finance and document registers are excluded from that scope.
- It must never invent progress, dates, quantities, approvals, people or causes; it must distinguish recorded facts from recommendations and explicitly identify missing data.
- The assistant is read-only. It cannot update tasks, approve requests, send messages or perform project actions. Authorized people remain responsible for acting on recommendations.
- Chat messages are not persisted. A minimal usage ledger records model and token counts for rate limiting and cost visibility; an audit event records that the assistant was used without storing the question or answer.
- Configure `OPENAI_API_KEY` and optionally `PROJECT_AI_MODEL` in Vercel before enabling responses. Requests are bounded to 25 per user and 150 per project organization in a rolling 24-hour window. API credits and provider availability remain external prerequisites.
- No sample organization or project data is created. Real workflow testing is deferred until a real organization and project are registered.
- This is project-management intelligence, separate from the digital-product AI Factory and AI Workforce.

## Task 4 — Project operational modules

The project workspace provides the following organization-scoped modules:

- **Procurement:** suppliers, purchase indents, purchase orders, goods-receipt notes (GRNs), and line-level received/accepted/rejected quantities. GRNs are checked against the originating purchase order, partial deliveries are supported, and rejected quantities can be replaced without counting rejected stock as accepted.
- **Manpower:** workforce assignments and timesheets. Assigned project staff can submit their own timesheets; managers control approvals.
- **Quality:** inspections and non-conformities with corrective follow-up. Assigned staff can submit inspection findings under their own membership.
- **Finance:** project budgets, cost entries, and manager-controlled status/approval workflows. No payment or external billing is activated by these records.
- **Documents:** private file upload, controlled revision history, and authenticated project-member downloads. Uploads are limited to PDF, Office, image, TXT and CSV files up to 4 MB per request. Files are stored in a private Vercel Blob store; raw Blob URLs are not exposed to project users.

### Task 4 schema and storage setup

- Apply `db/migrations/20261117_task4_operational_integrity.sql` after the project-management foundation migrations. It adds receipt quantity integrity checks and supporting indexes; the check is `NOT VALID` so legacy rows are not silently rewritten while new writes are enforced.
- The private Vercel Blob store `diginanba-project-documents` is connected to the DigiNanba Vercel project. Vercel manages `BLOB_READ_WRITE_TOKEN` for the project environments; keep this value secret and never expose it to browser code.
- Document upload and download routes enforce authenticated project membership; upload/revision and GRN status changes are written to the project audit trail.
- No sample organization, project, supplier, employee, financial or document records are seeded. End-to-end business workflow testing is deferred until a real organization and project are registered.
- The Task 4 operational modules do not depend on the digital-product AI factory or AI Workforce and do not activate payments, external supplier portals, or notification delivery.
