# Income & Expense Tracker RC1 — QA and Release Gate

**Status: HOLD — NOT APPROVED FOR PUBLICATION**  
**Prepared:** 2026-10-22  
**Market:** India (IN)  
**Locale reviewed:** English (India), en-IN  
**Currency:** INR (₹)

## Scope
- **Standard:** Manual income/expense entry plus manually pasted bank-statement CSV rows with human review.
- **Advanced:** Automated companion service is a specification only; it is not implemented by this workbook.

## Test results

### Static workbook checks
**13/13 static checks passed**:
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

### Spreadsheet-engine test
**5/5 LibreOffice headless checks passed**:
- Opened, recalculated, saved, and round-tripped the workbook through LibreOffice.
- Cached numeric results were present for income, expenses, and net across all 12 months.
- Every monthly net result equalled income minus expenses.
- Recalculated annual totals matched income ₹328,800; expenses ₹90,300; net ₹238,500.
- Profit/loss status formula outputs were populated for all 12 months.

A recalculated review copy was generated as DigiNanba_Income_Expense_Tracker_RC1_LibreOffice_Checked.xlsx.

## Not yet verified — release blockers
1. **Microsoft Excel:** Live test in a current Microsoft Excel application is still required.
2. **Google Sheets:** Import the workbook into Google Sheets and verify formulas, date parsing, formatting, validation, and editing. LibreOffice testing is not a substitute for this.
3. **Human review:** Inspect the actual workbook and customer instructions; replace/remove fictional rows before real use.
4. **Localization:** Only the en-IN draft has been reviewed. Any other language/market needs translation and fluent human review.
5. **Advanced version:** Implement separately; complete security/privacy review and end-to-end tests before describing it as an available automated service. Bank/UPI access requires a verified integration and consent model; this workbook does not provide it.
6. **Commercial readiness:** Review pricing, support/refund terms, privacy disclosures, and operating costs.
7. **Owner approval:** Record explicit approval before publication.

## Known limitations
- Bank statement import is manual CSV copy/paste; it does not connect to a bank/UPI account or automatically post transactions.
- Category suggestions are hints and require human review; duplicate checks remain necessary.
- The workbook is a management tracker, not statutory accounting, tax advice, GST filing, or bank reconciliation.
- Inventory, depreciation, receivables/payables, and tax filing are out of scope.

## Release decision
**HOLD.** Static workbook checks and LibreOffice recalculation pass. Microsoft Excel and Google Sheets compatibility, human review, localization readiness, advanced service implementation, commercial review, and explicit owner approval remain outstanding. Do not publish either version automatically.
