import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/client.js';
import SearchSelect from '../common/SearchSelect.jsx';

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

export default function CarModelEditModal({ isOpen, model, defaultBrandId, brands, saving, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(model?.name || '');
    const initialBrand =
      model?.brand != null ? String(model.brand) : defaultBrandId != null ? String(defaultBrandId) : '';
    setBrandId(initialBrand);
    setError(null);
    setBusy(false);
  }, [isOpen, model, defaultBrandId]);

  const brandOptions = useMemo(() => {
    const list = (brands || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    if (defaultBrandId != null && !model?.id) {
      const one = list.find((b) => String(b.id) === String(defaultBrandId));
      if (one) return [one];
    }
    return list;
  }, [brands, defaultBrandId, model?.id]);

  if (!isOpen) return null;

  const isEdit = Boolean(model?.id);
  const lockBrand = Boolean(defaultBrandId) && !isEdit;

  const submit = (e) => {
    e.preventDefault();
    const nextName = name.trim();
    const nextBrandId = String(brandId || '').trim();
    if (!nextBrandId) return setError('Выберите марку');
    if (!nextName) return setError('Введите название модели');

    setBusy(true);
    setError(null);

    const payload = { brand: Number(nextBrandId), name: nextName };
    const req = isEdit ? api.patch(`car-models/${model.id}/`, payload) : api.post('car-models/', payload);

    req
      .then(() => onSaved && onSaved())
      .then(() => onClose && onClose())
      .catch((err) => {
        console.error('Failed to save model', err);
        setError(formatApiError(err, isEdit ? 'Не удалось сохранить модель' : 'Не удалось создать модель'));
      })
      .finally(() => setBusy(false));
  };

  const disabled = Boolean(saving || busy);

  return (
    <div className="dashboard-modal">
      <div className="dashboard-modal__backdrop" onClick={disabled ? undefined : onClose} role="presentation" />
      <div className="dashboard-modal__content" style={{ maxWidth: 560, maxHeight: '80vh' }}>
        <div className="dashboard-modal__header">
          <h3 className="dashboard-modal__title">{isEdit ? 'Редактирование модели' : 'Новая модель'}</h3>
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
                <label htmlFor="model-edit-brand">Марка</label>
                <SearchSelect
                  options={brandOptions.map((b) => ({
                    value: String(b.id),
                    label: b.name,
                    iconUrl: b.logo || null,
                  }))}
                  value={brandId}
                  onChange={(val) => setBrandId(val)}
                  placeholder="Выберите марку"
                  disabled={disabled || lockBrand}
                />
              </div>
              <div className="form-group">
                <label htmlFor="model-edit-name">Название</label>
                <input
                  id="model-edit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={disabled}
                />
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

