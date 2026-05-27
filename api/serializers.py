from rest_framework import serializers

from accounts.models import User
from catalog.models import (
    Brand,
    CarModel,
    Category,
    Generation,
    Product,
    ProductBodyTypeCompatibility,
    ProductTechVariantCompatibility,
    BodyType,
    TechVariant,
)
from chat.models import Message
from content.models import FAQItem, Promotion, Review, SiteBlock
from orders.models import Order, OrderItem
from .models import AuditLog


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'phone',
            'role',
            'is_active',
            'is_staff',
            'email_verified',
            'password',
        ]
        read_only_fields = ['is_staff', 'email_verified']
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
            'phone': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'Пароль обязателен.'})
        user = super().create(validated_data)
        user.set_password(password)
        user.email_verified = True
        user.email_verification_token = None
        user.save(update_fields=['password', 'email_verified', 'email_verification_token'])
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=['password'])
        return user


class CategorySerializer(serializers.ModelSerializer):
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        required=False,
        allow_null=True,
    )
    path = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'parent', 'path']

    def get_path(self, obj: Category) -> str:
        parts = []
        seen = set()
        cur = obj
        while cur is not None and cur.pk not in seen:
            seen.add(cur.pk)
            parts.append(cur.name)
            cur = cur.parent
        parts.reverse()
        return ' → '.join(parts)

    def validate_parent(self, parent: Category | None):
        # запрет циклов: parent не может быть self и не может быть потомком self
        instance: Category | None = getattr(self, 'instance', None)
        if not instance or parent is None:
            return parent
        if parent.pk == instance.pk:
            raise serializers.ValidationError('Категория не может быть родителем самой себя.')
        cur = parent
        seen = set()
        while cur is not None and cur.pk not in seen:
            seen.add(cur.pk)
            if cur.pk == instance.pk:
                raise serializers.ValidationError('Нельзя назначить потомка родителем (цикл в дереве категорий).')
            cur = cur.parent
        return parent


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    compatible_vehicles = serializers.SerializerMethodField(read_only=True)
    compatible_body_types = serializers.SerializerMethodField(read_only=True)
    compatible_tech_variants = serializers.SerializerMethodField(read_only=True)
    fitment_status = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'sku',
            'price',
            'stock',
            'description',
            'image',
            'category',
            'category_name',
            'brand_name',
            'compatibility_mode',
            'compatible_vehicles',
            'compatible_body_types',
            'compatible_tech_variants',
            'fitment_status',
        ]

    def validate_price(self, value):
        if value is None:
            raise serializers.ValidationError('Цена обязательна.')
        if value <= 0:
            raise serializers.ValidationError('Цена должна быть больше 0.')
        return value

    def get_compatible_vehicles(self, obj: Product) -> list[str]:
        """
        Возвращает список человекочитаемых строк с автомобилями,
        к которым подходит товар.
        """
        seen = set()
        result: list[str] = []

        if obj.compatibility_mode == Product.CompatibilityMode.BODY_TYPE:
            for compat in getattr(obj, 'body_type_compatibilities', []).all():
                body_type = compat.body_type
                if not body_type or not body_type.generation:
                    continue
                generation = body_type.generation
                car_model = generation.car_model
                brand = car_model.brand if car_model else None
                parts = []
                if brand:
                    parts.append(str(brand))
                if car_model:
                    parts.append(car_model.name)
                parts.append(generation.name)
                main = ' '.join(parts).strip()
                body_type_name = body_type.get_name_display() if hasattr(body_type, 'get_name_display') else body_type.name
                label = f'{main} ({body_type_name})' if body_type_name else main
                if label and label not in seen:
                    seen.add(label)
                    result.append(label)
        elif obj.compatibility_mode == Product.CompatibilityMode.TECH_VARIANT:
            for compat in getattr(obj, 'tech_variant_compatibilities', []).all():
                tv = compat.tech_variant
                if not tv or not tv.generation:
                    continue
                generation = tv.generation
                car_model = generation.car_model
                brand = car_model.brand if car_model else None
                car_label = ' / '.join([x for x in [str(brand) if brand else '', car_model.name if car_model else '', generation.name] if x])
                tech_label = f'{tv.engine_code} · {tv.get_transmission_type_display()} {tv.transmission_code}'
                label = f'{car_label} ({tech_label})'
                if label not in seen:
                    seen.add(label)
                    result.append(label)

        return result

    def get_compatible_body_types(self, obj: Product) -> list[dict]:
        items: list[dict] = []
        for compat in getattr(obj, 'body_type_compatibilities', []).all():
            body_type = compat.body_type
            if not body_type:
                continue
            items.append({
                'id': compat.id,
                'body_type_id': body_type.id,
                'generation_id': body_type.generation_id,
                'label': f'{body_type.generation} ({body_type.get_name_display()})',
                'notes': compat.notes or '',
            })
        return items

    def get_compatible_tech_variants(self, obj: Product) -> list[dict]:
        items: list[dict] = []
        for compat in getattr(obj, 'tech_variant_compatibilities', []).all():
            tv = compat.tech_variant
            if not tv:
                continue
            items.append({
                'id': compat.id,
                'tech_variant_id': tv.id,
                'generation_id': tv.generation_id,
                'label': f'{tv.generation} ({tv.engine_code} · {tv.get_transmission_type_display()} {tv.transmission_code})',
                'notes': compat.notes or '',
            })
        return items

    def get_fitment_status(self, obj: Product) -> str:
        request = self.context.get('request')
        if not request:
            return 'unknown'

        qp = request.query_params
        brand_id = qp.get('brand_id')
        model_id = qp.get('model_id')
        generation_id = qp.get('generation_id')
        body_type_id = qp.get('body_type_id')
        tech_variant_id = qp.get('tech_variant_id')
        has_context = any([brand_id, model_id, generation_id, body_type_id, tech_variant_id])
        if not has_context:
            return 'unknown'

        def _to_int(value):
            try:
                return int(value)
            except (TypeError, ValueError):
                return None

        brand_id = _to_int(brand_id)
        model_id = _to_int(model_id)
        generation_id = _to_int(generation_id)
        body_type_id = _to_int(body_type_id)
        tech_variant_id = _to_int(tech_variant_id)

        body_compats = getattr(obj, 'body_type_compatibilities', []).all()
        tech_compats = getattr(obj, 'tech_variant_compatibilities', []).all()

        if body_type_id is not None:
            return 'confirmed' if any(c.body_type_id == body_type_id for c in body_compats) else 'conflict'
        if tech_variant_id is not None:
            return 'confirmed' if any(c.tech_variant_id == tech_variant_id for c in tech_compats) else 'conflict'

        def _match_body(c):
            body = c.body_type
            if not body or not body.generation:
                return False
            gen = body.generation
            model = gen.car_model
            if generation_id is not None and gen.id != generation_id:
                return False
            if model_id is not None and (not model or model.id != model_id):
                return False
            if brand_id is not None and (not model or model.brand_id != brand_id):
                return False
            return True

        def _match_tech(c):
            tv = c.tech_variant
            if not tv or not tv.generation:
                return False
            gen = tv.generation
            model = gen.car_model
            if generation_id is not None and gen.id != generation_id:
                return False
            if model_id is not None and (not model or model.id != model_id):
                return False
            if brand_id is not None and (not model or model.brand_id != brand_id):
                return False
            return True

        is_match = any(_match_body(c) for c in body_compats) or any(_match_tech(c) for c in tech_compats)
        return 'confirmed' if is_match else 'conflict'


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['id', 'name', 'logo']


class CarModelSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True)

    class Meta:
        model = CarModel
        fields = ['id', 'brand', 'brand_name', 'name']


class GenerationSerializer(serializers.ModelSerializer):
    car_model_name = serializers.CharField(source='car_model.name', read_only=True)
    brand_id = serializers.IntegerField(source='car_model.brand_id', read_only=True)
    brand_name = serializers.CharField(source='car_model.brand.name', read_only=True)

    class Meta:
        model = Generation
        fields = ['id', 'car_model', 'car_model_name', 'brand_id', 'brand_name', 'name', 'image']


class BodyTypeSerializer(serializers.ModelSerializer):
    generation_name = serializers.CharField(source='generation.name', read_only=True)
    car_model_id = serializers.IntegerField(source='generation.car_model_id', read_only=True)
    car_model_name = serializers.CharField(source='generation.car_model.name', read_only=True)
    brand_id = serializers.IntegerField(source='generation.car_model.brand_id', read_only=True)
    brand_name = serializers.CharField(source='generation.car_model.brand.name', read_only=True)
    brand_logo = serializers.SerializerMethodField(read_only=True)
    generation_image = serializers.SerializerMethodField(read_only=True)
    name_display = serializers.CharField(source='get_name_display', read_only=True)

    class Meta:
        model = BodyType
        fields = [
            'id',
            'generation',
            'generation_name',
            'car_model_id',
            'car_model_name',
            'brand_id',
            'brand_name',
            'brand_logo',
            'generation_image',
            'name',
            'name_display',
            'image',
        ]

    def get_brand_logo(self, obj):
        try:
            brand = obj.generation.car_model.brand if obj.generation else None
        except Exception:
            return None
        if not brand or not brand.logo:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(brand.logo.url)
        return brand.logo.url

    def get_generation_image(self, obj):
        if not obj.generation or not obj.generation.image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.generation.image.url)
        return obj.generation.image.url


