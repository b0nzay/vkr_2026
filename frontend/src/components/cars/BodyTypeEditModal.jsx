import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/client.js';
import SearchSelect from '../common/SearchSelect.jsx';

const BODY_TYPE_OPTIONS = [
  { value: 'SEDAN', label: 'Седан' },
  { value: 'LIFTBACK', label: 'Лифтбек' },
  { value: 'HATCHBACK_3D', label: 'Хэтчбек 3дв' },
  { value: 'HATCHBACK_5D', label: 'Хэтчбек 5дв' },
  { value: 'SUV_3D', label: 'Внедорожник 3дв' },
  { value: 'SUV_5D', label: 'Внедорожник 5дв' },
  { value: 'WAGON', label: 'Универсал' },
  { value: 'COUPE', label: 'Купе' },
  { value: 'CABRIO', label: 'Кабриолет' },
  { value: 'MINIVAN', label: 'Минивэн' },
  { value: 'PICKUP', label: 'Пикап' },
  { value: 'VAN', label: 'Фургон' },
  { value: 'LIMOUSINE', label: 'Лимузин' },
];

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

export default function BodyTypeEditModal({ isOpen, bodyType, defaultGenerationId, generations, saving, onClose, onSaved }) {
  const [generationId, setGenerationId] = useState('');
  const [code, setCode] = useState('');
  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const gid =
      bodyType?.generation != null
        ? String(bodyType.generation)
        : defaultGenerationId != null
          ? String(defaultGenerationId)
          : '';
    setGenerationId(gid);
    setCode(bodyType?.name || '');
    setImage(null);
    setError(null);
    setBusy(false);
  }, [isOpen, bodyType, defaultGenerationId]);

  const generationsForCurrentModel = useMemo(() => {
    const list = generations || [];
    const anchorId =
      bodyType?.generation != null ? bodyType.generation : defaultGenerationId != null ? defaultGenerationId : null;
    if (!anchorId) {
      return list.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    }
    const currentGeneration = list.find((g) => String(g.id) === String(anchorId));
    const currentModelId = currentGeneration?.car_model;
    if (!currentModelId) {
      return list.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    }
    return list
      .filter((g) => String(g.car_model) === String(currentModelId))
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
  }, [generations, bodyType, defaultGenerationId]);

  if (!isOpen) return null;

  const isEdit = Boolean(bodyType?.id);
  const lockGeneration = Boolean(defaultGenerationId) && !isEdit;

  const submit = (e) => {
    e.preventDefault();
    const nextGen = String(generationId || '').trim();
    const nextCode = String(code || '').trim();
    if (!nextGen) return setError('Выберите поколение');
    if (!nextCode) return setError('Выберите тип кузова');

    setBusy(true);
    setError(null);

    const fd = new FormData();
    fd.append('generation', String(Number(nextGen)));
    fd.append('name', nextCode);
    if (image instanceof File) fd.append('image', image);

    const req = isEdit ? api.patch(`body-types/${bodyType.id}/`, fd) : api.post('body-types/', fd);

    req
      .then(() => onSaved && onSaved())
      .then(() => onClose && onClose())
      .catch((err) => {
        console.error('Failed to save body type', err);
        setError(formatApiError(err, isEdit ? 'Не удалось сохранить тип кузова' : 'Не удалось создать тип кузова'));
      })
      .finally(() => setBusy(false));
  };

  const disabled = Boolean(saving || busy);

  return (
    <div className="dashboard-modal">
      <div className="dashboard-modal__backdrop" onClick={disabled ? undefined : onClose} role="presentation" />
      <div className="dashboard-modal__content" style={{ maxWidth: 720 }}>
        <div className="dashboard-modal__header">
          <h3 className="dashboard-modal__title">{isEdit ? 'Редактирование кузова' : 'Новый тип кузова'}</h3>
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
                <label htmlFor="bt-edit-generation">Поколение</label>
                <SearchSelect
                  options={generationsForCurrentModel.map((g) => ({
                    value: String(g.id),
                    label: g.name,
                    iconUrl: g.image || null,
                  }))}
                  value={generationId}
                  onChange={(val) => setGenerationId(val)}
                  placeholder="Выберите поколение"
                  disabled={disabled || lockGeneration}
                  searchable={false}
                  dropdownClassName="search-select__dropdown--generation-large"
                  renderOption={(option) => (
                    <div className="generation-option">
                      {option.iconUrl && (
                        <img src={option.iconUrl} alt="" className="generation-option__image" />
                      )}
                      <div className="generation-option__name">{option.label}</div>
                      <div className="generation-option__divider" />
                    </div>
                  )}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bt-edit-code">Тип кузова</label>
                <SearchSelect
                  options={BODY_TYPE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  value={code}
                  onChange={(val) => setCode(val)}
                  placeholder="Выберите тип кузова"
                  disabled={disabled}
                  searchable={false}
                  withIcons={false}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="bt-edit-image">Фото (необязательно)</label>
              {(image instanceof File || bodyType?.image) && (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={image instanceof File ? previewUrl(image) : bodyType.image}
                    alt=""
                    style={{ width: 140, height: 84, objectFit: 'cover', borderRadius: 10 }}
                  />
                </div>
              )}
              <div className="dashboard-file">
                <input
                  id="bt-edit-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                  disabled={disabled}
                  className="dashboard-file__input"
                />
                <label
                  htmlFor="bt-edit-image"
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

