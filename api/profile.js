// PUT /api/profile  { dados }  → salva os valores padrão do usuário
const { getSql } = require('../lib/db');
const { send, getBody, handler } = require('../lib/http');
const { getUser } = require('../lib/session');

// Só aceita estes campos, para não guardar lixo vindo do navegador
const CAMPOS = [
  'filamentoId', 'precoKg', 'estado', 'kwh', 'embalagem', 'laborHours',
  'laborRate', 'falhas', 'margem', 'modo', 'impressoraId', 'imposto', 'arredondar',
];

module.exports = handler(async (req, res) => {
  if (req.method !== 'PUT') return send(res, 405, { error: 'Método não permitido' });

  const user = await getUser(req);
  if (!user) return send(res, 401, { error: 'Sessão expirada. Entre novamente.' });

  const entrada = getBody(req).dados || {};
  const dados = {};
  for (const k of CAMPOS) {
    if (entrada[k] !== undefined && entrada[k] !== null && entrada[k] !== '') dados[k] = entrada[k];
  }

  const sql = getSql();
  await sql`
    INSERT INTO user_profiles (email, dados, updated_at)
    VALUES (${user.email}, ${JSON.stringify(dados)}::jsonb, now())
    ON CONFLICT (email) DO UPDATE SET dados = EXCLUDED.dados, updated_at = now()`;

  send(res, 200, { ok: true, dados });
});
