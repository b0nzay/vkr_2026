import React from 'react';

export function formatPriceRub(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function productImageUrl(imageField) {
  if (!imageField) return null;
  if (typeof imageField === 'string') {
    const s = imageField.trim();
    if (!s) return null;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('/')) return s;
    return `/${s}`;
  }
  return null;
}

export function HeartButton({ filled, onClick }) {
  return (
    <button
      type="button"
      className={`sf-card__fav${filled ? ' sf-card__fav--on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={filled ? 'Убрать из избранного' : 'В избранное'}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path
          fill={filled ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          d="M12 20s-7-4.35-7-10a4.5 4.5 0 0 1 7.86-3 4.5 4.5 0 0 1 7.14 3c0 5.65-8 10-8 10z"
        />
      </svg>
    </button>
  );
}

export function CartControl({ productId, qty, onAdd, onSetQty }) {
  if (!qty) {
    return (
      <button
        type="button"
        className="btn btn--primary btn--small sf-card__cart-btn"
        onClick={(e) => {
          e.stopPropagation();
          onAdd(productId);
        }}
      >
        В корзину
      </button>
    );
  }
  return (
    <div className="sf-qty" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="sf-qty__btn" onClick={() => onSetQty(productId, qty - 1)}>
        −
      </button>
      <span className="sf-qty__val">{qty}</span>
      <button type="button" className="sf-qty__btn" onClick={() => onSetQty(productId, qty + 1)}>
        +
      </button>
    </div>
  );
}
