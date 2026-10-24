# DigiNanba Real-Payment Launch Checklist

**Status: BLOCKED — demo checkout only.** This checklist documents launch gates; it does not enable a provider or collect payments.

## Current verified implementation
- Checkout requires an authenticated user.
- The server loads current published product editions and prices from PostgreSQL; client-provided prices are not accepted by the `/api/checkout` route.
- Checkout creates an order and order items, then explicitly returns `paymentMode: "demo"`.
- The current `/api/payments/webhook` is an internal shared-secret relay. It is not a provider-native signature verifier and must not be configured as a real provider webhook.
- Payment records and event idempotency structures exist in the database foundation.
- The account library currently explains that downloads are not enabled.

## Required gates before live transactions
1. **Select and approve a payment provider** appropriate for the merchant entity, target countries, currencies, and digital-goods policy. Do not guess provider or merchant configuration.
2. **Provider-native checkout session creation:** create the session server-side from a database order; include an internal order reference; do not trust amount, currency, user identity, or product details supplied by the browser.
3. **Persist payment attempt:** store provider, provider session/payment reference, internal order, exact integer minor-unit amount, currency, and a pending state with a uniqueness/idempotency strategy.
4. **Provider-native webhook verification:** verify the exact raw request body and provider-specified signature/authentication, timestamp/replay safeguards, and supported event types. Keep a dedicated provider adapter; do not accept a caller-selected provider or generic success flag as proof of payment.
5. **Authoritative confirmation:** verify provider payment/session ID, merchant/account, paid status, expected amount and currency, and order mapping before changing order status. Handle async payment, duplicate events, retries and out-of-order events atomically.
6. **Entitlement fulfillment:** grant entitlements only after verified successful payment; create them idempotently for the exact order items in the same transaction as payment/order finalization where feasible. Do not expose private asset keys.
7. **Secure downloads:** authorize each request using the signed-in user's active entitlement, serve private files or short-lived signed URLs, and enforce any download limits without exposing storage keys.
8. **Refunds and disputes:** implement provider-verified refund/dispute events, reversals of entitlements/earnings where appropriate, audit events, customer-visible statuses and support procedures.
9. **Creator payouts:** verify creator identity/tax/payout onboarding, maintain an immutable earnings ledger, establish settlement delays/reserves and refund/chargeback recovery, and prevent double payouts with provider idempotency.
10. **Legal/tax/operations:** review terms, digital-delivery and refund policy, privacy, creator terms, tax/VAT/GST and payment disclosures with qualified counsel/accountants for each launch jurisdiction; verify merchant name, support email/address, retention and incident response.
11. **Test and release:** test in provider sandbox for success, failure, cancellation, webhook signature failure, duplicate/replayed events, wrong amount/currency/order, delayed events, refund, dispute and inaccessible downloads. Run automated tests and deployment verification. Keep live provider credentials and switch disabled until all gates pass.

## Release criteria
- An unauthenticated user cannot create a payment session or access order history/downloads.
- A forged, unsigned, invalid-signature, replayed or mismatched webhook cannot mark an order paid.
- Duplicate events never duplicate orders, entitlements, earnings or payouts.
- The browser cannot override server-calculated prices or the payment currency.
- No file/download entitlement is issued for demo, pending, failed or refunded transactions.
- No live payment mode is enabled merely because a deployment is READY.
