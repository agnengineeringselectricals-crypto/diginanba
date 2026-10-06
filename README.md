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

## Autonomous Factory — integrated Stages 1–6 foundation

The Factory is a private, admin-triggered backend workflow. It is not a public marketplace feature and does not make DigiNanba officially live.

### Capability status

- **IMPLEMENTED:** private role-gated dashboard and API, durable job/event records, idempotency, provenance, bounded retries, provider registry, migration runner, approval records, and audit-visible errors.
- **EXECUTABLE_FREE:** internal published-catalog gap scan; deterministic opportunity scoring; structured product brief; real private Markdown draft stored as UTF-8 `bytea` with SHA-256, MIME, safe filename, version, byte size, and provenance; byte/encoding/content validation; catalog metadata; quality gate; private organic-first strategy, campaign and SEO-content drafts. The workflow runs only after an authorized admin request, at most 12 jobs per request, and can be continued from the dashboard.
- **PROVIDER_REQUIRED:** external research acquisition, localization/translation, analytics signals, and formats other than deterministic Markdown (including PDF, DOCX and XLSX). Unsupported provider capabilities fail as `provider_required`; no fake assets or results are returned.
- **APPROVAL_REQUIRED:** publishing policy creates an approval record. Passing generation or QA is insufficient; public publication requires an authorized human decision plus an approved, priced market edition. No publishing executor or approval-to-publish endpoint is enabled.
- **BLOCKED:** paid or unknown-cost work, unconfigured external communications, and paid advertising. No external account or marketing action is activated.

Catalog-gap results are internal inventory observations, not demand evidence. They retain `LOW` confidence and may create private review drafts, but do not claim customer demand. Operator-submitted references are stored with attribution but are not fetched or independently verified. The score is a deterministic heuristic, not proof of demand, revenue, or conversion.

### Zero-cost and safety policy

Autonomous spend is **₹0**. The financial-policy schema rejects nonzero spend limits and paid actions; unknown costs fail closed. The local deterministic provider uses no external service or credential. Marketing is organic-first and private: no paid advertising, spam, unsolicited bulk messages, fake accounts/engagement, review manipulation, CAPTCHA/rate-limit bypass, or platform-security bypass. External publication remains inactive. Factory-created products stay `draft`; database guards require an approved, priced, published market edition before they can become public. No API keys, paid services, payment secrets, or external marketing accounts are added by this feature.

### Admin access and how to run it

`Super Admin`, `Operations Admin`, and `AI Factory Manager` can manage the Factory. `Read-Only Analyst` can view it. Customers, creators, sellers, and other roles cannot view or manage it unless separately granted one of those explicit admin roles. Both the page and every API action enforce role checks server-side.

After the database migrations below are applied, an authorized admin signs in and opens `/admin/factory`. Use **Scan catalog coverage** for a private internal inventory run, or submit an opportunity with three distinct HTTPS source hosts whose summaries the operator has reviewed. The app does not retrieve those sources. Each request is bounded; use **Continue queued run** for any remaining jobs. Failed, blocked, provider-required and approval-required states remain visible in the dashboard and event log.

### Database readiness and migrations

The application uses PostgreSQL through the `pg` package. The app pool in `lib/db.ts`, manual migration runner, and integration test each use a `pg.Pool`; migrations use the same driver and connection settings, but create their own pool. SSL is enabled by default (`rejectUnauthorized: false`); `DATABASE_SSL=false` disables it and should only be used for a trusted local database. No other database engine is supported.

Configure database connection variables separately for each environment; never reuse a production URL for local development, previews, or tests:

| Variable | Purpose | Local development | Vercel Development / Preview / Production | Factory | Integration test | Safe format |
| --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by the application and manual migration runner | Required for database-backed features | Required for database-backed features in each deployed environment | Required in the environment where Factory tables and runs are intentionally activated | The test runner temporarily uses the dedicated test URL as its app connection | `postgresql://USER:PASSWORD@HOST:5432/DATABASE` |
| `DATABASE_SSL` | Controls PostgreSQL TLS; only the exact value `false` disables TLS | Optional; defaults to TLS | Optional; leave default enabled for hosted databases | Same setting as the selected environment's database | Optional; test runner defaults it to `false` only when unset | `true` (default) or `false` for trusted local databases only |
| `FACTORY_TEST_DATABASE_URL` | Dedicated, disposable PostgreSQL database for the Factory integration test | Required only to run that integration test | Not required; do not configure it in Vercel | Not used by the live Factory | Required to execute the database-backed integration test; the test refuses databases whose names do not contain `test`, `testing`, or `integration` | `postgresql://USER:PASSWORD@HOST:5432/diginanba_test` |

