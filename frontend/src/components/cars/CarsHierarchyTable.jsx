import React, { useMemo, useState } from 'react';

const BODY_TYPE_LABELS = {
  SEDAN: 'Седан',
  LIFTBACK: 'Лифтбек',
  HATCHBACK_3D: 'Хэтчбек 3дв',
  HATCHBACK_5D: 'Хэтчбек 5дв',
  SUV_3D: 'Внедорожник 3дв',
  SUV_5D: 'Внедорожник 5дв',
  WAGON: 'Универсал',
  COUPE: 'Купе',
  CABRIO: 'Кабриолет',
  MINIVAN: 'Минивэн',
  PICKUP: 'Пикап',
  VAN: 'Фургон',
  LIMOUSINE: 'Лимузин',
};

export function labelBodyType(code) {
  return BODY_TYPE_LABELS[code] || code || '—';
}

function countDescendantsForBrand(brandId, models, generations, bodyTypes) {
  const modelIds = models.filter((m) => String(m.brand) === String(brandId)).map((m) => m.id);
  const genIds = generations.filter((g) => modelIds.some((id) => String(id) === String(g.car_model))).map((g) => g.id);
  const btCount = bodyTypes.filter((bt) => genIds.some((id) => String(id) === String(bt.generation))).length;
  return { models: modelIds.length, generations: genIds.length, bodyTypes: btCount };
}

function countDescendantsForModel(modelId, generations, bodyTypes) {
  const genIds = generations.filter((g) => String(g.car_model) === String(modelId)).map((g) => g.id);
  const btCount = bodyTypes.filter((bt) => genIds.some((id) => String(id) === String(bt.generation))).length;
  return { generations: genIds.length, bodyTypes: btCount };
}

function countDescendantsForGeneration(genId, bodyTypes) {
  const btCount = bodyTypes.filter((bt) => String(bt.generation) === String(genId)).length;
  return { bodyTypes: btCount };
}

