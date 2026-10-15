import json
import logging
from decimal import Decimal, InvalidOperation

from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q, Count, F, Sum
from rest_framework import mixins, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, DjangoModelPermissions, DjangoModelPermissionsOrAnonReadOnly, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework import status

from accounts.models import User
from catalog.models import (
    BodyType,
    Brand,
    CarModel,
    Category,
    Generation,
    Product,
    ProductBodyTypeCompatibility,
    ProductTechVariantCompatibility,
    TechVariant,
)
from chat.models import Message
from content.models import FAQItem, Promotion, Review, SiteBlock
from orders.models import Order, OrderItem
from orders.cart import Cart
from orders.favorites import Favorites
from .audit_helpers import (
    audit_subtree_before_brand_destroy_cascade,
    audit_subtree_before_car_model_destroy_cascade,
    audit_subtree_before_generation_destroy_cascade,
    detach_tech_for_brand_subtree,
    detach_tech_for_car_model_subtree,
    detach_tech_for_generation_subtree,
    log_imminent_body_type_deletes,
    log_imminent_car_model_deletes,
    log_imminent_generation_deletes,
)
from .models import AuditLog
from .permissions import (
    CategoryPermission,
    IsManagerOrAdmin,
    OrderPermission,
    ProductCategoryPermission,
)
from .serializers import (
    AuditLogDetailSerializer,
    AuditLogListSerializer,
    BodyTypeSerializer,
    BrandSerializer,
    CarModelSerializer,
    CategorySerializer,
    FAQItemSerializer,
    GenerationSerializer,
    MessageSerializer,
    OrderSerializer,
    OrderStatusUpdateSerializer,
    PromotionPublicSerializer,
    PromotionSerializer,
    ProductBodyTypeCompatibilitySerializer,
    ProductTechVariantCompatibilitySerializer,
    ProductSerializer,
    TechVariantSerializer,
    UserSerializer,
    FAQItemPublicSerializer,
    ReviewCreateSerializer,
    ReviewManageSerializer,
    ReviewPublicSerializer,
    SiteBlockPublicSerializer,
    SiteBlockSerializer,
)

logger = logging.getLogger(__name__)


def _normalize_query(raw: str | None) -> str:
    if raw is None:
        return ''
    # Убираем внешние пробелы и сводим набор пробелов к одному.
    return ' '.join(str(raw).strip().split())


def _parse_bool_param(raw: str | None) -> bool | None:
    if raw is None:
        return None
    val = str(raw).strip().lower()
    if val in {'1', 'true', 'yes', 'on'}:
        return True
    if val in {'0', 'false', 'no', 'off'}:
        return False
    return None


def _to_int_or_none(raw):
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _build_vehicle_context_from_params(params):
    return {
        'brand_id': _to_int_or_none(params.get('brand_id')),
        'model_id': _to_int_or_none(params.get('model_id')),
        'generation_id': _to_int_or_none(params.get('generation_id')),
        'body_type_id': _to_int_or_none(params.get('body_type_id')),
        'tech_variant_id': _to_int_or_none(params.get('tech_variant_id')),
    }


def _has_vehicle_context(vehicle_context: dict | None) -> bool:
    if not vehicle_context:
        return False
    return any(vehicle_context.get(k) for k in ('brand_id', 'model_id', 'generation_id', 'body_type_id', 'tech_variant_id'))


def _filter_products_by_vehicle_context(qs, vehicle_context: dict):
    brand_id = vehicle_context.get('brand_id')
    model_id = vehicle_context.get('model_id')
    generation_id = vehicle_context.get('generation_id')
    body_type_id = vehicle_context.get('body_type_id')
    tech_variant_id = vehicle_context.get('tech_variant_id')

    if body_type_id:
        return qs.filter(body_type_compatibilities__body_type_id=body_type_id)
    if tech_variant_id:
        return qs.filter(tech_variant_compatibilities__tech_variant_id=tech_variant_id)

    body_q = Q()
    tech_q = Q()
    has_filter = False
    if generation_id:
        has_filter = True
        body_q &= Q(body_type_compatibilities__body_type__generation_id=generation_id)
        tech_q &= Q(tech_variant_compatibilities__tech_variant__generation_id=generation_id)
    if model_id:
        has_filter = True
        body_q &= Q(body_type_compatibilities__body_type__generation__car_model_id=model_id)
        tech_q &= Q(tech_variant_compatibilities__tech_variant__generation__car_model_id=model_id)
    if brand_id:
        has_filter = True
        body_q &= Q(body_type_compatibilities__body_type__generation__car_model__brand_id=brand_id)
        tech_q &= Q(tech_variant_compatibilities__tech_variant__generation__car_model__brand_id=brand_id)
    if not has_filter:
        return qs
    return qs.filter(body_q | tech_q)


def _calc_product_fitment_status(product: Product, vehicle_context: dict | None) -> str:
    if not _has_vehicle_context(vehicle_context):
        return 'unknown'

    body_type_id = vehicle_context.get('body_type_id')
    tech_variant_id = vehicle_context.get('tech_variant_id')
    generation_id = vehicle_context.get('generation_id')
    model_id = vehicle_context.get('model_id')
    brand_id = vehicle_context.get('brand_id')

    body_compats = list(product.body_type_compatibilities.select_related('body_type__generation__car_model__brand').all())
    tech_compats = list(product.tech_variant_compatibilities.select_related('tech_variant__generation__car_model__brand').all())

    if body_type_id:
        return 'confirmed' if any(c.body_type_id == body_type_id for c in body_compats) else 'conflict'
    if tech_variant_id:
        return 'confirmed' if any(c.tech_variant_id == tech_variant_id for c in tech_compats) else 'conflict'

    def _body_match(c):
        body = c.body_type
        if not body or not body.generation:
            return False
        gen = body.generation
        model = gen.car_model
        if generation_id and gen.id != generation_id:
            return False
        if model_id and (not model or model.id != model_id):
            return False
        if brand_id and (not model or model.brand_id != brand_id):
            return False
        return True

    def _tech_match(c):
        tv = c.tech_variant
        if not tv or not tv.generation:
            return False
        gen = tv.generation
        model = gen.car_model
        if generation_id and gen.id != generation_id:
            return False
        if model_id and (not model or model.id != model_id):
            return False
        if brand_id and (not model or model.brand_id != brand_id):
            return False
        return True

    return 'confirmed' if any(_body_match(c) for c in body_compats) or any(_tech_match(c) for c in tech_compats) else 'conflict'


