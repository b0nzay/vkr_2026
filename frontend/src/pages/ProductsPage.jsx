import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '../api/useProducts.js';
import ProductModalForm from '../components/products/ProductModalForm.jsx';
import ProductTable from '../components/products/ProductTable.jsx';
import DashboardListToolbar from '../components/common/DashboardListToolbar.jsx';
import SearchSelect from '../components/common/SearchSelect.jsx';
import ImportDataModal from '../components/ImportDataModal.jsx';

const ORDER_OPTIONS = [
  { value: '', label: 'По умолчанию' },
  { value: 'name', label: 'Название А–Я' },
  { value: '-name', label: 'Название Я–А' },
  { value: 'price', label: 'Цена по возрастанию' },
  { value: '-price', label: 'Цена по убыванию' },
  { value: 'stock', label: 'Остаток по возрастанию' },
  { value: '-stock', label: 'Остаток по убыванию' },
];

const ORDER_TAG_LABELS = Object.fromEntries(ORDER_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]));

const STOCK_OPTIONS = [
  { value: '', label: 'Любое' },
  { value: 'true', label: 'В наличии' },
  { value: 'false', label: 'Нет в наличии' },
];

function ProductsPage({ isAdmin = false, role }) {
  const effectiveRole = role || (isAdmin ? 'admin' : 'manager');
  const canCreateProducts = Boolean(isAdmin);
  const canEditProducts = Boolean(isAdmin) || effectiveRole === 'manager';
  const canDeleteProducts = Boolean(isAdmin);

  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get('q') || '';
  const categoryFromUrl = searchParams.get('category') || '';
  const inStockFromUrl = searchParams.get('in_stock') || '';
  const orderingFromUrl = searchParams.get('ordering') || '';
  const priceMinUrl = searchParams.get('price_min') || '';
  const priceMaxUrl = searchParams.get('price_max') || '';

  const queryParams = useMemo(() => {
    const p = {};
    if (qFromUrl.trim()) p.q = qFromUrl.trim();
    if (categoryFromUrl) p.category = categoryFromUrl;
    if (inStockFromUrl) p.in_stock = inStockFromUrl;
    if (orderingFromUrl) p.ordering = orderingFromUrl;
    if (priceMinUrl.trim()) p.price_min = priceMinUrl.trim();
    if (priceMaxUrl.trim()) p.price_max = priceMaxUrl.trim();
    return p;
  }, [qFromUrl, categoryFromUrl, inStockFromUrl, orderingFromUrl, priceMinUrl, priceMaxUrl]);

  const {
    products,
    categories,
    generations,
    bodyTypes,
    techVariants,
    compatRefsLoading,
    loading,
    saving,
    error,
    setError,
    ensureCompatibilityRefs,
    saveProduct,
    deleteProduct,
    adjustStock,
    reload,
  } = useProducts(queryParams);

  const [qDraft, setQDraft] = useState(qFromUrl);
  const [priceMinDraft, setPriceMinDraft] = useState(priceMinUrl);
  const [priceMaxDraft, setPriceMaxDraft] = useState(priceMaxUrl);

  useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);
  useEffect(() => {
    setPriceMinDraft(priceMinUrl);
  }, [priceMinUrl]);
  useEffect(() => {
    setPriceMaxDraft(priceMaxUrl);
  }, [priceMaxUrl]);

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
      const vmin = priceMinDraft.trim();
      const vmax = priceMaxDraft.trim();
      if (vmin) next.set('price_min', vmin);
      else next.delete('price_min');
      if (vmax) next.set('price_max', vmax);
      else next.delete('price_max');
      setSearchParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMinDraft, priceMaxDraft]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '' || value === 'all') next.delete(key);
    else next.set(key, String(value));
    setSearchParams(next);
  };

  const removeTag = (key) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next);
    if (key === 'price_min') setPriceMinDraft('');
    if (key === 'price_max') setPriceMaxDraft('');
    if (key === 'q') setQDraft('');
  };

  const categorySelectOptions = useMemo(
    () => [
      { value: '', label: 'Любая' },
      ...categories.map((cat) => ({
        value: String(cat.id),
        label: cat.path || cat.name,
      })),
    ],
    [categories],
  );

  const activeTags = useMemo(() => {
    const tags = [];
    if (qFromUrl.trim()) tags.push({ key: 'q', label: `Поиск: ${qFromUrl.trim()}` });
    if (categoryFromUrl) {
      const cat = categories.find((c) => String(c.id) === String(categoryFromUrl));
      tags.push({ key: 'category', label: `Категория: ${cat?.path || cat?.name || categoryFromUrl}` });
    }
    if (priceMinUrl.trim()) tags.push({ key: 'price_min', label: `Цена от: ${priceMinUrl.trim()}` });
    if (priceMaxUrl.trim()) tags.push({ key: 'price_max', label: `Цена до: ${priceMaxUrl.trim()}` });
    if (inStockFromUrl) {
      const label = inStockFromUrl === 'true' ? 'Только в наличии' : inStockFromUrl === 'false' ? 'Нет в наличии' : inStockFromUrl;
      tags.push({ key: 'in_stock', label });
    }
    if (orderingFromUrl) {
      tags.push({ key: 'ordering', label: `Сортировка: ${ORDER_TAG_LABELS[orderingFromUrl] || orderingFromUrl}` });
    }
    return tags;
  }, [categories, qFromUrl, categoryFromUrl, priceMinUrl, priceMaxUrl, inStockFromUrl, orderingFromUrl]);

  const resetFilters = () => {
    setSearchParams({}, { replace: false });
    setQDraft('');
    setPriceMinDraft('');
    setPriceMaxDraft('');
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const openCreateModal = () => {
    if (!canCreateProducts) return;
    setEditingProduct(null);
    setIsModalOpen(true);
    setError(null);
    ensureCompatibilityRefs();
  };

  const openEditModal = (product) => {
    if (!canEditProducts) return;
    setEditingProduct(product);
    setIsModalOpen(true);
    setError(null);
    ensureCompatibilityRefs();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    // Ошибку сохранения не сбрасываем: сообщение остаётся в блоке над таблицей, его можно скопировать.
  };

  const handleSubmit = (payload, id, compatibility) => {
    if (!canEditProducts) return Promise.resolve();
    return saveProduct(payload, id, compatibility).then(() => {
      closeModal();
    });
  };

  const handleDelete = (id) => {
    if (!canDeleteProducts) return;
    deleteProduct(id);
  };

  const handleAdjustStock = (id, delta) => {
    if (!canEditProducts) return Promise.resolve();
    return adjustStock(id, delta);
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <h2 className="dashboard-card__title">Товары</h2>
        <div className="dashboard-actions">
          <ImportDataModal entityType="products" onImported={reload} />
          {canCreateProducts && (
            <button type="button" className="btn btn--primary" onClick={openCreateModal}>
              Добавить товар
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
          placeholder="Поиск по названию, артикулу, бренду, совместимости"
          onQChange={setQDraft}
          resetLabel="Сбросить все"
          onReset={resetFilters}
          resetDisabled={!activeTags || activeTags.length === 0}
          activeTags={activeTags}
          onRemoveTag={removeTag}
        >
          <>
            <div className="form-group" style={{ minWidth: 260 }}>
              <label htmlFor="products-filter-category">Категория</label>
              <SearchSelect
                options={categorySelectOptions}
                value={categoryFromUrl}
                onChange={(val) => updateParam('category', val)}
                placeholder="Любая"
                withIcons={false}
                searchable
              />
            </div>

            <div className="form-group" style={{ minWidth: 100 }}>
              <label htmlFor="products-filter-price-min">Цена от</label>
              <input
                id="products-filter-price-min"
                type="number"
                min="0"
                step="0.01"
                value={priceMinDraft}
                onChange={(e) => setPriceMinDraft(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ minWidth: 100 }}>
              <label htmlFor="products-filter-price-max">Цена до</label>
              <input
                id="products-filter-price-max"
                type="number"
                min="0"
                step="0.01"
                value={priceMaxDraft}
                onChange={(e) => setPriceMaxDraft(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ minWidth: 200 }}>
              <label htmlFor="products-filter-stock">Наличие</label>
              <SearchSelect
                options={STOCK_OPTIONS}
                value={inStockFromUrl}
                onChange={(val) => updateParam('in_stock', val)}
                placeholder="Любое"
                withIcons={false}
                searchable={false}
              />
            </div>

            <div className="form-group" style={{ minWidth: 240 }}>
              <label htmlFor="products-filter-ordering">Сортировка</label>
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
          <p>Загрузка товаров…</p>
        ) : (
          <ProductTable
            products={products}
            canEdit={canEditProducts}
            canDelete={canDeleteProducts}
            onEdit={openEditModal}
            onDelete={handleDelete}
          />
        )}

        <ProductModalForm
          isOpen={isModalOpen}
          initialProduct={editingProduct}
          categories={categories}
          generations={generations}
          bodyTypes={bodyTypes}
          techVariants={techVariants}
          refsLoading={compatRefsLoading}
          saving={saving}
          error={error}
          onSubmit={handleSubmit}
          onClose={closeModal}
          editPolicy={{
            canEditIdentity: Boolean(isAdmin),
            canEditCompatibility: Boolean(isAdmin),
            canUploadImage: Boolean(isAdmin),
            canEditPrice: true,
            canEditStock: true,
            canEditDescription: true,
          }}
        />
      </div>
    </div>
  );
}

export default ProductsPage;
