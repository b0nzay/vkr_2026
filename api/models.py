from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = 'CREATE', 'Создание'
        UPDATE = 'UPDATE', 'Изменение'
        DELETE = 'DELETE', 'Удаление'

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    action = models.CharField(max_length=16, choices=Action.choices)
    entity_type = models.CharField(max_length=120)
    object_id = models.CharField(max_length=64)
    object_repr = models.CharField(max_length=255, blank=True, default='')
    summary = models.CharField(max_length=255, blank=True, default='')
    before_data = models.JSONField(null=True, blank=True)
    after_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['-created_at'], name='auditlog_created_desc_idx'),
            models.Index(fields=['action'], name='auditlog_action_idx'),
            models.Index(fields=['entity_type'], name='auditlog_entity_idx'),
        ]

    def __str__(self) -> str:
        return f'{self.get_action_display()} {self.entity_type} #{self.object_id}'
