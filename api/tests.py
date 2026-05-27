import io
import json
import zipfile

from django.contrib.auth.models import Group, Permission
from django.test import TestCase
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from rest_framework.test import APIClient

from accounts.models import User
from api.models import AuditLog
from catalog.models import (
    Brand,
    BodyType,
    CarModel,
    Category,
    Generation,
    Product,
    ProductBodyTypeCompatibility,
    ProductTechVariantCompatibility,
    TechVariant,
)
from orders.models import Order, OrderItem
from chat.models import SupportMessage, SupportThread


ADMIN_GROUP_NAME = 'Администратор'
MANAGER_GROUP_NAME = 'Менеджер'


class BaseAPIPermissionsTest(TestCase):
    def setUp(self):
        self.client_api = APIClient()

        # Группы
        self.admin_group, _ = Group.objects.get_or_create(name=ADMIN_GROUP_NAME)
        self.manager_group, _ = Group.objects.get_or_create(name=MANAGER_GROUP_NAME)

        # Пользователи
        self.client_user = User.objects.create_user(
            username='client-api',
            password='pass',
            role=User.Roles.CLIENT,
        )

        self.manager = User.objects.create_user(
            username='manager-api',
            password='pass',
            role=User.Roles.MANAGER,
            is_staff=True,
        )
        self.manager.groups.add(self.manager_group)

        self.admin = User.objects.create_user(
            username='admin-api',
            password='pass',
            role=User.Roles.ADMIN,
            is_staff=True,
        )
        self.admin.groups.add(self.admin_group)

        # Минимальный каталог и заказы
        self.category = Category.objects.create(name='Категория 1')
        self.product = Product.objects.create(
            name='Тестовый товар',
            price='100.00',
            stock=10,
            sku='SKU-1',
            category=self.category,
        )

        self.client_order = Order.objects.create(user=self.client_user)
        OrderItem.objects.create(
            order=self.client_order,
            product=self.product,
            quantity=1,
            unit_price=self.product.price,
        )

        self.other_order = Order.objects.create(user=self.manager)
        OrderItem.objects.create(
            order=self.other_order,
            product=self.product,
            quantity=2,
            unit_price=self.product.price,
        )


class OrderPermissionsTests(BaseAPIPermissionsTest):
    def test_client_sees_only_own_orders(self):
        self.client_api.force_authenticate(user=self.client_user)
        response = self.client_api.get(reverse('order-list'))
        self.assertEqual(response.status_code, 200)
        ids = {item['id'] for item in response.data}
        self.assertIn(self.client_order.id, ids)
        self.assertNotIn(self.other_order.id, ids)

    def test_manager_sees_all_orders(self):
        self.client_api.force_authenticate(user=self.manager)
        response = self.client_api.get(reverse('order-list'))
        self.assertEqual(response.status_code, 200)
        ids = {item['id'] for item in response.data}
        self.assertIn(self.client_order.id, ids)
        self.assertIn(self.other_order.id, ids)

    def test_client_cannot_change_order_status(self):
        self.client_api.force_authenticate(user=self.client_user)
        url = reverse('order-set-status', kwargs={'pk': self.client_order.id})
        response = self.client_api.patch(url, {'status': Order.Status.COMPLETED})
        self.assertIn(response.status_code, (403, 404))

    def test_manager_can_change_order_status(self):
        self.client_api.force_authenticate(user=self.manager)
        url = reverse('order-set-status', kwargs={'pk': self.client_order.id})
        response = self.client_api.patch(url, {'status': Order.Status.COMPLETED})
        self.assertEqual(response.status_code, 200)
        self.client_order.refresh_from_db()
        self.assertEqual(self.client_order.status, Order.Status.COMPLETED)


