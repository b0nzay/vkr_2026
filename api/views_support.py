"""
API чата поддержки (витрина + дашборд). Отдельно от Message по заказам.
"""

from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from chat.models import SESSION_SUPPORT_GUEST_KEY, SupportMessage, SupportThread, SupportThreadReadState
from .permissions import IsManagerOrAdmin
from .serializers import StaffSupportMessageCreateSerializer, StorefrontSupportMessageCreateSerializer


def _attachment_url(request, f) -> str | None:
    if not f or not f.name:
        return None
    url = f.url
    if request:
        return request.build_absolute_uri(url)
    return url


def _refresh_thread_last_message(thread: SupportThread) -> None:
    agg = thread.support_messages.aggregate(m=Max('created_at'))
    m = agg['m']
    SupportThread.objects.filter(pk=thread.pk).update(
        last_message_at=m,
        updated_at=timezone.now(),
    )


def _resolve_client_thread(request) -> SupportThread:
    """Один тред на пользователя; для гостя — по guest_key в сессии, с переносом сообщений при конфликте."""
    user = request.user if request.user.is_authenticated else None
    sk = SESSION_SUPPORT_GUEST_KEY

    if user:
        user_thread = SupportThread.objects.filter(user=user).first()
        guest_thread = None
        raw = request.session.get(sk)
        if raw:
            try:
                gk = UUID(str(raw))
            except (ValueError, TypeError):
                gk = None
            if gk:
                guest_thread = SupportThread.objects.filter(guest_key=gk, user__isnull=True).first()

        if user_thread and guest_thread and guest_thread.pk != user_thread.pk:
            with transaction.atomic():
                SupportMessage.objects.filter(thread=guest_thread).update(thread=user_thread)
                guest_thread.delete()
                _refresh_thread_last_message(user_thread)
            request.session.pop(sk, None)
            return SupportThread.objects.get(pk=user_thread.pk)

        if user_thread:
            request.session.pop(sk, None)
            return user_thread

        if guest_thread:
            with transaction.atomic():
                guest_thread.user = user
                guest_thread.guest_key = None
                guest_thread.public_guest_code = None
                guest_thread.save(update_fields=['user', 'guest_key', 'public_guest_code', 'updated_at'])
            request.session.pop(sk, None)
            return guest_thread

        thread, _ = SupportThread.objects.get_or_create(user=user)
        return thread

    raw = request.session.get(sk)
    if raw:
        try:
            gk = UUID(str(raw))
        except (ValueError, TypeError):
            gk = None
        if gk:
            thread = SupportThread.objects.filter(guest_key=gk).first()
            if thread:
                return thread

    thread = SupportThread.create_guest_thread()
    request.session[sk] = str(thread.guest_key)
    request.session.save()
    return thread


def _client_unread_count(thread: SupportThread) -> int:
    lr = thread.client_last_read_at
    qs = thread.support_messages.filter(sender_role=SupportMessage.SenderRole.STAFF)
    if lr:
        qs = qs.filter(created_at__gt=lr)
    return qs.count()


def _serialize_message_client(msg: SupportMessage, request) -> dict:
    is_staff = msg.sender_role == SupportMessage.SenderRole.STAFF
    user = request.user
    is_mine = False
    if not is_staff:
        if user.is_authenticated and msg.author_id == user.id:
            is_mine = True
        elif not user.is_authenticated and msg.author_id is None:
            is_mine = True
    preview = (msg.text or '').strip()
    if not preview and msg.attachment:
        preview = msg.attachment.name.split('/')[-1]
    return {
        'id': msg.id,
        'created_at': msg.created_at.isoformat(),
        'text': msg.text or '',
        'attachment': _attachment_url(request, msg.attachment),
        'from_support': is_staff,
        'is_mine': is_mine,
    }


def _serialize_message_staff(msg: SupportMessage, request) -> dict:
    name = ''
    if msg.sender_role == SupportMessage.SenderRole.STAFF and msg.author_id:
        u = msg.author
        name = (f'{u.first_name} {u.last_name}'.strip() or u.username or str(u.pk))
    return {
        'id': msg.id,
        'created_at': msg.created_at.isoformat(),
        'text': msg.text or '',
        'attachment': _attachment_url(request, msg.attachment),
        'sender_role': msg.sender_role,
        'staff_author_name': name,
    }


def _thread_display_title(thread: SupportThread) -> str:
    if thread.user_id:
        u = thread.user
        full = f'{u.first_name} {u.last_name}'.strip()
        return full or u.username or f'Пользователь #{u.pk}'
    code = thread.public_guest_code or thread.pk
    return f'Гость · {code}'


def _last_message_preview(thread: SupportThread) -> str:
    msg = thread.support_messages.order_by('-created_at').first()
    if not msg:
        return ''
    t = (msg.text or '').strip()
    if t:
        return t[:120] + ('…' if len(t) > 120 else '')
    if msg.attachment:
        return f'📎 {msg.attachment.name.split("/")[-1]}'
    return ''


