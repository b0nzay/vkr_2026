from django.contrib.auth.decorators import permission_required
from django.db.models import Count, F, Sum
from django.shortcuts import render

from accounts.models import User
from orders.models import Order, OrderItem


@permission_required('core.view_reports', raise_exception=True)
def admin_stats(request):
  """
  Server-rendered страница со статистикой для администратора.
  """
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

  context = {
      'total_orders': total_orders,
      'total_revenue': total_revenue,
      'total_users': total_users,
      'users_by_role': users_by_role,
      'orders_by_status': orders_by_status,
  }
  return render(request, 'core/admin_stats.html', context)