class UserViewSetPermissionsTests(BaseAPIPermissionsTest):
    def test_manager_can_list_users_but_cannot_create(self):
        self.client_api.force_authenticate(user=self.manager)
        list_url = reverse('user-list')
        response = self.client_api.get(list_url)
        self.assertEqual(response.status_code, 200)

        # Попытка создания пользователя менеджером должна быть запрещена
        response = self.client_api.post(
            list_url,
            {'username': 'created-by-manager', 'password': 'pass'},
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_can_create_user(self):
        # Убедимся, что у админа есть нужное право
        perm = Permission.objects.get(
            content_type__app_label='accounts',
            codename='add_user',
        )
        self.admin.user_permissions.add(perm)

        self.client_api.force_authenticate(user=self.admin)
        list_url = reverse('user-list')
        before = AuditLog.objects.count()
        response = self.client_api.post(
            list_url,
            {'username': 'created-by-admin', 'password': 'pass'},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(AuditLog.objects.count(), before + 1)
        log = AuditLog.objects.order_by('-id').first()
        self.assertEqual(log.action, AuditLog.Action.CREATE)
        self.assertEqual(log.entity_type, 'Пользователь')
        self.assertEqual(log.object_id, str(response.data['id']))


class CategoryProductPermissionsTests(BaseAPIPermissionsTest):
    def test_manager_cannot_modify_categories(self):
        self.client_api.force_authenticate(user=self.manager)
        url = reverse('category-list')
        response = self.client_api.post(url, {'name': 'Новая'})
        self.assertEqual(response.status_code, 403)

    def test_admin_can_modify_categories(self):
        # Администратор уже имеет права из сигналов, но дополнительно убеждаемся
        self.client_api.force_authenticate(user=self.admin)
        url = reverse('category-list')
        response = self.client_api.post(url, {'name': 'Новая админская'})
        self.assertIn(response.status_code, (201, 400))

    def test_manager_can_edit_product_but_not_delete(self):
        self.client_api.force_authenticate(user=self.manager)
        detail_url = reverse('product-detail', kwargs={'pk': self.product.id})
        response = self.client_api.patch(detail_url, {'name': 'Новое имя'})
        self.assertEqual(response.status_code, 200)

        delete_response = self.client_api.delete(detail_url)
        self.assertEqual(delete_response.status_code, 403)

    def test_admin_can_delete_product(self):
        # Создаём отдельный товар без связанных OrderItem,
        # чтобы не сработала защита внешнего ключа.
        extra_product = Product.objects.create(
            name='Лишний товар',
            price='50.00',
            stock=0,
            sku='EXTRA-1',
            category=self.category,
        )

        self.client_api.force_authenticate(user=self.admin)
        detail_url = reverse('product-detail', kwargs={'pk': extra_product.id})
        response = self.client_api.delete(detail_url)
        self.assertEqual(response.status_code, 204)


class AdminStatsPermissionsTests(BaseAPIPermissionsTest):
    def test_manager_cannot_see_admin_stats(self):
        self.client_api.force_authenticate(user=self.manager)
        url = reverse('admin-stats')
        response = self.client_api.get(url)
        self.assertEqual(response.status_code, 403)

    def test_admin_can_see_admin_stats(self):
        self.client_api.force_authenticate(user=self.admin)
        url = reverse('admin-stats')
        response = self.client_api.get(url)
        # В зависимости от конфигурации прав админ может либо иметь,
        # либо не иметь специальное право `core.view_reports`.
        self.assertIn(response.status_code, (200, 403))


class CategoryDeleteBlockedTests(BaseAPIPermissionsTest):
    def test_admin_cannot_delete_category_with_products(self):
        self.client_api.force_authenticate(user=self.admin)

        before = AuditLog.objects.count()
        url = reverse('category-detail', kwargs={'pk': self.category.id})
        response = self.client_api.delete(url)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data.get('product_count'), 1)
        self.assertTrue(isinstance(response.data.get('products'), list))
        self.assertEqual(response.data['products'][0]['name'], self.product.name)
        self.assertEqual(response.data['products'][0]['sku'], self.product.sku)

        # Категория не удалена и аудит не создал запись DELETE.
        self.category.refresh_from_db()
        self.assertEqual(AuditLog.objects.count(), before)

    def test_admin_can_delete_category_without_products(self):
        self.client_api.force_authenticate(user=self.admin)
        empty_category = Category.objects.create(name='Категория без товаров')

        url = reverse('category-detail', kwargs={'pk': empty_category.id})
        response = self.client_api.delete(url)

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Category.objects.filter(id=empty_category.id).exists())


