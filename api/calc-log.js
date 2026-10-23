// POST /api/calc-log  { nome_produto, dados }  → registra um cálculo (alimenta o dashboard)
const { getSql } = require('../lib/db');
const { send, getBody, handler } = require('../lib/http');
const { getUser } = require('../lib/session');

module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });

  const user = await getUser(req);
  if (!user) return send(res, 401, { error: 'Sessão expirada.' });

  const body = getBody(req);
  const nome = String(body.nome_produto || '').slice(0, 200);
  const dados = JSON.stringify(body.dados || {}).slice(0, 20000);

  const sql = getSql();
  await sql`
    INSERT INTO calc_logs (email, nome_produto, dados)
    VALUES (${user.email}, ${nome}, ${dados}::jsonb)`;

  send(res, 200, { ok: true });
});
