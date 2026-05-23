import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useClientShop } from './clientShopContext.js';
import ScrollToTopButton from './ScrollToTopButton.jsx';
import SupportChatWidget from './SupportChatWidget.jsx';

export default function ClientLayout() {
  const { cart, fav } = useClientShop();
  const location = useLocation();
  const cartQuantity = cart.cart.total_quantity || 0;
  const favoriteCount = fav.favorites.count || 0;
  const auth = typeof window !== 'undefined' && Boolean(window.__PUBLIC_CONFIG__?.isAuthenticated);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash, location.search]);

  const toTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className="header">
        <div className="header__container">
          <Link className="header__brand" to="/" aria-label="RideX — главная">
            <img src="/static/img/logo/logo small.png" alt="" className="header__brand-icon" />
            <span className="header__brand-text" aria-hidden="true">
              RideX
            </span>
          </Link>

          <button
            type="button"
            className={`header__menu-toggle${menuOpen ? ' header__menu-toggle--open' : ''}`}
            aria-expanded={menuOpen}
            aria-controls="client-header-panel"
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>

          <div id="client-header-panel" className={`header__panel${menuOpen ? ' header__panel--open' : ''}`}>
            <nav className="header__nav" aria-label="Основная навигация">
              <Link to="/catalog" className="nav-link">
                Каталог
              </Link>
              <Link to="/#delivery" className="nav-link">
                Доставка
              </Link>
              <Link to="/#about" className="nav-link">
                О нас
              </Link>
              <Link to="/#reviews" className="nav-link">
                Отзывы
              </Link>
              <Link to="/#faq" className="nav-link">
                FAQ
              </Link>
            </nav>

            <div className="header__actions">
              <Link to="/favorites" className="nav-pill">
                Избранное
                {favoriteCount > 0 ? <span className="cart-badge">{favoriteCount}</span> : null}
              </Link>
              <Link to="/cart" className="nav-pill nav-pill--cart">
                Корзина
                {cartQuantity > 0 ? <span className="cart-badge">{cartQuantity}</span> : null}
              </Link>

              {auth ? (
                <>
                  <Link to="/profile/" className="nav-pill">
                    Личный кабинет
                  </Link>
                  <Link to="/orders/my/" className="nav-pill">
                    Мои заказы
                  </Link>
                  <a href="/accounts/logout/" className="nav-pill nav-pill--accent">
                    Выйти
                  </a>
                </>
              ) : (
                <>
                  <a href="/accounts/register/" className="nav-pill">
                    Регистрация
                  </a>
                  <a href="/accounts/login/" className="nav-pill nav-pill--accent">
                    Вход
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer__container">
          <div className="footer__grid">
            <div className="footer__brand">
              <img src="/static/img/logo/logo biggest.png" alt="" className="footer__brand-icon" />
              <span className="footer__brand-text" aria-hidden="true">
                RideX
              </span>
            </div>

            <div className="footer__col">
              <div className="footer__title">Покупателям</div>
              <Link className="footer__link" to="/catalog" onClick={toTop}>
                Каталог
              </Link>
              <Link className="footer__link" to="/favorites" onClick={toTop}>
                Избранное
              </Link>
              <Link className="footer__link" to="/cart" onClick={toTop}>
                Корзина
              </Link>
              {auth ? (
                <Link className="footer__link" to="/orders/my/" onClick={toTop}>
                  Мои заказы
                </Link>
              ) : (
                <a className="footer__link" href="/accounts/login/" onClick={toTop}>
                  Вход
                </a>
              )}
            </div>

            <div className="footer__col">
              <div className="footer__title">Контакты</div>
              <div className="footer__text">+7 (999) 999-99-99</div>
              <div className="footer__text">info@ridex.ru</div>
            </div>
          </div>

          <div className="footer__bottom">
            <div className="footer__muted">RideX © {new Date().getFullYear()}</div>
          </div>
        </div>
      </footer>

      <ScrollToTopButton />
      <SupportChatWidget />
    </>
  );
}
