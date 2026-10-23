// ── Planejamento por ciclos de produção ──────────────────────

function formatHora(h) {
  const totalMin = Math.round((((h % 24) + 24) % 24) * 60) % (24 * 60);
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

function horaParaDecimal(str) {
  const [h, m] = (str || '23:00').split(':').map(Number);
  return h + (m || 0) / 60;
}

function estaAcordado(hora, dormirH, acordarH) {
  // Suporta quem dorme depois da meia-noite (ex.: dorme 01:00, acorda 09:00)
  return dormirH > acordarH
    ? hora >= acordarH && hora < dormirH
    : hora >= acordarH || hora < dormirH;
}

// Avança até o próximo momento em que você está acordado para trocar a mesa
function proximoInicioDisponivel(horaAbs, dormirH, acordarH) {
  const hora = ((horaAbs % 24) + 24) % 24;
  if (estaAcordado(hora, dormirH, acordarH)) return horaAbs;
  const dia = Math.floor(horaAbs / 24);
  return hora < acordarH ? dia * 24 + acordarH : (dia + 1) * 24 + acordarH;
}

function formatDataHora(horaAbs) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(hoje.getTime() + horaAbs * 3600 * 1000);
  const dia = data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return `${dia}, ${formatHora(horaAbs)}`;
}

function atualizarInfoItem() {
  const el = document.getElementById('planItemInfo');
  if (!el || typeof beds === 'undefined') return;
  const nomeProd = document.getElementById('nomeProduto')?.value.trim();
  const totalH = beds.reduce((s, b) => s + (b.horas || 0), 0);
  const partes = beds.filter(b => b.horas > 0).map((b, i) => b.nomePeca || `Mesa ${i + 1}`).join(' + ');
  el.textContent = totalH > 0
    ? `${nomeProd || 'Produto'}: ${partes} · ${fmtNum(totalH)} h por rodada`
    : 'Preencha as mesas para planejar a produção.';
}

