import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useCatalogQueryState() {
  const [params, setParams] = useSearchParams();

  const state = useMemo(
    () => ({
      q: params.get('q') || '',
      category: params.get('category') || '',
      in_stock: params.get('in_stock') || '',
      ordering: params.get('ordering') || '',
      page: params.get('page') || '1',
      brand_id: params.get('brand_id') || '',
      model_id: params.get('model_id') || '',
      generation_id: params.get('generation_id') || '',
      body_type_id: params.get('body_type_id') || '',
      tech_variant_id: params.get('tech_variant_id') || '',
      fitment_only: params.get('fitment_only') || '',
      price_min: params.get('price_min') || '',
      price_max: params.get('price_max') || '',
    }),
    [params],
  );

  const patchState = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) next.delete(key);
      else next.set(key, String(value));
    });
    setParams(next, { replace: true });
  };

  return [state, patchState];
}
