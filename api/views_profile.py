import uuid

from django.contrib.auth import password_validation
from django.core.mail import send_mail
from django.urls import reverse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from content.models import Review

from .serializers import ProfileUpdateSerializer, ReviewPublicSerializer


def _profile_payload(user: User) -> dict:
    groups = list(user.groups.values_list('name', flat=True))
    if user.is_admin():
        role = 'admin'
        dashboard_home = '/dashboard/admin'
    elif user.is_manager():
        role = 'manager'
        dashboard_home = '/dashboard/manager'
    else:
        role = 'client'
        dashboard_home = '/'
    return {
        'id': user.id,
        'username': user.get_username(),
        'email': user.email,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'phone': user.phone or '',
        'email_verified': bool(user.email_verified),
        'role': role,
        'groups': groups,
        'dashboard_home': dashboard_home,
    }


def _send_email_confirmation(request, user: User, token: uuid.UUID) -> None:
    confirm_path = reverse('accounts:confirm_email', kwargs={'token': str(token)})
    link = request.build_absolute_uri(confirm_path)
    send_mail(
        subject='RideX: подтверждение email',
        message=f'Это заглушка отправки письма.\nПодтвердите новый адрес: {link}',
        from_email='noreply@ridex.local',
        recipient_list=[user.email] if user.email else [],
        fail_silently=True,
    )


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    user = request.user
    if request.method == 'GET':
        return Response(_profile_payload(user))

    old_email = (user.email or '').strip().lower()
    ser = ProfileUpdateSerializer(user, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)

    incoming = ser.validated_data.get('email')
    if incoming is not None:
        new_email = str(incoming).strip().lower()
    else:
        new_email = old_email

    email_changed = new_email != old_email

    if email_changed and user.is_client():
        user.email_verified = False
        user.email_verification_token = uuid.uuid4()

    ser.save()

    if email_changed and user.is_client() and user.email_verification_token:
        user.refresh_from_db()
        _send_email_confirmation(request, user, user.email_verification_token)

    user.refresh_from_db()
    return Response(_profile_payload(user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def profile_change_password_view(request):
    old_password = request.data.get('old_password')
    new_password1 = request.data.get('new_password1')
    new_password2 = request.data.get('new_password2')
    if not old_password or not new_password1 or not new_password2:
        return Response(
            {'detail': 'Укажите текущий пароль и новый пароль дважды.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if new_password1 != new_password2:
        return Response({'detail': 'Новые пароли не совпадают.'}, status=status.HTTP_400_BAD_REQUEST)
    if not request.user.check_password(old_password):
        return Response({'detail': 'Неверный текущий пароль.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        password_validation.validate_password(new_password1, request.user)
    except password_validation.ValidationError as e:
        return Response({'detail': e.messages}, status=status.HTTP_400_BAD_REQUEST)
    request.user.set_password(new_password1)
    request.user.save(update_fields=['password'])
    return Response({'detail': 'Пароль изменён.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_reviews_view(request):
    qs = Review.objects.filter(user=request.user).order_by('-created_at')
    data = ReviewPublicSerializer(qs, many=True, context={'request': request}).data
    return Response(data)
