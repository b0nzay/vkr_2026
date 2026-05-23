import React, { useEffect, useMemo, useState } from 'react';
import SearchSelect from '../common/SearchSelect.jsx';

const TRANSMISSION_TYPE_OPTIONS = [
  { value: 'MT', label: 'Механика' },
  { value: 'AT', label: 'Автомат' },
  { value: 'CVT', label: 'Вариатор' },
  { value: 'DCT', label: 'Робот (DCT)' },
  { value: 'ROBOT', label: 'Робот' },
];

const ENGINE_TYPE_OPTIONS = [
  { value: 'NATURALLY_ASPIRATED', label: 'Атмосферный' },
  { value: 'TURBO', label: 'Турбо' },
  { value: 'SUPERCHARGER', label: 'Нагнетатель' },
  { value: 'OTHER', label: 'Другое' },
];

const FUEL_TYPE_OPTIONS = [
  { value: 'PETROL', label: 'Бензин' },
  { value: 'DIESEL', label: 'Дизель' },
  { value: 'LPG', label: 'Газ (LPG)' },
  { value: 'CNG', label: 'Газ (CNG)' },
  { value: 'ELECTRIC', label: 'Электро' },
  { value: 'HYBRID', label: 'Гибрид' },
];

function TechVariantModalForm({ isOpen, initialRow, generations, saving, error, onSubmit, onClose }) {
  const [form, setForm] = useState({
    generation: '',
    engine_code: '',
    engine_type: 'NATURALLY_ASPIRATED',
    fuel_type: 'PETROL',
    transmission_code: '',
    transmission_type: 'MT',
    gears: '',
    power_hp: '',
    torque_nm: '',
    notes: '',
  });
  const [localError, setLocalError] = useState(null);

  const generationOptions = useMemo(() => {
    return (generations || []).map((g) => ({
      id: String(g.id),
      value: String(g.id),
      label: [g.brand_name, g.car_model_name, g.name].filter(Boolean).join(' / ') || String(g.id),
      iconUrl: g.image || null,
    }));
  }, [generations]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialRow) {
      setForm({
        generation: initialRow.generation ? String(initialRow.generation) : '',
        engine_code: initialRow.engine_code || '',
        engine_type: initialRow.engine_type || 'NATURALLY_ASPIRATED',
        fuel_type: initialRow.fuel_type || 'PETROL',
        transmission_code: initialRow.transmission_code || '',
        transmission_type: initialRow.transmission_type || 'MT',
        gears: initialRow.gears == null ? '' : String(initialRow.gears),
        power_hp: initialRow.power_hp == null ? '' : String(initialRow.power_hp),
        torque_nm: initialRow.torque_nm == null ? '' : String(initialRow.torque_nm),
        notes: initialRow.notes || '',
      });
    } else {
      setForm({
        generation: '',
        engine_code: '',
        engine_type: 'NATURALLY_ASPIRATED',
        fuel_type: 'PETROL',
        transmission_code: '',
        transmission_type: 'MT',
        gears: '',
        power_hp: '',
        torque_nm: '',
        notes: '',
      });
    }
    setLocalError(null);
  }, [isOpen, initialRow]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    const generation = String(form.generation || '').trim();
    const engine_code = String(form.engine_code || '').trim();
    const transmission_code = String(form.transmission_code || '').trim();
    const transmission_type = String(form.transmission_type || '').trim();

    if (!generation) return setLocalError('Выберите поколение');
    if (!engine_code) return setLocalError('Введите код двигателя');
    if (!transmission_code) return setLocalError('Введите код коробки');
    if (!transmission_type) return setLocalError('Выберите тип коробки');

    const payload = {
      generation: Number(generation),
      engine_code,
      engine_type: String(form.engine_type || '').trim() || 'NATURALLY_ASPIRATED',
      fuel_type: String(form.fuel_type || '').trim() || 'PETROL',
      transmission_code,
      transmission_type,
      gears: form.gears === '' ? null : Number(form.gears),
      power_hp: form.power_hp === '' ? null : Number(form.power_hp),
      torque_nm: form.torque_nm === '' ? null : Number(form.torque_nm),
      notes: form.notes || '',
    };

    if (payload.gears != null && (Number.isNaN(payload.gears) || payload.gears <= 0)) {
      return setLocalError('Количество передач должно быть числом > 0');
    }
    if (payload.power_hp != null && (Number.isNaN(payload.power_hp) || payload.power_hp <= 0)) {
      return setLocalError('Мощность должна быть числом > 0');
    }
    if (payload.torque_nm != null && (Number.isNaN(payload.torque_nm) || payload.torque_nm <= 0)) {
      return setLocalError('Момент должен быть числом > 0');
    }

    try {
      await onSubmit(payload, initialRow ? initialRow.id : null);
    } catch {
      // ошибка отображается наверху через error
    }
  };

  const combinedError = localError || error;

  return (
    <div className="dashboard-modal">
      <div className="dashboard-modal__backdrop" onClick={onClose} role="presentation" />
      <div className="dashboard-modal__content">
        <div className="dashboard-modal__header">
          <h3 className="dashboard-modal__title">
            {initialRow ? 'Редактирование конфигурации' : 'Создание конфигурации'}
          </h3>
          <button type="button" className="dashboard-modal__close" onClick={onClose} disabled={saving}>
            ×
          </button>
        </div>

        <div className="dashboard-modal__body">
          {combinedError && (
            <div className="dashboard-alert" style={{ whiteSpace: 'pre-wrap' }}>
              {combinedError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="tv-generation">Поколение</label>
              <SearchSelect
                options={generationOptions}
                value={form.generation}
                onChange={(val) => setForm((p) => ({ ...p, generation: String(val || '') }))}
                placeholder="Поиск по марке / модели / поколению"
                disabled={saving}
                dropdownClassName="search-select__dropdown--generation-large"
                renderOption={(option) => (
                  <div className="generation-option">
                    {option.iconUrl && <img src={option.iconUrl} alt="" className="generation-option__image" />}
                    <div className="generation-option__name">{option.label}</div>
                    <div className="generation-option__divider" />
                  </div>
                )}
              />
            </div>

            <div className="dashboard-form-row">
              <div className="form-group">
                <label htmlFor="tv-engine-code">Код двигателя</label>
                <input
                  id="tv-engine-code"
                  name="engine_code"
                  type="text"
                  value={form.engine_code}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="Например: BKC"
                />
              </div>
              <div className="form-group">
                <label htmlFor="tv-transmission-code">Код коробки</label>
                <input
                  id="tv-transmission-code"
                  name="transmission_code"
                  type="text"
                  value={form.transmission_code}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="Например: DQ200"
                />
              </div>
            </div>

            <div className="dashboard-form-row">
              <div className="form-group">
                <label htmlFor="tv-engine-type">Тип двигателя</label>
                <SearchSelect
                  options={ENGINE_TYPE_OPTIONS}
                  value={form.engine_type}
                  onChange={(val) => setForm((p) => ({ ...p, engine_type: String(val || '') }))}
                  placeholder="—"
                  disabled={saving}
                  searchable={false}
                  withIcons={false}
                />
              </div>
              <div className="form-group">
                <label htmlFor="tv-fuel-type">Топливо</label>
                <SearchSelect
                  options={FUEL_TYPE_OPTIONS}
                  value={form.fuel_type}
                  onChange={(val) => setForm((p) => ({ ...p, fuel_type: String(val || '') }))}
                  placeholder="—"
                  disabled={saving}
                  searchable={false}
                  withIcons={false}
                />
              </div>
            </div>

            <div className="dashboard-form-row">
              <div className="form-group">
                <label htmlFor="tv-transmission-type">Тип коробки</label>
                <select
                  id="tv-transmission-type"
                  name="transmission_type"
                  value={form.transmission_type}
                  onChange={handleChange}
                  disabled={saving}
                >
                  {TRANSMISSION_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="tv-gears">Количество передач</label>
                <input
                  id="tv-gears"
                  name="gears"
                  type="number"
                  value={form.gears}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="Например: 6"
                />
              </div>
            </div>

            <div className="dashboard-form-row">
              <div className="form-group">
                <label htmlFor="tv-power">Мощность (л.с.)</label>
                <input
                  id="tv-power"
                  name="power_hp"
                  type="number"
                  value={form.power_hp}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="Например: 105"
                />
              </div>
              <div className="form-group">
                <label htmlFor="tv-torque">Крутящий момент (Нм)</label>
                <input
                  id="tv-torque"
                  name="torque_nm"
                  type="number"
                  value={form.torque_nm}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="Например: 250"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="tv-notes">Примечания</label>
              <textarea
                id="tv-notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                disabled={saving}
              />
            </div>

            <div className="dashboard-modal__footer">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {initialRow ? 'Сохранить изменения' : 'Создать конфигурацию'}
              </button>
              <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default TechVariantModalForm;

