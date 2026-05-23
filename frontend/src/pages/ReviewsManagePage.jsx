import React, { useCallback, useEffect, useState } from 'react';
import api from '../api/client.js';

function formatApiError(err, fallback) {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (typeof d.detail === 'string') return d.detail;
  return fallback;
}

export default function ReviewsManagePage({ isAdmin }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get('reviews/')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setItems(list);
        const d = {};
        list.forEach((r) => {
          d[r.id] = { staff_reply: r.staff_reply || '', is_published: r.is_published };
        });
        setDrafts(d);
      })
      .catch((e) => setError(formatApiError(e, 'Не удалось загрузить отзывы')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (id) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    setError(null);
    try {
      const payload = { staff_reply: draft.staff_reply };
      if (isAdmin) payload.is_published = draft.is_published;
      await api.patch(`reviews/${id}/`, payload);
      await load();
    } catch (e) {
      setError(formatApiError(e, 'Не удалось сохранить'));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <p>Загрузка…</p>;

  return (
    <div>
      <h1>Отзывы</h1>
      <p>Ответы покупателям на витрине.</p>
      {error ? <div className="dashboard-alert">{error}</div> : null}

      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Автор</th>
              <th>Текст</th>
              <th>Оценка</th>
              {isAdmin ? <th>На сайте</th> : null}
              <th>Ответ RideX</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.author_display || r.username}</td>
                <td style={{ maxWidth: 280 }}>{r.text}</td>
                <td>{r.rating || '—'}</td>
                {isAdmin ? (
                  <td>
                    <input
                      type="checkbox"
                      checked={drafts[r.id]?.is_published !== false}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [r.id]: { ...d[r.id], is_published: e.target.checked },
                        }))
                      }
                    />
                  </td>
                ) : null}
                <td style={{ minWidth: 220 }}>
                  <textarea
                    rows={3}
                    value={drafts[r.id]?.staff_reply ?? ''}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [r.id]: { ...d[r.id], staff_reply: e.target.value },
                      }))
                    }
                  />
                </td>
                <td>
                  <button type="button" className="btn btn--small btn--primary" disabled={savingId === r.id} onClick={() => save(r.id)}>
                    {savingId === r.id ? '…' : 'Сохранить'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length ? <p>Отзывов пока нет.</p> : null}
    </div>
  );
}