def _apply_tokenized_search(qs, raw_query: str | None, lookup_fields: list[str]):
    """
    Токенизированный поиск:
    - q разбивается на токены по пробелам
    - для каждого токена строится OR по lookup_fields
    - токены объединяются AND (все токены должны матчиться)
    """
    normalized = _normalize_query(raw_query)
    if not normalized:
        return qs

    tokens = [t for t in normalized.lower().split(' ') if t]
    if not tokens:
        return qs

    combined_q = None
    for token in tokens:
        token_q = Q()
        for lookup in lookup_fields:
            token_q |= Q(**{lookup: token})
        combined_q = token_q if combined_q is None else (combined_q & token_q)
    return qs.filter(combined_q)


def _apply_ordering(qs, raw_ordering: str | None, allowed: dict[str, str], default: str):
    ordering = str(raw_ordering).strip() if raw_ordering is not None else ''
    if ordering in allowed:
        return qs.order_by(allowed[ordering])
    return qs.order_by(default)


def _has_admin_backoffice_access(user) -> bool:
    if not (user and user.is_authenticated):
        return False
    if getattr(user, 'is_superuser', False):
        return True
    return bool(
        user.has_perm('core.view_reports')
        or user.groups.filter(name='Администратор').exists()
    )


def _serialize_for_audit(serializer) -> dict | None:
    try:
        raw = serializer.data
    except Exception:
        return None
    return json.loads(json.dumps(raw, ensure_ascii=False, default=str))


class AuditLogMixin:
    audit_entity_label = ''

    def _get_audit_entity(self):
        if self.audit_entity_label:
            return self.audit_entity_label
        model = getattr(self.get_queryset(), 'model', None)
        if model is None:
            return self.__class__.__name__.replace('ViewSet', '')
        return model._meta.verbose_name

    def _build_summary(self, action: str, instance):
        action_labels = {
            AuditLog.Action.CREATE: 'Создана запись',
            AuditLog.Action.UPDATE: 'Изменена запись',
            AuditLog.Action.DELETE: 'Удалена запись',
        }
        obj_title = str(instance) if instance is not None else ''
        return f"{action_labels.get(action, 'Изменение')} {self._get_audit_entity()}: {obj_title}".strip()

    def get_audit_snapshot(self, instance):
        """Снимок для журнала; переопределяется для тяжёлых моделей (например Product)."""
        return _serialize_for_audit(self.get_serializer(instance))

    def _snapshot_instance(self, instance):
        try:
            snap = self.get_audit_snapshot(instance)
            if snap is None:
                return None
            return json.loads(json.dumps(snap, ensure_ascii=False, default=str))
        except Exception:
            logger.exception('Не удалось сформировать снимок для аудита: %s', instance)
            return None

    def _create_audit_log(self, *, action: str, instance, before_data=None, after_data=None):
        try:
            request = getattr(self, 'request', None)
            actor = getattr(request, 'user', None)
            if actor is not None and not actor.is_authenticated:
                actor = None

            AuditLog.objects.create(
                actor=actor,
                action=action,
                entity_type=self._get_audit_entity(),
                object_id=str(getattr(instance, 'pk', '')),
                object_repr=str(instance),
                summary=self._build_summary(action, instance),
                before_data=before_data,
                after_data=after_data,
            )
        except Exception:
            logger.exception(
                'Запись AuditLog не выполнена (action=%s, entity=%s, pk=%s)',
                action,
                self._get_audit_entity(),
                getattr(instance, 'pk', None),
            )

    def perform_create(self, serializer):
        super().perform_create(serializer)
        self._create_audit_log(
            action=AuditLog.Action.CREATE,
            instance=serializer.instance,
            before_data=None,
            after_data=self._snapshot_instance(serializer.instance),
        )

    def perform_update(self, serializer):
        before_data = self._snapshot_instance(serializer.instance)
        super().perform_update(serializer)
        self._create_audit_log(
            action=AuditLog.Action.UPDATE,
            instance=serializer.instance,
            before_data=before_data,
            after_data=self._snapshot_instance(serializer.instance),
        )

    def perform_destroy(self, instance):
        before_data = self._snapshot_instance(instance)
        # Важно: сначала удалить объект, и только после успешного выполнения
        # записать событие в аудит. Это предотвращает ложные записи DELETE при ошибках
        # (например ProtectedError из-за PROTECT).
        object_id = str(getattr(instance, 'pk', ''))
        object_repr = str(instance)
        entity_type = self._get_audit_entity()
        summary = self._build_summary(AuditLog.Action.DELETE, instance)
        super().perform_destroy(instance)

        # После удаления в instance может не остаться валидных полей, поэтому
        # атрибуты логируются из сохранённых значений.
        try:
            request = getattr(self, 'request', None)
            actor = getattr(request, 'user', None)
            if actor is not None and not actor.is_authenticated:
                actor = None
            AuditLog.objects.create(
                actor=actor,
                action=AuditLog.Action.DELETE,
                entity_type=entity_type,
                object_id=object_id,
                object_repr=object_repr,
                summary=summary,
                before_data=before_data,
                after_data=None,
            )
        except Exception:
            logger.exception(
                'Запись AuditLog (DELETE) не выполнена: entity=%s pk=%s',
                entity_type,
                object_id,
            )


class AuditedModelViewSet(AuditLogMixin, viewsets.ModelViewSet):
    pass


