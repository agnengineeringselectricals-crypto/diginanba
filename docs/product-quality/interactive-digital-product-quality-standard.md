# DigiNanba Interactive Digital Product Quality Standard

**Status:** Proposed implementation standard  
**Applies to:** Interactive web tools, dashboards, templates, calculators, trackers, and other customer-facing digital products sold through DigiNanba.

## Product principle

A product is not ready because a screenshot looks attractive. It must combine a polished presentation with reliable, understandable functionality. Visual quality and working behavior are equally important.

## 1. Visual design

- Use a deliberate, cohesive visual system: a defined palette, readable typography, consistent spacing, and clear hierarchy.
- For dashboards, use the approved reference image as the design benchmark when one has been supplied. Match its overall composition, background treatment, navigation, card style, chart presentation, and visual richness rather than substituting a generic spreadsheet layout.
- Use clear labels, meaningful icons, useful empty states, helpful hints, and legible chart legends.
- Make important totals and next actions easy to find. Avoid crowded layouts and decorative elements that make controls unclear.
- Preserve visual quality at desktop, tablet, and mobile widths. On narrow screens, reorganize content rather than shrinking it until it is unreadable.

## 2. Functional interaction

Every visible control must have a defined, working purpose.

- Navigation opens the correct screen or section and visibly identifies the current selection.
- Buttons perform their advertised actions and provide feedback.
- Filters and selectors update the data, summaries, or charts they claim to control.
- Forms validate inputs, explain errors, and preserve valid user work.
- Add, edit, remove, search, import, export, reset, and save controls must work wherever they are presented.
- Do not use static screenshots, decorative buttons, dead links, or fake controls as substitutes for functionality.
- Avoid spreadsheet navigation that depends on fragile external hyperlinks. For app-like experiences, prefer real web navigation and application state.

## 3. Data, calculations, and charts

- Show the calculation logic and units clearly, including currency and date ranges.
- Use consistent data sources for headline metrics, tables, and charts.
- Recalculate dependent totals and visualizations when the underlying data changes.
- Include sensible empty, invalid, loading, and error states.
- Use clearly labelled fictional sample data for demos. Do not imply sample transactions are real customer data.
- Test representative cases: zero values, negative balances, missing fields, month changes, year changes, and boundary dates as applicable.
- Never claim bank, UPI, or other external synchronization unless a real, authorized integration exists and has been tested.

## 4. Responsive and accessibility checks

- Test desktop, tablet, and mobile layouts.
- Ensure controls have clear names, sufficient contrast, visible focus states, and usable touch targets.
- Do not rely on colour alone to communicate success, warning, profit, loss, or selection.
- Check keyboard navigation where applicable and provide understandable error messages.

## 5. Customer readiness

Each product should include, as appropriate:
- A clear product description and statement of intended use.
- A short getting-started guide and contextual instructions.
- Requirements and compatibility notes.
- Transparent limitations and any manual steps required.
- A privacy/data-handling explanation where personal or financial data may be entered.
- A licence/usage statement, support contact or process, version identifier, and change notes.
- Appropriate legal terms and disclaimers reviewed for the product and target market.

## 6. Release gates

A product must not be described as fully tested, production-ready, or ready for sale until the relevant checks have evidence.

1. **Visual review:** compare against the supplied reference or approved design.
2. **Interaction test:** exercise every visible control and each main user journey.
3. **Calculation/data test:** independently verify formulas, totals, and chart consistency.
4. **Responsive test:** check supported screen sizes and browsers.
5. **Compatibility test:** test in the actual target application or browser, not only by inspecting the file or source.
6. **Failure-state test:** verify validation, empty states, import errors, and recovery behavior.
7. **Content and legal review:** verify instructions, limitations, licence, privacy wording, and claims.
8. **Release decision:** record known limitations and obtain the owner's authorization before commercial publication.

## 7. Evidence and honest status reporting

Report separately what was inspected, what was automatically tested, what was tested in the target application, and what remains unverified. A successful build or a valid file structure does not prove that every customer interaction works. Never mark an untested feature as complete.

## 8. Applying the standard to the Income & Expense Tracker

The tracker should ultimately present a polished dashboard with clear left-side navigation, summary cards, readable charts, working month/year selectors, and dependable income/expense workflows. Menu selections must open the corresponding working view. Entering or importing transactions must update the monthly summary and profit-and-loss calculations correctly.

Bank-statement import should be clearly described as manual unless a secure automated integration is implemented. Automatic bank or UPI syncing must not be advertised based only on a specification or a sample workbook.

This standard defines acceptance criteria; it does not itself implement or certify any product.
