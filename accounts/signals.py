from django.apps import apps
from django.contrib.auth.models import Group, Permission
from django.db.models.signals import post_migrate, post_save
from django.dispatch import receiver

from .models import User


ADMIN_GROUP_NAME = 'Администратор'
MANAGER_GROUP_NAME = 'Менеджер'

# Набор прав, которые должны быть у группы "Администратор".
ADMIN_PERMISSIONS = [
    # catalog
    ('catalog', 'add_category'),
    ('catalog', 'change_category'),
    ('catalog', 'delete_category'),
    ('catalog', 'view_category'),
    ('catalog', 'add_product'),
    ('catalog', 'change_product'),
    ('catalog', 'delete_product'),
    ('catalog', 'view_product'),
    ('catalog', 'add_vehicle'),
    ('catalog', 'change_vehicle'),
    ('catalog', 'delete_vehicle'),
    ('catalog', 'view_vehicle'),
    ('catalog', 'add_productvehiclecompatibility'),
    ('catalog', 'change_productvehiclecompatibility'),
    ('catalog', 'delete_productvehiclecompatibility'),
    ('catalog', 'view_productvehiclecompatibility'),
    ('catalog', 'add_brand'),
    ('catalog', 'change_brand'),
    ('catalog', 'delete_brand'),
    ('catalog', 'view_brand'),
    ('catalog', 'add_carmodel'),
    ('catalog', 'change_carmodel'),
    ('catalog', 'delete_carmodel'),
    ('catalog', 'view_carmodel'),
    ('catalog', 'add_generation'),
    ('catalog', 'change_generation'),
    ('catalog', 'delete_generation'),
    ('catalog', 'view_generation'),
    ('catalog', 'add_bodytype'),
    ('catalog', 'change_bodytype'),
    ('catalog', 'delete_bodytype'),
    ('catalog', 'view_bodytype'),
    ('catalog', 'add_bodystyle'),
    ('catalog', 'change_bodystyle'),
    ('catalog', 'delete_bodystyle'),
    ('catalog', 'view_bodystyle'),
    # orders
    ('orders', 'view_order'),
    ('orders', 'change_order'),
    ('orders', 'view_orderitem'),
    ('orders', 'change_orderitem'),
    ('orders', 'view_orderstatushistory'),
    ('orders', 'change_orderstatushistory'),
    ('orders', 'view_vincheckrequest'),
    ('orders', 'change_vincheckrequest'),
    # accounts (пользователи)
    ('accounts', 'view_user'),
    ('accounts', 'add_user'),
    ('accounts', 'change_user'),
    # content (акции, FAQ)
    ('content', 'add_promotion'),
    ('content', 'change_promotion'),
    ('content', 'delete_promotion'),
    ('content', 'view_promotion'),
    ('content', 'add_faqitem'),
    ('content', 'change_faqitem'),
    ('content', 'delete_faqitem'),
    ('content', 'view_faqitem'),
    ('content', 'view_siteblock'),
    ('content', 'change_siteblock'),
    ('content', 'view_review'),
    ('content', 'add_review'),
    ('content', 'change_review'),
    ('content', 'delete_review'),
    # core (статистика/отчёты)
    ('core', 'view_reports'),
]

MANAGER_PERMISSIONS = [
    # catalog
    ('catalog', 'view_category'),
    ('catalog', 'view_product'),
    ('catalog', 'change_product'),
    ('catalog', 'view_brand'),
    ('catalog', 'add_brand'),
    ('catalog', 'change_brand'),
    ('catalog', 'view_carmodel'),
    ('catalog', 'add_carmodel'),
    ('catalog', 'change_carmodel'),
    ('catalog', 'view_generation'),
    ('catalog', 'add_generation'),
    ('catalog', 'change_generation'),
    ('catalog', 'view_bodytype'),
    ('catalog', 'add_bodytype'),
    ('catalog', 'change_bodytype'),
    ('catalog', 'view_productvehiclecompatibility'),
    ('catalog', 'add_productvehiclecompatibility'),
    ('catalog', 'change_productvehiclecompatibility'),
    ('catalog', 'delete_productvehiclecompatibility'),
    # orders
    ('orders', 'view_order'),
    ('orders', 'change_order'),
    ('orders', 'view_orderitem'),
    ('orders', 'view_orderstatushistory'),
    ('orders', 'change_orderstatushistory'),
    ('orders', 'view_vincheckrequest'),
    ('orders', 'change_vincheckrequest'),
    # content
    ('content', 'view_promotion'),
    ('content', 'add_promotion'),
    ('content', 'change_promotion'),
    ('content', 'view_faqitem'),
    ('content', 'add_faqitem'),
    ('content', 'change_faqitem'),
    ('content', 'delete_faqitem'),
    ('content', 'view_siteblock'),
    ('content', 'change_siteblock'),
    ('content', 'view_review'),
    ('content', 'change_review'),
    # accounts
    ('accounts', 'view_user'),
]


