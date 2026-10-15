from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from chat.models import Message
from orders.models import Order


class MessagePermissionsTests(APITestCase):
    def setUp(self):
        self.client_a = User.objects.create_user(
            username='client_a',
            password='pass',
            role=User.Roles.CLIENT,
        )
        self.client_b = User.objects.create_user(
            username='client_b',
            password='pass',
            role=User.Roles.CLIENT,
        )
        self.order_a = Order.objects.create(user=self.client_a)
        self.order_b = Order.objects.create(user=self.client_b)
        self.api_client = APIClient()

    def test_client_cannot_list_messages_for_other_order(self):
        Message.objects.create(order=self.order_b, author=self.client_b, text='Private')
        self.api_client.login(username='client_a', password='pass')
        url = reverse('message-list')
        response = self.api_client.get(url, {'order_id': self.order_b.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)

    def test_client_can_list_messages_for_own_order(self):
        Message.objects.create(order=self.order_a, author=self.client_a, text='My msg')
        self.api_client.login(username='client_a', password='pass')
        url = reverse('message-list')
        response = self.api_client.get(url, {'order_id': self.order_a.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['text'], 'My msg')

    def test_client_cannot_post_message_to_other_order(self):
        self.api_client.login(username='client_a', password='pass')
        url = reverse('message-list')
        response = self.api_client.post(
            url,
            {'order': self.order_b.id, 'text': 'Intrusion'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_client_can_post_message_to_own_order(self):
        self.api_client.login(username='client_a', password='pass')
        url = reverse('message-list')
        response = self.api_client.post(
            url,
            {'order': self.order_a.id, 'text': 'Hello'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Message.objects.filter(order=self.order_a, text='Hello').exists())
