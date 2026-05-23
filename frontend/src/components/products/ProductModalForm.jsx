import React, { useEffect, useMemo, useState } from 'react';
import SearchSelect from '../common/SearchSelect.jsx';
import ConfirmModal from '../ConfirmModal.jsx';

function ProductModalForm({
  isOpen,
  initialProduct,
  categories,
  generations,
  bodyTypes,
  techVariants,
  refsLoading,
  saving,
  error,
  onSubmit,
  onClose,
  editPolicy,
}) {
  const [form, setForm] = useState({
    name: '',
    price: '',
    stock: '',
    sku: '',
    brand_name: '',
    description: '',
    category: '',
    compatibility_mode: 'BODY_TYPE',
  });
  const [selectedBodyTypeIds, setSelectedBodyTypeIds] = useState([]);
  const [selectedTechVariantIds, setSelectedTechVariantIds] = useState([]);
  const [bodyGenerationId, setBodyGenerationId] = useState('');
  const [techGenerationId, setTechGenerationId] = useState('');
  const [bodyTypeCandidate, setBodyTypeCandidate] = useState('');
  const [techVariantCandidate, setTechVariantCandidate] = useState('');
  const [localError, setLocalError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [modeSwitchConfirm, setModeSwitchConfirm] = useState(null);

  const canEditIdentity = editPolicy?.canEditIdentity ?? true;
  const canEditCompatibility = editPolicy?.canEditCompatibility ?? true;
  const canUploadImage = editPolicy?.canUploadImage ?? true;
  const canEditPrice = editPolicy?.canEditPrice ?? true;
  const canEditStock = editPolicy?.canEditStock ?? true;
  const canEditDescription = editPolicy?.canEditDescription ?? true;

  const categoryOptions = useMemo(
    () =>
      (categories || []).map((cat) => ({
        value: String(cat.id),
        label: cat.path || cat.name,
      })),
    [categories],
  );

  const generationOptions = useMemo(
    () =>
      (generations || []).map((g) => ({
        value: String(g.id),
        label: [g.brand_name, g.car_model_name, g.name].filter(Boolean).join(' / ') || String(g.id),
        iconUrl: g.image || null,
      })),
    [generations],
  );

  const bodyTypeOptions = useMemo(
    () =>
      (bodyTypes || [])
        .filter((bt) => !bodyGenerationId || String(bt.generation) === String(bodyGenerationId))
        .map((bt) => ({
          value: String(bt.id),
          label: bt.name_display || bt.name,
        })),
    [bodyTypes, bodyGenerationId],
  );

  const techVariantOptions = useMemo(
    () =>
      (techVariants || [])
        .filter((tv) => !techGenerationId || String(tv.generation) === String(techGenerationId))
        .map((tv) => ({
          value: String(tv.id),
          label: `${tv.engine_code} · ${tv.transmission_type} ${tv.transmission_code}`,
        })),
    [techVariants, techGenerationId],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (initialProduct) {
      setForm({
        name: initialProduct.name || '',
        price: String(initialProduct.price ?? ''),
        stock: String(initialProduct.stock ?? ''),
        sku: initialProduct.sku || '',
        description: initialProduct.description || '',
        category: initialProduct.category ? String(initialProduct.category) : '',
        brand_name: initialProduct.brand_name || '',
        compatibility_mode: initialProduct.compatibility_mode || 'BODY_TYPE',
      });
      setSelectedBodyTypeIds((initialProduct.compatible_body_types || []).map((x) => String(x.body_type_id)));
      setSelectedTechVariantIds((initialProduct.compatible_tech_variants || []).map((x) => String(x.tech_variant_id)));
      setBodyGenerationId('');
      setTechGenerationId('');
      setBodyTypeCandidate('');
      setTechVariantCandidate('');
      setImagePreview(initialProduct.image || '');
      setImageFile(null);
      setModeSwitchConfirm(null);
    } else {
      setForm({
        name: '',
        price: '',
        stock: '',
        sku: '',
        description: '',
        category: '',
        brand_name: '',
        compatibility_mode: 'BODY_TYPE',
      });
      setSelectedBodyTypeIds([]);
      setSelectedTechVariantIds([]);
      setBodyGenerationId('');
      setTechGenerationId('');
      setBodyTypeCandidate('');
      setTechVariantCandidate('');
      setImagePreview('');
      setImageFile(null);
      setModeSwitchConfirm(null);
    }
    setLocalError(null);
  }, [isOpen, initialProduct]);

  if (!isOpen) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (event) => {
    if (!canUploadImage) return;
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError(null);

    const price = String(form.price ?? '').trim();
    const stockStr = String(form.stock ?? '').trim();
    if (!price) return setLocalError('Введите цену');

    try {
      const stockNum = stockStr === '' ? 0 : Number(stockStr);
      if (Number.isNaN(stockNum) || stockNum < 0) return setLocalError('Остаток должен быть числом ≥ 0');

      // Ограниченная политика менеджера: изменение только price/description/stock.
      // Совместимости и “идентичность” товара намеренно не отправляются, чтобы исключить любые изменения связей.
      if (!canEditIdentity) {
        if (!initialProduct) return setLocalError('Недостаточно прав для создания товара');
        const payload = {
          price,
          stock: stockNum,
          description: form.description || '',
        };
        await onSubmit(payload, initialProduct ? initialProduct.id : null, null);
        return;
      }

      // Политика администратора: отправляются все поля + синхронизация совместимости.
      const name = form.name.trim();
      const sku = form.sku.trim();
      const categoryStr = String(form.category ?? '').trim();
      const brandStr = String(form.brand_name ?? '').trim();

      if (!name) return setLocalError('Введите название товара');
      if (!sku) return setLocalError('Введите артикул');
      if (!categoryStr) return setLocalError('Выберите категорию');
      if (!brandStr) return setLocalError('Введите бренд товара');

      if (form.compatibility_mode === 'BODY_TYPE' && canEditCompatibility && selectedBodyTypeIds.length === 0) {
        return setLocalError('Добавьте хотя бы один тип кузова в совместимость.');
      }
      if (form.compatibility_mode === 'TECH_VARIANT' && canEditCompatibility && selectedTechVariantIds.length === 0) {
        return setLocalError('Добавьте хотя бы одну техническую конфигурацию в совместимость.');
      }

      const payload = {
        name,
        sku,
        price,
        stock: stockNum,
        description: form.description || '',
        category: Number(categoryStr),
        brand_name: brandStr,
        compatibility_mode: form.compatibility_mode,
      };

      let body = payload;
      if (imageFile) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          formData.append(key, value);
        });
        formData.append('image', imageFile);
        body = formData;
      }

      await onSubmit(body, initialProduct ? initialProduct.id : null, {
        mode: form.compatibility_mode,
        bodyTypeIds: selectedBodyTypeIds,
        techVariantIds: selectedTechVariantIds,
      });
    } catch {
      // Ошибка уже обработана выше (в хуке), здесь просто не закрываем модалку.
    }
  };

  const combinedError = localError || error;
  const requestModeSwitch = (nextMode) => {
    if (!canEditCompatibility) return;
    if (nextMode === form.compatibility_mode) return;
    const hasTechLinks = selectedTechVariantIds.length > 0;
    const hasBodyLinks = selectedBodyTypeIds.length > 0;
    const willClear =
      (nextMode === 'BODY_TYPE' && hasTechLinks)
      || (nextMode === 'TECH_VARIANT' && hasBodyLinks);

    if (!willClear) {
      setForm((prev) => ({ ...prev, compatibility_mode: nextMode }));
      return;
    }

    setModeSwitchConfirm({ nextMode });
  };

  const applyModeSwitch = (nextMode) => {
    if (!canEditCompatibility) return;
    setForm((prev) => ({ ...prev, compatibility_mode: nextMode }));
    if (nextMode === 'BODY_TYPE') {
      setSelectedTechVariantIds([]);
      setTechVariantCandidate('');
    } else {
      setSelectedBodyTypeIds([]);
      setBodyTypeCandidate('');
    }
  };

  return (
    <div className="dashboard-modal">
      <div className="dashboard-modal__backdrop" onClick={onClose} role="presentation" />
      <div className="dashboard-modal__content">
        <div className="dashboard-modal__header">
          <h3 className="dashboard-modal__title">
            {initialProduct ? 'Редактирование товара' : 'Создание товара'}
          </h3>
          <button type="button" className="dashboard-modal__close" onClick={onClose} disabled={saving}>
            ×
          </button>
        </div>

        <div className="dashboard-modal__body">
          {combinedError && (
            <div className="dashboard-alert" style={{ whiteSpace: 'pre-wrap' }}>
              {combinedError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="dashboard-form-row">
              <div className="form-group">
                <label htmlFor="product-name">Название</label>
                <input
                  id="product-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  disabled={saving || !canEditIdentity}
                />
              </div>
              <div className="form-group">
                <label htmlFor="product-sku">Артикул</label>
                <input
                  id="product-sku"
                  name="sku"
                  type="text"
                  value={form.sku}
                  onChange={handleChange}
                  disabled={saving || !canEditIdentity}
                />
              </div>
              <div className="form-group">
                <label htmlFor="product-brand">Бренд товара</label>
                <input
                  id="product-brand"
                  name="brand_name"
                  type="text"
                  value={form.brand_name}
                  onChange={handleChange}
                  disabled={saving || !canEditIdentity}
                />
              </div>
            </div>

            <div className="dashboard-form-row">
              <div className="form-group">
                <label htmlFor="product-price">Цена</label>
                <input
                  id="product-price"
                  name="price"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={handleChange}
                  disabled={saving || !canEditPrice}
                />
              </div>
              <div className="form-group">
                <label htmlFor="product-stock">Остаток</label>
                <input
                  id="product-stock"
                  name="stock"
                  type="number"
                  value={form.stock}
                  onChange={handleChange}
                  disabled={saving || !canEditStock}
                />
              </div>
              <div className="form-group">
                <label htmlFor="product-category">Категория</label>
                <SearchSelect
                  options={categoryOptions}
                  value={form.category}
                  onChange={(val) => setForm((prev) => ({ ...prev, category: String(val || '') }))}
                  placeholder="Выберите категорию"
                  disabled={saving || !canEditIdentity}
                  withIcons={false}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="product-description">Описание</label>
              <textarea
                id="product-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                  disabled={saving || !canEditDescription}
              />
            </div>

            <div className="form-group">
              <label htmlFor="product-image">Фото</label>
              {imagePreview && (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={imagePreview}
                    alt={form.name || 'Товар'}
                    style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8 }}
                  />
                </div>
              )}
              <div className="dashboard-file">
                <input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={saving || !canUploadImage}
                  className="dashboard-file__input"
                />
                <label
                  htmlFor="product-image"
                  className={`dashboard-file__btn${saving ? ' dashboard-file__btn--disabled' : ''}`}
                >
                  Выбрать файл
                </label>
                <div className="dashboard-file__meta">
                  {imageFile?.name ? imageFile.name : 'Файл не выбран'}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Совместимость</label>
              <div className="dashboard-form-row">
                <button
                  type="button"
                  className={`btn ${form.compatibility_mode === 'BODY_TYPE' ? 'btn--primary' : 'btn--outline'}`}
                  disabled={saving || !canEditCompatibility}
                  onClick={() => requestModeSwitch('BODY_TYPE')}
                >
                  Кузов
                </button>
                <button
                  type="button"
                  className={`btn ${form.compatibility_mode === 'TECH_VARIANT' ? 'btn--primary' : 'btn--outline'}`}
                  disabled={saving || !canEditCompatibility}
                  onClick={() => requestModeSwitch('TECH_VARIANT')}
                >
                  Техника
                </button>
              </div>
            </div>

            {form.compatibility_mode === 'BODY_TYPE' ? (
              <>
                <div className="dashboard-form-row">
                  <div className="form-group">
                    <label>Поколение</label>
                    <SearchSelect
                      options={generationOptions}
                      value={bodyGenerationId}
                      onChange={(val) => {
                        setBodyGenerationId(String(val || ''));
                        setBodyTypeCandidate('');
                      }}
                      placeholder="Выберите поколение"
                      disabled={saving || refsLoading || !canEditCompatibility}
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
                  <div className="form-group">
                    <label>Тип кузова</label>
                    <SearchSelect
                      options={bodyTypeOptions}
                      value={bodyTypeCandidate}
                      onChange={(val) => setBodyTypeCandidate(String(val || ''))}
                      placeholder={bodyGenerationId ? 'Выберите тип кузова' : 'Сначала выберите поколение'}
                      disabled={saving || refsLoading || !bodyGenerationId || !canEditCompatibility}
                      withIcons={false}
                      searchable={false}
                    />
                  </div>
                </div>
                <div className="dashboard-form-row">
                  <button
                    type="button"
                    className="btn btn--outline"
                    disabled={saving || !bodyTypeCandidate || !canEditCompatibility}
                    onClick={() => {
                      if (!bodyTypeCandidate) return;
                      setSelectedBodyTypeIds((prev) =>
                        prev.includes(bodyTypeCandidate) ? prev : [...prev, bodyTypeCandidate],
                      );
                      setBodyTypeCandidate('');
                    }}
                  >
                    Добавить кузовную совместимость
                  </button>
                </div>
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label>Выбранные типы кузова</label>
                  {selectedBodyTypeIds.length === 0 ? (
                    <div className="text-muted">Пока ничего не добавлено</div>
                  ) : (
                    selectedBodyTypeIds.map((id) => {
                      const option = bodyTypeOptions.find((x) => String(x.value) === String(id))
                        || (bodyTypes || []).find((x) => String(x.id) === String(id));
                      const label = option?.label || option?.name_display || option?.name || `ID ${id}`;
                      return (
                        <div key={id} className="dashboard-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
                          <span>{label}</span>
                          <button
                            type="button"
                            className="btn btn--icon btn--danger"
                            onClick={() => setSelectedBodyTypeIds((prev) => prev.filter((x) => x !== id))}
                            title="Удалить совместимость"
                            disabled={saving || !canEditCompatibility}
                          >
                            🗑
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="dashboard-form-row">
                  <div className="form-group">
                    <label>Поколение</label>
                    <SearchSelect
                      options={generationOptions}
                      value={techGenerationId}
                      onChange={(val) => {
                        setTechGenerationId(String(val || ''));
                        setTechVariantCandidate('');
                      }}
                      placeholder="Выберите поколение"
                      disabled={saving || refsLoading || !canEditCompatibility}
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
                  <div className="form-group">
                    <label>Конфигурация</label>
                    <SearchSelect
                      options={techVariantOptions}
                      value={techVariantCandidate}
                      onChange={(val) => setTechVariantCandidate(String(val || ''))}
                      placeholder={techGenerationId ? 'Выберите конфигурацию' : 'Сначала выберите поколение'}
                      disabled={saving || refsLoading || !techGenerationId || !canEditCompatibility}
                      withIcons={false}
                    />
                  </div>
                </div>
                <div className="dashboard-form-row">
                  <button
                    type="button"
                    className="btn btn--outline"
                    disabled={saving || !techVariantCandidate || !canEditCompatibility}
                    onClick={() => {
                      if (!techVariantCandidate) return;
                      setSelectedTechVariantIds((prev) =>
                        prev.includes(techVariantCandidate) ? prev : [...prev, techVariantCandidate],
                      );
                      setTechVariantCandidate('');
                    }}
                  >
                    Добавить техническую совместимость
                  </button>
                </div>
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label>Выбранные конфигурации</label>
                  {selectedTechVariantIds.length === 0 ? (
                    <div className="text-muted">Пока ничего не добавлено</div>
                  ) : (
                    selectedTechVariantIds.map((id) => {
                      const option = techVariantOptions.find((x) => String(x.value) === String(id))
                        || (techVariants || []).find((x) => String(x.id) === String(id));
                      const label = option?.label || `${option?.engine_code || ''} ${option?.transmission_code || ''}`.trim() || `ID ${id}`;
                      return (
                        <div key={id} className="dashboard-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
                          <span>{label}</span>
                          <button
                            type="button"
                            className="btn btn--icon btn--danger"
                            onClick={() => setSelectedTechVariantIds((prev) => prev.filter((x) => x !== id))}
                            title="Удалить совместимость"
                            disabled={saving || !canEditCompatibility}
                          >
                            🗑
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            <div className="dashboard-modal__footer">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {initialProduct ? 'Сохранить изменения' : 'Создать товар'}
              </button>
              <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
      {modeSwitchConfirm && (
        <ConfirmModal
          title="Смена режима совместимости"
          message={
            modeSwitchConfirm.nextMode === 'BODY_TYPE'
              ? 'При переключении в режим "Кузов" текущие технические совместимости будут очищены. Продолжить?'
              : 'При переключении в режим "Техника" текущие кузовные совместимости будут очищены. Продолжить?'
          }
          confirmLabel="Переключить"
          cancelLabel="Отмена"
          onConfirm={() => {
            applyModeSwitch(modeSwitchConfirm.nextMode);
            setModeSwitchConfirm(null);
          }}
          onCancel={() => setModeSwitchConfirm(null)}
          busy={saving}
        />
      )}
    </div>
  );
}

export default ProductModalForm;

