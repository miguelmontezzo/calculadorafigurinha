// Autenticação no navegador — conversa com /api/login, /api/me e /api/logout.
// A sessão fica num cookie HttpOnly criado pelo servidor (o JS não precisa guardar nada).

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  let json = {};
  try { json = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data: json };
}

function toast(msg, type = '') {
  let el = document.getElementById('_toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '_toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.className = `toast ${type}`;
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ── Página de login ───────────────────────────────────────────
function initLogin() {
  const form = document.getElementById('loginForm');
  const btn = document.getElementById('loginBtn');
  const input = document.getElementById('email');
  const errEl = document.getElementById('errorMsg');
  const modal = document.getElementById('modalNaoEncontrado');

  // Já logado? Vai direto para a calculadora.
  api('/api/me').then(r => { if (r.ok) window.location.replace('/calculadora'); });

  const showError = msg => { errEl.textContent = msg; errEl.classList.add('visible'); };
  const clearError = () => errEl.classList.remove('visible');
  const setBusy = busy => { btn.disabled = busy; btn.textContent = busy ? 'Entrando…' : 'Continuar'; };

  input.addEventListener('input', clearError);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearError();
    const email = input.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Digite um email válido.');
      input.focus();
      return;
    }

    setBusy(true);
    let r;
    try {
      r = await api('/api/login', { method: 'POST', body: { email } });
    } catch {
      setBusy(false);
      return showError('Sem conexão. Verifique sua internet e tente de novo.');
    }

    if (!r.ok) {
      setBusy(false);
      if (r.data.code === 'not_found') {
        document.getElementById('modalEmail').textContent = email;
        modal.classList.add('visible');
        return;
      }
      return showError(r.data.error || 'Não foi possível entrar. Tente novamente.');
    }

    document.getElementById('loadingScreen').classList.add('visible');
    setTimeout(() => window.location.replace('/calculadora'), 1600);
  });

  document.getElementById('modalFechar').addEventListener('click', () => {
    modal.classList.remove('visible');
    input.select();
  });
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('visible'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('visible'); });
}

// ── Páginas protegidas ────────────────────────────────────────
// Dispara o evento "auth:ready" com { email, nome, perfil } quando o usuário é válido.
async function requireAuth() {
  let r;
  try {
    r = await api('/api/me');
  } catch {
    toast('Sem conexão com o servidor.', 'error');
    return null;
  }
  if (!r.ok) {
    window.location.replace('/');
    return null;
  }
  window.currentUser = r.data;
  const emailEl = document.getElementById('headerEmail');
  if (emailEl) emailEl.textContent = r.data.email;
  document.body.classList.remove('auth-pending');
  document.dispatchEvent(new CustomEvent('auth:ready', { detail: r.data }));
  return r.data;
}

function initLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    window.location.replace('/');
  });
}

if (document.getElementById('loginForm')) {
  initLogin();
} else if (document.getElementById('logoutBtn')) {
  requireAuth();
  initLogout();
}
