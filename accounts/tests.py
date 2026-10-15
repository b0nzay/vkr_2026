from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse

from accounts.models import User


ADMIN_GROUP_NAME = 'Администратор'
MANAGER_GROUP_NAME = 'Менеджер'


class LoginRedirectTests(TestCase):
    def setUp(self):
        self.admin_group, _ = Group.objects.get_or_create(name=ADMIN_GROUP_NAME)
        self.manager_group, _ = Group.objects.get_or_create(name=MANAGER_GROUP_NAME)

        self.client_user = User.objects.create_user(
            username='client-test',
            password='pass',
            role=User.Roles.CLIENT,
        )

        self.manager = User.objects.create_user(
            username='manager-test',
            password='pass',
            role=User.Roles.MANAGER,
        )
        self.manager.groups.add(self.manager_group)

        self.admin = User.objects.create_user(
            username='admin-test',
            password='pass',
            role=User.Roles.ADMIN,
            is_staff=True,
        )
        self.admin.groups.add(self.admin_group)

    def test_client_redirects_to_catalog(self):
        response = self.client.post(
            reverse('accounts:login'),
            {'username': 'client-test', 'password': 'pass'},
        )
        self.assertRedirects(response, reverse('catalog:storefront_catalog'))

    def test_manager_redirects_to_manager_dashboard(self):
        response = self.client.post(
            reverse('accounts:login'),
            {'username': 'manager-test', 'password': 'pass'},
        )
        self.assertRedirects(response, '/dashboard/manager')

    def test_admin_redirects_to_admin_dashboard(self):
        response = self.client.post(
            reverse('accounts:login'),
            {'username': 'admin-test', 'password': 'pass'},
        )
        self.assertRedirects(response, '/dashboard/admin')

    def test_manager_cannot_use_next_to_admin(self):
        response = self.client.post(
            reverse('accounts:login') + '?next=/dashboard/admin',
            {'username': 'manager-test', 'password': 'pass'},
        )
        self.assertRedirects(response, '/dashboard/manager')


class DashboardAccessTests(TestCase):
    def setUp(self):
        self.admin_group, _ = Group.objects.get_or_create(name=ADMIN_GROUP_NAME)
        self.manager_group, _ = Group.objects.get_or_create(name=MANAGER_GROUP_NAME)

        self.client_user = User.objects.create_user(
            username='client-dash',
            password='pass',
            role=User.Roles.CLIENT,
        )

        self.manager = User.objects.create_user(
            username='manager-dash',
            password='pass',
            role=User.Roles.MANAGER,
        )
        self.manager.groups.add(self.manager_group)

        self.admin = User.objects.create_user(
            username='admin-dash',
            password='pass',
            role=User.Roles.ADMIN,
            is_staff=True,
        )
        self.admin.groups.add(self.admin_group)

    def test_client_cannot_access_dashboard(self):
        self.client.login(username='client-dash', password='pass')
        response = self.client.get('/dashboard/')
        self.assertEqual(response.status_code, 403)

    def test_manager_can_access_manager_dashboard(self):
        self.client.login(username='manager-dash', password='pass')
        response = self.client.get('/dashboard/manager')
        self.assertEqual(response.status_code, 200)

    def test_manager_cannot_access_admin_dashboard(self):
        self.client.login(username='manager-dash', password='pass')
        response = self.client.get('/dashboard/admin')
        self.assertEqual(response.status_code, 403)

    def test_admin_can_access_admin_dashboard(self):
        self.client.login(username='admin-dash', password='pass')
        response = self.client.get('/dashboard/admin')
        self.assertEqual(response.status_code, 200)

