// ── Planejamento por ciclos de produção ──────────────────────

function formatHora(h) {
  const total = ((h % 24) + 24) % 24;
  const hh = Math.floor(total);
  const mm = Math.round((total - hh) * 60);
  return `${String(hh).padStart(2,'0')}:${String(mm === 60 ? hh + 1 : mm).padStart(2,'0')}`;
}

function horaParaDecimal(str) {
  const [h, m] = (str || '23:00').split(':').map(Number);
  return h + (m || 0) / 60;
}

// Avança o tempo até o próximo momento em que o usuário está acordado
// para poder INICIAR uma nova impressão (trocar a mesa)
function proximoInicioDisponivel(horaAbs, dormirH, acordarH) {
  const hora = horaAbs % 24;
  // Acordado se: acordarH ≤ hora < dormirH
  if (hora >= acordarH && hora < dormirH) return horaAbs; // já está acordado

  // Está dormindo — quando acorda?
  const dia = Math.floor(horaAbs / 24);
  if (hora < acordarH) {
    return dia * 24 + acordarH;        // ainda hoje
  } else {
    return (dia + 1) * 24 + acordarH;  // amanhã
  }
}

function formatDataHora(horaAbs) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ms = horaAbs * 3600 * 1000;
  const data = new Date(hoje.getTime() + ms);
  const dia  = data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return `${dia} ${formatHora(horaAbs)}`;
}

function atualizarInfoItem() {
  const el = document.getElementById('planItemInfo');
  if (!el || typeof beds === 'undefined') return;
  const nomeProd = document.getElementById('nomeProduto')?.value;
  const totalH   = beds.reduce((s, b) => s + (b.horas || 0), 0);
  const partes   = beds.filter(b => b.horas > 0).map(b => b.nomePeca || 'Mesa').join(' + ');
  if (totalH > 0) {
    el.textContent = `${nomeProd || 'Produto'}: ${partes} | ${totalH.toFixed(1)}h por ciclo`;
    el.style.color = 'var(--accent)';
  } else {
    el.textContent = 'Preencha as mesas ao lado';
    el.style.color = 'var(--text-muted)';
  }
}

