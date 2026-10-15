import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client.js';
import VehicleFilterSelects from '../storefront/VehicleFilterSelects.jsx';
import { HOME_CATEGORY_IMAGE_BY_NAME, staticUrl } from './homeCategoryImages.js';
import { useClientShop } from './clientShopContext.js';

function normalizeParentId(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && raw !== null && 'id' in raw) return Number(raw.id);
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function normalizeCategories(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function publicAuth() {
  return typeof window !== 'undefined' && Boolean(window.__PUBLIC_CONFIG__?.isAuthenticated);
}

function HomeHeroVehicleSearch() {
  const navigate = useNavigate();
  const { refs } = useClientShop();
  const [vehicle, setVehicle] = useState({
    brand_id: '',
    model_id: '',
    generation_id: '',
    body_type_id: '',
    tech_variant_id: '',
  });
  const onVehicleChange = useCallback((patch) => {
    setVehicle((prev) => ({ ...prev, ...patch }));
  }, []);
  const onSubmit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (vehicle.brand_id) p.set('brand_id', vehicle.brand_id);
    if (vehicle.model_id) p.set('model_id', vehicle.model_id);
    if (vehicle.generation_id) p.set('generation_id', vehicle.generation_id);
    if (vehicle.body_type_id) p.set('body_type_id', vehicle.body_type_id);
    if (vehicle.tech_variant_id) p.set('tech_variant_id', vehicle.tech_variant_id);
    p.set('page', '1');
    const qs = p.toString();
    navigate(qs ? `/catalog/?${qs}` : '/catalog/');
  };
  return (
    <form className="home-search home-search--vehicle" onSubmit={onSubmit}>
      <VehicleFilterSelects refs={refs} state={vehicle} onVehicleChange={onVehicleChange} />
      <button type="submit" className="home-btn home-btn--primary home-search__submit">
        Найти детали
      </button>
    </form>
  );
}

const CATEGORY_AUTOPLAY_MS = 4000;
const CATEGORY_PAUSE_AFTER_MANUAL_MS = 32000;

function getCategoryVisibleByWidth(w) {
  if (!w || w <= 420) return 1;
  if (w <= 720) return 2;
  if (w <= 1024) return 3;
  return 4;
}

function HomeRootCategoryCarousel({ categories }) {
  const roots = useMemo(() => {
    const list = categories.filter((c) => normalizeParentId(c.parent) == null);
    return list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
  }, [categories]);

  const [covers, setCovers] = useState({});
  useEffect(() => {
    if (!roots.length) {
      setCovers({});
      return;
    }
    const ids = roots.map((c) => c.id).join(',');
    api
      .get(`storefront/category-cover-images/?ids=${ids}`)
      .then((res) => setCovers(res.data && typeof res.data === 'object' ? res.data : {}))
      .catch(() => setCovers({}));
  }, [roots]);

  const extended = useMemo(() => {
    if (!roots.length) return [];
    return [...roots, ...roots, ...roots];
  }, [roots]);

  const n = roots.length;
  const [pos, setPos] = useState(null);
  const [visible, setVisible] = useState(() => getCategoryVisibleByWidth(typeof window !== 'undefined' ? window.innerWidth : 1200));
  const pauseUntilRef = useRef(0);
  const resumeTimerRef = useRef(null);
  const start = n ? pos ?? n : 0;

  useEffect(() => {
    if (n) setPos(n);
  }, [n]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let raf = 0;
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVisible(getCategoryVisibleByWidth(window.innerWidth)));
    };
    onResize();
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const bumpPause = useCallback(() => {
    pauseUntilRef.current = Date.now() + CATEGORY_PAUSE_AFTER_MANUAL_MS;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pauseUntilRef.current = 0;
    }, CATEGORY_PAUSE_AFTER_MANUAL_MS);
  }, []);

  const go = useCallback(
    (delta) => {
      if (!n) return;
      bumpPause();
      setPos((p) => {
        const base = p ?? n;
        let next = base + delta;
        if (next >= 2 * n) next -= n;
        if (next < n) next += n;
        return next;
      });
    },
    [n, bumpPause],
  );

  useEffect(() => {
    if (n < 2) return undefined;
    const id = setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return;
      setPos((p) => {
        const base = p ?? n;
        let next = base + 1;
        if (next >= 2 * n) next -= n;
        return next;
      });
    }, CATEGORY_AUTOPLAY_MS);
    return () => {
      clearInterval(id);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [n]);

  if (!n) {
    return <p className="home-text home-text--muted home-categories__empty">Категории скоро появятся</p>;
  }

  const vis = Math.min(visible, n);
  const windowItems = [];
  for (let i = 0; i < vis; i += 1) {
    windowItems.push(extended[start + i]);
  }

  return (
    <div className="home-categories__slider home-categories__slider--window" data-slider="home-categories">
      <button
        className="home-categories__nav"
        data-action="prev"
        type="button"
        aria-label="Предыдущие категории"
        onClick={() => go(-1)}
      >
        ‹
      </button>
      <div className="home-categories__window" aria-live="polite">
        {windowItems.map((cat, i) => {
          const fromProduct = covers[String(cat.id)];
          const staticName = HOME_CATEGORY_IMAGE_BY_NAME[cat.name];
          const imgSrc = fromProduct || (staticName ? staticUrl(staticName) : null);
          return (
            <Link key={`${start}-${i}-${cat.id}`} className="home-category-card" to={`/catalog/?category=${cat.id}&page=1`}>
              {imgSrc ? (
                <img className="home-category-card__img" src={imgSrc} alt={cat.name} loading="lazy" />
              ) : (
                <div className="home-category-card__img home-category-card__img--empty" aria-hidden="true" />
              )}
              <div className="home-category-card__label">{cat.name}</div>
            </Link>
          );
        })}
      </div>
      <button
        className="home-categories__nav"
        data-action="next"
        type="button"
        aria-label="Следующие категории"
        onClick={() => go(1)}
      >
        ›
      </button>
    </div>
  );
}

