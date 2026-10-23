// /api/admin?action=...   (todas as rotas exigem o header x-admin-token)
//
//   GET    status      → diagnóstico completo (variáveis, conexão, tabelas, contagens)
//   POST   setup       → cria/atualiza as tabelas (idempotente)
//   GET    dashboard   → números e listas para o painel
//   GET    members     → lista membros (?q= filtra por email/nome)
//   POST   members     → adiciona ou reativa um membro { email, nome }
//   PATCH  members     → ativa/desativa { email, ativo }
//   DELETE members     → remove { email }
//   POST   import      → importa CSV já lido { members:[{email,nome}], dryRun }
//
// Tudo num único arquivo para caber no limite de funções do plano Hobby da Vercel.
const { getSql, ensureSchema, missingTables, normalizeEmail, isValidEmail } = require('../lib/db');
const { send, getBody, requireAdmin, handler } = require('../lib/http');

const actions = {
  'GET status': async (req, res) => {
    const env = {
      DATABASE_URL: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL),
      AUTH_SECRET: !!process.env.AUTH_SECRET,
      ADMIN_SECRET: !!process.env.ADMIN_SECRET,
      HOTMART_SECRET: !!process.env.HOTMART_SECRET,
    };
    const report = { env, banco: { conectado: false }, tabelas: { faltando: [] }, contagens: null };
    if (!env.DATABASE_URL) return send(res, 200, report);

    const t0 = Date.now();
    try {
      const sql = getSql();
      const [{ version }] = await sql`SELECT version()`;
      report.banco = { conectado: true, latenciaMs: Date.now() - t0, versao: version.split(' ').slice(0, 2).join(' ') };
      report.tabelas.faltando = await missingTables();
      if (report.tabelas.faltando.length === 0) {
        const [c] = await sql`
          SELECT (SELECT count(*) FROM members)::int     AS membros,
                 (SELECT count(*) FROM login_logs)::int  AS logins,
                 (SELECT count(*) FROM calc_logs)::int   AS calculos`;
        report.contagens = c;
      }
    } catch (err) {
      report.banco = { conectado: false, erro: err.message };
    }
    send(res, 200, report);
  },

  'POST setup': async (req, res) => {
    await ensureSchema();
    send(res, 200, { ok: true, faltando: await missingTables() });
  },

  'GET dashboard': async (req, res) => {
    const sql = getSql();
    const [stats, logins, calcs, top, serie] = await Promise.all([
      sql`SELECT
            (SELECT count(*) FROM members)::int                                       AS "totalMembros",
            (SELECT count(*) FROM members WHERE ativo)::int                           AS "membrosAtivos",
            (SELECT count(*) FROM login_logs)::int                                    AS "totalLogins",
            (SELECT count(DISTINCT email) FROM login_logs
               WHERE created_at > now() - interval '30 days')::int                    AS "usuarios30d",
            (SELECT count(*) FROM calc_logs)::int                                     AS "totalCalculos",
            (SELECT count(*) FROM calc_logs
               WHERE created_at > now() - interval '7 days')::int                     AS "calculos7d"`,
      sql`SELECT email, created_at FROM login_logs ORDER BY created_at DESC LIMIT 30`,
      sql`SELECT email, nome_produto, dados, created_at FROM calc_logs ORDER BY created_at DESC LIMIT 30`,
      sql`SELECT email, count(*)::int AS total FROM calc_logs GROUP BY email ORDER BY total DESC LIMIT 8`,
      sql`SELECT to_char(d, 'YYYY-MM-DD') AS dia,
                 (SELECT count(*) FROM login_logs l WHERE l.created_at::date = d)::int AS logins,
                 (SELECT count(*) FROM calc_logs  c WHERE c.created_at::date = d)::int AS calculos
          FROM generate_series(current_date - 13, current_date, interval '1 day') AS d
          ORDER BY d`,
    ]);
    send(res, 200, { stats: stats[0], loginsRecentes: logins, calcsRecentes: calcs, topUsuarios: top, serie });
  },

  'GET members': async (req, res) => {
    const sql = getSql();
    const q = `%${String(req.query?.q || '').toLowerCase().trim()}%`;
    const rows = await sql`
      SELECT m.email, m.nome, m.ativo, m.origem, m.created_at,
             (SELECT max(created_at) FROM login_logs l WHERE l.email = m.email) AS ultimo_login
      FROM members m
      WHERE m.email LIKE ${q} OR lower(m.nome) LIKE ${q}
      ORDER BY m.created_at DESC
      LIMIT 500`;
    send(res, 200, { members: rows });
  },

  'POST members': async (req, res) => {
    const body = getBody(req);
    const email = normalizeEmail(body.email);
    const nome = String(body.nome || '').trim();
    if (!isValidEmail(email)) return send(res, 400, { error: 'Email inválido.' });
    const sql = getSql();
    const [row] = await sql`
      INSERT INTO members (email, nome, origem, data_compra)
      VALUES (${email}, ${nome}, 'manual', now())
      ON CONFLICT (email) DO UPDATE
        SET ativo = true,
            nome = CASE WHEN EXCLUDED.nome <> '' THEN EXCLUDED.nome ELSE members.nome END,
            updated_at = now()
      RETURNING email, nome, ativo, (xmax = 0) AS novo`;
    send(res, 200, row);
  },

  'PATCH members': async (req, res) => {
    const body = getBody(req);
    const email = normalizeEmail(body.email);
    const sql = getSql();
    const rows = await sql`
      UPDATE members SET ativo = ${!!body.ativo}, updated_at = now()
      WHERE email = ${email} RETURNING email, ativo`;
    if (!rows.length) return send(res, 404, { error: 'Membro não encontrado.' });
    send(res, 200, rows[0]);
  },

  'DELETE members': async (req, res) => {
    const email = normalizeEmail(getBody(req).email);
    const sql = getSql();
    const rows = await sql`DELETE FROM members WHERE email = ${email} RETURNING email`;
    if (!rows.length) return send(res, 404, { error: 'Membro não encontrado.' });
    send(res, 200, { ok: true });
  },

  'POST import': async (req, res) => {
    const { members, dryRun } = getBody(req);
    if (!Array.isArray(members)) return send(res, 400, { error: 'Lista de membros inválida.' });

    // Normaliza, remove duplicados do próprio CSV e separa inválidos
    const vistos = new Map();
    const invalidos = [];
    for (const m of members) {
      const email = normalizeEmail(m.email);
      if (!isValidEmail(email)) { invalidos.push(m.email || '(vazio)'); continue; }
      if (!vistos.has(email)) vistos.set(email, String(m.nome || '').trim());
    }
    const emails = [...vistos.keys()];
    if (!emails.length) return send(res, 200, { novos: [], existentes: [], invalidos, adicionados: 0 });

    const sql = getSql();
    const existentesRows = await sql`SELECT email FROM members WHERE email = ANY(${emails})`;
    const existentes = existentesRows.map(r => r.email);
    const setExist = new Set(existentes);
    const novos = emails.filter(e => !setExist.has(e));

    if (dryRun || !novos.length) {
      return send(res, 200, { novos, existentes, invalidos, adicionados: 0 });
    }

    const nomes = novos.map(e => vistos.get(e));
    const inseridos = await sql`
      INSERT INTO members (email, nome, origem, data_compra)
      SELECT e, n, 'csv', now() FROM unnest(${novos}::text[], ${nomes}::text[]) AS t(e, n)
      ON CONFLICT (email) DO NOTHING
      RETURNING email`;
    send(res, 200, { novos, existentes, invalidos, adicionados: inseridos.length });
  },
};

module.exports = handler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const action = req.query?.action || new URL(req.url, 'http://x').searchParams.get('action');
  const fn = actions[`${req.method} ${action}`];
  if (!fn) return send(res, 404, { error: `Ação desconhecida: ${req.method} ${action}` });
  await fn(req, res);
});
