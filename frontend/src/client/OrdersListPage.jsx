import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { formatOrderDate, orderStatusClass, orderStatusLabel } from './orderUtils.js';

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function normalizeError(err, fallback) {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (typeof d?.detail === 'string') return d.detail;
  return fallback;
}

export default function OrdersListPage() {
  const auth = typeof window !== 'undefined' && Boolean(window.__PUBLIC_CONFIG__?.isAuthenticated);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth) {
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search || ''}`);
      window.location.replace(`/accounts/login/?next=${next}`);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('orders/');
        if (!cancelled) setOrders(normalizeList(res.data));
      } catch (err) {
        if (!cancelled) setError(normalizeError(err, 'Не удалось загрузить заказы'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  if (!auth) {
    return (
      <div className="page-header">
        <p className="home-text home-text--muted">Перенаправление на страницу входа…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-header">
        <p className="home-text home-text--muted">Загрузка заказов…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-header">
        <div className="dashboard-alert">{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Мои заказы</h1>
      </div>

      {orders.length > 0 ? (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="card order-card">
              <div className="order-card__header">
                <div className="order-card__info">
                  <h3 className="order-card__title">
                    <Link to={`/orders/${order.id}/`}>Заказ #{order.id}</Link>
                  </h3>
                  <p className="order-card__date">Создан: {formatOrderDate(order.created_at)}</p>
                </div>
                <div className="order-card__status">
                  <span className={orderStatusClass(order.status)}>{orderStatusLabel(order.status)}</span>
                </div>
              </div>
              <div className="order-card__footer">
                <Link to={`/orders/${order.id}/`} className="btn btn--outline">
                  Подробнее
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state__icon">📋</div>
          <p className="empty-state__text">У вас пока нет заказов</p>
          <p>Оформите первый заказ из каталога товаров.</p>
          <Link to="/catalog/" className="btn btn--primary">
            Перейти в каталог
          </Link>
        </div>
      )}
    </>
  );
}
