// ── Utilitários ───────────────────────────────────────────────
let modoAtual = 'varejo';

function fmt(v) {
  if (isNaN(v) || v === null || v === undefined) return 'R$ —';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtPct(v) { return isNaN(v) ? '—' : v.toFixed(1) + '%'; }
function badge(ok) {
  return `<span class="badge ${ok ? 'ok' : 'nok'}">${ok ? '✅ Compensa' : '❌ Não compensa'}</span>`;
}

// ── Seletor de filamentos ─────────────────────────────────────
function renderFilamentoSelector() {
  const container = document.getElementById('filamentoSelector');
  if (!container || !window.FILAMENTOS) return;
  FILAMENTOS.forEach(fil => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filamento-btn';
    btn.dataset.id = fil.id;
    btn.title = `${fil.dica}\nFaixa: R$${fil.precoMin}–${fil.precoMax}/kg`;
    btn.innerHTML = `<span class="fil-dot" style="background:${fil.cor}"></span>${fil.nome.split('/')[0].trim()}`;
    btn.addEventListener('click', () => selecionarFilamento(fil.id));
    container.appendChild(btn);
  });
}

function selecionarFilamento(id) {
  document.querySelectorAll('.filamento-btn').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  const fil = FILAMENTOS.find(f => f.id === id);
  if (!fil) return;
  const input = document.getElementById('precoKg');
  input.value = fil.precoBR;
  const hint = document.getElementById('precoKgHint');
  if (hint) hint.textContent = `Faixa 2026: R$${fil.precoMin}–${fil.precoMax}/kg • ${fil.exemplos}`;
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
      opt.textContent = `${d.nome} (${uf})`;
      if (uf === 'SP') opt.selected = true;
      sel.appendChild(opt);
    });
  sel.addEventListener('change', () => {
    const kwhEl = document.getElementById('kwh');
    if (!kwhEl.dataset.manual) kwhEl.value = ENERGIA_ESTADOS[sel.value].kwh;
    calcular();
  });
  document.getElementById('kwh').value = ENERGIA_ESTADOS['SP'].kwh;
  document.getElementById('kwh').addEventListener('input', e => {
    e.target.dataset.manual = e.target.value ? '1' : '';
    calcular();
  });
}

// ── Fee Editor ────────────────────────────────────────────────
let taxasEditaveis = [];

function renderFeeEditor() {
  taxasEditaveis = MARKETPLACES.map(m => ({ ...m }));
  const container = document.getElementById('feeEditor');
  if (!container) return;
  container.innerHTML = '';
  taxasEditaveis.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'fee-row';
    row.innerHTML = `
      <span title="${m.nome}">${m.nome}</span>
      <input type="number" value="${m.comissao}" min="0" max="100" step="0.1" data-idx="${idx}" data-field="comissao">
      <input type="number" value="${m.taxaFixa.toFixed(2)}" min="0" step="0.01" data-idx="${idx}" data-field="taxaFixa">
    `;
    container.appendChild(row);
  });
  container.addEventListener('input', e => {
    const { idx, field } = e.target.dataset;
    if (idx === undefined) return;
    taxasEditaveis[idx][field] = parseFloat(e.target.value) || 0;
    calcular();
  });
}

// ── Tabs de resultado ─────────────────────────────────────────
function initResultTabs() {
  document.querySelectorAll('.results-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.results-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.rtab-panel').forEach(p => p.style.display = 'none');
      btn.classList.add('active');
      document.getElementById(`rtab-${btn.dataset.rtab}`).style.display = 'block';
    });
  });
}

// ── Modo de venda ─────────────────────────────────────────────
function initModos() {
  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      modoAtual = btn.dataset.mode;
      document.getElementById('mode-atacado').style.display    = modoAtual === 'atacado'    ? 'block' : 'none';
      document.getElementById('mode-consignado').style.display = modoAtual === 'consignado' ? 'block' : 'none';
      calcular();
    });
  });
}

