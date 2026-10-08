import Link from 'next/link';

const solutions=[
['start-a-small-business','Start a Small Business'],['manage-business-finances','Manage Business Finances'],['grow-sales-and-marketing','Grow Sales & Marketing'],['automate-work-with-ai','Automate Work with AI'],['learn-a-new-skill','Learn a New Skill'],['get-organized','Get Organized'],['manage-projects','Manage Projects'],['build-software','Build Software'],['engineering-and-cad','Engineering & CAD'],['career-and-freelancing','Career & Freelancing'],
];

export const metadata={title:'Digital Solutions by Goal',description:'Find digital products by the problem or goal you are trying to solve.',alternates:{canonical:'/solutions'}};

export default function SolutionsPage(){return <main className="wrap catalog-page"><div className="sectionhead"><div><div className="eyebrow">DigiNanba Solutions</div><h1>Find digital tools by what you want to accomplish</h1><p className="muted">Start with your goal instead of searching through hundreds of unrelated products.</p></div><Link className="btn" href="/explore">Explore products</Link></div><div className="catalog-grid">{solutions.map(([slug,title])=><Link key={slug} href={`/solutions/${slug}`} className="product-card"><span className="category">Solution</span><h2>{title}</h2><p className="muted">Practical digital resources selected around this real-world goal.</p><div className="product-foot"><span>Find solutions →</span></div></Link>)}</div></main>}
