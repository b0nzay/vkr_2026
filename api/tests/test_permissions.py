from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from catalog.models import Category, Product
from orders.models import Order


class OrderPermissionsTests(APITestCase):
    def setUp(self):
        self.client_user = User.objects.create_user(
            username='client',
            password='pass',
            role=User.Roles.CLIENT,
        )
        self.other_client = User.objects.create_user(
            username='other',
            password='pass',
            role=User.Roles.CLIENT,
        )
        self.manager = User.objects.create_user(
            username='manager',
            password='pass',
            role=User.Roles.MANAGER,
        )
        self.admin = User.objects.create_user(
            username='admin',
            password='pass',
            role=User.Roles.ADMIN,
        )

        self.order_1 = Order.objects.create(user=self.client_user)
        self.order_2 = Order.objects.create(user=self.other_client)

        self.api_client = APIClient()

    def test_client_sees_only_own_orders(self):
        self.api_client.login(username='client', password='pass')
        url = reverse('order-list')
        response = self.api_client.get(url)
        self.assertEqual(response.status_code, 200)
        ids = {order['id'] for order in response.data}
        self.assertIn(self.order_1.id, ids)
        self.assertNotIn(self.order_2.id, ids)

    def test_admin_sees_all_orders(self):
        self.api_client.login(username='admin', password='pass')
        url = reverse('order-list')
        response = self.api_client.get(url)
        self.assertEqual(response.status_code, 200)
        ids = {order['id'] for order in response.data}
        self.assertIn(self.order_1.id, ids)
        self.assertIn(self.order_2.id, ids)

    def test_manager_sees_all_orders(self):
        self.api_client.login(username='manager', password='pass')
        url = reverse('order-list')
        response = self.api_client.get(url)
        self.assertEqual(response.status_code, 200)
        ids = {order['id'] for order in response.data}
        self.assertIn(self.order_1.id, ids)
        self.assertIn(self.order_2.id, ids)


class ProductCategoryPermissionsTests(APITestCase):
    def setUp(self):
        self.client_user = User.objects.create_user(
            username='client',
            password='pass',
            role=User.Roles.CLIENT,
        )
        self.manager = User.objects.create_user(
            username='manager',
            password='pass',
            role=User.Roles.MANAGER,
        )
        self.admin = User.objects.create_user(
            username='admin',
            password='pass',
            role=User.Roles.ADMIN,
        )

        self.category = Category.objects.create(name='Категория')
        self.product = Product.objects.create(
            name='Товар',
            sku='SKU1',
            price='100.00',
            stock=10,
            category=self.category,
        )

        self.api_client = APIClient()

    def test_client_cannot_modify_product(self):
        self.api_client.login(username='client', password='pass')
        url = reverse('product-detail', args=[self.product.id])
        response = self.api_client.patch(url, {'price': '200.00'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_manager_can_modify_product_and_adjust_stock(self):
        self.api_client.login(username='manager', password='pass')

        # update product
        url = reverse('product-detail', args=[self.product.id])
        response = self.api_client.patch(url, {'price': '150.00'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(str(self.product.price), '150.00')

        # adjust stock
        adjust_url = reverse('product-adjust-stock', args=[self.product.id])
        response = self.api_client.post(adjust_url, {'delta': -2}, format='json')
        self.assertEqual(response.status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 8)

    def test_manager_cannot_change_category_structure(self):
        self.api_client.login(username='manager', password='pass')
        url = reverse('category-detail', args=[self.category.id])
        response = self.api_client.patch(url, {'name': 'Новое имя'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_admin_can_change_category_structure(self):
        self.api_client.login(username='admin', password='pass')
        url = reverse('category-detail', args=[self.category.id])
        response = self.api_client.patch(url, {'name': 'Новое имя'}, format='json')
        self.assertEqual(response.status_code, 200)


class UsersApiPermissionsTests(APITestCase):
    def setUp(self):
        self.client_user = User.objects.create_user(
            username='client',
            password='pass',
            role=User.Roles.CLIENT,
        )
        self.manager = User.objects.create_user(
            username='manager',
            password='pass',
            role=User.Roles.MANAGER,
        )
        self.admin = User.objects.create_user(
            username='admin',
            password='pass',
            role=User.Roles.ADMIN,
        )
        self.api_client = APIClient()

    def test_client_cannot_access_users_list(self):
        self.api_client.login(username='client', password='pass')
        url = reverse('user-list')
        response = self.api_client.get(url)
        self.assertEqual(response.status_code, 403)

    def test_manager_can_access_users_list(self):
        self.api_client.login(username='manager', password='pass')
        url = reverse('user-list')
        response = self.api_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)

    def test_admin_can_access_users_list(self):
        self.api_client.login(username='admin', password='pass')
        url = reverse('user-list')
        response = self.api_client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_admin_can_create_and_block_user(self):
        self.api_client.login(username='admin', password='pass')
        url = reverse('user-list')
        response = self.api_client.post(
            url,
            {'username': 'newuser', 'email': 'new@example.com', 'role': User.Roles.CLIENT},
            format='json',
        )
        self.assertEqual(response.status_code, 201)

        user_id = response.data['id']
        detail_url = reverse('user-detail', args=[user_id])
        response = self.api_client.patch(
            detail_url,
            {'is_active': False, 'role': User.Roles.MANAGER},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['is_active'], False)


class AdminStatsPermissionsTests(APITestCase):
    def setUp(self):
        self.client_user = User.objects.create_user(
            username='client',
            password='pass',
            role=User.Roles.CLIENT,
        )
        self.admin = User.objects.create_user(
            username='admin',
            password='pass',
            role=User.Roles.ADMIN,
            is_staff=True,
        )
        self.api_client = APIClient()

    def test_client_cannot_access_admin_stats(self):
        self.api_client.login(username='client', password='pass')
        url = reverse('admin-stats')
        response = self.api_client.get(url)
        # URL существует, но без прав должен быть 403
        self.assertEqual(response.status_code, 403)