// ── Modo Iniciante ────────────────────────────────────────────
function initModoIniciante() {
  document.getElementById('modoInicianteBtn')?.addEventListener('click', () => {
    selecionarFilamento('pla_basico');
    if (!document.getElementById('embalagem').value) document.getElementById('embalagem').value = 3.50;
    if (!document.getElementById('laborHours').value) document.getElementById('laborHours').value = 0.5;
    if (!document.getElementById('laborRate').value) document.getElementById('laborRate').value = 20;
    document.getElementById('falhas').value = 10;
    document.getElementById('margem').value = 40;

    const btn = document.getElementById('modoInicianteBtn');
    btn.textContent = '✅ Valores de mercado aplicados!';
    btn.style.color = 'var(--success)';
    btn.style.borderColor = 'var(--success)';
    setTimeout(() => {
      btn.textContent = '✨ Preencher com valores de mercado';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2500);
    calcular();
  });
}

// ── Tooltips ──────────────────────────────────────────────────
function initTooltips() {
  document.querySelectorAll('.tip-icon').forEach(icon => {
    icon.addEventListener('mouseenter', e => {
      let tt = document.getElementById('_tt');
      if (!tt) { tt = document.createElement('div'); tt.id = '_tt'; tt.className = 'tooltip-box'; document.body.appendChild(tt); }
      tt.textContent = icon.dataset.tip;
      const r = icon.getBoundingClientRect();
      tt.style.cssText = `display:block;top:${r.bottom + 8 + window.scrollY}px;left:${Math.min(r.left, window.innerWidth - 265)}px`;
    });
    icon.addEventListener('mouseleave', () => { const tt = document.getElementById('_tt'); if (tt) tt.style.display = 'none'; });
  });
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

  // Dados das mesas (cada mesa tem sua própria impressora)
  const { totalGramas, totalHoras, totalPurgeGramas, totalEnergia, totalMaquina, bedsDetalhe } = getBedTotals();

  // ── Componentes de custo ──────────────────────────────
  // Filamento: apenas o material que vira produto
  const custoFilamento = (totalGramas / 1000) * precoKg;

  // Purga: material desperdiçado na troca de cor (multicolor)
  const custoPurga = (totalPurgeGramas / 1000) * precoKg;

  // Energia: calculada por mesa com o watt da impressora daquela mesa
  const custoEnergia = totalEnergia * kwh;

  // Hora-máquina: depreciação + manutenção por impressora de cada mesa
  // (totalMaquina já vem calculado por cama em beds.js)
  const custoMaquina = totalMaquina;

  // Mão de obra: seu tempo de trabalho (não a hora de impressão)
  const custoMaoDeObra = laborH * laborRate;

  // Embalagem: custo fixo por peça
  const custoEmbalagem = embalagem;

  // ── Subtotal e falhas ─────────────────────────────────
  const subtotal = custoFilamento + custoPurga + custoEnergia + custoMaquina + custoMaoDeObra + custoEmbalagem;

  // Falhas: quando uma peça falha você perde TODO o custo dela.
  // Fórmula: se 10% falham, para cada 10 peças tentadas, 1 falha.
  // Então o custo real por peça boa = custo / (1 - falha%)
  // Equivalente a adicionar custo × falha% ao subtotal.
  const custoFalha = subtotal * (falhas / 100);
  const custoTotal = subtotal + custoFalha;

  // ── Preço base ────────────────────────────────────────
  // Markup sobre custo: base = custo × (1 + margem%)
  const lucroValor = custoTotal * (margem / 100);
  const precoBase  = custoTotal + lucroValor;

  // ── Guardar para outras funções ───────────────────────
  window._calc = { custoFilamento, custoPurga, custoEnergia, custoMaquina, custoMaoDeObra, custoEmbalagem, subtotal, custoFalha, custoTotal, lucroValor, precoBase, falhas, margem, precoKg, kwh, laborH, laborRate, totalGramas, totalHoras, totalPurgeGramas, totalEnergia, bedsDetalhe };

  renderCustos();
  renderVarejoLocal();
  renderMarketplace();
  if (typeof atualizarCiclo === 'function') atualizarCiclo();
}

// ── Aba: Custos discriminados ─────────────────────────────────
function renderCustos() {
  const el = document.getElementById('rtab-custos');
  if (!el) return;
  const c = window._calc;
  if (!c) return;

  const rows = [
    ['🧵 Filamento', c.custoFilamento, `${c.totalGramas.toFixed(0)}g × R$${parseFloat(document.getElementById('precoKg').value||0).toFixed(2)}/kg`],
    c.custoPurga > 0 ? ['🎨 Purga (multicolor)', c.custoPurga, `${c.totalPurgeGramas.toFixed(1)}g × R$${parseFloat(document.getElementById('precoKg').value||0).toFixed(2)}/kg`] : null,
    ['⚡ Energia elétrica', c.custoEnergia, gerarDetalheEnergia()],
    c.custoMaquina > 0 ? ['🖨️ Hora-máquina', c.custoMaquina, gerarDetalheMaquina()] : null,
    c.custoMaoDeObra > 0 ? ['👤 Mão de obra', c.custoMaoDeObra, `${c.laborH}h × R$${c.laborRate}/h`] : null,
    c.custoEmbalagem > 0 ? ['📦 Embalagem', c.custoEmbalagem, 'custo por peça'] : null,
  ].filter(Boolean);

  el.innerHTML = `
    <table class="cost-table">
      <thead><tr><th>Item</th><th>Valor</th><th>Detalhamento</th></tr></thead>
      <tbody>
        ${rows.map(([item, val, det]) => `<tr><td>${item}</td><td class="price">${fmt(val)}</td><td class="detail">${det}</td></tr>`).join('')}
        <tr class="subtotal-row"><td><strong>Subtotal</strong></td><td class="price"><strong>${fmt(c.subtotal)}</strong></td><td></td></tr>
        ${c.falhas > 0 ? `<tr><td>⚠️ Falhas (${c.falhas}%)</td><td class="price">+ ${fmt(c.custoFalha)}</td><td class="detail">Custo das peças que falham distribuído nas boas</td></tr>` : ''}
      </tbody>
    </table>
    <div class="cost-totals">
      <div class="cost-total-item"><span>Custo total de produção (por peça)</span><strong>${fmt(c.custoTotal)}</strong></div>
      <div class="cost-total-item accent"><span>Preço base com ${c.margem}% de lucro sobre custo</span><strong>${fmt(c.precoBase)}</strong></div>
      <div class="cost-total-item muted"><span>Lucro por peça</span><strong>${fmt(c.lucroValor)}</strong></div>
      ${c.totalGramas > 0 ? `<div class="cost-total-item muted"><span>Custo por grama (material final)</span><strong>R$ ${(c.custoTotal/c.totalGramas).toFixed(4)}/g</strong></div>` : ''}
      ${c.totalHoras > 0 ? `<div class="cost-total-item muted"><span>Custo total por hora de impressão</span><strong>R$ ${(c.custoTotal/c.totalHoras).toFixed(2)}/h</strong></div>` : ''}
    </div>
    ${gerarResumoMesas()}
  `;
}

function gerarDetalheEnergia() {
  const c = window._calc;
  if (!c || !c.bedsDetalhe.length) return '—';
  return c.bedsDetalhe
    .filter(b => b.horas > 0 && b.watts > 0)
    .map(b => `Mesa #${b.idx+1}: ${b.watts}W × ${b.horas}h = ${((b.watts/1000)*b.horas).toFixed(3)} kWh`)
    .join(' | ') + ` × R$${parseFloat(document.getElementById('kwh').value||0).toFixed(2)}/kWh`;
}

function gerarDetalheMaquina() {
  const c = window._calc;
  if (!c || !c.bedsDetalhe.length) return '—';
  return c.bedsDetalhe
    .filter(b => b.horas > 0 && b.custoHora > 0)
    .map(b => `Mesa #${b.idx+1}: R$${b.custoHora.toFixed(3)}/h × ${b.horas}h`)
    .join(' | ');
}

function gerarResumoMesas() {
  const c = window._calc;
  if (!c || c.bedsDetalhe.length <= 1) return '';
  return `
    <div style="padding:0.75rem 1.25rem;border-top:1px solid var(--border)">
      <div class="card-title" style="margin-bottom:0.5rem">🛏️ Detalhe por mesa (custo já dividido por peças)</div>
      <table class="cost-table">
        <thead><tr><th>Mesa</th><th>Impressora</th><th>Lote</th><th>Peças</th><th>g/peça</th><th>h/peça</th><th>Custo lote</th></tr></thead>
        <tbody>
          ${c.bedsDetalhe.map(b => {
            const kwh = parseFloat(document.getElementById('kwh')?.value || 0);
            const custoLote = ((b.watts/1000)*b.horas*kwh) + (b.horas*b.custoHora);
            return `
              <tr>
                <td>#${b.idx+1}</td>
                <td class="detail">${b.impNome}</td>
                <td>${b.gramas}g / ${b.horas}h</td>
                <td style="font-weight:700;color:var(--accent)">${b.pecas}</td>
                <td>${b.gramasPorPeca.toFixed(1)}g</td>
                <td>${b.horasPorPeca.toFixed(2)}h</td>
                <td>${fmt(custoLote)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Aba: Varejo Local ─────────────────────────────────────────
function renderVarejoLocal() {
  const el = document.getElementById('rtab-varejo-local');
  if (!el) return;
  const c = window._calc;
  if (!c || c.precoBase <= 0) { el.innerHTML = '<div class="empty-state"><div class="icon">🏪</div>Preencha os campos para ver o resultado</div>'; return; }

  const lucro    = c.precoBase - c.custoTotal;
  // Lucro % calculado sobre o preço de venda (métrica padrão de varejo)
  const lucroPct = c.precoBase > 0 ? (lucro / c.precoBase) * 100 : 0;
  const compensa = lucroPct >= 20;

  let extraHTML = '';
  if (modoAtual === 'atacado') extraHTML = renderAtacadoHTML();
  if (modoAtual === 'consignado') extraHTML = renderConsignadoHTML();

  el.innerHTML = `
    <div class="varejo-local-card">
      <div class="vl-row">
        <div class="vl-item"><label>Custo de produção</label><div class="vl-value muted">${fmt(c.custoTotal)}</div></div>
        <div class="vl-item"><label>Preço de venda sugerido</label><div class="vl-value accent">${fmt(c.precoBase)}</div></div>
        <div class="vl-item"><label>Lucro por peça</label><div class="vl-value">${fmt(lucro)}</div></div>
        <div class="vl-item"><label>Margem sobre venda</label><div class="vl-value">${fmtPct(lucroPct)}</div></div>
      </div>
      <div class="vl-badge">${badge(compensa)}</div>
      <div class="vl-breakdown">
        <p>💡 <strong>Venda local, WhatsApp, Instagram, site próprio</strong> — sem taxa de plataforma.</p>
        <p>Você configurou <strong>${c.margem}% de lucro sobre o custo</strong>, que resulta em <strong>${fmtPct(lucroPct)} de margem</strong> sobre o preço final.</p>
      </div>
    </div>
    ${extraHTML}
  `;
}

function renderAtacadoHTML() {
  const c = window._calc;
  const qtd      = parseFloat(document.getElementById('atacadoQtd')?.value) || 10;
  const desconto = parseFloat(document.getElementById('atacadoDesconto')?.value) || 0;
  const precoAt  = c.precoBase * (1 - desconto / 100);
  const lucro    = precoAt - c.custoTotal;
  const lucroPct = precoAt > 0 ? (lucro / precoAt) * 100 : 0;
  const compensa = lucroPct >= 20;
  return `
    <div class="atacado-result-card">
      <div class="card-title">📦 Atacado — ${desconto}% de desconto</div>
      <div class="vl-row">
        <div class="vl-item"><label>Preço varejo</label><div class="vl-value muted">${fmt(c.precoBase)}</div></div>
        <div class="vl-item"><label>Preço atacado</label><div class="vl-value accent">${fmt(precoAt)}</div></div>
        <div class="vl-item"><label>Lucro unitário</label><div class="vl-value">${fmt(lucro)}</div></div>
        <div class="vl-item"><label>Lucro pedido (${qtd} un.)</label><div class="vl-value">${fmt(lucro * qtd)}</div></div>
      </div>
      <div class="vl-badge">${badge(compensa)}</div>
    </div>`;
}

function renderConsignadoHTML() {
  const c = window._calc;
  const precoUnit = parseFloat(document.getElementById('consigPrecoUnit')?.value) || 0;
  const qtd       = parseFloat(document.getElementById('consigQtd')?.value)       || 10;
  const prazo     = parseFloat(document.getElementById('consigPrazo')?.value)     || 30;

  if (!precoUnit) return `
    <div class="atacado-result-card">
      <div class="card-title">🤝 Consignado</div>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-top:0.5rem">
        Informe o valor que você cobra por unidade entregue ao revendedor.
      </p>
    </div>`;

  const lucroUnit    = precoUnit - c.custoTotal;
  const lucroTotal   = lucroUnit * qtd;
  const lucroPct     = precoUnit > 0 ? (lucroUnit / precoUnit) * 100 : 0;
  const compensa     = lucroPct >= 20;

  // Data de acerto
  const dataAcerto = new Date();
  dataAcerto.setDate(dataAcerto.getDate() + prazo);
  const dataFmt = dataAcerto.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return `
    <div class="atacado-result-card">
      <div class="card-title">🤝 Consignado — ${qtd} peças por ${prazo} dias</div>
      <div class="vl-row" style="grid-template-columns:repeat(3,1fr)">
        <div class="vl-item"><label>Você recebe por peça</label><div class="vl-value accent">${fmt(precoUnit)}</div></div>
        <div class="vl-item"><label>Lucro por peça</label><div class="vl-value">${fmt(lucroUnit)}</div></div>
        <div class="vl-item"><label>Se vender tudo</label><div class="vl-value">${fmt(lucroTotal)} lucro</div></div>
      </div>
      <div class="vl-badge">${badge(compensa)}</div>
      <div class="consig-info">
        <div class="consig-row">
          <span>📅 Data limite para acerto</span>
          <strong>${dataFmt}</strong>
        </div>
        <div class="consig-row">
          <span>💰 Total a receber se vender tudo</span>
          <strong>${fmt(precoUnit * qtd)}</strong>
        </div>
        <div class="consig-row">
          <span>📦 Custo do lote inteiro repassado</span>
          <strong>${fmt(c.custoTotal * qtd)}</strong>
        </div>
        <div class="consig-row muted">
          <span>O revendedor devolve o que não vendeu até ${dataFmt} e acerta o pagamento das peças vendidas</span>
        </div>
      </div>
    </div>`;
}

// ── Aba: Marketplace ──────────────────────────────────────────
function renderMarketplace() {
  const el = document.getElementById('rtab-marketplace');
  if (!el) return;
  const c = window._calc;
  if (!c || c.precoBase <= 0) { el.innerHTML = '<div class="empty-state"><div class="icon">🛒</div>Preencha os campos para ver os preços</div>'; return; }

  const rows = taxasEditaveis.map(mp => {
    // Preço sugerido: garante que após a taxa o vendedor recebe o precoBase
    const precoSugerido = (c.precoBase + mp.taxaFixa) / (1 - mp.comissao / 100);
    const taxaCobrada   = precoSugerido * (mp.comissao / 100) + mp.taxaFixa;
    const recebido      = precoSugerido - taxaCobrada;
    const lucro         = recebido - c.custoTotal;
    // Margem calculada sobre o preço de venda (padrão de mercado)
    const lucroPct      = precoSugerido > 0 ? (lucro / precoSugerido) * 100 : 0;
    const compensa      = lucroPct >= 20;
    return `<tr>
      <td>${mp.nome}</td>
      <td class="price">${fmt(precoSugerido)}</td>
      <td class="detail">${fmt(taxaCobrada)}</td>
      <td>${fmt(lucro)}</td>
      <td>${fmtPct(lucroPct)}</td>
      <td>${badge(compensa)}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <table>
      <thead><tr><th>Marketplace</th><th>Preço sugerido</th><th>Taxa cobrada</th><th>Lucro R$</th><th>Lucro %</th><th>Compensa?</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="padding:1rem 1.25rem;border-top:1px solid var(--border)">
      <div class="card-title" style="margin-bottom:0.5rem">⚙️ Editar taxas</div>
      <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.75rem">Valores padrão de 2026 — ajuste se necessário</p>
      <div class="fee-header"><span>Marketplace</span><span style="text-align:center">Comissão %</span><span style="text-align:center">Taxa fixa R$</span></div>
      <div id="feeEditor"></div>
    </div>
  `;
  renderFeeEditor();
}

// ── Vírgula como separador decimal ────────────────────────────
// Converte vírgula para ponto em TODOS os inputs (number e text)
function initVirgula() {
  document.addEventListener('keydown', e => {
    if (e.key !== ',') return;
    const el = e.target;
    if (el.tagName !== 'INPUT') return;
    e.preventDefault();
    const s = el.selectionStart, en = el.selectionEnd;
    if (el.value.includes('.')) return; // já tem ponto
    el.value = el.value.slice(0, s) + '.' + el.value.slice(en);
    el.setSelectionRange(s + 1, s + 1);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
}

// Lê valor de input aceitando vírgula ou ponto
function parseInputNum(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(String(el.value).replace(',', '.')) || 0;
}

// ── Inicialização ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initVirgula();
  renderFilamentoSelector();
  popularEstados();
  initResultTabs();
  initModos();
  initModoIniciante();
  renderFeeEditor();
  initTooltips();

  document.querySelectorAll('input[type=number], input[type=text]').forEach(el => {
    el.addEventListener('input', calcular);
  });

  // Nome do produto atualiza o ciclo
  document.getElementById('nomeProduto')?.addEventListener('input', () => {
    if (typeof atualizarCiclo === 'function') atualizarCiclo();
  });

  calcular();
});
