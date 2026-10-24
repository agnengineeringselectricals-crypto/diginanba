import Link from 'next/link';

export const metadata = { title: 'Contact & Support', description: 'Find support and contact guidance for DigiNanba.' };

export default function ContactPage() {
 return <main className="dn-legal-page"><div className="dn-legal-wrap"><p className="dn-legal-eyebrow">WE'RE HERE TO HELP</p><h1>Contact &amp; Support</h1><p className="dn-legal-updated">DigiNanba customer help</p>
 <div className="dn-legal-contact-card"><h2>Customer support chat</h2><p>For general questions about finding products, accounts and marketplace features, open the floating <strong>Help</strong> chat in the bottom-right corner of the website. Suggested questions are available inside the chat.</p><p><strong>Important:</strong> The Help chat is for general questions. It cannot access private order records, confirm payments, process refunds or accept formal legal notices. Purchasing and payment support are not available yet.</p></div>
 <h2>Order, refund or download issue</h2><p>Do not send passwords, payment-card numbers or other sensitive information to the chat. Official payment, refund and download support details will be published before those services become available.</p>
 <h2>Privacy or data request</h2><p>Review the <Link href="/privacy">Privacy Policy</Link>. A dedicated privacy contact will be published before public launch so data requests can be handled reliably.</p>
 <h2>Copyright or intellectual-property report</h2><p>Review the <Link href="/copyright">Copyright &amp; Intellectual Property Policy</Link> for the information a report should contain. A dedicated copyright contact will be published before public launch. The Help chat cannot accept formal legal notices.</p>
 <div className="dn-legal-notice"><strong>Official contact details:</strong> Dedicated contacts for customer support, privacy and copyright matters will be published before public launch. Until then, the Help chat is available for general questions only.</div>
 <p className="dn-legal-related">Related: <Link href="/terms">Terms &amp; Conditions</Link> · <Link href="/refunds">Refund &amp; Cancellation Policy</Link> · <Link href="/creator-agreement">Creator Agreement</Link></p></div></main>;
}
