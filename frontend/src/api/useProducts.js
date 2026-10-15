import { useCallback, useEffect, useState } from 'react';
import api from './client.js';

function formatApiError(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data?.detail === 'string') return data.detail;

  if (data && typeof data === 'object') {
    const parts = [];
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        parts.push(`${key}: ${value.join(' ')}`);
      } else if (typeof value === 'string') {
        parts.push(`${key}: ${value}`);
      }
    });
    if (parts.length > 0) return parts.join('\n');
  }
  return fallback;
}

export function useProducts(queryParams = {}) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [bodyTypes, setBodyTypes] = useState([]);
  const [techVariants, setTechVariants] = useState([]);
  const [compatRefsLoaded, setCompatRefsLoaded] = useState(false);
  const [compatRefsLoading, setCompatRefsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback((params = null) => {
    setLoading(true);
    setError(null);
    const productReq = params ? api.get('products/', { params }) : api.get('products/');
    Promise.all([productReq, api.get('categories/')])
      .then(([productsResponse, categoriesResponse]) => {
        setProducts(productsResponse.data);
        setCategories(categoriesResponse.data);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load products or categories', err);
        setError(formatApiError(err, 'Не удалось загрузить товары'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const paramsKey = JSON.stringify(queryParams || {});
  const activeParams = queryParams && Object.keys(queryParams).length > 0 ? queryParams : null;
  useEffect(() => {
    load(activeParams);
  }, [load, paramsKey]);

  const ensureCompatibilityRefs = useCallback(() => {
    if (compatRefsLoaded || compatRefsLoading) return Promise.resolve();
    setCompatRefsLoading(true);
    return Promise.all([api.get('generations/'), api.get('body-types/'), api.get('tech-variants/')])
      .then(([generationsResponse, bodyTypesResponse, techVariantsResponse]) => {
        setGenerations(Array.isArray(generationsResponse.data) ? generationsResponse.data : []);
        setBodyTypes(Array.isArray(bodyTypesResponse.data) ? bodyTypesResponse.data : []);
        setTechVariants(Array.isArray(techVariantsResponse.data) ? techVariantsResponse.data : []);
        setCompatRefsLoaded(true);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load compatibility references', err);
        setError(formatApiError(err, 'Не удалось загрузить справочники совместимости'));
        throw err;
      })
      .finally(() => {
        setCompatRefsLoading(false);
      });
  }, [compatRefsLoaded, compatRefsLoading]);

  const syncCompatibility = useCallback(async (productId, compatibility) => {
    if (!productId || !compatibility) return;
    const mode = compatibility.mode;
    const bodyTypeIds = Array.isArray(compatibility.bodyTypeIds) ? compatibility.bodyTypeIds.map((x) => Number(x)) : [];
    const techVariantIds = Array.isArray(compatibility.techVariantIds) ? compatibility.techVariantIds.map((x) => Number(x)) : [];

    const [bodyCompatResponse, techCompatResponse] = await Promise.all([
      api.get('product-bodytype-compat/'),
      api.get('product-techvariant-compat/'),
    ]);

    const bodyCompat = (Array.isArray(bodyCompatResponse.data) ? bodyCompatResponse.data : []).filter(
      (row) => Number(row.product) === Number(productId),
    );
    const techCompat = (Array.isArray(techCompatResponse.data) ? techCompatResponse.data : []).filter(
      (row) => Number(row.product) === Number(productId),
    );

    const deleteBody = bodyCompat
      .filter((row) => mode !== 'BODY_TYPE' || !bodyTypeIds.includes(Number(row.body_type)))
      .map((row) => api.delete(`product-bodytype-compat/${row.id}/`));
    const deleteTech = techCompat
      .filter((row) => mode !== 'TECH_VARIANT' || !techVariantIds.includes(Number(row.tech_variant)))
      .map((row) => api.delete(`product-techvariant-compat/${row.id}/`));

    const existingBodyTypeIds = new Set(bodyCompat.map((row) => Number(row.body_type)));
    const existingTechVariantIds = new Set(techCompat.map((row) => Number(row.tech_variant)));

    const createBody = mode === 'BODY_TYPE'
      ? bodyTypeIds
          .filter((id) => !existingBodyTypeIds.has(id))
          .map((bodyTypeId) => api.post('product-bodytype-compat/', { product: Number(productId), body_type: bodyTypeId }))
      : [];

    const createTech = mode === 'TECH_VARIANT'
      ? techVariantIds
          .filter((id) => !existingTechVariantIds.has(id))
          .map((techVariantId) => api.post('product-techvariant-compat/', { product: Number(productId), tech_variant: techVariantId }))
      : [];

    await Promise.all([...deleteBody, ...deleteTech, ...createBody, ...createTech]);
  }, []);

  const saveProduct = useCallback(
    (payload, id, compatibility = null) => {
      setSaving(true);
      setError(null);
      const request = id ? api.patch(`products/${id}/`, payload) : api.post('products/', payload);

      return request
        .then(async (response) => {
          const productId = response?.data?.id || id;
          await syncCompatibility(productId, compatibility);
          await load(activeParams);
          return response.data;
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Failed to save product', err);
          setError(formatApiError(err, 'Не удалось сохранить товар'));
          throw err;
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [load, syncCompatibility, paramsKey],
  );

  const deleteProduct = useCallback(
    (id) => {
      setError(null);
      return api
        .delete(`products/${id}/`)
        .then(() => {
          load(activeParams);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Failed to delete product', err);
          setError(formatApiError(err, 'Не удалось удалить товар'));
          throw err;
        });
    },
    [load, paramsKey],
  );

  const adjustStock = useCallback(
    (id, delta) => {
      if (delta === null || delta === undefined || Number.isNaN(Number(delta))) {
        return Promise.resolve();
      }
      setError(null);
      return api
        .post(`products/${id}/adjust-stock/`, { delta: Number(delta) })
        .then(() => {
          load(activeParams);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Failed to adjust stock', err);
          setError(formatApiError(err, 'Не удалось изменить остаток товара'));
          throw err;
        });
    },
    [load, paramsKey],
  );

  return {
    products,
    categories,
    generations,
    bodyTypes,
    techVariants,
    compatRefsLoading,
    loading,
    saving,
    error,
    setError,
    reload: () => load(activeParams),
    ensureCompatibilityRefs,
    saveProduct,
    deleteProduct,
    adjustStock,
  };
}

