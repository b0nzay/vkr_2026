import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';

function formatApiError(err, fallback) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  let detail = fallback;
  if (typeof data === 'string') detail = data;
  else if (data && typeof data.detail === 'string') detail = data.detail;
  const hints = [];
  if (status === 403) {
    hints.push('Нужны права: группа «Администратор», core.view_reports или суперпользователь.');
  }
  if (status === 500) {
    hints.push('Проверьте лог сервера. Частая причина — не применены миграции: python manage.py migrate');
  }
  if (status && status !== 403 && status !== 500) hints.push(`HTTP ${status}`);
  return [detail, ...hints].filter(Boolean).join(' ');
}

function normalizeListPayload(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU');
}

function actionBadgeClass(action) {
  const normalized = String(action || '').toUpperCase();
  if (normalized === 'CREATE') return 'dashboard-badge dashboard-badge--completed';
  if (normalized === 'DELETE') return 'dashboard-badge dashboard-badge--cancelled';
  return 'dashboard-badge dashboard-badge--processing';
}

function DiffBlock({ title, data }) {
  return (
    <div className="audit-log-diff">
      <h4 className="audit-log-diff__title">{title}</h4>
      {data ? (
        <pre className="audit-log-diff__json">{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <p className="text-muted">Нет данных.</p>
      )}
    </div>
  );
}

function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailError, setDetailError] = useState('');

  const [query, setQuery] = useState('');
  const [action, setAction] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const params = {};
    if (query.trim()) params.q = query.trim();
    if (action !== 'all') params.action = action;

    api
      .get('audit-logs/', { params })
      .then((response) => {
        if (cancelled) return;
        setLogs(normalizeListPayload(response.data));
      })
      .catch((err) => {
        console.error('Failed to load audit logs', err);
        if (!cancelled) {
          setError(formatApiError(err, 'Не удалось загрузить журнал изменений.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, action]);

  useEffect(() => {
    if (!selected) {
      setSelectedDetail(null);
      setDetailError('');
      return;
    }

    let cancelled = false;
    setSelectedDetail(null);
    setDetailError('');

    api
      .get(`audit-logs/${selected.id}/`)
      .then((response) => {
        if (!cancelled) setSelectedDetail(response.data);
      })
      .catch((err) => {
        console.error('Failed to load audit log detail', err);
        if (!cancelled) {
          setDetailError(formatApiError(err, 'Не удалось загрузить детали изменения.'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const title = useMemo(() => {
    if (!selected) return 'Детали изменения';
    return `${selected.action_label}: ${selected.entity_type} #${selected.object_id}`;
  }, [selected]);

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <h2 className="dashboard-card__title">Журнал изменений</h2>
      </div>
      <div className="dashboard-card__body">
        <div className="dashboard-list-toolbar">
          <div className="dashboard-list-toolbar__row">
            <div className="dashboard-list-toolbar__search">
              <label htmlFor="audit-search">Поиск</label>
              <input
                id="audit-search"
                type="text"
                placeholder="Сущность, объект, пользователь, описание"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="audit-action">Действие</label>
              <select id="audit-action" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="all">Все</option>
                <option value="CREATE">Создание</option>
                <option value="UPDATE">Изменение</option>
                <option value="DELETE">Удаление</option>
              </select>
            </div>
          </div>
        </div>

        {error ? <div className="dashboard-alert">{error}</div> : null}

        {loading ? (
          <p>Загрузка журнала...</p>
        ) : logs.length === 0 ? (
          <p>Записей пока нет.</p>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Пользователь</th>
                <th>Действие</th>
                <th>Сущность</th>
                <th>Кратко</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="audit-log-row"
                  onClick={() => setSelected(log)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(log);
                    }
                  }}
                >
                  <td>{formatDateTime(log.created_at)}</td>
                  <td>{log.actor_username || 'Система'}</td>
                  <td>
                    <span className={actionBadgeClass(log.action)}>{log.action_label}</span>
                  </td>
                  <td>{`${log.entity_type} #${log.object_id}`}</td>
                  <td>{log.summary || log.object_repr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <div className="dashboard-modal" role="dialog" aria-modal="true" aria-label={title}>
          <div className="dashboard-modal__backdrop" onClick={() => setSelected(null)} />
          <div className="dashboard-modal__content audit-log-modal">
            <div className="dashboard-modal__header">
              <h3 className="dashboard-modal__title">{title}</h3>
              <button type="button" className="dashboard-modal__close" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>
            <div className="dashboard-modal__body">
              {detailError ? <div className="dashboard-alert">{detailError}</div> : null}
              {!selectedDetail && !detailError ? (
                <p>Загрузка деталей...</p>
              ) : (
                <>
                  <p className="text-muted">
                    {`Автор: ${selectedDetail?.actor_username || 'Система'} · Время: ${formatDateTime(selectedDetail?.created_at)}`}
                  </p>
                  <div className="audit-log-diff-grid">
                    <DiffBlock title="Было" data={selectedDetail?.before_data} />
                    <DiffBlock title="Стало" data={selectedDetail?.after_data} />
                  </div>
                </>
              )}
            </div>
            <div className="dashboard-modal__footer">
              <button type="button" className="btn btn--secondary" onClick={() => setSelected(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AdminAuditLogsPage;
