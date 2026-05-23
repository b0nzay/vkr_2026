from django.conf import settings
from django.db import models


class Promotion(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to='promotions/', blank=True, null=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='promotions_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', '-id']
        verbose_name = 'Акция'
        verbose_name_plural = 'Акции'

    def __str__(self) -> str:
        return self.title


class FAQItem(models.Model):
    question = models.CharField(max_length=500)
    answer = models.TextField()
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']
        verbose_name = 'Вопрос FAQ'
        verbose_name_plural = 'FAQ'

    def __str__(self) -> str:
        return self.question[:80]


class SiteBlock(models.Model):
    class Slug(models.TextChoices):
        DELIVERY = 'delivery', 'Доставка'
        ABOUT = 'about', 'О нас'

    slug = models.CharField(max_length=32, unique=True, choices=Slug.choices)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Текстовый блок сайта'
        verbose_name_plural = 'Текстовые блоки сайта'

    def __str__(self) -> str:
        return self.title


class Review(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='store_reviews',
    )
    text = models.TextField(blank=True, default='')
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    staff_reply = models.TextField(blank=True, default='')
    staff_reply_at = models.DateTimeField(null=True, blank=True)
    staff_reply_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviews_replied',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Отзыв'
        verbose_name_plural = 'Отзывы'

    def __str__(self) -> str:
        return f'Отзыв #{self.pk}'
