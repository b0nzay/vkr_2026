import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import OrderDetailPage from './OrderDetailPage.jsx';
import OrdersListPage from './OrdersListPage.jsx';
import CatalogPage from '../storefront/CatalogPage.jsx';
import CartPage from '../storefront/CartPage.jsx';
import CheckoutPage from '../storefront/CheckoutPage.jsx';
import FavoritesPage from '../storefront/FavoritesPage.jsx';
import StorefrontLayout from '../storefront/StorefrontLayout.jsx';
import StorefrontProductModal from '../storefront/StorefrontProductModal.jsx';
import { buildVehicleContext } from '../storefront/storefrontUtils.js';
import { useSessionCart, useSessionFavorites, useStorefrontCatalog } from '../storefront/useStorefrontApi.js';
import { useCatalogQueryState } from '../storefront/useCatalogQueryState.js';
import { ClientShopContext, useClientShop } from './clientShopContext.js';
import ClientLayout from './ClientLayout.jsx';
import HomePage from './HomePage.jsx';
import ProfilePage from './ProfilePage.jsx';

function getPublicAuth() {
  return typeof window !== 'undefined' && Boolean(window.__PUBLIC_CONFIG__?.isAuthenticated);
}

function snapshotFromShop(shop) {
  return {
    cartItems: Array.isArray(shop?.cart?.cart?.items)
      ? shop.cart.cart.items.map((i) => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) || 1 }))
      : [],
    favoriteIds: Array.isArray(shop?.fav?.favorites?.product_ids) ? shop.fav.favorites.product_ids.map((id) => Number(id)) : [],
  };
}

function hasSnapshotData(snapshot) {
  return Boolean((snapshot?.cartItems || []).length || (snapshot?.favoriteIds || []).length);
}

function buildCartQuantityMap(items) {
  const map = new Map();
  for (const row of items || []) {
    const pid = Number(row?.product_id);
    if (!pid) continue;
    const qty = Number(row?.quantity) || 0;
    map.set(pid, qty);
  }
  return map;
}

