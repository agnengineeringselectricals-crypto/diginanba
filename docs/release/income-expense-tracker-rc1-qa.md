# Income & Expense Tracker RC1 — QA and Release Gate

**Status: HOLD — NOT APPROVED FOR PUBLICATION**  
**Prepared:** 2026-10-22  
**Market:** India (IN)  
**Locale reviewed:** English (India), en-IN  
**Currency:** INR (₹)

## Scope
- **Standard:** Manual income/expense entry plus manually pasted bank-statement CSV rows with human review.
- **Advanced:** Automated companion service is a specification only; it is not implemented by this workbook.

## Static checks
The workbook was inspected programmatically. **13/13 static checks passed**:
- Six expected worksheets are present: Start Here, Bank Statement Import, Income, Expenses, Monthly Summary, Profit and Loss.
- All 12 months (January–December 2026) have monthly summary formulas.
- Monthly income and expense use date-bounded SUMIFS; net is income minus expenses.
- Profit & Loss links to the monthly summary.
- Formula recalculation is requested when the workbook opens.
- Sample transactions are clearly marked fictional.
- Import instructions say the workbook does not connect to banks/UPI and require manual review/copying.
- A safety warning tells users never to enter PINs, OTPs, passwords, or full card credentials.
- Independent Python calculation over the fictional test data reconciles: income ₹328,800; expenses ₹90,300; net ₹238,500, with sample entries across all 12 months.
- The Advanced service is not represented as implemented.

## Not yet verified — release blockers
1. **Live compatibility:** Open and test the file in current Microsoft Excel and Google Sheets. Verify formula recalculation, date parsing, formatting, validation, and editing.
2. **Human review:** Inspect the actual workbook and its customer instructions; replace/remove fictional rows before real use.
3. **Localization:** Only the en-IN draft has been reviewed. Any other language/market needs translation and fluent human review.
4. **Advanced version:** Implement separately; complete security/privacy review and end-to-end tests before describing it as an available automated service.
5. **Commercial readiness:** Review pricing, support/refund terms, privacy disclosures, and operating costs.
6. **Owner approval:** Record explicit approval before publication.

## Known limitations
- Bank statement import is manual CSV copy/paste; it does not connect to a bank/UPI account or automatically post transactions.
- Category suggestions are hints and require human review; duplicate checks remain necessary.
- The workbook is a management tracker, not statutory accounting, tax advice, GST filing, or bank reconciliation.
- Inventory, depreciation, receivables/payables, and tax filing are out of scope.

## Release decision
**HOLD.** Static workbook checks pass, but external application compatibility, human review, localization readiness, and explicit owner approval are still outstanding. Do not publish either version automatically.