const PROMO_AUTO_MS = 4500;
const PROMO_PAUSE_MS = 32000;

function HomePromoSection() {
  const [promos, setPromos] = useState([]);
  const [idx, setIdx] = useState(0);
  const pauseUntilRef = useRef(0);

  useEffect(() => {
    api
      .get('storefront/promotions/')
      .then((res) => setPromos(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPromos([]));
  }, []);

  const n = promos.length;
  const go = (delta) => {
    if (!n) return;
    pauseUntilRef.current = Date.now() + PROMO_PAUSE_MS;
    setIdx((i) => (i + delta + n * 1000) % n);
  };

  useEffect(() => {
    if (n < 2) return undefined;
    const id = setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return;
      setIdx((i) => (i + 1) % n);
    }, PROMO_AUTO_MS);
    return () => clearInterval(id);
  }, [n]);

  const cur = n ? promos[idx] : null;

  return (
    <section className="home-promo" id="promo">
      <div className="home-promo__inner">
        <h2 className="home-section-title home-section-title--center">Следите за нашими акциями</h2>
        {!n ? (
          <p className="home-text home-text--muted home-promo__empty">Акции скоро появятся</p>
        ) : (
          <div className="home-promo__slider">
            <button className="home-icon-btn" type="button" aria-label="Предыдущая акция" onClick={() => go(-1)}>
              ‹
            </button>
            <div className="home-promo-card">
              {cur.image ? (
                <img className="home-promo-card__img home-promo-card__img--photo" src={cur.image} alt="" loading="lazy" />
              ) : (
                <div className="home-promo-card__img" role="img" aria-label="Акция" />
              )}
              <div className="home-promo-card__content">
                <div className="home-promo-card__title">{cur.title}</div>
                <p className="home-text home-text--muted">{cur.description || ''}</p>
                <Link className="home-btn home-btn--primary" to="/catalog/">
                  В каталог
                </Link>
              </div>
            </div>
            <button className="home-icon-btn" type="button" aria-label="Следующая акция" onClick={() => go(1)}>
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function HomeSiteTextSection({ id, title, body }) {
  if (!title && !(body || '').trim()) {
    return (
      <section className="home-text-block" id={id}>
        <div className="home-text-block__inner">
          <h2 className="home-section-title home-section-title--center">{id === 'delivery' ? 'Доставка' : 'О нас'}</h2>
          <p className="home-text home-text--muted">Скоро здесь появится текст.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="home-text-block" id={id}>
      <div className="home-text-block__inner">
        <h2 className="home-section-title home-section-title--center">{title}</h2>
        <div className="home-text-block__body home-text">
          {(body || '').split('\n').map((line, i) => (
            <p key={i} className="home-text-block__para">
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function StarRatingInput({ value, onChange, 'aria-labelledby': ariaLabelledBy }) {
  const v = value ? Number(value) : 0;
  return (
    <div
      className="home-reviews__stars-input"
      role="group"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabelledBy ? undefined : 'Оценка от 1 до 5'}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`home-reviews__star-btn ${n <= v ? 'home-reviews__star-btn--active' : ''}`}
          onClick={() => onChange(String(n))}
          aria-label={`${n} из 5`}
          aria-pressed={n <= v}
        >
          <svg className="home-reviews__star-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

function HomeReviewsSection() {
  const [reviews, setReviews] = useState([]);
  const [text, setText] = useState('');
  const [rating, setRating] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState(null);
  const authed = publicAuth();

  const load = () => {
    api
      .get('storefront/reviews/')
      .then((res) => setReviews(Array.isArray(res.data) ? res.data : []))
      .catch(() => setReviews([]));
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const r = rating ? Number(rating) : 0;
    if (!r || r < 1 || r > 5) {
      setFormError('Выберите оценку звёздами.');
      return;
    }
    setSending(true);
    setFormError(null);
    const payload = { rating: r };
    const t = text.trim();
    if (t) payload.text = t;
    api
      .post('storefront/reviews/', payload)
      .then(() => {
        setText('');
        setRating('');
        load();
      })
      .catch((err) => {
        const d = err?.response?.data;
        if (d && typeof d === 'object' && !d.detail) {
          const msg = Object.values(d).flat().filter(Boolean)[0];
          setFormError(typeof msg === 'string' ? msg : 'Не удалось отправить отзыв');
        } else {
          setFormError(typeof d?.detail === 'string' ? d.detail : 'Не удалось отправить отзыв');
        }
      })
      .finally(() => setSending(false));
  };

  return (
    <section className="home-reviews" id="reviews">
      <div className="home-reviews__inner">
        <h2 className="home-section-title home-section-title--center">Отзывы</h2>
        {authed ? (
          <form className="home-reviews__form" onSubmit={onSubmit}>
            <div className="home-reviews__rating-row">
              <div className="home-reviews__rating-caption" id="home-review-rating-caption">
                Оценка <span aria-hidden="true">*</span>
              </div>
              <StarRatingInput
                value={rating}
                onChange={setRating}
                aria-labelledby="home-review-rating-caption"
              />
            </div>
            <label className="home-reviews__label">
              Комментарий (необязательно)
              <textarea className="home-reviews__textarea" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
            </label>
            {formError ? <p className="home-text home-reviews__error">{formError}</p> : null}
            <button type="submit" className="home-btn home-btn--primary" disabled={sending}>
              {sending ? 'Отправка…' : 'Отправить отзыв'}
            </button>
          </form>
        ) : (
          <p className="home-text home-text--muted home-reviews__hint">
            <a href="/accounts/login/" className="home-reviews__login-link">
              Войдите
            </a>
            , чтобы оставить отзыв.
          </p>
        )}

        <ul className="home-reviews__list">
          {reviews.map((r) => (
            <li key={r.id} className="home-reviews__item">
              <div className="home-reviews__item-head">
                <span className="home-reviews__author">{r.author_name}</span>
                {r.rating ? <span className="home-reviews__stars">{'★'.repeat(r.rating)}</span> : null}
              </div>
              {r.text?.trim() ? <p className="home-text">{r.text}</p> : null}
              {r.staff_reply ? (
                <div className="home-reviews__reply">
                  <strong>RideX</strong>
                  <p className="home-text home-text--muted">{r.staff_reply}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {!reviews.length ? <p className="home-text home-text--muted">Пока нет отзывов — будьте первым.</p> : null}
      </div>
    </section>
  );
}

function HomeFaqSection() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api
      .get('storefront/faq/')
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch(() => setItems([]));
  }, []);

  if (!items.length) {
    return (
      <section className="home-faq" id="faq">
        <div className="home-faq__inner">
          <h2 className="home-section-title home-section-title--center">Часто задаваемые вопросы</h2>
          <p className="home-text home-text--muted">Вопросы скоро появятся</p>
        </div>
      </section>
    );
  }

  return (
    <section className="home-faq" id="faq">
      <div className="home-faq__inner">
        <h2 className="home-section-title home-section-title--center">Часто задаваемые вопросы</h2>
        <div className="home-faq__list">
          {items.map((it, i) => (
            <details key={it.id} className="home-faq-item" open={i === 0}>
              <summary className="home-faq-item__summary">
                {it.question}
                <span className="home-faq-item__icon" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="home-faq-item__content">
                <p className="home-text home-text--muted">{it.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [siteBlocks, setSiteBlocks] = useState([]);

  useEffect(() => {
    api
      .get('categories/')
      .then((res) => setCategories(normalizeCategories(res.data)))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    api
      .get('storefront/site-blocks/')
      .then((res) => setSiteBlocks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSiteBlocks([]));
  }, []);

  const blockBySlug = useMemo(() => Object.fromEntries(siteBlocks.map((b) => [b.slug, b])), [siteBlocks]);

  useEffect(() => {
    const hash = (location.hash || '').replace(/^#/, '').trim();
    if (!hash) return undefined;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.hash]);

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-hero__content">
            <h1 className="home-hero__title">Кузовные запчасти точно под вашу машину</h1>
            <p className="home-hero__subtitle">
              Выберите параметры автомобиля — покажем только совместимые детали без ошибок и пересортов.
            </p>
          </div>

          <div className="home-hero__search">
            <HomeHeroVehicleSearch />
          </div>
        </div>
      </section>

      <section className="home-categories" id="categories">
        <div className="home-categories__inner">
          <h2 className="home-section-title home-section-title--center">Категории</h2>
          <HomeRootCategoryCarousel categories={categories} />
        </div>
      </section>

      <HomePromoSection />

      <HomeSiteTextSection id="delivery" title={blockBySlug.delivery?.title} body={blockBySlug.delivery?.body} />
      <HomeSiteTextSection id="about" title={blockBySlug.about?.title} body={blockBySlug.about?.body} />

      <HomeReviewsSection />

      <HomeFaqSection />
    </div>
  );
}
