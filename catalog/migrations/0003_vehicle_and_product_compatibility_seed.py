from django.db import migrations, models


def seed_vehicle_and_product(apps, schema_editor):
    Category = apps.get_model("catalog", "Category")
    Product = apps.get_model("catalog", "Product")
    Vehicle = apps.get_model("catalog", "Vehicle")
    ProductVehicleCompatibility = apps.get_model(
        "catalog", "ProductVehicleCompatibility"
    )

    bumpers_category, _ = Category.objects.get_or_create(name="Бамперы")
    front_bumper_category, _ = Category.objects.get_or_create(
        name="Передний бампер",
        defaults={"name": "Передний бампер"},
    )

    vehicle, _ = Vehicle.objects.get_or_create(
        brand="Toyota",
        model="Camry",
        generation="XV50",
        body_type="sedan",
    )

    product, _ = Product.objects.get_or_create(
        sku="FR-BMP-CAMRY-XV50",
        defaults={
            "name": "Передний бампер Toyota Camry XV50",
            "price": 15000,
            "stock": 5,
            "category": front_bumper_category,
        },
    )

    ProductVehicleCompatibility.objects.get_or_create(
        product=product,
        vehicle=vehicle,
        defaults={"notes": ""},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Vehicle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("brand", models.CharField(max_length=100)),
                ("model", models.CharField(max_length=100)),
                ("generation", models.CharField(max_length=100)),
                ("body_type", models.CharField(max_length=50)),
            ],
            options={
                "ordering": ["brand", "model", "generation", "body_type"],
            },
        ),
        migrations.CreateModel(
            name="ProductVehicleCompatibility",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("product", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="vehicle_compatibilities", to="catalog.product")),
                ("vehicle", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="product_compatibilities", to="catalog.vehicle")),
            ],
        ),
        migrations.AddConstraint(
            model_name="productvehiclecompatibility",
            constraint=models.UniqueConstraint(fields=("product", "vehicle"), name="product_vehicle_unique"),
        ),
        migrations.RunPython(seed_vehicle_and_product, migrations.RunPython.noop),
    ]

