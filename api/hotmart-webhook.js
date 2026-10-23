// POST /api/hotmart-webhook → libera ou revoga acesso automaticamente após compra/cancelamento.
//
// A Hotmart envia o "hottok" (token configurado no painel dela) no header X-HOTMART-HOTTOK
// (webhook v2) ou no corpo (v1). Comparamos com HOTMART_SECRET.
const crypto = require('crypto');
const { getSql, normalizeEmail, isValidEmail } = require('../lib/db');
const { send, getBody, safeEqual, handler } = require('../lib/http');

const EVENTOS_LIBERAR = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'PURCHASE_REACTIVATED']);
const EVENTOS_REVOGAR = new Set(['PURCHASE_CANCELLED', 'PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'SUBSCRIPTION_CANCELLATION']);

function autenticado(req, body) {
  const secret = process.env.HOTMART_SECRET;
  if (!secret) return false;
  const recebido = req.headers['x-hotmart-hottok'] || body.hottok || '';
  if (safeEqual(recebido, secret)) return true;
  // Compatibilidade com a versão antiga deste projeto (HMAC do corpo)
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const hmac = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return safeEqual(recebido, hmac);
}

module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });

  const body = getBody(req);
  if (!autenticado(req, body)) return send(res, 401, { error: 'Hottok inválido' });

  const evento = body.event;
  const liberar = EVENTOS_LIBERAR.has(evento);
  const revogar = EVENTOS_REVOGAR.has(evento);
  if (!liberar && !revogar) return send(res, 200, { message: `Evento ignorado: ${evento}` });

  const buyer = body.data?.buyer || {};
  const email = normalizeEmail(buyer.email);
  if (!isValidEmail(email)) return send(res, 400, { error: 'Email do comprador não encontrado' });

  const sql = getSql();
  if (liberar) {
    await sql`
      INSERT INTO members (email, nome, origem, data_compra, ativo)
      VALUES (${email}, ${buyer.name || ''}, 'hotmart', now(), true)
      ON CONFLICT (email) DO UPDATE SET ativo = true, data_compra = now(), updated_at = now()`;
    return send(res, 200, { message: `Acesso liberado: ${email}` });
  }

  await sql`UPDATE members SET ativo = false, updated_at = now() WHERE email = ${email}`;
  send(res, 200, { message: `Acesso revogado: ${email}` });
});
