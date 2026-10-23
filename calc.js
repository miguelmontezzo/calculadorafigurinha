// ── Utilitários ───────────────────────────────────────────────
let modoAtual = 'varejo';

function fmt(v) {
  if (v === null || v === undefined || isNaN(v)) return 'R$ —';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtPct(v) { return isNaN(v) || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'; }
function fmtNum(v, d = 1) { return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d }); }

// Lê valor de input aceitando vírgula ou ponto
function parseInputNum(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(String(el.value).replace(',', '.')) || 0;
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Classifica a margem (lucro ÷ preço de venda) em três níveis.
//   ok   → margem saudável (≥ 20%)
//   warn → ainda lucra, mas sobra pouco para imprevistos
//   bad  → prejuízo
function saudeMargem(pct) {
  if (pct >= 20) return { nivel: 'ok', texto: 'Compensa' };
  if (pct > 0)   return { nivel: 'warn', texto: 'Margem apertada' };
  return { nivel: 'bad', texto: 'Prejuízo' };
}
function pill(pct) {
  const s = saudeMargem(pct);
  return `<span class="pill ${s.nivel}">${s.texto}</span>`;
}

const EMPTY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5z"/><path d="M3.5 7.25L12 12l8.5-4.75M12 12v9.5"/></svg>';
const emptyState = msg => `<div class="empty">${EMPTY_ICON}<div>${msg}</div></div>`;

function listRow(label, value, sub = '', cls = '', swatch = '') {
  return `<div class="list-row ${cls}">
    <div class="lr-main">${swatch ? `<span class="swatch" style="background:${swatch}"></span>` : ''}
      <div><div class="lr-label">${label}</div>${sub ? `<div class="lr-sub">${sub}</div>` : ''}</div>
    </div>
    <div class="lr-value">${value}</div>
  </div>`;
}

// ── Seletor de filamentos ─────────────────────────────────────
function renderFilamentoSelector() {
  const container = document.getElementById('filamentoSelector');
  if (!container || typeof FILAMENTOS === 'undefined') return;
  FILAMENTOS.forEach(fil => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip filamento-btn';
    btn.dataset.id = fil.id;
    btn.title = `${fil.dica}\nFaixa: R$ ${fil.precoMin}–${fil.precoMax}/kg`;
    btn.innerHTML = `<span class="dot" style="background:${fil.cor}"></span>${fil.nome.split('/')[0].trim()}`;
    btn.addEventListener('click', () => selecionarFilamento(fil.id));
    container.appendChild(btn);
  });
}

function selecionarFilamento(id, { manterPreco = false } = {}) {
  document.querySelectorAll('.filamento-btn').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  const fil = FILAMENTOS.find(f => f.id === id);
  if (!fil) return;
  window.filamentoAtual = id;
  if (!manterPreco) document.getElementById('precoKg').value = String(fil.precoBR).replace('.', ',');
  const hint = document.getElementById('precoKgHint');
  if (hint) hint.textContent = `Faixa em 2026: R$ ${fil.precoMin}–${fil.precoMax}/kg · ${fil.exemplos}`;
  const falhas = document.getElementById('falhas');
  if (falhas && !falhas.value) falhas.value = fil.falhasPct;
  calcular();
}

// ── Estados ───────────────────────────────────────────────────
function popularEstados() {
  const sel = document.getElementById('estado');
  if (!sel) return;
  Object.entries(ENERGIA_ESTADOS)
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome))
    .forEach(([uf, d]) => {
      const opt = document.createElement('option');
      opt.value = uf;
      opt.textContent = d.nome;
      if (uf === 'SP') opt.selected = true;
      sel.appendChild(opt);
    });
  const kwhEl = document.getElementById('kwh');
  sel.addEventListener('change', () => {
    if (!kwhEl.dataset.manual) kwhEl.value = String(ENERGIA_ESTADOS[sel.value].kwh).replace('.', ',');
    calcular();
  });
  kwhEl.value = String(ENERGIA_ESTADOS.SP.kwh).replace('.', ',');
  kwhEl.addEventListener('input', e => { e.target.dataset.manual = e.target.value ? '1' : ''; });
}

