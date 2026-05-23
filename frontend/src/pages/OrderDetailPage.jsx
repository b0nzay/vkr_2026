import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import SearchSelect from '../components/common/SearchSelect.jsx';

const ORDER_STATUSES = [
  { value: 'NEW', label: 'Создан' },
  { value: 'PROCESSING', label: 'В обработке' },
  { value: 'READY_FOR_PICKUP', label: 'Готов к выдаче' },
  { value: 'COMPLETED', label: 'Завершён' },
  { value: 'CANCELED', label: 'Отменён' },
];

function OrderDetailPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`orders/${orderId}/`)
      .then((response) => setOrder(response.data))
      .catch((err) => {
        console.error('Failed to load order', err);
        setError('Не удалось загрузить заказ');
      });

    api
      .get('messages/', { params: { order_id: orderId } })
      .then((response) => setMessages(response.data))
      .catch((err) => {
        console.error('Failed to load messages', err);
        setError('Не удалось загрузить сообщения');
      });
  }, [orderId]);

  const handleSend = (event) => {
    event.preventDefault();
    if (!text.trim()) return;

    api
      .post('messages/', { order: orderId, text })
      .then((response) => {
        setMessages((prev) => [...prev, response.data]);
        setText('');
      })
      .catch((err) => {
        console.error('Failed to send message', err);
        setError('Не удалось отправить сообщение');
      });
  };

  const handleStatusChange = (event) => {
    const newStatus = event.target.value;
    if (!order || newStatus === order.status) return;

    setStatusUpdating(true);
    setError(null);

    api
      .patch(`orders/${order.id}/status/`, { status: newStatus })
      .then((response) => {
        setOrder(response.data);
      })
      .catch((err) => {
        console.error('Failed to update status', err);
        setError('Не удалось изменить статус заказа');
      })
      .finally(() => {
        setStatusUpdating(false);
      });
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <h2 className="dashboard-card__title">
          {order ? `Заказ #${order.id}` : 'Загрузка заказа...'}
        </h2>
      </div>
      <div className="dashboard-card__body">
        {error && <div className="dashboard-alert">{error}</div>}

        {!order ? (
          <p>Загрузка...</p>
        ) : (
          <>
            <div className="form-row" style={{ marginBottom: '20px' }}>
              <div className="form-group" style={{ minWidth: 320 }}>
                <label>Заказчик</label>
                <div className="dash-modal-control" style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
                  {order.customer_name || order.user_username || 'Не указано'}
                </div>
              </div>
              <div className="form-group" style={{ minWidth: 260 }}>
                <label>Телефон</label>
                <div className="dash-modal-control" style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
                  {order.customer_phone || 'Не указан'}
                </div>
              </div>
              <div className="form-group" style={{ minWidth: 280 }}>
                <label>Email</label>
                <div className="dash-modal-control" style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
                  {order.customer_email || 'Не указан'}
                </div>
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: '20px' }}>
              <div className="form-group" style={{ maxWidth: 320 }}>
                <label>Статус</label>
                <SearchSelect
                  options={ORDER_STATUSES}
                  value={order.status}
                  onChange={(val) => handleStatusChange({ target: { value: val } })}
                  placeholder="Выберите статус"
                  withIcons={false}
                  searchable={false}
                  disabled={statusUpdating}
                />
              </div>
            </div>

            <h3>Товары</h3>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>SKU</th>
                  <th>Количество</th>
                  <th>Цена</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>{item.product_sku}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unit_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Сообщения</h3>
            <div style={{ marginBottom: '16px' }}>
              {messages.length === 0 ? (
                <p>Сообщений пока нет.</p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} style={{ marginBottom: '8px' }}>
                    <strong>{message.author_username}:</strong> {message.text}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSend}>
              <div className="form-group">
                <label htmlFor="new-message">Новое сообщение</label>
                <textarea
                  id="new-message"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                />
              </div>
              <button type="submit" className="btn btn--primary">
                Отправить
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default OrderDetailPage;

