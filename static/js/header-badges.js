(() => {
  const cartNode = document.getElementById('cart-count');
  const favoritesNode = document.getElementById('favorites-count');
  if (!cartNode && !favoritesNode) return;

  Promise.all([
    fetch('/api/storefront/cart/', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('/api/storefront/favorites/', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([cart, favorites]) => {
    if (cartNode) {
      const count = Number(cart?.total_quantity || 0);
      cartNode.textContent = count > 0 ? String(count) : '';
    }
    if (favoritesNode) {
      const count = Number(favorites?.count || 0);
      favoritesNode.textContent = count > 0 ? String(count) : '';
    }
  });
})();
