'use client';

import Link from 'next/link';

const creatorPaths = [
  { icon: '🧒', title: 'Young creators', audience: 'With parent or guardian support', ideas: 'Original activity sheets, art packs, learning printables', href: '/explore?q=printables' },
  { icon: '🏡', title: 'Homemakers', audience: 'Turn everyday know-how into resources', ideas: 'Meal planners, recipe ebooks, craft patterns, home budgets', href: '/explore?q=templates' },
  { icon: '🎓', title: 'Students', audience: 'Share original work and study skills', ideas: 'Revision planners, study trackers, original notes, flashcards', href: '/explore?q=learning' },
  { icon: '🧑‍💻', title: 'Freelancers', audience: 'Package repeatable professional work', ideas: 'Client onboarding kits, design assets, project templates', href: '/explore?q=freelance' },
  { icon: '🚀', title: 'Entrepreneurs', audience: 'Productize specialist knowledge', ideas: 'Business playbooks, calculators, launch checklists, SOPs', href: '/explore?q=business' },
  { icon: '🏢', title: 'Businesses & teams', audience: 'Create resources that solve repeat problems', ideas: 'Training packs, workflow templates, team toolkits, licensed resources', href: '/explore?q=business' },
  { icon: '🧓', title: 'Retired professionals', audience: 'Share experience, skills and practical knowledge', ideas: 'Career guides, hobby lessons, mentoring worksheets, checklists', href: '/explore?q=guides' },
  { icon: '🧑‍🏫', title: 'Teachers & educators', audience: 'Make learning resources reusable', ideas: 'Lesson plans, worksheets, rubrics, classroom activity packs', href: '/explore?q=education' },
];

export default function CreatorEarningsShowcase() {
  return <section className="dn-creator-showcase" aria-labelledby="dn-creator-title">
    <div className="dn-creator-wrap">
      <div className="dn-creator-hero">
        <div className="dn-creator-hero-copy">
          
          <h2 id="dn-creator-title">Anyone can create something useful.</h2>
          <p>Turn your knowledge, skills and creativity into digital products.</p>
        </div>
        <div className="dn-creator-hero-art" aria-hidden="true">
          <span className="dn-creator-art-card dn-art-card-one">📊<small>Templates</small></span>
          <span className="dn-creator-art-card dn-art-card-two">📚<small>Guides</small></span>
          <span className="dn-creator-art-card dn-art-card-three">🎨<small>Creative assets</small></span>
          <span className="dn-creator-art-spark">✦</span>
        </div>
      </div>

      <div className="dn-creator-path-heading">
        <div><h3>Ideas for every kind of creator</h3></div>
        
      </div>
      <div className="dn-creator-path-grid">
        {creatorPaths.map((path) => <article className="dn-creator-path-card" key={path.title}>
          <span className="dn-creator-path-icon" aria-hidden="true">{path.icon}</span>
          <div className="dn-creator-path-copy"><h4>{path.title}</h4></div>
          <div className="dn-creator-path-ideas"><p>{path.ideas}</p></div>
          <Link href={path.href}>Explore related products <span aria-hidden="true">↗</span></Link>
        </article>)}
      </div>

      <div className="dn-creator-research" aria-labelledby="dn-creator-research-title">
        <div className="dn-creator-research-copy">
          
          <h3 id="dn-creator-research-title">Build a product business with realistic expectations.</h3>
          <p>Creator-economy research shows that earnings vary widely and are concentrated among a small share of creators. These findings are industry context—not DigiNanba sales results or a forecast of what an individual seller will earn.</p>
        </div>
        <div className="dn-creator-research-stats">
          <a href="https://neoreach.com/reports/creator-earnings-report-2025/" target="_blank" rel="noreferrer" className="dn-creator-research-stat">
            <strong>50.71%</strong>
            <span>of surveyed creators reported earning under $15,000 annually in NeoReach's 2025 report.</span>
            <em>Read NeoReach research ↗</em>
          </a>
          <a href="https://www.creatoriq.com/press/releases/state-of-creator-compensation-" target="_blank" rel="noreferrer" className="dn-creator-research-stat">
            <strong>62%</strong>
            <span>of creator payments in CreatorIQ's 2025 data went to the top 10% of creators.</span>
            <em>Read CreatorIQ research ↗</em>
          </a>
        </div>
        <div className="dn-creator-research-note">These reports study the broader creator economy and creator compensation, not DigiNanba digital-product seller earnings. Income depends on demand, pricing, quality, distribution, costs, taxes and many other factors.</div>
      </div>
    </div>
  </section>;
}
