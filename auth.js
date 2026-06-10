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

  const { data, error } = await _sb
    .from('users_autorizados')
    .select('ativo')
    .eq('email', session.user.email)
    .single();

  if (error || !data || !data.ativo) {
    await _sb.auth.signOut();
    window.location.href = '/index.html?erro=acesso_negado';
    return null;
  }

  return session;
}

// ── Login com código OTP ──────────────────────────────────────
function initLogin() {
  if (!document.getElementById('emailForm')) return;

  _sb.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.href = '/calculadora.html';
  });

  if (new URLSearchParams(window.location.search).get('erro') === 'acesso_negado') {
    showEmailError('Seu acesso não está liberado. Adquira o acesso para continuar.');
  }

  let emailAtual = '';
  let timerInterval = null;

  // ── Etapa 1: envio do email ─────────────────────────────────
  document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const btn   = document.getElementById('emailBtn');

    clearEmailError();

    if (!email || !email.includes('@')) {
      showEmailError('Digite um email válido.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verificando...';

    // Confere se está cadastrado e ativo
    const { data: usuario, error: dbError } = await _sb
      .from('users_autorizados')
      .select('ativo')
      .eq('email', email)
      .single();

    if (dbError || !usuario) {
      showEmailError('Este email não está cadastrado. Adquira o acesso para continuar.');
      btn.disabled = false;
      btn.textContent = 'Enviar código';
      return;
    }

    if (!usuario.ativo) {
      showEmailError('Sua conta está inativa. Entre em contato com o suporte.');
      btn.disabled = false;
      btn.textContent = 'Enviar código';
      return;
    }

    // Envia código OTP
    const { error: otpError } = await _sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false }
    });

    if (otpError) {
      showEmailError('Erro ao enviar o código. Tente novamente.');
      btn.disabled = false;
      btn.textContent = 'Enviar código';
      return;
    }

    emailAtual = email;
    document.getElementById('displayEmail').textContent = email;
    document.getElementById('stepEmail').classList.add('hidden');
    document.getElementById('stepCodigo').classList.remove('hidden');
    document.getElementById('otp').value = '';
    document.getElementById('otp').focus();
    iniciarTimer();

    btn.disabled = false;
    btn.textContent = 'Enviar código';
  });

  // ── Etapa 2: verificação do código ──────────────────────────
  document.getElementById('codeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('otp').value.trim();
    const btn   = document.getElementById('codeBtn');

    clearCodeError();

    if (!token || token.length < 6) {
      showCodeError('Digite o código completo de 6 dígitos.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verificando...';

    const { error } = await _sb.auth.verifyOtp({
      email: emailAtual,
      token,
      type: 'email',
    });

    if (error) {
      showCodeError('Código inválido ou expirado. Solicite um novo código.');
      btn.disabled = false;
      btn.textContent = 'Entrar';
      return;
    }

    btn.textContent = '✅ Acessando...';
    window.location.href = '/calculadora.html';
  });

  // Só aceita números no campo OTP
  document.getElementById('otp').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });

  // Reenviar código
  document.getElementById('reenviarBtn').addEventListener('click', async () => {
    clearCodeError();
    document.getElementById('reenviarBtn').classList.add('hidden');
    document.getElementById('timerWrap').classList.remove('hidden');
    await _sb.auth.signInWithOtp({ email: emailAtual, options: { shouldCreateUser: false } });
    iniciarTimer();
  });

  // Voltar para email
  document.getElementById('voltarBtn').addEventListener('click', () => {
    clearInterval(timerInterval);
    document.getElementById('stepCodigo').classList.add('hidden');
    document.getElementById('stepEmail').classList.remove('hidden');
    document.getElementById('otp').value = '';
  });

  function iniciarTimer() {
    clearInterval(timerInterval);
    let s = 60;
    document.getElementById('timerCount').textContent = s;
    document.getElementById('timerWrap').classList.remove('hidden');
    document.getElementById('reenviarBtn').classList.add('hidden');
    timerInterval = setInterval(() => {
      s--;
      document.getElementById('timerCount').textContent = s;
      if (s <= 0) {
        clearInterval(timerInterval);
        document.getElementById('timerWrap').classList.add('hidden');
        document.getElementById('reenviarBtn').classList.remove('hidden');
      }
    }, 1000);
  }

  function showEmailError(msg) {
    const el = document.getElementById('emailError');
    el.textContent = msg;
    el.classList.add('visible');
  }

  function clearEmailError() {
    document.getElementById('emailError').classList.remove('visible');
  }

  function showCodeError(msg) {
    const el = document.getElementById('codeError');
    el.textContent = msg;
    el.classList.add('visible');
  }

  function clearCodeError() {
    document.getElementById('codeError').classList.remove('visible');
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
if (document.getElementById('emailForm')) {
  initLogin();
} else if (document.getElementById('logoutBtn')) {
  requireAuth();
  initLogout();
}
