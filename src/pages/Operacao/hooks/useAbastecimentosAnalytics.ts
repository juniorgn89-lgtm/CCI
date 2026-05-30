import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchBombas, fetchBicos, fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import useFuelVendaCost from '@/pages/Operacao/hooks/useFuelVendaCost'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import useAbastCache from '@/pages/Operacao/hooks/useAbastCache'
import { fetchApuracaoDiaria, fetchApuracaoFuelDiaria } from '@/api/supabase/apuracao'

const offsetPeriod = (dateStr: string, monthsBack: number): string => {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() - monthsBack)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface AbastecimentoRow {
  codigo: number
  dataHora: string
  /** Data fiscal (dia do movimento, yyyy-MM-dd) — é por ela que o filtro e os
   * KPIs operam. Pode diferir do dia de `dataHora` em abastecimentos de
   * madrugada (posto que fecha o caixa após a meia-noite). Agrupamentos
   * "por dia" devem usar esta, não `dataHora`. */
  dataFiscal: string
  empresaNome: string
  empresaCodigo: number
  bombaDescricao: string
  bicoCodigo: number
  frentistaNome: string
  frentistaCodigo: number
  combustivelNome: string
  produtoCodigo: number
  litros: number
  valorUnitario: number
  /** Faturamento LÍQUIDO da linha (bruto − desconto), quando o item de venda
   * casa; senão é o valorTotal bruto do abastecimento. */
  valorTotal: number
  /** Desconto (R$) da linha, vindo do item de venda (0 quando não casa). */
  desconto: number
  /** Custo unitário — CMV do item de venda quando casa; senão custo do LMC. */
  precoCusto: number
  lucroBruto: number
  margem: number
  placa: string
  /** Liga o abastecimento ao VendaItem correspondente — usado pra detectar
   * "montagem de cupom" (Qualidade de Dados / fraude). */
  vendaItemCodigo: number
}

export interface DailyRow {
  data: string
  litros: number
  faturamento: number
  custo: number
  lucroBruto: number
  margemPct: number
  abastecimentos: number
  ticketMedio: number
  [key: string]: unknown
}

export interface FuelTypeRow {
  produtoCodigo: number
  nome: string
  litros: number
  faturamento: number
  custo: number
  lucroBruto: number
  precoMedioVenda: number
  precoCustoMedio: number
  lbPorLitro: number
  margem: number
  participacao: number
  [key: string]: unknown
}

export interface LbLitroDaily {
  data: string
  lbPorLitro: number
  litros: number
  lucroBruto: number
  /** Indica se o ponto é projeção (dia futuro). Quando true, os valores são estimativas. */
  isProjected: boolean
  /** Valor real (null em dias futuros) — usado para renderizar série sólida */
  litrosReal: number | null
  lbPorLitroReal: number | null
  /** Valor projetado (null em dias passados; preenchido em hoje pra conectar série) */
  litrosProjetado: number | null
  lbPorLitroProjetado: number | null
  [key: string]: unknown
}

export interface LbLitroProduct {
  nome: string
  litros: number
  lucroBruto: number
  lbPorLitro: number
  participacaoLb: number
  [key: string]: unknown
}

export interface LbLitroMonthly {
  mes: string
  /** null quando o mês não tem custo apurado (senão margem ~100% falsa). */
  lbPorLitro: number | null
  litros: number
  faturamento: number
  /** null quando o mês não tem custo apurado. */
  lucroBruto: number | null
  /** Margem % do mês (lucroBruto / faturamento × 100). null sem custo apurado. */
  margemPct: number | null
  /** True quando este é o mês corrente (tem projeção no end-of-month) */
  isCurrentMonth: boolean
  /** Lucro bruto realizado até o momento do mês corrente; igual a lucroBruto pra meses fechados */
  lucroBrutoReal: number | null
  /** Lucro bruto adicional que falta pra completar o mês (estimativa). Sempre 0 em meses fechados. */
  lucroBrutoProjetadoExtra: number
  /** True quando o mês não tem custo apurado — L.B./margem não calculáveis. */
  semCusto: boolean
}

export interface LbLitroData {
  /** L.B./Litro global — calculado SÓ sobre o volume que tem custo apurado
   * (combustível sem custo entraria com margem ~100% e inflaria o número). */
  global: number
  /** Margem % global, também só sobre o volume com custo. */
  margemGlobal: number
  /** Lucro bruto global (R$), sobre o volume com custo apurado. */
  lucroGlobal: number
  /** % dos litros do período que têm custo apurado (cobertura). < 100 = parte
   * dos litros ficou de fora do cálculo de L.B./margem (custo faltante). */
  coberturaCustoPct: number
  daily: LbLitroDaily[]
  byProduct: LbLitroProduct[]
  monthly: LbLitroMonthly[]
  /** Séries mensais por combustível (do cache por produto) — pro filtro do
   * gráfico "Últimos 12 meses". Chave = nome do combustível. */
  monthlyByFuel: Record<string, LbLitroMonthly[]>
  /** Combustíveis disponíveis nas séries mensais (pro dropdown do filtro). */
  monthlyFuels: string[]
  prevMonthGlobal: number
  /** Lucro bruto do período de comparação (mês/ano ant. conforme o toggle),
   * sobre o volume com custo apurado. Base do delta do card "Lucro bruto". */
  cmpLucro: number
  /** Margem % do período de comparação (mesmo volume com custo). */
  cmpMargem: number
}

