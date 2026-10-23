// Utilitários HTTP compartilhados pelas funções em /api
const crypto = require('crypto');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function getBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return b;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Retorna true se o token de admin for válido; senão já responde o erro.
function requireAdmin(req, res) {
  if (!process.env.ADMIN_SECRET) {
    send(res, 500, { error: 'ADMIN_SECRET não configurado na Vercel.' });
    return false;
  }
  if (!safeEqual(req.headers['x-admin-token'], process.env.ADMIN_SECRET)) {
    send(res, 401, { error: 'Senha de administrador incorreta.' });
    return false;
  }
  return true;
}

// Envolve o handler: captura qualquer exceção e devolve JSON legível.
function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error('[api]', req.url, err);
      if (res.headersSent) return;
      if (err.code === 'NO_DATABASE_URL') return send(res, 500, { error: err.message });
      if (err.code === '42P01') {
        return send(res, 500, { error: 'Tabelas não encontradas. Abra /admin → Sistema → "Criar tabelas".' });
      }
      send(res, 500, { error: 'Erro interno. Tente novamente em instantes.' });
    }
  };
}

module.exports = { send, getBody, safeEqual, requireAdmin, handler };
