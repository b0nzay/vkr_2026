from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Roles(models.TextChoices):
        CLIENT = 'CLIENT', 'Client'
        MANAGER = 'MANAGER', 'Manager'
        ADMIN = 'ADMIN', 'Admin'

    role = models.CharField(
        max_length=20,
        choices=Roles.choices,
        default=Roles.CLIENT,
    )
    phone = models.CharField(max_length=32, blank=True, default='')
    email_verified = models.BooleanField(default=True)
    email_verification_token = models.UUIDField(null=True, blank=True, editable=False)

    def is_client(self) -> bool:
        if not self.is_authenticated:
            return False
        group_names = set(self.groups.values_list('name', flat=True))
        if 'Администратор' in group_names or 'Менеджер' in group_names:
            return False
        return True

    def is_manager(self) -> bool:
        if not self.is_authenticated:
            return False
        group_names = set(self.groups.values_list('name', flat=True))
        if 'Администратор' in group_names:
            return False
        return 'Менеджер' in group_names

    def is_admin(self) -> bool:
        if not self.is_authenticated:
            return False
        return self.groups.filter(name='Администратор').exists()
