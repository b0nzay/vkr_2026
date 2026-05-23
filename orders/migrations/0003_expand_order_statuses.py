from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0002_garage_vehicle'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('NEW', 'Создан'),
                    ('PROCESSING', 'В обработке'),
                    ('READY_FOR_PICKUP', 'Готов к выдаче'),
                    ('COMPLETED', 'Завершён'),
                    ('CANCELED', 'Отменён'),
                ],
                default='NEW',
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name='orderstatushistory',
            name='from_status',
            field=models.CharField(
                choices=[
                    ('NEW', 'Создан'),
                    ('PROCESSING', 'В обработке'),
                    ('READY_FOR_PICKUP', 'Готов к выдаче'),
                    ('COMPLETED', 'Завершён'),
                    ('CANCELED', 'Отменён'),
                ],
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name='orderstatushistory',
            name='to_status',
            field=models.CharField(
                choices=[
                    ('NEW', 'Создан'),
                    ('PROCESSING', 'В обработке'),
                    ('READY_FOR_PICKUP', 'Готов к выдаче'),
                    ('COMPLETED', 'Завершён'),
                    ('CANCELED', 'Отменён'),
                ],
                max_length=32,
            ),
        ),
    ]
