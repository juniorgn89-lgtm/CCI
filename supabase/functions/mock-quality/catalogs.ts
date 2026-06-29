// @ts-nocheck — Deno (Supabase Edge Runtime), fora do tsc do front.
// Catálogos FIXOS da rede de demonstração "Aurora". Dados fictícios, internamente
// consistentes (códigos estáveis). Os endpoints transacionais (Fase 1+) derivam
// destes catálogos + do gerador determinístico.

/* ─── Postos ─── */
const mkEmpresa = (empresaCodigo: number, fantasia: string, razao: string, cnpj: string, cidade: string) => ({
  codigo: empresaCodigo,
  empresaCodigo,
  cnpj,
  razao,
  fantasia,
  tipoLogradouro: 'AV',
  logradouro: 'Brasil',
  endereco: 'Av. Brasil',
  bairro: 'Centro',
  numero: String(100 + (empresaCodigo % 900)),
  cep: '11000-000',
  cidade,
  uf: 'SP',
  ativo: true,
})

export const POSTOS = [
  mkEmpresa(9001, 'POSTO AURORA CENTRO', 'Aurora Combustíveis Centro Ltda', '11.111.111/0001-01', 'São Paulo'),
  mkEmpresa(9002, 'POSTO AURORA MARGINAL', 'Aurora Combustíveis Marginal Ltda', '11.111.111/0002-02', 'São Paulo'),
  mkEmpresa(9003, 'POSTO AURORA LITORAL', 'Aurora Combustíveis Litoral Ltda', '11.111.111/0003-03', 'Santos'),
  mkEmpresa(9004, 'POSTO AURORA SERRA', 'Aurora Combustíveis Serra Ltda', '11.111.111/0004-04', 'Campos do Jordão'),
]
export const POSTO_CODES = POSTOS.map((p) => p.empresaCodigo)

/* ─── Produtos ─── */
const baseProduto = (produtoCodigo: number, nome: string) => ({
  codigo: produtoCodigo,
  produtoCodigo,
  nome,
  referenciaCodigo: String(produtoCodigo),
  grupoCodigo: 0,
  combustivel: false,
  produtoLmcCodigo: 0,
  tipoCombustivel: '',
  unidadeCompra: 'UN',
  unidadeVenda: 'UN',
  subGrupo1Codigo: 0,
  subGrupo2Codigo: 0,
  subGrupo3Codigo: 0,
  tipoProduto: 'P',
  produtoCodigoExterno: '',
  tributacaoAdRem: 0,
  descricaoFabricante: '',
  registraInventario: 'S',
  ncm: '00000000',
  cest: '',
  misturaBioCombustivel: 0,
  codigoAnp: '',
  percUfOrigemScanc: 0,
  produtoCodigoBarra: [],
  ativo: true,
})
const mkFuel = (produtoCodigo: number, nome: string, tipoCombustivel: string) => ({
  ...baseProduto(produtoCodigo, nome),
  grupoCodigo: 90,
  combustivel: true,
  produtoLmcCodigo: produtoCodigo,
  tipoCombustivel,
  unidadeCompra: 'LT',
  unidadeVenda: 'LT',
})
const mkStore = (produtoCodigo: number, nome: string, grupoCodigo: number) => ({
  ...baseProduto(produtoCodigo, nome),
  grupoCodigo,
})

export const FUELS = [
  mkFuel(9101, 'GASOLINA COMUM', 'GASOLINA C'),
  mkFuel(9102, 'GASOLINA ADITIVADA', 'GASOLINA C'),
  mkFuel(9103, 'ETANOL', 'ALCOOL'),
  mkFuel(9104, 'OLEO DIESEL S10', 'DIESEL'),
  mkFuel(9105, 'OLEO DIESEL S500', 'DIESEL'),
]
// Grupos: 91 = Conveniência, 92 = Automotivos.
export const STORE_PRODUCTS = [
  mkStore(9201, 'ÁGUA MINERAL 500ML', 91),
  mkStore(9202, 'REFRIGERANTE LATA 350ML', 91),
  mkStore(9203, 'CAFÉ EXPRESSO', 91),
  mkStore(9204, 'SALGADO ASSADO', 91),
  mkStore(9205, 'CHOCOLATE BARRA', 91),
  mkStore(9206, 'ENERGÉTICO 250ML', 91),
  mkStore(9207, 'CIGARRO MAÇO', 91),
  mkStore(9208, 'CERVEJA LATA 350ML', 91),
  mkStore(9209, 'GELO 2KG', 91),
  mkStore(9210, 'ISQUEIRO', 91),
  mkStore(9211, 'ÓLEO LUBRIFICANTE 15W40 1L', 92),
  mkStore(9212, 'ADITIVO RADIADOR 1L', 92),
  mkStore(9213, 'PALHETA LIMPADOR', 92),
  mkStore(9214, 'FILTRO DE ÓLEO', 92),
  mkStore(9215, 'ADITIVO COMBUSTÍVEL', 92),
]
export const PRODUTOS = [...FUELS, ...STORE_PRODUCTS]

