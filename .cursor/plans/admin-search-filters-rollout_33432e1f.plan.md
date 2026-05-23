---
name: admin-search-filters-rollout
overview: Внедрить единый UX поиска и фильтров на всех вкладках админки с server-side логикой в DRF и более «умным» поиском по нескольким полям/связям, без перегруза интерфейса.
todos:
  - id: backend-query-contract
    content: Добавить server-side query фильтры и токенизированный multi-field поиск в viewsets admin-сущностей в api/views.py
    status: pending
  - id: frontend-toolbar-component
    content: Сделать общий toolbar-компонент для поиска/фильтров и подключить его на все админ-вкладки
    status: pending
  - id: api-hooks-query-params
    content: Обновить frontend API-хуки/загрузчики для передачи query params и debounce-поиска
    status: pending
  - id: url-state-sync
    content: Синхронизировать фильтры с URL search params на каждой странице
    status: pending
  - id: qa-and-polish
    content: Проверить сценарии, edge-cases, пустые состояния, затем прогнать линтер/сборку
    status: pending
isProject: false
---

# План внедрения поиска и фильтров в админке

## Цель

Сделать на всех админ-вкладках (`Товары`, `Пользователи`, `Категории`, `Авто`, `Конфигурации`) одинаковый и быстрый toolbar: поиск + ключевые фильтры + сброс, с поддержкой server-side query-параметров и "умного" матчинга по нескольким полям, а не только по имени.

## Что уже есть в коде

- Страницы без toolbar-поиска, таблицы/дерево рендерятся целиком:
  - [frontend/src/pages/ProductsPage.jsx](frontend/src/pages/ProductsPage.jsx)
  - [frontend/src/pages/UsersPage.jsx](frontend/src/pages/UsersPage.jsx)
  - [frontend/src/pages/CategoriesPage.jsx](frontend/src/pages/CategoriesPage.jsx)
  - [frontend/src/pages/CarsPage.jsx](frontend/src/pages/CarsPage.jsx)
  - [frontend/src/pages/TechVariantsPage.jsx](frontend/src/pages/TechVariantsPage.jsx)
- В API нет стандартных filter backends для этих list endpoint’ов:
  - [api/views.py](api/views.py)

## Архитектурный подход (выбран)

- **Server-side как основа** для всех вкладок.
- "Немного умный" поиск:
  - multi-field поиск (не только `name`),
  - нормализация строки (trim/lower),
  - токенизация запроса (`q="термостат opel"` -> оба токена должны матчиться в наборе полей).
- На фронте хранить фильтры в URL query params, чтобы работали refresh/back/шаринг ссылки.

## Этап 1 — Бэкенд: единый контракт фильтров

1. В [api/views.py](api/views.py) добавить для нужных viewset’ов обработку query-параметров в `get_queryset()`:
  - `products`: `q`, `category`, `brand_name`, `compatibility_mode`, `in_stock`, `ordering`.
  - `users`: `q`, `role`, `is_active`, `ordering`.
  - `categories`: `q`, `parent` (`root` / id).
  - `cars`-сущности:
    - `brands`: `q`
    - `car-models`: `q`, `brand`
    - `generations`: `q`, `car_model`
    - `body-types`: `generation`, `name`
  - `tech-variants`: `q`, `generation`, `transmission_type`, `ordering`.
2. Для "умного" поиска добавить helper-функцию (в `api/views.py` или отдельный модуль), которая:
  - разбивает `q` на токены,
  - строит `Q(...)` по нескольким полям,
  - требует совпадение всех токенов (AND по токенам, OR по полям токена).
3. Обновить docs-контракт параметров в [docs/api.md](docs/api.md) (кратко: какие query поддерживаются).

## Этап 2 — Фронтенд: общий toolbar-паттерн

1. Добавить общий компонент toolbar (например `DashboardListToolbar`) в `frontend/src/components/common/`:
  - поле поиска,
  - компактные select/переключатели фильтров,
  - кнопка `Сбросить`.
2. Встроить toolbar во все страницы:
  - [frontend/src/pages/ProductsPage.jsx](frontend/src/pages/ProductsPage.jsx)
  - [frontend/src/pages/UsersPage.jsx](frontend/src/pages/UsersPage.jsx)
  - [frontend/src/pages/CategoriesPage.jsx](frontend/src/pages/CategoriesPage.jsx)
  - [frontend/src/pages/CarsPage.jsx](frontend/src/pages/CarsPage.jsx)
  - [frontend/src/pages/TechVariantsPage.jsx](frontend/src/pages/TechVariantsPage.jsx)
3. Привязать state фильтров к URL (`searchParams`) + debounce для поля `q` (примерно 300–400ms), чтобы снизить число запросов.

## Этап 3 — API-хуки и загрузка данных

1. Расширить клиентские хуки/API-вызовы, чтобы передавать query params в list-запросы:
  - [frontend/src/api/useProducts.js](frontend/src/api/useProducts.js)
  - добавить/обновить аналогичные хуки для users/categories/cars/tech.
2. Для вкладки `Авто` собрать фильтры на уровне страницы и применять их к нескольким endpoint’ам иерархии согласованно.

## Этап 4 — UX и консистентность

1. Единые плейсхолдеры поиска по смыслу вкладки:
  - Товары: "Поиск по названию, артикулу, бренду, совместимости"
  - Конфигурации: "Поиск по марке, модели, поколению, коду двигателя/КПП"
  - и т.д.
2. Показ активных фильтров и быстрый reset на каждой странице.
3. Сохранить текущие CRUD-модалки без изменений поведения.

## Этап 5 — Проверка и критерии готовности

1. Для каждой вкладки проверить:
  - фильтры влияют на серверный запрос,
  - refresh страницы сохраняет состояние,
  - back/forward корректно восстанавливают фильтры.
2. Проверить edge-cases:
  - пустой результат,
  - спецсимволы/пробелы в `q`,
  - сочетание нескольких фильтров.
3. Прогнать линтеры и сборку фронта.

## Скоуп MVP (первая реализация)

- Внедрение сразу на всех вкладках, но с минимально достаточным набором фильтров на каждую.
- Без тяжелых фич вроде полнотекстового индекса PostgreSQL на первом шаге (можно добавить следующим этапом, если данных станет очень много).