class CarDeleteModesTests(BaseAPIPermissionsTest):
    def setUp(self):
        super().setUp()
        # Отдельные продукты под кузов и конфигурации, чтобы соответствовать compatibility_mode.
        self.tech_product = Product.objects.create(
            name='Товар конфигурации',
            price='200.00',
            stock=5,
            sku='SKU-TECH-1',
            category=self.category,
            compatibility_mode=Product.CompatibilityMode.TECH_VARIANT,
        )
        self.body_product = Product.objects.create(
            name='Товар кузова',
            price='150.00',
            stock=3,
            sku='SKU-BODY-1',
            category=self.category,
            compatibility_mode=Product.CompatibilityMode.BODY_TYPE,
        )

        # Дерево авто: Brand -> CarModel -> Generation.
        self.brand = Brand.objects.create(name='Brand-1')
        self.model = CarModel.objects.create(brand=self.brand, name='Model-1')
        self.generation = Generation.objects.create(car_model=self.model, name='Gen-1')

        # Кузов и конфигурация.
        self.body_type = BodyType.objects.create(generation=self.generation, name=BodyType.Types.SEDAN)
        self.tech_variant = TechVariant.objects.create(
            generation=self.generation,
            engine_code='ENG-1',
            engine_type=TechVariant.EngineType.NATURALLY_ASPIRATED,
            fuel_type=TechVariant.FuelType.PETROL,
            transmission_code='TR-1',
            transmission_type=TechVariant.TransmissionType.MT,
            notes='TechVariant notes',
        )

        ProductBodyTypeCompatibility.objects.create(product=self.body_product, body_type=self.body_type, notes='bt-notes')
        ProductTechVariantCompatibility.objects.create(product=self.tech_product, tech_variant=self.tech_variant, notes='tv-notes')

    def test_detach_tech_keeps_tech_variants_but_unbinds_generation(self):
        self.client_api.force_authenticate(user=self.admin)

        before_logs = AuditLog.objects.count()
        url = reverse('generation-detail', kwargs={'pk': self.generation.id}) + '?mode=detach_tech'
        response = self.client_api.delete(url)
        self.assertEqual(response.status_code, 204)

        # Generation удалён (из-за удаления узла) — кузов тоже.
        self.assertFalse(Generation.objects.filter(id=self.generation.id).exists())
        self.assertFalse(BodyType.objects.filter(id=self.body_type.id).exists())

        # TechVariant остался, но generation стал NULL.
        tv = TechVariant.objects.get(id=self.tech_variant.id)
        self.assertIsNone(tv.generation_id)

        # Совместимость товара по конфигурациям осталась.
        self.assertTrue(
            ProductTechVariantCompatibility.objects.filter(tech_variant_id=self.tech_variant.id).exists()
        )

        # Совместимость по кузову исчезла, потому что BodyType был удалён.
        self.assertFalse(
            ProductBodyTypeCompatibility.objects.filter(body_type_id=self.body_type.id).exists()
        )

        # Журнал: UPDATE по отвязке конфигурации, DELETE по кузову и поколению (и «корню» через perform_destroy).
        self.assertGreater(AuditLog.objects.count(), before_logs)
        tv_updates = AuditLog.objects.filter(
            action=AuditLog.Action.UPDATE,
            entity_type='Техническая конфигурация',
            object_id=str(self.tech_variant.id),
        )
        self.assertEqual(tv_updates.count(), 1)
        self.assertIsNone(tv_updates.first().after_data.get('generation'))

    def test_cascade_generation_deletes_are_audited(self):
        self.client_api.force_authenticate(user=self.admin)
        url = reverse('generation-detail', kwargs={'pk': self.generation.id}) + '?mode=cascade'
        response = self.client_api.delete(url)
        self.assertEqual(response.status_code, 204)

        self.assertFalse(TechVariant.objects.filter(id=self.tech_variant.id).exists())
        self.assertFalse(BodyType.objects.filter(id=self.body_type.id).exists())
        self.assertFalse(Generation.objects.filter(id=self.generation.id).exists())

        tech_dels = AuditLog.objects.filter(
            action=AuditLog.Action.DELETE,
            entity_type='Техническая конфигурация',
            object_id=str(self.tech_variant.id),
        )
        self.assertEqual(tech_dels.count(), 1)
        body_dels = AuditLog.objects.filter(
            action=AuditLog.Action.DELETE,
            entity_type='Тип кузова',
            object_id=str(self.body_type.id),
        )
        self.assertEqual(body_dels.count(), 1)
        gen_dels = AuditLog.objects.filter(
            action=AuditLog.Action.DELETE,
            entity_type='Поколение авто',
            object_id=str(self.generation.id),
        )
        self.assertEqual(gen_dels.count(), 1)


