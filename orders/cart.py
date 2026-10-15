from decimal import Decimal

from catalog.models import Product


class Cart:
    SESSION_KEY = 'cart'

    def __init__(self, request):
        self.session = request.session
        cart = self.session.get(self.SESSION_KEY)
        if cart is None:
            cart = {}
            self.session[self.SESSION_KEY] = cart
        self.cart = cart

    def add(
        self,
        product_id: int,
        quantity: int = 1,
        unit_price: Decimal | None = None,
        vehicle_context: dict | None = None,
        fitment_status: str | None = None,
    ) -> None:
        product_id = str(product_id)
        item = self.cart.get(product_id, {'quantity': 0, 'unit_price': '0'})
        item['quantity'] += int(quantity)
        if unit_price is not None:
            item['unit_price'] = str(unit_price)
        if vehicle_context is not None:
            item['vehicle_context'] = vehicle_context
        if fitment_status is not None:
            item['fitment_status'] = fitment_status
        self.cart[product_id] = item
        self.save()

    def set_quantity(self, product_id: int, quantity: int) -> None:
        product_id = str(product_id)
        quantity = int(quantity)
        if quantity <= 0:
            self.remove(product_id)
            return
        item = self.cart.get(product_id)
        if not item:
            return
        item['quantity'] = quantity
        self.cart[product_id] = item
        self.save()

    def remove(self, product_id: int) -> None:
        product_id = str(product_id)
        if product_id in self.cart:
            del self.cart[product_id]
            self.save()

    def clear(self) -> None:
        self.session[self.SESSION_KEY] = {}
        self.cart = self.session[self.SESSION_KEY]
        self.session.modified = True

    def save(self) -> None:
        self.session[self.SESSION_KEY] = self.cart
        self.session.modified = True

    def __iter__(self):
        product_ids = self.cart.keys()
        products = Product.objects.filter(id__in=product_ids)
        products_map = {str(p.id): p for p in products}

        for product_id, item in self.cart.items():
            product = products_map.get(product_id)
            if not product:
                continue
            quantity = item['quantity']
            unit_price = Decimal(item['unit_price']) if item['unit_price'] != '0' else product.price
            total_price = unit_price * quantity
            yield {
                'product': product,
                'quantity': quantity,
                'unit_price': unit_price,
                'total_price': total_price,
                'vehicle_context': item.get('vehicle_context') or {},
                'fitment_status': item.get('fitment_status') or 'unknown',
            }

    def total_quantity(self) -> int:
        return sum(item['quantity'] for item in self.cart.values())

    def total_price(self) -> Decimal:
        total = Decimal('0')
        for item in self:
            total += item['total_price']
        return total

