/**
 * Статические изображения категорий для главной (как в catalog.views.home).
 * Пути относительно STATIC_URL (/static/).
 */
export const HOME_CATEGORY_IMAGE_BY_NAME = {
  Бамперы: 'img/pages/main page/category/bamper.jpg',
  Капот: 'img/pages/main page/category/kapot.jpg',
  Крылья: 'img/pages/main page/category/krylo.jpg',
  Двери: 'img/pages/main page/category/dver.jpg',
  'Крышка багажника / Пятая дверь': 'img/pages/main page/category/kryska bagaznika.jpg',
  Крыша: 'img/pages/main page/category/kryisha.jpg',
  Пороги: 'img/pages/main page/category/porogi.jpg',
  'Решетки и облицовка': 'img/pages/main page/category/reshetka.png',
  Зеркала: 'img/pages/main page/category/zerkalo.png',
};

export function staticUrl(relativePath) {
  return `/static/${relativePath}`.replace(/\/{2,}/g, '/');
}
