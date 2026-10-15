import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client.js';

const POLL_MS = 4000;

function PaperclipIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.2-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadThreadMeta = useCallback(() => {
    api
      .get('storefront/support/thread/')
      .then((res) => setUnread(res.data.unread_count || 0))
      .catch(() => {});
  }, []);

  const loadMessages = useCallback((afterId = null) => {
    const params = afterId ? { params: { after_id: afterId } } : {};
    return api.get('storefront/support/messages/', params).then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      if (afterId) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const merged = [...prev];
          for (const m of list) {
            if (!ids.has(m.id)) merged.push(m);
          }
          return merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
      } else {
        setMessages(list);
      }
      return list;
    });
  }, []);

  const markRead = useCallback(() => {
    api
      .post('storefront/support/read/')
      .then(() => {
        setUnread(0);
        loadThreadMeta();
      })
      .catch(() => {});
  }, [loadThreadMeta]);

  const sendMessage = useCallback(() => {
    const t = text.trim();
    if ((!t && !file) || sending) return;
    setSending(true);
    setError(null);
    const fd = new FormData();
    if (t) fd.append('text', t);
    if (file) fd.append('attachment', file);
    api
      .post('storefront/support/messages/', fd)
      .then((res) => {
        setMessages((prev) => [...prev, res.data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
        setText('');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadThreadMeta();
        setTimeout(scrollToBottom, 80);
      })
      .catch((err) => {
        const d = err?.response?.data;
        let msg = 'Не удалось отправить.';
        if (typeof d === 'string') msg = d;
        else if (d && typeof d === 'object') {
          const flat = Object.values(d).flat().filter(Boolean);
          if (flat.length) msg = String(flat[0]);
        }
        setError(msg);
      })
      .finally(() => setSending(false));
  }, [text, file, sending, loadThreadMeta, scrollToBottom]);

  useEffect(() => {
    loadThreadMeta();
    const t = setInterval(loadThreadMeta, POLL_MS * 2);
    return () => clearInterval(t);
  }, [loadThreadMeta]);

  useEffect(() => {
    if (!open) return undefined;
    markRead();
    loadMessages(null).then(() => setTimeout(scrollToBottom, 80));
    const id = setInterval(() => {
      loadMessages(null).then((list) => {
        if (list.length) setTimeout(scrollToBottom, 50);
      });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [open, loadMessages, markRead, scrollToBottom]);

  useEffect(() => {
    if (open) setTimeout(scrollToBottom, 50);
  }, [messages, open, scrollToBottom]);

  const toggleFab = () => {
    setOpen((v) => !v);
    setError(null);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const onComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showBadge = !open && unread > 0;

  return (
    <div className="support-widget">
      {open ? (
        <>
          <div className="support-widget__backdrop" aria-hidden onClick={() => setOpen(false)} />
          <div className="support-widget__panel" role="dialog" aria-label="Чат поддержки" onClick={(e) => e.stopPropagation()}>
            <div className="support-widget__head">
              <span className="support-widget__title">Поддержка</span>
              <button type="button" className="support-widget__close" onClick={() => setOpen(false)} aria-label="Закрыть чат">
                ×
              </button>
            </div>
            <div className="support-widget__messages">
              {messages.length === 0 ? (
                <p className="support-widget__empty">Напишите нам — ответим в ближайшее время.</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`support-widget__msg ${m.from_support ? 'support-widget__msg--support' : 'support-widget__msg--user'}`}
                  >
                    <div className="support-widget__msg-meta">{m.from_support ? 'Поддержка' : 'Вы'}</div>
                    {m.text ? <div className="support-widget__msg-text">{m.text}</div> : null}
                    {m.attachment ? (
                      <a href={m.attachment} className="support-widget__attachment" target="_blank" rel="noopener noreferrer">
                        Вложение
                      </a>
                    ) : null}
                  </div>
                ))
              )}
              <div ref={listEndRef} />
            </div>
            {error ? <div className="support-widget__error">{error}</div> : null}
            {file ? <div className="support-widget__file-name">{file.name}</div> : null}
            <form className="support-widget__form" onSubmit={onSubmit}>
              <div className="support-widget__composer">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="support-widget__file-input"
                  accept="image/*,.pdf"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="support-widget__attach"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  aria-label="Прикрепить файл"
                  title="Прикрепить файл"
                >
                  <PaperclipIcon />
                </button>
                <textarea
                  className="support-widget__input support-widget__input--composer"
                  rows={2}
                  placeholder="Введите сообщение"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  disabled={sending}
                />
                <button type="submit" className="support-widget__send home-btn home-btn--primary" disabled={sending} aria-label="Отправить">
                  {sending ? '…' : '➤'}
                </button>
              </div>
            </form>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className="support-widget__fab"
        onClick={toggleFab}
        aria-label={open ? 'Закрыть чат' : 'Открыть чат поддержки'}
        aria-expanded={open}
      >
        {showBadge ? <span className="support-widget__badge">{unread > 99 ? '99+' : unread}</span> : null}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
        </svg>
      </button>
    </div>
  );
}
