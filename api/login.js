// POST /api/login  { email }  → cria a sessão se o email for de um membro ativo
const { getSql, normalizeEmail, isValidEmail } = require('../lib/db');
const { send, getBody, handler } = require('../lib/http');
const { setSession } = require('../lib/session');

module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });

  const email = normalizeEmail(getBody(req).email);
  if (!isValidEmail(email)) return send(res, 400, { error: 'Digite um email válido.' });

  const sql = getSql();
  const rows = await sql`SELECT email, nome, ativo FROM members WHERE email = ${email}`;
  const user = rows[0];

  if (!user) {
    return send(res, 404, { error: 'Email não cadastrado.', code: 'not_found' });
  }
  if (!user.ativo) {
    return send(res, 403, { error: 'Seu acesso está inativo. Fale com o suporte.', code: 'inactive' });
  }

  setSession(req, res, user.email);
  await sql`INSERT INTO login_logs (email) VALUES (${user.email})`;

  send(res, 200, { email: user.email, nome: user.nome });
});
