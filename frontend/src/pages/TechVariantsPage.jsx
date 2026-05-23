import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTechVariants } from '../api/useTechVariants.js';
import TechVariantModalForm from '../components/tech/TechVariantModalForm.jsx';
import TechVariantTable from '../components/tech/TechVariantTable.jsx';
import DashboardListToolbar from '../components/common/DashboardListToolbar.jsx';
import SearchSelect from '../components/common/SearchSelect.jsx';
import ImportDataModal from '../components/ImportDataModal.jsx';

const TRANSMISSION_FILTER_OPTIONS = [
  { value: '', label: 'Любая' },
  { value: 'MT', label: 'Механика' },
  { value: 'AT', label: 'Автомат' },
  { value: 'CVT', label: 'Вариатор' },
  { value: 'DCT', label: 'Робот (DCT)' },
  { value: 'ROBOT', label: 'Робот' },
];

const ENGINE_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Любой' },
  { value: 'NATURALLY_ASPIRATED', label: 'Атмосферный' },
  { value: 'TURBO', label: 'Турбо' },
  { value: 'SUPERCHARGER', label: 'Нагнетатель' },
  { value: 'OTHER', label: 'Другое' },
];

const FUEL_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Любое' },
  { value: 'PETROL', label: 'Бензин' },
  { value: 'DIESEL', label: 'Дизель' },
  { value: 'LPG', label: 'Газ (LPG)' },
  { value: 'CNG', label: 'Газ (CNG)' },
  { value: 'ELECTRIC', label: 'Электро' },
  { value: 'HYBRID', label: 'Гибрид' },
];

const ORDER_OPTIONS = [
  { value: '', label: 'По умолчанию' },
  { value: 'engine_code', label: 'Код двигателя А–Я' },
  { value: '-engine_code', label: 'Код двигателя Я–А' },
  { value: 'generation', label: 'Поколение А–Я' },
  { value: '-generation', label: 'Поколение Я–А' },
  { value: 'transmission_code', label: 'Код КПП А–Я' },
  { value: '-transmission_code', label: 'Код КПП Я–А' },
  { value: 'power_hp', label: 'Мощность по возрастанию' },
  { value: '-power_hp', label: 'Мощность по убыванию' },
];

const ORDER_TAG_LABELS = ORDER_OPTIONS.reduce((acc, o) => {
  if (o.value) acc[o.value] = o.label;
  return acc;
}, {});

const ENGINE_TAG_LABELS = ENGINE_TYPE_FILTER_OPTIONS.reduce((acc, o) => {
  if (o.value) acc[o.value] = o.label;
  return acc;
}, {});

const FUEL_TAG_LABELS = FUEL_TYPE_FILTER_OPTIONS.reduce((acc, o) => {
  if (o.value) acc[o.value] = o.label;
  return acc;
}, {});

const TRANSMISSION_TAG_LABELS = TRANSMISSION_FILTER_OPTIONS.reduce((acc, o) => {
  if (o.value) acc[o.value] = o.label;
  return acc;
}, {});

