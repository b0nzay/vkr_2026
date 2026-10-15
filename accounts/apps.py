from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = 'accounts'

    def ready(self):
        # Регистрация сигналов для группы \"Администратор\" и синхронизации ролей.
        from . import signals  # noqa: F401

