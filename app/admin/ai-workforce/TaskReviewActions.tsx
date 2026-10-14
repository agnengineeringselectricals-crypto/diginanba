'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ReviewResult = {
  summary?: string;
  findings?: string[];
  recommendations?: string[];
  requires_human_approval?: boolean;
  confidence?: string;
};

export default function TaskReviewActions({
  taskId,
  status,
  resultJson,
  approvedBy,
  approvedAt,
}: {
  taskId: string | number;
  status: string;
  resultJson: ReviewResult | null;
  approvedBy: string | null;
  approvedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function review(decision: 'approve' | 'reject') {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/ai-workforce/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: String(taskId), decision }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Review could not be saved');
      setMessage(decision === 'approve' ? 'Report approved and recorded.' : 'Report rejected and recorded.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review could not be saved');
    } finally {
      setBusy(false);
    }
  }

  return <div style={{ marginTop: 12 }}>
    {resultJson && <div style={{ background: '#f8f9fc', border: '1px solid #eceef5', borderRadius: 10, padding: 12 }}>
      {resultJson.summary && <p style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}><strong>Summary:</strong> {resultJson.summary}</p>}
      {Array.isArray(resultJson.findings) && resultJson.findings.length > 0 && <div style={{ marginBottom: 10 }}><strong style={{ fontSize: 12 }}>Findings</strong><ul style={{ fontSize: 12, lineHeight: 1.6, margin: '5px 0 0', paddingLeft: 20 }}>{resultJson.findings.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {Array.isArray(resultJson.recommendations) && resultJson.recommendations.length > 0 && <div><strong style={{ fontSize: 12 }}>Recommended next steps</strong><ul style={{ fontSize: 12, lineHeight: 1.6, margin: '5px 0 0', paddingLeft: 20 }}>{resultJson.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {resultJson.confidence && <div style={{ fontSize: 11, color: '#778095', marginTop: 9 }}>AI confidence label: {resultJson.confidence}</div>}
    </div>}
    {status === 'needs_approval' && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <button type="button" disabled={busy} onClick={() => review('approve')} style={{ border: 0, borderRadius: 9, padding: '10px 13px', background: '#087f65', color: '#fff', fontWeight: 750, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .65 : 1 }}>{busy ? 'Saving…' : 'Approve report'}</button>
      <button type="button" disabled={busy} onClick={() => review('reject')} style={{ border: '1px solid #f0c7c7', borderRadius: 9, padding: '10px 13px', background: '#fff5f5', color: '#a12828', fontWeight: 750, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .65 : 1 }}>Reject report</button>
      <span style={{ alignSelf: 'center', fontSize: 11, color: '#778095' }}>This reviews the AI report only; it does not publish products or execute actions.</span>
    </div>}
    {approvedBy && <p style={{ fontSize: 11, color: '#778095', margin: '10px 0 0' }}>Review recorded {approvedAt ? `at ${new Date(approvedAt).toLocaleString('en-IN')}` : ''}. {approvedBy.startsWith('rejected:') ? 'Decision: rejected.' : 'Decision: approved.'}</p>}
    {message && <p role="status" style={{ fontSize: 12, color: '#087f65', marginBottom: 0 }}>{message}</p>}
    {error && <p role="alert" style={{ fontSize: 12, color: '#b42318', marginBottom: 0 }}>{error}</p>}
  </div>;
}
