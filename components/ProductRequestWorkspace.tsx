'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import './product-request-workspace.css';

type ProductKind = string;
const productKinds: { value: ProductKind; label: string }[] = [
  { value: "Interactive web tool or dashboard", label: "Interactive web tool or dashboard" },
  { value: "AI assistant or chatbot", label: "AI assistant or chatbot" },
  { value: "AI agent or automation", label: "AI agent or automation" },
  { value: "Website or landing page", label: "Website or landing page" },
  { value: "Mobile app", label: "Mobile app" },
  { value: "Web application", label: "Web application" },
  { value: "Browser extension", label: "Browser extension" },
  { value: "API or developer tool", label: "API or developer tool" },
  { value: "SaaS business tool", label: "SaaS business tool" },
  { value: "CRM or customer manager", label: "CRM or customer manager" },
  { value: "Project management tool", label: "Project management tool" },
  { value: "Task manager", label: "Task manager" },
  { value: "Team collaboration tool", label: "Team collaboration tool" },
  { value: "Appointment booking system", label: "Appointment booking system" },
  { value: "Calendar and scheduling tool", label: "Calendar and scheduling tool" },
  { value: "Invoice generator", label: "Invoice generator" },
  { value: "Quotation or estimate generator", label: "Quotation or estimate generator" },
  { value: "Receipt maker", label: "Receipt maker" },
  { value: "Billing and accounting tool", label: "Billing and accounting tool" },
  { value: "GST calculator or tool", label: "GST calculator or tool" },
  { value: "Tax calculator", label: "Tax calculator" },
  { value: "Payroll tool", label: "Payroll tool" },
  { value: "Inventory management system", label: "Inventory management system" },
  { value: "Stock and warehouse tracker", label: "Stock and warehouse tracker" },
  { value: "Order management tool", label: "Order management tool" },
  { value: "Point of sale (POS) tool", label: "Point of sale (POS) tool" },
  { value: "Customer support helpdesk", label: "Customer support helpdesk" },
  { value: "Live chat tool", label: "Live chat tool" },
  { value: "Email marketing tool", label: "Email marketing tool" },
  { value: "Social media scheduler", label: "Social media scheduler" },
  { value: "SEO analysis tool", label: "SEO analysis tool" },
  { value: "Keyword research tool", label: "Keyword research tool" },
  { value: "Website analytics dashboard", label: "Website analytics dashboard" },
  { value: "Lead generation tool", label: "Lead generation tool" },
  { value: "Sales funnel builder", label: "Sales funnel builder" },
  { value: "Marketing campaign planner", label: "Marketing campaign planner" },
  { value: "Affiliate marketing tracker", label: "Affiliate marketing tracker" },
  { value: "E-commerce store tool", label: "E-commerce store tool" },
  { value: "Product catalog builder", label: "Product catalog builder" },
  { value: "Price comparison tool", label: "Price comparison tool" },
  { value: "Subscription management tool", label: "Subscription management tool" },
  { value: "Payment tracking tool", label: "Payment tracking tool" },
  { value: "Personal finance tracker", label: "Personal finance tracker" },
  { value: "Budget planner", label: "Budget planner" },
  { value: "Income and expense tracker", label: "Income and expense tracker" },
  { value: "Loan and EMI calculator", label: "Loan and EMI calculator" },
  { value: "Investment tracker", label: "Investment tracker" },
  { value: "Savings goal planner", label: "Savings goal planner" },
  { value: "Excel spreadsheet", label: "Excel spreadsheet" },
  { value: "Google Sheets spreadsheet", label: "Google Sheets spreadsheet" },
  { value: "Excel / Google Sheets dashboard", label: "Excel / Google Sheets dashboard" },
  { value: "Financial model spreadsheet", label: "Financial model spreadsheet" },
  { value: "Business plan template", label: "Business plan template" },
  { value: "Budget spreadsheet", label: "Budget spreadsheet" },
  { value: "Invoice spreadsheet", label: "Invoice spreadsheet" },
  { value: "Expense tracker spreadsheet", label: "Expense tracker spreadsheet" },
  { value: "Inventory spreadsheet", label: "Inventory spreadsheet" },
  { value: "Sales tracker spreadsheet", label: "Sales tracker spreadsheet" },
  { value: "Attendance tracker", label: "Attendance tracker" },
  { value: "Timesheet", label: "Timesheet" },
  { value: "Project tracker spreadsheet", label: "Project tracker spreadsheet" },
  { value: "Habit tracker", label: "Habit tracker" },
  { value: "Workout tracker", label: "Workout tracker" },
  { value: "Meal planner", label: "Meal planner" },
  { value: "Study planner", label: "Study planner" },
  { value: "Lesson planner", label: "Lesson planner" },
  { value: "Student progress tracker", label: "Student progress tracker" },
  { value: "School management tool", label: "School management tool" },
  { value: "Quiz or assessment builder", label: "Quiz or assessment builder" },
  { value: "Flashcard creator", label: "Flashcard creator" },
  { value: "Online course", label: "Online course" },
  { value: "Ebook", label: "Ebook" },
  { value: "How-to guide", label: "How-to guide" },
  { value: "Research report", label: "Research report" },
  { value: "Checklist", label: "Checklist" },
  { value: "Workbook", label: "Workbook" },
  { value: "Printable planner", label: "Printable planner" },
  { value: "Resume or CV template", label: "Resume or CV template" },
  { value: "Cover letter template", label: "Cover letter template" },
  { value: "Proposal template", label: "Proposal template" },
  { value: "Contract or policy template", label: "Contract or policy template" },
  { value: "Business document template", label: "Business document template" },
  { value: "Presentation template", label: "Presentation template" },
  { value: "PowerPoint slide deck", label: "PowerPoint slide deck" },
  { value: "Pitch deck", label: "Pitch deck" },
  { value: "Report template", label: "Report template" },
  { value: "Meeting notes template", label: "Meeting notes template" },
  { value: "SOP or process document", label: "SOP or process document" },
  { value: "Notion template", label: "Notion template" },
  { value: "Airtable base", label: "Airtable base" },
  { value: "Database template", label: "Database template" },
  { value: "Form builder", label: "Form builder" },
  { value: "Survey builder", label: "Survey builder" },
  { value: "Workflow builder", label: "Workflow builder" },
  { value: "No-code automation", label: "No-code automation" },
  { value: "Zapier or Make workflow", label: "Zapier or Make workflow" },
  { value: "Data import/export tool", label: "Data import/export tool" },
  { value: "Data cleaning tool", label: "Data cleaning tool" },
  { value: "Data visualization dashboard", label: "Data visualization dashboard" },
  { value: "Chart or graph builder", label: "Chart or graph builder" },
  { value: "PDF tool", label: "PDF tool" },
  { value: "Document converter", label: "Document converter" },
  { value: "Image editor", label: "Image editor" },
  { value: "Photo editing preset", label: "Photo editing preset" },
  { value: "Logo design", label: "Logo design" },
  { value: "Brand identity kit", label: "Brand identity kit" },
  { value: "Social media graphics", label: "Social media graphics" },
  { value: "Ad creative template", label: "Ad creative template" },
  { value: "Video editing template", label: "Video editing template" },
  { value: "Animation asset", label: "Animation asset" },
  { value: "Audio or music asset", label: "Audio or music asset" },
  { value: "Podcast toolkit", label: "Podcast toolkit" },
  { value: "Content writing tool", label: "Content writing tool" },
  { value: "Copywriting template", label: "Copywriting template" },
  { value: "Translation or localization tool", label: "Translation or localization tool" },
  { value: "Language learning resource", label: "Language learning resource" },
  { value: "AI image generator workflow", label: "AI image generator workflow" },
  { value: "AI video creation workflow", label: "AI video creation workflow" },
  { value: "Prompt library", label: "Prompt library" },
  { value: "Prompt template", label: "Prompt template" },
  { value: "Design system or UI kit", label: "Design system or UI kit" },
  { value: "Website UI component kit", label: "Website UI component kit" },
  { value: "Figma resource", label: "Figma resource" },
  { value: "Icon pack", label: "Icon pack" },
  { value: "Font or typography resource", label: "Font or typography resource" },
  { value: "3D asset", label: "3D asset" },
  { value: "Game asset", label: "Game asset" },
  { value: "Game or interactive experience", label: "Game or interactive experience" },
  { value: "E-learning resource", label: "E-learning resource" },
  { value: "Health and wellness tracker", label: "Health and wellness tracker" },
  { value: "Fitness planner", label: "Fitness planner" },
  { value: "Travel planner", label: "Travel planner" },
  { value: "Trip budget tool", label: "Trip budget tool" },
  { value: "Real estate calculator", label: "Real estate calculator" },
  { value: "Construction estimator", label: "Construction estimator" },
  { value: "Electrical calculator or engineering tool", label: "Electrical calculator or engineering tool" },
  { value: "Engineering design tool", label: "Engineering design tool" },
  { value: "CAD resource", label: "CAD resource" },
  { value: "Manufacturing workflow", label: "Manufacturing workflow" },
  { value: "Agriculture planning tool", label: "Agriculture planning tool" },
  { value: "Restaurant management tool", label: "Restaurant management tool" },
  { value: "Retail management tool", label: "Retail management tool" },
  { value: "Freelancer business toolkit", label: "Freelancer business toolkit" },
  { value: "Small business toolkit", label: "Small business toolkit" },
  { value: "Nonprofit management tool", label: "Nonprofit management tool" },
  { value: "Legal research or document tool", label: "Legal research or document tool" },
  { value: "HR recruitment tool", label: "HR recruitment tool" },
  { value: "Employee onboarding tool", label: "Employee onboarding tool" },
  { value: "Performance review tool", label: "Performance review tool" },
  { value: "Customer survey tool", label: "Customer survey tool" },
  { value: "Event planning tool", label: "Event planning tool" },
  { value: "Wedding planner", label: "Wedding planner" },
  { value: "Family organizer", label: "Family organizer" },
  { value: "Personal productivity tool", label: "Personal productivity tool" },
];

