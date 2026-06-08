// Perfil do usuário — salva e carrega configurações padrão do Supabase
// Depende de: supabase (auth.js), IMPRESSORAS, ENERGIA_ESTADOS

let perfilCarregado = null;

// ── Popula os selects do modal ────────────────────────────────
function popularSelectsPerfil() {
  // Impressoras
  const selImp = document.getElementById('pImpressora');
  IMPRESSORAS.forEach(imp => {
    const opt = document.createElement('option');
    opt.value = imp.id;
    opt.textContent = imp.watts > 0 ? `${imp.nome} (~${imp.watts}W)` : imp.nome;
    selImp.appendChild(opt);
  });

  // Estados
  const selEst = document.getElementById('pEstado');
  Object.entries(ENERGIA_ESTADOS)
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome))
    .forEach(([uf, dados]) => {
      const opt = document.createElement('option');
      opt.value = uf;
      opt.textContent = `${dados.nome} (${uf})`;
      selEst.appendChild(opt);
    });
}

// ── Carrega o perfil do Supabase e aplica na calculadora ──────
async function carregarPerfil() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  if (!data) return;

  perfilCarregado = data;
  aplicarPerfil(data);
  preencherModalComPerfil(data);
}

function aplicarPerfil(p) {
  // Impressora
  if (p.impressora_id) {
    const sel = document.getElementById('impressoraSelect');
    if (sel) sel.value = p.impressora_id;
  }
  // Watts custom
  if (p.watts_custom) {
    document.getElementById('watts').value = p.watts_custom;
  } else if (p.impressora_id) {
    const imp = IMPRESSORAS.find(i => i.id === p.impressora_id);
    if (imp && imp.watts > 0) document.getElementById('watts').value = imp.watts;
  }
  // Estado
  if (p.estado) {
    const sel = document.getElementById('estado');
    if (sel) sel.value = p.estado;
  }
  // kWh custom ou padrão do estado
  if (p.kwh_custom) {
    document.getElementById('kwh').value = p.kwh_custom;
  } else if (p.estado && ENERGIA_ESTADOS[p.estado]) {
    document.getElementById('kwh').value = ENERGIA_ESTADOS[p.estado].kwh;
  }
  // Custos
  if (p.embalagem)  document.getElementById('embalagem').value = p.embalagem;
  if (p.falhas)     document.getElementById('falhas').value    = p.falhas;
  if (p.margem)     document.getElementById('margem').value    = p.margem;
  // Modo de venda
  if (p.modo) {
    const tab = document.querySelector(`.mode-tab[data-mode="${p.modo}"]`);
    if (tab) tab.click();
  }
}

function preencherModalComPerfil(p) {
  if (p.impressora_id) document.getElementById('pImpressora').value = p.impressora_id;
  if (p.watts_custom)  document.getElementById('pWatts').value      = p.watts_custom;
  if (p.estado)        document.getElementById('pEstado').value      = p.estado;
  if (p.kwh_custom)    document.getElementById('pKwh').value         = p.kwh_custom;
  if (p.embalagem)     document.getElementById('pEmbalagem').value   = p.embalagem;
  if (p.falhas)        document.getElementById('pFalhas').value      = p.falhas;
  if (p.margem)        document.getElementById('pMargem').value      = p.margem;
  if (p.modo)          document.getElementById('pModo').value        = p.modo;
}

// ── Salva perfil no Supabase ──────────────────────────────────
async function salvarPerfil() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const btn = document.getElementById('saveProfileBtn');
  const status = document.getElementById('saveStatus');
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  status.textContent = '';
  status.className = 'save-status';

  const perfil = {
    user_id:      session.user.id,
    impressora_id: document.getElementById('pImpressora').value || null,
    watts_custom:  parseFloat(document.getElementById('pWatts').value) || null,
    estado:        document.getElementById('pEstado').value || null,
    kwh_custom:    parseFloat(document.getElementById('pKwh').value) || null,
    embalagem:     parseFloat(document.getElementById('pEmbalagem').value) || null,
    falhas:        parseFloat(document.getElementById('pFalhas').value) || null,
    margem:        parseFloat(document.getElementById('pMargem').value) || null,
    modo:          document.getElementById('pModo').value || 'varejo',
    updated_at:    new Date().toISOString()
  };

  const { error } = await supabase
    .from('user_profiles')
    .upsert(perfil, { onConflict: 'user_id' });

  btn.disabled = false;
  btn.textContent = 'Salvar perfil';

  if (error) {
    status.textContent = '❌ Erro ao salvar. Tente novamente.';
    status.className = 'save-status error';
    return;
  }

  perfilCarregado = perfil;
  aplicarPerfil(perfil);
  status.textContent = '✅ Perfil salvo com sucesso!';

  setTimeout(() => {
    status.textContent = '';
    document.getElementById('profileModal').style.display = 'none';
  }, 1500);
}

// ── Modal open/close ──────────────────────────────────────────
function initModal() {
  const modal   = document.getElementById('profileModal');
  const openBtn = document.getElementById('profileBtn');
  const closeBtn= document.getElementById('profileClose');
  const saveBtn = document.getElementById('saveProfileBtn');

  openBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
    if (perfilCarregado) preencherModalComPerfil(perfilCarregado);
  });

  closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  saveBtn.addEventListener('click', salvarPerfil);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  popularSelectsPerfil();
  initModal();
  await carregarPerfil();

  // Dispara o cálculo após carregar o perfil
  if (typeof calcular === 'function') calcular();
});
