// Dados reais pesquisados em junho/2026 — preços médios no mercado brasileiro
const IMPRESSORAS = [
  {
    id: "custom",
    nome: "Personalizada (digitar)",
    watts: 0,
    precoBR: 0,
    vidaUtilH: 2000,
    manutencaoMes: 50,
    numCores: 1,
    nivel: null
  },
  // ── Bambu Lab ──────────────────────────────
  {
    id: "bambu_a1mini",
    nome: "Bambu Lab A1 Mini",
    watts: 57,
    precoBR: 2300,
    vidaUtilH: 2000,
    manutencaoMes: 40,
    numCores: 4, // com AMS Lite
    nivel: "iniciante",
    dica: "Melhor custo-benefício para iniciantes. Muito silenciosa e precisa."
  },
  {
    id: "bambu_a1",
    nome: "Bambu Lab A1",
    watts: 95,
    precoBR: 3300,
    vidaUtilH: 2500,
    manutencaoMes: 50,
    numCores: 4,
    nivel: "intermediario",
    dica: "Excelente para produção. Mesa maior que a A1 Mini."
  },
  {
    id: "bambu_p1s",
    nome: "Bambu Lab P1S",
    watts: 130,
    precoBR: 8200,
    vidaUtilH: 3000,
    manutencaoMes: 80,
    numCores: 4,
    nivel: "avancado",
    dica: "Câmara fechada — ideal para ABS, ASA e materiais técnicos."
  },
  {
    id: "bambu_p1p",
    nome: "Bambu Lab P1P",
    watts: 120,
    precoBR: 5500,
    vidaUtilH: 2500,
    manutencaoMes: 60,
    numCores: 4,
    nivel: "intermediario",
    dica: "Câmara aberta. Bom para PLA e PETG em volume."
  },
  {
    id: "bambu_x1c",
    nome: "Bambu Lab X1C",
    watts: 130,
    precoBR: 9500,
    vidaUtilH: 4000,
    manutencaoMes: 100,
    numCores: 4,
    nivel: "profissional",
    dica: "Topo de linha Bambu. Maior vida útil e precisão."
  },
  // ── Creality ───────────────────────────────
  {
    id: "creality_e3v3se",
    nome: "Creality Ender 3 V3 SE",
    watts: 110,
    precoBR: 1300,
    vidaUtilH: 1500,
    manutencaoMes: 30,
    numCores: 1,
    nivel: "iniciante",
    dica: "A impressora de entrada mais vendida no Brasil. Barata e robusta."
  },
  {
    id: "creality_e3v3ke",
    nome: "Creality Ender 3 V3 KE",
    watts: 120,
    precoBR: 1800,
    vidaUtilH: 1800,
    manutencaoMes: 35,
    numCores: 1,
    nivel: "iniciante",
    dica: "Versão aprimorada com nivelamento automático e Klipper integrado."
  },
  {
    id: "creality_k1",
    nome: "Creality K1",
    watts: 350,
    precoBR: 2500,
    vidaUtilH: 2000,
    manutencaoMes: 50,
    numCores: 1,
    nivel: "intermediario",
    dica: "Alta velocidade (600mm/s). Bom para produção em volume."
  },
  {
    id: "creality_k1max",
    nome: "Creality K1 Max",
    watts: 350,
    precoBR: 3800,
    vidaUtilH: 2000,
    manutencaoMes: 60,
    numCores: 1,
    nivel: "intermediario",
    dica: "Mesa grande 300×300mm. Ideal para peças grandes."
  },
  // ── Prusa ──────────────────────────────────
  {
    id: "prusa_mk4",
    nome: "Prusa MK4",
    watts: 120,
    precoBR: 4200,
    vidaUtilH: 5000,
    manutencaoMes: 40,
    numCores: 1,
    nivel: "avancado",
    dica: "Maior vida útil do mercado. Custo por hora muito baixo a longo prazo."
  },
  {
    id: "prusa_mini",
    nome: "Prusa Mini+",
    watts: 90,
    precoBR: 2800,
    vidaUtilH: 4000,
    manutencaoMes: 30,
    numCores: 1,
    nivel: "intermediario",
    dica: "Compacta e confiável. Ótima para miniaturas e peças pequenas."
  }
];

// Filamentos com preços médios pesquisados no mercado brasileiro (jun/2026)
const FILAMENTOS = [
  {
    id: "pla_basico",
    nome: "PLA Básico",
    precoBR: 79,
    precoMin: 60,
    precoMax: 95,
    falhasPct: 10,
    cor: "#4CAF50",
    dica: "O mais usado. Fácil de imprimir, sem odor forte. Ótimo para iniciantes e decorativos.",
    exemplos: "Miniaturas, decoração, protótipos, brinquedos"
  },
  {
    id: "pla_premium",
    nome: "PLA Premium / Seda / Matte",
    precoBR: 110,
    precoMin: 90,
    precoMax: 140,
    falhasPct: 8,
    cor: "#9C27B0",
    dica: "Acabamento superior. Cores mais vibrantes. Vale o investimento para produtos finais.",
    exemplos: "Itens para venda, decoração premium, presentes"
  },
  {
    id: "petg",
    nome: "PETG",
    precoBR: 99,
    precoMin: 80,
    precoMax: 130,
    falhasPct: 12,
    cor: "#2196F3",
    dica: "Mais resistente que PLA, suporta temperatura mais alta. Leve absorção de umidade.",
    exemplos: "Peças funcionais, suportes, caixas, peças expostas ao sol"
  },
  {
    id: "abs",
    nome: "ABS",
    precoBR: 88,
    precoMin: 70,
    precoMax: 110,
    falhasPct: 18,
    cor: "#FF5722",
    dica: "Resistente e lixável, mas precisa de câmara fechada. Alta taxa de falhas sem ambiente controlado.",
    exemplos: "Peças mecânicas, autopeças, cases"
  },
  {
    id: "tpu",
    nome: "TPU (Flexível)",
    precoBR: 150,
    precoMin: 120,
    precoMax: 200,
    falhasPct: 15,
    cor: "#FF9800",
    dica: "Material flexível e borrachoso. Impressão mais lenta e cuidadosa.",
    exemplos: "Capinhas de celular, solas, juntas, amortecedores"
  },
  {
    id: "asa",
    nome: "ASA",
    precoBR: 130,
    precoMin: 100,
    precoMax: 160,
    falhasPct: 18,
    cor: "#607D8B",
    dica: "Resistente a UV e intempéries. Substituto do ABS para uso externo.",
    exemplos: "Peças para uso externo, autopeças, sinalização"
  }
];
