import { useCallback, useEffect, useState } from 'react';
import api from './client.js';

export function useTechVariants(queryParams = {}) {
  const [techVariants, setTechVariants] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback((params = null) => {
    setLoading(true);
    setError(null);
    const techReq = params ? api.get('tech-variants/', { params }) : api.get('tech-variants/');
    return Promise.all([techReq, api.get('generations/')])
      .then(([tvRes, genRes]) => {
        setTechVariants(Array.isArray(tvRes.data) ? tvRes.data : []);
        setGenerations(Array.isArray(genRes.data) ? genRes.data : []);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Не удалось загрузить конфигурации.');
      })
      .finally(() => setLoading(false));
  }, []);

  const paramsKey = JSON.stringify(queryParams || {});
  const activeParams = queryParams && Object.keys(queryParams).length > 0 ? queryParams : null;

  useEffect(() => {
    load(activeParams);
  }, [load, paramsKey]);

  const saveTechVariant = (payload, id) => {
    setSaving(true);
    setError(null);
    const req = id ? api.patch(`tech-variants/${id}/`, payload) : api.post('tech-variants/', payload);
    return req
      .then(() => load(activeParams))
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Не удалось сохранить конфигурацию.');
        throw err;
      })
      .finally(() => setSaving(false));
  };

  const deleteTechVariant = (id) => {
    setSaving(true);
    setError(null);
    return api
      .delete(`tech-variants/${id}/`)
      .then(() => load(activeParams))
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Не удалось удалить конфигурацию.');
        throw err;
      })
      .finally(() => setSaving(false));
  };

  return {
    techVariants,
    generations,
    loading,
    saving,
    error,
    setError,
    load: () => load(activeParams),
    saveTechVariant,
    deleteTechVariant,
  };
}

