from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=255, unique=True)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="children",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @classmethod
    def subtree_ids(cls, root_id: int) -> list[int]:
        rid = int(root_id)
        ids: list[int] = [rid]
        frontier: list[int] = [rid]
        while frontier:
            children = list(
                cls.objects.filter(parent_id__in=frontier).values_list('pk', flat=True)
            )
            ids.extend(children)
            frontier = children
        return ids


class Product(models.Model):
    class CompatibilityMode(models.TextChoices):
        BODY_TYPE = 'BODY_TYPE', 'Кузов'
        TECH_VARIANT = 'TECH_VARIANT', 'Техника'

    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=64, unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    brand_name = models.CharField(max_length=100, blank=True, default="")
    compatibility_mode = models.CharField(
        max_length=20,
        choices=CompatibilityMode.choices,
        default=CompatibilityMode.BODY_TYPE,
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gt=0),
                name="product_price_gt_0",
            ),
            models.CheckConstraint(
                condition=models.Q(stock__gte=0),
                name="product_stock_gte_0",
            ),
        ]
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.sku})"


class Brand(models.Model):
    name = models.CharField(max_length=100, unique=True)
    logo = models.ImageField(upload_to='brands/', blank=True, null=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class CarModel(models.Model):
    brand = models.ForeignKey(
        Brand,
        on_delete=models.CASCADE,
        related_name="car_models",
    )
    name = models.CharField(max_length=100)

    class Meta:
        ordering = ["brand", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["brand", "name"],
                name="carmodel_brand_name_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.brand} {self.name}"


class Generation(models.Model):
    car_model = models.ForeignKey(
        CarModel,
        on_delete=models.CASCADE,
        related_name="generations",
    )
    name = models.CharField(max_length=100)
    image = models.ImageField(upload_to='generations/', blank=True, null=True)

    class Meta:
        ordering = ["car_model", "name"]

    def __str__(self) -> str:
        return f"{self.car_model} {self.name}"


class BodyType(models.Model):
    class Types(models.TextChoices):
        SEDAN = 'SEDAN', 'Седан'
        LIFTBACK = 'LIFTBACK', 'Лифтбек'
        HATCHBACK_3D = 'HATCHBACK_3D', 'Хэтчбек 3дв'
        HATCHBACK_5D = 'HATCHBACK_5D', 'Хэтчбек 5дв'
        SUV_3D = 'SUV_3D', 'Внедорожник 3дв'
        SUV_5D = 'SUV_5D', 'Внедорожник 5дв'
        WAGON = 'WAGON', 'Универсал'
        COUPE = 'COUPE', 'Купе'
        CABRIO = 'CABRIO', 'Кабриолет'
        MINIVAN = 'MINIVAN', 'Минивэн'
        PICKUP = 'PICKUP', 'Пикап'
        VAN = 'VAN', 'Фургон'
        LIMOUSINE = 'LIMOUSINE', 'Лимузин'

    generation = models.ForeignKey(
        Generation,
        on_delete=models.CASCADE,
        related_name="body_types",
    )
    name = models.CharField(max_length=100, choices=Types.choices)
    image = models.ImageField(upload_to='body_types/', blank=True, null=True)

    class Meta:
        ordering = ["generation", "name"]

    def __str__(self) -> str:
        return f"{self.generation}: {self.name}"


class TechVariant(models.Model):
    class TransmissionType(models.TextChoices):
        MT = 'MT', 'Механика'
        AT = 'AT', 'Автомат'
        CVT = 'CVT', 'Вариатор'
        DCT = 'DCT', 'Робот (DCT)'
        ROBOT = 'ROBOT', 'Робот'

    class EngineType(models.TextChoices):
        NATURALLY_ASPIRATED = 'NATURALLY_ASPIRATED', 'Атмосферный'
        TURBO = 'TURBO', 'Турбо'
        SUPERCHARGER = 'SUPERCHARGER', 'Нагнетатель'
        OTHER = 'OTHER', 'Другое'

    class FuelType(models.TextChoices):
        PETROL = 'PETROL', 'Бензин'
        DIESEL = 'DIESEL', 'Дизель'
        LPG = 'LPG', 'Газ (LPG)'
        CNG = 'CNG', 'Газ (CNG)'
        ELECTRIC = 'ELECTRIC', 'Электро'
        HYBRID = 'HYBRID', 'Гибрид'

    generation = models.ForeignKey(
        Generation,
        on_delete=models.SET_NULL,
        related_name="tech_variants",
        null=True,
        blank=True,
    )
    engine_code = models.CharField(max_length=64)
    transmission_code = models.CharField(max_length=64)
    transmission_type = models.CharField(max_length=16, choices=TransmissionType.choices)
    engine_type = models.CharField(
        max_length=32,
        choices=EngineType.choices,
        default=EngineType.NATURALLY_ASPIRATED,
    )
    fuel_type = models.CharField(
        max_length=32,
        choices=FuelType.choices,
        default=FuelType.PETROL,
    )
    gears = models.PositiveSmallIntegerField(blank=True, null=True)
    power_hp = models.PositiveSmallIntegerField(blank=True, null=True)
    torque_nm = models.PositiveSmallIntegerField(blank=True, null=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["generation", "engine_code", "transmission_type", "transmission_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["generation", "engine_code", "transmission_code"],
                name="techvariant_generation_engine_transmission_unique",
            ),
        ]

    def __str__(self) -> str:
        generation = self.generation if self.generation is not None else 'Без привязки'
        return f"{generation}: {self.engine_code} / {self.transmission_type} {self.transmission_code}"


class ProductBodyTypeCompatibility(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="body_type_compatibilities",
    )
    body_type = models.ForeignKey(
        BodyType,
        on_delete=models.CASCADE,
        related_name="product_compatibilities",
    )
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["product", "body_type"],
                name="product_bodytype_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product} -> {self.body_type}"


class ProductTechVariantCompatibility(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="tech_variant_compatibilities",
    )
    tech_variant = models.ForeignKey(
        TechVariant,
        on_delete=models.CASCADE,
        related_name="product_compatibilities",
    )
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["product", "tech_variant"],
                name="product_techvariant_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product} -> {self.tech_variant}"
