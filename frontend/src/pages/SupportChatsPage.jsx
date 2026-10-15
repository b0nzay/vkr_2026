import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client.js';

function normalizeError(err, fallback) {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (typeof d.detail === 'string') return d.detail;
  const flat = Object.values(d).flat().filter(Boolean);
  if (flat.length) return String(flat[0]);
  return fallback;
}

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

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function SupportChatsPage() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalId, setModalId] = useState(null);
  const [modalTitle, setModalTitle] = useState('');
  const [messages, setMessages] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState(null);
  const listEndRef = useRef(null);
  const fileRef = useRef(null);

  const loadThreads = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get('support/threads/')
      .then((res) => setThreads(Array.isArray(res.data) ? res.data : []))
      .catch((e) => setError(normalizeError(e, 'Не удалось загрузить чаты')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadThreads();
    const id = setInterval(loadThreads, 8000);
    return () => clearInterval(id);
  }, [loadThreads]);

  const openModal = async (row) => {
    setModalId(row.id);
    setModalTitle(row.display_title || `Чат #${row.id}`);
    setModalLoading(true);
    setFormError(null);
    setText('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    try {
      const [msgRes] = await Promise.all([
        api.get(`support/threads/${row.id}/messages/`),
        api.post(`support/threads/${row.id}/read/`),
      ]);
      setMessages(Array.isArray(msgRes.data) ? msgRes.data : []);
      loadThreads();
    } catch (e) {
      setFormError(normalizeError(e, 'Не удалось открыть чат'));
      setMessages([]);
    } finally {
      setModalLoading(false);
    }
    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const closeModal = () => {
    setModalId(null);
    setMessages([]);
    setModalTitle('');
    setFormError(null);
  };

  const doSendReply = () => {
    if (!modalId || sending || modalLoading) return;
    const t = text.trim();
    if (!t && !file) {
      setFormError('Введите текст или прикрепите файл.');
      return;
    }
    setSending(true);
    setFormError(null);
    const fd = new FormData();
    if (t) fd.append('text', t);
    if (file) fd.append('attachment', file);
    api
      .post(`support/threads/${modalId}/messages/`, fd)
      .then((res) => {
        setMessages((prev) => [...prev, res.data]);
        setText('');
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
        loadThreads();
        setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      })
      .catch((err) => setFormError(normalizeError(err, 'Не удалось отправить')))
      .finally(() => setSending(false));
  };

  const sendReply = (e) => {
    e.preventDefault();
    doSendReply();
  };

  const onComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSendReply();
    }
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <h2 className="dashboard-card__title">Чаты с клиентами</h2>
      </div>
      <div className="dashboard-card__body">
        {error ? <div className="dashboard-alert">{error}</div> : null}
        {loading && threads.length === 0 ? <p>Загрузка…</p> : null}
        {!loading && threads.length === 0 && !error ? <p>Пока нет сообщений от клиентов.</p> : null}
        {threads.length > 0 ? (
          <ul className="support-dash-list">
            {threads.map((row) => (
              <li key={row.id}>
                <button type="button" className="support-dash-list__row" onClick={() => openModal(row)}>
                  <div className="support-dash-list__main">
                    <div className="support-dash-list__title">{row.display_title}</div>
                    <div className="support-dash-list__preview">{row.last_message_preview || '—'}</div>
                    <div className="support-dash-list__time">{formatWhen(row.last_message_at)}</div>
                  </div>
                  {row.unread_count > 0 ? (
                    <span className="support-dash-list__badge">{row.unread_count > 99 ? '99+' : row.unread_count}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {modalId ? (
        <div className="dashboard-modal" role="dialog" aria-labelledby="support-modal-title">
          <div className="dashboard-modal__backdrop" onClick={sending ? undefined : closeModal} role="presentation" />
          <div className="dashboard-modal__content dashboard-modal__content--wide support-dash-modal">
            <div className="support-dash-modal__toolbar">
              <h3 id="support-modal-title" className="support-dash-modal__h">
                {modalTitle}
              </h3>
              <button type="button" className="support-dash-modal__x" onClick={closeModal} disabled={sending} aria-label="Закрыть">
                ×
              </button>
            </div>
            <div className="support-dash-modal__messages">
              {modalLoading ? (
                <p>Загрузка…</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`support-dash-modal__msg ${m.sender_role === 'STAFF' ? 'support-dash-modal__msg--staff' : 'support-dash-modal__msg--client'}`}
                  >
                    <div className="support-dash-modal__msg-head">
                      {m.sender_role === 'STAFF' ? (
                        <span>{m.staff_author_name || 'Сотрудник'}</span>
                      ) : (
                        <span>Клиент</span>
                      )}
                      <span className="support-dash-modal__msg-time">{formatWhen(m.created_at)}</span>
                    </div>
                    {m.text ? <div className="support-dash-modal__msg-body">{m.text}</div> : null}
                    {m.attachment ? (
                      <a href={m.attachment} target="_blank" rel="noopener noreferrer" className="support-dash-modal__link">
                        Вложение
                      </a>
                    ) : null}
                  </div>
                ))
              )}
              <div ref={listEndRef} />
            </div>
            {formError ? <div className="dashboard-alert support-dash-modal__alert">{formError}</div> : null}
            {file ? <div className="support-dash-modal__picked">{file.name}</div> : null}
            <form className="support-dash-modal__form" onSubmit={sendReply}>
              <div className="support-dash-modal__composer">
                <input
                  ref={fileRef}
                  id="support-dash-file"
                  className="support-dash-modal__file-input"
                  type="file"
                  accept="image/*,.pdf"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={sending || modalLoading}
                />
                <button
                  type="button"
                  className="support-dash-modal__attach"
                  onClick={() => fileRef.current?.click()}
                  disabled={sending || modalLoading}
                  aria-label="Прикрепить файл"
                  title="Прикрепить файл"
                >
                  <PaperclipIcon />
                </button>
                <textarea
                  className="dash-modal-control support-dash-modal__textarea"
                  rows={3}
                  placeholder="Ответ… (Enter — отправить, Shift+Enter — новая строка)"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  disabled={sending || modalLoading}
                />
                <button type="submit" className="btn btn--primary support-dash-modal__submit" disabled={sending || modalLoading}>
                  {sending ? '…' : 'Отправить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
