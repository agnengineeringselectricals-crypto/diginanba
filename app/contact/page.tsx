import Link from 'next/link';

export const metadata = { title: 'Contact & Support', description: 'Find support and contact guidance for DigiNanba.' };

export default function ContactPage() {
 return <main className="dn-legal-page"><div className="dn-legal-wrap"><p className="dn-legal-eyebrow">WE'RE HERE TO HELP</p><h1>Contact &amp; Support</h1><p className="dn-legal-updated">DigiNanba customer help</p>
 <div className="dn-legal-contact-card"><h2>Customer support chat</h2><p>For general questions about finding products, accounts and marketplace features, open the floating <strong>Help</strong> chat in the bottom-right corner of the website. Suggested questions are available inside the chat.</p><p><strong>Important limitations:</strong> The AI assistant cannot access private order records, verify a payment, process a refund or accept formal legal notices. Checkout is currently in demo mode.</p></div>
 <h2>Order, refund or download issue</h2><p>Keep your order reference and product details available. Do not send passwords, payment-card numbers or other sensitive information to the chat. A human support contact and order-support workflow must be published before real transactions begin.</p>
 <h2>Privacy or data request</h2><p>Review the <Link href="/privacy">Privacy Policy</Link>. DigiNanba must configure and publish a monitored privacy contact address before launch so requests can be handled reliably.</p>
 <h2>Copyright or intellectual-property report</h2><p>Review the <Link href="/copyright">Copyright &amp; Intellectual Property Policy</Link> for the information a report should contain. The business must publish a dedicated monitored legal/copyright contact address before accepting formal notices. The automated chat is not that channel.</p>
 <div className="dn-legal-notice"><strong>Launch checklist:</strong> Add and verify a monitored business support email, privacy contact and copyright/legal notice channel here before inviting real customers or creators. No email address is displayed on this page because a verified DigiNanba support address has not yet been supplied.</div>
 <p className="dn-legal-related">Related: <Link href="/terms">Terms &amp; Conditions</Link> · <Link href="/refunds">Refund &amp; Cancellation Policy</Link> · <Link href="/creator-agreement">Creator Agreement</Link></p></div></main>;
}
