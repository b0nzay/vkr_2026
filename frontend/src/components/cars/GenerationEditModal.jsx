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

function previewUrl(fileOrNull) {
  return fileOrNull instanceof File ? URL.createObjectURL(fileOrNull) : null;
}

export default function GenerationEditModal({ isOpen, generation, defaultModelId, models, saving, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(generation?.name || '');
    const mid =
      generation?.car_model != null ? String(generation.car_model) : defaultModelId != null ? String(defaultModelId) : '';
    setModelId(mid);
    setImage(null);
    setError(null);
    setBusy(false);
  }, [isOpen, generation, defaultModelId]);

  const currentBrandName = useMemo(() => {
    const current = (models || []).find((m) => String(m.id) === String(modelId));
    return current?.brand_name || '';
  }, [models, modelId]);

  const modelOptions = useMemo(() => {
    const list = (models || []).slice();
    if (defaultModelId != null && !generation?.id) {
      const one = list.find((m) => String(m.id) === String(defaultModelId));
      if (one) {
        return [
          {
            value: String(one.id),
            label: one.brand_name ? `${one.brand_name} — ${one.name}` : one.name,
          },
        ];
      }
    }
    const filtered = currentBrandName ? list.filter((m) => m.brand_name === currentBrandName) : list;
    return filtered
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'))
      .map((m) => ({
        value: String(m.id),
        label: m.brand_name ? `${m.brand_name} — ${m.name}` : m.name,
      }));
  }, [models, currentBrandName, defaultModelId, generation?.id]);

  if (!isOpen) return null;

  const isEdit = Boolean(generation?.id);
  const lockModel = Boolean(defaultModelId) && !isEdit;

  const submit = (e) => {
    e.preventDefault();
    const nextName = name.trim();
    const nextModelId = String(modelId || '').trim();
    if (!nextModelId) return setError('Выберите модель');
    if (!nextName) return setError('Введите название поколения');

    setBusy(true);
    setError(null);

    const fd = new FormData();
    fd.append('car_model', String(Number(nextModelId)));
    fd.append('name', nextName);
    if (image instanceof File) fd.append('image', image);

    const req = isEdit ? api.patch(`generations/${generation.id}/`, fd) : api.post('generations/', fd);

    req
      .then(() => onSaved && onSaved())
      .then(() => onClose && onClose())
      .catch((err) => {
        console.error('Failed to save generation', err);
        setError(formatApiError(err, isEdit ? 'Не удалось сохранить поколение' : 'Не удалось создать поколение'));
      })
      .finally(() => setBusy(false));
  };

  const disabled = Boolean(saving || busy);

  return (
    <div className="dashboard-modal">
      <div className="dashboard-modal__backdrop" onClick={disabled ? undefined : onClose} role="presentation" />
      <div className="dashboard-modal__content" style={{ maxWidth: 720 }}>
        <div className="dashboard-modal__header">
          <h3 className="dashboard-modal__title">{isEdit ? 'Редактирование поколения' : 'Новое поколение'}</h3>
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
                <label htmlFor="gen-edit-model">Модель</label>
                <SearchSelect
                  options={modelOptions}
                  value={modelId}
                  onChange={(val) => setModelId(val)}
                  placeholder={currentBrandName ? 'Выберите модель' : 'Сначала выберите модель'}
                  disabled={disabled || lockModel || modelOptions.length === 0}
                />
              </div>
              <div className="form-group">
                <label htmlFor="gen-edit-name">Название</label>
                <input
                  id="gen-edit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="gen-edit-image">Фото (необязательно)</label>
              {(image instanceof File || generation?.image) && (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={image instanceof File ? previewUrl(image) : generation.image}
                    alt=""
                    style={{ width: 140, height: 84, objectFit: 'cover', borderRadius: 10 }}
                  />
                </div>
              )}
              <div className="dashboard-file">
                <input
                  id="gen-edit-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                  disabled={disabled}
                  className="dashboard-file__input"
                />
                <label
                  htmlFor="gen-edit-image"
                  className={`dashboard-file__btn${disabled ? ' dashboard-file__btn--disabled' : ''}`}
                >
                  Выбрать файл
                </label>
                <div className="dashboard-file__meta">{image?.name ? image.name : 'Файл не выбран'}</div>
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

