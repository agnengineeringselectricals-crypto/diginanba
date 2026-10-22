# DigiNanba Advanced Income & Expense Companion — Specification Only

**Status: CONCEPT / NOT IMPLEMENTED / NOT FOR SALE**

## Goal
Offer optional assisted transaction capture and reporting beyond the Standard workbook, using only explicitly authorized integrations or secure user-provided statement imports.

## Mandatory requirements before launch
- Support only named, verified bank/payment integrations with documented consent, scoped permissions, and revocation.
- Never collect UPI PINs, OTPs, banking passwords, or full card credentials.
- Apply least-privilege access, encryption in transit/at rest, access logging, retention/deletion controls, and an incident-response process.
- Provide a human review queue for uncertain categories, transfers, refunds, duplicates, and ambiguous descriptions. Never silently classify transfers as income or expenses.
- Retain source references and import timestamps; detect duplicates and allow corrections.
- Reconcile imported totals against the source statement and show exceptions before writing to the ledger.
- Provide clear export/report limitations; do not claim statutory books or tax filing.
- Test consent withdrawal, token expiry, outages, duplicate imports, malformed CSVs, date/time-zone parsing, refunds, zero/negative amounts, and partial imports.
- Complete security/privacy review, customer disclosures, localization, pricing/operating-cost review, support/refund policy, and explicit owner approval.

## Release checklist
- [ ] Integration partner and permitted scopes verified
- [ ] Threat model and privacy/data-retention review passed
- [ ] End-to-end test report passed in sandbox and production-like environment
- [ ] Human review/correction path demonstrated
- [ ] Localization and customer disclosures approved
- [ ] Pricing and operating costs approved
- [ ] Explicit owner approval recorded

**Do not describe this specification as an available automated service.** The Standard version remains manual entry plus reviewed statement import until a separate automated implementation is built and tested.
