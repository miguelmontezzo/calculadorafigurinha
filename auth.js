// Substitua pelos valores do seu projeto Supabase
// Settings > API no painel do Supabase
const SUPABASE_URL     = 'https://idurcwbkuyziawvzvvtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkdXJjd2JrdXl6aWF3dnp2dnR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk1Mzc3NCwiZXhwIjoyMDk2NTI5Nzc0fQ.wK0y-o9n8-yxMpLc7Iz3ujORmh0hNEjee3a3pjCUGO4';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Proteção da calculadora ───────────────────────────────────
// Chame no topo de calculadora.html — redireciona se não autenticado
async function requireAuth() {
  // Supabase processa o magic link da URL automaticamente
  await supabase.auth.getSession();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/index.html';
    return null;
  }

  // Verifica se o email está ativo na tabela de autorizados
  const { data, error } = await supabase
    .from('users_autorizados')
    .select('ativo')
    .eq('email', session.user.email)
    .single();

  if (error || !data || !data.ativo) {
    await supabase.auth.signOut();
    window.location.href = '/index.html?erro=acesso_negado';
    return null;
  }

  return session;
}

// ── Login com magic link ──────────────────────────────────────
function initLogin() {
  const form      = document.getElementById('loginForm');
  if (!form) return;

  const emailInput  = document.getElementById('email');
  const btn         = document.getElementById('loginBtn');
  const errorEl     = document.getElementById('errorMsg');
  const formState   = document.getElementById('formState');
  const sentState   = document.getElementById('sentState');
  const sentEmailEl = document.getElementById('sentEmail');
  const tryAgainBtn = document.getElementById('tryAgainBtn');

  // Se já tem sessão ativa, vai direto para a calculadora
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.href = '/calculadora.html';
  });

  // Erro vindo de redirect (acesso negado)
  if (new URLSearchParams(window.location.search).get('erro') === 'acesso_negado') {
    errorEl.textContent = 'Seu acesso não está liberado. Adquira o acesso para continuar.';
    errorEl.classList.add('visible');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      errorEl.textContent = 'Digite um email válido.';
      errorEl.classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verificando...';
    errorEl.classList.remove('visible');

    // 1. Verifica se o email está cadastrado e ativo
    const { data: usuario, error: dbError } = await supabase
      .from('users_autorizados')
      .select('ativo')
      .eq('email', email)
      .single();

    if (dbError || !usuario) {
      errorEl.textContent = 'Este email não está cadastrado. Adquira o acesso para continuar.';
      errorEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Enviar link de acesso';
      return;
    }

    if (!usuario.ativo) {
      errorEl.textContent = 'Sua conta está inativa. Entre em contato com o suporte.';
      errorEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Enviar link de acesso';
      return;
    }

    // 2. Email cadastrado e ativo → envia magic link
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/calculadora.html',
        shouldCreateUser: false, // não cria usuário novo, só envia para quem já existe
      }
    });

    if (otpError) {
      errorEl.textContent = 'Erro ao enviar o link. Tente novamente.';
      errorEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Enviar link de acesso';
      return;
    }

    // 3. Mostra tela de confirmação
    sentEmailEl.textContent = email;
    formState.classList.add('hidden');
    sentState.classList.add('visible');
  });

  // Botão "Usar outro email"
  tryAgainBtn?.addEventListener('click', () => {
    sentState.classList.remove('visible');
    formState.classList.remove('hidden');
    emailInput.value = '';
    btn.disabled = false;
    btn.textContent = 'Enviar link de acesso';
    emailInput.focus();
  });
}

// ── Logout ────────────────────────────────────────────────────
function initLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await supabase.auth.signOut();
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