function TechVariantsPage({ isAdmin }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get('q') || '';
  const generationFromUrl = searchParams.get('generation') || '';
  const transmissionTypeFromUrl = searchParams.get('transmission_type') || '';
  const engineTypeFromUrl = searchParams.get('engine_type') || '';
  const fuelTypeFromUrl = searchParams.get('fuel_type') || '';
  const orderingFromUrl = searchParams.get('ordering') || '';
  const powerMinUrl = searchParams.get('power_min') || '';
  const powerMaxUrl = searchParams.get('power_max') || '';

  const queryParams = useMemo(() => {
    const p = {};
    if (qFromUrl.trim()) p.q = qFromUrl.trim();
    if (generationFromUrl) p.generation = generationFromUrl;
    if (transmissionTypeFromUrl) p.transmission_type = transmissionTypeFromUrl;
    if (engineTypeFromUrl) p.engine_type = engineTypeFromUrl;
    if (fuelTypeFromUrl) p.fuel_type = fuelTypeFromUrl;
    if (orderingFromUrl) p.ordering = orderingFromUrl;
    if (powerMinUrl.trim()) p.power_min = powerMinUrl.trim();
    if (powerMaxUrl.trim()) p.power_max = powerMaxUrl.trim();
    return p;
  }, [
    qFromUrl,
    generationFromUrl,
    transmissionTypeFromUrl,
    engineTypeFromUrl,
    fuelTypeFromUrl,
    orderingFromUrl,
    powerMinUrl,
    powerMaxUrl,
  ]);

  const { techVariants, generations, loading, saving, error, setError, load, saveTechVariant, deleteTechVariant } = useTechVariants(
    queryParams,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const [qDraft, setQDraft] = useState(qFromUrl);
  const [powerMinDraft, setPowerMinDraft] = useState(powerMinUrl);
  const [powerMaxDraft, setPowerMaxDraft] = useState(powerMaxUrl);
  useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);
  useEffect(() => {
    setPowerMinDraft(powerMinUrl);
  }, [powerMinUrl]);
  useEffect(() => {
    setPowerMaxDraft(powerMaxUrl);
  }, [powerMaxUrl]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      const v = qDraft.trim();
      if (v) next.set('q', v);
      else next.delete('q');
      setSearchParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDraft]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      const vmin = powerMinDraft.trim();
      const vmax = powerMaxDraft.trim();
      if (vmin) next.set('power_min', vmin);
      else next.delete('power_min');
      if (vmax) next.set('power_max', vmax);
      else next.delete('power_max');
      setSearchParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [powerMinDraft, powerMaxDraft]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '' || value === 'all') next.delete(key);
    else next.set(key, String(value));
    setSearchParams(next);
  };

  const generationFilterOptions = useMemo(() => {
    return [
      { value: '', label: 'Любое', iconUrl: null },
      ...(generations || []).map((g) => ({
        value: String(g.id),
        label: [g.brand_name, g.car_model_name, g.name].filter(Boolean).join(' / ') || String(g.id),
        iconUrl: g.image || null,
      })),
    ];
  }, [generations]);

  const activeTags = useMemo(() => {
    const tags = [];
    if (qFromUrl.trim()) tags.push({ key: 'q', label: `Поиск: ${qFromUrl.trim()}` });
    if (generationFromUrl) {
      const gen = generations.find((g) => String(g.id) === String(generationFromUrl));
      tags.push({
        key: 'generation',
        label: `Поколение: ${gen ? `${gen.brand_name} ${gen.car_model_name} ${gen.name}` : generationFromUrl}`,
      });
    }
    if (transmissionTypeFromUrl) {
      tags.push({
        key: 'transmission_type',
        label: `Коробка: ${TRANSMISSION_TAG_LABELS[transmissionTypeFromUrl] || transmissionTypeFromUrl}`,
      });
    }
    if (engineTypeFromUrl) {
      tags.push({
        key: 'engine_type',
        label: `Тип двигателя: ${ENGINE_TAG_LABELS[engineTypeFromUrl] || engineTypeFromUrl}`,
      });
    }
    if (fuelTypeFromUrl) {
      tags.push({
        key: 'fuel_type',
        label: `Топливо: ${FUEL_TAG_LABELS[fuelTypeFromUrl] || fuelTypeFromUrl}`,
      });
    }
    if (orderingFromUrl) {
      tags.push({ key: 'ordering', label: `Сортировка: ${ORDER_TAG_LABELS[orderingFromUrl] || orderingFromUrl}` });
    }
    if (powerMinUrl.trim()) tags.push({ key: 'power_min', label: `Мощность от: ${powerMinUrl.trim()} л.с.` });
    if (powerMaxUrl.trim()) tags.push({ key: 'power_max', label: `Мощность до: ${powerMaxUrl.trim()} л.с.` });
    return tags;
  }, [
    qFromUrl,
    generationFromUrl,
    transmissionTypeFromUrl,
    engineTypeFromUrl,
    fuelTypeFromUrl,
    orderingFromUrl,
    powerMinUrl,
    powerMaxUrl,
    generations,
  ]);

  const resetFilters = () => {
    setQDraft('');
    setPowerMinDraft('');
    setPowerMaxDraft('');
    setSearchParams({}, { replace: true });
  };

  const removeTag = (key) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next);
    if (key === 'q') setQDraft('');
    if (key === 'power_min') setPowerMinDraft('');
    if (key === 'power_max') setPowerMaxDraft('');
  };

  const openCreateModal = () => {
    if (!isAdmin) return;
    setEditingRow(null);
    setIsModalOpen(true);
    setError(null);
  };

  const openEditModal = (row) => {
    if (!isAdmin) return;
    setEditingRow(row);
    setIsModalOpen(true);
    setError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRow(null);
    setError(null);
  };

  const handleSubmit = (payload, id) => {
    if (!isAdmin) return Promise.resolve();
    return saveTechVariant(payload, id).then(() => closeModal());
  };

  const handleDelete = (id) => {
    if (!isAdmin) return;
    deleteTechVariant(id);
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <h2 className="dashboard-card__title">Конфигурации</h2>
        <div className="dashboard-actions">
          <ImportDataModal entityType="tech_variants" onImported={load} />
          {isAdmin && (
            <button type="button" className="btn btn--primary" onClick={openCreateModal}>
              Добавить конфигурацию
            </button>
          )}
        </div>
      </div>
      <div className="dashboard-card__body">
        {error && (
          <div className="dashboard-alert" style={{ whiteSpace: 'pre-wrap' }}>
            {error}
          </div>
        )}

        <DashboardListToolbar
          q={qDraft}
          placeholder="Поиск по марке, модели, поколению, коду двигателя/КПП"
          onQChange={setQDraft}
          resetLabel="Сбросить все"
          onReset={resetFilters}
          resetDisabled={!activeTags || activeTags.length === 0}
          activeTags={activeTags}
          onRemoveTag={removeTag}
        >
          <>
            <div className="form-group" style={{ minWidth: 260 }}>
              <label htmlFor="tech-filter-generation">Поколение</label>
              <SearchSelect
                options={generationFilterOptions}
                value={generationFromUrl}
                onChange={(val) => updateParam('generation', val)}
                placeholder="Любое"
                disabled={false}
                searchable
                dropdownClassName="search-select__dropdown--generation-large"
                renderOption={(option) => (
                  <div className="generation-option">
                    {option.iconUrl && <img src={option.iconUrl} alt="" className="generation-option__image" />}
                    <div className="generation-option__name">{option.label}</div>
                    <div className="generation-option__divider" />
                  </div>
                )}
              />
            </div>

            <div className="form-group" style={{ minWidth: 200 }}>
              <label htmlFor="tech-filter-transmission">Тип коробки</label>
              <SearchSelect
                options={TRANSMISSION_FILTER_OPTIONS}
                value={transmissionTypeFromUrl}
                onChange={(val) => updateParam('transmission_type', val)}
                placeholder="Любая"
                withIcons={false}
                searchable={false}
              />
            </div>

            <div className="form-group" style={{ minWidth: 200 }}>
              <label htmlFor="tech-filter-engine-type">Тип двигателя</label>
              <SearchSelect
                options={ENGINE_TYPE_FILTER_OPTIONS}
                value={engineTypeFromUrl}
                onChange={(val) => updateParam('engine_type', val)}
                placeholder="Любой"
                withIcons={false}
                searchable={false}
              />
            </div>

            <div className="form-group" style={{ minWidth: 200 }}>
              <label htmlFor="tech-filter-fuel">Топливо</label>
              <SearchSelect
                options={FUEL_TYPE_FILTER_OPTIONS}
                value={fuelTypeFromUrl}
                onChange={(val) => updateParam('fuel_type', val)}
                placeholder="Любое"
                withIcons={false}
                searchable={false}
              />
            </div>

            <div className="form-group" style={{ minWidth: 120 }}>
              <label htmlFor="tech-filter-power-min">Мощн. от (л.с.)</label>
              <input
                id="tech-filter-power-min"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={powerMinDraft}
                onChange={(e) => setPowerMinDraft(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="form-group" style={{ minWidth: 120 }}>
              <label htmlFor="tech-filter-power-max">Мощн. до (л.с.)</label>
              <input
                id="tech-filter-power-max"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={powerMaxDraft}
                onChange={(e) => setPowerMaxDraft(e.target.value)}
                placeholder="—"
              />
            </div>

            <div className="form-group" style={{ minWidth: 260 }}>
              <label htmlFor="tech-filter-ordering">Сортировка</label>
              <SearchSelect
                options={ORDER_OPTIONS}
                value={orderingFromUrl}
                onChange={(val) => updateParam('ordering', val)}
                placeholder="По умолчанию"
                withIcons={false}
                searchable={false}
              />
            </div>
          </>
        </DashboardListToolbar>

        {loading ? (
          <p>Загрузка конфигураций…</p>
        ) : (
          <TechVariantTable techVariants={techVariants} isAdmin={isAdmin} onEdit={openEditModal} onDelete={handleDelete} />
        )}

        <TechVariantModalForm
          isOpen={isModalOpen}
          initialRow={editingRow}
          generations={generations}
          saving={saving}
          error={error}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      </div>
    </div>
  );
}

export default TechVariantsPage;