function GuestDataMergeModal({ open, busy, hasCartOption, hasFavoriteOption, onOnlyCart, onOnlyFavorites, onBoth, onCancel }) {
  if (!open) return null;
  const canSaveBoth = hasCartOption && hasFavoriteOption;
  return (
    <div className="sf-modal">
      <button type="button" className="sf-modal__backdrop" aria-label="Закрыть" onClick={onCancel} />
      <div className="sf-modal__panel">
        <div className="sf-modal__head">
          <h2 className="sf-modal__title">Сохранить данные гостя?</h2>
        </div>
        <div className="sf-modal__body">
          <p className="home-text home-text--muted">
            Вы добавляли товары в корзину и избранное как гость. Выберите, какие данные перенести в ваш аккаунт.
          </p>
          <div className="profile-page__card-actions">
            {hasCartOption ? (
              <button type="button" className="btn btn--outline" disabled={busy} onClick={onOnlyCart}>
                Сохранить только корзину
              </button>
            ) : null}
            {hasFavoriteOption ? (
              <button type="button" className="btn btn--outline" disabled={busy} onClick={onOnlyFavorites}>
                Сохранить только избранное
              </button>
            ) : null}
            {canSaveBoth ? (
              <button type="button" className="btn btn--primary" disabled={busy} onClick={onBoth}>
                Сохранить и то, и другое
              </button>
            ) : null}
            <button type="button" className="btn btn--muted" disabled={busy} onClick={onCancel}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useClientShopState() {
  const location = useLocation();
  const navigate = useNavigate();
  const [catalogState, patchCatalogState] = useCatalogQueryState();
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);
  const [searchDraft, setSearchDraft] = useState(catalogState.q);
  const [productModalId, setProductModalId] = useState(null);

  useEffect(() => {
    setSearchDraft(catalogState.q);
  }, [catalogState.q]);

  useEffect(() => {
    if (!location.pathname.startsWith('/catalog')) return;
    const t = setTimeout(() => {
      if (searchDraft !== catalogState.q) {
        patchCatalogState({ q: searchDraft, page: '1' });
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft, location.pathname, catalogState.q]);

  const vehicleContext = useMemo(
    () =>
      buildVehicleContext({
        brandId: catalogState.brand_id,
        modelId: catalogState.model_id,
        generationId: catalogState.generation_id,
        bodyTypeId: catalogState.body_type_id,
        techVariantId: catalogState.tech_variant_id,
      }),
    [
      catalogState.brand_id,
      catalogState.model_id,
      catalogState.generation_id,
      catalogState.body_type_id,
      catalogState.tech_variant_id,
    ],
  );

  const catalogParams = useMemo(() => {
    const params = {
      q: catalogState.q || undefined,
      category: catalogState.category || undefined,
      in_stock: catalogState.in_stock || undefined,
      ordering: catalogState.ordering || undefined,
      page: catalogState.page || '1',
      fitment_only: catalogState.fitment_only === 'true' ? 'true' : undefined,
      brand_id: catalogState.brand_id || undefined,
      model_id: catalogState.model_id || undefined,
      generation_id: catalogState.generation_id || undefined,
      body_type_id: catalogState.body_type_id || undefined,
      tech_variant_id: catalogState.tech_variant_id || undefined,
      price_min: catalogState.price_min?.trim() || undefined,
      price_max: catalogState.price_max?.trim() || undefined,
    };
    return params;
  }, [catalogState]);

  const catalog = useStorefrontCatalog(catalogParams);
  const cart = useSessionCart(vehicleContext);
  const fav = useSessionFavorites();
  const handleAddToCart = async (productId) => {
    await cart.add(productId, 1);
  };

  const handleSetCartQty = async (productId, quantity) => {
    if (quantity <= 0) await cart.remove(productId);
    else await cart.updateQty(productId, quantity);
  };

  const handleCheckout = async (allowConflicts) => {
    setCheckoutSuccess(null);
    const result = await cart.checkout({ allowConflicts });
    setCheckoutSuccess(result);
    navigate('/checkout');
  };

  const refs = useMemo(
    () => ({
      categories: catalog.categories,
      brands: catalog.brands,
      models: catalog.models,
      generations: catalog.generations,
      bodyTypes: catalog.bodyTypes,
      techVariants: catalog.techVariants,
    }),
    [catalog.categories, catalog.brands, catalog.models, catalog.generations, catalog.bodyTypes, catalog.techVariants],
  );

  return {
    catalogState,
    patchCatalogState,
    checkoutSuccess,
    setCheckoutSuccess,
    searchDraft,
    setSearchDraft,
    productModalId,
    setProductModalId,
    catalog,
    cart,
    fav,
    refs,
    handleAddToCart,
    handleSetCartQty,
    handleCheckout,
  };
}

function ShopChrome() {
  useClientShop();
  return (
    <StorefrontLayout>
      <Outlet />
    </StorefrontLayout>
  );
}

function CatalogRoute() {
  const {
    catalogState,
    patchCatalogState,
    catalog,
    refs,
    cart,
    fav,
    productModalId,
    setProductModalId,
    handleAddToCart,
    handleSetCartQty,
  } = useClientShop();

  return (
    <>
      <CatalogPage
        products={catalog.products}
        categories={catalog.categories}
        refs={refs}
        state={catalogState}
        onChange={patchCatalogState}
        onAddToCart={handleAddToCart}
        onSetCartQty={handleSetCartQty}
        cartQuantityByProduct={cart.cartQuantityByProduct}
        favoriteSet={fav.favoriteSet}
        onToggleFavorite={(id) => fav.toggle(id)}
        onOpenProduct={setProductModalId}
        loading={catalog.loading}
        error={catalog.error}
      />
      <StorefrontProductModal
        productId={productModalId}
        onClose={() => setProductModalId(null)}
        onAddToCart={handleAddToCart}
        onSetCartQty={handleSetCartQty}
        cartQuantityByProduct={cart.cartQuantityByProduct}
        favoriteSet={fav.favoriteSet}
        onToggleFavorite={(id) => fav.toggle(id)}
      />
    </>
  );
}

function FavoritesRoute() {
  const { fav } = useClientShop();
  return (
    <FavoritesPage
      favorites={fav.favorites}
      loading={fav.loading}
      error={fav.error}
      onRemove={(id) => fav.remove(id)}
    />
  );
}

function CartRoute() {
  const { cart } = useClientShop();
  return (
    <CartPage
      cart={cart.cart}
      loading={cart.loading}
      error={cart.error}
      onQtyChange={(productId, quantity) => cart.updateQty(productId, quantity)}
      onRemove={(productId) => cart.remove(productId)}
      onClear={cart.clear}
    />
  );
}

function CheckoutRoute() {
  const { cart, checkoutSuccess, handleCheckout } = useClientShop();
  return (
    <CheckoutPage
      cart={cart.cart}
      checkoutSuccess={checkoutSuccess}
      validateCheckout={cart.validateCheckout}
      reloadCart={cart.loadCart}
      onCheckout={handleCheckout}
    />
  );
}

export default function ClientApp() {
  const shop = useClientShopState();
  const isAuth = getPublicAuth();
  const [guestMergeModalOpen, setGuestMergeModalOpen] = useState(false);
  const [guestMergeBusy, setGuestMergeBusy] = useState(false);
  const [guestSnapshot, setGuestSnapshot] = useState(null);
  const [guestMergeOptions, setGuestMergeOptions] = useState({ canCart: false, canFav: false });

  useEffect(() => {
    if (isAuth) return undefined;
    const handleAuthLinkClick = (e) => {
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (!href.includes('/accounts/login/') && !href.includes('/accounts/register/')) return;
      const snapshot = snapshotFromShop(shop);
      if (!hasSnapshotData(snapshot)) return;
      window.sessionStorage.setItem('ridex_guest_snapshot', JSON.stringify(snapshot));
    };
    document.addEventListener('click', handleAuthLinkClick, true);
    return () => document.removeEventListener('click', handleAuthLinkClick, true);
  }, [isAuth, shop]);

  useEffect(() => {
    if (!isAuth) return;
    const raw = window.sessionStorage.getItem('ridex_guest_snapshot');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!hasSnapshotData(parsed)) {
        window.sessionStorage.removeItem('ridex_guest_snapshot');
        return;
      }
      const guestCart = Array.isArray(parsed.cartItems) ? parsed.cartItems : [];
      const guestFav = Array.isArray(parsed.favoriteIds) ? parsed.favoriteIds.map((id) => Number(id)).filter(Boolean) : [];
      const accountCartMap = buildCartQuantityMap(shop.cart.cart.items || []);
      const accountFavSet = new Set((shop.fav.favorites.product_ids || []).map((id) => Number(id)));
      const cartItemsToMerge = guestCart.filter((row) => {
        const pid = Number(row?.product_id);
        const qty = Number(row?.quantity) || 0;
        if (!pid || qty <= 0) return false;
        return qty > (accountCartMap.get(pid) || 0);
      });
      const favoriteIdsToMerge = guestFav.filter((pid) => !accountFavSet.has(pid));
      const canCart = cartItemsToMerge.length > 0;
      const canFav = favoriteIdsToMerge.length > 0;
      if (!canCart && !canFav) {
        window.sessionStorage.removeItem('ridex_guest_snapshot');
        return;
      }
      const filtered = {
        cartItems: cartItemsToMerge,
        favoriteIds: favoriteIdsToMerge,
      };
      setGuestMergeOptions({ canCart, canFav });
      setGuestSnapshot(filtered);
      setGuestMergeModalOpen(true);
    } catch {
      window.sessionStorage.removeItem('ridex_guest_snapshot');
    }
  }, [isAuth, shop.cart.cart.items, shop.fav.favorites.product_ids]);

  const applyGuestChoice = async (mode) => {
    if (!guestSnapshot) return;
    setGuestMergeBusy(true);
    try {
      const keepCart = mode === 'cart' || mode === 'both';
      const keepFav = mode === 'favorites' || mode === 'both';
      if (keepCart) {
        const accountCartMap = buildCartQuantityMap(shop.cart.cart.items || []);
        for (const row of guestSnapshot.cartItems || []) {
          const pid = Number(row?.product_id);
          const guestQty = Number(row?.quantity) || 0;
          if (pid && guestQty > 0) {
            const accountQty = accountCartMap.get(pid) || 0;
            if (accountQty <= 0) {
              await shop.cart.add(pid, guestQty);
            } else if (guestQty > accountQty) {
              await shop.cart.updateQty(pid, guestQty);
            }
          }
        }
      }
      if (keepFav) {
        const currentFavSet = new Set(
          (Array.isArray(shop.fav.favorites.product_ids) ? shop.fav.favorites.product_ids : []).map((id) => Number(id)),
        );
        for (const pid of guestSnapshot.favoriteIds || []) {
          const favId = Number(pid);
          if (favId && !currentFavSet.has(favId)) {
            await shop.fav.toggle(favId);
          }
        }
      }
    } finally {
      window.sessionStorage.removeItem('ridex_guest_snapshot');
      setGuestMergeModalOpen(false);
      setGuestMergeBusy(false);
      setGuestSnapshot(null);
      setGuestMergeOptions({ canCart: false, canFav: false });
    }
  };

  const cancelGuestChoice = () => {
    window.sessionStorage.removeItem('ridex_guest_snapshot');
    setGuestMergeModalOpen(false);
    setGuestSnapshot(null);
    setGuestMergeOptions({ canCart: false, canFav: false });
  };

  return (
    <ClientShopContext.Provider value={shop}>
      <GuestDataMergeModal
        open={guestMergeModalOpen}
        busy={guestMergeBusy}
        hasCartOption={guestMergeOptions.canCart}
        hasFavoriteOption={guestMergeOptions.canFav}
        onOnlyCart={() => applyGuestChoice('cart')}
        onOnlyFavorites={() => applyGuestChoice('favorites')}
        onBoth={() => applyGuestChoice('both')}
        onCancel={cancelGuestChoice}
      />
      <Routes>
        <Route element={<ClientLayout />}>
          <Route index element={<HomePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="orders" element={<Outlet />}>
            <Route index element={<OrdersListPage />} />
            <Route path="my" element={<OrdersListPage />} />
            <Route path=":orderId" element={<OrderDetailPage />} />
          </Route>
          <Route element={<ShopChrome />}>
            <Route path="catalog" element={<CatalogRoute />} />
            <Route path="favorites" element={<FavoritesRoute />} />
            <Route path="cart" element={<CartRoute />} />
            <Route path="checkout" element={<CheckoutRoute />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ClientShopContext.Provider>
  );
}
