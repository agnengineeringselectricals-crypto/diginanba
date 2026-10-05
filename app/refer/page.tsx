import Link from 'next/link';

export const metadata = {
  title: 'Refer & Earn | DigiNanba',
  description: 'Updates about DigiNanba’s upcoming referral program.',
};

export default function ReferPage() {
  return <main className="wrap help-page">
    <Link href="/" className="muted">← Back to DigiNanba</Link>
    <div className="panel help-panel">
      <span className="eyebrow">REFER &amp; EARN</span>
      <h1>Share DigiNanba with someone.</h1>
      <p className="muted">Our referral program is being prepared and is not active yet. Referral links and rewards are not currently available. Check back for updates.</p>
      <Link className="btn" href="/explore">Explore digital products</Link>
    </div>
  </main>;
}