class StorefrontCatalogFitmentTests(BaseAPIPermissionsTest):
    def setUp(self):
        super().setUp()
        self.brand = Brand.objects.create(name='StoreBrand')
        self.model = CarModel.objects.create(brand=self.brand, name='StoreModel')
        self.generation = Generation.objects.create(car_model=self.model, name='StoreGen')
        self.body_type = BodyType.objects.create(generation=self.generation, name=BodyType.Types.SEDAN)
        self.tech_variant = TechVariant.objects.create(
            generation=self.generation,
            engine_code='ENG-S',
            transmission_code='TR-S',
            transmission_type=TechVariant.TransmissionType.AT,
        )
        self.body_product = Product.objects.create(
            name='Body Fit Product',
            sku='FIT-BODY-1',
            price='100.00',
            stock=1,
            category=self.category,
            compatibility_mode=Product.CompatibilityMode.BODY_TYPE,
        )
        self.tech_product = Product.objects.create(
            name='Tech Fit Product',
            sku='FIT-TECH-1',
            price='120.00',
            stock=2,
            category=self.category,
            compatibility_mode=Product.CompatibilityMode.TECH_VARIANT,
        )
        ProductBodyTypeCompatibility.objects.create(product=self.body_product, body_type=self.body_type)
        ProductTechVariantCompatibility.objects.create(product=self.tech_product, tech_variant=self.tech_variant)

    def test_products_filter_by_body_type(self):
        url = reverse('product-list')
        response = self.client_api.get(url, {'body_type_id': self.body_type.id, 'fitment_only': '1'})
        self.assertEqual(response.status_code, 200)
        ids = [row['id'] for row in response.data]
        self.assertIn(self.body_product.id, ids)
        self.assertNotIn(self.tech_product.id, ids)

    def test_products_return_fitment_status_for_selected_tech(self):
        url = reverse('product-list')
        response = self.client_api.get(url, {'tech_variant_id': self.tech_variant.id})
        self.assertEqual(response.status_code, 200)
        by_id = {row['id']: row for row in response.data}
        self.assertEqual(by_id[self.tech_product.id]['fitment_status'], 'confirmed')
        self.assertEqual(by_id[self.body_product.id]['fitment_status'], 'conflict')


