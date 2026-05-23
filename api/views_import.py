from __future__ import annotations

from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .import_schemas import CONFLICT_MODE_STOP, SUPPORTED_CONFLICT_MODES, SUPPORTED_ENTITY_TYPES
from .importers import ImportValidationError, run_import
from .models import AuditLog
from .permissions import IsManagerOrAdmin


def _build_payload(data: dict):
    entity_type = str(data.get('entity_type') or '').strip()
    conflict_mode = str(data.get('conflict_mode') or CONFLICT_MODE_STOP).strip()
    strict_images_raw = str(data.get('strict_images') or '').strip().lower()
    strict_images = strict_images_raw in {'1', 'true', 'yes', 'on'}
    return entity_type, conflict_mode, strict_images


class ImportPreviewView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]

    def post(self, request):
        entity_type, conflict_mode, _strict_images = _build_payload(request.data)
        if entity_type not in SUPPORTED_ENTITY_TYPES:
            return Response({'detail': 'Некорректный entity_type.'}, status=400)
        if conflict_mode not in SUPPORTED_CONFLICT_MODES:
            return Response({'detail': 'Некорректный conflict_mode.'}, status=400)

        data_file = request.FILES.get('data_file')
        images_zip = request.FILES.get('images_zip')
        try:
            report = run_import(
                entity_type=entity_type,
                data_file=data_file,
                conflict_mode=conflict_mode,
                dry_run=True,
                images_zip=images_zip,
            )
        except ImportValidationError as exc:
            return Response({'detail': str(exc)}, status=400)
        except Exception as exc:
            return Response({'detail': f'Ошибка предпросмотра импорта: {exc}'}, status=400)

        return Response({'preview': True, 'report': report})


class ImportExecuteView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]

    def post(self, request):
        entity_type, conflict_mode, _strict_images = _build_payload(request.data)
        if entity_type not in SUPPORTED_ENTITY_TYPES:
            return Response({'detail': 'Некорректный entity_type.'}, status=400)
        if conflict_mode not in SUPPORTED_CONFLICT_MODES:
            return Response({'detail': 'Некорректный conflict_mode.'}, status=400)

        data_file = request.FILES.get('data_file')
        images_zip = request.FILES.get('images_zip')
        try:
            report = run_import(
                entity_type=entity_type,
                data_file=data_file,
                conflict_mode=conflict_mode,
                dry_run=False,
                images_zip=images_zip,
            )
        except ImportValidationError as exc:
            return Response({'detail': str(exc)}, status=400)
        except Exception as exc:
            return Response({'detail': f'Ошибка выполнения импорта: {exc}'}, status=400)

        AuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            action=AuditLog.Action.UPDATE,
            entity_type='Импорт данных',
            object_id=entity_type,
            object_repr=entity_type,
            summary=f'Импорт {entity_type}: создано {report["created"]}, обновлено {report["updated"]}, пропущено {report["skipped"]}, ошибок {report["failed"]}',
            before_data=None,
            after_data={
                'entity_type': entity_type,
                'conflict_mode': conflict_mode,
                'report': report,
            },
        )
        return Response({'preview': False, 'report': report}, status=status.HTTP_200_OK)