export default function ProductRequestWorkspace() {
  const [expanded] = useState(true);
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [existingProducts, setExistingProducts] = useState<{id:string;publicId?:string;slug:string;title:string;description:string;category:string;creatorName?:string;creatorId?:string;price?:string}[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [hasSearchedProducts, setHasSearchedProducts] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [idea, setIdea] = useState('');
  const [kind, setKind] = useState<string>('Interactive web tool or dashboard');
  const [kindQuery, setKindQuery] = useState<string>('Interactive web tool or dashboard');
  useEffect(() => {
    if (!createMode) return;
    const timer = window.setTimeout(() => {
      descriptionInputRef.current?.focus();
      descriptionInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [createMode]);

  useEffect(() => {
    const query = productSearch.trim();
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const params = new URLSearchParams({ market: 'IN' });
        if (query.length >= 2) params.set('q', query);
        const response = await fetch('/api/products?' + params.toString(), { signal: controller.signal });
        const data = await response.json();
        if (active) {
          setExistingProducts(Array.isArray(data.products) ? data.products : []);
          setHasSearchedProducts(query.length >= 2);
        }
      } catch {
        if (active) { setExistingProducts([]); setHasSearchedProducts(query.length >= 2); }
      } finally {
        if (active) setSearchingProducts(false);
      }
    }, query.length >= 2 ? 250 : 0);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [productSearch]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestRef, setRequestRef] = useState('');

  const selectedKindLabel = kind.trim() || 'Product type not selected';
  const canPreview = idea.trim().length >= 5 && kind.trim().length >= 2;
  const description = [
    'Product/tool description supplied by the requester:',
    idea.trim(),
    'Product type: ' + selectedKindLabel,
    'Distribution intent: make the finalized product available to customers globally.',
    'Creator intent: the creator may use their own product and may choose to submit it for publishing and earning after reviewing the finished design.',
    'Future improvements: the creator should be able to request or make feature updates to their product after publication, subject to review.',
    'Pricing stage: keep price-setting locked until the product design has been generated and finalized. Then recommend a price from the product type and design; let the creator edit it and choose their home currency. Show the 50% DigiNanba share, maintenance costs and estimated creator net before publication. Convert display prices for other markets using current exchange rates.',
  ].join('\n\n');

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      let visitorId = localStorage.getItem('diginanba-search-visitor');
      if (!visitorId) {
        visitorId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'visitor-' + Date.now();
        localStorage.setItem('diginanba-search-visitor', visitorId);
      }
      const response = await fetch('/api/products/customizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: idea.trim().slice(0, 160),
          description,
          kind: 'new_product',
          market: 'IN',
          locale: 'en-IN',
          preferredFormat: 'not_sure',
          budgetRange: 'not_sure',
          visitorId,
          requesterRole: 'both',
          intendedUse: 'use_and_publish',
          targetAudience: '',
          keyFeatures: [],
          priceExpectation: 'help_recommend',
          productKind: selectedKindLabel,
          requestSource: 'homepage_product_workspace',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not submit your product brief.');
      const id = data.request?.id ? String(data.request.id).slice(0, 8).toUpperCase() : '';
      setRequestRef(id);
      setSuccess('Your product brief has been received' + (id ? ' · Reference ' + id : '') + '. The design still needs to be generated and finalized before creator pricing can be set. This request does not itself publish a product.');
      setPreviewOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not submit your product brief. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="dn-product-workspace" id="create-your-tool" aria-labelledby="dn-product-workspace-title">
    <div className="dn-pw-heading">
      <div>
        <h2 className="dn-pw-brand-mantra" id="dn-product-workspace-title" aria-label="Discover, Create and Earn">
          <span>Discover</span><span className="dn-pw-mantra-create">Create</span><span className="dn-pw-mantra-earn">and Earn</span>
        </h2>
      </div>
      <div className="dn-pw-orbit" aria-hidden="true"><span>✦</span><i>✧</i><b>↗</b></div>
    </div>
    <div className="dn-pw-builder dn-pw-search-first">
      <div className="dn-pw-search-toolbar">
        <label className="dn-pw-field-full dn-pw-product-search-label">
          <span className="dn-pw-search-caption">Find a digital tool or product</span>
          <input type="search" list="dn-pw-product-search-types" value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setCreateMode(false); }} placeholder="Search by product name, description or creator…" autoComplete="off" />
          <datalist id="dn-pw-product-search-types">{productKinds.map((item) => <option key={item.value} value={item.label} />)}</datalist>
        </label>
        <button type="button" className="dn-pw-start dn-pw-create-cta" onClick={() => { setIdea((current) => current.trim() ? current : productSearch.trim()); setCreateMode(true); setError(''); setSuccess(''); }}>Find or Create</button>
      </div>
      <div className="dn-pw-existing-results" aria-live="polite">
        {(existingProducts.length > 0 || productSearch.trim().length < 2) && <div className="dn-pw-existing-heading"><strong>{productSearch.trim().length >= 2 ? 'Matching products and tools' : 'Explore existing products'}</strong><span>{productSearch.trim().length >= 2 ? 'Relevant matches from the marketplace' : 'Start here, or type to find something specific'}</span></div>}
        {searchingProducts && <p className="dn-pw-search-status" role="status">Finding relevant products…</p>}
        {!searchingProducts && existingProducts.length > 0 ? <div className="dn-pw-existing-roller">{existingProducts.slice(0,12).map((product) => <Link className="dn-pw-existing-card" key={product.id} href={`/products/${product.slug}?market=IN`}>
          <strong>{product.title}</strong>{product.creatorName && product.creatorName.trim().toLowerCase() !== "diginanba" && <small className="dn-pw-result-creator">by {product.creatorName.trim().split(/\s+/).slice(0,2).join(" ")}</small>}{product.price && <small className="dn-pw-result-price">{product.price}</small>}<span className="dn-pw-existing-open">View product →</span>
        </Link>)}</div> : !searchingProducts && hasSearchedProducts ? <div className="dn-pw-no-match-card"><p><strong>Wow! “{productSearch.trim()}” isn’t here yet.</strong></p><p>Create it and earn with DigiNanba.</p><button type="button" className="dn-pw-start dn-pw-create-earn" onClick={() => { setIdea((current) => current.trim() ? current : productSearch.trim()); setCreateMode(true); setError(''); setSuccess(''); }}>✨ Create it &amp; earn</button></div> : null}
        {(!hasSearchedProducts || existingProducts.length > 0) && <a className="dn-pw-marketplace-link" href={productSearch.trim().length >= 2 ? `/explore?market=IN&q=${encodeURIComponent(productSearch.trim())}` : '/explore?market=IN'}>Browse all marketplace products →</a>}
      </div>
    </div>
    {expanded && createMode && <div className="dn-pw-builder">
      <div className="dn-pw-assistant">
        <div className="dn-pw-assistant-avatar">DN</div>
        <div><strong>DigiNanba Product Guide</strong><p>Tell us what you want to create. You do not need to specify every feature or decide on a price now. You can review this brief before submitting it.</p></div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); if (canPreview) setPreviewOpen(true); }}>
        <div className="dn-pw-fields">
          <label className="dn-pw-field-full">Describe the product or tool you want
            <textarea ref={descriptionInputRef} required minLength={5} maxLength={4500} rows={6} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Describe the product or tool, how you imagine it working, the design you prefer, and anything important. You can write naturally—DigiNanba can help refine the brief." />
            <small>Only the description and product type are required. You can request new features or improvements later.</small>
          </label>
          <label className="dn-pw-field-full">What kind of product is it?
            <input list="dn-pw-product-types" value={kindQuery} maxLength={120} onChange={(event) => { const value = event.target.value; setKindQuery(value); setKind(value); }} placeholder="Start typing a product type…" autoComplete="off" required />
            <datalist id="dn-pw-product-types">
              {productKinds.map((item) => <option key={item.value} value={item.label} />)}
            </datalist>
            <small>Start typing—for example, “invoice”, “keyboard”, “AI”, “tracker” or “planner”—to see matching suggestions. If your type is missing, enter it in your own words.</small>
          </label>
        </div>
        <div className="dn-pw-global-note"><span className="dn-pw-global-icon">◎</span><div><strong>What happens after you submit?</strong><p>DigiNanba reviews the request first. If it can be taken forward, the available format, language, price and delivery details will be shared before you commit.</p></div></div>
        <div className="dn-pw-form-footer"><p>Review your product brief in the preview before submitting it.</p><button type="submit" className="dn-pw-start" disabled={!canPreview}>Preview &amp; finalize brief →</button></div>
      </form>
    </div>}
    {success && <div className="dn-pw-success" role="status"><strong>✓ Request received</strong><p>{success}</p><p>We will review your idea. Submitting a request does not mean a finished product is already available or guarantee publication, earnings or a delivery date.</p></div>}
    {error && <p className="dn-pw-error" role="alert">{error}</p>}
    {previewOpen && <div className="dn-pw-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPreviewOpen(false); }}>
      <section className="dn-pw-modal" role="dialog" aria-modal="true" aria-labelledby="dn-pw-preview-title">
        <div className="dn-pw-modal-header"><div><span className="dn-pw-kicker">BRIEF PREVIEW</span><h3 id="dn-pw-preview-title">Review your product idea</h3><p>Make sure this describes what you want before sending it to DigiNanba.</p></div><button type="button" onClick={() => setPreviewOpen(false)} disabled={busy} aria-label="Close preview">×</button></div>
        <div className="dn-pw-preview-tags"><span>{selectedKindLabel}</span></div>
        <h4>{idea.trim().split(/\n/)[0].slice(0, 160) || 'Untitled product idea'}</h4>
        <div className="dn-pw-description-preview">{idea.trim()}</div>
        <div className="dn-pw-stage-list"><p>After submission, DigiNanba will review your request. If it can be taken forward, we will explain the next steps and any applicable terms before you commit.</p></div>
        <p className="dn-pw-disclaimer">This submits your product brief for review. It does not mean a finished product has already been generated, priced, published, or guaranteed to earn money.</p>
        {error && <p className="dn-pw-error" role="alert">{error}</p>}
        <form onSubmit={submitRequest} className="dn-pw-modal-actions"><button type="button" className="dn-pw-back" onClick={() => setPreviewOpen(false)} disabled={busy}>← Edit description</button><button type="submit" className="dn-pw-start" disabled={busy}>{busy ? 'Submitting…' : 'Confirm & submit brief'}</button></form>
      </section>
    </div>}
  </section>;
}