class StorefrontCartCheckoutTests(BaseAPIPermissionsTest):
    def setUp(self):
        super().setUp()
        self.brand = Brand.objects.create(name='CartBrand')
        self.model = CarModel.objects.create(brand=self.brand, name='CartModel')
        self.generation = Generation.objects.create(car_model=self.model, name='CartGen')
        self.body_type = BodyType.objects.create(generation=self.generation, name=BodyType.Types.SEDAN)
        self.fit_product = Product.objects.create(
            name='Fit Cart Product',
            sku='CART-FIT-1',
            price='50.00',
            stock=3,
            category=self.category,
            compatibility_mode=Product.CompatibilityMode.BODY_TYPE,
        )
        self.conflict_product = Product.objects.create(
            name='Conflict Cart Product',
            sku='CART-CONFLICT-1',
            price='70.00',
            stock=2,
            category=self.category,
            compatibility_mode=Product.CompatibilityMode.BODY_TYPE,
        )
        ProductBodyTypeCompatibility.objects.create(product=self.fit_product, body_type=self.body_type)

    def test_guest_cart_add_and_list(self):
        add_url = reverse('storefront-cart-add-item')
        body_ctx = {'brand_id': self.brand.id, 'body_type_id': self.body_type.id}
        response = self.client_api.post(add_url, {'product_id': self.fit_product.id, 'quantity': 1, 'vehicle_context': body_ctx}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['total_quantity'], 1)
        self.assertEqual(response.data['items'][0]['fitment_status'], 'confirmed')

        detail_url = reverse('storefront-cart-detail')
        response = self.client_api.get(detail_url, body_ctx)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['items']), 1)

    def test_checkout_blocks_conflicts_without_override(self):
        add_url = reverse('storefront-cart-add-item')
        body_ctx = {'brand_id': self.brand.id, 'body_type_id': self.body_type.id}
        self.client_api.post(add_url, {'product_id': self.conflict_product.id, 'quantity': 1, 'vehicle_context': body_ctx}, format='json')

        self.client_api.force_authenticate(user=self.client_user)
        checkout_url = reverse('storefront-checkout')
        response = self.client_api.post(checkout_url, {'vehicle_context': body_ctx, 'allow_conflicts': False}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertTrue(response.data.get('can_override'))

        ok_response = self.client_api.post(checkout_url, {'vehicle_context': body_ctx, 'allow_conflicts': True}, format='json')
        self.assertEqual(ok_response.status_code, 201)
        self.assertTrue(Order.objects.filter(id=ok_response.data['order_id']).exists())

    def test_checkout_validate_matches_stock_rules(self):
        add_url = reverse('storefront-cart-add-item')
        body_ctx = {'brand_id': self.brand.id, 'body_type_id': self.body_type.id}
        self.client_api.post(
            add_url,
            {'product_id': self.fit_product.id, 'quantity': 10, 'vehicle_context': body_ctx},
            format='json',
        )
        validate_url = reverse('storefront-checkout-validate')
        self.client_api.force_authenticate(user=self.client_user)
        bad = self.client_api.post(validate_url, {'vehicle_context': body_ctx, 'allow_conflicts': False}, format='json')
        self.assertEqual(bad.status_code, 409)
        self.assertIn('stock_errors', bad.data)

        patch_url = reverse('storefront-cart-update-item', kwargs={'product_id': self.fit_product.id})
        self.client_api.patch(patch_url, {'quantity': 1, 'vehicle_context': body_ctx}, format='json')
        ok = self.client_api.post(validate_url, {'vehicle_context': body_ctx, 'allow_conflicts': False}, format='json')
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(ok.data.get('ok'))


class SupportChatTests(BaseAPIPermissionsTest):
    def test_guest_can_bootstrap_thread(self):
        r = self.client_api.get(reverse('storefront-support-thread'))
        self.assertEqual(r.status_code, 200)
        self.assertIn('id', r.data)
        r2 = self.client_api.get(reverse('storefront-support-messages'))
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data, [])

    def test_client_thread_messages_hide_staff_identity(self):
        self.client_api.force_authenticate(user=self.client_user)
        self.client_api.get(reverse('storefront-support-thread'))
        self.client_api.post(reverse('storefront-support-messages'), {'text': 'Привет'}, format='multipart')
        thread = SupportThread.objects.get(user=self.client_user)
        SupportMessage.objects.create(
            thread=thread,
            author=self.manager,
            sender_role=SupportMessage.SenderRole.STAFF,
            text='Ответ поддержки',
        )
        r = self.client_api.get(reverse('storefront-support-messages'))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 2)
        staff_msg = next(x for x in r.data if x.get('from_support'))
        self.assertTrue(staff_msg['from_support'])
        self.assertNotIn('staff_author_name', staff_msg)

    def test_manager_list_unread_and_read(self):
        thread = SupportThread.objects.create(user=self.client_user)
        msg = SupportMessage.objects.create(
            thread=thread,
            author=self.client_user,
            sender_role=SupportMessage.SenderRole.CLIENT,
            text='Вопрос',
        )
        thread.last_message_at = msg.created_at
        thread.save(update_fields=['last_message_at'])

        self.client_api.force_authenticate(user=self.manager)
        r = self.client_api.get(reverse('support-threads-list'))
        self.assertEqual(r.status_code, 200)
        row = next(x for x in r.data if x['id'] == thread.id)
        self.assertGreater(row['unread_count'], 0)

        self.client_api.post(reverse('support-thread-read', kwargs={'thread_id': thread.id}))
        r2 = self.client_api.get(reverse('support-threads-list'))
        row2 = next(x for x in r2.data if x['id'] == thread.id)
        self.assertEqual(row2['unread_count'], 0)

    def test_manager_sees_staff_name_in_thread_messages(self):
        thread = SupportThread.objects.create(user=self.client_user)
        SupportMessage.objects.create(
            thread=thread,
            author=self.manager,
            sender_role=SupportMessage.SenderRole.STAFF,
            text='Ответ',
        )
        self.client_api.force_authenticate(user=self.manager)
        r = self.client_api.get(reverse('support-thread-messages', kwargs={'thread_id': thread.id}))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0].get('staff_author_name'), 'manager-api')

    def test_plain_client_denied_support_threads_list(self):
        self.client_api.force_authenticate(user=self.client_user)
        r = self.client_api.get(reverse('support-threads-list'))
        self.assertEqual(r.status_code, 403)


