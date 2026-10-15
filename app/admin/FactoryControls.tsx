'use client';

import { useCallback, useEffect, useState } from 'react';

type FactoryJob = {
  id: string;
  job_type: string;
  status: string;
  market_code?: string | null;
  locale?: string | null;
  attempt_count?: number;
  max_attempts?: number;
  last_error?: string | null;
  result_json?: unknown;
  created_at?: string;
};

const jobLabels: Record<string, string> = {
  demand_research: 'Demand research',
  product_draft: 'Product draft',
  localization: 'Localization',
  quality_review: 'Quality review',
};

export default function FactoryControls() {
  const [jobs, setJobs] = useState<FactoryJob[]>([]);
  const [jobType, setJobType] = useState('product_draft');
  const [marketCode, setMarketCode] = useState('IN');
  const [locale, setLocale] = useState('en-IN');
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [testChecks, setTestChecks] = useState({
    deliverableGenerated: false,
    openedInTargetApp: false,
    formulasAndImportChecked: false,
    visualAccessibilityChecked: false,
    localizationAndMarketChecked: false,
    sampleDataAndInstructionsChecked: false,
  });
  const [testNotes, setTestNotes] = useState('');

  const loadJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/internal/product-jobs?limit=50', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load factory jobs');
      setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load factory jobs');
    }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  async function createJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/internal/product-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType, marketCode, locale, input: { brief: brief.trim() }, maxAttempts: 3 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to queue job');
      setBrief('');
      setMessage('Job added to the queue. It will run when the configured worker processes queued jobs.');
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create job');
    } finally { setBusy(false); }
  }

  async function processNext() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/factory/process', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Factory worker could not process a job');
      setMessage(payload.processed ? 'One queued job was processed. Refresh the queue to see its current state.' : (payload.message || 'No queued jobs were available.'));
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process factory job');
    } finally { setBusy(false); }
  }

  async function changeJob(job: FactoryJob, status: 'queued' | 'cancelled' | 'ready') {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/internal/product-jobs/${job.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, details: { source: 'admin_factory_console' } }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to update job');
      setMessage(status === 'queued' ? 'Retry queued.' : status === 'ready' ? 'Draft approved for the next production stage. This does not publish a product.' : 'Queued job cancelled.');
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update job');
    } finally { setBusy(false); }
  }

  async function recordArtifactTests() {
    if (!selectedDraft) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/internal/product-jobs/${selectedDraft.id}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checks: testChecks, notes: testNotes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to record artifact test results');
      setMessage('Artifact test checklist recorded. The product remains unpublished and still requires explicit approval.');
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record artifact tests');
    } finally { setBusy(false); }
  }

  const selectedDraft = jobs.find(job => job.id === selectedDraftId);
  const draftResult = selectedDraft?.result_json;
  const draftObject: Record<string, any> | null = draftResult && typeof draftResult === 'object'
    ? draftResult as Record<string, any>
    : typeof draftResult === 'string' ? (() => { try { return JSON.parse(draftResult) as Record<string, any>; } catch { return null; } })() : null;
  const formattedDraft = draftResult == null ? '' : typeof draftResult === 'string' ? (() => { try { return JSON.stringify(JSON.parse(draftResult), null, 2); } catch { return draftResult; } })() : JSON.stringify(draftResult, null, 2);
  const reviewStatus = typeof draftObject?.qualityReviewStatus === 'string' ? draftObject.qualityReviewStatus : 'not_available';
  const artifactTestsPassed = draftObject?.actualArtifactTests?.status === 'passed';
  const aiReviewPassed = reviewStatus === 'ai_review_passed_artifact_tests_still_required';
  const canApproveDraft = aiReviewPassed && artifactTestsPassed;

  const panel: React.CSSProperties = { background: '#fff', border: '1px solid #e7e9f1', borderRadius: 18, padding: 20, marginBottom: 18 };
  const field: React.CSSProperties = { width: '100%', border: '1px solid #dfe3ed', borderRadius: 10, padding: '11px 12px', background: '#fff', color: '#182033', fontSize: 13 };
  const primary: React.CSSProperties = { border: 0, borderRadius: 10, padding: '11px 15px', background: '#5143d8', color: '#fff', fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .7 : 1 };

  return <div>
    <section style={panel}>
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Queue a factory job</h2>
      <p style={{ color: '#778095', fontSize: 13, lineHeight: 1.6, margin: '0 0 18px' }}>Create a demand-research, product-draft, localization or quality-review task. Jobs remain drafts for review; this form does not publish products.</p>
      <form onSubmit={createJob} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 750 }}>Job type
          <select style={field} value={jobType} onChange={e => setJobType(e.target.value)}>
            <option value="demand_research">Demand research</option><option value="product_draft">Product draft</option><option value="localization">Localization</option><option value="quality_review">Quality review</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 750 }}>Market
          <select style={field} value={marketCode} onChange={e => { const next = e.target.value; setMarketCode(next); setLocale(next === 'UK' ? 'en-GB' : next === 'IN' ? 'en-IN' : 'en-US'); }}>
            <option value="IN">India · INR (₹)</option><option value="US">United States · USD ($)</option><option value="UK">United Kingdom · GBP (£)</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 750 }}>Locale
          <input style={field} value={locale} onChange={e => setLocale(e.target.value)} minLength={2} maxLength={35} required />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 750, gridColumn: '1 / -1' }}>Brief / context
          <textarea style={{ ...field, minHeight: 92, resize: 'vertical' }} value={brief} onChange={e => setBrief(e.target.value)} placeholder="Describe the product opportunity, audience, localization request or review context." required minLength={5} maxLength={4000} />
        </label>
        <div style={{ gridColumn: '1 / -1' }}><button disabled={busy} style={primary} type="submit">{busy ? 'Working…' : 'Add job to queue'}</button></div>
      </form>
      {message && <p role="status" style={{ color: '#087f65', fontSize: 13, marginBottom: 0 }}>{message}</p>}
      {error && <p role="alert" style={{ color: '#a23a3a', fontSize: 13, marginBottom: 0 }}>{error}</p>}
    </section>
    <section style={{ ...panel, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 20, borderBottom: '1px solid #edf0f5' }}>
        <div><h2 style={{ margin: 0, fontSize: 18 }}>Factory job queue</h2><p style={{ margin: '5px 0 0', fontSize: 12, color: '#778095' }}>{jobs.length} recent jobs</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" disabled={busy} onClick={() => void processNext()} style={primary}>{busy ? 'Working…' : 'Process next job'}</button><button type="button" disabled={busy} onClick={() => void loadJobs()} style={{ ...primary, background: '#f0edff', color: '#5141d8' }}>Refresh</button></div>
      </div>
      {error && <p role="alert" style={{ padding: '0 20px', color: '#a23a3a', fontSize: 13 }}>{error}</p>}
      {jobs.length === 0 ? <p style={{ padding: 22, color: '#778095', fontSize: 13 }}>No factory jobs found yet. Create the first job above.</p> :
        <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760, fontSize: 12 }}>
          <thead><tr>{['Job','Status','Market / locale','Attempts','Last error','Actions'].map(label => <th key={label} style={{ textAlign: 'left', padding: '12px 14px', background: '#fafbfe', color: '#687187', fontSize: 10, letterSpacing: .5, borderBottom: '1px solid #edf0f5' }}>{label}</th>)}</tr></thead>
          <tbody>{jobs.map(job => <tr key={job.id}>
            <td style={{ padding: 14, borderBottom: '1px solid #f0f2f6', fontWeight: 750 }}>{jobLabels[job.job_type] || job.job_type}<div style={{ color: '#8991a3', fontWeight: 400, marginTop: 4 }}>{job.id.slice(0, 8)}</div></td>
            <td style={{ padding: 14, borderBottom: '1px solid #f0f2f6' }}><span style={{ display: 'inline-block', padding: '5px 8px', borderRadius: 999, background: job.status === 'failed' ? '#fff0f0' : job.status === 'ready' ? '#e8f8f0' : '#f0edff', color: job.status === 'failed' ? '#a23a3a' : job.status === 'ready' ? '#087f65' : '#5141d8', fontWeight: 800 }}>{job.status}</span></td>
            <td style={{ padding: 14, borderBottom: '1px solid #f0f2f6' }}>{job.market_code || '—'}<div style={{ color: '#8991a3', marginTop: 4 }}>{job.locale || '—'}</div></td>
            <td style={{ padding: 14, borderBottom: '1px solid #f0f2f6' }}>{job.attempt_count ?? 0} / {job.max_attempts ?? 3}</td>
            <td style={{ padding: 14, borderBottom: '1px solid #f0f2f6', color: job.last_error ? '#a23a3a' : '#8991a3', maxWidth: 220, overflowWrap: 'anywhere' }}>{job.last_error || '—'}</td>
            <td style={{ padding: 14, borderBottom: '1px solid #f0f2f6', whiteSpace: 'nowrap' }}>
              {job.status === 'failed' && Number(job.attempt_count || 0) < Number(job.max_attempts || 3) && <button disabled={busy} onClick={() => void changeJob(job, 'queued')} style={{ ...primary, padding: '8px 10px', marginRight: 6 }}>Retry</button>}
              {job.status === 'queued' && <button disabled={busy} onClick={() => void changeJob(job, 'cancelled')} style={{ ...primary, padding: '8px 10px', background: '#f5f6fa', color: '#5e6678' }}>Cancel</button>}
              {job.job_type === 'product_draft' && job.result_json != null && <button disabled={busy} onClick={() => setSelectedDraftId(selectedDraftId === job.id ? null : job.id)} style={{ ...primary, padding: '8px 10px', marginRight: 6, background: '#f0edff', color: '#5141d8' }}>{selectedDraftId === job.id ? 'Hide draft' : 'View draft'}</button>}{job.status === 'quality_review' && <span title="Approval is blocked until the independent AI review passes and actual deliverable tests are recorded." style={{ display: 'inline-block', fontSize: 11, color: '#7b5b11', background: '#fff7df', border: '1px solid #f1dfaa', borderRadius: 8, padding: '7px 9px', marginTop: 5 }}>Artifact tests required</span>}
            </td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    {selectedDraft && <section style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><h2 style={{ margin: '0 0 5px', fontSize: 18 }}>Product draft · {selectedDraft.id.slice(0, 8)}</h2><p style={{ margin: 0, color: '#778095', fontSize: 12 }}>Review the generated scaffold below. Offline drafts are templates, not finished products.</p></div>
        <button type="button" onClick={() => setSelectedDraftId(null)} style={{ ...primary, background: '#f0edff', color: '#5141d8' }}>Close draft</button>
      </div>
      {draftObject && <div style={{ marginTop: 16, border: '1px solid #e7e9f1', borderRadius: 12, padding: 14, background: '#fbfcff' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Release-readiness gates</h3>
        <p style={{ margin: '5px 0', fontSize: 12, color: '#4f596d' }}>AI review: <strong>{reviewStatus.replaceAll('_', ' ')}</strong></p>
        <p style={{ margin: '5px 0', fontSize: 12, color: '#4f596d' }}>Independent review passes recorded: <strong>{Array.isArray(draftObject.reviewHistory) ? draftObject.reviewHistory.length : (draftObject.reviewPasses || 0)}</strong></p>
        <p style={{ margin: '5px 0', fontSize: 12, color: '#4f596d' }}>Actual file/application tests: <strong>{draftObject.actualArtifactTests?.status || 'not recorded'}</strong></p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#8a5b12' }}>Publication is blocked until a real deliverable is generated, inspected and tested, all blocking issues are resolved, and you explicitly approve the final version. An AI text review alone is not a file test.</p>
        {selectedDraft.status === 'quality_review' && <div style={{ marginTop: 14, padding: 12, border: '1px solid #e7e9f1', borderRadius: 10, background: '#fff' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>Manual artifact test attestation</h4>
          <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.5, color: '#687187' }}>Only check an item after you have actually completed it on the real deliverable. This records a human attestation; it does not run these tests automatically.</p>
          {([
            ['deliverableGenerated', 'The real customer deliverable file has been generated and attached to the product draft.'],
            ['openedInTargetApp', 'I opened the actual file in its target application and inspected the layout.'],
            ['formulasAndImportChecked', 'I tested formulas and the supported statement-import/review workflow.'],
            ['visualAccessibilityChecked', 'I checked text/background contrast, headings, labels and readability.'],
            ['localizationAndMarketChecked', 'I checked the target market, currency, date formats, language and local assumptions.'],
            ['sampleDataAndInstructionsChecked', 'I checked buyer instructions and verified sample data is clearly fictional or removed.'],
          ] as const).map(([key, label]) => <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#293246', marginTop: 8 }}>
            <input type="checkbox" checked={testChecks[key]} onChange={e => setTestChecks(prev => ({ ...prev, [key]: e.target.checked }))} />
            <span>{label}</span>
          </label>)}
          <label style={{ display: 'grid', gap: 5, marginTop: 12, fontSize: 12, fontWeight: 750 }}>Test notes / evidence summary
            <textarea value={testNotes} onChange={e => setTestNotes(e.target.value)} maxLength={4000} placeholder="Record the actual file name/version, what was tested, the results, and any remaining limitations." style={{ ...field, minHeight: 76 }} />
          </label>
          <button type="button" disabled={busy || !Object.values(testChecks).every(Boolean) || testNotes.trim().length < 20} onClick={() => void recordArtifactTests()} style={{ ...primary, marginTop: 10, opacity: busy || !Object.values(testChecks).every(Boolean) || testNotes.trim().length < 20 ? .5 : 1 }}>Record completed artifact tests</button>
        </div>}
        {Array.isArray(draftObject.reviewHistory) && draftObject.reviewHistory.length > 0 && <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>Reviewer feedback history</h4>
          {draftObject.reviewHistory.map((entry: any, index: number) => <div key={index} style={{ padding: 10, marginTop: 6, borderRadius: 8, background: '#fff', border: '1px solid #edf0f5', fontSize: 12 }}>
            <strong>Pass {entry.pass || index + 1}: {String(entry.verdict || 'unknown')}</strong>
            {Array.isArray(entry.issues) && entry.issues.length > 0 && <ul style={{ margin: '6px 0', paddingLeft: 18 }}>{entry.issues.map((issue: unknown, i: number) => <li key={i}>{typeof issue === 'string' ? issue : JSON.stringify(issue)}</li>)}</ul>}
            {Array.isArray(entry.corrections) && entry.corrections.length > 0 && <p style={{ margin: '6px 0' }}><strong>Correction instructions:</strong> {entry.corrections.map((item: unknown) => typeof item === 'string' ? item : JSON.stringify(item)).join(' · ')}</p>}
          </div>)}
        </div>}
        {selectedDraft.status === 'quality_review' && <button type="button" disabled={!canApproveDraft || busy} onClick={() => { if (window.confirm('Approve this fully tested draft for the next production stage? This does not publish it.')) void changeJob(selectedDraft, 'ready'); }} style={{ ...primary, marginTop: 12, opacity: canApproveDraft && !busy ? 1 : .5 }}>{canApproveDraft ? 'Approve tested draft for next stage' : 'Approval blocked — tests incomplete'}</button>}
      </div>}
      {formattedDraft ? <pre style={{ marginTop: 16, padding: 16, borderRadius: 12, background: '#f7f8fc', border: '1px solid #e7e9f1', color: '#20283a', fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 560, overflow: 'auto' }}>{formattedDraft}</pre> : <p style={{ fontSize: 13, color: '#778095' }}>No draft result is saved on this job yet. Refresh the queue and check the status.</p>}
    </section>}
  </div>;
}
