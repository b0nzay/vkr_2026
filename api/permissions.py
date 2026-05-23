from rest_framework.permissions import BasePermission, SAFE_METHODS


class RolePermissionMixin:
    def _is_manager_or_admin(self, user) -> bool:
        return bool(
            user.is_authenticated
            and (
                getattr(user, 'is_manager', lambda: False)()
                or getattr(user, 'is_admin', lambda: False)()
            )
        )


class IsManagerOrAdmin(BasePermission, RolePermissionMixin):
    def has_permission(self, request, view):
        return self._is_manager_or_admin(request.user)


class ProductCategoryPermission(BasePermission, RolePermissionMixin):
    """
    Права на товары по методам (как Django model permissions):
    - GET/HEAD/OPTIONS → view_product
    - POST → add_product
    - PUT/PATCH → change_product
    - DELETE → delete_product
    """

    def has_permission(self, request, view):
        user = request.user
        if request.method in SAFE_METHODS:
            return True
        if not (user and user.is_authenticated):
            return False
        if request.method == 'POST':
            return user.has_perm('catalog.add_product')
        if request.method in ('PUT', 'PATCH'):
            return user.has_perm('catalog.change_product')
        if request.method == 'DELETE':
            return user.has_perm('catalog.delete_product')
        return False


class CategoryPermission(BasePermission):
    """
    Для категорий:
    Права по методам (как Django model permissions):
    - GET/HEAD/OPTIONS → view_category
    - POST → add_category
    - PUT/PATCH → change_category
    - DELETE → delete_category
    """

    def has_permission(self, request, view):
        user = request.user
        if request.method in SAFE_METHODS:
            return True
        if not (user and user.is_authenticated):
            return False
        if request.method == 'POST':
            return user.has_perm('catalog.add_category')
        if request.method in ('PUT', 'PATCH'):
            return user.has_perm('catalog.change_category')
        if request.method == 'DELETE':
            return user.has_perm('catalog.delete_category')
        return False


class OrderPermission(BasePermission, RolePermissionMixin):
    """
    CLIENT видит только свои заказы.
    MANAGER/ADMIN — все заказы.
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        if self._is_manager_or_admin(user):
            return True
        return obj.user_id == user.id

