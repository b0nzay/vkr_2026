import React, { useEffect, useState } from 'react';
import api from '../api/client.js';

function AdminStatsPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('admin-stats/')
      .then((response) => setStats(response.data))
      .catch((err) => {
        console.error('Failed to load admin stats', err);
        setError('Не удалось загрузить статистику');
      });
  }, []);

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  if (!stats) {
    return <p>Загрузка статистики...</p>;
  }

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <h2 className="dashboard-card__title">Статистика</h2>
      </div>
      <div className="dashboard-card__body">
        <div className="dashboard-main__stats-grid">
          <div className="dashboard-card">
            <div className="dashboard-card__header">
              <h3 className="dashboard-card__title">Заказы</h3>
            </div>
            <div className="dashboard-card__body">
              <p>Всего заказов: {stats.total_orders}</p>
              <p>Сумма продаж: {stats.total_revenue}</p>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card__header">
              <h3 className="dashboard-card__title">Пользователи</h3>
            </div>
            <div className="dashboard-card__body">
              <p>Всего пользователей: {stats.total_users}</p>
              <h4>По ролям</h4>
              <ul>
                {stats.users_by_role.map((item) => (
                  <li key={item.role}>
                    {item.role}: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card__header">
              <h3 className="dashboard-card__title">Заказы по статусам</h3>
            </div>
            <div className="dashboard-card__body">
              <ul>
                {stats.orders_by_status.map((item) => (
                  <li key={item.status}>
                    {item.status}: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminStatsPage;

