const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Eventos que LIBERAM acesso
const EVENTOS_LIBERAR = new Set([
  'PURCHASE_APPROVED',
  'PURCHASE_COMPLETE',
  'PURCHASE_REACTIVATED',  // reativação após inadimplência
]);

// Eventos que REVOGAM acesso
const EVENTOS_REVOGAR = new Set([
  'PURCHASE_CANCELLED',
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'SUBSCRIPTION_CANCELLATION',
]);

function verificarAssinatura(rawBody, assinaturaRecebida, secret) {
  if (!assinaturaRecebida || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);                          // usa o body bruto, não re-serializado
  const esperada = hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(esperada, 'hex'),
      Buffer.from(assinaturaRecebida, 'hex')
    );
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Lê body raw para verificar assinatura corretamente
  const rawBody = typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body);

  const assinatura = req.headers['x-hotmart-hottok'] || '';

  if (!verificarAssinatura(rawBody, assinatura, process.env.HOTMART_SECRET)) {
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  const body   = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const evento = body?.event;

  const liberar = EVENTOS_LIBERAR.has(evento);
  const revogar = EVENTOS_REVOGAR.has(evento);

  if (!liberar && !revogar) {
    return res.status(200).json({ message: `Evento ignorado: ${evento}` });
  }

  const buyer = body?.data?.buyer;
  if (!buyer?.email) {
    return res.status(400).json({ error: 'Email do comprador não encontrado' });
  }

  const email = buyer.email.toLowerCase().trim();

  if (liberar) {
    const { error } = await supabase
      .from('users_autorizados')
      .upsert(
        {
          email,
          nome:        buyer.name || '',
          data_compra: new Date().toISOString(),
          ativo:       true,
        },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('Supabase upsert error:', error);
      return res.status(500).json({ error: 'Erro ao liberar acesso' });
    }

    return res.status(200).json({ message: `Acesso liberado: ${email}` });
  }

  if (revogar) {
    const { error } = await supabase
      .from('users_autorizados')
      .update({ ativo: false })
      .eq('email', email);

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: 'Erro ao revogar acesso' });
    }

    return res.status(200).json({ message: `Acesso revogado: ${email}` });
  }
};
