import React, { useState } from 'react';
import ConfirmModal from '../ConfirmModal.jsx';

function ProductTable({ products, canEdit, canDelete, onEdit, onDelete }) {
  const MAX_VEHICLES_IN_CELL = 5;
  const [productToDelete, setProductToDelete] = useState(null);

  if (products.length === 0) {
    return <p>Товары не найдены.</p>;
  }

  const closeConfirm = () => setProductToDelete(null);

  const confirmDelete = () => {
    if (!productToDelete) return;
    onDelete(productToDelete.id);
    setProductToDelete(null);
  };

  return (
    <>
      <table className="dashboard-table">
      <thead>
        <tr>
          <th>Фото</th>
          <th>Название</th>
          <th>Бренд</th>
          <th>Категория</th>
          <th>Артикул</th>
          <th>Цена</th>
          <th>Остаток</th>
          <th>Автомобили</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {products.map((product) => {
          const vehicles = Array.isArray(product.compatible_vehicles) ? product.compatible_vehicles : [];
          const visibleVehicles = vehicles.slice(0, MAX_VEHICLES_IN_CELL);
          const hiddenCount = vehicles.length - visibleVehicles.length;
          return (
            <tr key={product.id}>
              <td>
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 6,
                      backgroundColor: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#999',
                    }}
                  >
                    нет фото
                  </div>
                )}
              </td>
              <td>{product.name}</td>
              <td>{product.brand_name || '—'}</td>
              <td>{product.category_name}</td>
              <td>{product.sku}</td>
              <td>{product.price}</td>
              <td>{product.stock}</td>
              <td style={{ whiteSpace: 'pre-line', maxWidth: 260 }}>
                {visibleVehicles.map((label) => (
                  <div key={label}>{label}</div>
                ))}
                {hiddenCount > 0 && <div>+{hiddenCount} ещё</div>}
                {vehicles.length === 0 && <span>—</span>}
              </td>
              <td>
                {!canEdit && !canDelete ? (
                  <span>—</span>
                ) : (
                  <div className="dashboard-actions">
                    {canEdit && (
                      <button
                        type="button"
                        className="btn btn--icon"
                        onClick={() => onEdit(product)}
                        title="Редактировать товар"
                      >
                        ✎
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="btn btn--icon btn--danger"
                        onClick={() => setProductToDelete(product)}
                        title="Удалить товар"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
      </table>
      {productToDelete && (
        <ConfirmModal
          title="Удаление товара"
          message="Вы уверены, что хотите удалить этот товар?"
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          onConfirm={confirmDelete}
          onCancel={closeConfirm}
        />
      )}
    </>
  );
}

export default ProductTable;

