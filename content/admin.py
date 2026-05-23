from django.contrib import admin

from .models import FAQItem, Promotion, Review, SiteBlock


@admin.register(Promotion)
class PromotionAdmin(admin.ModelAdmin):
    list_display = ('title', 'is_published', 'sort_order', 'created_at')
    list_filter = ('is_published',)
    search_fields = ('title', 'description')


@admin.register(FAQItem)
class FAQItemAdmin(admin.ModelAdmin):
    list_display = ('question', 'is_active', 'sort_order')
    list_filter = ('is_active',)
    search_fields = ('question', 'answer')


@admin.register(SiteBlock)
class SiteBlockAdmin(admin.ModelAdmin):
    list_display = ('slug', 'title', 'updated_at')


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'rating', 'is_published', 'created_at')
    list_filter = ('is_published',)
    search_fields = ('text', 'staff_reply', 'user__username')
