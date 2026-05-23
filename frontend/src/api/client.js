import axios from 'axios';

const api = axios.create({
  baseURL: '/api/',
  withCredentials: true,
  // Django SessionAuthentication требует CSRF для unsafe-методов.
  // Берём токен из cookie `csrftoken` и отправляем в `X-CSRFToken`.
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
});

export default api;

