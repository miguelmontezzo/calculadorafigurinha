const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-admin-token');

  const token = req.headers['x-admin-token'] || '';
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const report = {
    SUPABASE_URL:              !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_SECRET:              !!process.env.ADMIN_SECRET,
    supabase_url_value:        process.env.SUPABASE_URL || '(não definido)',
    table_exists:              null,
    table_error:               null,
    insert_test:               null,
    insert_error:              null,
  };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json(report);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Testa se a tabela existe
  const { data, error: tableError } = await supabase
    .from('users_autorizados')
    .select('email')
    .limit(1);

  report.table_exists = !tableError;
  report.table_error  = tableError ? tableError.message : null;

  return res.status(200).json(report);
};