For separation, use a local development database for local work, a non-production database for Vercel Preview, a distinct production database for Vercel Production, and a separate disposable test database for integration tests. The project does not compare the hosts or credentials of `DATABASE_URL` and `FACTORY_TEST_DATABASE_URL`; the test only checks the connected database name. Verify the target database out of band before configuring either URL. A checked-in `.env.example` contains placeholders for `DATABASE_URL` and `DATABASE_SSL`; it is not a credential. The test URL is intentionally not provided there to avoid encouraging reuse of a normal application database.

For initial Factory activation and verification, use a dedicated development/verification database, not Production. Do not run Factory migrations or Factory jobs against the production `DATABASE_URL` during initial activation. The Vercel Production application may need its own `DATABASE_URL` for existing marketplace features; setting it does not itself apply Factory migrations. The Factory migration command is manual and there is no separate Factory-enablement variable, so keep production Factory operations unused until they have been separately approved and verified.

There is no automatic production schema application. `db/schema.sql` is the complete idempotent bootstrap for a new database. Existing app databases need the core DigiNanba tables (`users`, `roles`, `markets`, `categories`, `subcategories`, `products`, and `product_editions`) before the Factory migrations. The checked-in migration path applies the private Stage 1–5 foundation and Stage 6 hardening in numbered, transactional, SHA-256-verified steps under a PostgreSQL advisory lock:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:5432/DATABASE'
npm run db:migrate
```

**Do not run this command until `DATABASE_URL` is explicitly set to the verified, authorized non-production target.** The runner creates a `diginanba_schema_migrations` ledger, takes a PostgreSQL advisory lock, applies each migration and ledger record in a transaction, and verifies the SHA-256 checksum of any previously applied migration. A checksum mismatch stops execution; rerunning an unchanged migration reports it as already applied. It is not called by the app, build, or Vercel. `db/migrations/001_factory_stages_1_5.sql` and `db/migrations/002_factory_stage6_hardening.sql` are additive to application tables. Stage 6 disables existing Factory schedules and adds a publication gate. Migration status must be confirmed against the ledger in the target database after a deliberate migration run.

Schedules remain disabled by default. There is no background worker or cron. A manager may manually request due-schedule processing; each request is capped at five schedules and each run at 12 jobs. Only internal deterministic inventory research is eligible; unsupported schedules are blocked. Do not enable schedules until a separately reviewed worker and operational rate limits exist.

### Validation and deployment notes

Run `npm run test` for unit tests plus the PostgreSQL integration test. The integration test runs only when `FACTORY_TEST_DATABASE_URL` points to a dedicated migrated database whose name includes `test`, `testing`, or `integration`; without it, that test is explicitly skipped. The test refuses to run against a database without such a name. TypeScript is checked with `npx tsc --noEmit`. Next.js 16 removed `next lint`; the repo's lint command remains unsupported because installing the official ESLint CLI and matching Next.js config requires npm registry access, which was unavailable in this environment. The appropriate migration is `eslint .` with `eslint-config-next/core-web-vitals` in `eslint.config.mjs`; it is not claimed as installed or verified.

Windows may compile the application and then fail when Next.js starts its TypeScript worker with `spawn EPERM`. Run `npx tsc --noEmit` separately to distinguish a Windows process-spawn restriction from TypeScript errors. This feature does not use a Windows-only build workaround. Verify Vercel build/deployment status against the exact pushed commit instead of inferring it from the local Windows build. Vercel's deployment behavior, domain, and launch settings are unchanged here.

The public homepage, customer catalog, authentication, cart, checkout, orders, and payment foundation are unchanged.
