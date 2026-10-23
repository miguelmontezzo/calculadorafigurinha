// Sessão do usuário: cookie HttpOnly assinado com HMAC (sem dependências externas).
// Formato do token: base64url(payload JSON) + "." + base64url(hmac-sha256)
const crypto = require('crypto');
const { getSql } = require('./db');

const COOKIE = 'c3d_session';
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 dias

function secret() {
  const s = process.env.AUTH_SECRET || process.env.ADMIN_SECRET;
  if (!s) throw new Error('AUTH_SECRET não configurado na Vercel.');
  return s;
}

const b64 = buf => Buffer.from(buf).toString('base64url');

function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function isLocal(req) {
  const host = req.headers.host || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

function setSession(req, res, email) {
  const token = sign({ e: email, exp: Date.now() + MAX_AGE_S * 1000 });
  const attrs = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${MAX_AGE_S}`];
  if (!isLocal(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSession(req, res) {
  const attrs = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (!isLocal(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

// Lê o cookie e confirma no banco que o membro continua ativo.
// Assim, revogar acesso no admin (ou via Hotmart) tem efeito imediato.
async function getUser(req) {
  const payload = verify(readCookie(req, COOKIE));
  if (!payload) return null;
  const sql = getSql();
  const rows = await sql`SELECT email, nome, ativo FROM members WHERE email = ${payload.e}`;
  const user = rows[0];
  if (!user || !user.ativo) return null;
  return user;
}

module.exports = { setSession, clearSession, getUser, sign, verify };
