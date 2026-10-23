// Conexão com o Neon (Postgres serverless via HTTP — ideal para funções da Vercel)
const { neon } = require('@neondatabase/serverless');

let _sql = null;

function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    const err = new Error('DATABASE_URL não configurada. Adicione a variável de ambiente na Vercel.');
    err.code = 'NO_DATABASE_URL';
    throw err;
  }
  _sql = neon(url);
  return _sql;
}

// ── Schema ────────────────────────────────────────────────────
// Idempotente: pode rodar quantas vezes quiser (CREATE ... IF NOT EXISTS).
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS members (
     email        text PRIMARY KEY,
     nome         text NOT NULL DEFAULT '',
     ativo        boolean NOT NULL DEFAULT true,
     origem       text NOT NULL DEFAULT 'manual',
     data_compra  timestamptz,
     created_at   timestamptz NOT NULL DEFAULT now(),
     updated_at   timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS user_profiles (
     email       text PRIMARY KEY REFERENCES members(email) ON DELETE CASCADE,
     dados       jsonb NOT NULL DEFAULT '{}'::jsonb,
     updated_at  timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS login_logs (
     id          bigserial PRIMARY KEY,
     email       text NOT NULL,
     created_at  timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS login_logs_created_idx ON login_logs (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS calc_logs (
     id            bigserial PRIMARY KEY,
     email         text NOT NULL,
     nome_produto  text NOT NULL DEFAULT '',
     dados         jsonb NOT NULL DEFAULT '{}'::jsonb,
     created_at    timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS calc_logs_created_idx ON calc_logs (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS calc_logs_email_idx ON calc_logs (email)`,
];

const TABLES = ['members', 'user_profiles', 'login_logs', 'calc_logs'];

async function ensureSchema() {
  const sql = getSql();
  for (const stmt of SCHEMA) await sql.query(stmt);
}

async function missingTables() {
  const sql = getSql();
  const rows = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${TABLES})`;
  const found = new Set(rows.map(r => r.table_name));
  return TABLES.filter(t => !found.has(t));
}

function normalizeEmail(v) {
  return String(v || '').toLowerCase().trim();
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

module.exports = { getSql, ensureSchema, missingTables, TABLES, SCHEMA, normalizeEmail, isValidEmail };
