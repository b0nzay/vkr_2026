import React from 'react';

function CategoryModal({ isOpen, parentId, saving, onSubmit, onClose }) {
  const [name, setName] = React.useState('');

  React.useEffect(() => {
    if (isOpen) setName('');
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, parent: parentId });
  };

  if (!isOpen) return null;

  return (
    <div className="dashboard-modal">
      <div className="dashboard-modal__backdrop" onClick={onClose} role="presentation" />
      <div className="dashboard-modal__content" style={{ maxWidth: 400 }}>
        <div className="dashboard-modal__header">
          <h3 className="dashboard-modal__title">Новая категория</h3>
          <button type="button" className="dashboard-modal__close" onClick={onClose} disabled={saving}>
            ×
          </button>
        </div>
        <div className="dashboard-modal__body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="category-name">Название</label>
              <input
                id="category-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                autoFocus
              />
            </div>
            <div className="dashboard-modal__footer">
              <button type="submit" className="btn btn--primary" disabled={saving || !name.trim()}>
                Создать
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

export default CategoryModal;
