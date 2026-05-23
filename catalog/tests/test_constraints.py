from django.db import IntegrityError
from django.test import TestCase
from catalog.models import (
    Category,
    Product,
    Vehicle,
    ProductVehicleCompatibility,
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


class VehicleAndCompatibilityTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Бамперы")
        self.product = Product.objects.create(
            name="Передний бампер",
            sku="FR-BMP-TEST",
            price=10000,
            stock=3,
            category=self.category,
        )
        self.vehicle = Vehicle.objects.create(
            brand="Toyota",
            model="Camry",
            generation="XV50",
            body_type="sedan",
        )

    def test_unique_product_vehicle_pair(self):
        ProductVehicleCompatibility.objects.create(
            product=self.product,
            vehicle=self.vehicle,
        )

        with self.assertRaises(IntegrityError):
            ProductVehicleCompatibility.objects.create(
                product=self.product,
                vehicle=self.vehicle,
            )



