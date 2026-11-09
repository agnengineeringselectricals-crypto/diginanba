# DigiNanba Production Release Checklist

Use this checklist for every planned production release. Complete applicable checks and record evidence in the pull request or release notes.

## Before coding
- [ ] Requirement and acceptance criteria recorded in `DEVELOPMENT_BACKLOG.md`.
- [ ] Current production behavior and relevant source files inspected.
- [ ] Impacted routes, APIs, database tables/migrations, integrations, and user roles identified.
- [ ] Related changes grouped into one release batch.

## Before preview / release
- [ ] Changes are on a development branch; production `main` is not used for unfinished work.
- [ ] Formatting/lint checks pass, or unavailable checks are documented.
- [ ] TypeScript/type checks pass.
- [ ] Automated tests pass; missing test coverage is documented.
- [ ] Production build passes.
- [ ] Database migrations are reviewed for ordering, idempotency, compatibility, and production target.
- [ ] API validation, authorization, error handling, and backward compatibility reviewed.
- [ ] Customer and shop-owner screens checked; internal AI controls and private platform fees are not exposed.
- [ ] Pricing and order calculations verified for relevant edge cases.
- [ ] Payment processing remains in demo/test mode unless separately approved.
- [ ] AI-generated products are not automatically published without approval.
- [ ] Preview deployment used only when useful and quota permits; preview behavior tested.

## Production release
- [ ] Vercel team plan/quota permits deployment.
- [ ] Exact commit intended for release is identified.
- [ ] Required database migrations are applied in the correct order.
- [ ] Batch merged to `main`.
- [ ] Vercel production deployment reaches READY.
- [ ] Deployment commit SHA matches the intended GitHub commit.
- [ ] Production URL and critical user journeys smoke-tested.
- [ ] Runtime/build logs checked for new errors.
- [ ] `CHANGELOG.md` updated with commit, checks, deployment ID, URL, and status.
- [ ] Completed backlog items marked done; unresolved issues retained.

## Post-release smoke tests
- [ ] Homepage and navigation.
- [ ] Sign-in/account access.
- [ ] Product discovery/search and product detail.
- [ ] Shop dashboard and product create/edit/import flows, when affected.
- [ ] Cart/order flow in safe test mode, when affected.
- [ ] Delivery management and relevant APIs, when affected.
- [ ] Mobile/tablet layout for changed screens.

## Release safety gates
- Never enable live money collection, payouts, or automatic product publication without explicit user approval.
- Never expose internal Nanba fee calculations to customers or shop owners.
- Never claim production success based only on a GitHub commit or a preview deployment.
