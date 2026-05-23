import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import CategoryModal from '../components/categories/CategoryModal.jsx';
import DashboardListToolbar from '../components/common/DashboardListToolbar.jsx';

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
      } else if (value && typeof value === 'object' && typeof value.detail === 'string') {
        parts.push(`${key}: ${value.detail}`);
      }
    });
    if (parts.length > 0) return parts.join('\n');
  }
  return fallback;
}

function buildTree(categories) {
  const byId = new Map();
  const roots = [];

  categories.forEach((cat) => {
    byId.set(cat.id, { ...cat, children: [] });
  });

  byId.forEach((cat) => {
    if (cat.parent) {
      const parent = byId.get(cat.parent);
      if (parent) {
        parent.children.push(cat);
      } else {
        roots.push(cat);
      }
    } else {
      roots.push(cat);
    }
  });

  return roots;
}

function buildPathLabel(category, byId) {
  const parts = [];
  const seen = new Set();
  let cur = category;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.push(cur.name);
    cur = cur.parent ? byId.get(cur.parent) : null;
  }
  parts.reverse();
  return parts.join(' → ');
}

function CategoriesPage({ isAdmin }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get('q') || '';

  const queryParams = useMemo(() => {
    const p = {};
    if (qFromUrl.trim()) p.q = qFromUrl.trim();
    return p;
  }, [qFromUrl]);

  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createParentId, setCreateParentId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [blockedDeleteInfo, setBlockedDeleteInfo] = useState(null);

  const loadCategories = (params = null) => {
    const requestParams = params && Object.keys(params).length > 0 ? params : null;
    api
      .get('categories/', requestParams ? { params: requestParams } : undefined)
      .then((response) => setCategories(response.data))
      .catch((err) => {
        console.error('Failed to load categories', err);
        setError('Не удалось загрузить категории');
      });
  };

  useEffect(() => {
    loadCategories(queryParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(queryParams)]);

  const [qDraft, setQDraft] = useState(qFromUrl);
  useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      const v = qDraft.trim();
      if (v) next.set('q', v);
      else next.delete('q');
      setSearchParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDraft]);

  useEffect(() => {
    if (!searchParams.has('parent')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('parent');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const byId = new Map(categories.map((c) => [c.id, c]));

  const startCreate = () => {
    setError(null);
    setShowCreateModal(true);
    setCreateParentId(null);
  };

  const startCreateWithParent = (parentId) => {
    setError(null);
    setShowCreateModal(true);
    setCreateParentId(parentId);
  };

  const cancelCreate = () => {
    setShowCreateModal(false);
    setCreateParentId(null);
    setSaving(false);
  };

  const submitCreate = (payload) => {
    if (!isAdmin) return;
    setSaving(true);
    setError(null);
    api
      .post('categories/', { name: payload.name.trim(), parent: createParentId })
      .then(() => {
        cancelCreate();
        loadCategories(queryParams);
      })
      .catch((err) => {
        console.error('Failed to save category', err);
        setError(formatApiError(err, 'Не удалось сохранить категорию'));
      })
      .finally(() => setSaving(false));
  };

  const startEdit = (cat) => {
    setError(null);
    setEditingNodeId(cat.id);
    setEditingName(cat.name);
  };

  const onEditingNameChange = (value) => setEditingName(value);

  const saveEdit = () => {
    if (!isAdmin || editingNodeId == null) return;
    const name = editingName.trim();
    if (!name) {
      cancelEdit();
      return;
    }
    setSaving(true);
    setError(null);
    api
      .patch(`categories/${editingNodeId}/`, { name })
      .then(() => {
        setEditingNodeId(null);
        setEditingName('');
        loadCategories(queryParams);
      })
      .catch((err) => {
        console.error('Failed to update category', err);
        setError(formatApiError(err, 'Не удалось сохранить категорию'));
      })
      .finally(() => setSaving(false));
  };

  const cancelEdit = () => {
    setEditingNodeId(null);
    setEditingName('');
  };

  const removeCategory = (catId) => {
    if (!isAdmin) return;
    setCategoryToDelete(catId);
  };

  const confirmRemoveCategory = () => {
    if (!isAdmin || !categoryToDelete) return;
    setError(null);
    api
      .delete(`categories/${categoryToDelete}/`)
      .then(() => {
        setCategoryToDelete(null);
        setBlockedDeleteInfo(null);
        loadCategories(queryParams);
      })
      .catch((err) => {
        console.error('Failed to delete category', err);
        const data = err?.response?.data;
        if (data && typeof data === 'object' && typeof data.product_count === 'number' && Array.isArray(data.products)) {
          // Снятие "удалить?" модалки, чтобы вместо неё показать понятный блокирующий диалог.
          setCategoryToDelete(null);
          setBlockedDeleteInfo({
            product_count: data.product_count,
            products: data.products,
          });
          return;
        }
        setError(formatApiError(err, 'Не удалось удалить категорию'));
      });
  };

  const tree = buildTree(categories);

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <h2 className="dashboard-card__title">Категории</h2>
        {isAdmin && !showCreateModal && (
          <button type="button" className="btn btn--primary" onClick={startCreate}>
            Добавить категорию
          </button>
        )}
      </div>
      <div className="dashboard-card__body">
        {error && (
          <div className="dashboard-alert" style={{ whiteSpace: 'pre-wrap' }}>
            {error}
          </div>
        )}

        <DashboardListToolbar q={qDraft} placeholder="Поиск по названию" onQChange={setQDraft} />

        {tree.length === 0 ? (
          <p>Категории не найдены.</p>
        ) : (
          <ul className="categories-tree">
            {tree.map((node) => (
              <CategoryNodeWithActions
                key={node.id}
                node={node}
                isAdmin={isAdmin}
                editingNodeId={editingNodeId}
                editingName={editingName}
                onEditingNameChange={onEditingNameChange}
                onEdit={startEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                onDelete={(cat) => removeCategory(cat.id)}
                onAddSubcategory={(cat) => startCreateWithParent(cat.id)}
              />
            ))}
          </ul>
        )}

        <CategoryModal
          isOpen={isAdmin && showCreateModal}
          parentId={createParentId}
          saving={saving}
          onSubmit={submitCreate}
          onClose={cancelCreate}
        />

        {categoryToDelete && (
          <ConfirmModal
            title="Удаление категории"
            message="Удалить эту категорию? Все вложенные подкатегории будут удалены каскадно."
            confirmLabel="Удалить"
            cancelLabel="Отмена"
            onConfirm={confirmRemoveCategory}
            onCancel={() => setCategoryToDelete(null)}
          />
        )}

        {blockedDeleteInfo ? (
          <div className="dashboard-modal" role="dialog" aria-modal="true" aria-label="Удаление категории запрещено">
            <div
              className="dashboard-modal__backdrop"
              onClick={() => setBlockedDeleteInfo(null)}
              role="presentation"
            />
            <div className="dashboard-modal__content" style={{ maxWidth: 560 }}>
              <div className="dashboard-modal__header">
                <h3 className="dashboard-modal__title">Удаление запрещено</h3>
                <button type="button" className="dashboard-modal__close" onClick={() => setBlockedDeleteInfo(null)}>
                  ×
                </button>
              </div>
              <div className="dashboard-modal__body">
                <p style={{ marginBottom: 12 }}>
                  {`Категорию нельзя удалить, поскольку на неё ссылаются товары (${blockedDeleteInfo.product_count}).`}
                </p>
                <p style={{ marginBottom: 8 }} className="text-muted">
                  {`Показано: ${blockedDeleteInfo.products.length} из ${blockedDeleteInfo.product_count}.`}
                </p>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Имя</th>
                      <th>Артикул</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedDeleteInfo.products.map((p) => (
                      <tr key={`${p.name}-${p.sku}`}>
                        <td>{p.name}</td>
                        <td>{p.sku}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="dashboard-modal__footer">
                <button type="button" className="btn btn--primary" onClick={() => setBlockedDeleteInfo(null)}>
                  Понятно
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CategoriesPage;

function CategoryNodeWithActions({
  node,
  level = 0,
  isAdmin,
  editingNodeId,
  editingName,
  onEditingNameChange,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAddSubcategory,
}) {
  const [expanded, setExpanded] = React.useState(true);
  const inputRef = React.useRef(null);
  const hasChildren = node.children && node.children.length > 0;
  const isEditing = editingNodeId === node.id;

  React.useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    }
  };

  return (
    <li className="categories-node">
      <div className="categories-node__row" style={{ paddingLeft: 12 + level * 16 }}>
        <button
          type="button"
          className="btn btn--icon categories-node__toggle"
          onClick={() => hasChildren && setExpanded((v) => !v)}
          disabled={!hasChildren}
          title={hasChildren ? (expanded ? 'Свернуть' : 'Развернуть') : null}
        >
          {hasChildren ? (expanded ? '▾' : '▸') : '•'}
        </button>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="categories-node__input"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span className="categories-node__label">{node.name}</span>
        )}
        {isAdmin && !isEditing && (
          <div className="categories-node__actions">
            <button
              type="button"
              className="btn btn--icon"
              onClick={() => onAddSubcategory(node)}
              title="Добавить подкатегорию"
            >
              +
            </button>
            <button
              type="button"
              className="btn btn--icon"
              onClick={() => onEdit(node)}
              title="Редактировать категорию"
            >
              ✎
            </button>
            <button
              type="button"
              className="btn btn--icon btn--danger"
              onClick={() => onDelete(node)}
              title="Удалить категорию"
            >
              🗑
            </button>
          </div>
        )}
      </div>
      {hasChildren && expanded && (
        <ul className="categories-tree">
          {node.children.map((child) => (
            <CategoryNodeWithActions
              key={child.id}
              node={child}
              level={level + 1}
              isAdmin={isAdmin}
              editingNodeId={editingNodeId}
              editingName={editingName}
              onEditingNameChange={onEditingNameChange}
              onEdit={onEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              onAddSubcategory={onAddSubcategory}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

