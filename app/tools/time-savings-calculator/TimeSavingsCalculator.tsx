'use client';
import { useMemo, useState } from 'react';

export default function TimeSavingsCalculator() {
  const [minutes, setMinutes] = useState('30');
  const [days, setDays] = useState('20');
  const saved = useMemo(() => Math.max(0, Number(minutes || 0)) * Math.max(0, Number(days || 0)) / 60, [minutes, days]);
  return <div className="panel">
    <h2>Free time-savings calculator</h2>
    <p className="muted">Estimate how many hours a month a reusable digital workflow could save.</p>
    <div className="auth-form">
      <label>Minutes saved per day<input type="number" min="0" value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
      <label>Working days per month<input type="number" min="0" value={days} onChange={e => setDays(e.target.value)} /></label>
    </div>
    <div className="panel" style={{marginTop:16}}><span className="muted">Estimated hours saved per month</span><h2>{saved.toFixed(1)} hours</h2></div>
  </div>;
}