class TechVariantSerializer(serializers.ModelSerializer):
    generation = serializers.PrimaryKeyRelatedField(
        queryset=Generation.objects.all(),
        allow_null=True,
        required=False,
    )
    generation_name = serializers.CharField(source='generation.name', read_only=True)
    car_model_id = serializers.IntegerField(source='generation.car_model_id', read_only=True)
    car_model_name = serializers.CharField(source='generation.car_model.name', read_only=True)
    brand_id = serializers.IntegerField(source='generation.car_model.brand_id', read_only=True)
    brand_name = serializers.CharField(source='generation.car_model.brand.name', read_only=True)

    class Meta:
        model = TechVariant
        fields = [
            'id',
            'generation',
            'generation_name',
            'car_model_id',
            'car_model_name',
            'brand_id',
            'brand_name',
            'engine_code',
            'engine_type',
            'fuel_type',
            'transmission_code',
            'transmission_type',
            'gears',
            'power_hp',
            'torque_nm',
            'notes',
        ]

    def validate(self, attrs):
        # При создании конфигурации привязка к поколению обязательна,
        if self.instance is None:
            generation = attrs.get('generation')
            if generation is None:
                raise serializers.ValidationError({'generation': 'Поколение обязательно.'})
        return attrs


class ProductBodyTypeCompatibilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductBodyTypeCompatibility
        fields = ['id', 'product', 'body_type', 'notes']

    def validate(self, attrs):
        product = attrs.get('product') or getattr(self.instance, 'product', None)
        if product and product.compatibility_mode != Product.CompatibilityMode.BODY_TYPE:
            raise serializers.ValidationError('Для этого товара разрешена только техническая совместимость (TechVariant).')
        return attrs


class ProductTechVariantCompatibilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductTechVariantCompatibility
        fields = ['id', 'product', 'tech_variant', 'notes']

    def validate(self, attrs):
        product = attrs.get('product') or getattr(self.instance, 'product', None)
        if product and product.compatibility_mode != Product.CompatibilityMode.TECH_VARIANT:
            raise serializers.ValidationError('Для этого товара разрешена только совместимость по кузову (BodyType).')
        return attrs


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'product_sku', 'quantity', 'unit_price']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    customer_name = serializers.SerializerMethodField(read_only=True)
    customer_phone = serializers.CharField(source='user.phone', read_only=True)
    customer_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'user',
            'user_username',
            'customer_name',
            'customer_phone',
            'customer_email',
            'status',
            'created_at',
            'updated_at',
            'items',
        ]
        read_only_fields = ['user', 'created_at', 'updated_at', 'items']

    def get_customer_name(self, obj) -> str:
        first = (obj.user.first_name or '').strip()
        last = (obj.user.last_name or '').strip()
        full = ' '.join([p for p in (first, last) if p])
        return full or obj.user.username


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)


class MessageSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'order', 'author', 'author_username', 'text', 'created_at', 'is_mine']
        read_only_fields = ['id', 'author', 'author_username', 'created_at', 'is_mine']

    def get_is_mine(self, obj) -> bool:
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and user.id == obj.author_id)


class AuditLogListSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)
    action_label = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'created_at',
            'action',
            'action_label',
            'actor',
            'actor_username',
            'entity_type',
            'object_id',
            'object_repr',
            'summary',
        ]


class AuditLogDetailSerializer(AuditLogListSerializer):
    class Meta(AuditLogListSerializer.Meta):
        fields = AuditLogListSerializer.Meta.fields + [
            'before_data',
            'after_data',
        ]


class PromotionPublicSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = Promotion
        fields = ['id', 'title', 'description', 'image', 'sort_order']

    def get_image(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        url = obj.image.url
        if request:
            return request.build_absolute_uri(url)
        return url


class PromotionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promotion
        fields = [
            'id',
            'title',
            'description',
            'image',
            'sort_order',
            'is_published',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate_is_published(self, value):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if value and user and not user.is_admin():
            raise serializers.ValidationError('Публиковать акции может только администратор.')
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            validated_data['created_by'] = user
        return super().create(validated_data)


class FAQItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQItem
        fields = ['id', 'question', 'answer', 'sort_order', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class FAQItemPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQItem
        fields = ['id', 'question', 'answer', 'sort_order']


class SiteBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteBlock
        fields = ['id', 'slug', 'title', 'body', 'updated_at']
        read_only_fields = ['id', 'slug', 'updated_at']


class SiteBlockPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteBlock
        fields = ['slug', 'title', 'body']


class ReviewPublicSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField(read_only=True)
    is_mine = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Review
        fields = ['id', 'author_name', 'text', 'rating', 'created_at', 'staff_reply', 'staff_reply_at', 'is_mine']

    def get_is_mine(self, obj: Review) -> bool:
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        return obj.user_id == user.id

    def get_author_name(self, obj: Review) -> str:
        u = obj.user
        parts = [u.first_name or '', u.last_name or '']
        name = ' '.join(p for p in parts if p).strip()
        return name or u.username


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone', 'email']

    def validate_email(self, value):
        user = self.instance
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError('Укажите email.')
        qs = User.objects.filter(email__iexact=v)
        if user and user.pk:
            qs = qs.exclude(pk=user.pk)
        if qs.exists():
            raise serializers.ValidationError('Пользователь с таким email уже зарегистрирован.')
        return v


class ReviewCreateSerializer(serializers.ModelSerializer):
    rating = serializers.IntegerField(required=True, min_value=1, max_value=5)
    text = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = Review
        fields = ['text', 'rating']

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user
        return Review.objects.create(user=user, **validated_data)


class ReviewManageSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    author_display = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Review
        fields = [
            'id',
            'user',
            'username',
            'author_display',
            'text',
            'rating',
            'is_published',
            'created_at',
            'updated_at',
            'staff_reply',
            'staff_reply_at',
            'staff_reply_by',
        ]
        read_only_fields = ['id', 'user', 'username', 'author_display', 'created_at', 'updated_at', 'staff_reply_at', 'staff_reply_by']

    def get_author_display(self, obj: Review) -> str:
        u = obj.user
        parts = [u.first_name or '', u.last_name or '']
        name = ' '.join(p for p in parts if p).strip()
        return name or u.username

    def validate_is_published(self, value):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if value is False and user and not user.is_admin():
            raise serializers.ValidationError('Скрывать отзыв с витрины может только администратор.')
        return value

    def update(self, instance, validated_data):
        from django.utils import timezone

        old_reply = instance.staff_reply
        inst = super().update(instance, validated_data)
        new_reply = inst.staff_reply
        if new_reply != old_reply:
            if (new_reply or '').strip():
                inst.staff_reply_at = timezone.now()
                inst.staff_reply_by = self.context['request'].user
                inst.save(update_fields=['staff_reply_at', 'staff_reply_by'])
            else:
                inst.staff_reply_at = None
                inst.staff_reply_by = None
                inst.save(update_fields=['staff_reply_at', 'staff_reply_by'])
        return inst


SUPPORT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
SUPPORT_ALLOWED_CONTENT_TYPES = frozenset(
    {
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
    }
)


def validate_support_attachment(upload):
    import mimetypes

    if not upload:
        return upload
    if upload.size > SUPPORT_MAX_ATTACHMENT_BYTES:
        raise serializers.ValidationError('Файл слишком большой (максимум 5 МБ).')
    ct = getattr(upload, 'content_type', None) or mimetypes.guess_type(upload.name)[0] or ''
    if ct not in SUPPORT_ALLOWED_CONTENT_TYPES:
        raise serializers.ValidationError('Допустимы изображения (JPEG, PNG, WebP, GIF) и PDF.')
    return upload


class StorefrontSupportMessageCreateSerializer(serializers.Serializer):
    text = serializers.CharField(required=False, allow_blank=True, max_length=8000)
    attachment = serializers.FileField(required=False, allow_null=True, default=None)

    def validate(self, attrs):
        text = (attrs.get('text') or '').strip()
        att = attrs.get('attachment')
        if att:
            validate_support_attachment(att)
        if not text and not att:
            raise serializers.ValidationError('Введите текст или прикрепите файл.')
        attrs['text'] = text
        return attrs


class StaffSupportMessageCreateSerializer(serializers.Serializer):
    text = serializers.CharField(required=False, allow_blank=True, max_length=8000)
    attachment = serializers.FileField(required=False, allow_null=True, default=None)

    def validate(self, attrs):
        text = (attrs.get('text') or '').strip()
        att = attrs.get('attachment')
        if att:
            validate_support_attachment(att)
        if not text and not att:
            raise serializers.ValidationError('Введите текст или прикрепите файл.')
        attrs['text'] = text
        return attrs