def _get_or_create_admin_group() -> Group:
    group, _ = Group.objects.get_or_create(name=ADMIN_GROUP_NAME)
    return group


@receiver(post_migrate)
def ensure_admin_group_and_permissions(sender, **kwargs):
    """
    После применения миграций гарантируем наличие группы "Администратор"
    и привязываем к ней нужные права. Запускается для каждого приложения,
    поэтому не полагается на порядок миграций.
    """
    group = _get_or_create_admin_group()

    perms = []
    for app_label, codename in ADMIN_PERMISSIONS:
        try:
            perm = Permission.objects.get(
                content_type__app_label=app_label,
                codename=codename,
            )
        except Permission.DoesNotExist:
            continue
        perms.append(perm)

    if perms:
        group.permissions.set(perms)

    # Привязываем всех пользователей с ролью ADMIN к группе и включаем is_staff,
    # чтобы они имели доступ к Django admin.
    AdminUser = apps.get_model('accounts', 'User')
    for admin_user in AdminUser.objects.filter(role=AdminUser.Roles.ADMIN):
        admin_user.groups.add(group)
        if not admin_user.is_staff:
            admin_user.is_staff = True
            admin_user.save(update_fields=['is_staff'])


def _get_or_create_manager_group() -> Group:
    group, _ = Group.objects.get_or_create(name=MANAGER_GROUP_NAME)
    return group


@receiver(post_migrate)
def ensure_manager_group_and_permissions(sender, **kwargs):
    """
    После применения миграций гарантируем наличие группы "Менеджер"
    и привязываем к ней нужные права.
    """
    group = _get_or_create_manager_group()

    perms = []
    for app_label, codename in MANAGER_PERMISSIONS:
        try:
            perm = Permission.objects.get(
                content_type__app_label=app_label,
                codename=codename,
            )
        except Permission.DoesNotExist:
            continue
        perms.append(perm)

    if perms:
        group.permissions.set(perms)

    ManagerUser = apps.get_model('accounts', 'User')
    for manager_user in ManagerUser.objects.filter(role=ManagerUser.Roles.MANAGER):
        manager_user.groups.add(group)
        if not manager_user.is_staff:
            manager_user.is_staff = True
            manager_user.save(update_fields=['is_staff'])


@receiver(post_save, sender=User)
def sync_admin_group_for_user(sender, instance: User, **kwargs):
    """
    Поддерживает согласованность между ролью ADMIN и группой "Администратор".
    """
    group = Group.objects.filter(name=ADMIN_GROUP_NAME).first()
    if not group:
        return

    if instance.role == User.Roles.ADMIN:
        instance.groups.add(group)
        if not instance.is_staff:
            instance.is_staff = True
            instance.save(update_fields=['is_staff'])
    else:
        instance.groups.remove(group)


@receiver(post_save, sender=User)
def sync_manager_group_for_user(sender, instance: User, **kwargs):
    """
    Поддерживает согласованность между ролью MANAGER и группой "Менеджер".
    """
    group = Group.objects.filter(name=MANAGER_GROUP_NAME).first()
    if not group:
        return

    if instance.role == User.Roles.MANAGER:
        instance.groups.add(group)
        if not instance.is_staff:
            instance.is_staff = True
            instance.save(update_fields=['is_staff'])
    else:
        instance.groups.remove(group)

