export const ORDER_STATUS_LABELS = {
  NEW: 'Новый',
  PROCESSING: 'В обработке',
  COMPLETED: 'Завершён',
  CANCELED: 'Отменён',
};

export function orderStatusLabel(code) {
  return ORDER_STATUS_LABELS[code] || code || '—';
}

export function orderStatusClass(code) {
  const key = (code || '').toLowerCase();
  return `status-badge status-badge--${key}`;
}

export function formatOrderDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