function gerarCronograma() {
  const el = document.getElementById('plannerResults');
  if (!el) return;

  const nomeProd  = document.getElementById('nomeProduto')?.value   || 'produto';
  const target    = parseInt(document.getElementById('planQuantidade')?.value) || 0;
  const dormirH   = horaParaDecimal(document.getElementById('planDormir')?.value);
  const acordarH  = horaParaDecimal(document.getElementById('planAcordar')?.value);

  if (!target) {
    el.innerHTML = '<div class="plan-tip" style="margin:1rem">⚠️ Informe a quantidade desejada.</div>';
    return;
  }
  if (typeof beds === 'undefined' || !beds.length || !beds.some(b => b.horas > 0)) {
    el.innerHTML = '<div class="plan-tip" style="margin:1rem">⚠️ Preencha as mesas de impressão com horas e quantidade de peças.</div>';
    return;
  }

  // ── Calcula runs necessários por parte ──────────────────────
  const partes = beds
    .filter(b => b.horas > 0)
    .map((bed, idx) => {
      const pecasPorRun = Math.max(1, bed.pecas || 1);
      const runsNeeded  = Math.ceil(target / pecasPorRun);
      const totalProd   = runsNeeded * pecasPorRun;
      return {
        nome:        bed.nomePeca || `Mesa #${idx + 1}`,
        horas:       bed.horas,
        pecasPorRun,
        runsNeeded,
        totalProd,
        extra:       totalProd - target
      };
    });

  // ── Monta lista de runs por CICLO (intercalado por parte) ─────
  // Ciclo 1: tampa→caixa→fecho | Ciclo 2: tampa→caixa→fecho | ...
  const todosRuns = [];
  const maxRuns = Math.max(...partes.map(p => p.runsNeeded));
  for (let ciclo = 1; ciclo <= maxRuns; ciclo++) {
    partes.forEach(p => {
      if (ciclo <= p.runsNeeded) {
        todosRuns.push({ ...p, runIdx: ciclo, ciclo });
      }
    });
  }

  // ── Agenda respeitando wake/sleep ────────────────────────────
  const horaInicial = new Date().getHours() + new Date().getMinutes() / 60;
  let tempo = proximoInicioDisponivel(horaInicial, dormirH, acordarH);

  const agenda = todosRuns.map(run => {
    tempo = proximoInicioDisponivel(tempo, dormirH, acordarH);
    const inicio = tempo;
    const fim    = inicio + run.horas;
    tempo = fim;
    return { ...run, inicio, fim };
  });

  // ── Calcula quando cada produto estará completo ──────────────
  const prontosPorParte = {};
  partes.forEach(p => { prontosPorParte[p.nome] = 0; });
  let unidadesCompletas = 0;
  let marcosConclusao = [];

  // Marca conclusão de ciclo: quando todas as partes do ciclo N terminam
  const cicloFim = {};
  agenda.forEach(run => {
    prontosPorParte[run.nome] += run.pecasPorRun;
    const possivel = Math.min(...partes.map(p => prontosPorParte[p.nome] || 0));
    if (possivel > unidadesCompletas) {
      unidadesCompletas = possivel;
      marcosConclusao.push({ tempo: run.fim, unidades: Math.min(possivel, target), ciclo: run.ciclo });
    }
    // Registra fim de cada ciclo (última parte do ciclo)
    if (!cicloFim[run.ciclo] || run.fim > cicloFim[run.ciclo]) cicloFim[run.ciclo] = run.fim;
  });

  const totalHorasMaquina = partes.reduce((s, p) => s + p.horas * p.runsNeeded, 0);
  const conclusao         = agenda.length ? agenda[agenda.length - 1].fim : 0;
  const diasNecessarios   = Math.ceil(conclusao / 24);
  const hoturnas          = agenda.filter(r => {
    const h = r.inicio % 24;
    return h >= dormirH || h < acordarH;
  }).length;

  // ── Renderiza por CICLO ──────────────────────────────────────
  const resumoPorParte = partes.map(p =>
    `<div class="ciclo-row">
       <span>${p.nome}</span>
       <strong>${p.runsNeeded} mesa${p.runsNeeded > 1 ? 's' : ''} × ${p.pecasPorRun} peças × ${p.horas}h = ${(p.runsNeeded * p.horas).toFixed(1)}h &nbsp;→ ${p.totalProd} unidades${p.extra > 0 ? ` (+${p.extra} extra)` : ''}</strong>
     </div>`
  ).join('');

  // Agrupa runs por ciclo para renderizar com separadores
  const ciclosGrupo = {};
  agenda.forEach(run => {
    if (!ciclosGrupo[run.ciclo]) ciclosGrupo[run.ciclo] = [];
    ciclosGrupo[run.ciclo].push(run);
  });

  const tabelaHTML = Object.entries(ciclosGrupo).map(([cicloNum, runs]) => {
    const marco = marcosConclusao.find(m => m.ciclo === parseInt(cicloNum));

    const rowsHTML = runs.map(run => {
      const duranteNoite = (() => {
        const h = run.inicio % 24;
        return h >= dormirH || h < acordarH;
      })();

      return `<tr class="${duranteNoite ? 'row-noturna' : ''}">
        <td><strong>${formatHora(run.inicio)}</strong></td>
        <td>${formatHora(run.fim)}</td>
        <td>${run.horas.toFixed(2)}h</td>
        <td style="font-weight:600;color:var(--accent)">${run.nome}</td>
        <td>Mesa ${run.runIdx}/${run.runsNeeded}</td>
        <td>${run.runIdx * run.pecasPorRun} / ${run.totalProd}</td>
      </tr>`;
    }).join('');

    const conclusaoCiclo = marco
      ? `<div class="plan-tip" style="margin:0;border-radius:0;padding:0.5rem 1rem;background:var(--success-bg,#1a2e1a);color:var(--success,#4ade80);font-weight:600">
           ✅ Ciclo ${cicloNum} concluído — ${marco.unidades} ${nomeProd}${marco.unidades > 1 ? 's prontas' : ' pronta'} (${formatDataHora(marco.tempo)})
         </div>`
      : '';

    return `
      <div class="plan-dia-header" style="background:var(--surface2,#1e1e2e);font-size:0.8rem;letter-spacing:0.05em">
        🔄 CICLO ${cicloNum} de ${maxRuns}
      </div>
      <table>
        <thead><tr><th>Início</th><th>Fim</th><th>Duração</th><th>Peça</th><th>Mesa</th><th>Produzidas</th></tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
      ${conclusaoCiclo}
    `;
  }).join('');

  el.innerHTML = `
    <div class="planner-summary">
      <div class="plan-stat accent"><label>Conclusão em</label><div class="plan-val">${diasNecessarios} dia${diasNecessarios > 1 ? 's' : ''}</div></div>
      <div class="plan-stat"><label>Total de runs</label><div class="plan-val">${todosRuns.length}</div></div>
      <div class="plan-stat"><label>Horas-máquina</label><div class="plan-val">${totalHorasMaquina.toFixed(1)}h</div></div>
    </div>

    <div class="ciclo-box" style="margin:0;border-radius:0;border-left:none;border-right:none;border-top:none">
      <div class="ciclo-title">📋 Runs necessários por peça</div>
      ${resumoPorParte}
      <div class="ciclo-row accent">
        <span>📦 ${nomeProd} completas</span>
        <strong>${target} pedidas → ${Math.min(...partes.map(p => p.totalProd))} produzidas (${Math.min(...partes.map(p => p.extra))} extra)</strong>
      </div>
    </div>

    <div class="plan-tip">
      🌙 Runs que iniciam durante a noite: <strong>${hoturnas}</strong> &nbsp;|&nbsp;
      ✅ Conclusão prevista: <strong>${formatDataHora(conclusao)}</strong>
    </div>

    <div class="planner-table-wrap">${tabelaHTML}</div>
  `;
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('gerarPlanBtn')?.addEventListener('click', gerarCronograma);

  ['planQuantidade','planDormir','planAcordar'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (document.getElementById('plannerResults')?.querySelector('.planner-summary')) gerarCronograma();
    });
  });

  // Atualiza info do item quando calc roda
  const obs = new MutationObserver(atualizarInfoItem);
  const tgt = document.getElementById('rtab-custos');
  if (tgt) obs.observe(tgt, { childList: true, subtree: true });
});
