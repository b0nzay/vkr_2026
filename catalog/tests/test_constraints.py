from django.db import IntegrityError
from django.test import TestCase
from catalog.models import (
    Category,
    Product,
)


class ProductConstraintsTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Engine")

    def test_sku_unique(self):
        Product.objects.create(
            name="Part 1",
            sku="SKU-1",
            price=100,
            stock=10,
            category=self.category,
        )
        with self.assertRaises(IntegrityError):
            Product.objects.create(
                name="Part 2",
                sku="SKU-1",
                price=150,
                stock=5,
                category=self.category,
            )

    def test_price_must_be_positive(self):
        with self.assertRaises(IntegrityError):
            Product.objects.create(
                name="Bad price",
                sku="BAD-PRICE",
                price=0,
                stock=1,
                category=self.category,
            )

    def test_stock_cannot_be_negative(self):
        with self.assertRaises(IntegrityError):
            Product.objects.create(
                name="Bad stock",
                sku="BAD-STOCK",
                price=100,
                stock=-1,
                category=self.category,
            )
