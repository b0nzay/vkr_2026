from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0007_brand_product_description_product_image_bodystyle'),
    ]

    operations = [
        migrations.CreateModel(
            name='CarModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('brand', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='car_models', to='catalog.brand')),
            ],
            options={
                'ordering': ['brand', 'name'],
            },
        ),
        migrations.CreateModel(
            name='Generation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('image', models.ImageField(blank=True, null=True, upload_to='generations/')),
                ('car_model', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='generations', to='catalog.carmodel')),
            ],
            options={
                'ordering': ['car_model', 'name'],
            },
        ),
        migrations.CreateModel(
            name='BodyType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('image', models.ImageField(blank=True, null=True, upload_to='body_types/')),
                ('generation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='body_types', to='catalog.generation')),
            ],
            options={
                'ordering': ['generation', 'name'],
            },
        ),
        migrations.CreateModel(
            name='ProductBodyTypeCompatibility',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notes', models.CharField(blank=True, max_length=255)),
                ('body_type', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='product_compatibilities', to='catalog.bodytype')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='body_type_compatibilities', to='catalog.product')),
            ],
        ),
        migrations.AddConstraint(
            model_name='carmodel',
            constraint=models.UniqueConstraint(fields=('brand', 'name'), name='carmodel_brand_name_unique'),
        ),
        migrations.AddConstraint(
            model_name='productbodytypecompatibility',
            constraint=models.UniqueConstraint(fields=('product', 'body_type'), name='product_bodytype_unique'),
        ),
    ]

