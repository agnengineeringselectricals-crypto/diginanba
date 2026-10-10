'use client';

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
  { icon: '🧒', category: 'Kids & young creators', amount: '$25–$200', detail: 'Monthly scenario · supervised art, printables & learning projects' },
  { icon: '🏡', category: 'Homemakers', amount: '$100–$800', detail: 'Monthly scenario · recipe ebooks, planners & craft patterns' },
  { icon: '🎓', category: 'Students', amount: '$50–$500', detail: 'Monthly scenario · original study aids, notes & templates' },
  { icon: '🧑‍💻', category: 'Freelancers', amount: '$300–$2,500', detail: 'Monthly scenario · design packs, presets & client toolkits' },
  { icon: '🚀', category: 'Entrepreneurs', amount: '$500–$5,000+', detail: 'Monthly scenario · specialist guides, systems & business kits' },
  { icon: '🏢', category: 'Businesses & enterprises', amount: '$1,000–$10,000+', detail: 'Monthly scenario · team licences, training & workflow tools' },
  { icon: '🧑‍🏫', category: 'Teachers & educators', amount: '$100–$1,200', detail: 'Monthly scenario · lesson packs, worksheets & courses' },
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
        <div className="dn-earning-examples-heading"><div><span className="dn-creator-kicker">Creator paths</span><h3>Digital income possibilities by creator type</h3></div><p>The creator economy is growing, but earnings are uneven. These are planning scenarios calculated from possible sales volumes and prices—not verified averages or guaranteed income.</p></div>
        <div className="dn-earning-grid">{creatorEarningExamples.map((item) => <article className="dn-earning-example" key={item.category}><span className="dn-earning-example-icon" aria-hidden="true">{item.icon}</span><div className="dn-earning-example-copy"><strong>{item.category}</strong><small>{item.detail}</small></div><b>{item.amount}</b></article>)}</div>
        <div className="dn-earning-examples-footer"><div className="dn-earning-sources"><span>Market research:</span><a href="https://www.creatoriq.com/press/releases/state-of-creator-compensation-" target="_blank" rel="noreferrer">CreatorIQ creator compensation</a><a href="https://neoreach.com/reports/creator-earnings-report-2025/" target="_blank" rel="noreferrer">NeoReach earnings report</a><a href="https://investors.etsy.com/sec-filings/all-sec-filings/content/0001370637-25-000017/etsy-20241231.htm" target="_blank" rel="noreferrer">Etsy seller census</a></div><Link className="dn-creator-cta" href="/signup">Start your creator journey <span aria-hidden="true">→</span></Link></div>
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
