from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from orders.models import Order, OrderStatusHistory


class OrderStatusHistoryTests(APITestCase):
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
        self.order = Order.objects.create(user=self.client_user, status=Order.Status.NEW)
        self.api_client = APIClient()

    def test_change_status_creates_history_record(self):
        self.api_client.login(username='manager', password='pass')
        url = reverse('order-status', kwargs={'pk': self.order.pk})
        initial_count = OrderStatusHistory.objects.filter(order=self.order).count()
        response = self.api_client.patch(url, {'status': Order.Status.PROCESSING}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            OrderStatusHistory.objects.filter(order=self.order).count(),
            initial_count + 1,
        )
        record = OrderStatusHistory.objects.filter(order=self.order).first()
        self.assertEqual(record.from_status, Order.Status.NEW)
        self.assertEqual(record.to_status, Order.Status.PROCESSING)
        self.assertEqual(record.changed_by_id, self.manager.id)

    def test_client_cannot_change_order_status(self):
        self.api_client.login(username='client', password='pass')
        url = reverse('order-status', kwargs={'pk': self.order.pk})
        response = self.api_client.patch(url, {'status': Order.Status.COMPLETED}, format='json')
        self.assertEqual(response.status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.NEW)