/** Custo + preço de tabela por combustível (base da rede). O gerador (Fase 1)
 *  aplica variação por posto e o "ajuste de bomba" plantado no Aurora Litoral. */
export const FUEL_PRICE: Record<number, { custo: number; tabela: number }> = {
  9101: { custo: 5.42, tabela: 6.29 },
  9102: { custo: 5.58, tabela: 6.59 },
  9103: { custo: 3.80, tabela: 4.49 },
  9104: { custo: 5.65, tabela: 6.39 },
  9105: { custo: 5.50, tabela: 6.19 },
}

/* ─── Frentistas (6 por posto) ─── */
const NOMES = [
  'João Mendes', 'Carlos Pereira', 'Ana Souza', 'Pedro Lima', 'Marcos Silva', 'Rafael Costa',
  'Bruno Alves', 'Lucas Rocha', 'Tiago Nunes', 'Felipe Ramos', 'Diego Martins', 'André Gomes',
  'Gustavo Dias', 'Rodrigo Castro', 'Vitor Barbosa', 'Paulo Freitas', 'Sérgio Pinto', 'Marcelo Cardoso',
  'Fábio Teixeira', 'Ricardo Moraes', 'Eduardo Vieira', 'Henrique Lopes', 'Leandro Cunha', 'Wesley Santos',
]
const mkFunc = (funcionarioCodigo: number, nome: string, empresaCodigo: number) => ({
  codigo: funcionarioCodigo,
  funcionarioCodigo,
  nome,
  empresaCodigo,
  funcaoCodigo: 1,
  codigoExterno: '',
  dataAdmissao: '2023-01-10',
  dataDemissao: '',
  ativo: true,
})
export const FRENTISTAS = POSTOS.flatMap((p, pi) =>
  Array.from({ length: 6 }, (_, i) => mkFunc(p.empresaCodigo * 100 + (i + 1), NOMES[pi * 6 + i], p.empresaCodigo)),
)

/* ─── Administradoras de cartão ─── */
const mkAdm = (administradoraCodigo: number, descricao: string, tipo: string, percentualComissao: number, taxaTransacao = 0) => ({
  codigo: administradoraCodigo,
  administradoraCodigo,
  empresaCodigo: 9001,
  descricao,
  tipo,
  percentualComissao,
  percentualAntecipacao: 0,
  taxaTransacao,
  ativo: true,
})
export const ADMINISTRADORAS = [
  mkAdm(9301, 'VISA CREDITO', 'Crédito', 2.85),
  mkAdm(9302, 'VISA DEBITO', 'Débito', 0.69),
  mkAdm(9303, 'MASTERCARD CREDITO', 'Crédito', 2.85),
  mkAdm(9304, 'MASTERCARD DEBITO', 'Débito', 0.69),
  mkAdm(9305, 'ELO CREDITO', 'Crédito', 3.20),
  mkAdm(9306, 'ELO DEBITO', 'Débito', 1.20),
  mkAdm(9307, 'PIX', 'PIX', 0.00),
  mkAdm(9308, 'AURORA FROTA', 'Crédito', 1.95),
]