export default function CarsHierarchyTable({
  brands,
  models,
  generations,
  bodyTypes,
  isAdmin = false,
  canDelete,
  canEdit,
  onAddChild = null,
  onEdit,
  onDelete,
}) {
  const resolvedCanEdit = typeof canEdit === 'boolean' ? canEdit : Boolean(isAdmin);
  const resolvedCanDelete = typeof canDelete === 'boolean' ? canDelete : Boolean(isAdmin);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const rows = useMemo(() => {
    const out = [];

    const brandsSorted = (brands || [])
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));

    const modelsByBrand = new Map();
    (models || []).forEach((m) => {
      const key = String(m.brand);
      if (!modelsByBrand.has(key)) modelsByBrand.set(key, []);
      modelsByBrand.get(key).push(m);
    });
    modelsByBrand.forEach((list) =>
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru')),
    );

    const gensByModel = new Map();
    (generations || []).forEach((g) => {
      const key = String(g.car_model);
      if (!gensByModel.has(key)) gensByModel.set(key, []);
      gensByModel.get(key).push(g);
    });
    gensByModel.forEach((list) =>
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru')),
    );

    const btsByGen = new Map();
    (bodyTypes || []).forEach((bt) => {
      const key = String(bt.generation);
      if (!btsByGen.has(key)) btsByGen.set(key, []);
      btsByGen.get(key).push(bt);
    });
    btsByGen.forEach((list) => list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru')));

    brandsSorted.forEach((b) => {
      const brandKey = `brand:${b.id}`;
      const brandCounts = countDescendantsForBrand(b.id, models, generations, bodyTypes);
      out.push({
        key: brandKey,
        type: 'brand',
        id: b.id,
        entity: b,
        level: 0,
        label: b.name,
        imageUrl: b.logo || null,
        meta: `${brandCounts.models} моделей · ${brandCounts.generations} поколений · ${brandCounts.bodyTypes} кузовов`,
        hasChildren: brandCounts.models > 0,
      });

      const isBrandCollapsed = collapsed.has(brandKey);
      if (isBrandCollapsed) return;

      const brandModels = modelsByBrand.get(String(b.id)) || [];
      brandModels.forEach((m) => {
        const modelKey = `model:${m.id}`;
        const modelCounts = countDescendantsForModel(m.id, generations, bodyTypes);
        out.push({
          key: modelKey,
          type: 'model',
          id: m.id,
          entity: m,
          level: 1,
          label: m.name,
          imageUrl: null,
          meta: `${modelCounts.generations} поколений · ${modelCounts.bodyTypes} кузовов`,
          hasChildren: modelCounts.generations > 0,
        });

        const isModelCollapsed = collapsed.has(modelKey);
        if (isModelCollapsed) return;

        const modelGens = gensByModel.get(String(m.id)) || [];
        modelGens.forEach((g) => {
          const genKey = `gen:${g.id}`;
          const genCounts = countDescendantsForGeneration(g.id, bodyTypes);
          out.push({
            key: genKey,
            type: 'generation',
            id: g.id,
            entity: g,
            level: 2,
            label: g.name,
            imageUrl: g.image || null,
            meta: `${genCounts.bodyTypes} кузовов`,
            hasChildren: genCounts.bodyTypes > 0,
          });

          const isGenCollapsed = collapsed.has(genKey);
          if (isGenCollapsed) return;

          const genBts = btsByGen.get(String(g.id)) || [];
          genBts.forEach((bt) => {
            out.push({
              key: `bt:${bt.id}`,
              type: 'bodyType',
              id: bt.id,
              entity: bt,
              level: 3,
              label: labelBodyType(bt.name),
              imageUrl: bt.image || null,
              meta: null,
              hasChildren: false,
            });
          });
        });
      });
    });

    return out;
  }, [brands, models, generations, bodyTypes, collapsed]);

  const toggle = (key) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!rows.length) {
    return <p className="text-muted">Пока нет данных по авто.</p>;
  }

  return (
    <table className="dashboard-table">
      <thead>
        <tr>
          <th style={{ width: 52 }}> </th>
          <th>Название</th>
          <th style={{ width: 160 }}>Тип</th>
          <th>Фото</th>
          <th style={{ width: 280 }}>Состав</th>
          <th style={{ width: 110 }} />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td>
              <div style={{ paddingLeft: 16 + r.level * 24 }}>
                {r.hasChildren ? (
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={() => toggle(r.key)}
                    title="Свернуть/развернуть"
                  >
                    {collapsed.has(r.key) ? '▸' : '▾'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--icon"
                    disabled
                    title=""
                    style={{ opacity: 1 }}
                  >
                    •
                  </button>
                )}
              </div>
            </td>
            <td>
              <div style={{ paddingLeft: 16 + r.level * 24, fontWeight: r.type === 'brand' ? 700 : 500 }}>
                {r.label || '—'}
              </div>
            </td>
            <td>
              {r.type === 'brand' ? 'Марка' : r.type === 'model' ? 'Модель' : r.type === 'generation' ? 'Поколение' : 'Кузов'}
            </td>
            <td>
              {r.imageUrl ? (
                <img src={r.imageUrl} alt="" style={{ width: 72, height: 44, objectFit: 'cover', borderRadius: 8 }} />
              ) : r.type === 'model' ? (
                ''
              ) : (
                '—'
              )}
            </td>
            <td className="text-muted">{r.meta || '—'}</td>
            <td>
              <div className="dashboard-actions">
                {isAdmin && onAddChild && r.type !== 'bodyType' ? (
                  <button
                    type="button"
                    className="btn btn--icon"
                    title={
                      r.type === 'brand'
                        ? 'Добавить модель'
                        : r.type === 'model'
                          ? 'Добавить поколение'
                          : 'Добавить кузов'
                    }
                    onClick={() => onAddChild(r.type, r.entity)}
                  >
                    +
                  </button>
                ) : null}
                {resolvedCanEdit ? (
                  <button
                    type="button"
                    className="btn btn--icon"
                    title="Редактировать"
                    onClick={() => onEdit && onEdit(r.type, r.entity)}
                  >
                    ✎
                  </button>
                ) : null}
                {resolvedCanDelete ? (
                  <button
                    type="button"
                    className="btn btn--icon btn--danger"
                    title="Удалить"
                    onClick={() => onDelete && onDelete(r.type, r.id, r.label)}
                  >
                    🗑
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

