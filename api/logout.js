// POST /api/logout → apaga o cookie de sessão
const { send, handler } = require('../lib/http');
const { clearSession } = require('../lib/session');

module.exports = handler(async (req, res) => {
  clearSession(req, res);
  send(res, 200, { ok: true });
});
