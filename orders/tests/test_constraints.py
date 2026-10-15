from decimal import Decimal

from django.db import IntegrityError
from django.test import TestCase

from accounts.models import User
from catalog.models import Category, Product
from orders.models import Order, OrderItem


class OrderItemConstraintsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='client',
            password='pass',
            role=User.Roles.CLIENT,
        )
        self.category = Category.objects.create(name='Engine')
        self.product = Product.objects.create(
            name='Part',
            sku='SKU-ORDER',
            price=Decimal('100.00'),
            stock=5,
            category=self.category,
        )
        self.order = Order.objects.create(user=self.user)

    def test_quantity_must_be_positive(self):
        with self.assertRaises(IntegrityError):
            OrderItem.objects.create(
                order=self.order,
                product=self.product,
                quantity=0,
                unit_price=self.product.price,
            )

