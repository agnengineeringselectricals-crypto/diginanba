'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Message = { role: 'user' | 'assistant'; content: string };

const quickQuestions = [
  'How do I buy a product?',
  'How do downloads work?',
  'I need help with my order',
  'How can I become a creator?',
];

const welcome = 'Hi! I’m the DigiNanba support assistant. I can help you explore products, understand checkout, find account pages, and learn about creator features. What can I help you with?';

export default function CustomerServiceChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: welcome }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showQuestions, setShowQuestions] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, open]);

  async function sendMessage(value: string) {
    const text = value.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-10).map(({ role, content }) => ({ role, content })) }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== 'string') throw new Error(data.error || 'The assistant is temporarily unavailable.');
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
    } catch {
      setError('I couldn’t send that message. Please try again or visit the account and order pages.');
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    setMessages([{ role: 'assistant', content: welcome }]);
    setInput('');
    setError('');
    setBusy(false);
    setShowQuestions(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="dn-support-widget">
      {open && (
        <section className="dn-support-panel" role="dialog" aria-label="DigiNanba customer support" aria-modal="false">
          <header className="dn-support-head">
            <div className="dn-support-avatar" aria-hidden="true">D</div>
            <div className="dn-support-head-copy">
              <strong>DigiNanba Support</strong>
              <span><i /> Marketplace help assistant</span>
            </div>
            <div className="dn-support-head-actions">
              <button type="button" className="dn-support-clear" onClick={clearChat} disabled={busy} aria-label="Clear chat and start a new conversation" title="Clear chat">Clear</button>
              <button type="button" className="dn-support-close" onClick={() => setOpen(false)} aria-label="Close support chat">×</button>
            </div>
          </header>
          <div className="dn-support-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div key={index} className={`dn-support-message dn-support-${message.role}`}>
                {message.content}
              </div>
            ))}
            {busy && <div className="dn-support-message dn-support-assistant dn-support-typing">Thinking…</div>}
            {error && <p className="dn-support-error" role="alert">{error}</p>}
            <div className="dn-support-question-tools">
              <button type="button" className="dn-support-question-toggle" onClick={() => setShowQuestions((value) => !value)} aria-expanded={showQuestions}>
                {showQuestions ? 'Hide suggested questions' : 'Suggested questions'} <span aria-hidden="true">{showQuestions ? '−' : '+'}</span>
              </button>
              {showQuestions && (
                <div className="dn-support-quick" aria-label="Predefined support questions">
                  {quickQuestions.map((question) => (
                    <button key={question} type="button" onClick={() => void sendMessage(question)} disabled={busy}>{question}</button>
                  ))}
                </div>
              )}
            </div>
            <div ref={endRef} />
          </div>
          <div className="dn-support-shortcuts">
            <Link href="/explore" onClick={() => setOpen(false)}>Explore products</Link>
            <Link href="/account/orders" onClick={() => setOpen(false)}>My orders</Link>
            <Link href="/account/library" onClick={() => setOpen(false)}>My library</Link>
          </div>
          <form className="dn-support-form" onSubmit={submit}>
            <label className="dn-support-sr-only" htmlFor="dn-support-input">Your message</label>
            <input id="dn-support-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask us anything…" maxLength={1000} disabled={busy} />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">➤</button>
          </form>
          <p className="dn-support-disclaimer">Please don’t send passwords or payment-card details. This assistant cannot access private order records.</p>
        </section>
      )}
      <button type="button" className="dn-support-launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'Close customer support chat' : 'Open customer support chat'}>
        <span aria-hidden="true">{open ? '×' : '☏'}</span>
        {!open && <span className="dn-support-launcher-label">Help</span>}
      </button>
      <style jsx global>{`
        .dn-support-widget{position:fixed;right:22px;bottom:22px;z-index:1000;font-family:Arial,Helvetica,sans-serif}
        .dn-support-launcher{display:flex;align-items:center;justify-content:center;gap:9px;margin-left:auto;width:auto;min-width:62px;height:58px;padding:0 18px;border:0;border-radius:999px;background:#5b46f6;color:#fff;box-shadow:0 8px 28px #25204b45;cursor:pointer;font-size:24px}
        .dn-support-launcher-label{font-size:15px;font-weight:700}
        .dn-support-panel{width:min(380px,calc(100vw - 28px));height:min(600px,calc(100dvh - 110px));display:flex;flex-direction:column;overflow:hidden;margin-bottom:12px;background:#fff;border:1px solid #e4e6ee;border-radius:20px;box-shadow:0 18px 60px #11182730;color:#171a24}
        .dn-support-head{display:flex;align-items:center;gap:11px;padding:16px;background:#171a32;color:white}
        .dn-support-avatar{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#7665ff;color:#fff;font-weight:800;font-size:20px}
        .dn-support-head-copy{display:flex;flex:1;flex-direction:column;gap:5px}.dn-support-head-copy strong{font-size:15px}.dn-support-head-copy span{font-size:11px;color:#e2e3ff}.dn-support-head-copy i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#62d9a5;margin-right:5px}
        .dn-support-head-actions{display:flex;align-items:center;gap:8px}.dn-support-clear{border:1px solid #7777a4;border-radius:8px;padding:6px 8px;background:transparent;color:#fff;font-size:11px;cursor:pointer}.dn-support-clear:disabled{opacity:.5;cursor:not-allowed}.dn-support-close{border:0;background:transparent;color:#fff;font-size:27px;cursor:pointer}
        .dn-support-messages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:16px;background:#f7f8fc}
        .dn-support-message{max-width:90%;padding:11px 13px;border-radius:15px;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
        .dn-support-assistant{align-self:flex-start;background:#fff;border:1px solid #e6e8f0;border-bottom-left-radius:5px}
        .dn-support-user{align-self:flex-end;background:#5b46f6;color:#fff;border-bottom-right-radius:5px}
        .dn-support-typing{color:#6b7280;font-style:italic}.dn-support-error{margin:0;color:#b42318;font-size:12px}
        .dn-support-question-tools{display:flex;flex-direction:column;align-items:flex-start;gap:8px}.dn-support-question-toggle{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #dcd9ff;border-radius:9px;background:#efedff;color:#4b3ad5;font-size:11px;font-weight:700;cursor:pointer}.dn-support-quick{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.dn-support-quick button{padding:8px 10px;border:1px solid #dcd9ff;border-radius:999px;background:#fff;color:#4b3ad5;font-size:12px;cursor:pointer;text-align:left}.dn-support-quick button:disabled{opacity:.5}
        .dn-support-shortcuts{display:flex;justify-content:space-around;gap:5px;padding:10px 8px;border-top:1px solid #eceef4}.dn-support-shortcuts a{font-size:11px;color:#5140cf;text-decoration:none}
        .dn-support-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #eceef4}.dn-support-form input{flex:1;min-width:0;border:1px solid #dfe2eb;border-radius:12px;padding:12px;font-size:13px;outline-color:#7c6af7}.dn-support-form button{width:42px;border:0;border-radius:12px;background:#5b46f6;color:#fff;font-size:19px;cursor:pointer}.dn-support-form button:disabled{opacity:.4;cursor:not-allowed}
        .dn-support-disclaimer{margin:0;padding:0 12px 10px;color:#777f8f;font-size:10px;line-height:1.4}.dn-support-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        @media(max-width:480px){.dn-support-widget{right:12px;bottom:12px}.dn-support-panel{width:calc(100vw - 24px);height:min(640px,calc(100dvh - 92px))}.dn-support-launcher{height:54px}.dn-support-shortcuts a{font-size:10px}}
      `}</style>
    </div>
  );
}
