import React, { useEffect, useMemo, useState } from 'react';
import SearchSelect from '../components/common/SearchSelect.jsx';
import VehicleFilterSelects from './VehicleFilterSelects.jsx';
import { CartControl, formatPriceRub, HeartButton, productImageUrl } from './catalogControls.jsx';
import { fitmentBadgeMeta } from './storefrontUtils.js';

const ORDER_OPTIONS = [
  { value: '', label: 'По умолчанию' },
  { value: 'name', label: 'Название А–Я' },
  { value: '-name', label: 'Название Я–А' },
  { value: 'price', label: 'Цена по возрастанию' },
  { value: '-price', label: 'Цена по убыванию' },
];

const ORDER_TAG_LABELS = Object.fromEntries(ORDER_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]));

function ActiveFilterTags({ tags, onRemoveTag }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="active-filters sf-active-filters" role="region" aria-label="Активные фильтры">
      {tags.map((t) => (
        <span key={t.key} className="filter-tag filter-tag--accent" title={t.title || t.label}>
          <span className="filter-tag__text">{t.label}</span>
          {onRemoveTag ? (
            <button
              type="button"
              className="filter-tag__remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTag(t.key);
              }}
              aria-label="Убрать фильтр"
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function normalizeParentId(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && raw !== null && 'id' in raw) return Number(raw.id);
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function buildCategoryChildrenByParent(categories) {
  const map = new Map();
  for (const c of categories) {
    const pid = normalizeParentId(c.parent);
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid).push(c);
  }
  const cmp = (a, b) => String(a.name).localeCompare(String(b.name), 'ru');
  map.forEach((list) => list.sort(cmp));
  return map;
}

function CategoryTreeRow({ cat, depth, childrenByParent, expanded, toggleExpand, selectedId, onSelectCategory }) {
  const id = cat.id;
  const children = childrenByParent.get(id) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(Number(id));
  const isSelected = String(selectedId || '') === String(id);
  const pad = Math.min(depth, 8) * 12;

  return (
    <>
      <div
        className={`sf-cat-row${isSelected ? ' sf-cat-row--active' : ''}`}
        style={{ paddingLeft: `${8 + pad}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="sf-cat-row__toggle"
            onClick={() => toggleExpand(Number(id))}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="sf-cat-row__toggle sf-cat-row__toggle--spacer" />
        )}
        <button type="button" className="sf-cat-row__name" onClick={() => onSelectCategory(String(id))}>
          {cat.name}
        </button>
      </div>
      {hasChildren && isExpanded
        ? children.map((ch) => (
            <CategoryTreeRow
              key={ch.id}
              cat={ch}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedId={selectedId}
              onSelectCategory={onSelectCategory}
            />
          ))
        : null}
    </>
  );
}

export default function CatalogPage({
  products,
  categories,
  refs,
  state,
  onChange,
  loading,
  error,
  onAddToCart,
  onSetCartQty,
  cartQuantityByProduct,
  favoriteSet,
  onToggleFavorite,
  onOpenProduct,
}) {
  const [priceMinDraft, setPriceMinDraft] = useState(state.price_min || '');
  const [priceMaxDraft, setPriceMaxDraft] = useState(state.price_max || '');
  const [expandedCategories, setExpandedCategories] = useState(() => new Set());

  const childrenByParent = useMemo(() => buildCategoryChildrenByParent(categories), [categories]);
  const rootCategories = useMemo(() => childrenByParent.get(null) || [], [childrenByParent]);

  const toggleExpand = (catId) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  useEffect(() => {
    setPriceMinDraft(state.price_min || '');
  }, [state.price_min]);
  useEffect(() => {
    setPriceMaxDraft(state.price_max || '');
  }, [state.price_max]);

  useEffect(() => {
    const t = setTimeout(() => {
      const vmin = priceMinDraft.trim();
      const vmax = priceMaxDraft.trim();
      onChange({
        price_min: vmin,
        price_max: vmax,
        page: '1',
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMinDraft, priceMaxDraft]);

  const activeTags = useMemo(() => {
    const tags = [];
    if (state.q?.trim()) tags.push({ key: 'q', label: `Поиск: ${state.q.trim()}` });
    if (state.category) {
      const cat = categories.find((c) => String(c.id) === String(state.category));
      tags.push({ key: 'category', label: `Категория: ${cat?.path || cat?.name || state.category}` });
    }
    if (state.price_min?.trim()) tags.push({ key: 'price_min', label: `Цена от: ${state.price_min.trim()} ₽` });
    if (state.price_max?.trim()) tags.push({ key: 'price_max', label: `Цена до: ${state.price_max.trim()} ₽` });
    if (state.in_stock === 'true') tags.push({ key: 'in_stock', label: 'Только в наличии' });
    if (state.ordering) tags.push({ key: 'ordering', label: `Сортировка: ${ORDER_TAG_LABELS[state.ordering] || state.ordering}` });
    if (state.fitment_only === 'true') tags.push({ key: 'fitment_only', label: 'Только подходящие' });

    const brand = refs.brands.find((x) => Number(x.id) === Number(state.brand_id));
    const model = refs.models.find((x) => Number(x.id) === Number(state.model_id));
    const gen = refs.generations.find((x) => Number(x.id) === Number(state.generation_id));
    const body = refs.bodyTypes.find((x) => Number(x.id) === Number(state.body_type_id));
    const tech = refs.techVariants.find((x) => Number(x.id) === Number(state.tech_variant_id));

    if (brand) tags.push({ key: 'brand_id', label: `Марка: ${brand.name}` });
    if (model) tags.push({ key: 'model_id', label: `Модель: ${model.name}` });
    if (gen) tags.push({ key: 'generation_id', label: `Поколение: ${gen.name}` });
    if (body) tags.push({ key: 'body_type_id', label: `Кузов: ${body.name_display || body.name}` });
    if (tech) tags.push({ key: 'tech_variant_id', label: `Конфигурация: ${tech.engine_code}/${tech.transmission_code}` });

    return tags;
  }, [state, categories, refs]);

  const removeTag = (key) => {
    if (key === 'brand_id') {
      onChange({ brand_id: '', model_id: '', generation_id: '', body_type_id: '', tech_variant_id: '', fitment_only: '', page: '1' });
      return;
    }
    if (key === 'model_id') {
      onChange({ model_id: '', generation_id: '', body_type_id: '', tech_variant_id: '', page: '1' });
      return;
    }
    if (key === 'generation_id') {
      onChange({ generation_id: '', body_type_id: '', tech_variant_id: '', page: '1' });
      return;
    }
    if (key === 'body_type_id') {
      onChange({ body_type_id: '', page: '1' });
      return;
    }
    if (key === 'tech_variant_id') {
      onChange({ tech_variant_id: '', page: '1' });
      return;
    }
    if (key === 'price_min') {
      setPriceMinDraft('');
      onChange({ price_min: '', page: '1' });
      return;
    }
    if (key === 'price_max') {
      setPriceMaxDraft('');
      onChange({ price_max: '', page: '1' });
      return;
    }
    onChange({ [key]: '', page: '1' });
  };

  const resetFilters = () => {
    setPriceMinDraft('');
    setPriceMaxDraft('');
    onChange({
      q: '',
      category: '',
      price_min: '',
      price_max: '',
      in_stock: '',
      ordering: '',
      fitment_only: '',
      brand_id: '',
      model_id: '',
      generation_id: '',
      body_type_id: '',
      tech_variant_id: '',
      page: '1',
    });
  };

  const allCategoriesActive = !state.category;

  return (
    <div className="sf-catalog">
      <aside className="sf-sidebar">
        <h3 className="sf-sidebar__title">Категории</h3>
        <div className="sf-cat-tree">
          <button
            type="button"
            className={`sf-cat-row sf-cat-row--all${allCategoriesActive ? ' sf-cat-row--active' : ''}`}
            onClick={() => onChange({ category: '', page: '1' })}
          >
            Все категории
          </button>
          {rootCategories.map((cat) => (
            <CategoryTreeRow
              key={cat.id}
              cat={cat}
              depth={0}
              childrenByParent={childrenByParent}
              expanded={expandedCategories}
              toggleExpand={toggleExpand}
              selectedId={state.category}
              onSelectCategory={(id) => onChange({ category: id, page: '1' })}
            />
          ))}
        </div>
      </aside>

      <section className="sf-content">
        <div className="sf-filters">
          <VehicleFilterSelects
            refs={refs}
            state={state}
            onVehicleChange={(patch) => onChange({ ...patch, page: '1' })}
          />

          <div className="form-group sf-filter-field">
            <label>Цена от (₽)</label>
            <input type="number" min="0" step="0.01" value={priceMinDraft} onChange={(e) => setPriceMinDraft(e.target.value)} />
          </div>
          <div className="form-group sf-filter-field">
            <label>Цена до (₽)</label>
            <input type="number" min="0" step="0.01" value={priceMaxDraft} onChange={(e) => setPriceMaxDraft(e.target.value)} />
          </div>

          <div className="form-group sf-filter-field">
            <label>Сортировка</label>
            <SearchSelect
              options={ORDER_OPTIONS}
              value={state.ordering || ''}
              onChange={(val) => onChange({ ordering: val || '', page: '1' })}
              placeholder="По умолчанию"
              withIcons={false}
              searchable={false}
            />
          </div>

          <label className="sf-inline-check">
            <input
              type="checkbox"
              checked={state.in_stock === 'true'}
              onChange={(e) => onChange({ in_stock: e.target.checked ? 'true' : '', page: '1' })}
            />
            Только в наличии
          </label>

          <label className="sf-inline-check">
            <input
              type="checkbox"
              checked={state.fitment_only === 'true'}
              onChange={(e) => onChange({ fitment_only: e.target.checked ? 'true' : '', page: '1' })}
            />
            Только подходящие
          </label>

          <button type="button" className="btn btn--small btn--secondary" onClick={resetFilters} disabled={activeTags.length === 0}>
            Сбросить фильтры
          </button>
        </div>

        <ActiveFilterTags tags={activeTags} onRemoveTag={removeTag} />

        {error && <div className="dashboard-alert">{error}</div>}
        {loading ? (
          <p>Загрузка каталога...</p>
        ) : (
          <div className="sf-grid">
            {products.map((product) => {
              const badge = fitmentBadgeMeta(product.fitment_status);
              const qty = cartQuantityByProduct[product.id] || 0;
              const fav = favoriteSet.has(Number(product.id));
              const imgUrl = productImageUrl(product.image);
              return (
                <article key={product.id} className="sf-card">
                  <div className="sf-card__top">
                    <HeartButton filled={fav} onClick={() => onToggleFavorite(product.id)} />
                  </div>
                  <div className="sf-card__media" aria-hidden={!imgUrl}>
                    {imgUrl ? (
                      <img className="sf-card__img" src={imgUrl} alt="" loading="lazy" />
                    ) : (
                      <div className="sf-card__img sf-card__img--placeholder">Нет фото</div>
                    )}
                  </div>
                  <button type="button" className="sf-card__main" onClick={() => onOpenProduct(product.id)}>
                    <h4>{product.name}</h4>
                    <p className="sf-sku">{product.sku}</p>
                    <p className="sf-price">
                      <span className="sf-price__value">{formatPriceRub(product.price)}</span>
                      <span className="sf-price__currency" aria-hidden>
                        {' '}
                        ₽
                      </span>
                      <span className="sf-price__hint">руб.</span>
                    </p>
                    <p className={badge.className}>{badge.label}</p>
                  </button>
                  <CartControl
                    productId={product.id}
                    qty={qty}
                    onAdd={onAddToCart}
                    onSetQty={onSetCartQty}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
