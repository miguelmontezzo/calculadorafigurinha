const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Servidor mal configurado.' });
  }

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido.' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const emailLower = email.toLowerCase().trim();

  // 1. Verifica se o email está cadastrado e ativo
  const { data: usuario } = await supabase
    .from('users_autorizados')
    .select('ativo, nome')
    .eq('email', emailLower)
    .maybeSingle();

  if (!usuario) {
    return res.status(404).json({ error: 'Email não cadastrado. Adquira o acesso para continuar.' });
  }

  if (!usuario.ativo) {
    return res.status(403).json({ error: 'Conta inativa. Entre em contato com o suporte.' });
  }

  // 2. Gera magic link — extrai o token sem enviar email
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type:    'magiclink',
    email:   emailLower,
    options: { redirectTo: process.env.SITE_URL + '/calculadora.html' },
  });

  if (linkError) {
    console.error('generateLink error:', linkError);
    return res.status(500).json({ error: 'Erro ao gerar acesso. Tente novamente.' });
  }

  // Retorna o token para o frontend criar a sessão diretamente
  return res.status(200).json({
    token_hash: linkData.properties?.hashed_token,
    nome:       usuario.nome || '',
  });
};
