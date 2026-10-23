// GET /api/health → checagem pública e rápida: o banco responde e as tabelas existem?
// Não expõe nenhum dado sensível. Detalhes completos ficam em /admin → Sistema.
const { getSql, missingTables } = require('../lib/db');
const { send } = require('../lib/http');

module.exports = async (req, res) => {
  const t0 = Date.now();
  try {
    await getSql()`SELECT 1`;
    const faltando = await missingTables();
    send(res, faltando.length ? 503 : 200, {
      ok: faltando.length === 0,
      banco: 'conectado',
      tabelas: faltando.length ? `faltando: ${faltando.join(', ')}` : 'ok',
      latenciaMs: Date.now() - t0,
    });
  } catch (err) {
    send(res, 503, { ok: false, banco: 'erro', motivo: err.code === 'NO_DATABASE_URL' ? err.message : 'Não foi possível conectar ao banco.' });
  }
};
