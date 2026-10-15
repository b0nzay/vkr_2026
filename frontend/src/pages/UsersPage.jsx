import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { apiPhoneToDisplay, onPhoneInputChange, phoneToApi } from '../utils/phoneMask.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import DashboardListToolbar from '../components/common/DashboardListToolbar.jsx';
import SearchSelect from '../components/common/SearchSelect.jsx';

function formatApiError(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (Array.isArray(data) && data.length === 1 && typeof data[0] === 'string') {
    return data[0];
  }
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const parts = [];
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) parts.push(`${key}: ${value.join(' ')}`);
      else if (typeof value === 'string') parts.push(`${key}: ${value}`);
    });
    if (parts.length) return parts.join('\n');
  }
  return fallback;
}

const ROLE_OPTIONS = [
  { value: 'CLIENT', label: 'Клиент' },
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'ADMIN', label: 'Администратор' },
];

const ROLE_FILTER_OPTIONS = [{ value: '', label: 'Любая' }, ...ROLE_OPTIONS];

const ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'Любое' },
  { value: 'true', label: 'Да' },
  { value: 'false', label: 'Нет' },
];

const USER_ORDER_OPTIONS = [
  { value: '', label: 'По умолчанию' },
  { value: 'username', label: 'Логин А–Я' },
  { value: '-username', label: 'Логин Я–А' },
  { value: 'email', label: 'Email А–Я' },
  { value: '-email', label: 'Email Я–А' },
];

const USER_ORDER_TAG_LABELS = Object.fromEntries(USER_ORDER_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]));

