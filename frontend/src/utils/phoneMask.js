/** Маска +7 (999) 999-99-99 для РФ */

export function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

/**
 * Из API / произвольной строки в отображаемый вид.
 */
export function apiPhoneToDisplay(phone) {
  if (!phone || !String(phone).trim()) return '';
  return formatPhoneDigits(digitsOnly(phone));
}

/**
 * Форматирует набор цифр (уже с ведущей 7 или 8) в +7 (…) …
 */
export function formatPhoneDigits(rawDigits) {
  let d = digitsOnly(rawDigits);
  if (!d) return '';
  if (d.startsWith('8')) d = `7${d.slice(1)}`;
  if (d[0] !== '7') d = `7${d}`;
  d = d.slice(0, 11);
  const n = d.slice(1);
  if (n.length === 0) return '+7';

  let out = '+7 (';
  out += n.slice(0, Math.min(3, n.length));
  if (n.length >= 3) {
    out += ')';
    if (n.length > 3) out += ` ${n.slice(3, Math.min(6, n.length))}`;
    if (n.length > 6) out += `-${n.slice(6, Math.min(8, n.length))}`;
    if (n.length > 8) out += `-${n.slice(8, Math.min(10, n.length))}`;
  }
  return out;
}

export function onPhoneInputChange(value) {
  const d = digitsOnly(value);
  if (!d) return '';
  return formatPhoneDigits(d);
}

/**
 * Для отправки на сервер: +7XXXXXXXXXX или пусто, если цифр нет / неполный номер.
 */
export function phoneToApi(display) {
  const d = digitsOnly(display);
  if (!d) return '';
  let x = d.startsWith('8') ? `7${d.slice(1)}` : d;
  if (x[0] !== '7') x = `7${x}`;
  x = x.slice(0, 11);
  if (x.length === 11) return `+${x}`;
  return display.trim();
}
