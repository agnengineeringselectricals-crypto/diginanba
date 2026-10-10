'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const audiences = [
  { icon: '🏡', title: 'Homemakers', copy: 'Turn everyday skills into useful digital products.', href: '/explore?q=templates' },
  { icon: '🎒', title: 'Students', copy: 'Share study notes, planners and learning resources.', href: '/explore?q=learning' },
  { icon: '🧑‍💻', title: 'Freelancers', copy: 'Sell your workflows, portfolios and client-ready kits.', href: '/explore?q=freelance' },
  { icon: '🚀', title: 'Entrepreneurs', copy: 'Package your know-how into products that scale.', href: '/explore?q=business' },
  { icon: '🏢', title: 'Businesses', copy: 'Create and distribute tools for teams and customers.', href: '/explore?q=business' },
  { icon: '🧑‍🏫', title: 'Educators', copy: 'Publish lessons, worksheets and practical guides.', href: '/explore?q=education' },
  { icon: '🧒', title: 'Young creators', copy: 'Discover age-appropriate ways to learn and create.', href: '/explore?q=creative' },
];

const possibilities = [
  'Templates', 'Ebooks & guides', 'Spreadsheets', 'Design assets', 'Online courses',
  'AI workflows', 'Printables', 'Code & software', 'Business kits', 'Audio & video',
  'Engineering tools', 'Learning resources',
];

export default function CreatorEarningsShowcase() {
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTickerIndex((index) => (index + 1) % possibilities.length), 2600);
    return () => window.clearInterval(timer);
  }, []);

  return <section className="dn-creator-showcase" aria-labelledby="dn-creator-title">
    <div className="dn-creator-wrap">
      <div className="dn-creator-intro">
        <span className="dn-creator-kicker">A marketplace for every kind of creator</span>
        <h2 id="dn-creator-title">Your skills can become someone’s next big idea.</h2>
        <p>From a student with brilliant notes to a growing enterprise, DigiNanba is built for people who have something useful to share.</p>
        <div className="dn-possibility-strip" aria-live="polite">
          <span className="dn-possibility-spark">✦</span>
          <span>Unlimited possibilities</span>
          <strong key={possibilities[tickerIndex]}>{possibilities[tickerIndex]}</strong>
          <span className="dn-possibility-dots" aria-hidden="true">{possibilities.map((item, index) => <i key={item} className={index === tickerIndex ? 'active' : ''} />)}</span>
        </div>
      </div>

      <div className="dn-earnings-card">
        <div className="dn-earnings-top">
          <span className="dn-earnings-icon">↗</span>
          <div><span className="dn-earnings-label">DigiNanba creator community</span><h3>Every creator’s progress matters.</h3></div>
        </div>
        <div className="dn-earnings-total"><span>Verified creator earnings</span><strong>—</strong></div>
        <p className="dn-earnings-note">Real marketplace-wide totals will appear here once verified sales reporting is connected. We never invent earnings figures.</p>
        <Link className="dn-creator-cta" href="/signup">Start your creator journey <span aria-hidden="true">→</span></Link>
      </div>

      <div className="dn-audience-heading"><div><span className="dn-creator-kicker">Made for more people</span><h3>There’s a place for your talent.</h3></div><Link href="/signup">Become a creator →</Link></div>
      <div className="dn-audience-track" aria-label="Creator communities">
        {audiences.map((audience) => <Link href={audience.href} className="dn-audience-card" key={audience.title}>
          <span className="dn-audience-icon" aria-hidden="true">{audience.icon}</span>
          <strong>{audience.title}</strong>
          <span>{audience.copy}</span>
          <em>Explore opportunities <b aria-hidden="true">↗</b></em>
        </Link>)}
      </div>
    </div>
  </section>;
}
