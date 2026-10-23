// Converte string com vírgula ou ponto para número
function parseNum(v) { return parseFloat(String(v).replace(',', '.')) || 0; }
const numStr = v => (v ? String(v).replace('.', ',') : '');

// Mesas de impressão — cada mesa tem sua própria impressora
let beds = [];
let bedCounter = 0;

function impressoraPadrao() {
  return window.impressoraPadraoId || (IMPRESSORAS.find(i => i.id !== 'custom') || IMPRESSORAS[0]).id;
}

function addBed(data = {}) {
  bedCounter++;
  beds.push({
    id: bedCounter,
    nomePeca: data.nomePeca || '',
    impressoraId: data.impressoraId || impressoraPadrao(),
    gramas: data.gramas || 0,
    horas: data.horas || 0,
    pecas: data.pecas || 1,
    colors: data.colors || 1,
    purgePerChange: data.purgePerChange ?? 5,
    purgeTower: data.purgeTower || 0,
  });
  renderBeds();
}

function removeBed(id) {
  if (beds.length <= 1) return;
  beds = beds.filter(b => b.id !== id);
  renderBeds();
}

function custoHoraImpressora(imp) {
  return imp.precoBR > 0 ? (imp.precoBR / imp.vidaUtilH) + (imp.manutencaoMes / 160) : 0;
}

function textoPorPeca(bed) {
  if (bed.pecas <= 1 || !(bed.gramas > 0 || bed.horas > 0)) return '';
  const partes = [];
  if (bed.gramas > 0) partes.push(`${fmtNum(bed.gramas / bed.pecas)} g`);
  if (bed.horas > 0) partes.push(`${fmtNum(bed.horas / bed.pecas, 2)} h`);
  return `Por peça: ${partes.join(' · ')}`;
}

function textoPurga(bed) {
  return `${bed.colors - 1} troca${bed.colors > 2 ? 's' : ''} × ${fmtNum(bed.purgePerChange)} g = ${fmtNum((bed.colors - 1) * bed.purgePerChange)} g desperdiçados`;
}

function renderBeds() {
  const container = document.getElementById('bedsContainer');
  if (!container) return;
  container.innerHTML = '';

  beds.forEach((bed, idx) => {
    const imp = IMPRESSORAS.find(i => i.id === bed.impressoraId) || IMPRESSORAS[0];
    const ch = custoHoraImpressora(imp);

    const div = document.createElement('div');
    div.className = 'bed';
    div.innerHTML = `
      <div class="bed-top">
        <span class="bed-num">Mesa ${idx + 1}</span>
        <input type="text" class="bed-name" value="${escapeHTML(bed.nomePeca)}" placeholder="${beds.length > 1 ? 'Nome da parte (ex.: tampa)' : 'Nome da peça (opcional)'}" aria-label="Nome da peça da mesa ${idx + 1}">
        ${beds.length > 1 ? `<button class="icon-btn bed-remove" type="button" aria-label="Remover mesa ${idx + 1}" title="Remover mesa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
        </button>` : ''}
      </div>
      <div class="stack">
        <div class="field">
          <label>Impressora</label>
          <select class="bed-impressora-sel">
            ${IMPRESSORAS.filter(i => i.id !== 'custom').map(i =>
              `<option value="${i.id}" ${i.id === bed.impressoraId ? 'selected' : ''}>${escapeHTML(i.nome)} · ~${i.watts} W</option>`
            ).join('')}
          </select>
          ${ch > 0 ? `<span class="hint">Desgaste da máquina: ${fmt(ch)}/h (depreciação + manutenção)</span>` : ''}
        </div>
        <div class="grid-3">
          <div class="field">
            <label>Filamento</label>
            <div class="affix"><input type="text" inputmode="decimal" class="bed-gramas" value="${numStr(bed.gramas)}" placeholder="150"><span class="unit">g</span></div>
          </div>
          <div class="field">
            <label>Tempo</label>
            <div class="affix"><input type="text" inputmode="decimal" class="bed-horas" value="${numStr(bed.horas)}" placeholder="4,5"><span class="unit">h</span></div>
          </div>
          <div class="field">
            <label>Peças na mesa <button type="button" class="tip" data-tip="Quantas peças saem de uma vez nesta mesa. O peso e o tempo são divididos entre elas.">i</button></label>
            <div class="affix"><input type="text" inputmode="numeric" class="bed-pecas" value="${bed.pecas || 1}" placeholder="1"><span class="unit">un.</span></div>
          </div>
        </div>
        <span class="hint accent bed-pecas-hint">${textoPorPeca(bed)}</span>
        <div class="field">
          <label>Cores <button type="button" class="tip" data-tip="Impressão multicolor (AMS, MMU) desperdiça filamento a cada troca de cor. Esse material entra no custo.">i</button></label>
          <div class="seg bed-colors">
            ${[1, 2, 3, 4].map(c => `<button type="button" data-colors="${c}" class="${bed.colors === c ? 'active' : ''}">${c === 1 ? '1 cor' : `${c} cores`}</button>`).join('')}
          </div>
        </div>
        ${bed.colors > 1 ? `
          <div class="grid-2">
            <div class="field">
              <label>Purga por troca</label>
              <div class="affix"><input type="text" inputmode="decimal" class="bed-purge-change" value="${numStr(bed.purgePerChange)}" placeholder="5"><span class="unit">g</span></div>
              <span class="hint bed-purge-hint">${textoPurga(bed)}</span>
            </div>
            <div class="field">
              <label>Torre de purga</label>
              <div class="affix"><input type="text" inputmode="decimal" class="bed-purge-tower" value="${numStr(bed.purgeTower)}" placeholder="0"><span class="unit">g</span></div>
              <span class="hint">Material da torre que não vira produto</span>
            </div>
          </div>` : ''}
      </div>
    `;

    const atualizarHintPecas = () => { div.querySelector('.bed-pecas-hint').textContent = textoPorPeca(bed); };

    div.querySelector('.bed-name').addEventListener('input', e => {
      bed.nomePeca = e.target.value;
      atualizarCiclo();
      if (typeof atualizarInfoItem === 'function') atualizarInfoItem();
    });
    div.querySelector('.bed-remove')?.addEventListener('click', () => removeBed(bed.id));

    // Mudar impressora re-renderiza para atualizar o custo/hora exibido
    div.querySelector('.bed-impressora-sel').addEventListener('change', e => {
      bed.impressoraId = e.target.value;
      renderBeds();
    });

    div.querySelector('.bed-gramas').addEventListener('input', e => { bed.gramas = parseNum(e.target.value); atualizarHintPecas(); calcular(); });
    div.querySelector('.bed-horas').addEventListener('input', e => { bed.horas = parseNum(e.target.value); atualizarHintPecas(); calcular(); });
    div.querySelector('.bed-pecas').addEventListener('input', e => { bed.pecas = Math.max(1, parseInt(e.target.value) || 1); atualizarHintPecas(); calcular(); });

    div.querySelectorAll('.bed-colors button').forEach(btn => btn.addEventListener('click', () => {
      bed.colors = Number(btn.dataset.colors);
      renderBeds();
    }));

    if (bed.colors > 1) {
      div.querySelector('.bed-purge-change').addEventListener('input', e => {
        bed.purgePerChange = parseNum(e.target.value);
        div.querySelector('.bed-purge-hint').textContent = textoPurga(bed);
        calcular();
      });
      div.querySelector('.bed-purge-tower').addEventListener('input', e => { bed.purgeTower = parseNum(e.target.value); calcular(); });
    }

    container.appendChild(div);
  });

  calcular();
}

