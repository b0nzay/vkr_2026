class Favorites:
    SESSION_KEY = 'storefront_favorites'

    def __init__(self, request):
        self.session = request.session
        raw = self.session.get(self.SESSION_KEY)
        if not isinstance(raw, list):
            raw = []
        out = []
        for x in raw:
            try:
                out.append(int(x))
            except (TypeError, ValueError):
                continue
        self.ids = out

    def _dedupe_preserve_order(self) -> None:
        seen = set()
        next_ids = []
        for pid in self.ids:
            if pid in seen:
                continue
            seen.add(pid)
            next_ids.append(pid)
        self.ids = next_ids

    def add(self, product_id: int) -> None:
        pid = int(product_id)
        if pid not in self.ids:
            self.ids.append(pid)
            self.save()

    def remove(self, product_id: int) -> None:
        pid = int(product_id)
        self.ids = [x for x in self.ids if x != pid]
        self.save()

    def toggle(self, product_id: int) -> bool:
        """Вернёт True, если товар теперь в избранном."""
        pid = int(product_id)
        if pid in self.ids:
            self.remove(pid)
            return False
        self.add(pid)
        return True

    def clear(self) -> None:
        self.ids = []
        self.save()

    def save(self) -> None:
        self._dedupe_preserve_order()
        self.session[self.SESSION_KEY] = self.ids
        self.session.modified = True

    def as_set(self) -> set[int]:
        return set(self.ids)
