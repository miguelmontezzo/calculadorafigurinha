// ── Contrato de Consignação ───────────────────────────────────

function abrirModalContrato() {
  // Auto-preenche os campos do contrato com os dados da calculadora
  const precoUnit = document.getElementById('consigPrecoUnit')?.value || '';
  const qtd       = document.getElementById('consigQtd')?.value       || '';
  const prazo     = document.getElementById('consigPrazo')?.value      || '30';

  if (precoUnit) document.getElementById('ctrPrecoUnit').value = precoUnit;
  if (qtd)       document.getElementById('ctrQuantidade').value = qtd;
  if (prazo)     document.getElementById('ctrPrazo').value = prazo;

  document.getElementById('contratoModal').style.display = 'flex';
  // Gera preview automaticamente se já tiver dados suficientes
  if (precoUnit && qtd) gerarPreview();
}

function fecharModalContrato() {
  document.getElementById('contratoModal').style.display = 'none';
}

function gerarPreview() {
  document.getElementById('contratoPreviewArea').innerHTML = gerarContratoHTML();
}

function gerarContratoHTML() {
  const nomeConsignante   = document.getElementById('ctrNomeConsignante')?.value  || '[SEU NOME]';
  const cpfConsignante    = document.getElementById('ctrCpfConsignante')?.value   || '[SEU CPF]';
  const endConsignante    = document.getElementById('ctrEndConsignante')?.value   || '[SEU ENDEREÇO]';
  const telConsignante    = document.getElementById('ctrTelConsignante')?.value   || '';
  const nomeConsignatario = document.getElementById('ctrNomeConsignatario')?.value || '[NOME DO REVENDEDOR]';
  const cpfConsignatario  = document.getElementById('ctrCpfConsignatario')?.value  || '[CPF DO REVENDEDOR]';
  const endConsignatario  = document.getElementById('ctrEndConsignatario')?.value  || '[ENDEREÇO DO REVENDEDOR]';
  const telConsignatario  = document.getElementById('ctrTelConsignatario')?.value  || '';
  const produto           = document.getElementById('ctrProduto')?.value           || '[PRODUTO]';
  const quantidade        = parseInt(document.getElementById('ctrQuantidade')?.value) || 0;
  const precoUnit         = parseFloat(document.getElementById('ctrPrecoUnit')?.value) || 0;
  const prazo             = parseInt(document.getElementById('ctrPrazo')?.value)   || 30;
  const cidade            = document.getElementById('ctrCidade')?.value            || '[CIDADE]';
  const obs               = document.getElementById('ctrObs')?.value               || '';

  const hoje       = new Date();
  const dataFmt    = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const dataAcerto = new Date(hoje.getTime() + prazo * 24 * 60 * 60 * 1000);
  const dataFimFmt = dataAcerto.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const precoFmt   = precoUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const totalFmt   = (precoUnit * quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return `
    <div class="contrato-body" id="contratoPreview">
      <div style="text-align:center;margin-bottom:14px;border-bottom:2px solid #000;padding-bottom:10px">
        <h1 style="font-size:15pt;margin-bottom:2px">TERMO DE CONSIGNAÇÃO</h1>
        <p style="font-size:9pt;color:#555">Data: ${dataFmt} &nbsp;|&nbsp; Prazo de acerto: ${dataFimFmt}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9.5pt">
        <tr>
          <td style="width:50%;vertical-align:top;padding-right:10px">
            <strong>CONSIGNANTE (Fabricante)</strong><br>
            ${nomeConsignante}<br>
            CPF/CNPJ: ${cpfConsignante}<br>
            ${endConsignante}${telConsignante ? `<br>Tel: ${telConsignante}` : ''}
          </td>
          <td style="width:50%;vertical-align:top;padding-left:10px;border-left:1px solid #ccc">
            <strong>CONSIGNATÁRIO (Revendedor)</strong><br>
            ${nomeConsignatario}<br>
            CPF/CNPJ: ${cpfConsignatario}<br>
            ${endConsignatario}${telConsignatario ? `<br>Tel: ${telConsignatario}` : ''}
          </td>
        </tr>
      </table>

      <h2>1. PRODUTO CONSIGNADO</h2>
      <table class="contrato-table">
        <thead><tr><th>Produto</th><th>Qtd.</th><th>Valor unitário</th><th>Valor total do lote</th></tr></thead>
        <tbody><tr>
          <td>${produto}</td>
          <td style="text-align:center">${quantidade}</td>
          <td style="text-align:center">${precoFmt}</td>
          <td style="text-align:center;font-weight:bold">${totalFmt}</td>
        </tr></tbody>
      </table>
      ${obs ? `<p style="font-size:8.5pt;color:#555;margin-top:4px"><em>Obs: ${obs}</em></p>` : ''}

      <h2>2. CONDIÇÕES DE PAGAMENTO E ACERTO</h2>
      <p><strong>2.1.</strong> O CONSIGNATÁRIO realizará o acerto com o CONSIGNANTE até <strong>${dataFimFmt}</strong> (${prazo} dias a partir desta data).</p>
      <p><strong>2.2.</strong> No acerto, será pago <strong>${precoFmt} por unidade vendida</strong>. O restante não vendido será devolvido na mesma data, nas condições originais de entrega.</p>
      <p><strong>2.3.</strong> Produtos não devolvidos e não pagos até a data de acerto serão considerados vendidos, tornando-se devido o valor integral de <strong>${totalFmt}</strong>.</p>
      <p><strong>2.4.</strong> O CONSIGNATÁRIO tem liberdade para definir o preço de venda ao cliente final.</p>

      <h2>3. RESPONSABILIDADES</h2>
      <p><strong>3.1.</strong> O CONSIGNATÁRIO se responsabiliza pela guarda, conservação e integridade dos produtos enquanto em sua posse. Danos, perdas ou extravios implicam no pagamento do valor integral da(s) peça(s) afetada(s).</p>
      <p><strong>3.2.</strong> O CONSIGNANTE garante a qualidade e conformidade dos produtos entregues.</p>
      <p><strong>3.3.</strong> É vedado ao CONSIGNATÁRIO ceder ou repassar os produtos a terceiros sem autorização prévia e por escrito do CONSIGNANTE.</p>

      <h2>4. RESCISÃO E FORO</h2>
      <p><strong>4.1.</strong> Qualquer das partes pode rescindir este termo com comunicação prévia de 3 dias, devendo o CONSIGNATÁRIO devolver os produtos e acertar os já vendidos.</p>
      <p><strong>4.2.</strong> Fica eleito o foro da comarca de <strong>${cidade}</strong> para dirimir quaisquer questões oriundas deste instrumento.</p>

      <div style="margin-top:18px;padding-top:10px;border-top:1px solid #000">
        <p style="text-align:center;margin-bottom:18px">${cidade}, ${dataFmt}.</p>
        <div style="display:flex;gap:40px;justify-content:center">
          <div style="text-align:center;flex:1">
            <div style="border-top:1px solid #000;margin-bottom:4px;padding-top:2px"></div>
            <p><strong>${nomeConsignante}</strong><br><span style="font-size:8pt">Consignante — CPF: ${cpfConsignante}</span></p>
          </div>
          <div style="text-align:center;flex:1">
            <div style="border-top:1px solid #000;margin-bottom:4px;padding-top:2px"></div>
            <p><strong>${nomeConsignatario}</strong><br><span style="font-size:8pt">Consignatário — CPF: ${cpfConsignatario}</span></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function imprimirContrato() {
  const html = gerarContratoHTML();
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Contrato de Consignação</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9.5pt;
      color: #000;
      padding: 1.5cm 2cm;
      max-width: 21cm;
      margin: 0 auto;
      line-height: 1.45;
    }
    h1 { font-size: 14pt; }
    h2 {
      font-size: 9.5pt;
      text-transform: uppercase;
      border-bottom: 1px solid #000;
      margin: 10px 0 5px;
      padding-bottom: 2px;
      letter-spacing: 0.04em;
    }
    p { margin-bottom: 4px; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 9pt; }
    th, td { border: 1px solid #000; padding: 4px 6px; }
    th { background: #f0f0f0; font-weight: bold; text-align: left; }
    strong { font-weight: bold; }
    @page { margin: 1.5cm 2cm; size: A4; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>${html}</body>
</html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('gerarContratoBtn')?.addEventListener('click', abrirModalContrato);
  document.getElementById('contratoClose')?.addEventListener('click', fecharModalContrato);

  document.getElementById('previewContratoBtn')?.addEventListener('click', gerarPreview);
  document.getElementById('imprimirContratoBtn')?.addEventListener('click', imprimirContrato);

  // Atualiza preview ao digitar qualquer campo do modal
  document.querySelectorAll('#contratoModal input').forEach(el => {
    el.addEventListener('input', () => {
      if (document.getElementById('contratoPreviewArea').innerHTML.trim()) gerarPreview();
    });
  });

  // Fecha ao clicar fora
  document.getElementById('contratoModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('contratoModal')) fecharModalContrato();
  });
});
