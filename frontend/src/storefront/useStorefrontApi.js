import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';

function normalizeListResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function normalizeApiError(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data?.detail === 'string') return data.detail;
  return fallback;
}

export function useStorefrontCatalog(params) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [bodyTypes, setBodyTypes] = useState([]);
  const [techVariants, setTechVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const queryParams = useMemo(() => {
    const p = {};
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        p[key] = value;
      }
    });
    return p;
  }, [JSON.stringify(params || {})]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, categoriesRes, brandsRes] = await Promise.all([
        api.get('products/', { params: queryParams }),
        api.get('categories/'),
        api.get('brands/'),
      ]);
      setProducts(normalizeListResponse(productsRes.data));
      setCategories(normalizeListResponse(categoriesRes.data));
      setBrands(normalizeListResponse(brandsRes.data));
    } catch (err) {
      setError(normalizeApiError(err, 'Не удалось загрузить каталог'));
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(queryParams)]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const brandId = params?.brand_id;
    if (!brandId) {
      setModels([]);
      return;
    }
    api
      .get('car-models/', { params: { brand: brandId } })
      .then((res) => setModels(normalizeListResponse(res.data)))
      .catch(() => setModels([]));
  }, [params?.brand_id]);

  useEffect(() => {
    const modelId = params?.model_id;
    if (!modelId) {
      setGenerations([]);
      return;
    }
    api
      .get('generations/', { params: { car_model: modelId } })
      .then((res) => setGenerations(normalizeListResponse(res.data)))
      .catch(() => setGenerations([]));
  }, [params?.model_id]);

  useEffect(() => {
    const generationId = params?.generation_id;
    if (!generationId) {
      setBodyTypes([]);
      setTechVariants([]);
      return;
    }
    Promise.all([
      api.get('body-types/', { params: { generation: generationId } }),
      api.get('tech-variants/', { params: { generation: generationId } }),
    ])
      .then(([bodyRes, techRes]) => {
        setBodyTypes(normalizeListResponse(bodyRes.data));
        setTechVariants(normalizeListResponse(techRes.data));
      })
      .catch(() => {
        setBodyTypes([]);
        setTechVariants([]);
      });
  }, [params?.generation_id]);

  return {
    products,
    categories,
    brands,
    models,
    generations,
    bodyTypes,
    techVariants,
    loading,
    error,
    reload: loadCatalog,
  };
}

export function useSessionCart(vehicleContext) {
  const [cart, setCart] = useState({ items: [], total_quantity: 0, total_price: '0.00' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('storefront/cart/', { params: vehicleContext || {} });
      setCart(res.data);
    } catch (err) {
      setError(normalizeApiError(err, 'Не удалось загрузить корзину'));
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(vehicleContext || {})]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const add = useCallback(
    async (productId, quantity = 1) => {
      await api.post('storefront/cart/items/', {
        product_id: productId,
        quantity,
        vehicle_context: vehicleContext || {},
      });
      await loadCart();
    },
    [loadCart, JSON.stringify(vehicleContext || {})],
  );

  const updateQty = useCallback(
    async (productId, quantity) => {
      await api.patch(`storefront/cart/items/${productId}/`, {
        quantity,
        vehicle_context: vehicleContext || {},
      });
      await loadCart();
    },
    [loadCart, JSON.stringify(vehicleContext || {})],
  );

  const remove = useCallback(
    async (productId) => {
      await api.delete(`storefront/cart/items/${productId}/remove/`);
      await loadCart();
    },
    [loadCart],
  );

  const clear = useCallback(async () => {
    await api.post('storefront/cart/clear/');
    await loadCart();
  }, [loadCart]);

  const validateCheckout = useCallback(
    async ({ allowConflicts = false } = {}) => {
      await api.post('storefront/checkout/validate/', {
        allow_conflicts: allowConflicts,
        vehicle_context: vehicleContext || {},
      });
    },
    [JSON.stringify(vehicleContext || {})],
  );

  const checkout = useCallback(
    async ({ allowConflicts = false } = {}) => {
      const res = await api.post('storefront/checkout/', {
        allow_conflicts: allowConflicts,
        vehicle_context: vehicleContext || {},
      });
      await loadCart();
      return res.data;
    },
    [loadCart, JSON.stringify(vehicleContext || {})],
  );

  const cartQuantityByProduct = useMemo(() => {
    const m = {};
    (cart.items || []).forEach((row) => {
      m[row.product_id] = row.quantity;
    });
    return m;
  }, [cart.items]);

  return {
    cart,
    loading,
    error,
    loadCart,
    add,
    updateQty,
    remove,
    clear,
    validateCheckout,
    checkout,
    cartQuantityByProduct,
  };
}

export function useSessionFavorites() {
  const [data, setData] = useState({ product_ids: [], items: [], count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('storefront/favorites/');
      setData(res.data);
    } catch (err) {
      setError(normalizeApiError(err, 'Не удалось загрузить избранное'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(async (productId) => {
    const res = await api.post('storefront/favorites/items/', { product_id: productId });
    setData({
      product_ids: res.data.product_ids,
      items: res.data.items,
      count: res.data.count,
    });
    return Boolean(res.data.is_favorite);
  }, []);

  const remove = useCallback(async (productId) => {
    const res = await api.delete(`storefront/favorites/items/${productId}/remove/`);
    setData({
      product_ids: res.data.product_ids,
      items: res.data.items,
      count: res.data.count,
    });
  }, []);

  const favoriteSet = useMemo(() => new Set((data.product_ids || []).map(Number)), [data.product_ids]);

  return {
    favorites: data,
    favoriteSet,
    loading,
    error,
    reload: load,
    toggle,
    remove,
  };
}

