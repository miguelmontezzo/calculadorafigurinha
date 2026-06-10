const SUPABASE_URL      = 'https://idurcwbkuyziawvzvvtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkdXJjd2JrdXl6aWF3dnp2dnR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTM3NzQsImV4cCI6MjA5NjUyOTc3NH0.4WG7_UKat2YvpC5JTa9eTx4buEzqiPz2Jt4IGWjMKCQ';

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Proteção da calculadora ───────────────────────────────────
async function requireAuth() {
  const { data: { session } } = await _sb.auth.getSession();

  if (!session) {
    window.location.href = '/index.html';
    return null;
  }

  const { data } = await _sb
    .from('users_autorizados')
    .select('ativo')
    .eq('email', session.user.email)
    .maybeSingle();

  if (!data || !data.ativo) {
    await _sb.auth.signOut();
    window.location.href = '/index.html?erro=acesso_negado';
    return null;
  }

  return session;
}

// ── Login direto por email ────────────────────────────────────
function initLogin() {
  if (!document.getElementById('loginForm')) return;

  // Se já tem sessão ativa, vai direto
  _sb.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.href = '/calculadora.html';
  });

  if (new URLSearchParams(window.location.search).get('erro') === 'acesso_negado') {
    showError('Seu acesso não está liberado. Adquira o acesso para continuar.');
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const btn   = document.getElementById('loginBtn');

    clearError();

    if (!email || !email.includes('@')) {
      showError('Digite um email válido.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';

    // Chama a API que verifica o email e gera o token
    let res, json;
    try {
      res  = await fetch('/api/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      json = await res.json();
    } catch {
      showError('Erro de conexão. Tente novamente.');
      btn.disabled = false;
      btn.textContent = 'Entrar';
      return;
    }

    if (!res.ok) {
      showError(json.error || 'Erro ao entrar. Tente novamente.');
      btn.disabled = false;
      btn.textContent = 'Entrar';
      return;
    }

    // Cria sessão no browser com o token gerado pelo servidor
    const { error: verifyError } = await _sb.auth.verifyOtp({
      token_hash: json.token_hash,
      type:       'email',
    });

    if (verifyError) {
      showError('Erro ao criar sessão. Tente novamente.');
      btn.disabled = false;
      btn.textContent = 'Entrar';
      return;
    }

    btn.textContent = '✅ Acessando...';
    window.location.href = '/calculadora.html';
  });

  function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.classList.add('visible');
  }

  function clearError() {
    document.getElementById('errorMsg').classList.remove('visible');
  }
}

// ── Logout ────────────────────────────────────────────────────
function initLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await _sb.auth.signOut();
    window.location.href = '/index.html';
  });
}

// ── Bootstrap ─────────────────────────────────────────────────
if (document.getElementById('loginForm')) {
  initLogin();
} else if (document.getElementById('logoutBtn')) {
  requireAuth();
  initLogout();
}
