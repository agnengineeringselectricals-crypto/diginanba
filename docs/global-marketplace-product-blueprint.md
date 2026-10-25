# DigiNanba Global Marketplace Product Blueprint

## Product north star
DigiNanba is a global destination combining a broad digital-goods marketplace, structured learning, creator commerce, customer rewards, and an autonomous AI product factory. Every feature should make discovery easier, build trust, help creators earn fairly, and protect customers and the platform.

## Product principles
- Global by design: country-aware storefronts, local currency display, language preferences, tax/payment capability by market, accessible mobile-first UI, and clear market availability.
- Trust before growth: verified identities where required, transparent prices, safe downloads, fraud controls, clear refunds, privacy controls, and traceable admin actions.
- Rewards are earned value, not an investment: no cash-like promises, no paid-to-join pyramid mechanics, no guaranteed earnings, and no reward issuance without an approved budget and anti-abuse controls.
- AI with accountability: label AI-created products, run quality and rights checks, track provenance, review high-risk categories, and allow reporting/takedown.
- Feature flags and staged rollout: new financial, identity, privacy, and legal workflows stay disabled until tested in staging and explicitly approved for production.

## Account centre: target capability
1. Profile: permanent country-prefixed public account ID, display name, verified email and phone, country/locale, timezone, accessibility.
2. Sign-in & security: login history, device/browser and approximate location, password change, recovery, verified-factor setup, session revocation, suspicious-login notifications.
3. Privacy & personalization: recommendation controls, search history controls, marketing consents by channel, data export/deletion request, cookie/privacy preferences.
4. Purchases & library: orders, receipts, payment status, download entitlements, license terms, version updates, refund/cancellation request status.
5. Wishlist & collections: saved products, private/public collections, price-drop and update alerts.
6. Rewards: points ledger, eligible activities, pending/confirmed/expired points, redemption catalogue, terms, transaction history, abuse/appeal path.
7. Referrals: unique referral code/link, disclosed eligibility, attributed signup/purchase status, pending/approved/reversed reward and anti-self-referral rules.
8. Promotions: coupon wallet, campaign eligibility, expiry, market/category restrictions, stacking rules and a clear final-price breakdown.
9. Learning: courses, progress, certificates where earned, learning wishlist, notes, accessible content and refund-policy visibility.
10. Creator centre: creator profile, product drafts/publishing checklist, sales/returns analytics, payout status, tax/payment onboarding, reviews, disputes and policy warnings.
11. Support & trust: tickets, report product/creator, appeal status, account notices and security notifications.

## Promotion and rewards policy design
- Separate transactional messages (receipts, security, order updates) from optional marketing messages; marketing consent must be granular and revocable.
- Display promotion eligibility, start/end times, supported countries, currency, minimum spend, excluded products, maximum discount, usage limits and refund/cancellation effects.
- Apply coupons server-side; never trust browser-submitted discount amounts. Recalculate final price and validate campaign eligibility at checkout.
- Maintain an append-only reward ledger with event source, status, reason, timestamp, expiry, reversal linkage and idempotency key.
- Reward only qualifying settled activity. Keep referral rewards pending until fraud/chargeback windows pass. Reverse rewards on refunds, chargebacks, abuse or duplicate attribution according to published rules.
- Prevent self-referrals, account farms, repeated coupon abuse, fake reviews, bots and circular purchases; rate-limit issuance/redemption and log staff overrides.
- Do not promise cash redemption, fixed earnings, or universal availability. State market-specific terms and tax implications only after legal review.
- Provide a human appeal process for reward/promotion disputes and an auditable admin override trail.

## Marketplace capabilities to build in stages
### Foundation
- Permanent public IDs and creator attribution; product ID, title, description, creator and category search.
- Reliable catalog/product pages, server-side pricing, cart quantity/removal, mixed-market prevention, authenticated checkout and order status.
- Secure download entitlements, versioning, refund/chargeback handling, product reports, seller identity/payout workflow.
- Account settings backed by database APIs, not only browser localStorage.

### Growth and retention
- Coupon wallet, curated campaigns, wishlists, price-drop alerts, referral attribution, loyalty ledger and opt-in campaign preferences.
- Reviews only from verified eligible purchases, moderation/reporting and anti-fraud checks.
- Bundles, subscriptions only where appropriate, learning paths, course progress and completion credentials.

### Global expansion
- Market configuration registry: supported currency, payment methods, language, tax/display rules, product restrictions and launch state.
- Translation/localization workflow with human review for high-risk content, original-language disclosure, local search synonyms and locale-specific SEO.
- Country-specific payment and payout capability, exchange-rate timestamps, refund conversion policy, tax/legal notices and regional privacy controls.

### AI factory and governance
- Demand signals with privacy-preserving aggregation; human/automated quality gates before publication.
- Provenance, source/licence checks, originality and similarity checks, safety/category filters, accurate product previews and automated formula/link/file validation.
- Clearly mark AI-generated or AI-assisted material. Do not imply human authorship or guaranteed outcomes.
- One orchestrated factory queue, idempotent jobs, bounded retries, rate-limit backoff, budget ceilings, quality-review states and a kill switch.
- Never auto-publish sensitive, regulated, infringing, unsafe, or unverified content.

### Admin and operations
- Role-based access, least privilege, MFA for privileged roles, audit trail, support tooling, fraud/risk queues, refund and dispute management.
- Feature flags, staged database migrations, health dashboards, backups/restore tests, alerting, rate limits and incident playbooks.
- Separate customer, creator, support, finance and administrator permissions.

## Suggested implementation sequence
1. Stabilize staging deployment, DB migrations, IDs, signup/login, and sign-in audit.
2. Complete verified email/phone, recovery, session management, privacy controls and DB-backed account settings.
3. Finish order lifecycle: payment provider events, entitlements/downloads, refunds/cancellations and receipt history.
4. Creator onboarding, publishing controls, payouts and creator analytics.
5. Promotions engine and audited coupon rules.
6. Reward ledger and referral tracking after financial/fraud controls are in place.
7. Learning/course capabilities and certificates.
8. Market configuration, localization pipeline, tax/payment readiness and region-by-region rollout.
9. AI factory quality, cost, governance and operational dashboards.
10. Load/security/accessibility tests, privacy/legal review, staged launch checklist.

## Release gates
- No production DB migration until it is rehearsed on a disposable/staging branch, verified for existing data, and has a rollback/recovery plan.
- No production release without build success, smoke tests for signup/login/account/product/checkout, webhook idempotency checks, and confirmation that secrets are configured.
- No marketing or reward programme launch without final terms, budget limits, abuse controls, support workflow and country-specific legal review.
- Legal templates are a starting point, not a guarantee of protection; obtain qualified legal advice for target markets.
