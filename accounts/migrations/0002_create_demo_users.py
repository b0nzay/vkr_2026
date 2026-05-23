from django.db import migrations


def create_demo_users(apps, schema_editor):
    User = apps.get_model("accounts", "User")

    def get_or_create_user(username, email, role, is_staff=False, is_superuser=False, password=""):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "role": role,
                "is_staff": is_staff,
                "is_superuser": is_superuser,
            },
        )
        # Обновляем роль/флаги на случай, если пользователь уже был создан ранее
        updated = False
        if user.role != role:
            user.role = role
            updated = True
        if user.is_staff != is_staff:
            user.is_staff = is_staff
            updated = True
        if user.is_superuser != is_superuser:
            user.is_superuser = is_superuser
            updated = True
        if created or updated:
            user.save()

    get_or_create_user(
        username="client",
        email="client@example.com",
        role="CLIENT",
        is_staff=False,
        is_superuser=False,
        password="client123",
    )
    get_or_create_user(
        username="manager",
        email="manager@example.com",
        role="MANAGER",
        is_staff=True,
        is_superuser=False,
        password="manager123",
    )
    get_or_create_user(
        username="admin",
        email="admin@example.com",
        role="ADMIN",
        is_staff=True,
        is_superuser=True,
        password="admin123",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_demo_users, migrations.RunPython.noop),
    ]

