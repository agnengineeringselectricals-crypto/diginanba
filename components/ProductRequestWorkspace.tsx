'use client';

import { useMemo, useState, type FormEvent } from 'react';
import './product-request-workspace.css';

type RequesterRole = 'buyer' | 'creator' | 'both';
type ProductKind = 'interactive_tool' | 'spreadsheet' | 'template' | 'ebook_guide' | 'software_app' | 'design_asset' | 'workflow' | 'not_sure';
type Market = 'IN' | 'US' | 'UK';

const productKinds: { value: ProductKind; label: string }[] = [
  { value: 'interactive_tool', label: 'Interactive web tool or dashboard' },
  { value: 'spreadsheet', label: 'Excel / Google Sheets calculator or tracker' },
  { value: 'template', label: 'Editable template or document' },
  { value: 'ebook_guide', label: 'Ebook, guide or learning resource' },
  { value: 'software_app', label: 'Software, app or automation' },
  { value: 'design_asset', label: 'Design asset or creative resource' },
  { value: 'workflow', label: 'Business, team or household workflow' },
  { value: 'not_sure', label: 'Help me decide' },
];

export default function ProductRequestWorkspace() {
  const [expanded, setExpanded] = useState(false);
  const [role, setRole] = useState<RequesterRole>('buyer');
  const [idea, setIdea] = useState('');
  const [kind, setKind] = useState<ProductKind>('interactive_tool');
  const [audience, setAudience] = useState('');
  const [problem, setProblem] = useState('');
  const [features, setFeatures] = useState('');
  const [format, setFormat] = useState('interactive_tool');
  const [market, setMarket] = useState<Market>('IN');
  const [locale, setLocale] = useState('en-IN');
  const [intent, setIntent] = useState('use_and_publish');
  const [price, setPrice] = useState('help_recommend');
  const [budget, setBudget] = useState('not_sure');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isCreator = role === 'creator' || role === 'both';
  const canPreview = idea.trim().length >= 5 && audience.trim().length >= 3 && problem.trim().length >= 10;
  const description = useMemo(() => [
    'Who is requesting: ' + (role === 'buyer' ? 'Someone who needs a tool' : role === 'creator' ? 'Creator who wants to publish and earn' : 'Both tool user and creator'),
    'Idea: ' + idea.trim(),
    'Product type: ' + (productKinds.find((item) => item.value === kind)?.label ?? kind),
    'Intended audience: ' + audience.trim(),
    'Problem or outcome: ' + problem.trim(),
    'Desired features: ' + (features.trim() || 'Please recommend suitable features'),
    'Intended use: ' + intent.replaceAll('_', ' '),
    'Preferred format: ' + format.replaceAll('_', ' '),
    'Target market: ' + market + ' / ' + locale,
    'Pricing preference: ' + price.replaceAll('_', ' '),
  ].join('\n\n'), [role, idea, kind, audience, problem, features, intent, format, market, locale, price]);

  function changeMarket(value: Market) {
    setMarket(value);
    if (value === 'IN') setLocale('en-IN');
    if (value === 'US') setLocale('en-US');
    if (value === 'UK') setLocale('en-GB');
  }

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
      const title = idea.trim().slice(0, 160);
      const response = await fetch('/api/products/customizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.length >= 5 ? title : 'Digital product request',
          description,
          kind: role === 'creator' ? 'new_product' : role === 'both' ? 'workflow' : 'new_product',
          market,
          locale,
          preferredFormat: format,
          budgetRange: budget,
          visitorId,
          requesterRole: role,
          intendedUse: intent,
          targetAudience: audience.trim(),
          keyFeatures: features.split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 20),
          priceExpectation: price,
          productKind: kind,
          requestSource: 'homepage_product_workspace',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not submit your product brief.');
      const requestId = data.request?.id ? String(data.request.id).slice(0, 8).toUpperCase() : '';
      setSuccess('Your brief has been submitted for DigiNanba review' + (requestId ? ' · Reference ' + requestId : '') + '. This is a request, not a promise of publication, earnings, price or delivery date.');
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
        <span className="dn-pw-kicker">YOUR IDEA → A PRODUCT BRIEF</span>
        <h2 id="dn-product-workspace-title">Tell DigiNanba what you want to build.</h2>
        <p>Need a tool—or want to create something useful and publish it to earn? A guided conversation helps shape the idea, then you review the brief before sending it.</p>
      </div>
      <div className="dn-pw-orbit" aria-hidden="true"><span>✦</span><i>✧</i><b>↗</b></div>
    </div>
    <div className="dn-pw-launch">
      <div className="dn-pw-launch-copy">
        <span className="dn-pw-status"><span /> GUIDED PRODUCT BUILDER</span>
        <h3>Start with your idea. We’ll help shape the requirements.</h3>
        <p>Describe the problem, who it helps, what it should do, and whether you want to use it, publish it, or both.</p>
        <div className="dn-pw-benefits"><span>✓ Guided questions</span><span>✓ Preview before submit</span><span>✓ Your brief, your decision</span></div>
      </div>
      <button type="button" className="dn-pw-start" onClick={() => { setExpanded((value) => !value); setSuccess(''); setError(''); }} aria-expanded={expanded}>
        {expanded ? 'Close builder ↑' : 'Start building →'}
      </button>
    </div>
    {expanded && <div className="dn-pw-builder">
      <div className="dn-pw-assistant">
        <div className="dn-pw-assistant-avatar">DN</div>
        <div><strong>DigiNanba Product Guide</strong><p>Let’s make your idea specific enough to review. You can change anything before you submit. I’ll help structure your brief; the final request is reviewed before any product is promised or published.</p></div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); if (canPreview) setPreviewOpen(true); }}>
        <div className="dn-pw-step-label"><span>01</span><div><strong>What are you here to do?</strong><small>Choose the path that best fits you.</small></div></div>
        <div className="dn-pw-role-grid">
          <button type="button" className={role === 'buyer' ? 'selected' : ''} onClick={() => setRole('buyer')}><span>🧭</span><strong>I need a tool</strong><small>Help me solve a problem or improve a task.</small></button>
          <button type="button" className={role === 'creator' ? 'selected' : ''} onClick={() => setRole('creator')}><span>✨</span><strong>I want to create & earn</strong><small>Shape an idea into a product I can propose for publishing.</small></button>
          <button type="button" className={role === 'both' ? 'selected' : ''} onClick={() => setRole('both')}><span>🔁</span><strong>Both</strong><small>I need it and may publish my own version.</small></button>
        </div>

        <div className="dn-pw-step-label"><span>02</span><div><strong>Describe your idea</strong><small>Plain language is fine. No technical knowledge required.</small></div></div>
        <div className="dn-pw-fields">
          <label>What product or tool do you have in mind?
            <input required minLength={5} maxLength={160} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="e.g. Tamil small-business income and expense dashboard" />
          </label>
          <label>What kind of product is it?
            <select value={kind} onChange={(event) => { setKind(event.target.value as ProductKind); if (event.target.value === 'spreadsheet') setFormat('editable_file'); if (event.target.value === 'interactive_tool' || event.target.value === 'software_app') setFormat('interactive_tool'); }}>
              {productKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>Who will use it?
            <input required minLength={3} maxLength={300} value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="e.g. shop owners, students, freelancers, families" />
          </label>
          <label className="dn-pw-field-full">What problem should it solve or result should it deliver?
            <textarea required minLength={10} maxLength={2000} rows={3} value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="Tell us what the user struggles with and what a successful result looks like." />
          </label>
          <label className="dn-pw-field-full">What should it do? (one feature per line, if possible)
            <textarea maxLength={2000} rows={3} value={features} onChange={(event) => setFeatures(event.target.value)} placeholder={'e.g.\nShow monthly totals and charts\nWork on mobile\nExport a report'} />
          </label>
        </div>

        <div className="dn-pw-step-label"><span>03</span><div><strong>Shape the product and market</strong><small>These choices help DigiNanba understand the right format and audience.</small></div></div>
        <div className="dn-pw-fields">
          <label>How do you want to use it?
            <select value={intent} onChange={(event) => setIntent(event.target.value)}>
              <option value="personal_or_business_use">Use it myself / my organization</option>
              <option value="publish_and_earn">Publish it on DigiNanba and earn</option>
              <option value="use_and_publish">Use it and possibly publish a version</option>
              <option value="research_demand_first">Research demand before deciding</option>
            </select>
          </label>
          <label>Preferred format
            <select value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="interactive_tool">Interactive website or app</option>
              <option value="editable_file">Editable spreadsheet / document</option>
              <option value="localized_version">Localized language / market edition</option>
              <option value="team_workflow">Team workflow or automation</option>
              <option value="not_sure">Help me choose</option>
            </select>
          </label>
          <label>Target market
            <select value={market} onChange={(event) => changeMarket(event.target.value as Market)}>
              <option value="IN">India</option><option value="US">United States</option><option value="UK">United Kingdom</option>
            </select>
          </label>
          <label>Product language
            <select value={locale} onChange={(event) => setLocale(event.target.value)}>
              {market === 'IN' ? <><option value="en-IN">English (India)</option><option value="ta-IN">தமிழ் (Tamil)</option><option value="hi-IN">हिन्दी (Hindi)</option><option value="te-IN">తెలుగు (Telugu)</option><option value="bn-IN">বাংলা (Bengali)</option><option value="mr-IN">मराठी (Marathi)</option><option value="kn-IN">ಕನ್ನಡ (Kannada)</option><option value="ml-IN">മലയാളം (Malayalam)</option></> : market === 'UK' ? <><option value="en-GB">English (UK)</option><option value="cy-GB">Welsh</option><option value="pl-GB">Polish (UK)</option></> : <><option value="en-US">English (US)</option><option value="es-US">Español (US)</option></>}
            </select>
          </label>
          {isCreator && <label>Pricing approach
            <select value={price} onChange={(event) => setPrice(event.target.value)}>
              <option value="help_recommend">Help me recommend a price</option><option value="free_lead_magnet">Free product / audience builder</option><option value="low_cost">Affordable / entry-level price</option><option value="premium">Premium product</option><option value="custom_quote">Custom quote or licensing</option>
            </select>
          </label>}
          <label>Budget / investment preference
            <select value={budget} onChange={(event) => setBudget(event.target.value)}>
              <option value="not_sure">Not sure yet—discuss options</option><option value="free_or_low_cost">Free or low-cost approach</option><option value="under_1000_inr">Under ₹1,000 equivalent</option><option value="1000_5000_inr">₹1,000–₹5,000 equivalent</option><option value="custom_quote">Request a quote</option>
            </select>
          </label>
        </div>
        {isCreator && <div className="dn-pw-creator-note"><strong>Creator path enabled</strong><p>Your brief will state that you want to explore publishing and earning. It does not automatically publish a product, set a guaranteed income, or grant rights to DigiNanba. Creator terms, quality review, pricing and publication approval still apply.</p></div>}
        <div className="dn-pw-form-footer"><p>Next, review a summary of your choices. Nothing is submitted until you confirm in the preview.</p><button type="submit" className="dn-pw-start" disabled={!canPreview}>Preview &amp; finalize →</button></div>
      </form>
    </div>}
    {success && <div className="dn-pw-success" role="status"><strong>✓ Request received</strong><p>{success}</p></div>}
    {error && <p className="dn-pw-error" role="alert">{error}</p>}
    {previewOpen && <div className="dn-pw-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPreviewOpen(false); }}>
      <section className="dn-pw-modal" role="dialog" aria-modal="true" aria-labelledby="dn-pw-preview-title">
        <div className="dn-pw-modal-header"><div><span className="dn-pw-kicker">FINAL REVIEW</span><h3 id="dn-pw-preview-title">Review your product brief</h3><p>Check the summary below. Go back to edit it, or submit it for review.</p></div><button type="button" onClick={() => setPreviewOpen(false)} disabled={busy} aria-label="Close preview">×</button></div>
        <div className="dn-pw-preview-tags"><span>{role === 'buyer' ? 'Tool request' : role === 'creator' ? 'Creator · publish & earn' : 'User + creator'}</span><span>{market}</span><span>{locale}</span></div>
        <h4>{idea || 'Untitled product idea'}</h4>
        <dl className="dn-pw-preview-list">
          <div><dt>Product type</dt><dd>{productKinds.find((item) => item.value === kind)?.label ?? kind}</dd></div>
          <div><dt>Who it helps</dt><dd>{audience || 'Not specified'}</dd></div>
          <div><dt>Problem / desired result</dt><dd>{problem || 'Not specified'}</dd></div>
          <div><dt>Requested features</dt><dd>{features.trim() || 'Ask DigiNanba to recommend suitable features'}</dd></div>
          <div><dt>Intended use</dt><dd>{intent.replaceAll('_', ' ')}</dd></div>
          <div><dt>Format</dt><dd>{format.replaceAll('_', ' ')}</dd></div>
          {isCreator && <div><dt>Pricing approach</dt><dd>{price.replaceAll('_', ' ')}</dd></div>}
          <div><dt>Budget preference</dt><dd>{budget.replaceAll('_', ' ')}</dd></div>
        </dl>
        <p className="dn-pw-disclaimer">Submitting asks DigiNanba to review the brief. It is not an order, contract, automatic AI-generated deliverable, guaranteed publication, or promise of earnings or delivery date.</p>
        {error && <p className="dn-pw-error" role="alert">{error}</p>}
        <form onSubmit={submitRequest} className="dn-pw-modal-actions"><button type="button" className="dn-pw-back" onClick={() => setPreviewOpen(false)} disabled={busy}>← Edit brief</button><button type="submit" className="dn-pw-start" disabled={busy}>{busy ? 'Submitting…' : 'Confirm & submit brief'}</button></form>
      </section>
    </div>}
  </section>;
}
