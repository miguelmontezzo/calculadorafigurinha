// GET /api/me → dados do usuário logado e o perfil salvo (padrões da calculadora)
const { getSql } = require('../lib/db');
const { send, handler } = require('../lib/http');
const { getUser, clearSession } = require('../lib/session');

module.exports = handler(async (req, res) => {
  const user = await getUser(req);
  if (!user) {
    clearSession(req, res);
    return send(res, 401, { error: 'Sessão expirada. Entre novamente.' });
  }

  const sql = getSql();
  const rows = await sql`SELECT dados FROM user_profiles WHERE email = ${user.email}`;

  send(res, 200, { email: user.email, nome: user.nome, perfil: rows[0]?.dados || null });
});
