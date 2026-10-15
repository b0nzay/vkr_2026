import React, { useState } from 'react';
import ConfirmModal from '../ConfirmModal.jsx';

function formatGenerationLabel(row) {
  const brand = row.brand_name || '';
  const model = row.car_model_name || '';
  const gen = row.generation_name || '';
  return [brand, model, gen].filter(Boolean).join(' / ');
}

const ENGINE_LABELS = {
  NATURALLY_ASPIRATED: 'Атмосферный',
  TURBO: 'Турбо',
  SUPERCHARGER: 'Нагнетатель',
  OTHER: 'Другое',
};

const FUEL_LABELS = {
  PETROL: 'Бензин',
  DIESEL: 'Дизель',
  LPG: 'Газ (LPG)',
  CNG: 'Газ (CNG)',
  ELECTRIC: 'Электро',
  HYBRID: 'Гибрид',
};

function TechVariantTable({ techVariants, isAdmin, onEdit, onDelete }) {
  const [toDelete, setToDelete] = useState(null);

  if (techVariants.length === 0) {
    return <p>Конфигурации не найдены.</p>;
  }

  const closeConfirm = () => setToDelete(null);

  const confirmDelete = () => {
    if (!toDelete) return;
    onDelete(toDelete.id);
    setToDelete(null);
  };

  return (
    <>
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Поколение</th>
            <th>Код двигателя</th>
            <th>Тип двигателя</th>
            <th>Топливо</th>
            <th>КПП</th>
            <th>Передачи</th>
            <th>Мощн., л.с.</th>
            <th>Момент, Нм</th>
            <th style={{ maxWidth: 320 }}>Примечания</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {techVariants.map((row) => (
            <tr key={row.id}>
              <td style={{ maxWidth: 340 }}>{formatGenerationLabel(row) || '—'}</td>
              <td>{row.engine_code || '—'}</td>
              <td>{ENGINE_LABELS[row.engine_type] || row.engine_type || '—'}</td>
              <td>{FUEL_LABELS[row.fuel_type] || row.fuel_type || '—'}</td>
              <td>
                {[row.transmission_type, row.transmission_code].filter(Boolean).join(' ')}
              </td>
              <td>{row.gears ?? '—'}</td>
              <td>{row.power_hp ?? '—'}</td>
              <td>{row.torque_nm ?? '—'}</td>
              <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{row.notes ? row.notes : '—'}</td>
              <td>
                {!isAdmin ? (
                  <span>—</span>
                ) : (
                  <div className="dashboard-actions">
                    <button
                      type="button"
                      className="btn btn--icon"
                      onClick={() => onEdit(row)}
                      title="Редактировать конфигурацию"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--danger"
                      onClick={() => setToDelete(row)}
                      title="Удалить конфигурацию"
                    >
                      🗑
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {toDelete && (
        <ConfirmModal
          title="Удаление конфигурации"
          message="Вы уверены, что хотите удалить эту конфигурацию?"
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          onConfirm={confirmDelete}
          onCancel={closeConfirm}
        />
      )}
    </>
  );
}

export default TechVariantTable;

