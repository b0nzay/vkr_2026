import React, { useCallback, useEffect, useId, useState } from 'react';
import api from '../api/client.js';

function normalizeError(err, fallback) {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (typeof d.detail === 'string') return d.detail;
  return fallback;
}

export default function FaqsPage() {
  const faqQuestionFieldId = useId();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get('faq-items/')
      .then((res) => setItems(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch((e) => setError(normalizeError(e, 'Не удалось загрузить FAQ')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setModal({ id: null, question: '', answer: '', is_active: true });
  };

  const openEdit = (row) => {
    setModal({
      id: row.id,
      question: row.question || '',
      answer: row.answer || '',
      is_active: Boolean(row.is_active),
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        question: modal.question.trim(),
        answer: modal.answer,
        is_active: modal.is_active,
      };
      if (modal.id) await api.patch(`faq-items/${modal.id}/`, body);
      else await api.post('faq-items/', body);
      setModal(null);
      load();
    } catch (err) {
      setError(normalizeError(err, 'Ошибка сохранения'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Удалить вопрос?')) return;
    try {
      await api.delete(`faq-items/${id}/`);
      load();
    } catch (err) {
      setError(normalizeError(err, 'Не удалось удалить'));
    }
  };

  if (loading && !items.length) return <p>Загрузка…</p>;

  return (
    <div className="dash-page">
      <div className="page-header">
        <h1>FAQ</h1>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Новый вопрос
        </button>
      </div>
      {error ? <div className="dashboard-alert">{error}</div> : null}

      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Вопрос</th>
              <th>Активен</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.question}</td>
                <td>{r.is_active ? 'да' : 'нет'}</td>
                <td>
                  <div className="dashboard-actions">
                    <button type="button" className="btn btn--small" onClick={() => openEdit(r)}>
                      Изменить
                    </button>
                    <button type="button" className="btn btn--small btn--muted" onClick={() => remove(r.id)}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal ? (
        <div className="dashboard-modal" role="dialog">
          <div className="dashboard-modal__backdrop" onClick={saving ? undefined : () => setModal(null)} role="presentation" />
          <div className="dashboard-modal__content dashboard-modal__content--wide">
            <h2>{modal.id ? 'Редактирование FAQ' : 'Новый вопрос'}</h2>
            <form onSubmit={save} className="dash-form">
              <label className="form-group" htmlFor={faqQuestionFieldId}>
                <span>Вопрос</span>
                <textarea
                  id={faqQuestionFieldId}
                  className="dash-modal-control dash-modal-control--question"
                  rows={5}
                  value={modal.question}
                  onChange={(e) => setModal({ ...modal, question: e.target.value })}
                  required
                />
              </label>
              <label className="form-group">
                <span>Ответ</span>
                <textarea
                  className="dash-modal-control"
                  rows={8}
                  value={modal.answer}
                  onChange={(e) => setModal({ ...modal, answer: e.target.value })}
                  required
                />
              </label>
              <label className="form-group form-group--inline">
                <input
                  type="checkbox"
                  checked={modal.is_active}
                  onChange={(e) => setModal({ ...modal, is_active: e.target.checked })}
                />
                <span>Показывать на сайте</span>
              </label>
              <div className="dash-form__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  Сохранить
                </button>
                <button type="button" className="btn btn--muted" disabled={saving} onClick={() => setModal(null)}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