// ── Taxas editáveis dos marketplaces ──────────────────────────
let taxasEditaveis = MARKETPLACES.map(m => ({ ...m, faixas: m.faixas.map(f => ({ ...f })) }));

// Arredonda PARA CIMA terminando em ,90 (ex.: 30,29 → 30,90). Nunca reduz o lucro.
function arredondar90(v) {
  if (!document.getElementById('arredondar')?.checked || v <= 0) return v;
  return Math.ceil(v - 0.9 - 1e-9) + 0.9;
}

function taxaNaFaixa(f, preco) {
  const fixa = f.fixaMetadeAbaixoDe && preco < f.fixaMetadeAbaixoDe ? preco / 2 : f.taxaFixa;
  return preco * (f.comissao / 100) + fixa;
}
function faixaDoPreco(mp, preco) {
  return mp.faixas.find(f => preco < f.ate) || mp.faixas[mp.faixas.length - 1];
}

// Menor preço de anúncio em que você recebe pelo menos `alvo` depois da taxa e do imposto.
// Testa cada faixa: resolve P = (alvo + fixa) / (1 − comissão − imposto) e vê se cai dentro dela.
function precoMarketplace(mp, alvo, impostoPct) {
  let melhor = Infinity;
  let inicio = 0;
  for (const f of mp.faixas) {
    const fixa = f.fixaMetadeAbaixoDe ? Math.max(f.taxaFixa, 0) : f.taxaFixa;
    const div = 1 - f.comissao / 100 - impostoPct / 100;
    if (div > 0) {
      let p = (alvo + fixa) / div;
      if (p < inicio) p = inicio;          // degrau: o início da faixa já basta
      if (p < f.ate) melhor = Math.min(melhor, p);
    }
    inicio = f.ate;
  }
  const preco = arredondar90(melhor);
  const faixa = faixaDoPreco(mp, preco);
  const taxa = taxaNaFaixa(faixa, preco);
  return { preco, taxa, faixa };
}

// ── Abas de resultado ─────────────────────────────────────────
function initResultTabs() {
  document.querySelectorAll('.results-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.results-tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.rtab-panel').forEach(p => { p.hidden = p.id !== `rtab-${btn.dataset.rtab}`; });
    });
  });
}

function abrirAba(nome) {
  document.querySelector(`.results-tab[data-rtab="${nome}"]`)?.click();
}

// ── Modo de venda ─────────────────────────────────────────────
function setModo(modo) {
  modoAtual = modo;
  document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === modo));
  document.getElementById('mode-atacado').hidden = modo !== 'atacado';
  document.getElementById('mode-consignado').hidden = modo !== 'consignado';
  calcular();
}
function initModos() {
  document.querySelectorAll('.mode-tab').forEach(btn => btn.addEventListener('click', () => setModo(btn.dataset.mode)));
}

// ── Slider de margem sincronizado com o campo ─────────────────
function syncRange() {
  const range = document.getElementById('margemRange');
  const v = parseInputNum('margem');
  range.value = Math.min(200, v);
  range.style.setProperty('--pct', `${(Math.min(200, v) / 200) * 100}%`);
  atualizarPresets();
}

