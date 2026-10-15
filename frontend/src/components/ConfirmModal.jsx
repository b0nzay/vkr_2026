import React from 'react';

function ConfirmModal({ title, message, confirmLabel = 'Удалить', cancelLabel = 'Отмена', onConfirm, onCancel, busy }) {
  return (
    <div className="dashboard-modal">
      <div className="dashboard-modal__backdrop" onClick={busy ? undefined : onCancel} role="presentation" />
      <div className="dashboard-modal__content" style={{ maxWidth: 420 }}>
        <div className="dashboard-modal__header">
          <h3 className="dashboard-modal__title">{title}</h3>
          <button
            type="button"
            className="dashboard-modal__close"
            onClick={onCancel}
            disabled={busy}
          >
            ×
          </button>
        </div>
        <div className="dashboard-modal__body">
          <p style={{ marginBottom: 0 }}>{message}</p>
        </div>
        <div className="dashboard-modal__footer">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;

