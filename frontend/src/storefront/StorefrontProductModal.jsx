import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { CartControl, formatPriceRub, HeartButton, productImageUrl } from './catalogControls.jsx';
import { fitmentBadgeMeta } from './storefrontUtils.js';

function normalizeError(err) {
  const data = err?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  return 'Не удалось загрузить товар';
}

export default function StorefrontProductModal({
  productId,
  onClose,
  onAddToCart,
  onSetCartQty,
  cartQuantityByProduct,
  favoriteSet,
  onToggleFavorite,
}) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProduct(null);
    api
      .get(`products/${productId}/`)
      .then((res) => {
        if (!cancelled) setProduct(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(normalizeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!productId) return null;

  const compatLines = [];
  if (product) {
    (product.compatible_vehicles || []).forEach((x) => {
      if (typeof x === 'string' && x) compatLines.push(x);
    });
    (product.compatible_body_types || []).forEach((x) => {
      if (x && x.label) compatLines.push(x.label);
    });
    (product.compatible_tech_variants || []).forEach((x) => {
      if (x && x.label) compatLines.push(x.label);
    });
  }

  const pid = product?.id != null ? product.id : productId;
  const qty =
    pid != null
      ? cartQuantityByProduct?.[pid] ||
        cartQuantityByProduct?.[Number(pid)] ||
        cartQuantityByProduct?.[String(pid)] ||
        0
      : 0;
  const fav = pid != null ? favoriteSet?.has(Number(pid)) : false;
  const badge = product ? fitmentBadgeMeta(product.fitment_status) : null;
  const imgUrl = product ? productImageUrl(product.image) : null;

  return (
    <div className="sf-modal" role="dialog" aria-modal="true" aria-label="Карточка товара">
      <button type="button" className="sf-modal__backdrop" onClick={onClose} aria-label="Закрыть" />
      <div className="sf-modal__panel sf-modal__panel--product">
        <div className="sf-modal__head">
          <h2 className="sf-modal__title">{loading ? 'Загрузка…' : product?.name || 'Товар'}</h2>
          <button type="button" className="sf-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="sf-modal__body">
          {error && <div className="dashboard-alert">{error}</div>}
          {product && !loading && (
            <>
              <div className="sf-modal__hero">
                <div className="sf-modal__media" aria-hidden={!imgUrl}>
                  {imgUrl ? (
                    <img className="sf-modal__img" src={imgUrl} alt="" />
                  ) : (
                    <div className="sf-modal__img sf-modal__img--placeholder">Нет фото</div>
                  )}
                </div>
                <div className="sf-modal__summary">
                  <div className="sf-modal__actions">
                    <HeartButton filled={fav} onClick={() => onToggleFavorite?.(pid)} />
                    <CartControl productId={pid} qty={qty} onAdd={onAddToCart} onSetQty={onSetCartQty} />
                  </div>
                  <p className="sf-modal__muted">
                    Производитель: <strong>{product.brand_name || '—'}</strong>
                  </p>
                  <p>
                    Артикул: <strong>{product.sku}</strong>
                  </p>
                  <p className="sf-price sf-price--modal">
                    Цена:{' '}
                    <strong>
                      <span className="sf-price__value">{formatPriceRub(product.price)}</span>
                      <span className="sf-price__currency" aria-hidden>
                        {' '}
                        ₽
                      </span>
                    </strong>
                    <span className="sf-price__hint">руб.</span>
                  </p>
                  <p>
                    Остаток на складе: <strong>{product.stock}</strong>
                  </p>
                  {badge ? <p className={badge.className}>{badge.label}</p> : null}
                </div>
              </div>
              {product.description ? (
                <div className="sf-modal__desc">
                  <h3>Описание</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{product.description}</p>
                </div>
              ) : null}
              <div className="sf-modal__compat">
                <h3>Подходит к авто</h3>
                {compatLines.length ? (
                  <ul className="sf-modal__compat-list">
                    {compatLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="sf-modal__muted">Нет привязок по каталогу.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