// ── Faixas de lucro sugeridas para o mercado 3D ───────────────
function renderPresets() {
  const wrap = document.getElementById('margemPresets');
  if (!wrap) return;
  wrap.innerHTML = MARGENS_SUGERIDAS.map(m => `
    <button type="button" class="preset" data-valor="${m.valor}" title="${escapeHTML(m.dica)}">
      <strong>${m.nome}${m.id === 'recomendado' ? '<span class="badge-rec">★</span>' : ''}</strong>
      <span>${m.valor}% sobre o custo</span>
    </button>`).join('');
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.preset');
    if (!btn) return;
    document.getElementById('margem').value = btn.dataset.valor;
    syncRange();
    calcular();
  });
  atualizarPresets();
}
function atualizarPresets() {
  const v = parseInputNum('margem');
  document.querySelectorAll('.preset').forEach(b => b.classList.toggle('active', Number(b.dataset.valor) === v));
  const hint = document.getElementById('margemHint');
  if (!hint) return;
  const sobrePreco = v > 0 ? (v / (100 + v)) * 100 : 0;
  const ref = MARGENS_SUGERIDAS.find(m => m.valor === v);
  hint.textContent = ref
    ? `${ref.dica}`
    : `≈ ${fmtPct(sobrePreco)} do preço de venda fica de lucro.${v < 45 ? ' Abaixo do praticado no mercado 3D (45% a 100%).' : ''}`;
}
function initMargem() {
  const range = document.getElementById('margemRange');
  const input = document.getElementById('margem');
  range.addEventListener('input', () => {
    input.value = range.value;
    range.style.setProperty('--pct', `${(range.value / 200) * 100}%`);
    calcular();
  });
  input.addEventListener('input', syncRange);
  if (!input.value) input.value = 70;
  renderPresets();
  syncRange();
}

// ── Valores típicos ───────────────────────────────────────────
function aplicarValoresTipicos() {
  selecionarFilamento('pla_basico');
  const set = (id, v) => { const el = document.getElementById(id); if (!el.value) el.value = v; };
  set('embalagem', '3,50');
  set('laborHours', '0,5');
  set('laborRate', '20');
  document.getElementById('falhas').value = 10;
  document.getElementById('margem').value = 70;
  syncRange();
  if (typeof beds !== 'undefined' && beds[0] && !beds[0].gramas && !beds[0].horas) {
    beds[0].gramas = 50; beds[0].horas = 2.5;
    renderBeds();
  }
  calcular();
  document.getElementById('starterBanner').hidden = true;
  toast('Valores típicos aplicados. Ajuste para a sua realidade.');
}

