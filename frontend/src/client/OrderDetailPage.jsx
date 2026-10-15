import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useLocation } from 'react-router-dom';
import api from '../api/client.js';
import { formatPriceRub } from '../storefront/catalogControls.jsx';
import { formatOrderDate, orderStatusClass, orderStatusLabel } from './orderUtils.js';

function normalizeError(err, fallback) {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (typeof d?.detail === 'string') return d.detail;
  return fallback;
}

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const numericId = Number(orderId);
  const auth = typeof window !== 'undefined' && Boolean(window.__PUBLIC_CONFIG__?.isAuthenticated);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const validId = Number.isInteger(numericId) && numericId > 0;

  useEffect(() => {
    if (!auth) {
      const next = encodeURIComponent(`${location.pathname}${location.search || ''}`);
      window.location.replace(`/accounts/login/?next=${next}`);
      return;
    }
    if (!validId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`orders/${numericId}/`);
        if (!cancelled) setOrder(res.data);
      } catch (err) {
        if (!cancelled) setError(normalizeError(err, 'Заказ не найден или нет доступа'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, validId, numericId, location.pathname, location.search]);

  const total = useMemo(() => {
    if (!order?.items?.length) return 0;
    return order.items.reduce((sum, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.unit_price) || 0;
      return sum + q * p;
    }, 0);
  }, [order]);

  if (!auth) {
    return (
      <div className="page-header">
        <p className="home-text home-text--muted">Перенаправление на страницу входа…</p>
      </div>
    );
  }

  if (!validId) {
    return <Navigate to="/orders/my/" replace />;
  }

  if (loading) {
    return (
      <div className="page-header">
        <p className="home-text home-text--muted">Загрузка заказа…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="page-header">
        <div className="dashboard-alert">{error || 'Заказ не найден'}</div>
        <Link to="/orders/my/" className="btn btn--outline">
          К списку заказов
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Заказ #{order.id}</h1>
        <div className="page-header__meta">
          <span className={orderStatusClass(order.status)}>{orderStatusLabel(order.status)}</span>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Информация о заказе</h2>
        </div>
        <div className="order-info">
          <div className="order-info__row">
            <span className="order-info__label">Дата создания:</span>
            <span className="order-info__value">{formatOrderDate(order.created_at)}</span>
          </div>
          <div className="order-info__row">
            <span className="order-info__label">Последнее обновление:</span>
            <span className="order-info__value">{formatOrderDate(order.updated_at)}</span>
          </div>
          <div className="order-info__row">
            <span className="order-info__label">Статус:</span>
            <span className="order-info__value">
              <span className={orderStatusClass(order.status)}>{orderStatusLabel(order.status)}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Товары в заказе</h2>
        </div>
        <div className="table-scroll table-scroll--order">
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th>Артикул</th>
                <th>Цена за шт.</th>
                <th>Количество</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.product_name}</strong>
                  </td>
                  <td>
                    <span className="text-muted">{item.product_sku}</span>
                  </td>
                  <td>{formatPriceRub(item.unit_price)} ₽</td>
                  <td>{item.quantity}</td>
                  <td>
                    <strong>{formatPriceRub(Number(item.quantity) * Number(item.unit_price))} ₽</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right' }}>
                  <strong>Итого:</strong>
                </td>
                <td>
                  <strong>{formatPriceRub(total)} ₽</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="order-actions">
        <Link to="/orders/my/" className="btn btn--outline">
          Вернуться к заказам
        </Link>
      </div>
    </>
  );
}
