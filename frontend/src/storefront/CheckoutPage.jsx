import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPriceRub } from './catalogControls.jsx';

function readApiErrorMessage(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data?.detail === 'string') return data.detail;
  return fallback;
}

export default function CheckoutPage({ cart, onCheckout, checkoutSuccess, validateCheckout, reloadCart }) {
  const navigate = useNavigate();
  const isAuth = typeof window !== 'undefined' && Boolean(window.__PUBLIC_CONFIG__?.isAuthenticated);
  const hasConflicts = cart.items.some((item) => item.fitment_status === 'conflict');
  const [paymentModalMode, setPaymentModalMode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [precheckBusy, setPrecheckBusy] = useState(false);
  const [stockModalErrors, setStockModalErrors] = useState(null);
  const [genericModalMessage, setGenericModalMessage] = useState(null);

  const summaryText = useMemo(() => {
    return `Позиций: ${cart.total_quantity}, сумма: ${formatPriceRub(cart.total_price)} ₽`;
  }, [cart.total_quantity, cart.total_price]);

  const openStockModalFromResponse = async (data) => {
    if (reloadCart) {
      try {
        await reloadCart();
      } catch {
        /* ignore */
      }
    }
    setStockModalErrors(Array.isArray(data?.stock_errors) ? data.stock_errors : []);
  };

  const beginCheckout = async (modalMode) => {
    if (cart.items.length === 0 || precheckBusy) return;
    setGenericModalMessage(null);
    setPrecheckBusy(true);
    try {
      await validateCheckout({ allowConflicts: modalMode === 'allow-conflicts' });
      setPaymentModalMode(modalMode);
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 && Array.isArray(data?.stock_errors)) {
        await openStockModalFromResponse(data);
        return;
      }
      setGenericModalMessage(readApiErrorMessage(err, 'Не удалось проверить заказ. Попробуйте ещё раз.'));
    } finally {
      setPrecheckBusy(false);
    }
  };

  const submitOrder = async (allowConflicts) => {
    setSubmitting(true);
    try {
      await onCheckout(allowConflicts);
      setPaymentModalMode(null);
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 && Array.isArray(data?.stock_errors)) {
        setPaymentModalMode(null);
        await openStockModalFromResponse(data);
        return;
      }
      setPaymentModalMode(null);
      setGenericModalMessage(readApiErrorMessage(err, 'Не удалось оформить заказ. Попробуйте ещё раз.'));
    } finally {
      setSubmitting(false);
    }
  };

  const goToCartFromStockModal = () => {
    setStockModalErrors(null);
    navigate('/cart');
  };

  return (
    <section className="sf-checkout">
      <h2>Оформление заказа</h2>
      {!isAuth ? (
        <div className="sf-modal">
          <button type="button" className="sf-modal__backdrop" aria-label="Закрыть" onClick={() => navigate('/cart')} />
          <div className="sf-modal__panel">
            <div className="sf-modal__head">
              <h3 className="sf-modal__title">Требуется вход в аккаунт</h3>
            </div>
            <div className="sf-modal__body">
              <p className="home-text home-text--muted">Чтобы оформить заказ, войдите в аккаунт или зарегистрируйтесь.</p>
              <div className="profile-page__card-actions">
                <a href="/accounts/login/?next=/checkout/" className="btn btn--primary">
                  Вход
                </a>
                <a href="/accounts/register/?next=/checkout/" className="btn btn--outline">
                  Регистрация
                </a>
                <button type="button" className="btn btn--muted" onClick={() => navigate('/cart')}>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {checkoutSuccess ? (
        <div className="sf-modal">
          <button type="button" className="sf-modal__backdrop" aria-label="Закрыть" onClick={() => navigate('/catalog')} />
          <div className="sf-modal__panel">
            <div className="sf-modal__head">
              <h3 className="sf-modal__title">Спасибо за заказ!</h3>
            </div>
            <div className="sf-modal__body">
              <p className="home-text home-text--muted">Заказ #{checkoutSuccess.order_id} успешно создан. Корзина очищена.</p>
              <div className="profile-page__card-actions">
                <Link to="/catalog" className="btn btn--primary">
                  Вернуться в каталог
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="table-scroll table-scroll--checkout">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Кол-во</th>
                  <th>Цена</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {(cart.items || []).map((item) => (
                  <tr key={item.product_id}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatPriceRub(item.unit_price)} ₽</td>
                    <td>{formatPriceRub(item.total_price)} ₽</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}>
                    <strong>Итого ({cart.total_quantity} поз.)</strong>
                  </td>
                  <td>
                    <strong>{formatPriceRub(cart.total_price)} ₽</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="sf-checkout__actions">
            <button type="button" className="btn btn--muted" disabled={precheckBusy} onClick={() => navigate('/cart')}>
              Назад в корзину
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => beginCheckout('safe')}
              disabled={cart.items.length === 0 || hasConflicts || precheckBusy}
            >
              {precheckBusy ? 'Проверка…' : 'Оформить заказ'}
            </button>
          </div>
          {hasConflicts && (
            <button
              type="button"
              className="btn btn--muted"
              disabled={precheckBusy}
              onClick={() => beginCheckout('allow-conflicts')}
            >
              {precheckBusy ? 'Проверка…' : 'Оформить с несовместимыми позициями'}
            </button>
          )}
          {paymentModalMode ? (
            <div className="sf-modal">
              <button type="button" className="sf-modal__backdrop" aria-label="Закрыть" onClick={() => setPaymentModalMode(null)} />
              <div className="sf-modal__panel">
                <div className="sf-modal__head">
                  <h3 className="sf-modal__title">Упрощённое оформление</h3>
                </div>
                <div className="sf-modal__body">
                  <p className="home-text home-text--muted">
                    В учебной версии нет онлайн-оплаты: нажатие «Оплатить» сразу создаёт заказ. {summaryText}
                  </p>
                  <div className="profile-page__card-actions">
                    <button type="button" className="btn btn--muted" disabled={submitting} onClick={() => navigate('/cart')}>
                      Отмена
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={submitting}
                      onClick={() => submitOrder(paymentModalMode === 'allow-conflicts')}
                    >
                      {submitting ? 'Создание…' : 'Оплатить'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {stockModalErrors !== null ? (
            <div className="sf-modal">
              <button type="button" className="sf-modal__backdrop" aria-label="Закрыть" onClick={goToCartFromStockModal} />
              <div className="sf-modal__panel">
                <div className="sf-modal__head">
                  <h3 className="sf-modal__title">Недостаточно товара на складе</h3>
                </div>
                <div className="sf-modal__body">
                  <p className="home-text home-text--muted">
                    По одной или нескольким позициям на складе сейчас меньше единиц, чем указано в заказе. Откройте корзину и
                    уменьшите количество либо удалите позиции, которых нет в наличии.
                  </p>
                  {stockModalErrors.length > 0 ? (
                    <ul className="home-text home-text--muted sf-checkout__stock-list">
                      {stockModalErrors.map((row) => (
                        <li key={row.product_id}>
                          «{row.product_name}»: в заказе {row.requested} шт., доступно {row.available} шт.
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="profile-page__card-actions">
                    <button type="button" className="btn btn--primary" onClick={goToCartFromStockModal}>
                      Перейти в корзину
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {genericModalMessage ? (
            <div className="sf-modal">
              <button
                type="button"
                className="sf-modal__backdrop"
                aria-label="Закрыть"
                onClick={() => setGenericModalMessage(null)}
              />
              <div className="sf-modal__panel">
                <div className="sf-modal__head">
                  <h3 className="sf-modal__title">Оформление заказа</h3>
                </div>
                <div className="sf-modal__body">
                  <p className="home-text home-text--muted">{genericModalMessage}</p>
                  <div className="profile-page__card-actions">
                    <button type="button" className="btn btn--primary" onClick={() => setGenericModalMessage(null)}>
                      Понятно
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