// Retorna os totais POR PEÇA agregados de todas as mesas
// Cada mesa divide seus custos pelo número de peças impressas nela
function getBedTotals() {
  let totalPecas = 0;

  const result = beds.reduce((acc, bed, idx) => {
    const imp = IMPRESSORAS.find(i => i.id === bed.impressoraId) || { nome: '—', watts: 0, precoBR: 0, vidaUtilH: 2000, manutencaoMes: 0 };
    const pecas = Math.max(1, bed.pecas || 1);
    const purgeTotal = bed.colors > 1 ? (bed.colors - 1) * bed.purgePerChange + bed.purgeTower : 0;
    const custoHora = custoHoraImpressora(imp);

    const gramasPorPeca  = (bed.gramas || 0) / pecas;
    const horasPorPeca   = (bed.horas  || 0) / pecas;
    const purgePorPeca   = purgeTotal / pecas;
    const energiaPorPeca = (imp.watts / 1000) * horasPorPeca;
    const maquinaPorPeca = horasPorPeca * custoHora;

    totalPecas += pecas;

    acc.totalGramas      += gramasPorPeca;
    acc.totalHoras       += horasPorPeca;
    acc.totalPurgeGramas += purgePorPeca;
    acc.totalEnergia     += energiaPorPeca;
    acc.totalMaquina     += maquinaPorPeca;
    acc.bedsDetalhe.push({
      idx, impNome: imp.nome, gramas: bed.gramas || 0, horas: bed.horas || 0, pecas,
      gramasPorPeca, horasPorPeca, purge: purgeTotal, watts: imp.watts, custoHora,
    });
    return acc;
  }, { totalGramas: 0, totalHoras: 0, totalPurgeGramas: 0, totalEnergia: 0, totalMaquina: 0, bedsDetalhe: [] });

  result.totalPecas = totalPecas;
  return result;
}

// ── Resumo do ciclo completo ──────────────────────────────────
function atualizarCiclo() {
  const box = document.getElementById('cicloBox');
  const resumo = document.getElementById('cicloResumo');
  if (!box || !resumo) return;

  const totalHoras = beds.reduce((s, b) => s + (b.horas || 0), 0);
  // Ciclo só faz sentido com mais de uma mesa ou mais de uma peça por mesa
  if (totalHoras <= 0 || (beds.length === 1 && (beds[0].pecas || 1) === 1)) { box.hidden = true; return; }
  box.hidden = false;

  // Unidades completas por ciclo = menor quantidade entre as partes
  const unidades = Math.min(...beds.map(b => b.pecas || 1));
  const nomeProd = document.getElementById('nomeProduto')?.value.trim() || 'unidade';
  const c = window._calc;

  resumo.innerHTML = `
    ${listRow('Uma rodada de todas as mesas', `${fmtNum(totalHoras)} h`)}
    ${listRow('Produtos completos por rodada', `${unidades} un.`)}
    ${listRow(`Tempo por ${escapeHTML(nomeProd)}`, `${fmtNum(totalHoras / unidades, 2)} h`)}
    ${c && c.custoTotal > 0 ? listRow('Custo da rodada', fmt(c.custoTotal * unidades)) : ''}
  `;
}

function getBedsSnapshot() { return beds.map(b => ({ ...b })); }
function restoreBeds(snapshot) { beds = []; bedCounter = 0; snapshot.forEach(b => addBed(b)); }

document.addEventListener('DOMContentLoaded', () => {
  addBed();
  document.getElementById('addBedBtn')?.addEventListener('click', () => addBed());
});
