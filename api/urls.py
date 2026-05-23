from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminStatsView,
    AuditLogViewSet,
    BodyTypeViewSet,
    BrandViewSet,
    ProductBrandViewSet,
    CarModelViewSet,
    CategoryViewSet,
    GenerationViewSet,
    MessageViewSet,
    OrderViewSet,
    ProductBodyTypeCompatibilityViewSet,
    ProductTechVariantCompatibilityViewSet,
    ProductViewSet,
    PromotionViewSet,
    FAQItemViewSet,
    storefront_cart_add_item,
    storefront_cart_clear,
    storefront_cart_detail,
    storefront_cart_remove_item,
    storefront_cart_update_item,
    storefront_checkout,
    storefront_checkout_validate,
    storefront_favorites_clear,
    storefront_promotions_list,
    storefront_faq_list,
    storefront_site_blocks_list,
    storefront_category_cover_images,
    StorefrontReviewListCreate,
    StorefrontReviewDestroy,
    storefront_favorites_detail,
    storefront_favorites_remove_item,
    storefront_favorites_toggle_item,
    TechVariantViewSet,
    UserViewSet,
    SiteBlockViewSet,
    ReviewViewSet,
    VehicleViewSet,
    ProductVehicleCompatibilityViewSet,
)
from .views_profile import profile_change_password_view, profile_reviews_view, profile_view
from .views_import import ImportExecuteView, ImportPreviewView
from .views_support import (
    StorefrontSupportMessagesView,
    SupportThreadListView,
    SupportThreadMarkReadView,
    SupportThreadMessagesView,
    storefront_support_read,
    storefront_support_thread,
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'users', UserViewSet, basename='user')
router.register(r'vehicles', VehicleViewSet, basename='vehicle')
router.register(r'product-vehicle-compat', ProductVehicleCompatibilityViewSet, basename='product-vehicle-compat')
router.register(r'brands', BrandViewSet, basename='brand')
router.register(r'product-brands', ProductBrandViewSet, basename='product-brand')
router.register(r'car-models', CarModelViewSet, basename='car-model')
router.register(r'generations', GenerationViewSet, basename='generation')
router.register(r'body-types', BodyTypeViewSet, basename='body-type')
router.register(r'product-bodytype-compat', ProductBodyTypeCompatibilityViewSet, basename='product-bodytype-compat')
router.register(r'product-techvariant-compat', ProductTechVariantCompatibilityViewSet, basename='product-techvariant-compat')
router.register(r'tech-variants', TechVariantViewSet, basename='tech-variant')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'promotions', PromotionViewSet, basename='promotion')
router.register(r'faq-items', FAQItemViewSet, basename='faq-item')
router.register(r'site-blocks', SiteBlockViewSet, basename='site-block')
router.register(r'reviews', ReviewViewSet, basename='review')

urlpatterns = [
    path('', include(router.urls)),
    path('admin-stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('profile/', profile_view, name='profile'),
    path('profile/reviews/', profile_reviews_view, name='profile-reviews'),
    path('profile/change-password/', profile_change_password_view, name='profile-change-password'),
    path('storefront/favorites/', storefront_favorites_detail, name='storefront-favorites-detail'),
    path('storefront/favorites/items/', storefront_favorites_toggle_item, name='storefront-favorites-toggle-item'),
    path('storefront/favorites/items/<int:product_id>/remove/', storefront_favorites_remove_item, name='storefront-favorites-remove-item'),
    path('storefront/favorites/clear/', storefront_favorites_clear, name='storefront-favorites-clear'),
    path('storefront/cart/', storefront_cart_detail, name='storefront-cart-detail'),
    path('storefront/cart/items/', storefront_cart_add_item, name='storefront-cart-add-item'),
    path('storefront/cart/items/<int:product_id>/', storefront_cart_update_item, name='storefront-cart-update-item'),
    path('storefront/cart/items/<int:product_id>/remove/', storefront_cart_remove_item, name='storefront-cart-remove-item'),
    path('storefront/cart/clear/', storefront_cart_clear, name='storefront-cart-clear'),
    path('storefront/checkout/validate/', storefront_checkout_validate, name='storefront-checkout-validate'),
    path('storefront/checkout/', storefront_checkout, name='storefront-checkout'),
    path('storefront/promotions/', storefront_promotions_list, name='storefront-promotions-list'),
    path('storefront/faq/', storefront_faq_list, name='storefront-faq-list'),
    path('storefront/site-blocks/', storefront_site_blocks_list, name='storefront-site-blocks-list'),
    path('storefront/category-cover-images/', storefront_category_cover_images, name='storefront-category-cover-images'),
    path('storefront/reviews/', StorefrontReviewListCreate.as_view(), name='storefront-reviews-list-create'),
    path('storefront/reviews/<int:pk>/', StorefrontReviewDestroy.as_view(), name='storefront-review-destroy'),
    path('storefront/support/thread/', storefront_support_thread, name='storefront-support-thread'),
    path('storefront/support/messages/', StorefrontSupportMessagesView.as_view(), name='storefront-support-messages'),
    path('storefront/support/read/', storefront_support_read, name='storefront-support-read'),
    path('support/threads/', SupportThreadListView.as_view(), name='support-threads-list'),
    path('support/threads/<int:thread_id>/messages/', SupportThreadMessagesView.as_view(), name='support-thread-messages'),
    path('support/threads/<int:thread_id>/read/', SupportThreadMarkReadView.as_view(), name='support-thread-read'),
    path('import/preview/', ImportPreviewView.as_view(), name='import-preview'),
    path('import/execute/', ImportExecuteView.as_view(), name='import-execute'),
]
