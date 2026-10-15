import React, { useMemo } from 'react';
import SearchSelect from '../components/common/SearchSelect.jsx';

export default function VehicleFilterSelects({ refs, state, onVehicleChange }) {
  const brandOptions = useMemo(
    () => [{ value: '', label: 'Марка' }, ...refs.brands.map((row) => ({ value: String(row.id), label: row.name }))],
    [refs.brands],
  );

  const modelOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Модель' }];
    if (!state.brand_id) return opts;
    return opts.concat(
      refs.models.filter((m) => String(m.brand) === String(state.brand_id)).map((row) => ({ value: String(row.id), label: row.name })),
    );
  }, [refs.models, state.brand_id]);

  const generationOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Поколение' }];
    if (!state.model_id) return opts;
    return opts.concat(
      refs.generations.filter((g) => String(g.car_model) === String(state.model_id)).map((row) => ({ value: String(row.id), label: row.name })),
    );
  }, [refs.generations, state.model_id]);

  const bodyTypeOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Кузов' }];
    if (!state.generation_id) return opts;
    return opts.concat(
      refs.bodyTypes.map((row) => ({
        value: String(row.id),
        label: row.name_display || row.name,
      })),
    );
  }, [refs.bodyTypes, state.generation_id]);

  const techVariantOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Конфигурация' }];
    if (!state.generation_id) return opts;
    return opts.concat(
      refs.techVariants.map((row) => ({
        value: String(row.id),
        label: `${row.engine_code} / ${row.transmission_code}`,
      })),
    );
  }, [refs.techVariants, state.generation_id]);

  return (
    <div className="sf-vehicle-selects">
      <div className="sf-vehicle-selects__row sf-vehicle-selects__row--three">
        <div className="form-group sf-vehicle-selects__field">
          <label>Марка</label>
          <SearchSelect
            options={brandOptions}
            value={state.brand_id || ''}
            onChange={(val) => {
              onVehicleChange({
                brand_id: val || '',
                model_id: '',
                generation_id: '',
                body_type_id: '',
                tech_variant_id: '',
              });
            }}
            placeholder="Марка"
            withIcons={false}
            searchable
          />
        </div>
        <div className="form-group sf-vehicle-selects__field">
          <label>Модель</label>
          <SearchSelect
            options={modelOptions}
            value={state.model_id || ''}
            onChange={(val) => {
              onVehicleChange({
                model_id: val || '',
                generation_id: '',
                body_type_id: '',
                tech_variant_id: '',
              });
            }}
            placeholder="Модель"
            disabled={!state.brand_id}
            withIcons={false}
            searchable
          />
        </div>
        <div className="form-group sf-vehicle-selects__field">
          <label>Поколение</label>
          <SearchSelect
            options={generationOptions}
            value={state.generation_id || ''}
            onChange={(val) => {
              onVehicleChange({
                generation_id: val || '',
                body_type_id: '',
                tech_variant_id: '',
              });
            }}
            placeholder="Поколение"
            disabled={!state.model_id}
            withIcons={false}
            searchable
          />
        </div>
      </div>
      <div className="sf-vehicle-selects__row sf-vehicle-selects__row--two">
        <div className="form-group sf-vehicle-selects__field">
          <label>Кузов</label>
          <SearchSelect
            options={bodyTypeOptions}
            value={state.body_type_id || ''}
            onChange={(val) => {
              onVehicleChange({ body_type_id: val || '' });
            }}
            placeholder="Кузов"
            disabled={!state.generation_id}
            withIcons={false}
            searchable
          />
        </div>
        <div className="form-group sf-vehicle-selects__field">
          <label>Конфигурация</label>
          <SearchSelect
            options={techVariantOptions}
            value={state.tech_variant_id || ''}
            onChange={(val) => {
              onVehicleChange({ tech_variant_id: val || '' });
            }}
            placeholder="Конфигурация"
            disabled={!state.generation_id}
            withIcons={false}
            searchable
          />
        </div>
      </div>
    </div>
  );
}
