# Payment Webhook Security Test Matrix

Use a provider sandbox and test-only orders. Never test by issuing live charges.

| Case | Expected outcome |
|---|---|
| Missing/invalid provider signature | Reject; no event/payment/order/entitlement mutation |
| Valid signature, unknown event type | Reject or safely acknowledge per provider policy; no paid transition |
| Valid event with unknown payment/session | No order status change; audit safely |
| Valid paid event with wrong amount | Reject/hold; order remains unpaid |
| Valid paid event with wrong currency | Reject/hold; order remains unpaid |
| Valid paid event mapped to another user's order | Reject/hold; no entitlement |
| Duplicate provider event ID | Idempotent acknowledgment; no duplicate fulfillment |
| Replayed/stale timestamp where provider supports timestamp signing | Reject |
| Success then late failure | Do not downgrade a confirmed paid payment without a valid reversal/refund workflow |
| Failure then verified success after retry | Apply only if the provider state/session rules allow; do not overwrite an unrelated terminal attempt |
| Provider says payment pending/authorized but not captured | Do not mark paid or grant download entitlement |
| Refund confirmed by provider | Record refund idempotently; apply defined entitlement and earnings policy |
| Chargeback/dispute opened | Record and hold/restrict according to approved dispute policy |
| Database transaction fails mid-fulfillment | Roll back state changes; provider retries safely |
| Same event delivered concurrently | Lock/unique constraints ensure exactly-once effects |
| User tries another user's download URL | Return not found/forbidden; don't disclose asset key |
| Expired/revoked entitlement | Refuse download |
| Demo checkout order | Never grant entitlement |
| Environment has no provider credentials | Checkout stays demo/disabled; no pretend session URL |

Record expected and actual results, test order IDs, provider event IDs, timestamps, logs, and deployment SHA. Redact secrets and personal data.
