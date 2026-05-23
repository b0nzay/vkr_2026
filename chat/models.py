import secrets

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from orders.models import Order

SESSION_SUPPORT_GUEST_KEY = 'support_guest_key'


class SupportThread(models.Model):
    """Одна беседа поддержки на зарегистрированного пользователя или гостя."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='support_threads',
    )
    guest_key = models.UUIDField(null=True, blank=True, unique=True, editable=False)
    public_guest_code = models.PositiveIntegerField(null=True, blank=True, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    client_last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-last_message_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['user'],
                condition=Q(user__isnull=False),
                name='support_thread_one_user',
            ),
        ]

    def __str__(self) -> str:
        if self.user_id:
            return f'SupportThread user={self.user_id}'
        return f'SupportThread guest={self.public_guest_code}'

    @classmethod
    def _next_guest_code(cls) -> int:
        for _ in range(50):
            code = secrets.randbelow(900_000) + 100_000
            if not cls.objects.filter(public_guest_code=code).exists():
                return code
        raise RuntimeError('Could not allocate guest code')

    @classmethod
    def create_guest_thread(cls) -> 'SupportThread':
        from uuid import uuid4

        return cls.objects.create(
            guest_key=uuid4(),
            public_guest_code=cls._next_guest_code(),
        )


class SupportMessage(models.Model):
    class SenderRole(models.TextChoices):
        CLIENT = 'CLIENT', 'Client'
        STAFF = 'STAFF', 'Staff'

    thread = models.ForeignKey(
        SupportThread,
        on_delete=models.CASCADE,
        related_name='support_messages',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='support_authored_messages',
    )
    sender_role = models.CharField(
        max_length=10,
        choices=SenderRole.choices,
    )
    text = models.TextField(blank=True, default='')
    attachment = models.FileField(upload_to='support_attachments/%Y/%m/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self) -> str:
        return f'SupportMessage #{self.pk} thread={self.thread_id}'


class SupportThreadReadState(models.Model):
    """Последнее прочтение треда сотрудником (для счётчика непрочитанного)."""

    thread = models.ForeignKey(
        SupportThread,
        on_delete=models.CASCADE,
        related_name='staff_read_states',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='support_thread_read_states',
    )
    last_read_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['thread', 'user'], name='uniq_support_thread_read_user'),
        ]

    def __str__(self) -> str:
        return f'ReadState thread={self.thread_id} user={self.user_id}'


class Message(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self) -> str:
        return f'Message #{self.pk} in {self.order}'


class OrderParticipant(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='order_participations',
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='participants',
    )
    last_read_message = models.ForeignKey(
        Message,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )

    class Meta:
        unique_together = ('user', 'order')

    def __str__(self) -> str:
        return f'{self.user} in {self.order}'