class CategoryViewSet(AuditedModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [CategoryPermission]
    audit_entity_label = 'Категория'

    def destroy(self, request, *args, **kwargs):
        """
        Блокировка удаления категории при наличии товаров.
        Возвращает JSON со счётчиками, чтобы админ мог принять решение.
        """
        instance = self.get_object()
        products_qs = Product.objects.filter(category=instance).only('id', 'name', 'sku')
        product_count = products_qs.count()

        if product_count > 0:
            sample = list(products_qs.values('name', 'sku')[:25])
            return Response(
                {
                    'detail': 'Категорию нельзя удалить: на неё ссылаются товары.',
                    'product_count': product_count,
                    'products': sample,
                },
                status=409,
            )

        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        # q: поиск по имени (токенами)
        qs = _apply_tokenized_search(qs, params.get('q'), ['name__icontains'])

        # parent: root (parent IS NULL) или id
        parent = params.get('parent')
        if parent is not None and parent != '' and parent != 'all':
            if str(parent).lower() == 'root':
                qs = qs.filter(parent__isnull=True)
            else:
                try:
                    qs = qs.filter(parent_id=int(parent))
                except (TypeError, ValueError):
                    pass

        return qs.order_by('id')


class ProductViewSet(AuditedModelViewSet):
    queryset = (
        Product.objects.select_related('category')
        .prefetch_related(
            'body_type_compatibilities__body_type__generation__car_model__brand',
            'tech_variant_compatibilities__tech_variant__generation__car_model__brand',
        )
        .all()
    )
    serializer_class = ProductSerializer
    permission_classes = [ProductCategoryPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    audit_entity_label = 'Товар'

    def get_audit_snapshot(self, instance):
        """Без списков совместимостей — меньше объём JSON и стабильнее сериализация."""
        if not isinstance(instance, Product):
            return _serialize_for_audit(self.get_serializer(instance))
        return {
            'id': instance.pk,
            'name': instance.name,
            'sku': instance.sku,
            'price': str(instance.price),
            'stock': instance.stock,
            'description': instance.description,
            'category': instance.category_id,
            'brand_name': instance.brand_name,
            'compatibility_mode': instance.compatibility_mode,
            'image': instance.image.name if getattr(instance, 'image', None) else None,
        }

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        vehicle_context = _build_vehicle_context_from_params(params)

        # q: поиск по полям товара + совместимостям.
        qs = _apply_tokenized_search(
            qs,
            params.get('q'),
            [
                'name__icontains',
                'sku__icontains',
                'brand_name__icontains',
                'category__name__icontains',
                # body-type совместимости
                'body_type_compatibilities__body_type__generation__car_model__brand__name__icontains',
                'body_type_compatibilities__body_type__generation__car_model__name__icontains',
                'body_type_compatibilities__body_type__generation__name__icontains',
                'body_type_compatibilities__body_type__name__icontains',
                # tech-variant совместимости
                'tech_variant_compatibilities__tech_variant__generation__car_model__brand__name__icontains',
                'tech_variant_compatibilities__tech_variant__generation__car_model__name__icontains',
                'tech_variant_compatibilities__tech_variant__generation__name__icontains',
                'tech_variant_compatibilities__tech_variant__engine_code__icontains',
                'tech_variant_compatibilities__tech_variant__transmission_code__icontains',
            ],
        )

        category = params.get('category')
        if category is not None and category != '' and category != 'all':
            try:
                cid = int(category)
                cat_ids = Category.subtree_ids(cid)
                qs = qs.filter(category_id__in=cat_ids)
            except (TypeError, ValueError):
                pass

        brand_name = params.get('brand_name')
        if brand_name:
            qs = qs.filter(brand_name__icontains=str(brand_name).strip())

        price_min = params.get('price_min')
        if price_min not in (None, ''):
            try:
                qs = qs.filter(price__gte=Decimal(str(price_min).strip()))
            except (InvalidOperation, ValueError, TypeError):
                pass
        price_max = params.get('price_max')
        if price_max not in (None, ''):
            try:
                qs = qs.filter(price__lte=Decimal(str(price_max).strip()))
            except (InvalidOperation, ValueError, TypeError):
                pass

        compatibility_mode = params.get('compatibility_mode')
        if compatibility_mode and compatibility_mode != 'all':
            qs = qs.filter(compatibility_mode=str(compatibility_mode).strip())

        fitment_only = _parse_bool_param(params.get('fitment_only'))
        if _has_vehicle_context(vehicle_context):
            filtered_qs = _filter_products_by_vehicle_context(qs, vehicle_context)
            if fitment_only is True:
                qs = filtered_qs
            elif fitment_only is False:
                qs = qs.exclude(id__in=filtered_qs.values('id'))

        in_stock = _parse_bool_param(params.get('in_stock'))
        if in_stock is True:
            qs = qs.filter(stock__gt=0)
        elif in_stock is False:
            qs = qs.filter(stock__lte=0)

        allowed_orderings = {
            'id': 'id',
            '-id': '-id',
            'name': 'name',
            '-name': '-name',
            'sku': 'sku',
            '-sku': '-sku',
            'price': 'price',
            '-price': '-price',
            'stock': 'stock',
            '-stock': '-stock',
        }
        qs = _apply_ordering(qs, params.get('ordering'), allowed_orderings, default='-id')
        return qs.distinct()

    def create(self, request, *args, **kwargs):
        if not request.user.has_perm('catalog.add_product'):
            raise PermissionDenied('Недостаточно прав для создания товара')
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not request.user.has_perm('catalog.delete_product'):
            raise PermissionDenied('Недостаточно прав для удаления товара')
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='adjust-stock', permission_classes=[IsAuthenticated])
    def adjust_stock(self, request, pk=None):
        if not request.user.has_perm('catalog.change_product'):
            raise PermissionDenied('Недостаточно прав для изменения остатков товара')

        product = self.get_object()
        stock = request.data.get('stock')
        delta = request.data.get('delta')

        if stock is not None and delta is not None:
            return Response(
                {'detail': 'Укажите либо stock, либо delta, но не оба сразу.'},
                status=400,
            )

        from django.db import transaction
        from django.db.models import F

        with transaction.atomic():
            if stock is not None:
                try:
                    new_stock = int(stock)
                except (TypeError, ValueError):
                    return Response({'detail': 'Поле stock должно быть целым числом.'}, status=400)
                if new_stock < 0:
                    new_stock = 0
                product.stock = new_stock
                product.save(update_fields=['stock'])
            elif delta is not None:
                try:
                    delta_int = int(delta)
                except (TypeError, ValueError):
                    return Response({'detail': 'Поле delta должно быть целым числом.'}, status=400)
                Product.objects.filter(pk=product.pk).update(
                    stock=F('stock') + delta_int,
                )
                product.refresh_from_db(fields=['stock'])
                if product.stock < 0:
                    product.stock = 0
                    product.save(update_fields=['stock'])
            else:
                return Response(
                    {'detail': 'Нужно передать либо stock, либо delta.'},
                    status=400,
                )

        return Response(ProductSerializer(product, context={'request': request}).data)


class BrandViewSet(AuditedModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    audit_entity_label = 'Марка авто'

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        ids_raw = params.get('ids') or params.get('brand_ids')
        if ids_raw:
            parts = [p.strip() for p in str(ids_raw).split(',') if p.strip()]
            id_list = []
            for p in parts:
                try:
                    id_list.append(int(p))
                except ValueError:
                    pass
            if id_list:
                qs = qs.filter(id__in=id_list)

        qs = _apply_tokenized_search(qs, params.get('q'), ['name__icontains'])

        allowed_orderings = {'id': 'id', '-id': '-id', 'name': 'name', '-name': '-name'}
        return _apply_ordering(qs, params.get('ordering'), allowed_orderings, default='id')

    def _get_generation_queryset(self, brand: Brand):
        return Generation.objects.filter(car_model__brand_id=brand.id)

    @action(detail=True, methods=['get'], url_path='delete-impact', permission_classes=[DjangoModelPermissions])
    def delete_impact(self, request, pk=None):
        brand = self.get_object()
        generation_qs = self._get_generation_queryset(brand)

        body_types_count = BodyType.objects.filter(generation__in=generation_qs).count()
        tech_variants_count = TechVariant.objects.filter(generation__in=generation_qs).count()
        generations_count = generation_qs.count()

        product_body_compat_count = ProductBodyTypeCompatibility.objects.filter(
            body_type__generation__in=generation_qs,
        ).count()
        product_tech_compat_count = ProductTechVariantCompatibility.objects.filter(
            tech_variant__generation__in=generation_qs,
        ).count()

        return Response(
            {
                'generations_count': generations_count,
                'body_types_count': body_types_count,
                'tech_variants_count': tech_variants_count,
                'product_body_compat_count': product_body_compat_count,
                'product_tech_compat_count': product_tech_compat_count,
            }
        )

    def destroy(self, request, *args, **kwargs):
        mode = request.query_params.get('mode', 'cascade')
        brand = self.get_object()

        if mode not in {'cascade', 'detach_tech'}:
            return Response({'detail': 'Некорректный режим удаления'}, status=400)

        generation_qs = self._get_generation_queryset(brand)
        with transaction.atomic():
            if mode == 'cascade':
                audit_subtree_before_brand_destroy_cascade(request, brand)
            else:
                detach_tech_for_brand_subtree(request, brand)
                log_imminent_body_type_deletes(request, generation_qs)
                log_imminent_generation_deletes(request, generation_qs)
                log_imminent_car_model_deletes(request, CarModel.objects.filter(brand_id=brand.id))
            return super().destroy(request, *args, **kwargs)


class CarModelViewSet(AuditedModelViewSet):
    queryset = CarModel.objects.select_related('brand').all()
    serializer_class = CarModelSerializer
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    audit_entity_label = 'Модель авто'

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        qs = _apply_tokenized_search(qs, params.get('q'), ['name__icontains', 'brand__name__icontains'])

        brand = params.get('brand')
        if brand is not None and brand != '' and brand != 'all':
            try:
                qs = qs.filter(brand_id=int(brand))
            except (TypeError, ValueError):
                pass

        allowed_orderings = {'id': 'id', '-id': '-id', 'name': 'name', '-name': '-name'}
        return _apply_ordering(qs, params.get('ordering'), allowed_orderings, default='name')

    def _get_generation_queryset(self, car_model: CarModel):
        return Generation.objects.filter(car_model_id=car_model.id)

    @action(detail=True, methods=['get'], url_path='delete-impact', permission_classes=[DjangoModelPermissions])
    def delete_impact(self, request, pk=None):
        car_model = self.get_object()
        generation_qs = self._get_generation_queryset(car_model)

        body_types_count = BodyType.objects.filter(generation__in=generation_qs).count()
        tech_variants_count = TechVariant.objects.filter(generation__in=generation_qs).count()
        generations_count = generation_qs.count()

        product_body_compat_count = ProductBodyTypeCompatibility.objects.filter(
            body_type__generation__in=generation_qs,
        ).count()
        product_tech_compat_count = ProductTechVariantCompatibility.objects.filter(
            tech_variant__generation__in=generation_qs,
        ).count()

        return Response(
            {
                'generations_count': generations_count,
                'body_types_count': body_types_count,
                'tech_variants_count': tech_variants_count,
                'product_body_compat_count': product_body_compat_count,
                'product_tech_compat_count': product_tech_compat_count,
            }
        )

    def destroy(self, request, *args, **kwargs):
        mode = request.query_params.get('mode', 'cascade')
        car_model = self.get_object()

        if mode not in {'cascade', 'detach_tech'}:
            return Response({'detail': 'Некорректный режим удаления'}, status=400)

        generation_qs = self._get_generation_queryset(car_model)
        with transaction.atomic():
            if mode == 'cascade':
                audit_subtree_before_car_model_destroy_cascade(request, car_model)
            else:
                detach_tech_for_car_model_subtree(request, car_model)
                log_imminent_body_type_deletes(request, generation_qs)
                log_imminent_generation_deletes(request, generation_qs)
            return super().destroy(request, *args, **kwargs)


class GenerationViewSet(AuditedModelViewSet):
    queryset = Generation.objects.select_related('car_model__brand').all()
    serializer_class = GenerationSerializer
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    audit_entity_label = 'Поколение авто'

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        qs = _apply_tokenized_search(
            qs,
            params.get('q'),
            ['name__icontains', 'car_model__name__icontains', 'car_model__brand__name__icontains'],
        )

        car_model = params.get('car_model')
        if car_model is not None and car_model != '' and car_model != 'all':
            try:
                qs = qs.filter(car_model_id=int(car_model))
            except (TypeError, ValueError):
                pass

        allowed_orderings = {'id': 'id', '-id': '-id', 'name': 'name', '-name': '-name'}
        return _apply_ordering(qs, params.get('ordering'), allowed_orderings, default='name')

    def _get_generation_queryset(self, generation: Generation):
        return Generation.objects.filter(id=generation.id)

    @action(detail=True, methods=['get'], url_path='delete-impact', permission_classes=[DjangoModelPermissions])
    def delete_impact(self, request, pk=None):
        generation = self.get_object()
        generation_qs = self._get_generation_queryset(generation)

        body_types_count = BodyType.objects.filter(generation__in=generation_qs).count()
        tech_variants_count = TechVariant.objects.filter(generation__in=generation_qs).count()
        generations_count = generation_qs.count()

        product_body_compat_count = ProductBodyTypeCompatibility.objects.filter(
            body_type__generation__in=generation_qs,
        ).count()
        product_tech_compat_count = ProductTechVariantCompatibility.objects.filter(
            tech_variant__generation__in=generation_qs,
        ).count()

        return Response(
            {
                'generations_count': generations_count,
                'body_types_count': body_types_count,
                'tech_variants_count': tech_variants_count,
                'product_body_compat_count': product_body_compat_count,
                'product_tech_compat_count': product_tech_compat_count,
            }
        )

    def destroy(self, request, *args, **kwargs):
        mode = request.query_params.get('mode', 'cascade')
        generation = self.get_object()

        if mode not in {'cascade', 'detach_tech'}:
            return Response({'detail': 'Некорректный режим удаления'}, status=400)

        generation_qs = self._get_generation_queryset(generation)
        with transaction.atomic():
            if mode == 'cascade':
                audit_subtree_before_generation_destroy_cascade(request, generation)
            else:
                detach_tech_for_generation_subtree(request, generation)
                log_imminent_body_type_deletes(request, generation_qs)
            return super().destroy(request, *args, **kwargs)


class BodyTypeViewSet(AuditedModelViewSet):
    queryset = BodyType.objects.select_related('generation__car_model__brand').all()
    serializer_class = BodyTypeSerializer
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    audit_entity_label = 'Тип кузова'

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        generation = params.get('generation')
        if generation is not None and generation != '' and generation != 'all':
            try:
                qs = qs.filter(generation_id=int(generation))
            except (TypeError, ValueError):
                pass

        name = params.get('name') or params.get('q')
        qs = _apply_tokenized_search(qs, name, ['name__icontains', 'generation__name__icontains'])

        allowed_orderings = {'id': 'id', '-id': '-id', 'name': 'name', '-name': '-name'}
        return _apply_ordering(qs, params.get('ordering'), allowed_orderings, default='name')


class ProductBodyTypeCompatibilityViewSet(AuditedModelViewSet):
    queryset = ProductBodyTypeCompatibility.objects.select_related('product', 'body_type__generation__car_model__brand').all()
    serializer_class = ProductBodyTypeCompatibilitySerializer
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    audit_entity_label = 'Совместимость товара по кузову'


class ProductTechVariantCompatibilityViewSet(AuditedModelViewSet):
    queryset = ProductTechVariantCompatibility.objects.select_related('product', 'tech_variant__generation__car_model__brand').all()
    serializer_class = ProductTechVariantCompatibilitySerializer
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    audit_entity_label = 'Совместимость товара по конфигурации'


class TechVariantViewSet(AuditedModelViewSet):
    queryset = TechVariant.objects.select_related('generation__car_model__brand').all()
    serializer_class = TechVariantSerializer
    permission_classes = [DjangoModelPermissionsOrAnonReadOnly]
    audit_entity_label = 'Техническая конфигурация'

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        qs = _apply_tokenized_search(
            qs,
            params.get('q'),
            [
                'engine_code__icontains',
                'transmission_code__icontains',
                'transmission_type__icontains',
                'generation__name__icontains',
                'generation__car_model__name__icontains',
                'generation__car_model__brand__name__icontains',
            ],
        )

        generation = params.get('generation')
        if generation is not None and generation != '' and generation != 'all':
            try:
                qs = qs.filter(generation_id=int(generation))
            except (TypeError, ValueError):
                pass

        transmission_type = params.get('transmission_type')
        if transmission_type:
            qs = qs.filter(transmission_type=str(transmission_type).strip())

        engine_type = params.get('engine_type')
        if engine_type and engine_type in TechVariant.EngineType.values:
            qs = qs.filter(engine_type=engine_type)

        fuel_type = params.get('fuel_type')
        if fuel_type and fuel_type in TechVariant.FuelType.values:
            qs = qs.filter(fuel_type=fuel_type)

        power_min = params.get('power_min')
        if power_min not in (None, ''):
            try:
                qs = qs.filter(power_hp__gte=int(str(power_min).strip()))
            except (ValueError, TypeError):
                pass
        power_max = params.get('power_max')
        if power_max not in (None, ''):
            try:
                qs = qs.filter(power_hp__lte=int(str(power_max).strip()))
            except (ValueError, TypeError):
                pass

        ordering_raw = params.get('ordering')
        if ordering_raw in ('power_hp', '-power_hp'):
            if ordering_raw == 'power_hp':
                return qs.order_by(F('power_hp').asc(nulls_last=True))
            return qs.order_by(F('power_hp').desc(nulls_last=True))

        allowed_orderings = {
            'engine_code': 'engine_code',
            '-engine_code': '-engine_code',
            'transmission_code': 'transmission_code',
            '-transmission_code': '-transmission_code',
            'generation': 'generation__name',
            '-generation': '-generation__name',
        }
        return _apply_ordering(qs, ordering_raw, allowed_orderings, default='-id')


class OrderViewSet(mixins.ListModelMixin,
                   mixins.RetrieveModelMixin,
                   viewsets.GenericViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, OrderPermission]

    def get_queryset(self):
        user: User = self.request.user
        qs = Order.objects.select_related('user').prefetch_related('items__product')
        if user.is_admin() or user.is_manager():
            status = self.request.query_params.get('status')
            if status and status in Order.Status.values:
                qs = qs.filter(status=status)
            user_id = self.request.query_params.get('user_id')
            if user_id:
                qs = qs.filter(user_id=user_id)
            return qs
        return qs.filter(user=user)

    @action(detail=True, methods=['patch'], url_path='status', permission_classes=[IsAuthenticated, IsManagerOrAdmin])
    def set_status(self, request, pk=None):
        order = self.get_object()
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']
        order.change_status(new_status, changed_by=request.user)
        return Response(OrderSerializer(order, context={'request': request}).data)


class MessageViewSet(mixins.ListModelMixin,
                     mixins.CreateModelMixin,
                     viewsets.GenericViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user: User = self.request.user
        qs = Message.objects.select_related('order', 'author')

        order_id = self.request.query_params.get('order_id')
        if order_id:
            qs = qs.filter(order_id=order_id)

        after_id = self.request.query_params.get('after_id')
        if after_id:
            qs = qs.filter(id__gt=after_id)

        if user.is_admin() or user.is_manager():
            return qs
        return qs.filter(order__user=user)

    def perform_create(self, serializer):
        user: User = self.request.user
        order = serializer.validated_data['order']
        if user.is_client() and order.user_id != user.id:
            raise PermissionDenied('Вы не можете писать в чужой заказ')

        serializer.save(author=user)


class UserViewSet(AuditLogMixin,
                  mixins.ListModelMixin,
                  mixins.RetrieveModelMixin,
                  mixins.CreateModelMixin,
                  mixins.UpdateModelMixin,
                  viewsets.GenericViewSet):
    """
    Управление пользователями:
    - MANAGER/ADMIN: просмотр списка и деталей;
    - ADMIN (через права add_user/change_user): создание и изменение ролей/блокировка.
    """

    queryset = User.objects.all().order_by('id')
    serializer_class = UserSerializer
    permission_classes = [IsManagerOrAdmin]
    audit_entity_label = 'Пользователь'

    def get_audit_snapshot(self, instance):
        if isinstance(instance, User):
            return {
                'id': instance.pk,
                'username': instance.username,
                'email': instance.email,
                'role': instance.role,
                'is_active': instance.is_active,
                'is_staff': instance.is_staff,
            }
        return super().get_audit_snapshot(instance)

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        qs = _apply_tokenized_search(qs, params.get('q'), ['username__icontains', 'email__icontains'])

        role = params.get('role')
        if role and role != 'all':
            qs = qs.filter(role=str(role).strip())

        is_active = _parse_bool_param(params.get('is_active'))
        if is_active is True:
            qs = qs.filter(is_active=True)
        elif is_active is False:
            qs = qs.filter(is_active=False)

        allowed_orderings = {
            'id': 'id',
            '-id': '-id',
            'username': 'username',
            '-username': '-username',
            'email': 'email',
            '-email': '-email',
            'role': 'role',
            '-role': '-role',
        }
        return _apply_ordering(qs, params.get('ordering'), allowed_orderings, default='id')

    def perform_create(self, serializer):
        user = self.request.user
        if not user.has_perm('accounts.add_user'):
            raise PermissionDenied('Недостаточно прав для создания пользователей')
        mixins.CreateModelMixin.perform_create(self, serializer)
        self._create_audit_log(
            action=AuditLog.Action.CREATE,
            instance=serializer.instance,
            before_data=None,
            after_data=self._snapshot_instance(serializer.instance),
        )

    def perform_update(self, serializer):
        user = self.request.user
        if not user.has_perm('accounts.change_user'):
            raise PermissionDenied('Недостаточно прав для изменения пользователей')
        is_manager = getattr(user, 'is_manager', lambda: False)()
        is_admin = getattr(user, 'is_admin', lambda: False)()
        instance = serializer.instance

        if is_manager and not is_admin:
            new_role = serializer.validated_data.get('role')
            if new_role is not None and new_role != instance.role:
                raise PermissionDenied('Недостаточно прав для изменения роли пользователя')

        new_is_active = serializer.validated_data.get('is_active')
        is_becoming_inactive = new_is_active is False and instance.is_active
        if is_becoming_inactive and instance.role == User.Roles.ADMIN:
            has_other_admins = User.objects.filter(
                role=User.Roles.ADMIN,
                is_active=True,
            ).exclude(pk=instance.pk).exists()
            if not has_other_admins:
                raise ValidationError('Должен быть хотя бы один активный администратор.')

        before_data = self._snapshot_instance(serializer.instance)
        mixins.UpdateModelMixin.perform_update(self, serializer)
        self._create_audit_log(
            action=AuditLog.Action.UPDATE,
            instance=serializer.instance,
            before_data=before_data,
            after_data=self._snapshot_instance(serializer.instance),
        )


class AdminStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        if not _has_admin_backoffice_access(user):
            raise PermissionDenied('Недостаточно прав для просмотра статистики')

        total_orders = Order.objects.count()
        total_revenue = (
            OrderItem.objects.aggregate(
                total=Sum(F('quantity') * F('unit_price'))
            )['total']
            or 0
        )
        total_users = User.objects.count()
        users_by_role = (
            User.objects.values('role')
            .annotate(count=Count('id'))
            .order_by('role')
        )
        orders_by_status = (
            Order.objects.values('status')
            .annotate(count=Count('id'))
            .order_by('status')
        )

        data = {
            'total_orders': total_orders,
            'total_revenue': str(total_revenue),
            'total_users': total_users,
            'users_by_role': list(users_by_role),
            'orders_by_status': list(orders_by_status),
        }
        return Response(data)


class AuditLogViewSet(mixins.ListModelMixin,
                      mixins.RetrieveModelMixin,
                      viewsets.GenericViewSet):
    queryset = AuditLog.objects.select_related('actor').all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AuditLogDetailSerializer
        return AuditLogListSerializer

    def get_queryset(self):
        if not _has_admin_backoffice_access(self.request.user):
            raise PermissionDenied('Недостаточно прав для просмотра журнала изменений')

        qs = super().get_queryset()
        params = self.request.query_params
        qs = _apply_tokenized_search(
            qs,
            params.get('q'),
            ['entity_type__icontains', 'object_repr__icontains', 'summary__icontains', 'actor__username__icontains'],
        )

        action = params.get('action')
        if action in AuditLog.Action.values:
            qs = qs.filter(action=action)

        entity_type = params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type__icontains=str(entity_type).strip())

        return qs.order_by('-created_at', '-id')


def _serialize_favorites(fav: Favorites):
    products = Product.objects.filter(id__in=fav.ids)
    by_id = {p.id: p for p in products}
    items = []
    for pid in fav.ids:
        p = by_id.get(pid)
        if p:
            items.append(
                {
                    'id': p.id,
                    'name': p.name,
                    'sku': p.sku,
                    'price': str(p.price),
                    'stock': p.stock,
                }
            )
    return {'product_ids': list(fav.ids), 'items': items, 'count': len(items)}


def _serialize_cart(cart: Cart, vehicle_context: dict | None):
    items = []
    for entry in cart:
        product = entry['product']
        fitment_status = _calc_product_fitment_status(product, vehicle_context)
        items.append(
            {
                'product_id': product.id,
                'product_name': product.name,
                'product_sku': product.sku,
                'quantity': entry['quantity'],
                'unit_price': str(entry['unit_price']),
                'total_price': str(entry['total_price']),
                'fitment_status': fitment_status,
                'selected_vehicle_context': entry.get('vehicle_context') or {},
            }
        )
    total_qty = sum(i['quantity'] for i in items)
    total_price = sum(Decimal(i['total_price']) for i in items) if items else Decimal('0')
    return {
        'items': items,
        'total_quantity': total_qty,
        'total_price': str(total_price),
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def storefront_favorites_detail(request):
    fav = Favorites(request)
    return Response(_serialize_favorites(fav))


@api_view(['POST'])
@permission_classes([AllowAny])
def storefront_favorites_toggle_item(request):
    product_id = _to_int_or_none(request.data.get('product_id'))
    if not product_id:
        return Response({'detail': 'Нужен product_id'}, status=status.HTTP_400_BAD_REQUEST)

    if not Product.objects.filter(id=product_id).exists():
        return Response({'detail': 'Товар не найден'}, status=status.HTTP_404_NOT_FOUND)

    fav = Favorites(request)
    is_favorite = fav.toggle(product_id)
    payload = _serialize_favorites(fav)
    payload['is_favorite'] = is_favorite
    return Response(payload, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([AllowAny])
def storefront_favorites_remove_item(request, product_id: int):
    fav = Favorites(request)
    fav.remove(product_id)
    return Response(_serialize_favorites(fav))


@api_view(['POST'])
@permission_classes([AllowAny])
def storefront_favorites_clear(request):
    fav = Favorites(request)
    fav.clear()
    return Response({'detail': 'Избранное очищено'})


@api_view(['GET'])
@permission_classes([AllowAny])
def storefront_cart_detail(request):
    cart = Cart(request)
    vehicle_context = _build_vehicle_context_from_params(request.query_params)
    return Response(_serialize_cart(cart, vehicle_context))


@api_view(['POST'])
@permission_classes([AllowAny])
def storefront_cart_add_item(request):
    product_id = _to_int_or_none(request.data.get('product_id'))
    quantity = _to_int_or_none(request.data.get('quantity')) or 1
    if not product_id or quantity <= 0:
        return Response({'detail': 'Некорректные product_id/quantity'}, status=status.HTTP_400_BAD_REQUEST)

    product = Product.objects.filter(id=product_id).first()
    if not product:
        return Response({'detail': 'Товар не найден'}, status=status.HTTP_404_NOT_FOUND)

    vehicle_context = request.data.get('vehicle_context') or {}
    if not isinstance(vehicle_context, dict):
        vehicle_context = {}

    cart = Cart(request)
    fitment_status = _calc_product_fitment_status(product, vehicle_context)
    cart.add(product_id=product.id, quantity=quantity, unit_price=product.price, vehicle_context=vehicle_context, fitment_status=fitment_status)
    return Response(_serialize_cart(cart, vehicle_context), status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([AllowAny])
def storefront_cart_update_item(request, product_id: int):
    quantity = _to_int_or_none(request.data.get('quantity'))
    if quantity is None:
        return Response({'detail': 'Поле quantity обязательно'}, status=status.HTTP_400_BAD_REQUEST)

    vehicle_context = request.data.get('vehicle_context') or {}
    if not isinstance(vehicle_context, dict):
        vehicle_context = {}

    cart = Cart(request)
    cart.set_quantity(product_id, quantity)
    return Response(_serialize_cart(cart, vehicle_context))


@api_view(['DELETE'])
@permission_classes([AllowAny])
def storefront_cart_remove_item(request, product_id: int):
    cart = Cart(request)
    cart.remove(product_id)
    vehicle_context = _build_vehicle_context_from_params(request.query_params)
    return Response(_serialize_cart(cart, vehicle_context))


@api_view(['POST'])
@permission_classes([AllowAny])
def storefront_cart_clear(request):
    cart = Cart(request)
    cart.clear()
    return Response({'detail': 'Корзина очищена'})


def _storefront_checkout_precheck(cart: Cart, vehicle_context: dict, allow_conflicts: bool):
    items = list(cart)
    if not items:
        return Response({'detail': 'Корзина пуста'}, status=status.HTTP_400_BAD_REQUEST), None, None

    stock_errors = []
    fitment_errors = []
    products_map = {}
    for item in items:
        product = item['product']
        products_map[product.id] = product
        if product.stock < item['quantity']:
            stock_errors.append(
                {
                    'product_id': product.id,
                    'product_name': product.name,
                    'requested': item['quantity'],
                    'available': product.stock,
                }
            )
        fitment_status = _calc_product_fitment_status(product, vehicle_context)
        if fitment_status == 'conflict':
            fitment_errors.append({'product_id': product.id, 'product_name': product.name})

    if stock_errors:
        return (
            Response({'detail': 'Недостаточно товара на складе', 'stock_errors': stock_errors}, status=status.HTTP_409_CONFLICT),
            None,
            None,
        )

    if fitment_errors and not allow_conflicts:
        return (
            Response(
                {
                    'detail': 'В корзине есть несовместимые позиции',
                    'fitment_errors': fitment_errors,
                    'can_override': True,
                },
                status=status.HTTP_409_CONFLICT,
            ),
            None,
            None,
        )

    return None, items, products_map


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def storefront_checkout_validate(request):
    cart = Cart(request)
    allow_conflicts = bool(request.data.get('allow_conflicts'))
    raw_context = request.data.get('vehicle_context') or {}
    vehicle_context = raw_context if isinstance(raw_context, dict) else {}

    err, _items, _products_map = _storefront_checkout_precheck(cart, vehicle_context, allow_conflicts)
    if err is not None:
        return err
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def storefront_checkout(request):
    cart = Cart(request)
    allow_conflicts = bool(request.data.get('allow_conflicts'))
    raw_context = request.data.get('vehicle_context') or {}
    vehicle_context = raw_context if isinstance(raw_context, dict) else {}

    err, items, products_map = _storefront_checkout_precheck(cart, vehicle_context, allow_conflicts)
    if err is not None:
        return err

    with transaction.atomic():
        order = Order.objects.create(user=request.user)
        for item in items:
            product = products_map[item['product'].id]
            qty = item['quantity']
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=qty,
                unit_price=item['unit_price'],
            )
            product.stock = max(0, product.stock - qty)
            product.save(update_fields=['stock'])

    cart.clear()
    return Response({'order_id': order.id}, status=status.HTTP_201_CREATED)


class PromotionViewSet(AuditedModelViewSet):
    queryset = Promotion.objects.all().order_by('sort_order', '-id')
    serializer_class = PromotionSerializer
    permission_classes = [IsAuthenticated, DjangoModelPermissions]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    audit_entity_label = 'Акция'


class FAQItemViewSet(AuditedModelViewSet):
    queryset = FAQItem.objects.all().order_by('sort_order', 'id')
    serializer_class = FAQItemSerializer
    permission_classes = [IsAuthenticated, DjangoModelPermissions]
    parser_classes = [JSONParser, FormParser]
    audit_entity_label = 'Вопрос FAQ'


@api_view(['GET'])
@permission_classes([AllowAny])
def storefront_promotions_list(request):
    qs = Promotion.objects.filter(is_published=True).order_by('sort_order', '-id')
    ser = PromotionPublicSerializer(qs, many=True, context={'request': request})
    return Response(ser.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def storefront_faq_list(request):
    qs = FAQItem.objects.filter(is_active=True).order_by('sort_order', 'id')
    ser = FAQItemPublicSerializer(qs, many=True)
    return Response(ser.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def storefront_site_blocks_list(request):
    qs = SiteBlock.objects.all().order_by('slug')
    ser = SiteBlockPublicSerializer(qs, many=True)
    return Response(ser.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def storefront_category_cover_images(request):
    raw = (request.GET.get('ids') or '').strip()
    if not raw:
        return Response({})
    parsed: list[int] = []
    for part in raw.split(','):
        part = part.strip()
        if part.isdigit():
            parsed.append(int(part))
    parsed = parsed[:40]
    out: dict[str, str] = {}
    for cid in parsed:
        tree_ids = Category.subtree_ids(cid)
        prod = (
            Product.objects.filter(category_id__in=tree_ids)
            .exclude(image='')
            .exclude(image__isnull=True)
            .order_by('id')
            .first()
        )
        if prod and prod.image:
            out[str(cid)] = request.build_absolute_uri(prod.image.url)
    return Response(out)


class StorefrontReviewListCreate(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request):
        qs = Review.objects.filter(is_published=True).select_related('user').order_by('-created_at')
        ser = ReviewPublicSerializer(qs, many=True, context={'request': request})
        return Response(ser.data)

    def post(self, request):
        ser = ReviewCreateSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(
            ReviewPublicSerializer(ser.instance, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class StorefrontReviewDestroy(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        review = get_object_or_404(Review, pk=pk)
        if review.user_id != request.user.id:
            return Response({'detail': 'Можно удалить только свой отзыв.'}, status=status.HTTP_403_FORBIDDEN)
        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SiteBlockViewSet(
    AuditLogMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = SiteBlock.objects.all().order_by('slug')
    serializer_class = SiteBlockSerializer
    permission_classes = [IsAuthenticated, DjangoModelPermissions]
    parser_classes = [JSONParser, FormParser]
    audit_entity_label = 'Текстовый блок сайта'


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related('user', 'staff_reply_by').all().order_by('-created_at')
    serializer_class = ReviewManageSerializer
    permission_classes = [IsAuthenticated, DjangoModelPermissions]
    parser_classes = [JSONParser, FormParser]
