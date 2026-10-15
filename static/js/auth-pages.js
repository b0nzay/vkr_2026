(() => {
  function getCookie(name) {
    const source = `; ${document.cookie}`;
    const parts = source.split(`; ${name}=`);
    if (parts.length !== 2) return '';
    return decodeURIComponent(parts.pop().split(';').shift() || '');
  }

  const scrollBtn = document.querySelector('[data-auth-scroll-top]');
  if (scrollBtn) {
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const demoModal = document.querySelector('[data-auth-demo-modal]');
  if (demoModal) {
    const closeDemo = () => demoModal.remove();
    demoModal.querySelectorAll('[data-auth-demo-close]').forEach((el) => {
      el.addEventListener('click', closeDemo);
    });
  }

  const widgetRoot = document.querySelector('.auth-support-widget');
  if (!widgetRoot) return;

  const toggleBtn = widgetRoot.querySelector('[data-auth-chat-toggle]');
  const panel = widgetRoot.querySelector('[data-auth-chat-panel]');
  const backdrop = widgetRoot.querySelector('[data-auth-chat-backdrop]');
  const closeBtn = widgetRoot.querySelector('[data-auth-chat-close]');
  const listNode = widgetRoot.querySelector('[data-auth-chat-messages]');
  const errorNode = widgetRoot.querySelector('[data-auth-chat-error]');
  const fileNameNode = widgetRoot.querySelector('[data-auth-chat-file]');
  const form = widgetRoot.querySelector('[data-auth-chat-form]');
  const input = widgetRoot.querySelector('[data-auth-chat-input]');
  const fileInput = widgetRoot.querySelector('[data-auth-chat-input-file]');
  const attachBtn = widgetRoot.querySelector('[data-auth-chat-attach-btn]');
  const sendBtn = widgetRoot.querySelector('[data-auth-chat-send]');
  const POLL_MS = 4000;
  let open = false;
  let pollingId = null;

  function setError(text) {
    if (!text) {
      errorNode.hidden = true;
      errorNode.textContent = '';
      return;
    }
    errorNode.hidden = false;
    errorNode.textContent = text;
  }

  function setFileLabel(file) {
    if (!file) {
      fileNameNode.hidden = true;
      fileNameNode.textContent = '';
      return;
    }
    fileNameNode.hidden = false;
    fileNameNode.textContent = file.name;
  }

  function renderMessages(messages) {
    listNode.innerHTML = '';
    if (!messages.length) {
      const empty = document.createElement('p');
      empty.className = 'support-widget__empty';
      empty.textContent = 'Напишите нам — ответим в ближайшее время.';
      listNode.appendChild(empty);
      return;
    }
    messages.forEach((m) => {
      const wrap = document.createElement('div');
      wrap.className = `support-widget__msg ${m.from_support ? 'support-widget__msg--support' : 'support-widget__msg--user'}`;
      const meta = document.createElement('div');
      meta.className = 'support-widget__msg-meta';
      meta.textContent = m.from_support ? 'Поддержка' : 'Вы';
      wrap.appendChild(meta);
      if (m.text) {
        const text = document.createElement('div');
        text.className = 'support-widget__msg-text';
        text.textContent = m.text;
        wrap.appendChild(text);
      }
      if (m.attachment) {
        const a = document.createElement('a');
        a.className = 'support-widget__attachment';
        a.href = m.attachment;
        a.textContent = 'Вложение';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        wrap.appendChild(a);
      }
      listNode.appendChild(wrap);
    });
    listNode.scrollTop = listNode.scrollHeight;
  }

  async function readMessages() {
    try {
      const res = await fetch('/api/storefront/support/messages/', { credentials: 'same-origin' });
      const data = await res.json();
      renderMessages(Array.isArray(data) ? data : []);
      setError('');
    } catch {
      setError('Не удалось загрузить чат.');
    }
  }

  async function markRead() {
    try {
      await fetch('/api/storefront/support/read/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': getCookie('csrftoken') },
      });
    } catch {
      // ignore
    }
  }

  function setOpen(next) {
    open = next;
    panel.hidden = !next;
    backdrop.hidden = !next;
    toggleBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) {
      readMessages();
      markRead();
      pollingId = window.setInterval(readMessages, POLL_MS);
    } else if (pollingId) {
      window.clearInterval(pollingId);
      pollingId = null;
    }
  }

  toggleBtn.addEventListener('click', () => setOpen(!open));
  closeBtn.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => setFileLabel(fileInput.files?.[0] || null));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    const file = fileInput.files?.[0] || null;
    if (!text && !file) return;
    sendBtn.disabled = true;
    setError('');
    const fd = new FormData();
    if (text) fd.append('text', text);
    if (file) fd.append('attachment', file);
    try {
      const res = await fetch('/api/storefront/support/messages/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': getCookie('csrftoken') },
        body: fd,
      });
      if (!res.ok) throw new Error('send-failed');
      input.value = '';
      fileInput.value = '';
      setFileLabel(null);
      await readMessages();
    } catch {
      setError('Не удалось отправить сообщение.');
    } finally {
      sendBtn.disabled = false;
    }
  });

  setOpen(false);
})();
