// Valida a configuração do banco de ponta a ponta.
// Uso: npm run check            → só verifica
//      npm run check -- --setup → cria as tabelas antes de verificar
//      npm run check -- --add email@x.com "Nome"  → cadastra um membro
const path = require('path');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}

const { getSql, ensureSchema, missingTables, normalizeEmail, isValidEmail } = require('../lib/db');

const ok = msg => console.log(`  ✓ ${msg}`);
const fail = msg => { console.log(`  ✗ ${msg}`); process.exitCode = 1; };

(async () => {
  const args = process.argv.slice(2);
  console.log('\nCalculadora 3D — verificação do banco\n');

  for (const v of ['DATABASE_URL', 'AUTH_SECRET', 'ADMIN_SECRET']) {
    process.env[v] ? ok(`${v} definida`) : fail(`${v} não definida`);
  }
  if (!process.env.DATABASE_URL) return;

  const sql = getSql();
  const t0 = Date.now();
  try {
    await sql`SELECT 1`;
    ok(`Conectou no Neon (${Date.now() - t0}ms)`);
  } catch (err) {
    return fail(`Falha ao conectar: ${err.message}`);
  }

  if (args.includes('--setup')) {
    await ensureSchema();
    ok('Tabelas criadas/atualizadas');
  }

  const faltando = await missingTables();
  if (faltando.length) return fail(`Tabelas faltando: ${faltando.join(', ')} — rode: npm run check -- --setup`);
  ok('Todas as tabelas existem');

  // Teste de escrita e leitura dentro de uma transação desfeita no final
  const probe = `__check_${Date.now()}@teste.local`;
  try {
    await sql.transaction([
      sql`INSERT INTO members (email, nome) VALUES (${probe}, 'teste')`,
      sql`INSERT INTO calc_logs (email, dados) VALUES (${probe}, '{"ok":true}')`,
      sql`DELETE FROM calc_logs WHERE email = ${probe}`,
      sql`DELETE FROM members WHERE email = ${probe}`,
    ]);
    ok('Escrita e leitura funcionando');
  } catch (err) {
    fail(`Erro ao gravar: ${err.message}`);
  }

  const addIdx = args.indexOf('--add');
  if (addIdx >= 0) {
    const email = normalizeEmail(args[addIdx + 1]);
    const nome = args[addIdx + 2] || '';
    if (!isValidEmail(email)) return fail('Email inválido para --add');
    await sql`
      INSERT INTO members (email, nome) VALUES (${email}, ${nome})
      ON CONFLICT (email) DO UPDATE SET ativo = true`;
    ok(`Membro liberado: ${email}`);
  }

  const [c] = await sql`SELECT (SELECT count(*) FROM members)::int AS m, (SELECT count(*) FROM members WHERE ativo)::int AS a`;
  ok(`${c.m} membros cadastrados (${c.a} ativos)`);
  console.log(process.exitCode ? '\nHá problemas acima.\n' : '\nTudo certo ✨\n');
})().catch(err => { fail(err.message); });
