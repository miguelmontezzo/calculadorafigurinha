const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Servidor mal configurado.' });
  }

  const token = req.headers['x-admin-token'] || '';
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const [
    { data: logins },
    { data: calcs },
    { data: membros },
  ] = await Promise.all([
    supabase.from('login_logs')
      .select('email, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('calc_logs')
      .select('email, nome_produto, dados, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('users_autorizados')
      .select('email, nome, ativo, created_at'),
  ]);

  // Stats
  const emailsLogin = new Set((logins || []).map(l => l.email));
  const emailsCalc  = new Set((calcs  || []).map(c => c.email));

  // Top usuários por cálculos
  const calcPorEmail = {};
  (calcs || []).forEach(c => {
    calcPorEmail[c.email] = (calcPorEmail[c.email] || 0) + 1;
  });
  const topUsuarios = Object.entries(calcPorEmail)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([email, total]) => ({ email, total }));

  return res.status(200).json({
    stats: {
      totalLogins:     (logins || []).length,
      usuariosAtivos:  emailsLogin.size,
      totalCalculos:   (calcs  || []).length,
      usuariosCalc:    emailsCalc.size,
      totalMembros:    (membros || []).length,
      membrosAtivos:   (membros || []).filter(m => m.ativo).length,
    },
    loginsRecentes: (logins || []).slice(0, 50),
    calcsRecentes:  (calcs  || []).slice(0, 50),
    topUsuarios,
  });
};
