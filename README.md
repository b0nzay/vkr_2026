# Учебный fullstack-проект (ВКР)

Интернет-магазин автозапчастей: витрина для клиентов и панель управления для менеджеров и администраторов.

Стек: Django 6, Django REST Framework, PostgreSQL, React 18, Vite.

## Возможности

- Каталог запчастей с фильтрацией по авто (марка - модель - поколение - тип кузова / конфигурация)
- Корзина, избранное, оформление заказа (без реальной оплаты)
- Роли: клиент, менеджер, администратор
- Контент: FAQ, отзывы, редактируемые блоки сайта
- Чат поддержки (клиент - менеджер)
- Импорт справочников в админке


## Запуск



### Требования

- Python 3.11+
- Node.js 18+
- PostgreSQL



### База данных

Создайте БД, например `autoparts`


### 2. Backend

```bash
python -m venv .venv
Windows: .venv\Scripts\activate

pip install -r requirements.txt
cp .env.example .env

python manage.py migrate
python manage.py test
python manage.py runserver
```


### 3. Frontend

Статика подключается из `frontend/dist/`:

```bash
cd frontend
npm install
npm run build
```

### Демо-аккаунты

После `migrate` создаются демо-пользователи:


| Логин     | Пароль       | Роль     |
| --------- | ------------ | -------- |
| `client`  | `client123`  | клиент   |
| `manager` | `manager123` | менеджер |
| `admin`   | `admin123`   | админ    |


- Витрина: `/`
- Панель: `/dashboard/`
- Django admin: `/admin/`
