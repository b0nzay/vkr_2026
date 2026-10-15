import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';

const STATUS_LABELS = {
  NEW: 'Создан',
  PROCESSING: 'В обработке',
  READY_FOR_PICKUP: 'Готов к выдаче',
  COMPLETED: 'Завершён',
  CANCELED: 'Отменён',
};

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('orders/')
      .then((response) => setOrders(response.data))
      .catch((error) => {
        console.error('Failed to load orders', error);
      });
  }, []);

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <h2 className="dashboard-card__title">Заказы</h2>
      </div>
      <div className="dashboard-card__body">
        {orders.length === 0 ? (
          <p>Заказы пока не найдены.</p>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Клиент</th>
                <th>Статус</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const statusKey = String(order.status || '').toLowerCase();
                return (
                  <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => navigate(String(order.id))}>
                    <td>
                      #{order.id}
                    </td>
                    <td>{order.user_username}</td>
                    <td>
                      <span className={`dashboard-badge dashboard-badge--${statusKey}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td>{order.created_at || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default OrdersPage;

