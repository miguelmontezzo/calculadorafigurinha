// Taxas dos marketplaces — revisadas em outubro/2026 (vendedor CNPJ).
// Cada marketplace tem faixas de preço; a faixa usada depende do preço final do anúncio.
// "ate" é exclusivo (preço < ate). Confira sempre no painel do vendedor: as taxas mudam com frequência.
const TAXAS_ATUALIZADAS_EM = 'outubro de 2026';

const MARKETPLACES = [
  {
    id: 'shopee', nome: 'Shopee',
    obs: 'Abaixo de R$ 9 a taxa fixa é metade do preço. Desde 01/10/2026 a taxa fixa até R$ 79,99 é R$ 4,50.',
    faixas: [
      { ate: 80,       comissao: 20, taxaFixa: 4.5, fixaMetadeAbaixoDe: 9 },
      { ate: 100,      comissao: 14, taxaFixa: 16 },
      { ate: 200,      comissao: 14, taxaFixa: 20 },
      { ate: Infinity, comissao: 14, taxaFixa: 26 },
    ],
  },
  {
    id: 'ml_classico', nome: 'Mercado Livre Clássico',
    obs: 'Comissão de 10% a 14% conforme a categoria. Abaixo de R$ 79 há custo operacional (~R$ 6,50, varia com o peso). Acima de R$ 79 você paga parte do frete grátis.',
    faixas: [
      { ate: 79,       comissao: 12, taxaFixa: 6.5 },
      { ate: Infinity, comissao: 12, taxaFixa: 0 },
    ],
  },
  {
    id: 'ml_premium', nome: 'Mercado Livre Premium',
    obs: 'Comissão de 15% a 19% conforme a categoria (inclui parcelamento sem juros). Mesmas regras de custo abaixo de R$ 79.',
    faixas: [
      { ate: 79,       comissao: 17, taxaFixa: 6.5 },
      { ate: Infinity, comissao: 17, taxaFixa: 0 },
    ],
  },
  {
    id: 'amazon', nome: 'Amazon',
    obs: 'Comissão de 10% a 15% conforme a categoria (mínimo R$ 1). O plano Individual cobra R$ 2 por item; o Profissional não.',
    faixas: [
      { ate: Infinity, comissao: 15, taxaFixa: 2 },
    ],
  },
  {
    id: 'tiktok', nome: 'TikTok Shop',
    obs: 'Abaixo de R$ 50: 10% + R$ 4 por item. Acima: 6% + R$ 4. Lojas novas podem ter comissão zero nos primeiros 60 dias. Comissão de afiliados é à parte.',
    faixas: [
      { ate: 50,       comissao: 10, taxaFixa: 4 },
      { ate: Infinity, comissao: 6,  taxaFixa: 4 },
    ],
  },
  {
    id: 'magalu', nome: 'Magalu',
    obs: 'Comissão de 14,8% a 20% conforme a categoria, mais R$ 5 por item vendido.',
    faixas: [
      { ate: Infinity, comissao: 16, taxaFixa: 5 },
    ],
  },
  {
    id: 'shein', nome: 'Shein',
    obs: 'Cerca de 18% na maioria das categorias de casa e decoração, sem taxa fixa.',
    faixas: [
      { ate: Infinity, comissao: 18, taxaFixa: 0 },
    ],
  },
];

// Faixas de lucro sugeridas para impressão 3D (lucro sobre o custo / markup).
// O mercado trabalha com 30%–50% de margem sobre o preço de venda,
// o que equivale a ~45%–100% de lucro sobre o custo.
const MARGENS_SUGERIDAS = [
  { id: 'competitivo', nome: 'Competitivo', valor: 45,  dica: 'Itens simples e muito concorridos (chaveiros, suportes, peças de catálogo). ~31% do preço fica de lucro.' },
  { id: 'recomendado', nome: 'Recomendado', valor: 70,  dica: 'Ponto de equilíbrio do mercado 3D: cobre imprevistos e ainda é competitivo. ~41% do preço fica de lucro.' },
  { id: 'premium',     nome: 'Premium',     valor: 120, dica: 'Peças personalizadas, pintadas, sob encomenda ou de design próprio. ~55% do preço fica de lucro.' },
];
