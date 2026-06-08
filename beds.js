// Converte string com vírgula ou ponto para número
function parseNum(v) { return parseFloat(String(v).replace(',', '.')) || 0; }

// Mesas de impressão — cada mesa tem sua própria impressora
let beds = [];
let bedCounter = 0;

function addBed(data = {}) {
  bedCounter++;
  const defaultPrinter = IMPRESSORAS.find(i => i.id !== 'custom') || IMPRESSORAS[0];
  beds.push({
    id: bedCounter,
    nomePeca: data.nomePeca || '',
    impressoraId: data.impressoraId || defaultPrinter.id,
    gramas: data.gramas || 0,
    horas: data.horas || 0,
    pecas: data.pecas || 1,
    colors: data.colors || 1,
    purgePerChange: data.purgePerChange || 5,
    purgeTower: data.purgeTower || 0
  });
  renderBeds();
}

function removeBed(id) {
  if (beds.length <= 1) return;
  beds = beds.filter(b => b.id !== id);
  renderBeds();
}

function setBedColors(id, colors) {
  const bed = beds.find(b => b.id === id);
  if (!bed) return;
  bed.colors = colors;
  renderBeds();
}

function setBedImpressora(id, impressoraId) {
  const bed = beds.find(b => b.id === id);
  if (!bed) return;
  bed.impressoraId = impressoraId;
  if (typeof calcular === 'function') calcular();
}

