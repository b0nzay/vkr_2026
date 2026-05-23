import React, { useId, useMemo, useState } from 'react';
import api from '../api/client.js';

const ENTITY_LABELS = {
  cars: 'Авто',
  tech_variants: 'Конфигурации',
  products: 'Товары',
};

const ENTITY_CONFLICT_KEYS = {
  cars: 'марка + модель + поколение + тип кузова',
  tech_variants: 'поколение + код двигателя + код коробки передач',
  products: 'артикул (SKU)',
};

const ENTITY_REQUIRED = {
  cars: ['brand', 'model', 'generation', 'body_type'],
  tech_variants: ['brand', 'model', 'generation', 'engine_code', 'transmission_code', 'transmission_type'],
  products: ['sku', 'name', 'price', 'stock', 'category'],
};

function normalizeImportError(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  return fallback;
}

function ReportPanel({ report }) {
  if (!report) return null;
  return (
    <div className="import-report">
      <div className="import-report__stats">
        <span className="dashboard-badge dashboard-badge--created">Создано: {report.created}</span>
        <span className="dashboard-badge dashboard-badge--completed">Обновлено: {report.updated}</span>
        <span className="dashboard-badge dashboard-badge--in_progress">Пропущено: {report.skipped}</span>
        <span className="dashboard-badge dashboard-badge--cancelled">Ошибок: {report.failed}</span>
      </div>
      <p className="import-report__meta">
        Всего строк: {report.total}. Конфликтов ключей: {report.conflicts}. Картинок привязано: {report.images_attached}, не найдено:{' '}
        {report.images_missing}.
      </p>
      {Array.isArray(report.invalid_image_paths) && report.invalid_image_paths.length > 0 ? (
        <div className="dashboard-alert" style={{ whiteSpace: 'pre-wrap' }}>
          Небезопасные пути в архиве изображений:
          {'\n'}
          {report.invalid_image_paths.join('\n')}
        </div>
      ) : null}
      {Array.isArray(report.errors) && report.errors.length > 0 ? (
        <div className="import-report__errors">
          {report.errors.slice(0, 15).map((err, idx) => (
            <div key={`${err.row}-${idx}`} className="import-report__error-line">
              Строка {err.row}: {err.message}
            </div>
          ))}
          {report.errors.length > 15 ? <div className="import-report__error-line">...и еще {report.errors.length - 15} ошибок</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function XlsxImportHelpPanel({ entityType, entityLabel }) {
  const conflictKey = ENTITY_CONFLICT_KEYS[entityType] || '';
  const required = ENTITY_REQUIRED[entityType] || [];

  return (
    <div className="dashboard-modal__body">
      <div className="import-help__section">
        <p className="import-help__title">Файл XLSX</p>
        <p className="import-help__text">
          Берётся <strong>активный лист</strong> книги Excel. <strong>Первая строка</strong> — заголовки колонок (имена полей, как в API).{' '}
          <strong>Со второй строки</strong> — строки данных; полностью пустые строки пропускаются. Поддерживаются те же поля, что и при импорте{' '}
          <span className="import-help__code">.json</span> (массив объектов) — формат JSON менять не нужно, его по-прежнему можно выбрать в этом
          окне.
        </p>
      </div>
      <div className="import-help__section">
        <p className="import-help__title">Сущность: {entityLabel}</p>
        <p className="import-help__text">
          Ключ для поиска дубликатов (конфликтов): <strong>{conflictKey}</strong>.
        </p>
        <p className="import-help__text">Обязательные колонки (хотя бы одно из допустимых имён поля по строке):</p>
        <ul className="import-help__list">
          {required.map((f) => (
            <li key={f}>
              <span className="import-help__code">{f}</span>
            </li>
          ))}
        </ul>
      </div>
      {entityType === 'products' ? (
        <div className="import-help__section">
          <p className="import-help__title">Совместимость товаров (необязательно)</p>
          <p className="import-help__text">
            <span className="import-help__code">body_type_refs</span> — несколько значений через точку с запятой, формат каждого:{' '}
            <span className="import-help__code">Марка|Модель|Поколение|КодКузова</span> (например, <span className="import-help__code">SEDAN</span>).
          </p>
          <p className="import-help__text">
            <span className="import-help__code">tech_variant_refs</span> — формат:{' '}
            <span className="import-help__code">Марка|Модель|Поколение|КодДвигателя|КодКПП</span>, несколько через «;».
          </p>
        </div>
      ) : null}
      <div className="import-help__section">
        <p className="import-help__title">Изображения (необязательно)</p>
        <p className="import-help__text">
          Можно приложить архив <span className="import-help__code">.zip</span> и указать в таблице относительные пути: для товаров —{' '}
          <span className="import-help__code">image_path</span>, для авто — <span className="import-help__code">brand_logo_path</span>,{' '}
          <span className="import-help__code">generation_image_path</span>, <span className="import-help__code">body_type_image_path</span>. Путь
          внутри архива, без «..» и абсолютных путей; расширения: jpg, jpeg, png, webp, gif.
        </p>
      </div>
      <div className="import-help__section">
        <p className="import-help__title">Режимы при конфликте ключей</p>
        <ul className="import-help__list">
          <li>
            <span className="import-help__code">update</span> — обновить существующую запись
          </li>
          <li>
            <span className="import-help__code">skip</span> — пропустить строку с конфликтом
          </li>
          <li>
            <span className="import-help__code">stop</span> — остановить импорт на первом конфликте
          </li>
        </ul>
        <p className="import-help__text">
          Рекомендуемый порядок загрузки справочников: сначала авто (<span className="import-help__code">cars</span>), затем конфигурации (
          <span className="import-help__code">tech_variants</span>), затем товары (<span className="import-help__code">products</span>).
        </p>
      </div>
    </div>
  );
}

export default function ImportDataModal({ entityType, onImported, triggerLabel = 'Импорт XLSX' }) {
  const dataInputId = useId();
  const zipInputId = useId();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dataFile, setDataFile] = useState(null);
  const [imagesZip, setImagesZip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [conflictMode, setConflictMode] = useState('stop');
  const [showConflictChooser, setShowConflictChooser] = useState(false);

  const entityLabel = useMemo(() => ENTITY_LABELS[entityType] || entityType, [entityType]);

  const buildFormData = (mode) => {
    const fd = new FormData();
    fd.append('entity_type', entityType);
    fd.append('conflict_mode', mode);
    fd.append('data_file', dataFile);
    if (imagesZip) fd.append('images_zip', imagesZip);
    return fd;
  };

  const handlePreview = async () => {
    if (!dataFile) {
      setError('Выберите файл данных (.json или .xlsx).');
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setShowConflictChooser(false);
    try {
      const response = await api.post('import/preview/', buildFormData('stop'));
      setReport(response?.data?.report || null);
    } catch (err) {
      setError(normalizeImportError(err, 'Не удалось выполнить проверку импорта.'));
    } finally {
      setLoading(false);
    }
  };

  const executeImport = async (mode) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('import/execute/', buildFormData(mode));
      setReport(response?.data?.report || null);
      setShowConflictChooser(false);
      if (onImported) onImported();
    } catch (err) {
      setError(normalizeImportError(err, 'Не удалось выполнить импорт.'));
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    if (!report) return;
    if ((report.conflicts || 0) > 0) {
      setShowConflictChooser(true);
      return;
    }
    executeImport('stop');
  };

  const resetAndClose = () => {
    setOpen(false);
    setHelpOpen(false);
    setDataFile(null);
    setImagesZip(null);
    setError(null);
    setReport(null);
    setShowConflictChooser(false);
    setConflictMode('stop');
  };

  const fileBtnDisabled = loading;

  return (
    <>
      <button type="button" className="btn btn--secondary" onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
      {open ? (
        <div className="dashboard-modal">
          <div className="dashboard-modal__backdrop" onClick={loading ? undefined : resetAndClose} role="presentation" />
          <div className="dashboard-modal__content dashboard-modal__content--wide">
            <div className="dashboard-modal__header">
              <h3 className="dashboard-modal__title">Импорт: {entityLabel}</h3>
              <div className="import-modal__header-tools">
                <button
                  type="button"
                  className="import-modal__help-btn"
                  onClick={() => setHelpOpen(true)}
                  disabled={loading}
                  aria-label="Справка по оформлению XLSX для импорта"
                  title="Справка по XLSX"
                >
                  !
                </button>
                <button type="button" className="dashboard-modal__close" onClick={resetAndClose} disabled={loading}>
                  ×
                </button>
              </div>
            </div>
            <div className="dashboard-modal__body">
              {error ? <div className="dashboard-alert">{error}</div> : null}
              <div className="form-group">
                <span className="form-group__label">Файл данных (.json / .xlsx)</span>
                <div className="dashboard-file">
                  <input
                    id={dataInputId}
                    className="dashboard-file__input"
                    type="file"
                    accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={loading}
                    onChange={(e) => setDataFile(e.target.files?.[0] || null)}
                  />
                  <label
                    htmlFor={dataInputId}
                    className={`dashboard-file__btn${fileBtnDisabled ? ' dashboard-file__btn--disabled' : ''}`}
                  >
                    Выбрать файл
                  </label>
                  <div className="dashboard-file__meta">{dataFile?.name || 'Файл не выбран'}</div>
                </div>
              </div>
              <div className="form-group">
                <span className="form-group__label">Архив изображений (опционально, .zip)</span>
                <div className="dashboard-file">
                  <input
                    id={zipInputId}
                    className="dashboard-file__input"
                    type="file"
                    accept=".zip,application/zip"
                    disabled={loading}
                    onChange={(e) => setImagesZip(e.target.files?.[0] || null)}
                  />
                  <label
                    htmlFor={zipInputId}
                    className={`dashboard-file__btn${fileBtnDisabled ? ' dashboard-file__btn--disabled' : ''}`}
                  >
                    Выбрать файл
                  </label>
                  <div className="dashboard-file__meta">{imagesZip?.name || 'Файл не выбран'}</div>
                </div>
              </div>
              <p className="import-modal__hint">
                Для картинок указывайте в данных поле <span className="import-help__code">image_path</span> (или{' '}
                <span className="import-help__code">*_image_path</span> для авто), например <span className="import-help__code">products/p123.jpg</span>.
              </p>
              <ReportPanel report={report} />
            </div>
            <div className="dashboard-modal__footer">
              <button type="button" className="btn btn--secondary" onClick={resetAndClose} disabled={loading}>
                Закрыть
              </button>
              <button type="button" className="btn btn--secondary" onClick={handlePreview} disabled={loading || !dataFile}>
                {loading ? 'Проверка...' : 'Проверить'}
              </button>
              <button type="button" className="btn btn--primary" onClick={handleImportClick} disabled={loading || !report}>
                {loading ? 'Импорт...' : 'Импортировать'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {helpOpen ? (
        <div className="dashboard-modal dashboard-modal--nested">
          <div className="dashboard-modal__backdrop" onClick={() => setHelpOpen(false)} role="presentation" />
          <div className="dashboard-modal__content dashboard-modal__content--wide">
            <div className="dashboard-modal__header">
              <h3 className="dashboard-modal__title">Справка: импорт XLSX ({entityLabel})</h3>
              <button type="button" className="dashboard-modal__close" onClick={() => setHelpOpen(false)} aria-label="Закрыть">
                ×
              </button>
            </div>
            <XlsxImportHelpPanel entityType={entityType} entityLabel={entityLabel} />
            <div className="dashboard-modal__footer">
              <button type="button" className="btn btn--primary" onClick={() => setHelpOpen(false)}>
                Понятно
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showConflictChooser ? (
        <div className="dashboard-modal dashboard-modal--nested">
          <div className="dashboard-modal__backdrop" onClick={loading ? undefined : () => setShowConflictChooser(false)} role="presentation" />
          <div className="dashboard-modal__content" style={{ maxWidth: 520 }}>
            <div className="dashboard-modal__header">
              <h3 className="dashboard-modal__title">Найдены конфликты ключей</h3>
              <button
                type="button"
                className="dashboard-modal__close"
                onClick={() => setShowConflictChooser(false)}
                disabled={loading}
              >
                ×
              </button>
            </div>
            <div className="dashboard-modal__body">
              <p className="import-modal__hint">Выберите стратегию: обновлять существующие записи, пропускать их или остановить импорт при первом конфликте.</p>
              <div className="form-group">
                <select value={conflictMode} onChange={(e) => setConflictMode(e.target.value)} className="dash-modal-control">
                  <option value="update">Обновлять существующие</option>
                  <option value="skip">Пропускать существующие</option>
                  <option value="stop">Остановить при конфликте</option>
                </select>
              </div>
            </div>
            <div className="dashboard-modal__footer">
              <button type="button" className="btn btn--secondary" onClick={() => setShowConflictChooser(false)} disabled={loading}>
                Отмена
              </button>
              <button type="button" className="btn btn--primary" onClick={() => executeImport(conflictMode)} disabled={loading}>
                Подтвердить импорт
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
