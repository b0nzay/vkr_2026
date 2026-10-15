import React from 'react';
import { Link } from 'react-router-dom';
import { formatPriceRub } from './catalogControls.jsx';

function HeartIllustration() {
  return (
    <div className="sf-favorites__empty-icon" aria-hidden>
      <svg viewBox="0 0 64 64" width="56" height="56">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          d="M32 52S12 40 12 26a10 10 0 0 1 17.3-6.9l2.7 2.6 2.7-2.6A10 10 0 0 1 52 26c0 14-20 26-20 26z"
        />
      </svg>
    </div>
  );
}

export default function FavoritesPage({ favorites, loading, error, onRemove }) {
  return (
    <div className="sf-favorites">
      <div className="sf-favorites__hero">
        <h1 className="sf-favorites__title">Избранное</h1>
        <p className="sf-favorites__subtitle">Товары, которые вы отметили в каталоге</p>
      </div>

      {error && <div className="dashboard-alert">{error}</div>}

      {loading ? (
        <p className="sf-favorites__loading">Загрузка…</p>
      ) : !favorites.items?.length ? (
        <div className="sf-favorites__empty">
          <HeartIllustration />
          <p className="sf-favorites__empty-text">Пока пусто. Добавляйте товары сердечком в каталоге.</p>
          <Link to="/catalog" className="btn btn--primary sf-favorites__empty-cta">
            В каталог
          </Link>
        </div>
      ) : (
        <div className="sf-favorites__grid">
          {favorites.items.map((item) => (
            <article key={item.id} className="sf-fav-card">
              <div className="sf-fav-card__body">
                <Link to={`/catalog?${new URLSearchParams({ q: item.sku }).toString()}`} className="sf-fav-card__name">
                  {item.name}
                </Link>
                <div className="sf-fav-card__sku">Артикул {item.sku}</div>
                <div className="sf-fav-card__price">
                  {formatPriceRub(item.price)} ₽ <span className="sf-price__hint">руб.</span>
                </div>
                {item.stock != null ? (
                  <div className={`sf-fav-card__stock${item.stock > 0 ? ' sf-fav-card__stock--ok' : ''}`}>
                    {item.stock > 0 ? `В наличии: ${item.stock}` : 'Нет в наличии'}
                  </div>
                ) : null}
              </div>
              <div className="sf-fav-card__actions">
                <button type="button" className="btn btn--outline btn--small sf-fav-card__remove" onClick={() => onRemove(item.id)}>
                  Убрать
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {favorites.items?.length ? (
        <p className="sf-favorites__back">
          <Link to="/catalog" className="sf-link">
            Продолжить покупки в каталоге
          </Link>
        </p>
      ) : null}
    </div>
  );
}
