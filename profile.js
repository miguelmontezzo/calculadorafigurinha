// Padrões do usuário — salvos no Neon (/api/profile) e aplicados ao abrir a calculadora.
// Depende de: auth.js (api, toast, evento auth:ready), calc.js, beds.js

const CAMPOS_TEXTO = ['precoKg', 'kwh', 'embalagem', 'laborHours', 'laborRate', 'falhas', 'margem', 'imposto'];

function coletarPerfil() {
  const dados = {};
  CAMPOS_TEXTO.forEach(id => {
    const v = document.getElementById(id)?.value.trim();
    if (v) dados[id] = v;
  });
  dados.estado = document.getElementById('estado').value;
  dados.modo = modoAtual;
  dados.arredondar = document.getElementById('arredondar').checked ? 'sim' : 'nao';
  if (window.filamentoAtual) dados.filamentoId = window.filamentoAtual;
  if (beds[0]?.impressoraId) dados.impressoraId = beds[0].impressoraId;
  return dados;
}

function aplicarPerfil(p) {
  if (!p) return;
  if (p.estado && ENERGIA_ESTADOS[p.estado]) {
    document.getElementById('estado').value = p.estado;
    document.getElementById('kwh').value = String(ENERGIA_ESTADOS[p.estado].kwh).replace('.', ',');
  }
  if (p.filamentoId) selecionarFilamento(p.filamentoId, { manterPreco: !!p.precoKg });
  CAMPOS_TEXTO.forEach(id => {
    if (p[id] !== undefined) document.getElementById(id).value = p[id];
  });
  if (p.kwh) document.getElementById('kwh').dataset.manual = '1';
  if (p.arredondar) document.getElementById('arredondar').checked = p.arredondar === 'sim';
  if (p.impressoraId && IMPRESSORAS.some(i => i.id === p.impressoraId)) {
    window.impressoraPadraoId = p.impressoraId;
    beds.forEach(b => { if (!b.gramas && !b.horas) b.impressoraId = p.impressoraId; });
    renderBeds();
  }
  syncRange();
  if (p.modo) setModo(p.modo); else calcular();
  // Quem já salvou padrões não precisa do aviso de primeira vez
  document.getElementById('starterBanner').hidden = true;
}

async function salvarPerfil() {
  const btn = document.getElementById('saveProfileBtn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Salvando…';
  try {
    const r = await api('/api/profile', { method: 'PUT', body: { dados: coletarPerfil() } });
    if (!r.ok) throw new Error(r.data.error);
    toast('Padrões salvos. Eles serão usados da próxima vez.');
  } catch (err) {
    toast(err.message || 'Não foi possível salvar. Tente de novo.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

document.addEventListener('auth:ready', e => aplicarPerfil(e.detail.perfil));
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveProfileBtn')?.addEventListener('click', salvarPerfil);
});
