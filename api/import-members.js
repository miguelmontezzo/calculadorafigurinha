const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verifica variáveis de ambiente
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas');
    return res.status(500).json({ error: 'Configuração do servidor incompleta. Configure as variáveis de ambiente no Vercel.' });
  }

  if (!process.env.ADMIN_SECRET) {
    console.error('Variável ADMIN_SECRET não configurada');
    return res.status(500).json({ error: 'ADMIN_SECRET não configurado no Vercel.' });
  }

  // Valida token de admin
  const token = req.headers['x-admin-token'] || '';
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const { members } = req.body || {};

  if (!Array.isArray(members) || members.length === 0) {
    return res.status(200).json({ adicionados: 0, jaExistiam: 0, total: 0 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Normaliza e filtra emails válidos
  const validos = members
    .map(m => ({
      email: (m.email || '').toLowerCase().trim(),
      nome:  (m.nome  || '').trim(),
    }))
    .filter(m => m.email && m.email.includes('@') && m.email.includes('.'));

  if (validos.length === 0) {
    return res.status(200).json({ adicionados: 0, jaExistiam: 0, total: members.length });
  }

  // Busca quais já existem para calcular o diff
  const emails = validos.map(m => m.email);
  const { data: existentes, error: fetchError } = await supabase
    .from('users_autorizados')
    .select('email')
    .in('email', emails);

  if (fetchError) {
    console.error('Fetch error:', fetchError);
    return res.status(500).json({ error: `Erro ao consultar banco: ${fetchError.message}` });
  }

  const jaExistemSet = new Set((existentes || []).map(u => u.email.toLowerCase()));
  const novos = validos.filter(m => !jaExistemSet.has(m.email));
  const jaExistiam = validos.length - novos.length;

  if (novos.length === 0) {
    return res.status(200).json({ adicionados: 0, jaExistiam, total: members.length });
  }

  // Cria os usuários no Supabase Auth E na tabela users_autorizados
  let adicionados = 0;
  const erros = [];

  for (const m of novos) {
    // 1. Cria (ou ignora se já existe) no Auth — necessário para o OTP funcionar
    const { error: authError } = await supabase.auth.admin.createUser({
      email:            m.email,
      email_confirm:    true,   // marca como confirmado sem precisar de email de confirmação
      user_metadata:    { nome: m.nome },
    });

    // Ignora erro de "usuário já existe" no Auth — apenas garante que está lá
    if (authError && !authError.message.includes('already been registered')) {
      console.error('Auth create error:', m.email, authError.message);
      erros.push(m.email);
      continue;
    }

    // 2. Insere na tabela de autorizados
    const { error: insertError } = await supabase
      .from('users_autorizados')
      .insert({
        email:       m.email,
        nome:        m.nome,
        data_compra: new Date().toISOString(),
        ativo:       true,
      });

    if (insertError) {
      console.error('Insert error:', m.email, insertError.message);
      erros.push(m.email);
      continue;
    }

    adicionados++;
  }

  return res.status(200).json({
    adicionados,
    jaExistiam,
    total:  members.length,
    erros:  erros.length > 0 ? erros : undefined,
  });
};
