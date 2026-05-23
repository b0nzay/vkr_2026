import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import CarsWizardModal from '../components/cars/CarsWizardModal.jsx';
import CarsHierarchyTable, { labelBodyType } from '../components/cars/CarsHierarchyTable.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import BrandEditModal from '../components/cars/BrandEditModal.jsx';
import CarModelEditModal from '../components/cars/CarModelEditModal.jsx';
import GenerationEditModal from '../components/cars/GenerationEditModal.jsx';
import BodyTypeEditModal from '../components/cars/BodyTypeEditModal.jsx';
import DashboardListToolbar from '../components/common/DashboardListToolbar.jsx';
import ImportDataModal from '../components/ImportDataModal.jsx';

function normalizeCarSearchTokens(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** Транслитерация кириллицы в латиницу для сопоставления «Astra» ↔ «Астра». */
const CYR_TO_LAT = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'j',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function foldLatinCyrillic(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKC')
    .split('')
    .map((ch) => CYR_TO_LAT[ch] || ch)
    .join('');
}

/** FK в DRF обычно число; защита от null (Number(null) === 0) и вложенного { id }. */
function coerceFkId(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'object' && val !== null && 'id' in val) {
    const n = Number(val.id);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function resolveBodyTypeSegments(bt, brandById, modelById, genById) {
  const bn = bt.brand_name;
  const mn = bt.car_model_name;
  const gn = bt.generation_name;
  if (
    bn != null &&
    String(bn).trim() !== '' &&
    mn != null &&
    String(mn).trim() !== '' &&
    gn != null &&
    String(gn).trim() !== ''
  ) {
    return {
      brand: bn,
      model: mn,
      generation: gn,
      bodyLabel: labelBodyType(bt.name),
      bodyCode: bt.name != null ? String(bt.name) : '',
    };
  }

  const genPk = coerceFkId(bt.generation);
  if (genPk == null) return null;
  const gen = genById.get(genPk);
  if (!gen) return null;
  const model = modelById.get(coerceFkId(gen.car_model));
  if (!model) return null;
  const brand = brandById.get(coerceFkId(model.brand));
  return {
    brand: bn != null && String(bn).trim() !== '' ? bn : brand?.name,
    model: mn != null && String(mn).trim() !== '' ? mn : model?.name,
    generation: gn != null && String(gn).trim() !== '' ? gn : gen?.name,
    bodyLabel: labelBodyType(bt.name),
    bodyCode: bt.name != null ? String(bt.name) : '',
  };
}

/**
 * Короткие токены не ищем в коде кузова (HATCHBACK_*), чтобы «h» не цеплялся за hatchback.
 * Один символ — только марка / модель / поколение (не подпись и не enum кузова).
 */
function segmentsToSearchForToken(token, segments) {
  const { brand, model, generation, bodyLabel, bodyCode } = segments;
  const core = [brand, model, generation].filter((x) => x != null && String(x).trim() !== '');
  const len = token.length;
  if (len <= 1) return core;
  if (len === 2) return [...core, bodyLabel].filter(Boolean);
  return [...core, bodyLabel, bodyCode].filter(Boolean);
}

/**
 * Латинская H / кириллическая Н как код поколения.
 * Нельзя использовать raw.includes('н') — совпадёт «н» в «седан», «поколение» и т.д.
 */
function segmentMatchesGenerationLetterH(segment) {
  const s = String(segment).trim().toLowerCase().normalize('NFKC');
  if (!s) return false;
  const c0 = s[0];
  if (c0 !== 'h' && c0 !== 'н') return false;
  if (s.length === 1) return true;
  const c1 = s[1];
  const nextIsLetter = /[a-zа-яё]/i.test(c1);
  return !nextIsLetter;
}

function segmentMatchesToken(segment, token) {
  const raw = String(segment).toLowerCase().normalize('NFKC');
  const t = String(token).toLowerCase().normalize('NFKC');
  if (t.length <= 1) {
    if (t === 'h' || t === 'н') {
      return segmentMatchesGenerationLetterH(segment);
    }
    return foldLatinCyrillic(raw).includes(foldLatinCyrillic(t)) || raw.includes(t);
  }
  return foldLatinCyrillic(raw).includes(foldLatinCyrillic(t)) || raw.includes(t);
}

function bodyTypeMatchesSearch(bt, tokens, brandById, modelById, genById) {
  const segments = resolveBodyTypeSegments(bt, brandById, modelById, genById);
  if (!segments) return false;

  return tokens.every((token) => {
    const segs = segmentsToSearchForToken(token, segments);
    return segs.some((seg) => segmentMatchesToken(seg, token));
  });
}

/** Фильтр дерева: токены AND; кириллица/латиница через fold; короткие запросы без ложных совпадений по enum кузова. */
function filterCarsHierarchy(brands, models, generations, bodyTypes, rawQ) {
  const tokens = normalizeCarSearchTokens(rawQ);
  if (!tokens.length) {
    return { brands, models, generations, bodyTypes };
  }

  const brandById = new Map((brands || []).map((b) => [Number(b.id), b]));
  const modelById = new Map((models || []).map((m) => [Number(m.id), m]));
  const genById = new Map((generations || []).map((g) => [Number(g.id), g]));

  const matchingBodyTypes = (bodyTypes || []).filter((bt) =>
    bodyTypeMatchesSearch(bt, tokens, brandById, modelById, genById),
  );

  const matchingBodyTypeIds = new Set(matchingBodyTypes.map((bt) => bt.id));
  const matchingGenIds = new Set(
    matchingBodyTypes.map((bt) => coerceFkId(bt.generation)).filter((id) => id != null),
  );
  const matchingModelIds = new Set();
  const matchingBrandIds = new Set();
  for (const gid of matchingGenIds) {
    const g = genById.get(gid);
    if (!g) continue;
    matchingModelIds.add(Number(g.car_model));
    const m = modelById.get(Number(g.car_model));
    if (m) matchingBrandIds.add(Number(m.brand));
  }

  return {
    brands: (brands || []).filter((b) => matchingBrandIds.has(Number(b.id))),
    models: (models || []).filter((m) => matchingModelIds.has(Number(m.id))),
    generations: (generations || []).filter((g) => matchingGenIds.has(Number(g.id))),
    bodyTypes: (bodyTypes || []).filter((bt) => matchingBodyTypeIds.has(bt.id)),
  };
}

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

function CarsPage({ isAdmin = true, canDelete }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get('q') || '';

  const [qDraft, setQDraft] = useState(qFromUrl);
  useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);

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

  const resetFilters = () => {
    setQDraft('');
    setSearchParams({}, { replace: true });
  };

  const removeTag = (key) => {
    if (key === 'q') {
      setQDraft('');
      const next = new URLSearchParams(searchParams);
      next.delete('q');
      setSearchParams(next, { replace: true });
    }
  };
  const activeTags = useMemo(() => {
    const tags = [];
    if (qFromUrl.trim()) tags.push({ key: 'q', label: `Поиск: ${qFromUrl.trim()}` });
    return tags;
  }, [qFromUrl]);

  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [bodyTypes, setBodyTypes] = useState([]);

  const { brands: displayBrands, models: displayModels, generations: displayGenerations, bodyTypes: displayBodyTypes } =
    useMemo(() => filterCarsHierarchy(brands, models, generations, bodyTypes, qFromUrl), [brands, models, generations, bodyTypes, qFromUrl]);

  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedGenerationId, setSelectedGenerationId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [creating, setCreating] = useState(null); // { type, brandId?, modelId?, generationId? }
  const [editing, setEditing] = useState(null); // { type: 'brand'|'model'|'generation'|'bodyType', entity: any }
  const [deleting, setDeleting] = useState(null); // { type, id, label }
  const [busyDelete, setBusyDelete] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);
  const [deleteImpactError, setDeleteImpactError] = useState(null);

  const loadAll = () => {
    setLoading(true);
    setError(null);
    return Promise.all([
      api.get('brands/'),
      api.get('car-models/'),
      api.get('generations/'),
      api.get('body-types/'),
    ])
      .then(([b, m, g, bt]) => {
        setBrands(b.data || []);
        setModels(m.data || []);
        setGenerations(g.data || []);
        setBodyTypes(bt.data || []);
      })
      .catch((err) => {
        console.error('Failed to load car dictionaries', err);
        setError(formatApiError(err, 'Не удалось загрузить данные'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const modelsForSelectedBrand = useMemo(
    () => models.filter((m) => String(m.brand) === String(selectedBrandId)),
    [models, selectedBrandId],
  );

  const generationsForSelectedModel = useMemo(
    () => generations.filter((g) => String(g.car_model) === String(selectedModelId)),
    [generations, selectedModelId],
  );

  const bodyTypesForSelectedGeneration = useMemo(
    () => bodyTypes.filter((bt) => String(bt.generation) === String(selectedGenerationId)),
    [bodyTypes, selectedGenerationId],
  );

  const openWizard = () => {
    setIsWizardOpen(true);
    setError(null);
  };

  const startAddBrand = () => {
    setError(null);
    setEditing(null);
    setCreating({ type: 'brand' });
  };

  const openEdit = (type, entity) => {
    setCreating(null);
    setEditing({ type, entity });
  };

  const confirmDelete = (mode = null) => {
    if (!deleting) return;
    setBusyDelete(true);
    setError(null);
    setDeleteImpactError(null);

    const { type, id } = deleting;
    let endpoint =
      type === 'brand'
        ? `brands/${id}/`
        : type === 'model'
          ? `car-models/${id}/`
          : type === 'generation'
            ? `generations/${id}/`
            : `body-types/${id}/`;

    if (mode && type !== 'bodyType') {
      endpoint = `${endpoint}?mode=${encodeURIComponent(mode)}`;
    }

    api
      .delete(endpoint)
      .then(() => {
        setDeleting(null);
        setDeleteImpact(null);
        return loadAll();
      })
      .catch((err) => {
        console.error('Failed to delete entity', err);
        setError(formatApiError(err, 'Не удалось удалить'));
      })
      .finally(() => setBusyDelete(false));
  };

  useEffect(() => {
    if (!deleting) {
      setDeleteImpact(null);
      setDeleteImpactLoading(false);
      setDeleteImpactError(null);
      return;
    }

    if (deleting.type === 'bodyType') {
      setDeleteImpact(null);
      setDeleteImpactLoading(false);
      setDeleteImpactError(null);
      return;
    }

    let cancelled = false;
    setDeleteImpactLoading(true);
    setDeleteImpact(null);
    setDeleteImpactError(null);

    const { type, id } = deleting;
    const endpoint =
      type === 'brand'
        ? `brands/${id}/delete-impact/`
        : type === 'model'
          ? `car-models/${id}/delete-impact/`
          : `generations/${id}/delete-impact/`;

    api
      .get(endpoint)
      .then((response) => {
        if (cancelled) return;
        setDeleteImpact(response?.data || null);
      })
      .catch((err) => {
        console.error('Failed to load delete impact', err);
        if (cancelled) return;
        setDeleteImpactError(formatApiError(err, 'Не удалось загрузить влияние удаления'));
      })
      .finally(() => {
        if (cancelled) return;
        setDeleteImpactLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deleting?.id, deleting?.type]);

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <h2 className="dashboard-card__title">Авто</h2>
        <div className="dashboard-actions" style={{ flexWrap: 'wrap' }}>
          <ImportDataModal entityType="cars" onImported={loadAll} />
          {isAdmin && (
            <button type="button" className="btn btn--secondary" onClick={startAddBrand}>
              Добавить марку
            </button>
          )}
          {isAdmin && (
            <button type="button" className="btn btn--primary" onClick={openWizard}>
              Мастер добавления
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
          placeholder="Поиск по марке, модели, поколению, типу кузова"
          onQChange={setQDraft}
          resetLabel="Сбросить все"
          onReset={resetFilters}
          resetDisabled={!activeTags || activeTags.length === 0}
          activeTags={activeTags}
          onRemoveTag={removeTag}
        />

        {loading ? (
          <p>Загрузка…</p>
        ) : (
          <CarsHierarchyTable
            brands={displayBrands}
            models={displayModels}
            generations={displayGenerations}
            bodyTypes={displayBodyTypes}
            isAdmin={isAdmin}
            canEdit={isAdmin}
            canDelete={canDelete}
            onAddChild={(parentType, entity) => {
              setError(null);
              setEditing(null);
              if (parentType === 'brand') setCreating({ type: 'model', brandId: entity.id });
              else if (parentType === 'model') setCreating({ type: 'generation', modelId: entity.id });
              else if (parentType === 'generation') setCreating({ type: 'bodyType', generationId: entity.id });
            }}
            onEdit={openEdit}
            onDelete={(type, id, label) => setDeleting({ type, id, label })}
          />
        )}

        <CarsWizardModal
          isOpen={isWizardOpen}
          saving={saving}
          brands={brands}
          models={models}
          generations={generations}
          bodyTypes={bodyTypes}
          selectedBrandId={selectedBrandId}
          selectedModelId={selectedModelId}
          selectedGenerationId={selectedGenerationId}
          onSelectBrandId={setSelectedBrandId}
          onSelectModelId={setSelectedModelId}
          onSelectGenerationId={setSelectedGenerationId}
          onReloadAll={loadAll}
          onClose={() => setIsWizardOpen(false)}
        />

        <BrandEditModal
          isOpen={creating?.type === 'brand' || editing?.type === 'brand'}
          brand={editing?.type === 'brand' ? editing.entity : null}
          saving={saving}
          onClose={() => {
            setCreating(null);
            setEditing(null);
          }}
          onSaved={loadAll}
        />
        <CarModelEditModal
          isOpen={creating?.type === 'model' || editing?.type === 'model'}
          model={editing?.type === 'model' ? editing.entity : null}
          defaultBrandId={creating?.type === 'model' ? creating.brandId : undefined}
          brands={brands}
          saving={saving}
          onClose={() => {
            setCreating(null);
            setEditing(null);
          }}
          onSaved={loadAll}
        />
        <GenerationEditModal
          isOpen={creating?.type === 'generation' || editing?.type === 'generation'}
          generation={editing?.type === 'generation' ? editing.entity : null}
          defaultModelId={creating?.type === 'generation' ? creating.modelId : undefined}
          models={models}
          saving={saving}
          onClose={() => {
            setCreating(null);
            setEditing(null);
          }}
          onSaved={loadAll}
        />
        <BodyTypeEditModal
          isOpen={creating?.type === 'bodyType' || editing?.type === 'bodyType'}
          bodyType={editing?.type === 'bodyType' ? editing.entity : null}
          defaultGenerationId={creating?.type === 'bodyType' ? creating.generationId : undefined}
          generations={generations}
          saving={saving}
          onClose={() => {
            setCreating(null);
            setEditing(null);
          }}
          onSaved={loadAll}
        />

        {deleting && deleting.type === 'bodyType' ? (
          <ConfirmModal
            title="Подтверждение удаления"
            message={`Удалить кузов «${deleting.label}»?`}
            confirmLabel="Удалить"
            cancelLabel="Отмена"
            onConfirm={() => confirmDelete(null)}
            onCancel={() => (busyDelete ? null : setDeleting(null))}
            busy={busyDelete}
          />
        ) : deleting ? (
          <div className="dashboard-modal" role="dialog" aria-modal="true" aria-label="Подтверждение удаления авто">
            <div
              className="dashboard-modal__backdrop"
              onClick={busyDelete ? undefined : () => setDeleting(null)}
              role="presentation"
            />
            <div className="dashboard-modal__content" style={{ maxWidth: 760 }}>
              <div className="dashboard-modal__header">
                <h3 className="dashboard-modal__title">
                  {deleting.type === 'brand'
                    ? `Удаление марки «${deleting.label}»`
                    : deleting.type === 'model'
                      ? `Удаление модели «${deleting.label}»`
                      : `Удаление поколения «${deleting.label}»`}
                </h3>
                <button
                  type="button"
                  className="dashboard-modal__close"
                  onClick={() => (busyDelete ? null : setDeleting(null))}
                  disabled={busyDelete}
                >
                  ×
                </button>
              </div>

              <div className="dashboard-modal__body">
                {deleteImpactError ? <div className="dashboard-alert">{deleteImpactError}</div> : null}
                {deleteImpactLoading && !deleteImpactError ? <p>Загрузка влияния удаления...</p> : null}

                {!deleteImpactLoading && deleteImpact ? (
                  <>
                    <p style={{ marginBottom: 12 }}>
                      Удаление приведёт к изменениям справочника и связей с товарами; выбор режима определяет,
                      будут ли удалены конфигурации или только будет снята привязка к авто.
                    </p>

                    <div className="dashboard-card" style={{ padding: 16, marginBottom: 16 }}>
                      <p style={{ marginBottom: 8 }}>
                        <strong>Кузова:</strong> {deleteImpact.body_types_count}
                      </p>
                      <p style={{ marginBottom: 8 }}>
                        <strong>Совместимости товара по кузову:</strong> {deleteImpact.product_body_compat_count}
                      </p>
                      <p style={{ marginBottom: 8 }}>
                        <strong>Конфигурации (TechVariant):</strong> {deleteImpact.tech_variants_count}
                      </p>
                      <p style={{ marginBottom: 0 }}>
                        <strong>Совместимости товара по конфигурациям:</strong> {deleteImpact.product_tech_compat_count}
                      </p>
                    </div>

                    <p className="text-muted" style={{ marginBottom: 0 }}>
                      В режиме «всё каскадно» конфигурации будут удалены; в режиме «конфигурации оставить»
                      конфигурации сохранятся, но потеряют привязку к поколению (станут «без привязки»).
                    </p>
                  </>
                ) : null}
              </div>

              <div className="dashboard-modal__footer">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => (busyDelete ? null : setDeleting(null))}
                  disabled={busyDelete}
                >
                  Отмена
                </button>

                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => confirmDelete('detach_tech')}
                  disabled={busyDelete || deleteImpactLoading}
                >
                  Удалить авто, конфигурации оставить
                </button>

                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => confirmDelete('cascade')}
                  disabled={busyDelete || deleteImpactLoading}
                >
                  Удалить всё каскадно
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CarsPage;
