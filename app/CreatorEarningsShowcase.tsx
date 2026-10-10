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

const creatorEarningExamples = [
  { icon: '📚', category: 'Ebooks & guides', amount: '$2,450', detail: 'Example monthly sales' },
  { icon: '📊', category: 'Templates & spreadsheets', amount: '$1,980', detail: 'Example monthly sales' },
  { icon: '🎨', category: 'Design assets', amount: '$1,760', detail: 'Example monthly sales' },
  { icon: '🤖', category: 'AI tools & workflows', amount: '$2,890', detail: 'Example monthly sales' },
  { icon: '🎓', category: 'Courses & learning', amount: '$3,240', detail: 'Example monthly sales' },
  { icon: '💻', category: 'Software & code', amount: '$2,650', detail: 'Example monthly sales' },
];

const possibilityRows = [
  [['📒','notion template'],['🧵','textures'],['🖌️','procreate'],['🧊','3d model'],['🎙️','hypnosis'],['🎵','music'],['📷','stock photos'],['🧩','digital planner'],['🎨','illustration'],['🧠','AI prompts']],
  [['💪','fitness'],['🚀','programming'],['🎲','sci-fi'],['🎮','vrchat'],['🔊','ableton'],['📚','certification exams'],['🎬','video presets'],['🧶','crochet'],['🗂️','notion dashboard'],['📈','business tools']],
  [['🎧','singles'],['💻','software'],['📐','CAD models'],['🖨️','printable'],['🎹','jazz'],['📊','spreadsheets'],['✍️','ebooks'],['🧒','kids activities'],['🧾','invoice template'],['🤖','AI workflow']],
] as const;

export default function CreatorEarningsShowcase() {
  return <section className="dn-creator-showcase" aria-labelledby="dn-creator-title">
    <div className="dn-creator-wrap">
      <div className="dn-possibilities-hero">
        <h2 id="dn-creator-title">Unlimited possibilities</h2>
        <p>Discover digital products and creators on DigiNanba</p>
      </div>
      <div className="dn-marquee" aria-label="Explore digital product types">
        {possibilityRows.map((row, rowIndex) => <div className={`dn-marquee-row dn-marquee-row-${rowIndex + 1}`} key={rowIndex}>
          <div className="dn-marquee-track">{[...row, ...row].map(([icon, label], index) => <span className="dn-marquee-item" key={`${label}-${index}`}><span className="dn-marquee-icon" aria-hidden="true">{icon}</span><span className="dn-marquee-pill">{label}</span></span>)}</div>
        </div>)}
      </div>

      <div className="dn-earning-examples">
        <div className="dn-earning-examples-heading"><div><span className="dn-creator-kicker">Ideas across categories</span><h3>What could your digital products earn?</h3></div><p>Illustrative monthly sales examples, not a promise of income. Results vary by product, pricing and demand.</p></div>
        <div className="dn-earning-grid">{creatorEarningExamples.map((item) => <article className="dn-earning-example" key={item.category}><span className="dn-earning-example-icon" aria-hidden="true">{item.icon}</span><div className="dn-earning-example-copy"><strong>{item.category}</strong><small>{item.detail}</small></div><b>{item.amount}</b></article>)}</div>
        <div className="dn-earning-examples-footer"><span>Example figures for planning inspiration</span><Link className="dn-creator-cta" href="/signup">Start your creator journey <span aria-hidden="true">→</span></Link></div>
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
