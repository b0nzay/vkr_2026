import React from 'react';

function ActiveFilterTags({ tags, onRemoveTag }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="active-filters" role="region" aria-label="Активные фильтры">
      {tags.map((t) => (
        <span key={t.key} className="filter-tag filter-tag--accent" title={t.title || t.label}>
          <span className="filter-tag__text">{t.label}</span>
          {onRemoveTag ? (
            <button
              type="button"
              className="filter-tag__remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTag(t.key);
              }}
              aria-label="Убрать фильтр"
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export default function DashboardListToolbar({
  q,
  onQChange,
  placeholder,
  /** Кнопка сброса в блоке фильтров (под поиском), не в верхней строке */
  resetLabel = null,
  onReset = null,
  resetDisabled = false,
  activeTags = [],
  onRemoveTag = null,
  children = null,
}) {
  const showFiltersRow = Boolean(children) || Boolean(resetLabel && onReset);

  return (
    <div className="dashboard-list-toolbar">
      <div className="dashboard-list-toolbar__row">
        <div className="dashboard-list-toolbar__search">
          <input
            type="text"
            value={q}
            onChange={(e) => onQChange && onQChange(e.target.value)}
            placeholder={placeholder || 'Поиск...'}
          />
        </div>
      </div>

      {showFiltersRow ? (
        <div className="dashboard-list-toolbar__filters">
          {children}
          {resetLabel && onReset ? (
            <div className="dashboard-list-toolbar__filters-reset">
              <button
                type="button"
                className="btn btn--secondary btn--small"
                onClick={onReset}
                disabled={resetDisabled}
              >
                {resetLabel}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <ActiveFilterTags tags={activeTags} onRemoveTag={onRemoveTag} />
    </div>
  );
}