function renderBeds() {
  const container = document.getElementById('bedsContainer');
  if (!container) return;
  container.innerHTML = '';

  beds.forEach((bed, idx) => {
    const imp = IMPRESSORAS.find(i => i.id === bed.impressoraId) || IMPRESSORAS[0];
    const custoHora = imp.precoBR > 0
      ? ((imp.precoBR / imp.vidaUtilH) + (imp.manutencaoMes / 160)).toFixed(3)
      : '—';

    const div = document.createElement('div');
    div.className = 'bed-card';
    div.innerHTML = `
      <div class="bed-header">
        <span class="bed-label">Mesa #${idx + 1}${bed.nomePeca ? ` — ${bed.nomePeca}` : ''}</span>
        ${beds.length > 1 ? `<button class="bed-remove" onclick="removeBed(${bed.id})">✕ remover</button>` : ''}
      </div>

      <div class="field">
        <label>Nome desta peça / parte</label>
        <input type="text" class="bed-nomepeca" value="${bed.nomePeca}" placeholder="Ex: Corpo da caixa, Tampa, Fecho...">
      </div>

      <div class="field">
        <label>Impressora desta mesa</label>
        <select class="bed-impressora-sel" data-bed="${bed.id}">
          ${IMPRESSORAS.filter(i => i.id !== 'custom').map(i =>
            `<option value="${i.id}" ${i.id === bed.impressoraId ? 'selected' : ''}>${i.nome} (~${i.watts}W)</option>`
          ).join('')}
        </select>
        ${imp.precoBR > 0 ? `<span class="field-hint" style="color:var(--accent)">Custo hora-máquina: R$ ${custoHora}/h (dep. R$${(imp.precoBR/imp.vidaUtilH).toFixed(3)} + manut. R$${(imp.manutencaoMes/160).toFixed(3)})</span>` : ''}
      </div>

      <div class="bed-row" style="grid-template-columns:1fr 1fr 1fr">
        <div class="field">
          <label>Filamento (g)</label>
          <input type="text" inputmode="decimal" class="bed-gramas" value="${bed.gramas || ''}" placeholder="150">
        </div>
        <div class="field">
          <label>Horas de impressão</label>
          <input type="text" inputmode="decimal" class="bed-horas" value="${bed.horas || ''}" placeholder="4.5">
        </div>
        <div class="field">
          <label>Peças nesta mesa</label>
          <input type="text" inputmode="numeric" class="bed-pecas" value="${bed.pecas || 1}" placeholder="1">
          <span class="field-hint bed-pecas-hint" style="color:${bed.pecas > 1 ? 'var(--accent)' : 'transparent'}">
            ÷ ${bed.pecas} = ${bed.gramas > 0 && bed.pecas > 1 ? (bed.gramas / bed.pecas).toFixed(1) + 'g/peça' : '—'}
          </span>
        </div>
      </div>

      <div class="field">
        <label>Cores (AMS/multicolor)</label>
        <div class="color-btns">
          ${[1,2,3,4].map(c => `<button class="color-btn${bed.colors === c ? ' active' : ''}" onclick="setBedColors(${bed.id}, ${c})">${c}${c === 1 ? ' cor' : ' cores'}</button>`).join('')}
        </div>
      </div>

      ${bed.colors > 1 ? `
        <div class="bed-row purge-fields">
          <div class="field">
            <label>Purga por troca de cor (g)</label>
            <input type="text" inputmode="decimal" class="bed-purge-change" value="${bed.purgePerChange}" placeholder="5">
            <span class="field-hint bed-purge-hint">${bed.colors - 1} trocas × ${bed.purgePerChange}g = ${((bed.colors - 1) * bed.purgePerChange).toFixed(1)}g desperdiçados</span>
          </div>
          <div class="field">
            <label>Torre de purga (g total)</label>
            <input type="text" inputmode="decimal" class="bed-purge-tower" value="${bed.purgeTower}" placeholder="0">
            <span class="field-hint">Material da torre que não vira produto</span>
          </div>
        </div>
      ` : ''}
    `;

    // Converte vírgula para ponto em qualquer input de texto desta cama
    div.querySelectorAll('input[type=text]').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === ',') {
          e.preventDefault();
          const s = inp.selectionStart, en = inp.selectionEnd;
          if (!inp.value.includes('.')) {
            inp.value = inp.value.slice(0, s) + '.' + inp.value.slice(en);
            inp.setSelectionRange(s + 1, s + 1);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      });
    });

    // Nome da peça — atualiza o label sem re-renderizar
    div.querySelector('.bed-nomepeca').addEventListener('input', e => {
      bed.nomePeca = e.target.value;
      const lbl = div.querySelector('.bed-label');
      if (lbl) lbl.textContent = `Mesa #${idx + 1}${bed.nomePeca ? ` — ${bed.nomePeca}` : ''}`;
      atualizarCiclo();
    });

    // Eventos — NUNCA chamam renderBeds(), apenas atualizam dados e calcular()
    div.querySelector('.bed-impressora-sel').addEventListener('change', e => {
      setBedImpressora(bed.id, e.target.value);
      renderBeds(); // OK: mudança de impressora precisa atualizar o hint de hora-máquina
    });

    div.querySelector('.bed-gramas').addEventListener('input', e => {
      bed.gramas = parseNum(e.target.value);
      // Atualiza hint de g/peça sem re-renderizar
      const hint = div.querySelector('.bed-pecas-hint');
      if (hint) {
        hint.style.color = bed.pecas > 1 ? 'var(--accent)' : 'transparent';
        hint.textContent = bed.pecas > 1 && bed.gramas > 0
          ? `÷ ${bed.pecas} = ${(bed.gramas / bed.pecas).toFixed(1)}g/peça`
          : '—';
      }
      if (typeof calcular === 'function') calcular();
    });

    div.querySelector('.bed-horas').addEventListener('input', e => {
      bed.horas = parseNum(e.target.value);
      if (typeof calcular === 'function') calcular();
    });

    div.querySelector('.bed-pecas').addEventListener('input', e => {
      bed.pecas = Math.max(1, parseInt(e.target.value) || 1);
      // Atualiza hint de g/peça sem re-renderizar
      const hint = div.querySelector('.bed-pecas-hint');
      if (hint) {
        hint.style.color = bed.pecas > 1 ? 'var(--accent)' : 'transparent';
        hint.textContent = bed.pecas > 1 && bed.gramas > 0
          ? `÷ ${bed.pecas} = ${(bed.gramas / bed.pecas).toFixed(1)}g/peça`
          : '—';
      }
      if (typeof calcular === 'function') calcular();
    });

    if (bed.colors > 1) {
      div.querySelector('.bed-purge-change').addEventListener('input', e => {
        bed.purgePerChange = parseNum(e.target.value);
        // Atualiza hint inline
        const hint = div.querySelector('.bed-purge-hint');
        if (hint) hint.textContent = `${bed.colors - 1} trocas × ${bed.purgePerChange}g = ${((bed.colors - 1) * bed.purgePerChange).toFixed(1)}g desperdiçados`;
        if (typeof calcular === 'function') calcular();
      });
      div.querySelector('.bed-purge-tower').addEventListener('input', e => {
        bed.purgeTower = parseNum(e.target.value);
        if (typeof calcular === 'function') calcular();
      });
    }

    container.appendChild(div);
  });

  if (typeof calcular === 'function') calcular();
}