/* ─── Clientes (frota + consumidor final) ─── */
const mkCliente = (codigo: number, nome: string, cpfCnpj: string) => ({
  codigo,
  nome,
  cpfCnpj,
  endereco: 'Av. Brasil, 100',
  cidade: 'São Paulo',
  uf: 'SP',
  telefone: '(11) 4000-0000',
  email: '',
  codigoExterno: '',
  ativo: true,
})
export const CLIENTES = [
  mkCliente(9401, 'Transportadora Litoral Ltda', '22.222.222/0001-01'),
  mkCliente(9402, 'Construtora Aurora SA', '22.222.222/0001-02'),
  mkCliente(9403, 'Frota Veloz Logística', '22.222.222/0001-03'),
  mkCliente(9404, 'AgroSerra Cooperativa', '22.222.222/0001-04'),
  mkCliente(9405, 'Distribuidora Maré Alta', '22.222.222/0001-05'),
  mkCliente(9406, 'Táxi União Cooperativa', '22.222.222/0001-06'),
  mkCliente(9407, 'Locadora BoaViagem', '22.222.222/0001-07'),
  mkCliente(9408, 'Pavimentadora Costa Norte', '22.222.222/0001-08'),
  mkCliente(9409, 'Expresso Pôr do Sol', '22.222.222/0001-09'),
  mkCliente(9410, 'Frigorífico Vale Verde', '22.222.222/0001-10'),
]

/* ─── Infra de pista: bombas + bicos (8 bicos / 4 bombas por posto) ─── */
// Cada bico serve 1 combustível. Gasolina comum, etanol e diesel S10 em 2 bicos;
// aditivada e S500 em 1. bicoCodigo = empresaCodigo*100 + n (n=1..8).
const FUEL_BY_BICO = [9101, 9101, 9102, 9103, 9103, 9104, 9104, 9105]

export const BOMBAS = POSTOS.flatMap((p) =>
  Array.from({ length: 4 }, (_, k) => ({
    codigo: p.empresaCodigo * 10 + (k + 1),
    bombaCodigo: p.empresaCodigo * 10 + (k + 1),
    empresaCodigo: p.empresaCodigo,
    bombaReferencia: String(k + 1),
    descricao: `BOMBA 0${k + 1}`,
    quantidadeBicos: 2,
    ilha: Math.floor(k / 2) + 1,
    serie: '',
    fabricante: 'Wayne',
    modelo: 'Helix',
    tipoMedicaoDigital: true,
    lacres: [],
  })),
)

export const BICOS = POSTOS.flatMap((p) =>
  FUEL_BY_BICO.map((produtoCodigo, i) => {
    const n = i + 1
    return {
      codigo: p.empresaCodigo * 100 + n,
      empresaCodigo: p.empresaCodigo,
      bicoCodigo: p.empresaCodigo * 100 + n,
      bicoNumero: String(n),
      tanqueCodigo: p.empresaCodigo * 100 + produtoCodigo - 9100, // tanque por combustível
      bombaCodigo: p.empresaCodigo * 10 + Math.ceil(n / 2),
      produtoCodigo,
      ultimoUsuarioAlteracao: '',
      produtoLmcCodigo: produtoCodigo,
    }
  }),
)

/** Bicos de um posto (helper pro gerador). */
export const bicosDoPosto = (empresaCodigo: number) => BICOS.filter((b) => b.empresaCodigo === empresaCodigo)

/* ─── Formas de pagamento → administradora (pro mix do gerador) ─── */
// Peso relativo de cada forma no mix de pagamento dos abastecimentos.
export const FORMAS_MIX = [
  { tipo: 'DINHEIRO', nome: 'DINHEIRO', administradoraCodigo: 0, peso: 22 },
  { tipo: 'PIX', nome: 'PIX', administradoraCodigo: 9307, peso: 18 },
  { tipo: 'CARTAO', nome: 'VISA DEBITO', administradoraCodigo: 9302, peso: 16 },
  { tipo: 'CARTAO', nome: 'MASTERCARD DEBITO', administradoraCodigo: 9304, peso: 10 },
  { tipo: 'CARTAO', nome: 'VISA CREDITO', administradoraCodigo: 9301, peso: 14 },
  { tipo: 'CARTAO', nome: 'MASTERCARD CREDITO', administradoraCodigo: 9303, peso: 10 },
  { tipo: 'CARTAO', nome: 'ELO CREDITO', administradoraCodigo: 9305, peso: 4 },
  { tipo: 'CARTAO', nome: 'AURORA FROTA', administradoraCodigo: 9308, peso: 6 },
]
export const ADM_BY_CODE: Record<number, typeof ADMINISTRADORAS[number]> = Object.fromEntries(
  ADMINISTRADORAS.map((a) => [a.administradoraCodigo, a]),
)

