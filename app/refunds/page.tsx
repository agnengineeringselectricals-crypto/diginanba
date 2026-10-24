import Link from 'next/link';

export const metadata = { title: 'Refund & Cancellation Policy', description: 'Information about cancellations, digital product issues and refunds on DigiNanba.' };

export default function RefundsPage() {
 return <main className="dn-legal-page"><div className="dn-legal-wrap"><p className="dn-legal-eyebrow">DIGINANBA POLICIES</p><h1>Refund &amp; Cancellation Policy</h1><p className="dn-legal-updated">Last updated: 20 October 2026</p>
 <div className="dn-legal-notice"><strong>Current availability:</strong> Live checkout and refund processing are not currently available. Do not treat a demo or pending order as a paid transaction.</div>
 <h2>1. Digital products</h2><p>Digital products can be delivered immediately and may not be returnable in the same way as physical goods. However, this policy does not remove any mandatory refund, cancellation, withdrawal or consumer rights that apply in your country.</p>
 <h2>2. Before placing an order</h2><p>Review the listing's description, file formats, software requirements, language, licence and included items. If you need clarification, ask through the on-site Help chat. Live purchasing is not currently available.</p>
 <h2>3. Potential grounds for review</h2><p>When live sales are enabled, a customer may request review if they were charged but did not receive access, the delivered file is materially different from the listing, the file is corrupted or cannot be opened after reasonable troubleshooting, a duplicate charge occurred, or a refund is otherwise required by law. Evidence such as an order reference and a description of the problem may be requested; do not send full payment-card details.</p>
 <h2>4. How to request help</h2><p>Use <Link href="/contact">Contact &amp; Support</Link> and include the order reference, product name and a clear description of the issue. The Help chat cannot access private order records or issue refunds. Contact and refund instructions will be provided when live purchasing becomes available.</p>
 <h2>5. Timing and outcomes</h2><p>Refund eligibility, applicable exceptions and processing timelines will be displayed with the live purchasing terms. Where a refund is approved, the time for funds to return may depend on the payment provider and financial institution.</p>
 <h2>6. Cancellations and chargebacks</h2><p>As live checkout is not currently available, this site cannot cancel or refund a live purchase. Once purchasing is available, customers retain rights under applicable law and may use their payment provider's dispute process.</p>
 <h2>7. Changes and legal rights</h2><p>This policy may be updated as the service evolves. Nothing here limits mandatory consumer rights. The terms shown at the time of a live purchase will identify the responsible party and any lawful exceptions.</p>
 <p className="dn-legal-related">Related: <Link href="/terms">Terms &amp; Conditions</Link> · <Link href="/privacy">Privacy Policy</Link> · <Link href="/contact">Contact &amp; Support</Link></p></div></main>;
}