// ── Tooltips (funcionam com toque e com mouse) ────────────────
function initTooltips() {
  let aberto = null;
  const fechar = () => {
    document.getElementById('_tt')?.remove();
    aberto?.setAttribute('aria-expanded', 'false');
    aberto = null;
  };
  const abrir = icon => {
    fechar();
    const tt = document.createElement('div');
    tt.id = '_tt';
    tt.className = 'tooltip';
    tt.textContent = icon.dataset.tip;
    document.body.appendChild(tt);
    const r = icon.getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left - 12, window.innerWidth - tt.offsetWidth - 12));
    tt.style.top = `${r.bottom + 8 + window.scrollY}px`;
    tt.style.left = `${left + window.scrollX}px`;
    icon.setAttribute('aria-expanded', 'true');
    aberto = icon;
  };
  document.addEventListener('click', e => {
    const icon = e.target.closest('.tip');
    if (icon) { e.preventDefault(); aberto === icon ? fechar() : abrir(icon); return; }
    if (!e.target.closest('.tooltip')) fechar();
  });
  document.addEventListener('mouseover', e => {
    const icon = e.target.closest('.tip');
    if (icon && matchMedia('(hover: hover)').matches && aberto !== icon) abrir(icon);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('.tip') && matchMedia('(hover: hover)').matches) fechar();
  });
  window.addEventListener('scroll', fechar, { passive: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
}

// ══════════════════════════════════════════════════════════════
// CÁLCULO PRINCIPAL
// ══════════════════════════════════════════════════════════════
function calcular() {
  const precoKg   = parseInputNum('precoKg');
  const kwh       = parseInputNum('kwh');
  const embalagem = parseInputNum('embalagem');
  const laborH    = parseInputNum('laborHours');
  const laborRate = parseInputNum('laborRate');
  const falhas    = parseInputNum('falhas');
  const margem    = parseInputNum('margem');
  const imposto   = Math.min(50, parseInputNum('imposto'));

  // Dados das mesas (cada mesa tem sua própria impressora)
  const { totalGramas, totalHoras, totalPurgeGramas, totalEnergia, totalMaquina, bedsDetalhe } = getBedTotals();

  // ── Componentes de custo ──────────────────────────────
  const custoFilamento = (totalGramas / 1000) * precoKg;      // material que vira produto
  const custoPurga     = (totalPurgeGramas / 1000) * precoKg; // desperdício na troca de cor
  const custoEnergia   = totalEnergia * kwh;                  // kWh por mesa × tarifa
  const custoMaquina   = totalMaquina;                        // depreciação + manutenção
  const custoMaoDeObra = laborH * laborRate;                  // seu tempo de trabalho
  const custoEmbalagem = embalagem;

  // ── Subtotal e falhas ─────────────────────────────────
  const subtotal = custoFilamento + custoPurga + custoEnergia + custoMaquina + custoMaoDeObra + custoEmbalagem;
  // Se 10% falham, o custo das peças perdidas é distribuído entre as boas
  const custoFalha = subtotal * (falhas / 100);
  const custoTotal = subtotal + custoFalha;

  // ── Preço base: markup sobre o custo + imposto por fora ──
  // alvo = quanto você precisa receber limpo (custo + lucro desejado)
  const alvo       = custoTotal * (1 + margem / 100);
  const precoBase  = arredondar90(alvo / (1 - imposto / 100));
  const impostoValor = precoBase * (imposto / 100);
  const lucroValor = precoBase - impostoValor - custoTotal;

  window._calc = { custoFilamento, custoPurga, custoEnergia, custoMaquina, custoMaoDeObra, custoEmbalagem, subtotal, custoFalha, custoTotal, lucroValor, precoBase, alvo, imposto, impostoValor, falhas, margem, precoKg, kwh, laborH, laborRate, totalGramas, totalHoras, totalPurgeGramas, totalEnergia, bedsDetalhe };

  renderHero();
  renderCustos();
  renderVarejoLocal();
  renderMarketplace();
  if (typeof atualizarCiclo === 'function') atualizarCiclo();
  if (typeof atualizarInfoItem === 'function') atualizarInfoItem();
  agendarLogCalc();
}

// ── Destaque: preço, custo, lucro e composição ────────────────
const FATIAS = [
  ['custoFilamento', 'Filamento', '--c-filamento'],
  ['custoPurga', 'Purga', '--c-purga'],
  ['custoEnergia', 'Energia', '--c-energia'],
  ['custoMaquina', 'Máquina', '--c-maquina'],
  ['custoMaoDeObra', 'Mão de obra', '--c-mao'],
  ['custoEmbalagem', 'Embalagem', '--c-embalagem'],
  ['custoFalha', 'Falhas', '--c-falhas'],
];

// Lucro real de um preço: tira o imposto e o custo
function lucroDe(c, preco) { return preco * (1 - c.imposto / 100) - c.custoTotal; }

function precoDoModo(c) {
  if (modoAtual === 'atacado') {
    const desc = parseInputNum('atacadoDesconto');
    return { label: `Preço no atacado (−${fmtNum(desc)}%)`, preco: arredondar90(c.precoBase * (1 - desc / 100)) };
  }
  if (modoAtual === 'consignado') {
    const p = parseInputNum('consigPrecoUnit');
    if (p > 0) return { label: 'Você recebe por peça', preco: p };
  }
  return { label: 'Preço sugerido', preco: c.precoBase };
}

function renderHero() {
  const c = window._calc;
  const temDados = c.custoTotal > 0;
  const { label, preco } = precoDoModo(c);
  const lucro = lucroDe(c, preco);
  const pct = preco > 0 ? (lucro / preco) * 100 : 0;

  document.getElementById('heroLabel').textContent = label;
  const priceEl = document.getElementById('heroPrice');
  priceEl.textContent = fmt(temDados ? preco : 0);
  priceEl.classList.toggle('empty', !temDados);
  document.getElementById('heroPill').innerHTML = temDados ? pill(pct) : '';
  document.getElementById('heroSub').textContent = temDados
    ? `${fmtNum(c.margem)}% de lucro sobre o custo${c.imposto > 0 ? ` + ${fmtNum(c.imposto)}% de imposto` : ''}${modoAtual === 'varejo' ? '' : ` · varejo ${fmt(c.precoBase)}`}`
    : 'Preencha o peso e as horas da impressão para começar.';
  document.getElementById('heroCusto').textContent = temDados ? fmt(c.custoTotal) : '—';
  document.getElementById('heroLucro').textContent = temDados ? fmt(lucro) : '—';
  document.getElementById('heroMargem').textContent = temDados ? fmtPct(pct) : '—';

  const fatias = FATIAS.filter(([k]) => c[k] > 0);
  document.getElementById('costBar').innerHTML = temDados
    ? fatias.map(([k, nome, cor]) => `<i style="flex-grow:${c[k]};background:var(${cor})" title="${nome}: ${fmt(c[k])}"></i>`).join('')
    : '';
  document.getElementById('costLegend').innerHTML = temDados
    ? fatias.map(([k, nome, cor]) => `<span><span class="swatch" style="background:var(${cor})"></span>${nome} ${fmtPct((c[k] / c.custoTotal) * 100)}</span>`).join('')
    : '';

  document.getElementById('dockLabel').textContent = label;
  document.getElementById('dockPrice').textContent = fmt(temDados ? preco : 0);
  document.getElementById('priceDock').classList.toggle('on', temDados);
}

// ── Aba: Custos discriminados ─────────────────────────────────
function renderCustos() {
  const el = document.getElementById('rtab-custos');
  const c = window._calc;
  if (!el || !c) return;
  if (c.custoTotal <= 0) { el.innerHTML = emptyState('Informe o peso e as horas de cada mesa.'); return; }

  const kg = fmt(c.precoKg).replace('R$', 'R$ ').replace('  ', ' ');
  const rows = [
    ['Filamento', c.custoFilamento, `${fmtNum(c.totalGramas)} g × ${kg}/kg`, '--c-filamento'],
    c.custoPurga > 0 ? ['Purga (multicolor)', c.custoPurga, `${fmtNum(c.totalPurgeGramas)} g desperdiçados`, '--c-purga'] : null,
    ['Energia', c.custoEnergia, `${fmtNum(c.totalEnergia, 3)} kWh × R$ ${fmtNum(c.kwh, 2)}`, '--c-energia'],
    c.custoMaquina > 0 ? ['Desgaste da máquina', c.custoMaquina, 'Depreciação + manutenção por hora', '--c-maquina'] : null,
    c.custoMaoDeObra > 0 ? ['Mão de obra', c.custoMaoDeObra, `${fmtNum(c.laborH)} h × ${fmt(c.laborRate)}/h`, '--c-mao'] : null,
    c.custoEmbalagem > 0 ? ['Embalagem', c.custoEmbalagem, 'Por peça', '--c-embalagem'] : null,
    c.custoFalha > 0 ? [`Falhas (${fmtNum(c.falhas)}%)`, c.custoFalha, 'Prejuízo das que dão errado, dividido nas boas', '--c-falhas'] : null,
  ].filter(Boolean);

  el.innerHTML = `
    <div class="list">
      ${rows.map(([l, v, s, cor]) => listRow(l, fmt(v), s, '', `var(${cor})`)).join('')}
      ${listRow('Custo por peça', fmt(c.custoTotal), '', 'total')}
      ${c.imposto > 0 ? listRow(`Imposto (${fmtNum(c.imposto)}%)`, fmt(c.impostoValor), 'Sobre o preço de venda') : ''}
      ${listRow(`Preço com ${fmtNum(c.margem)}% de lucro`, fmt(c.precoBase), document.getElementById('arredondar')?.checked ? 'Arredondado para ,90' : '', 'strong-accent')}
    </div>
    <div class="note">
      ${c.totalGramas > 0 ? `Custo por grama: <strong>R$ ${(c.custoTotal / c.totalGramas).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</strong>` : ''}
      ${c.totalHoras > 0 ? ` · por hora de impressão: <strong>${fmt(c.custoTotal / c.totalHoras)}</strong>` : ''}
    </div>
    ${gerarResumoMesas()}
  `;
}

function gerarResumoMesas() {
  const c = window._calc;
  if (!c || c.bedsDetalhe.length <= 1) return '';
  return `
    <div class="sub-card">
      <span class="eyebrow">Por mesa (já dividido pelas peças)</span>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Mesa</th><th class="num">Peças</th><th class="num">g/peça</th><th class="num">h/peça</th><th class="num">Custo do lote</th></tr></thead>
        <tbody>
          ${c.bedsDetalhe.map(b => {
            const custoLote = ((b.watts / 1000) * b.horas * c.kwh) + (b.horas * b.custoHora) + (b.gramas / 1000) * c.precoKg;
            const nome = beds[b.idx]?.nomePeca || `Mesa ${b.idx + 1}`;
            return `<tr>
              <td class="truncate" title="${escapeHTML(b.impNome)}">${escapeHTML(nome)}</td>
              <td class="num">${b.pecas}</td>
              <td class="num">${fmtNum(b.gramasPorPeca)}</td>
              <td class="num">${fmtNum(b.horasPorPeca, 2)}</td>
              <td class="num">${fmt(custoLote)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>`;
}

// ── Aba: Venda direta / atacado / consignado ──────────────────
function renderVarejoLocal() {
  const el = document.getElementById('rtab-varejo-local');
  const c = window._calc;
  if (!el) return;
  if (!c || c.precoBase <= 0) { el.innerHTML = emptyState('Preencha os campos para ver os preços de venda.'); return; }

  const lucro = lucroDe(c, c.precoBase);
  const pct = c.precoBase > 0 ? (lucro / c.precoBase) * 100 : 0;

  let extra = '';
  if (modoAtual === 'atacado') extra = renderAtacadoHTML();
  if (modoAtual === 'consignado') extra = renderConsignadoHTML();

  el.innerHTML = `
    <div class="list">
      ${listRow('Venda direta', `${pill(pct)}`, 'WhatsApp, Instagram, feira, site próprio — sem taxas')}
      ${listRow('Preço de venda', fmt(c.precoBase), '', 'strong-accent')}
      ${listRow('Custo', fmt(c.custoTotal))}
      ${c.imposto > 0 ? listRow('Imposto', fmt(c.impostoValor)) : ''}
      ${listRow('Lucro por peça', fmt(lucro))}
      ${listRow('Margem sobre a venda', fmtPct(pct), `${fmtNum(c.margem)}% sobre o custo = ${fmtPct(pct)} do preço final`)}
    </div>
    ${extra}
  `;
}

function renderAtacadoHTML() {
  const c = window._calc;
  const qtd = parseInputNum('atacadoQtd') || 10;
  const desconto = parseInputNum('atacadoDesconto');
  const precoAt = arredondar90(c.precoBase * (1 - desconto / 100));
  const lucro = lucroDe(c, precoAt);
  const pct = precoAt > 0 ? (lucro / precoAt) * 100 : 0;
  return `
    <div class="sub-card">
      <span class="eyebrow">Atacado · ${fmtNum(desconto)}% de desconto</span>
      <div class="list">
        ${listRow('Preço no atacado', fmt(precoAt), `Varejo ${fmt(c.precoBase)}`, 'strong-accent')}
        ${listRow('Lucro por peça', fmt(lucro), '', '')}
        ${listRow(`Lucro no pedido de ${qtd} un.`, fmt(lucro * qtd))}
        ${listRow('Situação', pill(pct))}
      </div>
    </div>`;
}

function renderConsignadoHTML() {
  const c = window._calc;
  const precoUnit = parseInputNum('consigPrecoUnit');
  const qtd = parseInputNum('consigQtd') || 10;
  const prazo = parseInputNum('consigPrazo') || 30;

  if (!precoUnit) {
    return `<div class="note">Informe quanto você recebe por peça no consignado para ver o resultado.</div>`;
  }

  const lucroUnit = lucroDe(c, precoUnit);
  const pct = (lucroUnit / precoUnit) * 100;
  const dataAcerto = new Date();
  dataAcerto.setDate(dataAcerto.getDate() + prazo);
  const dataFmt = dataAcerto.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return `
    <div class="sub-card">
      <span class="eyebrow">Consignado · ${qtd} peças por ${prazo} dias</span>
      <div class="list">
        ${listRow('Você recebe por peça', fmt(precoUnit), '', 'strong-accent')}
        ${listRow('Lucro por peça', fmt(lucroUnit), '', '')}
        ${listRow('Se vender tudo', fmt(precoUnit * qtd), `Lucro de ${fmt(lucroUnit * qtd)}`)}
        ${listRow('Custo do lote entregue', fmt(c.custoTotal * qtd))}
        ${listRow('Data do acerto', dataFmt)}
        ${listRow('Situação', pill(pct))}
      </div>
    </div>`;
}

// ── Aba: Marketplaces ─────────────────────────────────────────
function renderMarketplace() {
  const el = document.getElementById('rtab-marketplace');
  const c = window._calc;
  if (!el) return;
  if (!c || c.precoBase <= 0) { el.innerHTML = emptyState('Preencha os campos para ver os preços em cada marketplace.'); return; }

  // Se o editor de taxas estiver aberto e em uso, só atualiza a lista (não perde o foco)
  const aberto = el.querySelector('details')?.open;
  if (aberto && el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') {
    atualizarLinhasMarketplace();
    return;
  }

  const faixaLabel = (mp, i) => {
    if (mp.faixas.length === 1) return 'Qualquer preço';
    const de = i === 0 ? 0 : mp.faixas[i - 1].ate;
    const ate = mp.faixas[i].ate;
    if (ate === Infinity) return `A partir de R$ ${fmtNum(de, 0)}`;
    return i === 0 ? `Até R$ ${fmtNum(ate - 0.01, 2)}` : `R$ ${fmtNum(de, 0)} a ${fmtNum(ate - 0.01, 2)}`;
  };

  el.innerHTML = `
    <p class="hint" style="margin:8px 0 4px">Preço do anúncio para você receber o mesmo lucro da venda direta, já descontando taxas${c.imposto > 0 ? ' e imposto' : ''}.</p>
    <div class="list" id="mpRows"></div>
    <details class="disclosure" ${aberto ? 'open' : ''}>
      <summary>Ver e editar taxas</summary>
      <p class="hint" style="margin-top:8px">Taxas para vendedor CNPJ, revisadas em ${TAXAS_ATUALIZADAS_EM}. A comissão varia por categoria — confira no painel do vendedor e ajuste aqui.</p>
      ${taxasEditaveis.map((m, mi) => `
        <div class="fee-block">
          <div class="fee-title"><strong>${escapeHTML(m.nome)}</strong><span class="hint">${escapeHTML(m.obs || '')}</span></div>
          <div class="fee-grid">
            <span class="fh">Faixa de preço</span><span class="fh" style="text-align:right">Comissão %</span><span class="fh" style="text-align:right">Fixa R$</span>
            ${m.faixas.map((f, fi) => `
              <span class="small">${faixaLabel(m, fi)}</span>
              <input type="text" inputmode="decimal" value="${String(f.comissao).replace('.', ',')}" data-mp="${mi}" data-faixa="${fi}" data-field="comissao" aria-label="Comissão ${escapeHTML(m.nome)} ${faixaLabel(m, fi)}">
              <input type="text" inputmode="decimal" value="${f.taxaFixa.toFixed(2).replace('.', ',')}" data-mp="${mi}" data-faixa="${fi}" data-field="taxaFixa" aria-label="Taxa fixa ${escapeHTML(m.nome)} ${faixaLabel(m, fi)}">
            `).join('')}
          </div>
        </div>`).join('')}
    </details>`;

  el.querySelector('details').addEventListener('input', e => {
    const { mp, faixa, field } = e.target.dataset;
    if (mp === undefined) return;
    taxasEditaveis[mp].faixas[faixa][field] = parseFloat(String(e.target.value).replace(',', '.')) || 0;
    atualizarLinhasMarketplace();
  });
  atualizarLinhasMarketplace();
}

function atualizarLinhasMarketplace() {
  const c = window._calc;
  const wrap = document.getElementById('mpRows');
  if (!wrap || !c) return;

  const linhas = taxasEditaveis
    .map(mp => ({ mp, ...precoMarketplace(mp, c.alvo, c.imposto) }))
    .filter(l => isFinite(l.preco))
    .sort((a, b) => a.preco - b.preco);

  wrap.innerHTML = linhas.map((l, i) => {
    const lucro = lucroDe(c, l.preco) - l.taxa;
    const pct = l.preco > 0 ? (lucro / l.preco) * 100 : 0;
    const idxFaixa = l.mp.faixas.indexOf(l.faixa);
    const degrau = idxFaixa > 0 && l.mp.faixas.length > 1
      ? ` · passou de R$ ${fmtNum(l.mp.faixas[idxFaixa - 1].ate, 0)}, taxa fixa ${fmt(l.faixa.taxaFixa)}`
      : '';
    return `<div class="mp-row">
      <div class="mp-name">
        <strong>${escapeHTML(l.mp.nome)}${i === 0 ? ' <span class="pill neutral" style="margin-left:4px">Menor preço</span>' : ''}</strong>
        <span>${fmtNum(l.faixa.comissao)}% + ${fmt(l.faixa.taxaFixa)} = taxa ${fmt(l.taxa)} · lucro ${fmt(lucro)}${degrau}</span>
      </div>
      <div class="mp-price"><strong>${fmt(l.preco)}</strong>${pill(pct)}</div>
    </div>`;
  }).join('');
}

// ── Registro de cálculos (alimenta o dashboard do admin) ──────
// Grava só quando o resultado muda de verdade e o usuário para de digitar.
let calcLogTimer = null;
let ultimoLog = '';
function agendarLogCalc() {
  clearTimeout(calcLogTimer);
  calcLogTimer = setTimeout(salvarLogCalc, 6000);
}
async function salvarLogCalc() {
  const c = window._calc;
  if (!c || c.custoTotal <= 0 || !window.currentUser) return;
  const nome = document.getElementById('nomeProduto')?.value || '';
  const assinatura = [nome, c.custoTotal.toFixed(2), c.precoBase.toFixed(2)].join('|');
  if (assinatura === ultimoLog) return;
  ultimoLog = assinatura;
  fetch('/api/calc-log', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome_produto: nome,
      dados: {
        custoTotal: +c.custoTotal.toFixed(2), precoBase: +c.precoBase.toFixed(2), lucroValor: +c.lucroValor.toFixed(2),
        margem: c.margem, modo: modoAtual, totalGramas: c.totalGramas, totalHoras: c.totalHoras,
        mesas: beds.map(b => ({ nome: b.nomePeca, horas: b.horas, gramas: b.gramas, pecas: b.pecas })),
      },
    }),
  }).catch(() => {});
}

// ── Inicialização ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderFilamentoSelector();
  popularEstados();
  initResultTabs();
  initModos();
  initMargem();
  initTooltips();

  document.getElementById('modoInicianteBtn')?.addEventListener('click', aplicarValoresTipicos);

  // Qualquer campo fixo do formulário recalcula (as mesas cuidam dos próprios campos)
  document.getElementById('formCol').addEventListener('input', e => {
    if (e.target.closest('#bedsContainer')) return;
    calcular();
  });
  document.getElementById('arredondar')?.addEventListener('change', calcular);

  document.getElementById('dockBtn')?.addEventListener('click', () => {
    document.getElementById('summary').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  calcular();
});
