export function fitmentBadgeMeta(status) {
  if (status === 'confirmed') {
    return { label: 'Подходит', className: 'sf-badge sf-badge--ok' };
  }
  if (status === 'conflict') {
    return { label: 'Не подходит', className: 'sf-badge sf-badge--bad' };
  }
  return { label: 'Не проверено', className: 'sf-badge sf-badge--unknown' };
}

export function buildVehicleContext({ brandId, modelId, generationId, bodyTypeId, techVariantId }) {
  return {
    brand_id: brandId || null,
    model_id: modelId || null,
    generation_id: generationId || null,
    body_type_id: bodyTypeId || null,
    tech_variant_id: techVariantId || null,
  };
}

export function hasVehicleContext(vehicleContext) {
  if (!vehicleContext) return false;
  return Boolean(
    vehicleContext.brand_id ||
      vehicleContext.model_id ||
      vehicleContext.generation_id ||
      vehicleContext.body_type_id ||
      vehicleContext.tech_variant_id,
  );
}