export interface ProjectionMeta {
  /** Total de dias do período */
  daysTotal: number
  /** Dias decorridos do período (incluindo hoje, no máximo até dataFinal) */
  daysElapsed: number
  /** Dias restantes do período (a partir de hoje, exclusive) */
  daysRemaining: number
  /** True quando o período é projetável: tem dias decorridos e dias restantes */
  isProjectable: boolean
  /** Fator de extrapolação (daysTotal / daysElapsed). 1 quando não projetável. */
  scaleFactor: number
}

const useAbastecimentosAnalytics = () => {
  const { empresaCodigos, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  const empresaCodigoSingle = empresaCodigos.length === 1 ? empresaCodigos[0] : null

  // Período de comparação honra o toggle global (vs mês ant. / vs ano ant.).
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1
  const prevMonthInicial = offsetPeriod(dataInicial, cmpOffset)
  const prevMonthFinal = offsetPeriod(dataFinal, cmpOffset)
  const lmcDataInicial = offsetPeriod(dataInicial, 3)
  const evolution12mInicial = offsetPeriod(dataFinal, 11)
  const evolution12mInicialFirst = evolution12mInicial.substring(0, 7) + '-01'

  // Conta de empresas permitidas — usado pra calcular cache HIT quando
  // o user não filtrou empresa específica (vê todas da rede).
  const { data: empresasDataForCount } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasDataForCount?.resultados ?? [])
  const empresasPermitidasCount = empresasPermitidas.length

  // Cache raw de abast Supabase pros 2 períodos curtos (current + prev).
  // Pro evolution12m NÃO usamos cache raw — 12 meses × N postos vira
  // ~250k linhas paginadas em chunks de 1000, dando >2min só pra ler.
  // Em vez disso, lemos `apuracao_diaria` agregado por dia × empresa
  // (~360 linhas / posto / ano), que basta pro gráfico mensal de L.B./Litro.
  const abastCacheCurrent = useAbastCache({
    dataInicial,
    dataFinal,
    empresaCodigo: empresaCodigoSingle,
    empresasPermitidasCount,
  })
  const abastCachePrev = useAbastCache({
    dataInicial: prevMonthInicial,
    dataFinal: prevMonthFinal,
    empresaCodigo: empresaCodigoSingle,
    empresasPermitidasCount,
  })

  // Current period — live só quando cache MISS.
  const { data: abastLive = [], isLoading: isLoadingAbastLive } = useQuery({
    queryKey: ['abastecimentos', dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal }),
    enabled: !abastCacheCurrent.isCacheHit && !abastCacheCurrent.isChecking,
    placeholderData: keepPreviousData,
  })

  // Mês anterior — mesmo padrão.
  const { data: prevMonthLive = [] } = useQuery({
    queryKey: ['abastecimentos', prevMonthInicial, prevMonthFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: prevMonthInicial, dataFinal: prevMonthFinal }),
    enabled: !abastCachePrev.isCacheHit && !abastCachePrev.isChecking,
    retry: false,
  })

  // Evolução 12 meses — busca `apuracao_diaria` (já agregado por dia×empresa).
  // Substitui o antigo fetch de raw abast, que era o gargalo principal da aba.
  const evolutionEmpresaCodigos = useMemo(
    () =>
      empresaCodigoSingle != null
        ? [empresaCodigoSingle]
        : empresasPermitidas.map((e) => e.codigo),
    [empresaCodigoSingle, empresasPermitidas],
  )
  const { data: evolutionDaily = [], isLoading: isLoadingEvolution } = useQuery({
    queryKey: ['apuracao-diaria-evolution', evolutionEmpresaCodigos.join(','), evolution12mInicialFirst, dataFinal],
    queryFn: () =>
      fetchApuracaoDiaria({
        empresaCodigos: evolutionEmpresaCodigos,
        dataInicial: evolution12mInicialFirst,
        dataFinal,
      }),
    enabled: evolutionEmpresaCodigos.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  // Quebra por produto (12m) — dá custo/margem + filtro por combustível no
  // gráfico mensal. Fallback p/ evolutionDaily quando um mês ainda não tem essa
  // quebra apurada.
  const { data: fuelProdutoData = [] } = useQuery({
    queryKey: ['apuracao-fuel-produto-evolution', evolutionEmpresaCodigos.join(','), evolution12mInicialFirst, dataFinal],
    queryFn: () =>
      fetchApuracaoFuelDiaria({
        empresaCodigos: evolutionEmpresaCodigos,
        dataInicial: evolution12mInicialFirst,
        dataFinal,
      }),
    enabled: evolutionEmpresaCodigos.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  // Fontes "efetivas": cache quando HIT, live caso contrário. Padrão idêntico
  // ao useOperacaoData — mantém comportamento legado em MISS (sem regressão).
  const abastecimentos = abastCacheCurrent.isCacheHit ? abastCacheCurrent.abastecimentos : abastLive
  const prevMonthAbast = abastCachePrev.isCacheHit ? abastCachePrev.abastecimentos : prevMonthLive
  // evolutionAbast saiu — substituído por `evolutionDaily` (ApuracaoDiariaRow[])
  // que é consumido direto no agregado mensal.

  // Detecta se o cache atual já tem custo embutido. Política lenient:
  // basta UMA row ter preco_custo pra dispensar LMC — o costMap é construído
  // best-effort a partir das rows do cache. Produtos sem custo no cache vão
  // pra lucroBruto=0 (aceitável: melhor mostrar fast com gap do que esperar
  // 5s pelo LMC). Quando NADA tem preco_custo (rows antigas de antes da
  // migration), cai pro LMC live como antes.
  const cacheHasCostEmbedded =
    abastCacheCurrent.isCacheHit &&
    abastCacheCurrent.abastecimentos.length > 0 &&
    abastCacheCurrent.abastecimentos.some((a) => typeof a.precoCusto === 'number' && a.precoCusto > 0)

  const { data: lmcData = [], isLoading: isLoadingLmcRaw } = useQuery({
    queryKey: ['lmc', lmcDataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchLmc({
          empresaCodigo: hasEmpresa ? empresaCodigos : undefined,
          dataInicial: lmcDataInicial, dataFinal,
          ultimoCodigo: p.ultimoCodigo, limite: p.limite,
        }),
        1000, 50
      ),
    // Só dispara LMC DEPOIS que a checagem do cache terminou — evita
    // fetch redundante enquanto isChecking=true e abastecimentos=[].
    // Cancela quando descobrimos que o cache tem custo embutido.
    enabled: !abastCacheCurrent.isChecking && !cacheHasCostEmbedded,
    placeholderData: keepPreviousData,
  })

  // Custo médio (CMV) + desconto por produto, do /VENDA_ITEM (mesma fonte do BI).
  // Substitui o custo do LMC; quando o produto não casa, cai no LMC (fallback).
  const { vendaByProduct } = useFuelVendaCost(empresaCodigos, dataInicial, dataFinal)
  const isLoadingLmc = isLoadingLmcRaw && !cacheHasCostEmbedded

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  const { data: funcionariosData } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => fetchAllPages((p) => fetchFuncionarios({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    staleTime: 30 * 60 * 1000,
  })

  const { data: bombasData } = useQuery({
    queryKey: ['bombas'],
    queryFn: () => fetchBombas(),
    staleTime: 30 * 60 * 1000,
  })

  const { data: bicosData } = useQuery({
    queryKey: ['bicos'],
    queryFn: () => fetchAllPages((p) => fetchBicos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    staleTime: 30 * 60 * 1000,
  })

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  // isLoading: aguarda probes de cache + LMC + live current (quando cache MISS).
  // Quando cache HIT, isLoadingAbastLive sempre é false (query enabled=false).
  const isLoading =
    abastCacheCurrent.isChecking ||
    (isLoadingAbastLive && !abastCacheCurrent.isCacheHit) ||
    isLoadingEvolution ||
    isLoadingLmc
    // abastCachePrev removido do gate — UI renderiza com o atual pronto e
    // delta badges/comparativos enchem quando o prev chegar (sem skeleton).

  const computed = useMemo(() => {
    const productMap = new Map<number, string>()
    for (const p of produtosData ?? []) {
      productMap.set(p.produtoCodigo, p.nome)
      if (p.produtoLmcCodigo) productMap.set(p.produtoLmcCodigo, p.nome)
      productMap.set(p.codigo, p.nome)
    }

    // Ponte entre os códigos do MESMO produto (produtoCodigo / produtoLmcCodigo /
    // codigo). O abastecimento e o LMC às vezes referenciam o combustível por
    // códigos diferentes; sem ligar, o custo (ex.: etanol) não casa e o litro
    // entra como "sem custo", inflando o L.B./margem. Mesma ponte do nome.
    const codeAliases = new Map<number, number[]>()
    for (const p of produtosData ?? []) {
      const codes = [p.produtoCodigo, p.produtoLmcCodigo, p.codigo].filter(
        (c): c is number => typeof c === 'number' && c > 0,
      )
      const uniq = [...new Set(codes)]
      for (const c of codes) codeAliases.set(c, uniq)
    }
    const aliasesOf = (code: number): number[] => codeAliases.get(code) ?? [code]

    const bicoProdutoMap = new Map<number, number>()
    const bicoDescMap = new Map<number, string>()
    for (const bico of bicosData ?? []) {
      bicoProdutoMap.set(bico.bicoCodigo, bico.produtoCodigo)
      const bomba = bombasData?.resultados?.find((b) => b.bombaCodigo === bico.bombaCodigo)
      bicoDescMap.set(bico.bicoCodigo, bomba ? `${bomba.descricao || bomba.bombaReferencia} - Bico ${bico.bicoNumero}` : `Bico ${bico.bicoNumero}`)
    }

    const getProductName = (codigoProduto: number, codigoBico: number): string => {
      const direct = productMap.get(codigoProduto)
      if (direct) return direct
      const prodCode = bicoProdutoMap.get(codigoBico)
      if (prodCode) {
        const name = productMap.get(prodCode)
        if (name) return name
      }
      return codigoProduto ? `Combustível ${codigoProduto}` : '—'
    }

    const funcionarioMap = new Map<number, string>()
    for (const f of funcionariosData ?? []) funcionarioMap.set(f.funcionarioCodigo, f.nome)

    const empresaMap = new Map<number, string>()
    for (const e of empresasData?.resultados ?? []) empresaMap.set(e.codigo, e.fantasia)

    // Constrói o costMap (empresa+produto → precoCusto). Quando os abast do
    // cache trazem `precoCusto` embutido (gravado pela apuração), usa esses
    // valores direto — sem precisar do LMC. Caso contrário, cai no LMC live.
    const costMap = new Map<string, number>()
    if (cacheHasCostEmbedded) {
      for (const a of abastecimentos) {
        if (typeof a.precoCusto !== 'number' || a.precoCusto <= 0) continue
        const key = `${a.empresaCodigo}-${a.codigoProduto}`
        if (!costMap.has(key)) costMap.set(key, a.precoCusto)
      }
    } else {
      const sortedLmc = [...lmcData].sort((a, b) => b.dataMovimento.localeCompare(a.dataMovimento))
      for (const lmc of sortedLmc) {
        for (const prodCode of lmc.produtoCodigo) {
          const key = `${lmc.empresaCodigo}-${prodCode}`
          if (!costMap.has(key) && lmc.precoCusto > 0) costMap.set(key, lmc.precoCusto)
        }
      }
    }
    // Tenta o código direto e os aliases do mesmo produto — assim o custo do
    // LMC casa mesmo quando o abastecimento usa um código diferente.
    const getCost = (emp: number, prod: number): number => {
      for (const alias of aliasesOf(prod)) {
        const v = costMap.get(`${emp}-${alias}`)
        if (typeof v === 'number' && v > 0) return v
      }
      return 0
    }

    // `vendaByProduct` (do useFuelVendaCost) já é alias-expandido (custo médio
    // CMV + taxa de desconto por produto). Custo unitário: CMV do item de venda;
    // cai no LMC se o produto não casar.
    const costOf = (a: { empresaCodigo: number; codigoProduto: number }): number => {
      const v = vendaByProduct.get(a.codigoProduto)
      if (v && v.custoUnit > 0) return v.custoUnit
      return getCost(a.empresaCodigo, a.codigoProduto)
    }
    // Desconto da linha (R$) = valor bruto × taxa de desconto do produto.
    const descOf = (a: { codigoProduto: number; valorTotal: number }): number => {
      const v = vendaByProduct.get(a.codigoProduto)
      return v ? a.valorTotal * v.descRate : 0
    }
    // Faturamento LÍQUIDO da linha = bruto − desconto (igual ao BI).
    const netFatOf = (a: { codigoProduto: number; valorTotal: number }): number =>
      a.valorTotal - descOf(a)

    const matchEmpresa = (code: number) => empresaCodigos.length === 0 || empresaCodigos.includes(code)
    const validProduct = (a: { codigoProduto: number }) => Number(a.codigoProduto) > 0
    // Abasts com data futura são erros de digitação no Quality — não entram
    // nos KPIs/agregados mas são reportados separadamente na UI pra que o
    // consultor identifique e corrija.
    // Checa BOTH dataFiscal E dataHoraAbastecimento: o erro pode estar só em
    // um dos campos, e o agrupamento diário usa dataHoraAbastecimento — se
    // só a hora for futura, a linha aparece sob data futura mesmo com fiscal
    // correta. OR semantics garante que pegamos o caso.
    const todayISO = new Date().toISOString().slice(0, 10)
    const isFuture = (a: { dataFiscal?: string; dataHoraAbastecimento?: string }) => {
      const dF = (a.dataFiscal ?? '').slice(0, 10)
      const dH = (a.dataHoraAbastecimento ?? '').slice(0, 10)
      const fiscalFuturo = dF !== '' && dF > todayISO
      const horaFutura = dH !== '' && dH > todayISO
      return fiscalFuturo || horaFutura
    }
    const baseFiltered = (hasEmpresa ? abastecimentos.filter((a) => matchEmpresa(a.empresaCodigo)) : abastecimentos)
      .filter(validProduct)
    const filtered = baseFiltered.filter((a) => !isFuture(a))
    const futurosCru = baseFiltered.filter(isFuture)
    const filteredPrevMonth = (hasEmpresa ? prevMonthAbast.filter((a) => matchEmpresa(a.empresaCodigo)) : prevMonthAbast)
      .filter(validProduct)
      .filter((a) => !isFuture(a))

    const rows: AbastecimentoRow[] = filtered.map((a) => {
      const cost = costOf(a)
      const custoTotal = cost * a.quantidade
      const desconto = descOf(a)
      const fatLiq = netFatOf(a)
      const lb = fatLiq - custoTotal
      return {
        codigo: a.codigo,
        dataHora: a.dataHoraAbastecimento,
        dataFiscal: (a.dataFiscal || a.dataHoraAbastecimento || '').slice(0, 10),
        empresaNome: empresaMap.get(a.empresaCodigo) ?? `Empresa ${a.empresaCodigo}`,
        empresaCodigo: a.empresaCodigo,
        bombaDescricao: bicoDescMap.get(a.codigoBico) ?? `Bico ${a.codigoBico}`,
        bicoCodigo: a.codigoBico,
        frentistaNome: funcionarioMap.get(a.codigoFrentista) ?? (a.codigoFrentista ? `Frentista ${a.codigoFrentista}` : '—'),
        frentistaCodigo: a.codigoFrentista,
        combustivelNome: getProductName(a.codigoProduto, a.codigoBico),
        produtoCodigo: a.codigoProduto,
        litros: a.quantidade,
        valorUnitario: a.valorUnitario,
        valorTotal: fatLiq,
        desconto,
        precoCusto: cost,
        lucroBruto: lb,
        margem: fatLiq > 0 ? (lb / fatLiq) * 100 : 0,
        placa: a.placa || '—',
        vendaItemCodigo: a.vendaItemCodigo,
      }
    })

    const sumAbast = (list: typeof abastecimentos) => {
      let litros = 0, fat = 0, custo = 0
      for (const a of list) {
        litros += a.quantidade
        fat += netFatOf(a)
        custo += costOf(a) * a.quantidade
      }
      return { litros, faturamento: fat, lucroBruto: fat - custo }
    }

    const current = sumAbast(filtered)

    // Daily
    const byDay = new Map<string, { litros: number; fat: number; custo: number; count: number }>()
    for (const a of filtered) {
      const day = a.dataHoraAbastecimento.split('T')[0]
      const prev = byDay.get(day) ?? { litros: 0, fat: 0, custo: 0, count: 0 }
      const cost = costOf(a)
      byDay.set(day, { litros: prev.litros + a.quantidade, fat: prev.fat + netFatOf(a), custo: prev.custo + cost * a.quantidade, count: prev.count + 1 })
    }
    const dailyData: DailyRow[] = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, v]) => {
        const lb = v.fat - v.custo
        return {
          data,
          litros: v.litros,
          faturamento: v.fat,
          custo: v.custo,
          lucroBruto: lb,
          margemPct: v.fat > 0 ? (lb / v.fat) * 100 : 0,
          abastecimentos: v.count,
          ticketMedio: v.count > 0 ? v.fat / v.count : 0,
        }
      })

    // Fuel type
    const byFuelName = new Map<string, { litros: number; fat: number; custo: number; produtoCodigo: number }>()
    for (const a of filtered) {
      const nome = getProductName(a.codigoProduto, a.codigoBico)
      const prev = byFuelName.get(nome) ?? { litros: 0, fat: 0, custo: 0, produtoCodigo: a.codigoProduto }
      const cost = costOf(a)
      byFuelName.set(nome, { litros: prev.litros + a.quantidade, fat: prev.fat + netFatOf(a), custo: prev.custo + cost * a.quantidade, produtoCodigo: prev.produtoCodigo })
    }
    const fuelTypeData: FuelTypeRow[] = Array.from(byFuelName.entries())
      .map(([nome, v]) => {
        const lb = v.fat - v.custo
        return {
          produtoCodigo: v.produtoCodigo,
          nome,
          litros: v.litros, faturamento: v.fat, custo: v.custo, lucroBruto: lb,
          precoMedioVenda: v.litros > 0 ? v.fat / v.litros : 0,
          precoCustoMedio: v.litros > 0 ? v.custo / v.litros : 0,
          lbPorLitro: v.litros > 0 ? lb / v.litros : 0,
          margem: v.fat > 0 ? (lb / v.fat) * 100 : 0,
          participacao: current.litros > 0 ? (v.litros / current.litros) * 100 : 0,
        }
      })
      .sort((a, b) => b.faturamento - a.faturamento)

    // L.B./Litro daily — gera todos os dias do período, projeta a partir do último dia com dado
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)

    // Map de dados reais por dia (apenas dias com abastecimento)
    const realByDay = new Map<string, { litros: number; lucroBruto: number; lbPorLitro: number }>()
    for (const d of dailyData) {
      if (d.litros <= 0) continue
      const lbpl = d.lucroBruto / d.litros
      realByDay.set(d.data, { litros: d.litros, lucroBruto: d.lucroBruto, lbPorLitro: lbpl })
    }

    // Último dia com dado real — referência pra começar a projeção (cobre tanto
    // gap entre fim dos dados e hoje quanto dias futuros do período)
    const sortedReal = [...realByDay.keys()].sort((a, b) => b.localeCompare(a))
    const lastRealDay = sortedReal[0] ?? ''

    // Médias para projeção: últimos 7 dias com dados (responsivo à tendência recente)
    const last7Days = sortedReal.slice(0, 7).map((day) => realByDay.get(day)!)
    const last7Litros = last7Days.reduce((s, d) => s + d.litros, 0)
    const last7Lucro = last7Days.reduce((s, d) => s + d.lucroBruto, 0)
    const avgLitrosDaily = last7Days.length > 0 ? last7Litros / last7Days.length : 0
    const avgLbPorLitro = last7Litros > 0 ? last7Lucro / last7Litros : 0

    const lbLitroDaily: LbLitroDaily[] = []
    if (dataInicial && dataFinal) {
      const startD = new Date(`${dataInicial}T00:00:00`)
      const endD = new Date(`${dataFinal}T00:00:00`)
      for (const cursor = new Date(startD); cursor <= endD; cursor.setDate(cursor.getDate() + 1)) {
        const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
        const real = realByDay.get(ds)
        const afterLastReal = lastRealDay !== '' && ds > lastRealDay
        const isLastRealDay = ds === lastRealDay

        if (real) {
          // Dia com dado real. A "ponte" para conectar visualmente as séries
          // (real → projetado) só é aplicada na LINHA do L.B./Litro — para o BAR
          // de litros não, evitando duas barras sobrepostas no último dia real.
          lbLitroDaily.push({
            data: ds,
            litros: real.litros,
            lbPorLitro: real.lbPorLitro,
            lucroBruto: real.lucroBruto,
            isProjected: false,
            litrosReal: real.litros,
            lbPorLitroReal: real.lbPorLitro,
            litrosProjetado: null,
            lbPorLitroProjetado: isLastRealDay ? real.lbPorLitro : null,
          })
        } else if (afterLastReal && avgLitrosDaily > 0) {
          // Após o último dia real (gap até hoje + futuro até dataFinal) → projeção
          lbLitroDaily.push({
            data: ds,
            litros: avgLitrosDaily,
            lbPorLitro: avgLbPorLitro,
            lucroBruto: avgLitrosDaily * avgLbPorLitro,
            isProjected: true,
            litrosReal: null,
            lbPorLitroReal: null,
            litrosProjetado: avgLitrosDaily,
            lbPorLitroProjetado: avgLbPorLitro,
          })
        } else {
          // Dia passado sem dado E antes do último dia real → 0 real
          lbLitroDaily.push({
            data: ds,
            litros: 0,
            lbPorLitro: 0,
            lucroBruto: 0,
            isProjected: false,
            litrosReal: 0,
            lbPorLitroReal: 0,
            litrosProjetado: null,
            lbPorLitroProjetado: null,
          })
        }
      }
    } else {
      // Fallback: se não há período, usa apenas os dados reais
      for (const d of dailyData) {
        const lbpl = d.litros > 0 ? d.lucroBruto / d.litros : 0
        lbLitroDaily.push({
          data: d.data,
          litros: d.litros,
          lbPorLitro: lbpl,
          lucroBruto: d.lucroBruto,
          isProjected: false,
          litrosReal: d.litros,
          lbPorLitroReal: lbpl,
          litrosProjetado: null,
          lbPorLitroProjetado: null,
        })
      }
    }

    const lbLitroByProduct: LbLitroProduct[] = fuelTypeData
      .map((f) => ({
        nome: f.nome,
        litros: f.litros,
        lucroBruto: f.lucroBruto,
        lbPorLitro: f.lbPorLitro,
        participacaoLb: current.lucroBruto > 0 ? (f.lucroBruto / current.lucroBruto) * 100 : 0,
      }))
      .sort((a, b) => b.lbPorLitro - a.lbPorLitro)

    // ── Evolução 12 meses ──
    // Fonte primária: apuracao_fuel_diaria (quebra por produto, COM custo via
    // CMV+LMC) → habilita custo/margem + filtro por combustível. Fallback p/
    // meses ainda sem essa quebra: apuracao_diaria agregado (só litros/fat).
    const currentMonthStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`
    const daysInCurrentMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate()
    // Se o último dado real está no mês corrente, usa o dia DELE como "dias decorridos"
    // (cobre o caso de API com sincronização atrasada). Caso contrário cai no calendário.
    const lastRealDayInCurrentMonth = lastRealDay && lastRealDay.startsWith(currentMonthStr)
      ? parseInt(lastRealDay.split('-')[2], 10)
      : 0
    const daysElapsedInMonth = lastRealDayInCurrentMonth > 0 ? lastRealDayInCurrentMonth : todayDate.getDate()

    interface MonthAgg { litros: number; fat: number; custo: number; semCusto: boolean }
    // Constrói uma LbLitroMonthly a partir do agregado do mês (com projeção no
    // mês corrente). semCusto → zera as séries de custo (gap no gráfico em vez
    // de margem 100% falsa).
    const makeMonthly = (mes: string, agg: MonthAgg): LbLitroMonthly => {
      const isCurrentMonth = mes === currentMonthStr
      if (agg.semCusto) {
        return { mes, lbPorLitro: null, litros: agg.litros, faturamento: agg.fat, lucroBruto: null, margemPct: null, isCurrentMonth, lucroBrutoReal: null, lucroBrutoProjetadoExtra: 0, semCusto: true }
      }
      const lb = agg.fat - agg.custo
      let lucroBrutoProjetadoExtra = 0
      let litrosProjetados = agg.litros
      const lbPorLitro = agg.litros > 0 ? lb / agg.litros : 0
      if (isCurrentMonth && daysElapsedInMonth > 0 && daysElapsedInMonth < daysInCurrentMonth) {
        const scale = daysInCurrentMonth / daysElapsedInMonth
        litrosProjetados = agg.litros * scale
        lucroBrutoProjetadoExtra = Math.max(0, lb * scale - lb)
      }
      return { mes, lbPorLitro, litros: litrosProjetados, faturamento: agg.fat, lucroBruto: lb, margemPct: agg.fat > 0 ? (lb / agg.fat) * 100 : 0, isCurrentMonth, lucroBrutoReal: lb, lucroBrutoProjetadoExtra, semCusto: false }
    }

    // Cache por produto: mês → nome do combustível → agregado.
    const fpByMonth = new Map<string, Map<string, { litros: number; fat: number; custo: number }>>()
    const fuelNamesSet = new Set<string>()
    for (const r of fuelProdutoData) {
      if (hasEmpresa && !matchEmpresa(r.empresa_codigo)) continue
      const mes = r.data.substring(0, 7)
      const nome = r.produto_nome ?? `Produto ${r.produto_codigo}`
      fuelNamesSet.add(nome)
      const m = fpByMonth.get(mes) ?? new Map<string, { litros: number; fat: number; custo: number }>()
      const cur = m.get(nome) ?? { litros: 0, fat: 0, custo: 0 }
      cur.litros += r.litros; cur.fat += r.faturamento; cur.custo += r.custo
      m.set(nome, cur)
      fpByMonth.set(mes, m)
    }

    // Agregado (apuracao_diaria) por mês — fallback p/ meses sem quebra.
    const aggByMonth = new Map<string, { litros: number; fat: number }>()
    for (const d of evolutionDaily) {
      if (hasEmpresa && !matchEmpresa(d.empresa_codigo)) continue
      const mes = d.data.substring(0, 7)
      const prev = aggByMonth.get(mes) ?? { litros: 0, fat: 0 }
      aggByMonth.set(mes, { litros: prev.litros + (d.fuel_litros ?? 0), fat: prev.fat + (d.fuel_faturamento ?? 0) })
    }

    const allMonths = Array.from(new Set([...fpByMonth.keys(), ...aggByMonth.keys()])).sort((a, b) => a.localeCompare(b))
    const lbLitroMonthly: LbLitroMonthly[] = allMonths.map((mes) => {
      const fp = fpByMonth.get(mes)
      if (fp) {
        let litros = 0, fat = 0, custo = 0
        for (const v of fp.values()) { litros += v.litros; fat += v.fat; custo += v.custo }
        return makeMonthly(mes, { litros, fat, custo, semCusto: custo <= 0 })
      }
      const a = aggByMonth.get(mes) ?? { litros: 0, fat: 0 }
      return makeMonthly(mes, { litros: a.litros, fat: a.fat, custo: 0, semCusto: true })
    })

    // Séries por combustível (só meses com quebra por produto apurada).
    const monthlyFuels = Array.from(fuelNamesSet).sort((a, b) => a.localeCompare(b))
    const lbLitroMonthlyByFuel: Record<string, LbLitroMonthly[]> = {}
    for (const nome of monthlyFuels) {
      const serie: LbLitroMonthly[] = []
      for (const mes of allMonths) {
        const v = fpByMonth.get(mes)?.get(nome)
        if (!v) continue
        serie.push(makeMonthly(mes, { litros: v.litros, fat: v.fat, custo: v.custo, semCusto: v.custo <= 0 }))
      }
      lbLitroMonthlyByFuel[nome] = serie
    }

    // L.B./Litro e margem global SÓ sobre o volume com custo apurado — combustível
    // sem custo (ex.: etanol sem entrada no LMC) entraria com margem ~100% e
    // inflaria o número. A cobertura sinaliza quanto ficou de fora.
    const hasCost = (a: { empresaCodigo: number; codigoProduto: number }) =>
      costOf(a) > 0
    const coveredSum = sumAbast(filtered.filter(hasCost))
    const prevCoveredSum = sumAbast(filteredPrevMonth.filter(hasCost))
    const lbLitroData: LbLitroData = {
      global: coveredSum.litros > 0 ? coveredSum.lucroBruto / coveredSum.litros : 0,
      margemGlobal: coveredSum.faturamento > 0 ? (coveredSum.lucroBruto / coveredSum.faturamento) * 100 : 0,
      lucroGlobal: coveredSum.lucroBruto,
      coberturaCustoPct: current.litros > 0 ? (coveredSum.litros / current.litros) * 100 : 0,
      daily: lbLitroDaily,
      byProduct: lbLitroByProduct,
      monthly: lbLitroMonthly,
      monthlyByFuel: lbLitroMonthlyByFuel,
      monthlyFuels,
      prevMonthGlobal: prevCoveredSum.litros > 0 ? prevCoveredSum.lucroBruto / prevCoveredSum.litros : 0,
      cmpLucro: prevCoveredSum.lucroBruto,
      cmpMargem: prevCoveredSum.faturamento > 0 ? (prevCoveredSum.lucroBruto / prevCoveredSum.faturamento) * 100 : 0,
    }

    const combustiveis = [...new Set(rows.map((r) => r.combustivelNome))].sort()

    // Linhas com data futura — separadas pros consultores enxergarem o
    // erro de digitação no Quality. Reaproveita o mesmo enriquecimento
    // (nomes de empresa/frentista/produto/bico) usado em `rows`.
    const inconsistenciasFuturas: AbastecimentoRow[] = futurosCru.map((a) => {
      const cost = costOf(a)
      const custoTotal = cost * a.quantidade
      const desconto = descOf(a)
      const fatLiq = netFatOf(a)
      const lb = fatLiq - custoTotal
      return {
        codigo: a.codigo,
        dataHora: a.dataHoraAbastecimento || a.dataFiscal || '',
        dataFiscal: (a.dataFiscal || a.dataHoraAbastecimento || '').slice(0, 10),
        empresaNome: empresaMap.get(a.empresaCodigo) ?? `Empresa ${a.empresaCodigo}`,
        empresaCodigo: a.empresaCodigo,
        bombaDescricao: bicoDescMap.get(a.codigoBico) ?? `Bico ${a.codigoBico}`,
        bicoCodigo: a.codigoBico,
        frentistaNome: funcionarioMap.get(a.codigoFrentista) ?? (a.codigoFrentista ? `Frentista ${a.codigoFrentista}` : '—'),
        frentistaCodigo: a.codigoFrentista,
        combustivelNome: getProductName(a.codigoProduto, a.codigoBico),
        produtoCodigo: a.codigoProduto,
        litros: a.quantidade,
        valorUnitario: a.valorUnitario,
        valorTotal: fatLiq,
        desconto,
        precoCusto: cost,
        lucroBruto: lb,
        margem: fatLiq > 0 ? (lb / fatLiq) * 100 : 0,
        placa: a.placa || '—',
        vendaItemCodigo: a.vendaItemCodigo,
      }
    })

    return { rows, dailyData, fuelTypeData, lbLitroData, combustiveis, inconsistenciasFuturas }
  }, [abastecimentos, prevMonthAbast, evolutionDaily, fuelProdutoData, lmcData, vendaByProduct, cacheHasCostEmbedded, produtosData, funcionariosData, bombasData, bicosData, empresasData, empresaCodigos, hasEmpresa, dataInicial, dataFinal])

  const projectionMeta = useMemo<ProjectionMeta>(() => {
    if (!dataInicial || !dataFinal) {
      return { daysTotal: 0, daysElapsed: 0, daysRemaining: 0, isProjectable: false, scaleFactor: 1 }
    }
    const dayMs = 24 * 3600 * 1000
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDate = new Date(`${dataInicial}T00:00:00`)
    const endDate = new Date(`${dataFinal}T00:00:00`)
    const daysTotal = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / dayMs) + 1)

    if (today < startDate) {
      return { daysTotal, daysElapsed: 0, daysRemaining: daysTotal, isProjectable: false, scaleFactor: 1 }
    }
    if (today > endDate) {
      return { daysTotal, daysElapsed: daysTotal, daysRemaining: 0, isProjectable: false, scaleFactor: 1 }
    }
    const daysElapsed = Math.max(1, Math.round((today.getTime() - startDate.getTime()) / dayMs) + 1)
    const daysRemaining = Math.max(0, Math.round((endDate.getTime() - today.getTime()) / dayMs))
    const isProjectable = daysRemaining > 0 && daysElapsed > 0
    const scaleFactor = isProjectable ? daysTotal / daysElapsed : 1
    return { daysTotal, daysElapsed, daysRemaining, isProjectable, scaleFactor }
  }, [dataInicial, dataFinal])

  return { ...computed, projectionMeta, isLoading }
}

export default useAbastecimentosAnalytics
