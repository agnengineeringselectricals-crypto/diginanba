'use client';

import { useState, type FormEvent } from 'react';

type Props = { productId: string; locale?: string };

export default function ImprovementSuggestionForm({ productId, locale }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('feature');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      let visitorId = localStorage.getItem('diginanba-search-visitor');
      if (!visitorId) {
        visitorId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `visitor-${Date.now()}`;
        localStorage.setItem('diginanba-search-visitor', visitorId);
      }
      const response = await fetch('/api/products/improvements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, title, description, kind, locale, visitorId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit your suggestion.');
      setMessage('Thank you. Your improvement is submitted for review. Eligible rewards are considered after acceptance and verification under the published reward policy.');
      setTitle('');
      setDescription('');
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit your suggestion.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel" aria-labelledby="improve-product-heading" style={{ marginTop: 24 }}>
    <h2 id="improve-product-heading">Help improve this product — earn for accepted ideas</h2>
    <p className="muted">Suggest a useful feature, correction, accessibility improvement, or localization. DigiNanba reviews suggestions for originality, feasibility, and quality. Rewards are not guaranteed and are issued only under an active reward policy after verification.</p>
    {!open && <button className="ref-primary" type="button" onClick={() => setOpen(true)}>Suggest an improvement</button>}
    {open && <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
      <label>Improvement type
        <select value={kind} onChange={(event) => setKind(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 5, padding: 10 }}>
          <option value="feature">New feature</option><option value="bug">Bug or defect</option><option value="content_correction">Content correction</option><option value="accessibility">Accessibility</option><option value="localization">Localization</option><option value="translation">Translation</option><option value="performance">Performance</option><option value="other">Other</option>
        </select>
      </label>
      <label>Short title
        <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={5} maxLength={160} placeholder="What should be improved?" style={{ display: 'block', width: '100%', marginTop: 5, padding: 10 }} />
      </label>
      <label>Explain the improvement
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} required minLength={20} maxLength={5000} rows={4} placeholder="Describe the problem, suggested change, and how it would help users." style={{ display: 'block', width: '100%', marginTop: 5, padding: 10 }} />
      </label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="ref-primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'}</button><button type="button" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>}
    {message && <p role="status" style={{ marginTop: 12 }}>{message}</p>}
  </section>;
}
