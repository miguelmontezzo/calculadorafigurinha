const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Valida token de admin
  const token = req.headers['x-admin-token'] || '';
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const { members } = req.body;

  if (!Array.isArray(members) || members.length === 0) {
    return res.status(400).json({ error: 'Nenhum membro enviado' });
  }

  // Busca emails já cadastrados
  const { data: existentes, error: fetchError } = await supabase
    .from('users_autorizados')
    .select('email');

  if (fetchError) {
    return res.status(500).json({ error: 'Erro ao consultar banco' });
  }

  const emailsExistentes = new Set((existentes || []).map(u => u.email.toLowerCase()));

  // Filtra apenas os novos
  const novos = members.filter(m => {
    const email = (m.email || '').toLowerCase().trim();
    return email && email.includes('@') && !emailsExistentes.has(email);
  });

  const jaExistiam = members.length - novos.length;

  if (novos.length === 0) {
    return res.status(200).json({
      adicionados: 0,
      jaExistiam,
      total: members.length,
    });
  }

  // Insere apenas os novos
  const rows = novos.map(m => ({
    email:       m.email.toLowerCase().trim(),
    nome:        m.nome || '',
    data_compra: new Date().toISOString(),
    ativo:       true,
  }));

  const { error: insertError } = await supabase
    .from('users_autorizados')
    .insert(rows);

  if (insertError) {
    console.error('Insert error:', insertError);
    return res.status(500).json({ error: 'Erro ao inserir membros' });
  }

  return res.status(200).json({
    adicionados: novos.length,
    jaExistiam,
    total: members.length,
  });
};
