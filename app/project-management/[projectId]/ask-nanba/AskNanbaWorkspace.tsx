'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };
const starters = [
  'Which tasks are blocked or at risk, and why?',
  'Compare planned targets with recorded actual progress.',
  'What approvals or follow-ups are pending?',
  'What should the project manager prioritize next?',
];

export default function AskNanbaWorkspace({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello, I’m Nanba. I can analyze this project’s recorded tasks, WBS, dependencies, progress, milestones, approvals and operational records within your access permissions. I’m read-only: I can recommend actions, but I cannot change project records or approve work.' },
  ]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function ask(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (value.length < 3 || sending) return;
    setMessages(current => [...current, { role: 'user', content: value }]);
    setQuestion('');
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/project-management/' + projectId + '/ask-nanba', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nanba could not answer this question.');
      setMessages(current => [...current, { role: 'assistant', content: data.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nanba could not answer this question.');
    } finally {
      setSending(false);
    }
  }

  return <main className="nanba-shell">
    <header className="nanba-head">
      <div><Link href={'/project-management/' + projectId} className="back">← Back to project</Link><div className="brand">DigiNanba <span>Projects</span></div></div>
      <Link href={'/project-management/' + projectId + '/operations'} className="operations">Operational modules →</Link>
    </header>
    <section className="hero">
      <div className="eyebrow">PROJECT WORKFLOW INTELLIGENCE</div>
      <h1>Ask AI Nanba</h1>
      <p>{projectName}</p>
      <div className="scope">Nanba reads only records you are permitted to access. It does not update tasks, approve requests, or send instructions.</div>
    </section>
    <section className="chat" aria-label="Ask AI Nanba conversation">
      <div className="messages" aria-live="polite">
        {messages.map((message, index) => <article key={index} className={'message ' + message.role}>
          <div className="speaker">{message.role === 'assistant' ? 'Nanba' : 'You'}</div>
          <div className="bubble">{message.content}</div>
        </article>)}
        {sending && <article className="message assistant"><div className="speaker">Nanba</div><div className="bubble">Reviewing the project records…</div></article>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="starters">{starters.map(item => <button type="button" key={item} disabled={sending} onClick={() => setQuestion(item)}>{item}</button>)}</div>
      <form onSubmit={ask}>
        <textarea value={question} onChange={event => setQuestion(event.target.value)} maxLength={1200} rows={3} placeholder="Ask about project progress, risks, dependencies, approvals, resources or next steps…" />
        <div className="composer-foot"><span>{question.length}/1200 · Read-only project analysis</span><button disabled={sending || question.trim().length < 3}>{sending ? 'Thinking…' : 'Ask Nanba'}</button></div>
      </form>
    </section>
    <p className="foot">Answers are generated from current DigiNanba records. Missing or unrecorded information is identified rather than guessed.</p>
    <style jsx>{`
      .nanba-shell{max-width:1000px;margin:auto;padding:24px 5% 56px;color:#182235;min-height:100vh;background:#f8f9fc}
      .nanba-head{display:flex;justify-content:space-between;align-items:center;padding-bottom:18px;border-bottom:1px solid #e5e8ef}
      .back,.operations{font-size:12px;color:#5b4be0;text-decoration:none;font-weight:750}
      .brand{font-weight:900;font-size:20px;margin-top:7px}.brand span{color:#5b4be0}
      .hero{padding:32px 0 20px}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:850;color:#5b4be0}
      h1{font-size:34px;margin:8px 0}.hero p{color:#64718a;margin:0 0 14px}
      .scope{padding:12px 15px;border:1px solid #dcd9ff;border-radius:10px;background:#f1f0ff;color:#5145bb;font-size:12px}
      .chat{border:1px solid #e5e8ef;background:white;border-radius:18px;padding:18px;box-shadow:0 8px 30px rgba(30,40,70,.04)}
      .messages{display:grid;gap:14px;min-height:240px;max-height:55vh;overflow:auto;padding:4px}
      .message{max-width:88%;display:grid;gap:5px}.message.user{justify-self:end}.speaker{font-size:10px;font-weight:850;color:#758096}
      .bubble{white-space:pre-wrap;line-height:1.55;font-size:13px;padding:12px 14px;border-radius:13px;background:#f3f5f9;color:#263247}
      .user .bubble{background:#eeedff;color:#3f36a4}.starters{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
      .starters button{border:1px solid #e0e3ec;background:white;border-radius:99px;padding:8px 11px;font-size:11px;color:#59657a;cursor:pointer}
      form{border:1px solid #dfe3ec;border-radius:12px;padding:10px}
      textarea{display:block;width:100%;resize:vertical;border:0;outline:0;padding:8px;font:inherit;font-size:13px;min-height:70px;color:#182235}
      .composer-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 5px 2px;color:#8791a2;font-size:10px}
      .composer-foot button{border:0;border-radius:8px;background:#5b46f6;color:white;font-weight:850;padding:10px 16px;cursor:pointer}
      button:disabled{opacity:.5;cursor:not-allowed}.error{color:#b42342;font-size:12px;padding:10px;background:#fff0f2;border-radius:8px}
      .foot{text-align:center;color:#929bad;font-size:11px;padding-top:18px}
      @media(max-width:600px){.nanba-shell{padding:18px 4% 38px}.hero{padding-top:24px}h1{font-size:28px}.chat{padding:12px}.message{max-width:96%}.composer-foot{align-items:flex-start;flex-direction:column}.operations{padding-top:8px}}
    `}</style>
  </main>;
}
