import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProducts } from '@/lib/catalog';

const solutions: Record<string,{title:string;description:string;intro:string;category:string}> = {
  'start-a-small-business': { title:'Digital Tools for Starting a Small Business', description:'Practical digital products, templates and spreadsheets for starting and organizing a small business.', intro:'Start with a clear plan, simple financial tracking and repeatable operating documents.', category:'Business & Entrepreneurship' },
  'manage-business-finances': { title:'Digital Tools for Managing Business Finances', description:'Spreadsheets, trackers and practical digital resources for budgeting, cash flow and business finance.', intro:'Build a simple financial workflow for invoices, expenses, cash flow and project margins.', category:'Finance & Accounting' },
  'grow-sales-and-marketing': { title:'Digital Tools for Sales and Marketing', description:'Digital products for content planning, marketing workflows, customer outreach and sales operations.', intro:'Use ready-to-adapt systems to plan campaigns, organize content and improve sales activity.', category:'Marketing & Sales' },
  'automate-work-with-ai': { title:'Digital Tools for AI and Work Automation', description:'AI workflows, prompts and automation resources for reducing repetitive work.', intro:'Find practical AI resources for everyday business and professional workflows.', category:'AI & Automation' },
  'learn-a-new-skill': { title:'Digital Products for Learning New Skills', description:'Guides, learning resources, study systems and practical digital products for skill development.', intro:'Turn a learning goal into a structured, practical workflow.', category:'Education & Learning' },
  'get-organized': { title:'Digital Tools for Getting Organized', description:'Planners, templates, trackers and digital systems for personal and professional organization.', intro:'Choose a practical digital system for planning, tracking and organizing your work or life.', category:'Templates & Documents' },
  'manage-projects': { title:'Digital Tools for Project Management', description:'Project templates, trackers, checklists and planning resources for managing projects.', intro:'Create repeatable project workflows for planning, execution and follow-up.', category:'Templates & Documents' },
  'build-software': { title:'Digital Products for Building Software', description:'Developer resources, code tools and practical digital products for building software.', intro:'Find reusable resources that can accelerate common software-development tasks.', category:'Software / Code' },
  'engineering-and-cad': { title:'Digital Tools for Engineering and CAD', description:'Engineering resources, CAD tools, calculators and technical digital products.', intro:'Find practical technical resources for engineering design and documentation workflows.', category:'CAD / Engineering' },
  'career-and-freelancing': { title:'Digital Tools for Career and Freelancing', description:'CV, proposal, onboarding, planning and professional productivity resources.', intro:'Use practical digital resources to present your skills, win work and manage clients.', category:'Career & Professional' },
};

export function generateStaticParams(){ return Object.keys(solutions).map(slug=>({slug})); }

export async function generateMetadata({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const s=solutions[slug]; if(!s) return {};
  return { title:s.title, description:s.description, alternates:{canonical:`/solutions/${slug}`}, openGraph:{title:`${s.title} | DigiNanba`,description:s.description,url:`https://diginanba.com/solutions/${slug}`} };
}

export default async function SolutionPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const s=solutions[slug]; if(!s) notFound();
  const products=await getProducts('US',s.category);
  const itemList=products.slice(0,12).map((p,i)=>({'@type':'ListItem',position:i+1,url:`https://diginanba.com/products/${p.slug}`,name:p.title}));
  return <main className="wrap catalog-page">
    <div className="sectionhead"><div><div className="eyebrow">DigiNanba solution</div><h1>{s.title}</h1><p className="muted">{s.description}</p></div><Link className="btn" href="/explore">Explore marketplace</Link></div>
    <section className="panel" style={{marginBottom:24}}><h2>Start with the problem</h2><p className="muted">{s.intro} DigiNanba connects practical digital products to real goals, so you can choose a ready-to-use resource instead of searching through unrelated files.</p></section>
    <h2>Recommended digital products</h2>
    <div className="catalog-grid">{products.map(p=><Link href={`/products/${p.slug}`} className="product-card" key={p.id}><span className="category">{p.category}</span><h2>{p.title}</h2><p className="muted">{p.description}</p><div className="product-foot"><b>{p.price}</b><span>View product →</span></div></Link>)}</div>
    {!products.length && <div className="panel"><h2>Products are being added</h2><p className="muted">DigiNanba is expanding this solution area with practical digital products.</p></div>}
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({'@context':'https://schema.org','@type':'ItemList',name:s.title,itemListElement:itemList})}} />
  </main>;
}
