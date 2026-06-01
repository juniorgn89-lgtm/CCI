// ── Formatters (ported from src/lib/formatters.ts) ───────────────────────────
const fmtCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtCurrencyInt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtNumber = (v) => new Intl.NumberFormat('pt-BR').format(v);
const fmtPercent = (v) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v / 100);
const fmtPercent2 = (v) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v / 100);
const fmtLiters = (v) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)} L`;
const fmtCurrencyShort = (v) => {
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(v) >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
};
const fmtLitersShort = (v) => {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1).replace('.', ',')}M L`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K L`;
  return `${v.toFixed(0)} L`;
};
// Período: rótulo a partir de data inicial/final (mês inteiro → "Mai/26"; senão intervalo)
const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtPeriodo = (di, df) => {
  if (!di || !df) return '—';
  const [ay, am, ad] = di.split('-').map(Number);
  const [by, bm, bd] = df.split('-').map(Number);
  if (!ay || !by) return '—';
  const lastDay = new Date(by, bm, 0).getDate();
  if (ay === by && am === bm && ad === 1 && bd === lastDay) {
    return `${MES_ABBR[am - 1]}/${String(ay).slice(2)}`;
  }
  const dd = (n) => String(n).padStart(2, '0');
  if (ay === by) return `${dd(ad)}/${dd(am)} – ${dd(bd)}/${dd(bm)}`;
  return `${dd(ad)}/${dd(am)}/${String(ay).slice(2)} – ${dd(bd)}/${dd(bm)}/${String(by).slice(2)}`;
};
// Chart sequence — exact brief tokens
const CHART_COLORS = ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
// Theme-aware references (resolved by CSS vars per light/dark)
const CHART_VARS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

const MESES = ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'];

// ── Projeção (linear pace) — single source of truth for forecasts ────────────
// Período corrente: Mai/2026 → hoje dia 30 de 31.
const PERIODO = { dia: 30, dias: 31 };
PERIODO.frac = PERIODO.dia / PERIODO.dias;          // fração decorrida do mês
// Projeta fim de mês mantendo o ritmo atual.
const projetar = (realizado) => realizado / PERIODO.frac;
// Projeção do dia (caixa): ~80% do dia decorrido.
const DIA = { frac: 0.8 };
const projetarDia = (v) => v / DIA.frac;

// ── Network (consolidated) — "Central da Rede" ────────────────────────────────
const POSTOS = [
  { codigo: 1, nome: 'Posto Darwin',  cidade: 'Campinas',     faturamento: 1486200, litros: 612400, margem: 12.4, share: 35.1, delta: 6.2 },
  { codigo: 2, nome: 'Posto Newton',  cidade: 'Valinhos',     faturamento: 1042800, litros: 451900, margem: 11.1, share: 24.7, delta: 3.8 },
  { codigo: 3, nome: 'Posto Tesla',   cidade: 'Vinhedo',      faturamento:  792400, litros: 338600, margem: 10.2, share: 18.7, delta: -2.1 },
  { codigo: 4, nome: 'Posto Galileu', cidade: 'Indaiatuba',   faturamento:  531900, litros: 226100, margem: 13.0, share: 12.6, delta: 9.4 },
  { codigo: 5, nome: 'Posto Curie',   cidade: 'Hortolândia',  faturamento:  374300, litros: 158800, margem: 9.6,  share:  8.9, delta: -5.3 },
];

const REDE = {
  faturamento: 4227600,
  litros: 1787800,
  margem: 11.8,
  lucroBruto: 498900,
  abastecimentos: 84512,
  ticketMedio: 187.4,
  margemProj: 11.9, ticketProj: 189.0,
  deltas: { faturamento: 4.7, litros: 2.9, margem: 0.6, lucroBruto: 5.4, abastecimentos: 1.8, ticketMedio: 2.8 },
  // monthly evolution (faturamento R$ + margem %)
  serie: [
    { mes: 'Jun', fat: 3680000, mar: 10.9 }, { mes: 'Jul', fat: 3815000, mar: 11.0 },
    { mes: 'Ago', fat: 3902000, mar: 11.2 }, { mes: 'Set', fat: 3760000, mar: 10.7 },
    { mes: 'Out', fat: 3988000, mar: 11.4 }, { mes: 'Nov', fat: 4070000, mar: 11.5 },
    { mes: 'Dez', fat: 4310000, mar: 12.1 }, { mes: 'Jan', fat: 3920000, mar: 11.0 },
    { mes: 'Fev', fat: 3870000, mar: 10.8 }, { mes: 'Mar', fat: 4055000, mar: 11.3 },
    { mes: 'Abr', fat: 4140000, mar: 11.6 }, { mes: 'Mai', fat: 4227600, mar: 11.8 },
  ],
  pagamentos: [
    { nome: 'Crédito',  valor: 1690000 }, { nome: 'Débito',   valor: 1120000 },
    { nome: 'Pix',      valor:  845000 }, { nome: 'Dinheiro', valor:  380000 },
    { nome: 'Frota',    valor:  192600 },
  ],
};

// ── Vendas › Combustível (single posto: Darwin / Mai-2026) ────────────────────
const FUEL = {
  kpis: {
    litros: 612400, lucroBruto: 184300, faturamento: 3610400, margem: 12.4, margemProj: 12.5, lbLitro: 0.301, lbLitroProj: 0.306, projecao: 648900,
    deltas: { litros: 5.1, lucroBruto: 8.2, margem: 0.5, lbLitro: 3.0, projecao: 5.9 },
  },
  // monthly litros + margem
  serie: [
    { mes: 'Jun', litros: 548000, mar: 11.6 }, { mes: 'Jul', litros: 561000, mar: 11.8 },
    { mes: 'Ago', litros: 572000, mar: 12.0 }, { mes: 'Set', litros: 540000, mar: 11.3 },
    { mes: 'Out', litros: 588000, mar: 12.1 }, { mes: 'Nov', litros: 596000, mar: 12.2 },
    { mes: 'Dez', litros: 631000, mar: 12.8 }, { mes: 'Jan', litros: 559000, mar: 11.5 },
    { mes: 'Fev', litros: 551000, mar: 11.4 }, { mes: 'Mar', litros: 583000, mar: 11.9 },
    { mes: 'Abr', litros: 601000, mar: 12.2 }, { mes: 'Mai', litros: 612400, mar: 12.4 },
  ],
  // per-fuel table — heatmap on margem
  combustiveis: [
    { nome: 'Gasolina Comum',  litros: 248600, fat: 1612900, custo: 1412300, lb: 200600, lbL: 0.807, margem: 12.4 },
    { nome: 'Etanol',          litros: 142900, fat:  571600, custo:  514400, lb:  57200, lbL: 0.400, margem: 10.0 },
    { nome: 'Diesel S10',      litros: 138400, fat:  872000, custo:  748900, lb: 123100, lbL: 0.889, margem: 14.1 },
    { nome: 'Gasolina Aditiv.',litros:  58900, fat:  412300, custo:  349000, lb:  63300, lbL: 1.074, margem: 15.4 },
    { nome: 'Diesel S500',     litros:  23600, fat:  141600, custo:  133900, lb:   7700, lbL: 0.326, margem:  5.4 },
  ],
};

// ── Caixas & Turnos (Darwin, hoje) ────────────────────────────────────────────
const CAIXAS = {
  totalCaixa: 38420.5,
  projDia: 47980,
  diferenca: -184.2,
  turnosAbertos: 2,
  turnos: [
    { id: 'T1', label: 'Turno Manhã',  op: 'M. Andrade', periodo: '06:00 – 14:00', valor: 16240.0, sistema: 16312.4, dif: -72.4, status: 'fechado' },
    { id: 'T2', label: 'Turno Tarde',  op: 'J. Ribeiro',  periodo: '14:00 – 22:00', valor: 14180.5, sistema: 14068.2, dif: 112.3, status: 'fechado' },
    { id: 'T3', label: 'Turno Noite',  op: 'C. Souza',    periodo: '22:00 – 06:00', valor:  8000.0, sistema:  8224.1, dif: -224.1, status: 'aberto', projFim: 14800.0 },
  ],
};

// ── Fechamentos (apuração) ────────────────────────────────────────────────────
const FECH_STATUS = {
  apurado:   { label: 'Apurado',      tone: 'emerald' },
  andamento: { label: 'Em andamento', tone: 'blue' },
  pendente:  { label: 'Pendente',     tone: 'amber' },
  futuro:    { label: '—',            tone: 'navy' },
};
const _fechStatus = (d) => {
  if (d === 30) return 'andamento';
  if (d === 31) return 'futuro';
  if (d === 14 || d === 25) return 'pendente';
  return 'apurado';
};
const FECH_DIAS = Array.from({ length: 31 }, (_, i) => {
  const dia = i + 1;
  const status = _fechStatus(dia);
  const valor = status === 'futuro' ? 0 : Math.round(118000 + (Math.sin(dia * 1.3) * 0.5 + 0.5) * 64000);
  const dif = status === 'apurado' ? Math.round(Math.sin(dia * 1.7) * 480) : 0;
  return { dia, status, valor, dif };
});
const FECHAMENTOS = {
  mes: 'Mai/2026',
  ano: 2026, mesIdx: 4, // maio (0-based) → para layout do calendário
  diasNoMes: 31,
  diasApurados: FECH_DIAS.filter((d) => d.status === 'apurado').length,
  diasPendentes: FECH_DIAS.filter((d) => d.status === 'pendente').length,
  valorConferido: FECH_DIAS.filter((d) => d.status === 'apurado').reduce((s, d) => s + d.valor, 0),
  difAcumulada: FECH_DIAS.reduce((s, d) => s + d.dif, 0),
  ultimo: '29/05',
  dias: FECH_DIAS,
  postos: [
    { nome: 'Posto Darwin',  status: 'apurado',   ultimo: '29/05', apur: 27, total: 29 },
    { nome: 'Posto Newton',  status: 'andamento', ultimo: '30/05', apur: 28, total: 30 },
    { nome: 'Posto Tesla',   status: 'pendente',  ultimo: '27/05', apur: 24, total: 29 },
    { nome: 'Posto Galileu', status: 'apurado',   ultimo: '29/05', apur: 29, total: 29 },
    { nome: 'Posto Curie',   status: 'pendente',  ultimo: '25/05', apur: 22, total: 29 },
  ],
};

// ── Posto › Bombas ───────────────────────────────────────────────────────────
const BOMBAS = {
  bicosAtivos: 12, bicosTotal: 14, volumeDia: 19840, afericoesOk: 6, divergencias: 1,
  deltas: { volumeDia: 2.3 },
  bicos: [
    { id: 'B1', bico: 'Bico 1', produto: 'Gasolina Comum', encerrante: 184920.4, volumeDia: 4120, status: 'ok' },
    { id: 'B2', bico: 'Bico 2', produto: 'Gasolina Comum', encerrante: 172830.1, volumeDia: 3980, status: 'ok' },
    { id: 'B3', bico: 'Bico 3', produto: 'Etanol',         encerrante:  98210.7, volumeDia: 2890, status: 'ok' },
    { id: 'B4', bico: 'Bico 4', produto: 'Etanol',         encerrante:  91450.2, volumeDia: 2610, status: 'afericao' },
    { id: 'B5', bico: 'Bico 5', produto: 'Diesel S10',     encerrante: 142680.9, volumeDia: 3120, status: 'ok' },
    { id: 'B6', bico: 'Bico 6', produto: 'Diesel S10',     encerrante: 138920.5, volumeDia: 2120, status: 'divergencia' },
    { id: 'B7', bico: 'Bico 7', produto: 'Gasolina Aditiv.', encerrante: 64210.3, volumeDia: 1000, status: 'ok' },
  ],
};

// ── Posto › Produtividade (frentistas) ───────────────────────────────────────
const PRODUTIVIDADE = {
  litrosPorFrentista: 8740, atendimentos: 4180, receitaMedia: 296800, tempoMedio: '3,4 min',
  deltas: { litrosPorFrentista: 3.2, atendimentos: 1.8, receitaMedia: 4.1, tempoMedio: -2.6 },
  frentistas: [
    { nome: 'Marcos Andrade',  litros: 11240, atend: 612, receita: 382400, ticket: 624 },
    { nome: 'Júlia Ribeiro',   litros:  9870, atend: 548, receita: 331200, ticket: 604 },
    { nome: 'Carlos Souza',    litros:  8420, atend: 502, receita: 286900, ticket: 571 },
    { nome: 'Ana Lima',        litros:  7310, atend: 461, receita: 248600, ticket: 539 },
    { nome: 'Rafael Dias',     litros:  6190, atend: 398, receita: 210800, ticket: 530 },
  ],
};

// ── Gestão › Qualidade de Dados ──────────────────────────────────────────────
const QUALIDADE = {
  coberturaGeral: 94.2, fontesOk: 4, fontesTotal: 6, lacunas: 3, ultimaSync: 'há 12 min',
  fontes: [
    { nome: 'Vendas (PDV)',             cobertura: 99.8, status: 'ok' },
    { nome: 'Abastecimentos (bombas)',  cobertura: 98.1, status: 'ok' },
    { nome: 'Estoque (tanques)',        cobertura: 97.2, status: 'ok' },
    { nome: 'Financeiro (ERP)',         cobertura: 92.0, status: 'ok' },
    { nome: 'Preços de custo (LMC)',    cobertura: 86.4, status: 'atencao' },
    { nome: 'Conveniência (loja)',      cobertura: 71.5, status: 'critico' },
  ],
  lacunasList: [
    { fonte: 'Custo (LMC)',    detalhe: '14 e 25/05 sem custo apurado', tag: '2 dias' },
    { fonte: 'Conveniência',   detalhe: 'Categorias sem classificação', tag: '312 itens' },
    { fonte: 'Financeiro',     detalhe: 'Conciliação pendente', tag: '1 conta' },
  ],
};

// ── Gestão › Pessoas ─────────────────────────────────────────────────────────
const PESSOAS = {
  total: 38, ativos: 35, frentistas: 24, gerentes: 5, afastados: 3,
  porPosto: [
    { posto: 'Posto Darwin',  total: 11, ativos: 10 },
    { posto: 'Posto Newton',  total:  8, ativos:  8 },
    { posto: 'Posto Tesla',   total:  7, ativos:  6 },
    { posto: 'Posto Galileu', total:  6, ativos:  6 },
    { posto: 'Posto Curie',   total:  6, ativos:  5 },
  ],
  porFuncao: [
    { funcao: 'Frentista', n: 24 }, { funcao: 'Caixa', n: 6 },
    { funcao: 'Gerente', n: 5 }, { funcao: 'Administrativo', n: 3 },
  ],
};

// ── Inteligência › Radar de Preços (Darwin vs concorrência) ──────────────────
const RADAR = {
  atualizado: 'há 2 h',
  produtos: [
    { nome: 'Gasolina Comum', meu: 6.49, mercado: 6.58, min: 6.39, max: 6.79, pos: 2, total: 7 },
    { nome: 'Etanol',         meu: 4.39, mercado: 4.31, min: 4.19, max: 4.59, pos: 5, total: 7 },
    { nome: 'Diesel S10',     meu: 6.29, mercado: 6.41, min: 6.25, max: 6.69, pos: 2, total: 7 },
    { nome: 'Gasolina Adit.', meu: 6.99, mercado: 6.92, min: 6.79, max: 7.19, pos: 4, total: 7 },
  ],
  concorrentes: [
    { nome: 'Posto Áurea',     dist: '0,8 km', gas: 6.39, eta: 4.29, die: 6.25 },
    { nome: 'Auto Posto Via',  dist: '1,4 km', gas: 6.55, eta: 4.35, die: 6.39 },
    { nome: 'Posto Estrela',   dist: '2,1 km', gas: 6.59, eta: 4.45, die: 6.49 },
    { nome: 'Posto Horizonte', dist: '3,0 km', gas: 6.79, eta: 4.59, die: 6.69 },
  ],
};

// ── Menu map (grouped, like desktop) ─────────────────────────────────────────
const MENU_GROUPS = [
  { grupo: 'Geral', itens: [
    { id: 'central', label: 'Central da Rede', short: 'Central', icon: 'layout-dashboard' },
    { id: 'fechamentos', label: 'Fechamentos', short: 'Fechar.', icon: 'file-text' },
  ]},
  { grupo: 'Posto', itens: [
    { id: 'vendas', label: 'Vendas', short: 'Vendas', icon: 'fuel' },
    { id: 'bombas', label: 'Bombas', short: 'Bombas', icon: 'gauge' },
    { id: 'caixas', label: 'Caixas & Turnos', short: 'Caixas', icon: 'wallet' },
    { id: 'produtividade', label: 'Produtividade', short: 'Produt.', icon: 'users' },
  ]},
  { grupo: 'Gestão', itens: [
    { id: 'estoques', label: 'Estoques', short: 'Estoque', icon: 'package' },
    { id: 'financeiro', label: 'Financeiro', short: 'Financ.', icon: 'dollar-sign' },
    { id: 'qualidade', label: 'Qualidade de Dados', short: 'Qualid.', icon: 'database' },
    { id: 'pessoas', label: 'Pessoas', short: 'Pessoas', icon: 'users' },
  ]},
  { grupo: 'Análise', itens: [
    { id: 'inteligencia', label: 'Inteligência', short: 'Intelig.', icon: 'sparkles' },
  ]},
];

const ITEM_BY_ID = Object.fromEntries(MENU_GROUPS.flatMap((g) => g.itens).map((i) => [i.id, i]));
const DEFAULT_BAR = ['central', 'vendas', 'caixas', 'inteligencia'];

// ── Vendas › Visão Geral (posto Darwin) ──────────────────────────────────────
const VISAO = {
  faturamento: 5180300, litros: 612400, ticket: 187.4, margem: 13.1,
  margemProj: 13.2, ticketProj: 189.0,
  deltas: { faturamento: 4.9, litros: 5.1, ticket: 2.1, margem: 0.4 },
  mix: [
    { nome: 'Combustível', valor: 4596200 },
    { nome: 'Conveniência', valor: 487200 },
    { nome: 'Serviços', valor: 96900 },
  ],
  serie: [
    { mes: 'Jun', fat: 4680000 }, { mes: 'Jul', fat: 4790000 }, { mes: 'Ago', fat: 4862000 },
    { mes: 'Set', fat: 4710000 }, { mes: 'Out', fat: 4940000 }, { mes: 'Nov', fat: 5010000 },
    { mes: 'Dez', fat: 5320000 }, { mes: 'Jan', fat: 4880000 }, { mes: 'Fev', fat: 4820000 },
    { mes: 'Mar', fat: 5005000 }, { mes: 'Abr', fat: 5090000 }, { mes: 'Mai', fat: 5180300 },
  ],
};

// ── Vendas › Conveniência (loja) ─────────────────────────────────────────────
const CONV = {
  faturamento: 487200, margem: 28.4, ticket: 24.6, itens: 19820,
  margemProj: 28.7, ticketProj: 24.9,
  deltas: { faturamento: 6.8, margem: 1.2, ticket: 1.5, itens: 4.2 },
  categorias: [
    { nome: 'Bebidas', valor: 164900 }, { nome: 'Tabacaria', valor: 121300 },
    { nome: 'Alimentos', valor: 96800 }, { nome: 'Higiene', valor: 58200 },
    { nome: 'Outros', valor: 46000 },
  ],
  topProdutos: [
    { nome: 'Água 500ml', valor: 38400 }, { nome: 'Cerveja lata', valor: 34100 },
    { nome: 'Cigarro maço', valor: 31800 }, { nome: 'Refrigerante', valor: 27600 },
    { nome: 'Salgado', valor: 21900 }, { nome: 'Café expresso', valor: 18300 },
  ],
};

// ── Vendas › Pista (forecourt) ───────────────────────────────────────────────
const PISTA = {
  abastecimentos: 31240, litrosMedio: 19.6, ticket: 121.3, tempoMedio: '3,4 min',
  litrosMedioProj: 19.8, ticketProj: 122.5,
  deltas: { abastecimentos: 1.8, litrosMedio: 0.9, ticket: 2.4, tempoMedio: -3.1 },
  porProduto: [
    { nome: 'Gasolina Comum', valor: 248600 }, { nome: 'Etanol', valor: 142900 },
    { nome: 'Diesel S10', valor: 138400 }, { nome: 'Gasolina Aditiv.', valor: 58900 },
    { nome: 'Diesel S500', valor: 23600 },
  ],
  pagamentos: [
    { nome: 'Crédito', valor: 198400 }, { nome: 'Débito', valor: 131600 },
    { nome: 'Pix', valor: 99300 }, { nome: 'Dinheiro', valor: 44700 }, { nome: 'Frota', valor: 22600 },
  ],
};

// ── Gestão › Financeiro ──────────────────────────────────────────────────────
const FINANCEIRO = {
  saldoCaixa: 842300, aReceber: 1284600, aReceberVencido: 96400, aPagar: 968200,
  resultadoMes: 312800, receitaMes: 4227600, despesaMes: 3914800,
  margemLiquida: 7.4, margemLiquidaProj: 7.6,
  deltas: { saldoCaixa: 3.1, aReceber: -2.4, aPagar: 1.8, resultadoMes: 6.2 },
  fluxo: [
    { mes: 'Jun', entrada: 3680000, saida: 3470000 }, { mes: 'Jul', entrada: 3815000, saida: 3560000 },
    { mes: 'Ago', entrada: 3902000, saida: 3640000 }, { mes: 'Set', entrada: 3760000, saida: 3580000 },
    { mes: 'Out', entrada: 3988000, saida: 3690000 }, { mes: 'Nov', entrada: 4070000, saida: 3760000 },
    { mes: 'Dez', entrada: 4310000, saida: 3940000 }, { mes: 'Jan', entrada: 3920000, saida: 3700000 },
    { mes: 'Fev', entrada: 3870000, saida: 3660000 }, { mes: 'Mar', entrada: 4055000, saida: 3790000 },
    { mes: 'Abr', entrada: 4140000, saida: 3860000 }, { mes: 'Mai', entrada: 4227600, saida: 3914800 },
  ],
  dre: [
    { label: 'Receita bruta',            valor: 4227600,  tipo: 'normal' },
    { label: '(−) Deduções e impostos',  valor: -612400,  tipo: 'neg' },
    { label: 'Receita líquida',          valor: 3615200,  tipo: 'subtotal' },
    { label: '(−) CMV (custo)',          valor: -3116300, tipo: 'neg' },
    { label: 'Lucro bruto',              valor: 498900,   tipo: 'subtotal' },
    { label: '(−) Despesas operacionais',valor: -186100,  tipo: 'neg' },
    { label: 'Resultado líquido',        valor: 312800,   tipo: 'resultado' },
  ],
  pagar: [
    { faixa: 'Combustível (distribuidora)', valor: 742600 },
    { faixa: 'Fornecedores loja', valor: 134900 },
    { faixa: 'Despesas e serviços', valor: 90700 },
  ],
};

// ── Gestão › Estoques ────────────────────────────────────────────────────────
const ESTOQUES = {
  volumeTotal: 66300, coberturaMedia: 3.4, tanquesAlerta: 1, valorEstoque: 331500,
  deltas: { volumeTotal: -4.2, coberturaMedia: -0.6, valorEstoque: -3.1 },
  tanques: [
    { produto: 'Gasolina Comum',   capacidade: 30000, atual: 21400, vendaDia: 8020, cobertura: 2.7, status: 'ok' },
    { produto: 'Etanol',           capacidade: 20000, atual: 4600,  vendaDia: 4610, cobertura: 1.0, status: 'alerta' },
    { produto: 'Diesel S10',       capacidade: 30000, atual: 19800, vendaDia: 4470, cobertura: 4.4, status: 'ok' },
    { produto: 'Gasolina Aditiv.', capacidade: 15000, atual: 9200,  vendaDia: 1900, cobertura: 4.8, status: 'ok' },
    { produto: 'Diesel S500',      capacidade: 15000, atual: 11300, vendaDia: 760,  cobertura: 14.9, status: 'ok' },
  ],
  reposicao: [
    { produto: 'Etanol',          sugestao: 14000, prazo: 'hoje' },
    { produto: 'Gasolina Comum',  sugestao: 8000,  prazo: '2 dias' },
  ],
};

// ── Inteligência › Análise & Comparação ──────────────────────────────────────
const COMPARA = {
  // por posto: faturamento, litros, margem + variação vs período anterior
  postos: [
    { nome: 'Posto Darwin',  fat: 1486200, litros: 612400, margem: 12.4, varFat: 6.2 },
    { nome: 'Posto Newton',  fat: 1042800, litros: 451900, margem: 11.1, varFat: 3.8 },
    { nome: 'Posto Tesla',   fat:  792400, litros: 338600, margem: 10.2, varFat: -2.1 },
    { nome: 'Posto Galileu', fat:  531900, litros: 226100, margem: 13.0, varFat: 9.4 },
    { nome: 'Posto Curie',   fat:  374300, litros: 158800, margem: 9.6,  varFat: -5.3 },
  ],
  // série comparativa atual vs período anterior (faturamento da rede)
  serie: [
    { mes: 'Jun', atual: 3680000, ant: 3510000 }, { mes: 'Jul', atual: 3815000, ant: 3620000 },
    { mes: 'Ago', atual: 3902000, ant: 3700000 }, { mes: 'Set', atual: 3760000, ant: 3690000 },
    { mes: 'Out', atual: 3988000, ant: 3760000 }, { mes: 'Nov', atual: 4070000, ant: 3820000 },
    { mes: 'Dez', atual: 4310000, ant: 3990000 }, { mes: 'Jan', atual: 3920000, ant: 3780000 },
    { mes: 'Fev', atual: 3870000, ant: 3740000 }, { mes: 'Mar', atual: 4055000, ant: 3860000 },
    { mes: 'Abr', atual: 4140000, ant: 3910000 }, { mes: 'Mai', atual: 4227600, ant: 4040000 },
  ],
};

const BOTTOM_TABS = [
  { id: 'central', label: 'Central', icon: 'layout-dashboard' },
  { id: 'vendas', label: 'Vendas', icon: 'fuel' },
  { id: 'caixas', label: 'Caixas', icon: 'wallet' },
  { id: 'inteligencia', label: 'Intelig.', icon: 'sparkles' },
];

const POSTO_OPTIONS = [
  { codigo: 0, nome: 'Toda a Rede' },
  ...POSTOS.map((p) => ({ codigo: p.codigo, nome: p.nome })),
];

Object.assign(window, {
  fmtCurrency, fmtCurrencyInt, fmtNumber, fmtPercent, fmtPercent2, fmtLiters,
  fmtCurrencyShort, fmtLitersShort, fmtPeriodo, MES_ABBR, CHART_COLORS, CHART_VARS, MESES,
  PERIODO, projetar, DIA, projetarDia,
  POSTOS, REDE, FUEL, CAIXAS, RADAR, FECHAMENTOS, FECH_STATUS, MENU_GROUPS, BOTTOM_TABS, POSTO_OPTIONS,
  VISAO, CONV, PISTA, COMPARA, FINANCEIRO, ESTOQUES, BOMBAS, PRODUTIVIDADE, QUALIDADE, PESSOAS,
  ITEM_BY_ID, DEFAULT_BAR,
});
