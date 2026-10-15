import React from 'react';
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';

function joinPath(base, path) {
  if (!path) return base;
  if (base.endsWith('/')) base = base.slice(0, -1);
  if (!path.startsWith('/')) path = `/${path}`;
  return `${base}${path}`;
}

export function DashboardHome({ profile, loading }) {
  if (loading) return <p>Загрузка профиля...</p>;
  if (!profile) {
    return <p>Нет доступа к dashboard (профиль не загружен).</p>;
  }

  const groups = profile.groups || [];
  if (groups.includes('Администратор')) return <Navigate to="/admin" replace />;
  if (groups.includes('Менеджер')) return <Navigate to="/manager" replace />;

  window.location.href = '/';
  return null;
}

export function RequireGroup({ profile, loading, allowedGroups, children }) {
  if (loading) return <p>Загрузка профиля...</p>;
  if (!profile) return <p>Нет доступа.</p>;

  const groups = profile.groups || [];
  const ok = allowedGroups.some((g) => groups.includes(g));
  if (!ok) {
    return <p>Доступ запрещён.</p>;
  }
  return children;
}

export function AdminLayout() {
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-header__inner">
          <div className="dashboard-header__top">
            <div className="dashboard-header__brand">
              <Link to="/" className="dashboard-header__brand">
                <img
                  src="/static/img/logo/logo small.png"
                  alt=""
                  className="dashboard-header__brand-logo"
                />
                <span className="dashboard-header__brand-text">RideX Backoffice</span>
              </Link>
            </div>
            <div className="dashboard-header__actions">
              <a href="/" className="nav-pill">
                В магазин
              </a>
              <a href="/accounts/logout/" className="nav-pill nav-pill--accent">
                Выйти
              </a>
            </div>
          </div>
          <nav className="dashboard-header__nav" aria-label="Навигация админ-панели">
            <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Заказы
            </NavLink>
            <NavLink to="/admin/support" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Чаты
            </NavLink>
            <NavLink to="/admin/products" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Товары
            </NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Пользователи
            </NavLink>
            <NavLink to="/admin/categories" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Категории
            </NavLink>
            <NavLink to="/admin/cars" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')} end>
              Авто
            </NavLink>
            <NavLink to="/admin/tech" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Конфигурации
            </NavLink>
            <NavLink to="/admin/promotions" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Акции
            </NavLink>
            <NavLink to="/admin/faq" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              FAQ
            </NavLink>
            <NavLink to="/admin/site-content" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Тексты главной
            </NavLink>
            <NavLink to="/admin/reviews" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Отзывы
            </NavLink>
            <NavLink to="/admin/stats" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Статистика
            </NavLink>
            <NavLink to="/admin/logs" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Логи
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="dashboard-main">
        <div className="dashboard-main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function ManagerLayout() {
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-header__inner">
          <div className="dashboard-header__top">
            <div className="dashboard-header__brand">
              <Link to="/" className="dashboard-header__brand">
                <img
                  src="/static/img/logo/logo small.png"
                  alt=""
                  className="dashboard-header__brand-logo"
                />
                <span className="dashboard-header__brand-text">Панель менеджера</span>
              </Link>
            </div>
            <div className="dashboard-header__actions">
              <a href="/" className="nav-pill">
                В магазин
              </a>
              <a href="/accounts/logout/" className="nav-pill nav-pill--accent">
                Выйти
              </a>
            </div>
          </div>
          <nav className="dashboard-header__nav" aria-label="Навигация панели менеджера">
            <NavLink to="/manager/orders" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Заказы
            </NavLink>
            <NavLink to="/manager/support" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Чаты
            </NavLink>
            <NavLink to="/manager/products" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Товары
            </NavLink>
            <NavLink to="/manager/categories" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Категории
            </NavLink>
            <NavLink to="/manager/cars" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')} end>
              Авто
            </NavLink>
            <NavLink to="/manager/tech" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Конфигурации
            </NavLink>
            <NavLink to="/manager/promotions" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Акции
            </NavLink>
            <NavLink to="/manager/faq" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              FAQ
            </NavLink>
            <NavLink to="/manager/site-content" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Тексты главной
            </NavLink>
            <NavLink to="/manager/reviews" className={({ isActive }) => (isActive ? 'dashboard-nav__link dashboard-nav__link--active' : 'dashboard-nav__link')}>
              Отзывы
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="dashboard-main">
        <div className="dashboard-main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

