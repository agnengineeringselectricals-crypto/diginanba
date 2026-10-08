import Link from 'next/link';

export const metadata = {
  title: 'Small Business Cash Flow: A Practical Digital Toolkit',
  description: 'A practical guide to tracking income, expenses, timing and cash reserves for a small business.',
  alternates: { canonical: '/guides/small-business-cash-flow' },
};

export default function CashFlowGuide() {
  const faq = [
    ['What is cash flow?', 'Cash flow is the movement of money into and out of a business over time. A profitable business can still have a cash-flow problem if money arrives later than bills are due.'],
    ['What should a cash-flow tracker include?', 'At minimum, track opening cash, expected income, actual income, recurring costs, variable costs, taxes or reserves, and closing cash.'],
    ['How often should I update it?', 'Weekly updates are useful for active small businesses, with a monthly review for longer-term planning.'],
  ];
  return (
    <main className="wrap catalog-page">
      <div className="eyebrow">DigiNanba Guide</div>
      <h1>Small Business Cash Flow: A Practical Digital Toolkit</h1>
      <p className="lead">Cash-flow planning becomes easier when the information you need is organized in one repeatable system. This guide explains a simple workflow and points to digital tools that can help.</p>
      <section className="panel" style={{marginTop:24}}><h2>1. Start with a simple cash position</h2><p>Record the opening cash balance for the period. Then separate expected money coming in from money already received. This prevents future invoices from being treated as cash that is already available.</p></section>
      <section className="panel" style={{marginTop:16}}><h2>2. Track timing, not only totals</h2><p>List major payments by expected date: payroll, rent, subscriptions, suppliers, taxes and other recurring commitments. Timing matters because a business can have enough total revenue but not enough cash on a particular day.</p></section>
      <section className="panel" style={{marginTop:16}}><h2>3. Use scenarios</h2><p>Create a base case, a slower-sales case and an unexpected-expense case. A spreadsheet or calculator makes these scenarios easier to compare and update.</p></section>
      <section className="panel" style={{marginTop:16}}><h2>4. Turn the workflow into a repeatable system</h2><p>Useful digital products include cash-flow trackers, invoice templates, expense trackers and business dashboards. Choose a tool because it improves the workflow, not because it contains more features.</p><p><Link className="btn primary" href="/explore?q=cashflow">Find cash-flow products</Link> <Link className="btn" href="/tools/cash-flow-calculator">Try the free calculator</Link></p></section>
      <section style={{marginTop:28}}><h2>Frequently asked questions</h2>{faq.map(([q,a]) => <div className="panel" style={{marginTop:12}} key={q}><h3>{q}</h3><p className="muted">{a}</p></div>)}</section>
    </main>
  );
}