import React, { useCallback, useEffect, useId, useState } from 'react';
import api from '../api/client.js';

function normalizeError(err, fallback) {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (typeof d.detail === 'string') return d.detail;
  return fallback;
}

export default function PromotionsPage({ isAdmin }) {
  const promoImageInputId = useId();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get('promotions/')
      .then((res) => setItems(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch((e) => setError(normalizeError(e, 'Не удалось загрузить акции')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setModal({
      id: null,
      title: '',
      description: '',
      is_published: false,
      image: null,
    });
  };

  const openEdit = (row) => {
    setModal({
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      is_published: Boolean(row.is_published),
      image: null,
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const hasNewImage = modal.image instanceof File;
      const baseJson = {
        title: modal.title.trim(),
        description: modal.description,
        ...(isAdmin ? { is_published: modal.is_published } : {}),
      };

      if (modal.id) {
        if (hasNewImage) {
          const fd = new FormData();
          fd.append('title', baseJson.title);
          fd.append('description', baseJson.description);
          if (isAdmin) fd.append('is_published', baseJson.is_published ? 'true' : 'false');
          fd.append('image', modal.image);
          await api.patch(`promotions/${modal.id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        } else {
          await api.patch(`promotions/${modal.id}/`, baseJson);
        }
      } else {
        const fd = new FormData();
        fd.append('title', baseJson.title);
        fd.append('description', baseJson.description);
        if (isAdmin) fd.append('is_published', baseJson.is_published ? 'true' : 'false');
        if (hasNewImage) fd.append('image', modal.image);
        await api.post('promotions/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(normalizeError(err, 'Ошибка сохранения'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Удалить акцию?')) return;
    try {
      await api.delete(`promotions/${id}/`);
      load();
    } catch (err) {
      setError(normalizeError(err, 'Не удалось удалить'));
    }
  };

  if (loading && !items.length) return <p>Загрузка…</p>;

  return (
    <div className="dash-page">
      <div className="page-header">
        <h1>Акции</h1>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Новая акция
        </button>
      </div>
      {error ? <div className="dashboard-alert">{error}</div> : null}

      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>На сайте</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.is_published ? 'да' : 'нет'}</td>
                <td>
                  <div className="dashboard-actions">
                    <button type="button" className="btn btn--small" onClick={() => openEdit(r)}>
                      Изменить
                    </button>
                    {isAdmin ? (
                      <button type="button" className="btn btn--small btn--muted" onClick={() => remove(r.id)}>
                        Удалить
                      </button>
                    ) : null}
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
            <h2>{modal.id ? 'Редактирование' : 'Новая акция'}</h2>
            <form onSubmit={save} className="dash-form">
              <label className="form-group">
                <span>Название</span>
                <input
                  type="text"
                  className="dash-modal-control"
                  value={modal.title}
                  onChange={(e) => setModal({ ...modal, title: e.target.value })}
                  required
                  autoComplete="off"
                />
              </label>
              <label className="form-group">
                <span>Описание</span>
                <textarea
                  className="dash-modal-control"
                  rows={5}
                  value={modal.description}
                  onChange={(e) => setModal({ ...modal, description: e.target.value })}
                />
              </label>
              <div className="form-group">
                <span className="form-group__label">Картинка</span>
                <div className="dashboard-file">
                  <input
                    id={promoImageInputId}
                    className="dashboard-file__input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setModal({ ...modal, image: e.target.files?.[0] || null })}
                  />
                  <label htmlFor={promoImageInputId} className="dashboard-file__btn">
                    Выбрать файл
                  </label>
                  {modal.image instanceof File ? (
                    <span className="dashboard-file__name">{modal.image.name}</span>
                  ) : null}
                </div>
              </div>
              {isAdmin ? (
                <label className="form-group form-group--inline">
                  <input
                    type="checkbox"
                    checked={modal.is_published}
                    onChange={(e) => setModal({ ...modal, is_published: e.target.checked })}
                  />
                  <span>Опубликовать на сайте</span>
                </label>
              ) : (
                <p className="dashboard-hint">Публикацию на сайте включает только администратор.</p>
              )}
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
