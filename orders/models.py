import logging

from django.conf import settings
from django.db import models

from catalog.models import Product

logger = logging.getLogger(__name__)


class Order(models.Model):
    class Status(models.TextChoices):
        NEW = 'NEW', 'Создан'
        PROCESSING = 'PROCESSING', 'В обработке'
        READY_FOR_PICKUP = 'READY_FOR_PICKUP', 'Готов к выдаче'
        COMPLETED = 'COMPLETED', 'Завершён'
        CANCELED = 'CANCELED', 'Отменён'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='orders',
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.NEW,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'Order #{self.pk} by {self.user}'

    def change_status(self, new_status: str, changed_by) -> None:
        from_status = self.status
        self.status = new_status
        self.save(update_fields=['status', 'updated_at'])
        OrderStatusHistory.objects.create(
            order=self,
            from_status=from_status,
            to_status=new_status,
            changed_by=changed_by,
        )
        logger.info(
            'Order %s status changed from %s to %s by user %s',
            self.pk,
            from_status,
            new_status,
            getattr(changed_by, 'pk', changed_by),
        )

    @property
    def total_price(self):
        from decimal import Decimal
        total = Decimal('0')
        for item in self.items.all():
            total += item.total_price
        return total


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='order_items',
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name='orderitem_quantity_gt_0',
            )
        ]

    def __str__(self) -> str:
        return f'{self.product} x {self.quantity}'

    @property
    def total_price(self):
        return self.unit_price * self.quantity


class OrderStatusHistory(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='status_history',
    )
    from_status = models.CharField(max_length=32, choices=Order.Status.choices)
    to_status = models.CharField(max_length=32, choices=Order.Status.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='changed_orders',
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at']

    def __str__(self) -> str:
        return f'{self.order} {self.from_status} -> {self.to_status}'
