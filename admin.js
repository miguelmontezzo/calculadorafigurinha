// Painel admin — conversa com /api/admin usando o header x-admin-token.
const $ = id => document.getElementById(id);
let adminToken = '';

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmtBRL = v => (v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
function quando(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function toast(msg, type = '') {
  let el = $('_toast');
  if (!el) { el = document.createElement('div'); el.id = '_toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.className = `toast ${type}`;
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

async function adminApi(action, { method = 'GET', body, query = '' } = {}) {
  const res = await fetch(`/api/admin?action=${action}${query}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401 && $('mainPanel').hidden === false) sair();
  if (!res.ok) throw Object.assign(new Error(data.error || `Erro ${res.status}`), { status: res.status });
  return data;
}

// ── Login do admin ────────────────────────────────────────────
async function entrar(token, silencioso = false) {
  adminToken = token;
  try {
    await adminApi('status');
  } catch (err) {
    adminToken = '';
    try { sessionStorage.removeItem('c3d_admin'); } catch {}
    if (!silencioso) {
      $('authError').textContent = err.status === 401 ? 'Senha incorreta.' : err.message;
      $('authError').classList.add('visible');
    }
    return;
  }
  try { sessionStorage.setItem('c3d_admin', token); } catch {}
  $('authGate').hidden = true;
  $('mainPanel').hidden = false;
  abrirAba('overview');
}

function sair() {
  adminToken = '';
  try { sessionStorage.removeItem('c3d_admin'); } catch {}
  location.reload();
}

$('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('authError').classList.remove('visible');
  const token = $('adminToken').value.trim();
  if (!token) return;
  $('authBtn').disabled = true;
  await entrar(token);
  $('authBtn').disabled = false;
});
$('adminLogout').addEventListener('click', sair);

// ── Abas ─────────────────────────────────────────────────────
const carregadores = { overview: carregarDashboard, members: carregarMembros, system: carregarStatus, import: () => {} };
function abrirAba(tab) {
  document.querySelectorAll('.admin-nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  Object.keys(carregadores).forEach(t => { $(`tab-${t}`).hidden = t !== tab; });
  carregadores[tab]();
}
document.querySelectorAll('.admin-nav button').forEach(b => b.addEventListener('click', () => abrirAba(b.dataset.tab)));

// ── Visão geral ──────────────────────────────────────────────
async function carregarDashboard() {
  let d;
  try { d = await adminApi('dashboard'); } catch (err) { return toast(err.message, 'error'); }

  const s = d.stats;
  $('sMembrosAtivos').textContent = s.membrosAtivos;
  $('sTotalMembros').textContent = s.totalMembros;
  $('sUsuarios30d').textContent = s.usuarios30d;
  $('sCalculos7d').textContent = s.calculos7d;
  $('sTotalCalculos').textContent = s.totalCalculos;
  $('sTotalLogins').textContent = s.totalLogins;

  const max = Math.max(1, ...d.serie.map(x => Math.max(x.logins, x.calculos)));
  $('spark').innerHTML = d.serie.map(x => `
    <div class="col" title="${x.dia.split('-').reverse().join('/')}: ${x.logins} logins, ${x.calculos} cálculos">
      <i class="a" style="height:${(x.logins / max) * 100}%"></i>
      <i class="b" style="height:${(x.calculos / max) * 100}%"></i>
    </div>`).join('');
  $('sparkX').innerHTML = d.serie.map((x, i) => `<span>${i % 2 === 0 ? x.dia.slice(8) : ''}</span>`).join('');

  const vazio = msg => `<div class="empty" style="padding:20px">${msg}</div>`;
  $('topUsuarios').innerHTML = d.topUsuarios.length
    ? d.topUsuarios.map((u, i) => `<div class="list-row"><div class="lr-main"><span class="bed-num">${i + 1}</span><div class="lr-label truncate">${escapeHTML(u.email)}</div></div><div class="lr-value">${u.total}</div></div>`).join('')
    : vazio('Nenhum cálculo ainda');
  $('loginsRecentes').innerHTML = d.loginsRecentes.length
    ? d.loginsRecentes.slice(0, 8).map(l => `<div class="list-row"><div class="lr-label truncate">${escapeHTML(l.email)}</div><div class="lr-value muted" style="font-weight:500">${quando(l.created_at)}</div></div>`).join('')
    : vazio('Nenhum login ainda');
  $('tbCalcs').innerHTML = d.calcsRecentes.length
    ? d.calcsRecentes.map(c => `<tr>
        <td class="truncate">${escapeHTML(c.email)}</td>
        <td class="truncate">${escapeHTML(c.nome_produto || '—')}</td>
        <td class="num">${fmtBRL(c.dados?.custoTotal)}</td>
        <td class="num">${fmtBRL(c.dados?.precoBase)}</td>
        <td class="num">${fmtBRL(c.dados?.lucroValor)}</td>
        <td>${quando(c.created_at)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6">${vazio('Nenhum cálculo ainda')}</td></tr>`;
}
$('reloadDash').addEventListener('click', carregarDashboard);

// ── Membros ───────────────────────────────────────────────────
const ORIGEM = { manual: 'Manual', csv: 'Planilha', hotmart: 'Hotmart' };
let buscaTimer;

async function carregarMembros() {
  const q = $('memberSearch').value.trim();
  let d;
  try { d = await adminApi('members', { query: q ? `&q=${encodeURIComponent(q)}` : '' }); } catch (err) { return toast(err.message, 'error'); }
  $('membersCount').textContent = `· ${d.members.length}${d.members.length === 500 ? '+' : ''}`;
  $('tbMembers').innerHTML = d.members.length ? d.members.map(m => `
    <tr data-email="${escapeHTML(m.email)}">
      <td><div style="font-weight:500">${escapeHTML(m.nome || m.email)}</div>${m.nome ? `<div class="small muted">${escapeHTML(m.email)}</div>` : ''}</td>
      <td><span class="pill neutral">${ORIGEM[m.origem] || m.origem}</span></td>
      <td class="muted">${m.ultimo_login ? quando(m.ultimo_login) : 'Nunca'}</td>
      <td><label class="switch" title="${m.ativo ? 'Ativo' : 'Bloqueado'}"><input type="checkbox" class="toggle-ativo" ${m.ativo ? 'checked' : ''} aria-label="Acesso de ${escapeHTML(m.email)}"><span></span></label></td>
      <td class="num"><button class="icon-btn remove-member" aria-label="Remover ${escapeHTML(m.email)}" title="Remover"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></td>
    </tr>`).join('')
    : `<tr><td colspan="5"><div class="empty" style="padding:24px">${q ? 'Ninguém encontrado com essa busca.' : 'Nenhum membro ainda. Libere o primeiro acima ou importe uma planilha.'}</div></td></tr>`;
}

$('memberSearch').addEventListener('input', () => { clearTimeout(buscaTimer); buscaTimer = setTimeout(carregarMembros, 250); });

$('tbMembers').addEventListener('change', async e => {
  if (!e.target.classList.contains('toggle-ativo')) return;
  const email = e.target.closest('tr').dataset.email;
  const ativo = e.target.checked;
  try {
    await adminApi('members', { method: 'PATCH', body: { email, ativo } });
    toast(ativo ? `Acesso liberado para ${email}` : `Acesso bloqueado para ${email}`);
  } catch (err) {
    e.target.checked = !ativo;
    toast(err.message, 'error');
  }
});

function confirmar(texto) {
  return new Promise(resolve => {
    $('confirmText').textContent = texto;
    $('confirmModal').classList.add('visible');
    const fim = ok => { $('confirmModal').classList.remove('visible'); $('confirmOk').onclick = $('confirmCancel').onclick = null; resolve(ok); };
    $('confirmOk').onclick = () => fim(true);
    $('confirmCancel').onclick = () => fim(false);
  });
}

$('tbMembers').addEventListener('click', async e => {
  const btn = e.target.closest('.remove-member');
  if (!btn) return;
  const email = btn.closest('tr').dataset.email;
  if (!(await confirmar(`${email} perde o acesso e os padrões salvos. Para só bloquear, use a chave “Ativo”.`))) return;
  try {
    await adminApi('members', { method: 'DELETE', body: { email } });
    toast('Membro removido');
    carregarMembros();
  } catch (err) { toast(err.message, 'error'); }
});

$('addMemberForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('newEmail').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Digite um email válido.', 'error'); $('newEmail').focus(); return; }
  $('addMemberBtn').disabled = true;
  try {
    const r = await adminApi('members', { method: 'POST', body: { email, nome: $('newNome').value } });
    toast(r.novo ? `Acesso liberado para ${email}` : `${email} já existia — acesso reativado`);
    $('newEmail').value = ''; $('newNome').value = '';
    carregarMembros();
  } catch (err) { toast(err.message, 'error'); }
  $('addMemberBtn').disabled = false;
});

// ── Importar CSV ──────────────────────────────────────────────
let parsedMembers = [];

// Lê CSV com ; ou , e campos entre aspas (formato do export da Hotmart)
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const primeira = text.split(/\r?\n/)[0] || '';
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (aspas) {
      if (ch === '"' && text[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter(l => l.some(c => c.trim()));
}

async function lerCSV(file) {
  const linhas = parseCSV(await file.text());
  if (linhas.length < 2) return toast('O arquivo está vazio.', 'error');
  const header = linhas[0].map(h => h.trim().toLowerCase());
  const idxEmail = header.findIndex(h => h.includes('mail'));
  const idxNome = header.findIndex(h => h === 'nome' || h === 'name' || h.startsWith('nome') || h.includes('comprador'));
  if (idxEmail === -1) return toast('Não achei a coluna de email no arquivo.', 'error');

  parsedMembers = linhas.slice(1).map(c => ({
    email: (c[idxEmail] || '').trim(),
    nome: idxNome >= 0 ? (c[idxNome] || '').trim() : '',
  })).filter(m => m.email);

  let r;
  try { r = await adminApi('import', { method: 'POST', body: { members: parsedMembers, dryRun: true } }); }
  catch (err) { return toast(err.message, 'error'); }
  renderPreview(r);
}

function renderPreview(r) {
  const novos = new Set(r.novos), existentes = new Set(r.existentes);
  $('countNovos').textContent = `${r.novos.length} novos`;
  $('countExiste').textContent = `${r.existentes.length} já cadastrados`;
  $('countInvalidos').textContent = `${r.invalidos.length} inválidos`;
  $('countInvalidos').parentElement.hidden = r.invalidos.length === 0;
  $('importBtn').disabled = r.novos.length === 0;
  $('importBtn').textContent = r.novos.length ? `Importar ${r.novos.length} novos` : 'Nada novo para importar';

  const vistos = new Set();
  $('previewBody').innerHTML = parsedMembers.map(m => {
    const email = m.email.toLowerCase().trim();
    if (vistos.has(email)) return '';
    vistos.add(email);
    const st = novos.has(email) ? '<span class="pill ok">Novo</span>' : existentes.has(email) ? '<span class="pill neutral">Já cadastrado</span>' : '<span class="pill bad">Inválido</span>';
    return `<tr><td>${st}</td><td>${escapeHTML(m.nome || '—')}</td><td>${escapeHTML(m.email)}</td></tr>`;
  }).join('');
  $('previewSection').hidden = false;
}

$('csvFile').addEventListener('change', e => { if (e.target.files[0]) lerCSV(e.target.files[0]); e.target.value = ''; });
const drop = $('dropZone');
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) lerCSV(e.dataTransfer.files[0]); });

$('importBtn').addEventListener('click', async () => {
  $('importBtn').disabled = true;
  $('importBtn').textContent = 'Importando…';
  try {
    const r = await adminApi('import', { method: 'POST', body: { members: parsedMembers } });
    toast(`${r.adicionados} membro${r.adicionados === 1 ? '' : 's'} adicionado${r.adicionados === 1 ? '' : 's'}`);
    const conf = await adminApi('import', { method: 'POST', body: { members: parsedMembers, dryRun: true } });
    renderPreview(conf);
  } catch (err) {
    toast(err.message, 'error');
    $('importBtn').disabled = false;
  }
});

// ── Sistema ───────────────────────────────────────────────────
const ICON_OK = '<span class="check-icon ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
const ICON_BAD = '<span class="check-icon bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg></span>';

async function carregarStatus() {
  $('webhookUrl').textContent = `${location.origin}/api/hotmart-webhook`;
  let s;
  try { s = await adminApi('status'); } catch (err) { return toast(err.message, 'error'); }
  const linha = (ok, label, sub) => `<div class="list-row"><div class="lr-main">${ok ? ICON_OK : ICON_BAD}<div><div class="lr-label">${label}</div><div class="lr-sub">${sub}</div></div></div></div>`;
  const faltando = s.tabelas.faltando || [];
  $('statusList').innerHTML = [
    linha(s.env.DATABASE_URL, 'Banco de dados configurado', s.env.DATABASE_URL ? 'Variável DATABASE_URL encontrada' : 'Adicione DATABASE_URL na Vercel (Settings → Environment Variables) ou conecte o Neon em Storage.'),
    linha(s.banco.conectado, 'Conexão com o Neon', s.banco.conectado ? `${s.banco.versao} · respondeu em ${s.banco.latenciaMs} ms` : (s.banco.erro || 'Sem conexão')),
    linha(s.banco.conectado && faltando.length === 0, 'Tabelas', !s.banco.conectado ? 'Aguardando conexão' : faltando.length ? `Faltando: ${faltando.join(', ')}` : 'members, user_profiles, login_logs, calc_logs'),
    linha(s.env.AUTH_SECRET, 'Segredo das sessões', s.env.AUTH_SECRET ? 'AUTH_SECRET definido' : 'Defina AUTH_SECRET com um valor aleatório longo (hoje usa ADMIN_SECRET como reserva).'),
    linha(s.env.HOTMART_SECRET, 'Webhook da Hotmart', s.env.HOTMART_SECRET ? 'HOTMART_SECRET definido' : 'Opcional: defina HOTMART_SECRET para liberar acesso automático.'),
    s.contagens ? linha(true, 'Dados', `${s.contagens.membros} membros · ${s.contagens.logins} logins · ${s.contagens.calculos} cálculos`) : '',
  ].join('');
  $('setupBox').hidden = !(s.banco.conectado && faltando.length > 0);
}
$('reloadStatus').addEventListener('click', carregarStatus);
$('setupBtn').addEventListener('click', async () => {
  $('setupBtn').disabled = true;
  try { await adminApi('setup', { method: 'POST' }); toast('Tabelas criadas'); } catch (err) { toast(err.message, 'error'); }
  $('setupBtn').disabled = false;
  carregarStatus();
});
$('copyWebhook').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('webhookUrl').textContent); toast('URL copiada'); } catch { toast('Não foi possível copiar', 'error'); }
});

// Reabre direto se a senha já foi digitada nesta aba
try {
  const salvo = sessionStorage.getItem('c3d_admin');
  if (salvo) entrar(salvo, true);
} catch {}