def _staff_unread_map(user: User, thread_ids: list[int]) -> dict[int, int]:
    if not thread_ids:
        return {}
    reads = {
        s.thread_id: s.last_read_at
        for s in SupportThreadReadState.objects.filter(user=user, thread_id__in=thread_ids)
    }
    rows = (
        SupportMessage.objects.filter(thread_id__in=thread_ids, sender_role=SupportMessage.SenderRole.CLIENT)
        .values_list('thread_id', 'created_at')
    )
    by_tid: dict[int, list] = defaultdict(list)
    for tid, created in rows:
        by_tid[tid].append(created)
    out: dict[int, int] = {}
    for tid in thread_ids:
        threshold = reads.get(tid)
        times = by_tid.get(tid, [])
        if threshold:
            out[tid] = sum(1 for ct in times if ct > threshold)
        else:
            out[tid] = len(times)
    return out


@api_view(['GET'])
@permission_classes([AllowAny])
def storefront_support_thread(request):
    thread = _resolve_client_thread(request)
    thread.refresh_from_db()
    return Response(
        {
            'id': thread.id,
            'unread_count': _client_unread_count(thread),
        }
    )


class StorefrontSupportMessagesView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        thread = _resolve_client_thread(request)
        qs = thread.support_messages.all()
        after_id = request.query_params.get('after_id')
        if after_id and str(after_id).isdigit():
            qs = qs.filter(id__gt=int(after_id))
        data = [_serialize_message_client(m, request) for m in qs.order_by('created_at')]
        return Response(data)

    def post(self, request):
        ser = StorefrontSupportMessageCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        thread = _resolve_client_thread(request)
        text = ser.validated_data['text']
        att = ser.validated_data.get('attachment')
        user = request.user if request.user.is_authenticated else None
        with transaction.atomic():
            msg = SupportMessage.objects.create(
                thread=thread,
                author=user,
                sender_role=SupportMessage.SenderRole.CLIENT,
                text=text,
                attachment=att,
            )
            _refresh_thread_last_message(thread)
        return Response(_serialize_message_client(msg, request), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def storefront_support_read(request):
    thread = _resolve_client_thread(request)
    SupportThread.objects.filter(pk=thread.pk).update(client_last_read_at=timezone.now(), updated_at=timezone.now())
    return Response({'ok': True})


class SupportThreadListView(APIView):
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]

    def get(self, request):
        qs = (
            SupportThread.objects.filter(support_messages__isnull=False)
            .select_related('user')
            .distinct()
            .order_by('-last_message_at', '-id')[:200]
        )
        threads = list(qs)
        ids = [t.id for t in threads]
        unread_map = _staff_unread_map(request.user, ids)

        def thread_ts(t: SupportThread) -> float:
            if t.last_message_at:
                return t.last_message_at.timestamp()
            return 0.0

        decorated = [{'thread': t, 'unread': unread_map.get(t.id, 0)} for t in threads]
        decorated.sort(key=lambda x: (0 if x['unread'] > 0 else 1, -thread_ts(x['thread'])))

        items = [
            {
                'id': x['thread'].id,
                'display_title': _thread_display_title(x['thread']),
                'last_message_preview': _last_message_preview(x['thread']),
                'last_message_at': x['thread'].last_message_at.isoformat() if x['thread'].last_message_at else None,
                'unread_count': x['unread'],
            }
            for x in decorated
        ]
        return Response(items)


class SupportThreadMessagesView(APIView):
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, thread_id: int):
        thread = SupportThread.objects.filter(pk=thread_id).first()
        if not thread:
            raise NotFound()
        data = [
            _serialize_message_staff(m, request)
            for m in thread.support_messages.select_related('author').order_by('created_at')
        ]
        return Response(data)

    def post(self, request, thread_id: int):
        thread = SupportThread.objects.filter(pk=thread_id).first()
        if not thread:
            raise NotFound()
        ser = StaffSupportMessageCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        text = ser.validated_data['text']
        att = ser.validated_data.get('attachment')
        with transaction.atomic():
            msg = SupportMessage.objects.create(
                thread=thread,
                author=request.user,
                sender_role=SupportMessage.SenderRole.STAFF,
                text=text,
                attachment=att,
            )
            _refresh_thread_last_message(thread)
        return Response(_serialize_message_staff(msg, request), status=status.HTTP_201_CREATED)


class SupportThreadMarkReadView(APIView):
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]

    def post(self, request, thread_id: int):
        thread = SupportThread.objects.filter(pk=thread_id).first()
        if not thread:
            raise NotFound()
        now = timezone.now()
        SupportThreadReadState.objects.update_or_create(
            thread=thread,
            user=request.user,
            defaults={'last_read_at': now},
        )
        return Response({'ok': True})
