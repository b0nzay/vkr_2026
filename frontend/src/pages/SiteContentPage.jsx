import React, { useCallback, useEffect, useState } from 'react';
import api from '../api/client.js';

function formatApiError(err, fallback) {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (typeof d.detail === 'string') return d.detail;
  return fallback;
}

function blockHeading(slug) {
  if (slug === 'delivery') return 'Условия доставки';
  if (slug === 'about') return 'О нас';
  return slug;
}

export default function SiteContentPage() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get('site-blocks/')
      .then((res) => setBlocks(Array.isArray(res.data) ? res.data : []))
      .catch((e) => setError(formatApiError(e, 'Не удалось загрузить блоки')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (row) => {
    setSavingId(row.id);
    setError(null);
    try {
      await api.patch(`site-blocks/${row.id}/`, {
        body: row.body,
      });
      await load();
    } catch (e) {
      setError(formatApiError(e, 'Не удалось сохранить'));
    } finally {
      setSavingId(null);
    }
  };

  const updateLocalBody = (id, body) => {
    setBlocks((list) => list.map((b) => (b.id === id ? { ...b, body } : b)));
  };

  if (loading) return <p>Загрузка…</p>;
  if (error && !blocks.length) return <p className="dashboard-alert">{error}</p>;

  return (
    <div className="dash-page site-content-page">
      <div className="page-header">
        <h1>Тексты на главной</h1>
        <p className="page-header__subtitle">Редактируйте текст блоков «Доставка» и «О нас» (как на главной странице витрины).</p>
      </div>
      {error ? <div className="dashboard-alert">{error}</div> : null}

      <div className="site-content-page__blocks">
        {blocks.map((b) => (
          <div key={b.id} className="dashboard-card site-content-page__card">
            <h2 className="site-content-page__card-title">{blockHeading(b.slug)}</h2>
            <form
              className="dash-form"
              onSubmit={(e) => {
                e.preventDefault();
                save(b);
              }}
            >
              <label className="form-group">
                <span>Текст</span>
                <textarea
                  rows={10}
                  className="dash-modal-control"
                  value={b.body}
                  onChange={(e) => updateLocalBody(b.id, e.target.value)}
                />
              </label>
              <button type="submit" className="btn btn--primary" disabled={savingId === b.id}>
                {savingId === b.id ? 'Сохранение…' : 'Сохранить'}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
