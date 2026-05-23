from __future__ import annotations


ENTITY_CARS = 'cars'
ENTITY_TECH_VARIANTS = 'tech_variants'
ENTITY_PRODUCTS = 'products'

SUPPORTED_ENTITY_TYPES = (
    ENTITY_CARS,
    ENTITY_TECH_VARIANTS,
    ENTITY_PRODUCTS,
)

CONFLICT_MODE_UPDATE = 'update'
CONFLICT_MODE_SKIP = 'skip'
CONFLICT_MODE_STOP = 'stop'
SUPPORTED_CONFLICT_MODES = (
    CONFLICT_MODE_UPDATE,
    CONFLICT_MODE_SKIP,
    CONFLICT_MODE_STOP,
)

SUPPORTED_IMAGE_EXTENSIONS = frozenset(
    {
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
        '.gif',
    }
)

# Поля, которые обязательно нужны для создания записи.
REQUIRED_FIELDS = {
    ENTITY_CARS: (
        'brand',
        'model',
        'generation',
        'body_type',
    ),
    ENTITY_TECH_VARIANTS: (
        'brand',
        'model',
        'generation',
        'engine_code',
        'transmission_code',
        'transmission_type',
    ),
    ENTITY_PRODUCTS: (
        'sku',
        'name',
        'price',
        'stock',
        'category',
    ),
}

# Дополнительные поля, которые можно заполнить при полном импорте.
OPTIONAL_FIELDS = {
    ENTITY_CARS: (
        'brand_logo_path',
        'generation_image_path',
        'body_type_image_path',
    ),
    ENTITY_TECH_VARIANTS: (
        'engine_type',
        'fuel_type',
        'gears',
        'power_hp',
        'torque_nm',
        'notes',
    ),
    ENTITY_PRODUCTS: (
        'description',
        'brand_name',
        'compatibility_mode',
        'image_path',
        'body_type_refs',
        'tech_variant_refs',
    ),
}

# Алиасы колонок/ключей (rus/eng) для JSON и XLSX.
FIELD_ALIASES = {
    ENTITY_CARS: {
        'brand': ('brand', 'марка', 'бренд'),
        'model': ('model', 'модель'),
        'generation': ('generation', 'поколение'),
        'body_type': ('body_type', 'тип_кузова', 'кузов'),
        'brand_logo_path': ('brand_logo_path', 'brand_logo', 'путь_к_лого_марки'),
        'generation_image_path': ('generation_image_path', 'generation_image', 'путь_к_картинке_поколения'),
        'body_type_image_path': ('body_type_image_path', 'body_type_image', 'путь_к_картинке_кузова'),
    },
    ENTITY_TECH_VARIANTS: {
        'brand': ('brand', 'марка', 'бренд'),
        'model': ('model', 'модель'),
        'generation': ('generation', 'поколение'),
        'engine_code': ('engine_code', 'код_двигателя'),
        'transmission_code': ('transmission_code', 'код_кпп'),
        'transmission_type': ('transmission_type', 'тип_кпп'),
        'engine_type': ('engine_type', 'тип_двигателя'),
        'fuel_type': ('fuel_type', 'тип_топлива'),
        'gears': ('gears', 'передач'),
        'power_hp': ('power_hp', 'мощность_лс'),
        'torque_nm': ('torque_nm', 'крутящий_момент'),
        'notes': ('notes', 'примечание', 'комментарий'),
    },
    ENTITY_PRODUCTS: {
        'sku': ('sku', 'артикул'),
        'name': ('name', 'название'),
        'price': ('price', 'цена'),
        'stock': ('stock', 'остаток'),
        'category': ('category', 'категория'),
        'description': ('description', 'описание'),
        'brand_name': ('brand_name', 'бренд_товара'),
        'compatibility_mode': ('compatibility_mode', 'режим_совместимости'),
        'image_path': ('image_path', 'путь_к_картинке'),
        'body_type_refs': ('body_type_refs', 'совместимость_по_кузову'),
        'tech_variant_refs': ('tech_variant_refs', 'совместимость_по_конфигурациям'),
    },
}

