'use client';

import { useState, type FormEvent } from 'react';
import './product-request-workspace.css';

type ProductKind = 'interactive_tool' | 'spreadsheet' | 'template' | 'ebook_guide' | 'software_app' | 'design_asset' | 'workflow' | 'not_sure';
const productKinds: { value: ProductKind; label: string }[] = [
  { value: 'interactive_tool', label: 'Interactive web tool or dashboard' },
  { value: 'spreadsheet', label: 'Excel / Google Sheets tool or tracker' },
  { value: 'template', label: 'Editable template or document' },
  { value: 'ebook_guide', label: 'Ebook, guide or learning resource' },
  { value: 'software_app', label: 'Software, app or automation' },
  { value: 'design_asset', label: 'Design asset or creative resource' },
  { value: 'workflow', label: 'Business or personal workflow' },
  { value: 'not_sure', label: 'Help me choose the right type' },
];

export default function ProductRequestWorkspace() {
  const [expanded, setExpanded] = useState(false);
  const [idea, setIdea] = useState('');
  const [kind, setKind] = useState<ProductKind>('interactive_tool');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestRef, setRequestRef] = useState('');

  const canPreview = idea.trim().length >= 5;
  const description = [
    'Product/tool description supplied by the requester:',
    idea.trim(),
    'Product type: ' + (productKinds.find((item) => item.value === kind)?.label ?? kind),
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
          productKind: kind,
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
            <select value={kind} onChange={(event) => setKind(event.target.value as ProductKind)}>
              {productKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
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
        <div className="dn-pw-preview-tags"><span>{productKinds.find((item) => item.value === kind)?.label ?? kind}</span><span>Global marketplace intent</span></div>
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