function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get('q') || '';
  const roleFromUrl = searchParams.get('role') || '';
  const isActiveFromUrl = searchParams.get('is_active') || '';
  const orderingFromUrl = searchParams.get('ordering') || '';

  const queryParams = useMemo(() => {
    const p = {};
    if (qFromUrl.trim()) p.q = qFromUrl.trim();
    if (roleFromUrl) p.role = roleFromUrl;
    if (isActiveFromUrl) p.is_active = isActiveFromUrl;
    if (orderingFromUrl) p.ordering = orderingFromUrl;
    return p;
  }, [qFromUrl, roleFromUrl, isActiveFromUrl, orderingFromUrl]);

  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null); // 'edit' | 'create' | null
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: '',
    is_active: true,
  });
  const [password, setPassword] = useState('');
  const [isPasswordPlaceholder, setIsPasswordPlaceholder] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [adminGuardError, setAdminGuardError] = useState(null);
  const [confirmUser, setConfirmUser] = useState(null);

  const load = (params = null) => {
    const requestParams = params && Object.keys(params).length > 0 ? params : null;
    api
      .get('users/', requestParams ? { params: requestParams } : undefined)
      .then((response) => setUsers(response.data))
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load users', err);
        setError(formatApiError(err, 'Не удалось загрузить пользователей'));
      });
  };

  useEffect(() => {
    load(queryParams);
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

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '' || value === 'all') next.delete(key);
    else next.set(key, String(value));
    setSearchParams(next);
  };

  const removeTag = (key) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next);
    if (key === 'q') setQDraft('');
  };

  const activeTags = useMemo(() => {
    const tags = [];
    if (qFromUrl.trim()) tags.push({ key: 'q', label: `Поиск: ${qFromUrl.trim()}` });
    if (roleFromUrl) {
      const roleLabel = ROLE_OPTIONS.find((r) => r.value === roleFromUrl)?.label || roleFromUrl;
      tags.push({ key: 'role', label: `Роль: ${roleLabel}` });
    }
    if (isActiveFromUrl) tags.push({ key: 'is_active', label: isActiveFromUrl === 'true' ? 'Активен' : 'Не активен' });
    if (orderingFromUrl) {
      tags.push({ key: 'ordering', label: `Сортировка: ${USER_ORDER_TAG_LABELS[orderingFromUrl] || orderingFromUrl}` });
    }
    return tags;
  }, [qFromUrl, roleFromUrl, isActiveFromUrl, orderingFromUrl]);

  const resetFilters = () => {
    setSearchParams({}, { replace: false });
    setQDraft('');
  };

  const startEdit = (user) => {
    setError(null);
    setAdminGuardError(null);
    setMode('edit');
    setEditingUser(user);
    setForm({
      username: user.username || '',
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: apiPhoneToDisplay(user.phone || ''),
      role: user.role || 'CLIENT',
      is_active: Boolean(user.is_active),
    });
    setPassword('********');
    setIsPasswordPlaceholder(true);
    setShowPassword(false);
  };

  const cancel = () => {
    setMode(null);
    setEditingUser(null);
    setSaving(false);
    setForm({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role: '',
      is_active: true,
    });
    setPassword('');
    setIsPasswordPlaceholder(false);
    setShowPassword(false);
    setAdminGuardError(null);
  };

  const startCreate = () => {
    setError(null);
    setAdminGuardError(null);
    setMode('create');
    setEditingUser(null);
    setForm({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role: 'CLIENT',
      is_active: true,
    });
    setPassword('');
    setIsPasswordPlaceholder(false);
    setShowPassword(false);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!editingUser && mode !== 'create') return;

    const username = form.username.trim();
    const email = form.email.trim();
    const role = form.role;
    const passwordTrimmed = password.trim();

    if (!username) {
      setError('Введите логин пользователя');
      return;
    }
    if (!email) {
      setError('Введите email пользователя');
      return;
    }
    if (!role) {
      setError('Выберите роль пользователя');
      return;
    }

    setSaving(true);
    setError(null);
    setAdminGuardError(null);

    const payload = {
      username,
      email,
      first_name: (form.first_name || '').trim(),
      last_name: (form.last_name || '').trim(),
      phone: phoneToApi(form.phone || ''),
      role,
      is_active: Boolean(form.is_active),
    };
    if (!isPasswordPlaceholder && passwordTrimmed) {
      payload.password = passwordTrimmed;
    }

    const request = mode === 'create'
      ? api.post('users/', payload)
      : api.patch(`users/${editingUser.id}/`, payload);

    request
      .then(() => {
        cancel();
        load(queryParams);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to save user', err);
        const message = formatApiError(err, 'Не удалось сохранить пользователя');
        if (message && message.includes('хотя бы один активный администратор')) {
          setAdminGuardError(message);
        } else {
          setError(message);
        }
      })
      .finally(() => setSaving(false));
  };

  const getActiveAdminsCount = () => users.filter((u) => u.role === 'ADMIN' && u.is_active).length;

  const handleSoftDelete = (user) => {
    if (user.role === 'ADMIN' && user.is_active && getActiveAdminsCount() === 1) {
      setAdminGuardError('Должен быть хотя бы один активный администратор.');
      return;
    }
    setConfirmUser(user);
  };

  const confirmSoftDelete = () => {
    if (!confirmUser) return;
    setSaving(true);
    setError(null);
    setAdminGuardError(null);
    api
      .patch(`users/${confirmUser.id}/`, { is_active: false })
      .then(() => {
        setConfirmUser(null);
        load(queryParams);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to delete user', err);
        const message = formatApiError(err, 'Не удалось удалить пользователя');
        if (message && message.includes('хотя бы один активный администратор')) {
          setAdminGuardError(message);
        } else {
          setError(message);
        }
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <h2 className="dashboard-card__title">Пользователи</h2>
        <button type="button" className="btn btn--primary" onClick={startCreate} disabled={saving}>
          Добавить пользователя
        </button>
      </div>
      <div className="dashboard-card__body">
        {error && (
          <div className="dashboard-alert" style={{ whiteSpace: 'pre-wrap' }}>
            {error}
          </div>
        )}

        <DashboardListToolbar
          q={qDraft}
          placeholder="Поиск по логину или почте"
          onQChange={setQDraft}
          resetLabel="Сбросить все"
          onReset={resetFilters}
          resetDisabled={!activeTags || activeTags.length === 0}
          activeTags={activeTags}
          onRemoveTag={removeTag}
        >
          <>
            <div className="form-group" style={{ minWidth: 220 }}>
              <label htmlFor="users-filter-role">Роль</label>
              <SearchSelect
                options={ROLE_FILTER_OPTIONS}
                value={roleFromUrl}
                onChange={(val) => updateParam('role', val)}
                placeholder="Любая"
                withIcons={false}
                searchable={false}
              />
            </div>

            <div className="form-group" style={{ minWidth: 180 }}>
              <label htmlFor="users-filter-active">Активен</label>
              <SearchSelect
                options={ACTIVE_FILTER_OPTIONS}
                value={isActiveFromUrl}
                onChange={(val) => updateParam('is_active', val)}
                placeholder="Любое"
                withIcons={false}
                searchable={false}
              />
            </div>

            <div className="form-group" style={{ minWidth: 220 }}>
              <label htmlFor="users-filter-ordering">Сортировка</label>
              <SearchSelect
                options={USER_ORDER_OPTIONS}
                value={orderingFromUrl}
                onChange={(val) => updateParam('ordering', val)}
                placeholder="По умолчанию"
                withIcons={false}
                searchable={false}
              />
            </div>
          </>
        </DashboardListToolbar>

        {users.length === 0 ? (
          <p>Пользователи не найдены.</p>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Логин</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Активен</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.is_active ? 'Да' : 'Нет'}</td>
                  <td>
                    <div className="dashboard-actions">
                      <button
                        type="button"
                        className="btn btn--icon"
                        onClick={() => startEdit(user)}
                        disabled={saving}
                        title="Редактировать пользователя"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="btn btn--icon btn--danger"
                        onClick={() => handleSoftDelete(user)}
                        disabled={saving}
                        title="Удалить пользователя"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(mode === 'edit' && editingUser) || mode === 'create' ? (
          <div className="dashboard-modal">
            <div className="dashboard-modal__backdrop" onClick={cancel} role="presentation" />
            <div className="dashboard-modal__content">
              <div className="dashboard-modal__header">
                <h3 className="dashboard-modal__title">
                  {mode === 'create'
                    ? 'Создание пользователя'
                    : `Редактирование пользователя #${editingUser.id}`}
                </h3>
                <button type="button" className="dashboard-modal__close" onClick={cancel} disabled={saving}>
                  ×
                </button>
              </div>
              <div className="dashboard-modal__body">
                <form onSubmit={submit}>
                  <div className="dashboard-form-row">
                    <div className="form-group">
                      <label htmlFor="user-username">Логин</label>
                      <input
                        id="user-username"
                        type="text"
                        className="dash-modal-control"
                        value={form.username}
                        onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="user-email">Email</label>
                      <input
                        id="user-email"
                        type="email"
                        className="dash-modal-control"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="dashboard-form-row">
                    <div className="form-group">
                      <label htmlFor="user-first-name">Имя</label>
                      <input
                        id="user-first-name"
                        type="text"
                        className="dash-modal-control"
                        value={form.first_name}
                        onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                        disabled={saving}
                        autoComplete="off"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="user-last-name">Фамилия</label>
                      <input
                        id="user-last-name"
                        type="text"
                        className="dash-modal-control"
                        value={form.last_name}
                        onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                        disabled={saving}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="dashboard-form-row">
                    <div className="form-group" style={{ flex: '1 1 100%' }}>
                      <label htmlFor="user-phone">Телефон</label>
                      <input
                        id="user-phone"
                        type="tel"
                        inputMode="numeric"
                        className="dash-modal-control"
                        placeholder="+7 (999) 999-99-99"
                        value={form.phone}
                        onChange={(e) => setForm((p) => ({ ...p, phone: onPhoneInputChange(e.target.value) }))}
                        disabled={saving}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="dashboard-form-row">
                    <div className="form-group">
                      <label htmlFor="user-password">Пароль</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          id="user-password"
                          className="dash-modal-control"
                        type={showPassword ? 'text' : 'password'}
                          value={password}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (isPasswordPlaceholder) {
                            setIsPasswordPlaceholder(false);
                            setPassword(next.replace(/^(\*+)*/, ''));
                          } else {
                            setPassword(next);
                          }
                        }}
                          disabled={saving}
                        placeholder={mode === 'edit' && !password ? 'Оставьте пустым, чтобы не менять' : ''}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn--secondary btn--small"
                        onClick={() => {
                          if (isPasswordPlaceholder) return;
                          setShowPassword((v) => !v);
                        }}
                        disabled={saving || isPasswordPlaceholder}
                        >
                          {showPassword ? '👁‍🗨' : '👁'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-form-row">
                    <div className="form-group" style={{ flex: '1.6 1 280px', minWidth: 280 }}>
                      <label>Роль</label>
                      <SearchSelect
                        options={ROLE_OPTIONS}
                        value={form.role}
                        onChange={(val) => setForm((p) => ({ ...p, role: val }))}
                        placeholder="Роль"
                        withIcons={false}
                        searchable={false}
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="user-active">Активен</label>
                      <label className="checkbox-label" htmlFor="user-active">
                        <input
                          id="user-active"
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                          disabled={saving}
                          style={{ transform: 'scale(1.3)' }}
                        />
                        <span>Активен</span>
                      </label>
                    </div>
                  </div>

                  <div className="dashboard-modal__footer">
                    <button type="submit" className="btn btn--primary" disabled={saving}>
                      {mode === 'create' ? 'Создать' : 'Сохранить'}
                    </button>
                    <button type="button" className="btn btn--secondary" onClick={cancel} disabled={saving}>
                      Отмена
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        {adminGuardError && (
          <div className="dashboard-modal">
            <div className="dashboard-modal__backdrop" onClick={() => setAdminGuardError(null)} role="presentation" />
            <div className="dashboard-modal__content" style={{ maxWidth: 420 }}>
              <div className="dashboard-modal__header">
                <h3 className="dashboard-modal__title">Нельзя деактивировать последнего администратора</h3>
                <button
                  type="button"
                  className="dashboard-modal__close"
                  onClick={() => setAdminGuardError(null)}
                  disabled={saving}
                >
                  ×
                </button>
              </div>
              <div className="dashboard-modal__body">
                <p style={{ marginBottom: 0 }}>{adminGuardError}</p>
              </div>
              <div className="dashboard-modal__footer">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setAdminGuardError(null)}
                  disabled={saving}
                >
                  Понятно
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmUser && (
          <ConfirmModal
            title="Удаление пользователя"
            message="Вы уверены, что хотите удалить (деактивировать) этого пользователя?"
            confirmLabel="Удалить"
            cancelLabel="Отмена"
            onConfirm={confirmSoftDelete}
            onCancel={() => !saving && setConfirmUser(null)}
            busy={saving}
          />
        )}
      </div>
    </div>
  );
}

export default UsersPage;

