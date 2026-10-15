"""
Вспомогательные функции журнала аудита для операций вне стандартного perform_destroy/update
(массовый delete, каскады БД, явная отвязка TechVariant перед удалением узла дерева).
"""

from __future__ import annotations

import json
import logging

from catalog.models import BodyType, CarModel, Generation, TechVariant

from .models import AuditLog
from .serializers import BodyTypeSerializer, CarModelSerializer, GenerationSerializer, TechVariantSerializer

logger = logging.getLogger(__name__)

ENTITY_TECH_VARIANT = 'Техническая конфигурация'
ENTITY_BODY_TYPE = 'Тип кузова'
ENTITY_GENERATION = 'Поколение авто'
ENTITY_CAR_MODEL = 'Модель авто'


def _serialize_snapshot(serializer) -> dict | None:
    try:
        raw = serializer.data
    except Exception:
        return None
    return json.loads(json.dumps(raw, ensure_ascii=False, default=str))


def audit_snapshot(serializer_class, instance, request=None) -> dict | None:
    ctx = {'request': request} if request else {}
    try:
        ser = serializer_class(instance, context=ctx)
        return _serialize_snapshot(ser)
    except Exception:
        logger.exception('Не удалось сформировать снимок для аудита: %s', instance)
        return None


def _action_summary(action: str, entity_type: str, instance) -> str:
    action_labels = {
        AuditLog.Action.CREATE: 'Создана запись',
        AuditLog.Action.UPDATE: 'Изменена запись',
        AuditLog.Action.DELETE: 'Удалена запись',
    }
    obj_title = str(instance) if instance is not None else ''
    return f"{action_labels.get(action, 'Изменение')} {entity_type}: {obj_title}".strip()


def audit_log_delete(*, request, entity_type: str, instance, before_data):
    try:
        actor = getattr(request, 'user', None) if request else None
        if actor is not None and not actor.is_authenticated:
            actor = None
        AuditLog.objects.create(
            actor=actor,
            action=AuditLog.Action.DELETE,
            entity_type=entity_type,
            object_id=str(getattr(instance, 'pk', '')),
            object_repr=str(instance),
            summary=_action_summary(AuditLog.Action.DELETE, entity_type, instance),
            before_data=before_data,
            after_data=None,
        )
    except Exception:
        logger.exception(
            'Запись AuditLog (DELETE) не выполнена: entity=%s pk=%s',
            entity_type,
            getattr(instance, 'pk', None),
        )


def audit_log_update(*, request, entity_type: str, instance, before_data, after_data):
    try:
        actor = getattr(request, 'user', None) if request else None
        if actor is not None and not actor.is_authenticated:
            actor = None
        AuditLog.objects.create(
            actor=actor,
            action=AuditLog.Action.UPDATE,
            entity_type=entity_type,
            object_id=str(getattr(instance, 'pk', '')),
            object_repr=str(instance),
            summary=_action_summary(AuditLog.Action.UPDATE, entity_type, instance),
            before_data=before_data,
            after_data=after_data,
        )
    except Exception:
        logger.exception(
            'Запись AuditLog (UPDATE) не выполнена: entity=%s pk=%s',
            entity_type,
            getattr(instance, 'pk', None),
        )


def log_and_delete_tech_variants_for_generations(request, generation_qs) -> int:
    """DELETE в журнале + явное удаление конфигураций (режим cascade)."""
    tv_qs = TechVariant.objects.filter(generation__in=generation_qs).select_related(
        'generation__car_model__brand',
    )
    count = 0
    for tv in tv_qs.order_by('pk').iterator(chunk_size=200):
        before = audit_snapshot(TechVariantSerializer, tv, request)
        audit_log_delete(request=request, entity_type=ENTITY_TECH_VARIANT, instance=tv, before_data=before)
        count += 1
    TechVariant.objects.filter(generation__in=generation_qs).delete()
    return count


def detach_tech_variants_for_generations(request, generation_qs) -> int:
    """Отвязка TechVariant от поколения с журналом UPDATE (режим detach_tech)."""
    tv_qs = TechVariant.objects.filter(generation__in=generation_qs).select_related(
        'generation__car_model__brand',
    )
    count = 0
    for tv in tv_qs.order_by('pk').iterator(chunk_size=200):
        before = audit_snapshot(TechVariantSerializer, tv, request)
        tv.generation = None
        tv.save(update_fields=['generation'])
        tv.refresh_from_db()
        after = audit_snapshot(TechVariantSerializer, tv, request)
        audit_log_update(
            request=request,
            entity_type=ENTITY_TECH_VARIANT,
            instance=tv,
            before_data=before,
            after_data=after,
        )
        count += 1
    return count


def log_imminent_body_type_deletes(request, generation_qs) -> None:
    qs = BodyType.objects.filter(generation__in=generation_qs).select_related(
        'generation__car_model__brand',
    )
    for obj in qs.order_by('pk').iterator(chunk_size=200):
        before = audit_snapshot(BodyTypeSerializer, obj, request)
        audit_log_delete(request=request, entity_type=ENTITY_BODY_TYPE, instance=obj, before_data=before)


def log_imminent_generation_deletes(request, generation_qs) -> None:
    qs = generation_qs.select_related('car_model__brand').order_by('pk')
    for obj in qs.iterator(chunk_size=200):
        before = audit_snapshot(GenerationSerializer, obj, request)
        audit_log_delete(request=request, entity_type=ENTITY_GENERATION, instance=obj, before_data=before)


def log_imminent_car_model_deletes(request, car_model_qs) -> None:
    qs = car_model_qs.select_related('brand').order_by('pk')
    for obj in qs.iterator(chunk_size=200):
        before = audit_snapshot(CarModelSerializer, obj, request)
        audit_log_delete(request=request, entity_type=ENTITY_CAR_MODEL, instance=obj, before_data=before)


def audit_subtree_before_brand_destroy_cascade(request, brand) -> None:
    """Полное каскадное удаление марки: журнал дочерних сущностей до super().destroy."""
    generation_qs = Generation.objects.filter(car_model__brand_id=brand.id)
    log_and_delete_tech_variants_for_generations(request, generation_qs)
    log_imminent_body_type_deletes(request, generation_qs)
    log_imminent_generation_deletes(request, generation_qs)
    log_imminent_car_model_deletes(request, CarModel.objects.filter(brand_id=brand.id))


def audit_subtree_before_car_model_destroy_cascade(request, car_model) -> None:
    generation_qs = Generation.objects.filter(car_model_id=car_model.id)
    log_and_delete_tech_variants_for_generations(request, generation_qs)
    log_imminent_body_type_deletes(request, generation_qs)
    log_imminent_generation_deletes(request, generation_qs)


def audit_subtree_before_generation_destroy_cascade(request, generation) -> None:
    generation_qs = Generation.objects.filter(id=generation.id)
    log_and_delete_tech_variants_for_generations(request, generation_qs)
    log_imminent_body_type_deletes(request, generation_qs)


def detach_tech_for_brand_subtree(request, brand) -> None:
    generation_qs = Generation.objects.filter(car_model__brand_id=brand.id)
    detach_tech_variants_for_generations(request, generation_qs)


def detach_tech_for_car_model_subtree(request, car_model) -> None:
    generation_qs = Generation.objects.filter(car_model_id=car_model.id)
    detach_tech_variants_for_generations(request, generation_qs)


def detach_tech_for_generation_subtree(request, generation) -> None:
    generation_qs = Generation.objects.filter(id=generation.id)
    detach_tech_variants_for_generations(request, generation_qs)
