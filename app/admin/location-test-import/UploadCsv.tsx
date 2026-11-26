'use client';

import { useState } from 'react';

export default function UploadCsv() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; imported?: number; error?: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/admin/location-test-import', { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Import failed.');
      setResult({ ok: true, imported: payload.imported });
      setFile(null);
      event.currentTarget.reset();
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Import failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <label htmlFor="tn-csv" className="block text-sm font-semibold text-gray-900">Tamil Nadu official village CSV</label>
        <p className="mt-1 text-sm text-gray-600">Select tamilnadu_official_search_test.csv (17,379 records; maximum 8 MB).</p>
      </div>
      <input id="tn-csv" type="file" accept=".csv,text/csv" required disabled={busy}
        onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); }}
        className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:font-medium" />
      <button type="submit" disabled={!file || busy}
        className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? 'Importing and verifying…' : 'Import Tamil Nadu test data'}
      </button>
      {result?.ok && <p role="status" className="text-sm font-medium text-green-700">Successfully imported and verified {result.imported?.toLocaleString('en-IN')} records into the isolated staging table.</p>}
      {result?.error && <p role="alert" className="text-sm font-medium text-red-700">{result.error}</p>}
    </form>
  );
}