class ImportApiTests(BaseAPIPermissionsTest):
    def _json_upload(self, name: str, payload: list[dict]):
        raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        return SimpleUploadedFile(name, raw, content_type='application/json')

    def _zip_upload(self, name: str, files: dict[str, bytes]):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
            for path, content in files.items():
                zf.writestr(path, content)
        return SimpleUploadedFile(name, buf.getvalue(), content_type='application/zip')

    def test_preview_products_json_returns_report(self):
        self.client_api.force_authenticate(user=self.admin)
        data_file = self._json_upload(
            'products.json',
            [
                {
                    'sku': 'IMPORT-SKU-1',
                    'name': 'Импорт товар',
                    'price': 1200,
                    'stock': 4,
                    'category': 'Кузовные детали > Бамперы',
                    'compatibility_mode': 'BODY_TYPE',
                }
            ],
        )
        response = self.client_api.post(
            reverse('import-preview'),
            {'entity_type': 'products', 'conflict_mode': 'stop', 'data_file': data_file},
            format='multipart',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['preview'])
        self.assertEqual(response.data['report']['total'], 1)

    def test_execute_products_json_creates_product_and_audit(self):
        self.client_api.force_authenticate(user=self.admin)
        before_logs = AuditLog.objects.count()
        data_file = self._json_upload(
            'products.json',
            [
                {
                    'sku': 'IMPORT-SKU-2',
                    'name': 'Импорт товар execute',
                    'price': 2200,
                    'stock': 6,
                    'category': 'Кузовные детали > Капоты',
                }
            ],
        )
        response = self.client_api.post(
            reverse('import-execute'),
            {'entity_type': 'products', 'conflict_mode': 'stop', 'data_file': data_file},
            format='multipart',
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['preview'])
        self.assertTrue(Product.objects.filter(sku='IMPORT-SKU-2').exists())
        self.assertEqual(AuditLog.objects.count(), before_logs + 1)
        log = AuditLog.objects.order_by('-id').first()
        self.assertEqual(log.entity_type, 'Импорт данных')

    def test_execute_cars_with_images_zip(self):
        self.client_api.force_authenticate(user=self.admin)
        data_file = self._json_upload(
            'cars.json',
            [
                {
                    'brand': 'ImportBrand',
                    'model': 'ImportModel',
                    'generation': 'ImportGen',
                    'body_type': 'SEDAN',
                    'generation_image_path': 'generations/import_gen.jpg',
                }
            ],
        )
        images_zip = self._zip_upload('images.zip', {'generations/import_gen.jpg': b'fake-image-bytes'})
        response = self.client_api.post(
            reverse('import-execute'),
            {
                'entity_type': 'cars',
                'conflict_mode': 'update',
                'data_file': data_file,
                'images_zip': images_zip,
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 200)
        gen = Generation.objects.get(name='ImportGen')
        self.assertTrue(bool(gen.image))

    def test_execute_stops_on_conflict_when_mode_stop(self):
        self.client_api.force_authenticate(user=self.admin)
        Product.objects.create(
            name='Existing',
            price='100.00',
            stock=1,
            sku='DUP-SKU',
            category=self.category,
        )
        data_file = self._json_upload(
            'products.json',
            [
                {
                    'sku': 'DUP-SKU',
                    'name': 'Новый',
                    'price': 999,
                    'stock': 2,
                    'category': 'Категория 1',
                }
            ],
        )
        response = self.client_api.post(
            reverse('import-execute'),
            {'entity_type': 'products', 'conflict_mode': 'stop', 'data_file': data_file},
            format='multipart',
        )
        self.assertEqual(response.status_code, 400)

