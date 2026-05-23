import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';

function formatApiError(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const parts = [];
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) parts.push(`${key}: ${value.join(' ')}`);
      else if (typeof value === 'string') parts.push(`${key}: ${value}`);
    });
    if (parts.length) return parts.join('\n');
  }
  return fallback;
}

function previewUrl(fileOrNull) {
  return fileOrNull instanceof File ? URL.createObjectURL(fileOrNull) : null;
}

export default function BrandEditModal({ isOpen, brand, saving, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [logo, setLogo] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(brand?.name || '');
    setLogo(null);
    setError(null);
    setBusy(false);
  }, [isOpen, brand]);

  if (!isOpen) return null;

  const isEdit = Boolean(brand?.id);

  const submit = (e) => {
    e.preventDefault();
    const nextName = name.trim();
    if (!nextName) return setError('Введите название марки');

    setBusy(true);
    setError(null);

    const fd = new FormData();
    fd.append('name', nextName);
    if (logo instanceof File) fd.append('logo', logo);

    const req = isEdit
      ? api.patch(`brands/${brand.id}/`, fd)
      : api.post('brands/', fd);

    req
      .then(() => onSaved && onSaved())
      .then(() => onClose && onClose())
      .catch((err) => {
        console.error('Failed to save brand', err);
        setError(formatApiError(err, isEdit ? 'Не удалось сохранить марку' : 'Не удалось создать марку'));
      })
      .finally(() => setBusy(false));
  };

  const disabled = Boolean(saving || busy);

  return (
    <div className="dashboard-modal">
      <div className="dashboard-modal__backdrop" onClick={disabled ? undefined : onClose} role="presentation" />
      <div className="dashboard-modal__content" style={{ maxWidth: 560 }}>
        <div className="dashboard-modal__header">
          <h3 className="dashboard-modal__title">{isEdit ? 'Редактирование марки' : 'Новая марка'}</h3>
          <button type="button" className="dashboard-modal__close" onClick={onClose} disabled={disabled}>
            ×
          </button>
        </div>
        <div className="dashboard-modal__body">
          {error && (
            <div className="dashboard-alert" style={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="dashboard-form-row">
              <div className="form-group">
                <label htmlFor="brand-edit-name">Название</label>
                <input
                  id="brand-edit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="brand-edit-logo">Логотип (необязательно)</label>
              {(logo instanceof File || (isEdit && brand?.logo)) && (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={logo instanceof File ? previewUrl(logo) : brand.logo}
                    alt=""
                    style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 10, background: '#f9fafb' }}
                  />
                </div>
              )}
              <div className="dashboard-file">
                <input
                  id="brand-edit-logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogo(e.target.files?.[0] || null)}
                  disabled={disabled}
                  className="dashboard-file__input"
                />
                <label
                  htmlFor="brand-edit-logo"
                  className={`dashboard-file__btn${disabled ? ' dashboard-file__btn--disabled' : ''}`}
                >
                  Выбрать файл
                </label>
                <div className="dashboard-file__meta">{logo?.name ? logo.name : 'Файл не выбран'}</div>
              </div>
            </div>

            <div className="dashboard-modal__footer">
              <button type="submit" className="btn btn--primary" disabled={disabled}>
                {isEdit ? 'Сохранить' : 'Создать'}
              </button>
              <button type="button" className="btn btn--secondary" onClick={onClose} disabled={disabled}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

