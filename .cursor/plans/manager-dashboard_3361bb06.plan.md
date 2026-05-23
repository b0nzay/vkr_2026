---
name: manager-dashboard
overview: Расширить дэшборд менеджера так, чтобы он использовал интерфейсы админки максимум по коду, но открывал только нужные разделы и ограничивал редактирование товаров до цены, описания и остатка, а также редактирование статусов заказов.
todos:
  - id: routes-manager-nav
    content: Расширить `/manager` маршруты в `frontend/src/App.jsx` и обновить `ManagerLayout` в `frontend/src/components/DashboardLayouts.jsx`, чтобы меню включало `Заказы`, `Товары`, `Категории`, `Авто`, `Конфигурации` (без `Users/Stats`).
    status: pending
  - id: products-permissions-props
    content: В `frontend/src/pages/ProductsPage.jsx` добавить режим менеджера и вычислить флаги `canCreate/canEdit/canDelete`; обновить gating-логику для модальных окон и удаления.
    status: pending
  - id: product-table-ui
    content: В `frontend/src/components/products/ProductTable.jsx` заменить `isAdmin` на переданные флаги, чтобы для менеджера показывалась только кнопка редактирования без удаления.
    status: pending
  - id: product-modal-edit-policy
    content: В `frontend/src/components/products/ProductModalForm.jsx` ввести `editPolicy` и отключить поля/кнопки, кроме `price`, `description`, `stock` (запретить `sku`, `category`, `brand_name`, совместимость и image upload), при этом обеспечить корректную отправку payload с неизменёнными значениями.
    status: pending
  - id: qa-checklist
    content: "Сделать проверку сценариев: админ (всё работает как раньше), менеджер (редактирование только разрешённых полей и только существующих товаров), а также проверить запрет на запрещённые действия через backend."
    status: pending
isProject: false
---

## Цель

Сформировать для роли «Менеджер» дэшборд, максимально переиспользующий страницы админки, при этом скрывающий всё, что менеджеру не нужно, и ограничивающий редактирование.

## Ограничения ТЗ

1. Основная операция менеджера: оперативная работа с заказами (редактирование статусов).  
2. По справочникам: менеджер в основном только просматривает (без создания/правок/удаления).  
3. По товарам: менеджер может редактировать **только** `price`, `description`, `stock` у существующих товаров (создание/удаление и изменение `sku`, `category`, `brand_name`, совместимости, изображения — запрещено по UI и политике).

## Предпосылки (что уже есть)

- Маршрут менеджера сейчас ограничен `orders` и `products` в `frontend/src/App.jsx`, а меню менеджера — только этими пунктами в `frontend/src/components/DashboardLayouts.jsx`.
- `OrderDetailPage` уже содержит селектор статуса заказа без привязки к `isAdmin` на фронте, а серверная проверка прав вынесена в DRF (для `status` используется `IsManagerOrAdmin`).
- `ProductsPage`, `ProductTable` и `ProductModalForm` сейчас завязаны на `isAdmin`: создание/редактирование/удаление товаров и изменение остатков разрешены только при `isAdmin`, а форма товара позволяет менять много полей (включая совместимость), что необходимо ограничить для менеджера.

## План реализации

### 1) Меню и маршруты менеджера (использовать админские страницы read-only)

1. В `frontend/src/App.jsx` добавить определение `isManager` из `profile.groups` и расширить роутинг `/manager`:
  - `/manager/orders` и `/manager/orders/:orderId` оставить как есть.
  - `/manager/products` рендерить `ProductsPage` в режиме менеджера.
  - `/manager/categories` рендерить `CategoriesPage` с `isAdmin={false}`.
  - `/manager/cars` рендерить `CarsPage` с `isAdmin={false}`.
  - `/manager/tech` рендерить `TechVariantsPage` с `isAdmin={false}`.
  - Раздел `UsersPage` НЕ добавлять, поскольку выбран scope2.
2. В `frontend/src/components/DashboardLayouts.jsx` расширить `ManagerLayout` навигацию пунктами:
  - `Категории`, `Авто`, `Конфигурации`.
  - Не добавлять `Пользователи` и `Статистика`.

### 2) Режим редактирования товаров для менеджера

1. В `frontend/src/pages/ProductsPage.jsx` расширить API компонента (минимально инвазивно):
  - Добавить проп `role` или `editPolicy`, не ломая текущий интерфейс для админа.
  - Определить флаги:
    - `canCreateProducts = isAdmin`
    - `canEditProducts = isAdmin || role==='manager'`
    - `canDeleteProducts = isAdmin`
2. Обновить gating-логику:
  - `openCreateModal`, `handleDelete` должны быть доступны только при `canCreateProducts` / `canDeleteProducts`.
  - `openEditModal` должен быть доступен менеджеру при `canEditProducts`.
3. Передать флаги в `ProductTable`:
  - Показать кнопку редактирования при `canEditProducts`.
  - Показать кнопку удаления при `canDeleteProducts`.

### 3) Ограничение формы товара под менеджера

1. В `frontend/src/components/products/ProductTable.jsx` заменить текущую проверку `isAdmin` на переданные булевы флаги `canEdit`/`canDelete`.
2. В `frontend/src/components/products/ProductModalForm.jsx` добавить проп `editPolicy` (или несколько булев):
  - Для менеджера разрешить ввод/изменение только:
    - `price`, `description`, `stock`.
  - Запретить ввод/изменение:
    - `name`, `sku`, `brand_name`, `category`.
    - переключение `compatibility_mode`, подбор поколения/кузова/тех-конфигураций, а также удаление выбранных совместимостей.
    - загрузку изображения.
3. Реализация запретов на UI:
  - Для каждого соответствующего input/select установить `disabled` в зависимости от `editPolicy`.
  - Для кнопок переключения режима совместимости и кнопок добавления/удаления совместимости установить `disabled`.

### 4) Верификация (без изменений админки)

1. Для админа убедиться, что весь функционал товаров (создание/редактирование/удаление и полная форма) сохраняется без изменений.
2. Для менеджера проверить:
  - В меню доступны только выбранные разделы.
  - В таблице товаров доступно редактирование, но отсутствует удаление и кнопка создания.
  - В форме товара недоступны поля `sku/category/brand/совместимости/image`, при этом сохраняется возможность изменить `price/description/stock` и отправка формы приводит к обновлению именно этих значений.
3. Дополнительно проверить, что сервер корректно блокирует неразрешённые действия (даже если пользователь попытается обойти UI).

## Схема ролей и потоков (для отчёта)

```mermaid
flowchart LR
  Manager[Менеджер] -->|просмотр| Dictionaries[Категории/Авто/Конфигурации (read-only)]
  Manager -->|управление| Orders[Заказы: изменение статусов]
  Manager -->|управление| Products[Товары: цена/описание/остаток]

  Admin[Администратор] -->|управление| AdminAll[Полный backoffice]
```



