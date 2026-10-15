import React, { useMemo, useState } from 'react';
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

export default function CarsWizardModal({
  isOpen,
  saving,
  brands,
  models,
  generations,
  bodyTypes,
  selectedBrandId,
  selectedModelId,
  selectedGenerationId,
  onSelectBrandId,
  onSelectModelId,
  onSelectGenerationId,
  onReloadAll,
  onClose,
}) {
  const [error, setError] = useState(null);
  const [localSaving, setLocalSaving] = useState(false);
  const busy = Boolean(saving || localSaving);

  const [brandForm, setBrandForm] = useState({ name: '', logo: null });
  const [modelName, setModelName] = useState('');
  const [generationForm, setGenerationForm] = useState({ name: '', image: null });
  const [bodyTypeForm, setBodyTypeForm] = useState({ code: '', image: null });
  const [locks, setLocks] = useState({ belowBrand: false, belowModel: false, belowGeneration: false });

  const modelsForBrand = useMemo(
    () => models.filter((m) => String(m.brand) === String(selectedBrandId)),
    [models, selectedBrandId],
  );

  const generationsForModel = useMemo(
    () => generations.filter((g) => String(g.car_model) === String(selectedModelId)),
    [generations, selectedModelId],
  );

  const bodyTypesForGeneration = useMemo(
    () => bodyTypes.filter((bt) => String(bt.generation) === String(selectedGenerationId)),
    [bodyTypes, selectedGenerationId],
  );

  const resetDownstream = (level) => {
    if (level === 'brand') {
      onSelectModelId('');
      onSelectGenerationId('');
      setModelName('');
      setGenerationForm({ name: '', image: null });
      setBodyTypeForm({ code: '', image: null });
      setLocks({ belowBrand: false, belowModel: false, belowGeneration: false });
    } else if (level === 'model') {
      onSelectGenerationId('');
      setGenerationForm({ name: '', image: null });
      setBodyTypeForm({ code: '', image: null });
      setLocks((p) => ({ ...p, belowModel: false, belowGeneration: false }));
    } else if (level === 'generation') {
      setBodyTypeForm({ code: '', image: null });
      setLocks((p) => ({ ...p, belowGeneration: false }));
    }
  };

  const submitBrand = async () => {
    try {
      setLocalSaving(true);
      setError(null);
      const newBrandName = brandForm.name.trim();
      if (!newBrandName) {
        setError('Введите название марки.');
        return;
      }

      const fd = new FormData();
      fd.append('name', newBrandName);
      if (brandForm.logo instanceof File) fd.append('logo', brandForm.logo);

      const r = await api.post('brands/', fd);
      const created = r.data;
      const brandId = String(created.id);
      onSelectBrandId(brandId);
      resetDownstream('brand');
      setBrandForm({ name: '', logo: null });
      await onReloadAll();
    } catch (err) {
      if (err?.response) {
        setError(formatApiError(err, 'Не удалось выполнить создание. Проверьте данные.'));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Не удалось выполнить создание. Проверьте данные.');
      }
    } finally {
      setLocalSaving(false);
    }
  };

  const submitModel = async () => {
    try {
      setLocalSaving(true);
      setError(null);

      const brandId = String(selectedBrandId || '').trim();
      const newModelName = modelName.trim();

      if (!brandId) {
        setError('Сначала выберите марку.');
        return;
      }
      if (!newModelName) {
        setError('Введите название модели.');
        return;
      }

      const r = await api.post('car-models/', { brand: Number(brandId), name: newModelName });
      const created = r.data;
      const modelId = String(created.id);
      onSelectModelId(modelId);
      resetDownstream('model');
      setModelName('');
      await onReloadAll();
    } catch (err) {
      if (err?.response) {
        setError(formatApiError(err, 'Не удалось выполнить создание. Проверьте данные.'));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Не удалось выполнить создание. Проверьте данные.');
      }
    } finally {
      setLocalSaving(false);
    }
  };

  const submitGeneration = async () => {
    try {
      setLocalSaving(true);
      setError(null);

      const modelId = String(selectedModelId || '').trim();
      const newGenerationName = generationForm.name.trim();

      if (!modelId) {
        setError('Сначала выберите модель.');
        return;
      }
      if (!newGenerationName) {
        setError('Введите название поколения.');
        return;
      }

      const fd = new FormData();
      fd.append('car_model', String(Number(modelId)));
      fd.append('name', newGenerationName);
      if (generationForm.image instanceof File) fd.append('image', generationForm.image);

      const r = await api.post('generations/', fd);
      const created = r.data;
      const generationId = String(created.id);
      onSelectGenerationId(generationId);
      resetDownstream('generation');
      setGenerationForm({ name: '', image: null });
      await onReloadAll();
    } catch (err) {
      if (err?.response) {
        setError(formatApiError(err, 'Не удалось выполнить создание. Проверьте данные.'));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Не удалось выполнить создание. Проверьте данные.');
      }
    } finally {
      setLocalSaving(false);
    }
  };

  const submitBodyType = async () => {
    try {
      setLocalSaving(true);
      setError(null);

      const generationId = String(selectedGenerationId || '').trim();
      const newBodyTypeCode = String(bodyTypeForm.code || '').trim();

      if (!generationId) {
        setError('Сначала выберите поколение.');
        return;
      }
      if (!newBodyTypeCode) {
        setError('Выберите тип кузова.');
        return;
      }

      const fd = new FormData();
      fd.append('generation', String(Number(generationId)));
      fd.append('name', newBodyTypeCode);
      if (bodyTypeForm.image instanceof File) fd.append('image', bodyTypeForm.image);

      await api.post('body-types/', fd);
      setBodyTypeForm({ code: '', image: null });
      await onReloadAll();
    } catch (err) {
      if (err?.response) {
        setError(formatApiError(err, 'Не удалось выполнить создание. Проверьте данные.'));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Не удалось выполнить создание. Проверьте данные.');
      }
    } finally {
      setLocalSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dashboard-modal">
      <div className="dashboard-modal__backdrop" onClick={busy ? undefined : onClose} role="presentation" />
      <div className="dashboard-modal__content">
        <div className="dashboard-modal__header">
          <h3 className="dashboard-modal__title">Добавление авто</h3>
          <button type="button" className="dashboard-modal__close" onClick={onClose} disabled={busy}>
            ×
          </button>
        </div>

        <div className="dashboard-modal__body">
          {error && (
            <div className="dashboard-alert" style={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ marginBottom: 10 }}>1) Марка</h3>
              <div className="dashboard-form-row">
                <div className="form-group">
                  <label htmlFor="cars-brand">Выбрать из списка</label>
                  <SearchSelect
                    options={brands
                      .slice()
                      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'))
                      .map((b) => ({
                        value: String(b.id),
                        label: b.name,
                        iconUrl: b.logo || null,
                      }))}
                    value={selectedBrandId}
                    onChange={(val) => {
                      const next = String(val || '');
                      const prev = String(selectedBrandId || '');
                      onSelectBrandId(next);
                      setBrandForm({ name: '', logo: null });
                      setLocks({ belowBrand: false, belowModel: false, belowGeneration: false });
                      if (next !== prev) {
                        resetDownstream('brand');
                      }
                    }}
                    placeholder="Выберите марку"
                    disabled={busy}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="brand-create-name">Или создать новую</label>
                  <input
                    id="brand-create-name"
                    type="text"
                    value={brandForm.name}
                    onChange={(e) => {
                      setBrandForm((p) => ({ ...p, name: e.target.value }));
                      setLocks({ belowBrand: Boolean(e.target.value.trim()), belowModel: false, belowGeneration: false });
                    }}
                    disabled={busy}
                    placeholder="Например: Opel"
                  />
                </div>
              </div>

              <div className="dashboard-form-row">
                <div className="form-group">
                  <label htmlFor="brand-create-logo">Логотип (необязательно)</label>
                  {brandForm.logo instanceof File && (
                    <div style={{ marginBottom: 8 }}>
                      <img
                        src={previewUrl(brandForm.logo)}
                        alt=""
                        style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 10, background: '#f9fafb' }}
                      />
                    </div>
                  )}
                  <div className="dashboard-file">
                    <input
                      id="brand-create-logo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBrandForm((p) => ({ ...p, logo: e.target.files?.[0] || null }))}
                      disabled={busy}
                      className="dashboard-file__input"
                    />
                    <label
                      htmlFor="brand-create-logo"
                      className={`dashboard-file__btn${busy ? ' dashboard-file__btn--disabled' : ''}`}
                    >
                      Выбрать файл
                    </label>
                    <div className="dashboard-file__meta">
                      {brandForm.logo?.name ? brandForm.logo.name : 'Файл не выбран'}
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ minWidth: 220 }}>
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={submitBrand}
                    disabled={busy || !brandForm.name.trim()}
                  >
                    Создать марку
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: 10 }}>2) Модель</h3>
              <div className="dashboard-form-row">
                <div className="form-group">
                  <label htmlFor="cars-model">Выбрать из списка</label>
                  <SearchSelect
                    options={modelsForBrand
                      .slice()
                      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'))
                      .map((m) => ({
                        value: String(m.id),
                        label: m.name,
                      }))}
                    value={selectedModelId}
                    onChange={(val) => {
                      const next = String(val || '');
                      const prev = String(selectedModelId || '');
                      onSelectModelId(next);
                      setModelName('');
                      setLocks((p) => ({ ...p, belowModel: false, belowGeneration: false }));
                      if (next !== prev) {
                        resetDownstream('model');
                      }
                    }}
                    placeholder={selectedBrandId ? 'Выберите модель' : 'Сначала выберите марку'}
                    disabled={busy || !selectedBrandId || locks.belowBrand}
                    withIcons={false}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="model-create-name">Или создать новую</label>
                  <input
                    id="model-create-name"
                    type="text"
                    value={modelName}
                    onChange={(e) => {
                      setModelName(e.target.value);
                      setLocks((p) => ({ ...p, belowModel: Boolean(e.target.value.trim()), belowGeneration: false }));
                    }}
                    disabled={busy || !selectedBrandId || locks.belowBrand}
                    placeholder="Например: Astra"
                  />
                </div>
              </div>
              <div className="dashboard-form-row">
                <div className="form-group" style={{ minWidth: 220 }}>
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={submitModel}
                    disabled={busy || !selectedBrandId || locks.belowBrand || !modelName.trim()}
                  >
                    Создать модель
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: 10 }}>3) Поколение</h3>
              <div className="dashboard-form-row">
                <div className="form-group">
                  <label htmlFor="cars-generation">Выбрать из списка</label>
                  <SearchSelect
                    options={generationsForModel
                      .slice()
                      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'))
                      .map((g) => ({
                        value: String(g.id),
                        label: g.name,
                        iconUrl: g.image || null,
                      }))}
                    value={selectedGenerationId}
                    onChange={(val) => {
                      const next = String(val || '');
                      const prev = String(selectedGenerationId || '');
                      onSelectGenerationId(next);
                      setGenerationForm((p) => ({ ...p, name: '' }));
                      setLocks((p) => ({ ...p, belowGeneration: false }));
                      if (next !== prev) {
                        resetDownstream('generation');
                      }
                    }}
                    placeholder={selectedModelId ? 'Выберите поколение' : 'Сначала выберите модель'}
                    disabled={busy || !selectedModelId || locks.belowBrand || locks.belowModel}
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
                  <label htmlFor="gen-create-name">Или создать новое</label>
                  <input
                    id="gen-create-name"
                    type="text"
                    value={generationForm.name}
                    onChange={(e) => {
                      setGenerationForm((p) => ({ ...p, name: e.target.value }));
                      setLocks((p) => ({ ...p, belowGeneration: Boolean(e.target.value.trim()) }));
                    }}
                    disabled={busy || !selectedModelId || locks.belowBrand || locks.belowModel}
                    placeholder="Например: H"
                  />
                </div>
              </div>

              <div className="dashboard-form-row">
                <div className="form-group">
                  <label htmlFor="gen-create-image">Фото (необязательно)</label>
                  {generationForm.image instanceof File && (
                    <div style={{ marginBottom: 8 }}>
                      <img
                        src={previewUrl(generationForm.image)}
                        alt=""
                        style={{ width: 140, height: 84, objectFit: 'cover', borderRadius: 10 }}
                      />
                    </div>
                  )}
                  <div className="dashboard-file">
                    <input
                      id="gen-create-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setGenerationForm((p) => ({ ...p, image: e.target.files?.[0] || null }))}
                      disabled={busy || !selectedModelId}
                      className="dashboard-file__input"
                    />
                    <label
                      htmlFor="gen-create-image"
                      className={`dashboard-file__btn${busy || !selectedModelId ? ' dashboard-file__btn--disabled' : ''}`}
                    >
                      Выбрать файл
                    </label>
                    <div className="dashboard-file__meta">
                      {generationForm.image?.name ? generationForm.image.name : 'Файл не выбран'}
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ minWidth: 220 }}>
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={submitGeneration}
                    disabled={
                      busy ||
                      !selectedModelId ||
                      locks.belowBrand ||
                      locks.belowModel ||
                      !generationForm.name.trim()
                    }
                  >
                    Создать поколение
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: 10 }}>4) Тип кузова</h3>
              <div className="dashboard-form-row">
                <div className="form-group">
                  <label htmlFor="bt-code">Тип кузова</label>
                  <SearchSelect
                    options={BODY_TYPE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    value={bodyTypeForm.code}
                    onChange={(val) => setBodyTypeForm((p) => ({ ...p, code: val }))}
                    placeholder={selectedGenerationId ? 'Выберите тип кузова' : 'Сначала выберите поколение'}
                    disabled={busy || !selectedGenerationId || locks.belowBrand || locks.belowModel || locks.belowGeneration}
                    searchable={false}
                    withIcons={false}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bt-image">Фото (необязательно)</label>
                  {bodyTypeForm.image instanceof File && (
                    <div style={{ marginBottom: 8 }}>
                      <img
                        src={previewUrl(bodyTypeForm.image)}
                        alt=""
                        style={{ width: 140, height: 84, objectFit: 'cover', borderRadius: 10 }}
                      />
                    </div>
                  )}
                  <div className="dashboard-file">
                    <input
                      id="bt-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBodyTypeForm((p) => ({ ...p, image: e.target.files?.[0] || null }))}
                      disabled={busy || !selectedGenerationId}
                      className="dashboard-file__input"
                    />
                    <label
                      htmlFor="bt-image"
                      className={`dashboard-file__btn${busy || !selectedGenerationId ? ' dashboard-file__btn--disabled' : ''}`}
                    >
                      Выбрать файл
                    </label>
                    <div className="dashboard-file__meta">
                      {bodyTypeForm.image?.name ? bodyTypeForm.image.name : 'Файл не выбран'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="dashboard-form-row">
                <div className="form-group" style={{ minWidth: 220 }}>
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={submitBodyType}
                    disabled={
                      busy ||
                      !selectedGenerationId ||
                      locks.belowBrand ||
                      locks.belowModel ||
                      locks.belowGeneration ||
                      !String(bodyTypeForm.code || '').trim()
                    }
                  >
                    Создать тип кузова
                  </button>
                </div>
              </div>

              {selectedGenerationId && bodyTypesForGeneration.length > 0 && (
                <table className="dashboard-table" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Фото</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bodyTypesForGeneration.map((bt) => {
                      const label = BODY_TYPE_OPTIONS.find((o) => o.value === bt.name)?.label || bt.name;
                      return (
                        <tr key={bt.id}>
                          <td>{label}</td>
                          <td>
                            {bt.image ? (
                              <img
                                src={bt.image}
                                alt=""
                                style={{ width: 72, height: 44, objectFit: 'cover', borderRadius: 8 }}
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>

        <div className="dashboard-modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

