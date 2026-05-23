import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { apiPhoneToDisplay, onPhoneInputChange, phoneToApi } from '../utils/phoneMask.js';
import { formatOrderDate, orderStatusClass, orderStatusLabel } from './orderUtils.js';

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function formatErr(err, fallback) {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (typeof d.detail === 'string') return d.detail;
  if (Array.isArray(d.detail)) return d.detail.join(' ');
  return fallback;
}

export default function ProfilePage() {
  const auth = typeof window !== 'undefined' && Boolean(window.__PUBLIC_CONFIG__?.isAuthenticated);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, o, r] = await Promise.all([
        api.get('profile/'),
        api.get('orders/'),
        api.get('profile/reviews/').catch(() => ({ data: [] })),
      ]);
      setProfile(p.data);
      setFirstName(p.data.first_name || '');
      setLastName(p.data.last_name || '');
      setPhone(apiPhoneToDisplay(p.data.phone || ''));
      setEmail(p.data.email || '');
      setOrders(normalizeList(o.data).slice(0, 5));
      setReviews(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setError(formatErr(e, 'Не удалось загрузить данные'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      window.location.replace(`/accounts/login/?next=${encodeURIComponent('/profile/')}`);
      return;
    }
    loadAll();
  }, [auth, loadAll]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await api.patch('profile/', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phoneToApi(phone),
        email: email.trim(),
      });
      setProfileMsg({ type: 'ok', text: 'Профиль сохранён.' });
      await loadAll();
    } catch (err) {
      setProfileMsg({ type: 'err', text: formatErr(err, 'Ошибка сохранения') });
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwSaving(true);
    setPwMsg(null);
    try {
      await api.post('profile/change-password/', {
        old_password: oldPassword,
        new_password1: password1,
        new_password2: password2,
      });
      setPwMsg({ type: 'ok', text: 'Пароль изменён.' });
      setOldPassword('');
      setPassword1('');
      setPassword2('');
    } catch (err) {
      setPwMsg({ type: 'err', text: formatErr(err, 'Не удалось сменить пароль') });
    } finally {
      setPwSaving(false);
    }
  };

  const deleteReview = async (id) => {
    if (!window.confirm('Удалить отзыв?')) return;
    try {
      await api.delete(`storefront/reviews/${id}/`);
      setReviews((list) => list.filter((x) => x.id !== id));
    } catch (err) {
      setError(formatErr(err, 'Не удалось удалить отзыв'));
    }
  };

  if (!auth) {
    return (
      <div className="page-header">
        <p className="home-text home-text--muted">Перенаправление…</p>
      </div>
    );
  }

  if (loading && !profile) {
    return (
      <div className="page-header">
        <p className="home-text home-text--muted">Загрузка…</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="page-header">
        <div className="dashboard-alert">{error}</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Личный кабинет</h1>
        <p className="home-text home-text--muted">Привет, {profile?.username}</p>
      </div>

      {error ? <div className="dashboard-alert">{error}</div> : null}

      <div className="profile-page__grid">
        <section className="profile-page__card">
          <h2>Контактные данные</h2>
          {profileMsg ? (
            <p className={profileMsg.type === 'ok' ? 'profile-page__msg profile-page__msg--ok' : 'profile-page__msg profile-page__msg--err'}>
              {profileMsg.text}
            </p>
          ) : null}
          {!profile?.email_verified ? (
            <p className="home-text home-text--muted">Подтвердите email по ссылке из письма — иначе вход будет заблокирован.</p>
          ) : null}
          <form className="profile-form" onSubmit={saveProfile}>
            <label className="form-group">
              <span className="profile-form__label">Имя</span>
              <input
                className="profile-form__input"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="form-group">
              <span className="profile-form__label">Фамилия</span>
              <input
                className="profile-form__input"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
            <label className="form-group">
              <span className="profile-form__label">Телефон</span>
              <input
                className="profile-form__input"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="+7 (999) 999-99-99"
                value={phone}
                onChange={(e) => setPhone(onPhoneInputChange(e.target.value))}
              />
            </label>
            <label className="form-group">
              <span className="profile-form__label">Email</span>
              <input
                className="profile-form__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={profileSaving}>
              {profileSaving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </form>
        </section>

        <section className="profile-page__card">
          <h2>Смена пароля</h2>
          {pwMsg ? (
            <p className={pwMsg.type === 'ok' ? 'profile-page__msg profile-page__msg--ok' : 'profile-page__msg profile-page__msg--err'}>
              {pwMsg.text}
            </p>
          ) : null}
          <form className="profile-form" onSubmit={savePassword}>
            <label className="form-group">
              <span className="profile-form__label">Текущий пароль</span>
              <input
                className="profile-form__input"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="form-group">
              <span className="profile-form__label">Новый пароль</span>
              <input
                className="profile-form__input"
                type="password"
                value={password1}
                onChange={(e) => setPassword1(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="form-group">
              <span className="profile-form__label">Повторите новый пароль</span>
              <input
                className="profile-form__input"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={pwSaving}>
              {pwSaving ? 'Сохранение…' : 'Сменить пароль'}
            </button>
          </form>
        </section>

        <section className="profile-page__card">
          <h2>Заказы</h2>
          {orders.length ? (
            <ul className="profile-page__orders">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link to={`/orders/${o.id}/`}>
                    №{o.id} · {formatOrderDate(o.created_at)}{' '}
                    <span className={orderStatusClass(o.status)}>{orderStatusLabel(o.status)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="home-text home-text--muted">Заказов пока нет.</p>
          )}
          <div className="profile-page__card-actions">
            <Link className="btn btn--muted" to="/orders/my/">
              Все заказы
            </Link>
          </div>
        </section>

        <section className="profile-page__card profile-page__card--wide">
          <h2>Мои отзывы</h2>
          {reviews.length ? (
            <ul className="profile-page__reviews">
              {reviews.map((r) => (
                <li key={r.id} className="profile-page__review-row">
                  <div>
                    {r.rating ? <span className="home-reviews__stars">{'★'.repeat(r.rating)}</span> : null}{' '}
                    {r.text?.trim() || <span className="home-text--muted">без текста</span>}
                  </div>
                  <button type="button" className="btn btn--small btn--muted" onClick={() => deleteReview(r.id)}>
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="home-text home-text--muted">Вы ещё не оставляли отзывов.</p>
          )}
        </section>
      </div>
    </div>
  );
}
