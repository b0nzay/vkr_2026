import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  searchable = true,
  withIcons = true,
  dropdownClassName = '',
  renderOption,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!searchable) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label || '').toLowerCase().includes(q));
  }, [options, query, searchable]);

  const selected = options.find((o) => String(o.value) === String(value)) || null;

  const handleSelect = (option) => {
    if (disabled) return;
    onChange && onChange(option.value);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`search-select${disabled ? ' search-select--disabled' : ''}`}>
      <div
        className="search-select__control"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            !disabled && setOpen((prev) => !prev);
          }
        }}
      >
        {withIcons && (
          selected && selected.iconUrl ? (
            <img src={selected.iconUrl} alt="" className="search-select__icon" />
          ) : (
            <div className="search-select__icon search-select__icon--placeholder" />
          )
        )}
        <div className="search-select__value">
          {selected ? selected.label : placeholder || '— Не выбрано —'}
        </div>
        <div className="search-select__arrow">{open ? '▴' : '▾'}</div>
      </div>

      {open && !disabled && (
        <div className={`search-select__dropdown${dropdownClassName ? ` ${dropdownClassName}` : ''}`}>
          {searchable && (
            <input
              className="search-select__input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск..."
              autoFocus
            />
          )}
          <div className="search-select__list">
            {filtered.length === 0 ? (
              <div className="search-select__empty">Ничего не найдено</div>
            ) : (
              filtered.map((o) => {
                if (renderOption) {
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className="search-select__option search-select__option--custom"
                      onClick={() => handleSelect(o)}
                    >
                      {renderOption(o)}
                    </button>
                  );
                }

                return (
                  <button
                    key={o.value}
                    type="button"
                    className="search-select__option"
                    onClick={() => handleSelect(o)}
                  >
                    {withIcons && (
                      o.iconUrl ? (
                        <img src={o.iconUrl} alt="" className="search-select__icon" />
                      ) : (
                        <div className="search-select__icon search-select__icon--placeholder" />
                      )
                    )}
                    <span className="search-select__label">{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

