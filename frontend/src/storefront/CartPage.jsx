import React from 'react';
import { Link } from 'react-router-dom';
import { formatPriceRub } from './catalogControls.jsx';
import { fitmentBadgeMeta } from './storefrontUtils.js';

export default function CartPage({ cart, loading, error, onQtyChange, onRemove, onClear }) {
  if (loading) return <p>Загрузка корзины...</p>;
  return (
    <section className="sf-cart">
      <h2>Корзина</h2>
      {error && <div className="dashboard-alert">{error}</div>}
      {cart.items.length === 0 ? (
        <p>Корзина пуста.</p>
      ) : (
        <>
          <div className="sf-cart__list">
            {cart.items.map((item) => {
              const badge = fitmentBadgeMeta(item.fitment_status);
              return (
                <div key={item.product_id} className="sf-cart__row">
                  <div>
                    <strong>{item.product_name}</strong>
                    <div className="sf-sku">{item.product_sku}</div>
                  </div>
                  <div className={badge.className}>{badge.label}</div>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => onQtyChange(item.product_id, e.target.value)}
                  />
                  <div>
                    {formatPriceRub(item.total_price)} ₽
                  </div>
                  <button type="button" className="btn btn--small" onClick={() => onRemove(item.product_id)}>
                    Удалить
                  </button>
                </div>
              );
            })}
          </div>
          <div className="sf-cart__footer">
            <strong>Итого: {formatPriceRub(cart.total_price)} ₽</strong>
            <div className="sf-cart__footer-actions">
              <Link className="btn btn--primary" to="/checkout">
                Оформить заказ
              </Link>
              <button type="button" className="btn btn--muted" onClick={onClear}>
                Очистить корзину
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