// Retorna os totais POR PEÇA agregados de todas as mesas
// Cada mesa divide seus custos pelo número de peças impressas nela
function getBedTotals() {
  let totalPecas = 0;

  const result = beds.reduce((acc, bed) => {
    const imp = IMPRESSORAS.find(i => i.id === bed.impressoraId) || { watts: 0, precoBR: 0, vidaUtilH: 2000, manutencaoMes: 0 };
    const pecas = Math.max(1, bed.pecas || 1);
    const purgeTotal = bed.colors > 1 ? (bed.colors - 1) * bed.purgePerChange + bed.purgeTower : 0;
    const custoHora = imp.precoBR > 0 ? (imp.precoBR / imp.vidaUtilH) + (imp.manutencaoMes / 160) : 0;

    // Divide tudo pelo número de peças desta mesa → custo por peça
    const gramasPorPeca  = (bed.gramas || 0) / pecas;
    const horasPorPeca   = (bed.horas  || 0) / pecas;
    const purgePorPeca   = purgeTotal / pecas;
    const energiaPorPeca = (imp.watts / 1000) * horasPorPeca;
    const maquinaPorPeca = horasPorPeca * custoHora;

    totalPecas += pecas;

    return {
      totalGramas:      acc.totalGramas      + gramasPorPeca,
      totalHoras:       acc.totalHoras       + horasPorPeca,
      totalPurgeGramas: acc.totalPurgeGramas + purgePorPeca,
      totalEnergia:     acc.totalEnergia     + energiaPorPeca,
      totalMaquina:     acc.totalMaquina     + maquinaPorPeca,
      bedsDetalhe: [...acc.bedsDetalhe, {
        idx: beds.indexOf(bed),
        impNome: imp.nome,
        gramas: bed.gramas || 0,
        horas: bed.horas || 0,
        pecas,
        gramasPorPeca,
        horasPorPeca,
        purge: purgeTotal,
        watts: imp.watts,
        custoHora
      }]
    };
  }, { totalGramas: 0, totalHoras: 0, totalPurgeGramas: 0, totalEnergia: 0, totalMaquina: 0, bedsDetalhe: [] });

  result.totalPecas = totalPecas;
  return result;
}

// ── Resumo do ciclo completo ──────────────────────────────────
function atualizarCiclo() {
  const box     = document.getElementById('cicloBox');
  const resumo  = document.getElementById('cicloResumo');
  if (!box || !resumo) return;

  const totalHoras = beds.reduce((s, b) => s + (b.horas || 0), 0);
  // Unidades por ciclo = mínimo de peças entre todas as mesas
  const unidades   = beds.length > 0 ? Math.min(...beds.map(b => b.pecas || 1)) : 1;
  const nomeProd   = document.getElementById('nomeProduto')?.value || 'produto';
  const c          = window._calc;

  if (totalHoras <= 0) { box.style.display = 'none'; return; }
  box.style.display = 'block';

  const custoCiclo = c ? c.custoTotal * unidades : 0;
  const precoCiclo = c ? c.precoBase  * unidades : 0;

  resumo.innerHTML = `
    <div class="ciclo-row">
      <span>🔄 Peças por ciclo</span>
      <strong>${beds.map((b,i) => `Mesa #${i+1}${b.nomePeca ? ' '+b.nomePeca : ''}: ${b.pecas||1}×`).join(' + ')}</strong>
    </div>
    <div class="ciclo-row accent">
      <span>📦 ${nomeProd || 'Produtos'} completos por ciclo</span>
      <strong>${unidades} unidade${unidades > 1 ? 's' : ''}</strong>
    </div>
    <div class="ciclo-row">
      <span>⏱️ Tempo total do ciclo</span>
      <strong>${totalHoras.toFixed(1)}h</strong>
    </div>
    <div class="ciclo-row">
      <span>⏱️ Tempo por unidade completa</span>
      <strong>${(totalHoras / unidades).toFixed(2)}h / ${nomeProd || 'unidade'}</strong>
    </div>
    ${c ? `
    <div class="ciclo-row">
      <span>💰 Custo do ciclo completo</span>
      <strong>${c.custoTotal.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})} × ${unidades} = ${custoCiclo.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}</strong>
    </div>
    <div class="ciclo-row accent">
      <span>🏷️ Preço sugerido por ${nomeProd || 'unidade'}</span>
      <strong>${c.precoBase.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}</strong>
    </div>` : ''}
  `;
}

function getBedsSnapshot() { return beds.map(b => ({ ...b })); }
function restoreBeds(snapshot) { beds = []; bedCounter = 0; snapshot.forEach(b => addBed(b)); }

document.addEventListener('DOMContentLoaded', () => {
  addBed();
  document.getElementById('addBedBtn')?.addEventListener('click', () => addBed());
});
