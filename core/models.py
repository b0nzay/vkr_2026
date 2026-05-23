from django.db import models


class CoreSettings(models.Model):
    """
    Нефизическая модель для объявления прав приложения core.

    Используется для выдачи права `core.view_reports` группе \"Администратор\"
    и ограничения доступа к админской статистике.
    """

    class Meta:
        managed = False
        default_permissions = ()
        permissions = (
            ('view_reports', 'Can view admin reports'),
        )