function gerarCronograma() {
  const el = document.getElementById('plannerResults');
  if (!el) return;

  const nomeProd = document.getElementById('nomeProduto')?.value.trim() || 'unidades';
  const target = parseInt(document.getElementById('planQuantidade')?.value) || 0;
  const nImp = Math.max(1, Math.min(50, parseInt(document.getElementById('planNImpressoras')?.value) || 1));
  const dormirH = horaParaDecimal(document.getElementById('planDormir')?.value);
  const acordarH = horaParaDecimal(document.getElementById('planAcordar')?.value);

  if (!target) {
    el.innerHTML = '<div class="note">Informe quantas unidades você quer produzir.</div>';
    return;
  }
  if (!beds.some(b => b.horas > 0)) {
    el.innerHTML = '<div class="note">Preencha as horas de impressão das mesas primeiro.</div>';
    return;
  }

  // ── Impressões necessárias por parte ──────────────────────
  const partes = beds
    .map((bed, idx) => ({ bed, idx }))
    .filter(({ bed }) => bed.horas > 0)
    .map(({ bed, idx }) => {
      const pecasPorRun = Math.max(1, bed.pecas || 1);
      const runsNeeded = Math.ceil(target / pecasPorRun);
      return {
        nome: bed.nomePeca || `Mesa ${idx + 1}`,
        horas: bed.horas, pecasPorRun, runsNeeded,
        totalProd: runsNeeded * pecasPorRun,
      };
    });

  // ── Fila intercalada por ciclo (tampa → caixa → fecho, de novo…) ──
  const fila = [];
  const maxRuns = Math.max(...partes.map(p => p.runsNeeded));
  for (let ciclo = 1; ciclo <= maxRuns; ciclo++) {
    partes.forEach(p => { if (ciclo <= p.runsNeeded) fila.push({ ...p, runIdx: ciclo, ciclo }); });
  }

  // ── Distribui entre as impressoras, respeitando seu horário ──
  // Cada impressão vai para a máquina que fica livre primeiro.
  const agora = new Date().getHours() + new Date().getMinutes() / 60;
  const livreEm = Array(nImp).fill(proximoInicioDisponivel(agora, dormirH, acordarH));
  const agenda = fila.map(run => {
    let m = 0;
    for (let i = 1; i < nImp; i++) if (livreEm[i] < livreEm[m]) m = i;
    const inicio = proximoInicioDisponivel(livreEm[m], dormirH, acordarH);
    const fim = inicio + run.horas;
    livreEm[m] = fim;
    return { ...run, inicio, fim, maquina: m + 1 };
  }).sort((a, b) => a.inicio - b.inicio);

  // ── Quando cada ciclo fica completo ──────────────────────
  const prontos = Object.fromEntries(partes.map(p => [p.nome, 0]));
  const fimPorCiclo = {};
  [...agenda].sort((a, b) => a.fim - b.fim).forEach(run => {
    prontos[run.nome] += run.pecasPorRun;
    fimPorCiclo[run.ciclo] = Math.max(fimPorCiclo[run.ciclo] || 0, run.fim);
  });

  const totalHorasMaquina = partes.reduce((s, p) => s + p.horas * p.runsNeeded, 0);
  const conclusao = Math.max(...agenda.map(r => r.fim));
  const diasNecessarios = Math.max(1, Math.ceil((conclusao - agora) / 24));
  const noturnas = agenda.filter(r => !estaAcordado(r.inicio % 24, dormirH, acordarH) || !estaAcordado(r.fim % 24, dormirH, acordarH)).length;
  const produzidas = Math.min(...partes.map(p => p.totalProd));

  const ciclos = {};
  agenda.forEach(r => { (ciclos[r.ciclo] ||= []).push(r); });

  const tabelaCiclos = Object.entries(ciclos).map(([num, runs]) => {
    const unidades = Math.min(target, Math.min(...partes.map(p => Math.min(p.runsNeeded, Number(num)) * p.pecasPorRun)));
    return `
      <div class="plan-cycle">
        <div class="plan-cycle-head"><span>Ciclo ${num} de ${maxRuns}</span><span>${formatDataHora(runs[0].inicio)}</span></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Início</th><th>Fim</th><th>Peça</th>${nImp > 1 ? '<th>Máq.</th>' : ''}<th class="num">Duração</th></tr></thead>
          <tbody>${runs.map(r => `
            <tr class="${estaAcordado(r.fim % 24, dormirH, acordarH) ? '' : 'night'}">
              <td>${formatHora(r.inicio)}</td>
              <td>${formatHora(r.fim)}</td>
              <td>${escapeHTML(r.nome)} <span class="muted small">${r.runIdx}/${r.runsNeeded}</span></td>
              ${nImp > 1 ? `<td>${r.maquina}</td>` : ''}
              <td class="num">${fmtNum(r.horas, 2)} h</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        <div class="plan-done">${unidades} ${escapeHTML(nomeProd)} prontas · ${formatDataHora(fimPorCiclo[num])}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="plan-stats">
      <div class="hero-stat"><span>Fica pronto em</span><strong>${diasNecessarios} dia${diasNecessarios > 1 ? 's' : ''}</strong></div>
      <div class="hero-stat"><span>Impressões</span><strong>${fila.length}</strong></div>
      <div class="hero-stat"><span>Horas-máquina</span><strong>${fmtNum(totalHorasMaquina)} h</strong></div>
    </div>
    <div class="list">
      ${partes.map(p => listRow(escapeHTML(p.nome), `${p.runsNeeded}×`, `${p.pecasPorRun} peça${p.pecasPorRun > 1 ? 's' : ''} por mesa · ${fmtNum(p.horas)} h cada → ${p.totalProd} peças`)).join('')}
      ${listRow('Conclusão prevista', formatDataHora(conclusao), `${produzidas} produzidas para ${target} pedidas${noturnas ? ` · ${noturnas} impressão(ões) terminam enquanto você dorme` : ''}`, 'total')}
    </div>
    ${tabelaCiclos}
  `;
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('gerarPlanBtn')?.addEventListener('click', gerarCronograma);
  ['planQuantidade', 'planNImpressoras', 'planDormir', 'planAcordar'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (document.querySelector('#plannerResults .plan-stats')) gerarCronograma();
    });
  });
});
