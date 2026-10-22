'use client';

import { useEffect, useState, type FormEvent } from 'react';
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
  { value: "Custom product type", label: "Custom product type" },
];

export default function ProductRequestWorkspace() {
  const [expanded, setExpanded] = useState(false);
  const [idea, setIdea] = useState('');
  const [kind, setKind] = useState<string>('Interactive web tool or dashboard');
  const [kindQuery, setKindQuery] = useState<string>('Interactive web tool or dashboard');
  const [customKind, setCustomKind] = useState('');
  const [savedCustomTypes, setSavedCustomTypes] = useState<string[]>([]);
  const [typeSaveMessage, setTypeSaveMessage] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('diginanba-saved-product-types');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setSavedCustomTypes(parsed.filter((item): item is string => typeof item === 'string').slice(0, 100));
      }
    } catch { /* Ignore unavailable or malformed local preferences. */ }
  }, []);

  function saveCustomType() {
    const value = (kindQuery || customKind).trim().replace(/\s+/g, ' ');
    if (value.length < 2) {
      setTypeSaveMessage('Enter a product type with at least 2 characters.');
      return;
    }
    const existing = savedCustomTypes.find((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase());
    const savedName = existing ?? value;
    const next = existing ? savedCustomTypes : [...savedCustomTypes, value].slice(-100);
    setSavedCustomTypes(next);
    try { localStorage.setItem('diginanba-saved-product-types', JSON.stringify(next)); } catch { /* Keep the type available for this session if storage is blocked. */ }
    setKind(savedName);
    setKindQuery(savedName);
    setCustomKind('');
    setTypeSaveMessage('Saved “' + savedName + '” and selected it.');
  }
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestRef, setRequestRef] = useState('');

  const selectedKindLabel = kind.trim() || 'Product type not selected';
  const exactKnownType = productKinds.some((item) => item.label.toLocaleLowerCase() === kindQuery.trim().toLocaleLowerCase()) || savedCustomTypes.some((item) => item.toLocaleLowerCase() === kindQuery.trim().toLocaleLowerCase());
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
        <span className="dn-pw-kicker">YOUR IDEA → YOUR PRODUCT</span>
        <h2 id="dn-product-workspace-title">What would you like DigiNanba to create?</h2>
        <p>Describe the product or tool in your own words. Everyone can explore the preview; creators can decide whether to publish and earn after their design is finalized.</p>
      </div>
      <div className="dn-pw-orbit" aria-hidden="true"><span>✦</span><i>✧</i><b>↗</b></div>
    </div>
    <div className="dn-pw-launch">
      <div className="dn-pw-launch-copy">
        <span className="dn-pw-status"><span /> SIMPLE PRODUCT BUILDER</span>
        <h3>One description. One product type. DigiNanba helps with the next steps.</h3>
        <p>Products are intended for a global marketplace. Pricing is handled after the design is finalized—not while you are describing your idea.</p>
        <div className="dn-pw-benefits"><span>✓ Simple to start</span><span>✓ Preview before submit</span><span>✓ Global marketplace intent</span></div>
      </div>
      <button type="button" className="dn-pw-start" onClick={() => { setExpanded((value) => !value); setSuccess(''); setError(''); }} aria-expanded={expanded}>
        {expanded ? 'Close builder ↑' : 'Describe your idea →'}
      </button>
    </div>
    {expanded && <div className="dn-pw-builder">
      <div className="dn-pw-assistant">
        <div className="dn-pw-assistant-avatar">DN</div>
        <div><strong>DigiNanba Product Guide</strong><p>Tell us what you want to create. You do not need to specify every feature or decide on a price now. You can review this brief before submitting it.</p></div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); if (canPreview) setPreviewOpen(true); }}>
        <div className="dn-pw-fields">
          <label className="dn-pw-field-full">Describe the product or tool you want
            <textarea required minLength={5} maxLength={4500} rows={6} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Describe the product or tool, how you imagine it working, the design you prefer, and anything important. You can write naturally—DigiNanba can help refine the brief." />
            <small>Only the description and product type are required. You can request new features or improvements later.</small>
          </label>
          <label className="dn-pw-field-full">What kind of product is it?
            <input list="dn-pw-product-types" value={kindQuery} maxLength={120} onChange={(event) => { const value = event.target.value; setKindQuery(value); setKind(value); setTypeSaveMessage(''); }} placeholder="Start typing a product type…" autoComplete="off" required />
            <datalist id="dn-pw-product-types">
              {productKinds.map((item) => <option key={item.value} value={item.label} />)}
              {savedCustomTypes.map((item) => <option key={'saved-' + item} value={item} />)}
            </datalist>
            <small>Start typing—for example, “invoice”, “keyboard”, “AI”, “tracker” or “planner”—to see matching suggestions. If your type is missing, save your own below.</small>
          </label>
          {!exactKnownType && kindQuery.trim().length >= 2 && <div className="dn-pw-field-full dn-pw-custom-type-field"><button type="button" className="dn-pw-back dn-pw-save-type" onClick={saveCustomType}>Save “{kindQuery.trim()}” as a product type &amp; select it</button>{typeSaveMessage && <p className="dn-pw-type-save-message" role="status">{typeSaveMessage}</p>}</div>}
        </div>
        <div className="dn-pw-global-note"><span className="dn-pw-global-icon">◎</span><div><strong>Designed for global availability</strong><p>The goal is to offer finalized products worldwide, display prices in each customer's local currency, and let creators choose their own pricing currency. Actual currency conversion requires a current exchange-rate source at checkout.</p></div></div>
        <div className="dn-pw-form-footer"><p>Review your product brief in the preview before submitting it.</p><button type="submit" className="dn-pw-start" disabled={!canPreview}>Preview &amp; finalize brief →</button></div>
      </form>
    </div>}
    {success && <div className="dn-pw-success" role="status"><strong>✓ Brief received</strong><p>{success}</p><p className="dn-pw-next-step"><strong>Next stage:</strong> product design preview → creator confirms final design → price recommendation and editable price → earnings and maintenance-cost breakdown → publication review.</p></div>}
    {error && <p className="dn-pw-error" role="alert">{error}</p>}
    {previewOpen && <div className="dn-pw-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPreviewOpen(false); }}>
      <section className="dn-pw-modal" role="dialog" aria-modal="true" aria-labelledby="dn-pw-preview-title">
        <div className="dn-pw-modal-header"><div><span className="dn-pw-kicker">BRIEF PREVIEW</span><h3 id="dn-pw-preview-title">Review your product idea</h3><p>Make sure this describes what you want before sending it to DigiNanba.</p></div><button type="button" onClick={() => setPreviewOpen(false)} disabled={busy} aria-label="Close preview">×</button></div>
        <div className="dn-pw-preview-tags"><span>{selectedKindLabel}</span><span>Global marketplace intent</span></div>
        <h4>{idea.trim().split(/\n/)[0].slice(0, 160) || 'Untitled product idea'}</h4>
        <div className="dn-pw-description-preview">{idea.trim()}</div>
        <div className="dn-pw-stage-list">
          <div><span>1</span><p><strong>Product design</strong><small>Prepare and refine the design preview.</small></p></div>
          <div><span>2</span><p><strong>Creator finalization</strong><small>Confirm the product is ready before pricing.</small></p></div>
          <div><span>3</span><p><strong>Pricing &amp; earnings</strong><small>Recommend a price, allow creator edits, show the 50% DigiNanba share and maintenance-cost estimate.</small></p></div>
          <div><span>4</span><p><strong>Publication &amp; future improvements</strong><small>Review before publishing globally; allow later feature updates through a revision workflow.</small></p></div>
        </div>
        <p className="dn-pw-disclaimer">This submits your product brief for review. It does not mean a finished product has already been generated, priced, published, or guaranteed to earn money.</p>
        {error && <p className="dn-pw-error" role="alert">{error}</p>}
        <form onSubmit={submitRequest} className="dn-pw-modal-actions"><button type="button" className="dn-pw-back" onClick={() => setPreviewOpen(false)} disabled={busy}>← Edit description</button><button type="submit" className="dn-pw-start" disabled={busy}>{busy ? 'Submitting…' : 'Confirm & submit brief'}</button></form>
      </section>
    </div>}
  </section>;
}
