import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTanques, fetchLmc, fetchCompraItem } from '@/api/endpoints/combustiveis'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'

export type ReabastNivel = 'critico' | 'alerta' | 'ok'

export interface UltimaCompra {
  data: string  // yyyy-MM-dd
  volume: number  // litros
  valorEstimado: number  // estimativa: volume × precoCusto naquela data
  precoCusto: number  // custo unitário (R$/L) na data da compra
}

export interface ReabastTanque {
  empresaCodigo: number
  empresaNome: string
  tanqueCodigo: number
  tanqueNome: string
  produtoCodigo: number
  produtoNome: string
  capacidade: number
  estoqueAtual: number
  /** Origem do `estoqueAtual`: 'estimado' = físico da última medição do LMC +
   * movimento do book desde então (aproxima o ao-vivo do ERP); 'escritural' =
   * contábil puro do /TANQUES (fallback quando não há medição no LMC). */
  estoqueFonte: 'estimado' | 'escritural'
  /** Data (yyyy-MM-dd) da medição física que ancora a estimativa; null se escritural. */
  medicaoData: string | null
  nivelPct: number
  nivel: ReabastNivel
  /** Última nota de compra do PRODUTO (via /COMPRA_ITEM) — reflete a NF assim que
   * cadastrada; null se não houver nos últimos 90 dias. */
  ultimaCompra: UltimaCompra | null
  /** Consumo médio diário do mês corrente (litros/dia). 0 se sem dados. */
  consumoDiarioMedio: number
  /** Quantos litros faltam comprar pra cobrir o consumo até o fim do mês corrente. */
  necessidadeFimDoMes: number
  /** Estimativa de quantos dias o estoque atual aguenta no ritmo atual. null = não calculável. */
  diasRestantes: number | null
}

const CRITICO_THRESHOLD = 20
const ALERTA_THRESHOLD = 30

interface UseReabastecimentoOptions {
  /** Quando informado, fetcha tanques só dessa empresa (single-posto view). */
  empresaCodigo?: number | null
  /** Quando true, também busca LMC pra derivar última compra + projeção de consumo. */
  includeDetalhes?: boolean
}

const fmtDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const useReabastecimento = (options: UseReabastecimentoOptions = {}) => {
  const { empresaCodigo, includeDetalhes = false } = options

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const empresaMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const e of empresasPermitidas) {
      m.set(e.codigo, e.fantasia || e.razao || `Empresa ${e.codigo}`)
    }
    return m
  }, [empresasPermitidas])

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })
  const produtoMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of produtos) {
      m.set(p.produtoCodigo, p.nome)
      if (p.produtoLmcCodigo) m.set(p.produtoLmcCodigo, p.nome)
      if (p.codigo) m.set(p.codigo, p.nome)
    }
    return m
  }, [produtos])

  const allowedEmpresasCodes = useMemo(
    () => empresasPermitidas.map((e) => e.codigo),
    [empresasPermitidas]
  )
  const empresasCodes = useMemo(() => {
    if (empresaCodigo != null && allowedEmpresasCodes.includes(empresaCodigo)) {
      return [empresaCodigo]
    }
    return allowedEmpresasCodes.slice().sort((a, b) => a - b)
  }, [empresaCodigo, allowedEmpresasCodes])

  // Tanques
  const { data: tanquesAll = [], isLoading } = useQuery({
    queryKey: ['tanques-reabast', empresasCodes.join(',')],
    queryFn: async () => {
      if (empresasCodes.length === 0) return []
      const results = await Promise.all(
        empresasCodes.map((ec) =>
          fetchTanques({ empresaCodigo: ec, limite: 200 }).then((r) => r.resultados ?? [])
        )
      )
      return results.flat()
    },
    enabled: empresasCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  // LMC (opcional) — últimos 90 dias pra cobrir última compra + consumo do mês.
  const today = useMemo(() => new Date(), [])
  const lmcInicial = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 90)
    return fmtDate(d)
  }, [today])
  const lmcFinal = useMemo(() => fmtDate(today), [today])

  const { data: lmcData = [] } = useQuery({
    queryKey: ['lmc-reabast', empresasCodes.join(','), lmcInicial, lmcFinal],
    queryFn: async () => {
      // Fetch por empresa em paralelo — quando passamos array no `empresaCodigo`
      // pra Quality, observamos que `lmcNota[]` vinha vazio pra muitos tanques
      // (provavelmente serialização do filtro). Per-empresa garante dados
      // completos. Mesma estratégia usada em `fetchTanques` acima.
      if (empresasCodes.length === 0) return []
      const results = await Promise.all(
        empresasCodes.map((ec) =>
          fetchAllPages(
            (p) => fetchLmc({
              empresaCodigo: [ec],
              dataInicial: lmcInicial, dataFinal: lmcFinal,
              ultimoCodigo: p.ultimoCodigo, limite: p.limite,
            }),
            1000, 50,
          ),
        ),
      )
      return results.flat()
    },
    enabled: includeDetalhes && empresasCodes.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  // Itens de compra (/COMPRA_ITEM) — mesma janela. Fonte da "última compra":
  // reflete a NF assim que CADASTRADA (não espera a escrituração do LMC) e vem
  // por PRODUTO, casando direto com o produto do tanque. NF cancelada some daqui,
  // então já fica de fora naturalmente.
  const { data: compraItens = [] } = useQuery({
    queryKey: ['compra-itens-reabast', empresasCodes.join(','), lmcInicial, lmcFinal],
    queryFn: async () => {
      if (empresasCodes.length === 0) return []
      const results = await Promise.all(
        empresasCodes.map((ec) =>
          fetchAllPages(
            (p) => fetchCompraItem({ empresaCodigo: [ec], dataInicial: lmcInicial, dataFinal: lmcFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
            1000, 50,
          ),
        ),
      )
      return results.flat()
    },
    enabled: includeDetalhes && empresasCodes.length > 0,
    staleTime: 10 * 60 * 1000,
  })
  // Última compra por (empresa, produto) = item de NF mais recente por dataEntrada.
  const ultimaCompraByProduto = useMemo(() => {
    const m = new Map<string, UltimaCompra>()
    for (const it of compraItens) {
      if (!it.quantidade || it.quantidade <= 0 || !it.dataEntrada) continue
      const key = `${it.empresaCodigo}-${it.produtoCodigo}`
      const data = it.dataEntrada.slice(0, 10)
      const prev = m.get(key)
      if (!prev || data > prev.data) {
        m.set(key, {
          data,
          volume: it.quantidade,
          valorEstimado: it.quantidade * (it.precoCusto || 0),
          precoCusto: it.precoCusto || 0,
        })
      }
    }
    return m
  }, [compraItens])

  // Indexa LMC por (empresa, tanque) → lista ordenada de entries
  // Também acumula consumo do mês corrente por tanque.
  const detalhesByTanque = useMemo(() => {
    // (empresa-tanque) → consumo do mês corrente (soma saída via lmcBico).
    const m = new Map<string, number>()
    if (!includeDetalhes) return m

    const currentMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const todayStr = fmtDate(today)

    for (const lmc of lmcData) {
      // Consumo do mês corrente: usa lmcBico.venda agregado por tanque.
      // `LmcTanque` só expõe abertura/escritural/fechamento — pra tanques com
      // estoque parado (abertura ≈ fechamento) o delta fica zero mesmo com
      // vendas pequenas. Já `LmcBico.venda` é a venda real medida no bico,
      // ligada ao tanque via `tanqueCodigo`.
      if (lmc.dataMovimento >= currentMonthStart && lmc.dataMovimento <= todayStr) {
        for (const lb of lmc.lmcBico ?? []) {
          const venda = lb.venda ?? 0
          if (venda <= 0) continue
          const key = `${lmc.empresaCodigo}-${lb.tanqueCodigo}`
          m.set(key, (m.get(key) ?? 0) + venda)
        }
      }

      // Última compra NÃO vem mais do LMC (que atrasa na escrituração) — agora é
      // do /COMPRA_ITEM por produto (ver `ultimaCompraByProduto`).
    }
    return m
  }, [lmcData, includeDetalhes, today])

  // Âncora física por tanque = medição (fechamento) do LMC mais recente + o
  // escritural DAQUELE dia. Serve pra estimar o estoque "agora": físico da
  // medição + movimento do book desde então (escritural atual − escritural da
  // medição) — aproxima o ao-vivo da "Estoque Rede" do ERP sem gauge. Só dias
  // com medição real (fechamento > 0); guarda a data pra ser honesto no frescor.
  const fisicoByTanque = useMemo(() => {
    const m = new Map<string, { fisico: number; escrituralMedicao: number; data: string }>()
    if (!includeDetalhes) return m
    for (const lmc of lmcData) {
      const data = lmc.dataMovimento?.slice(0, 10)
      if (!data) continue
      for (const lt of lmc.lmcTanque ?? []) {
        if (!lt.fechamento || lt.fechamento <= 0) continue
        const key = `${lmc.empresaCodigo}-${lt.tanqueCodigo}`
        const prev = m.get(key)
        if (!prev || data > prev.data) m.set(key, { fisico: lt.fechamento, escrituralMedicao: lt.escritural ?? 0, data })
      }
    }
    return m
  }, [lmcData, includeDetalhes])

  // Ref do tanque = número sequencial 1..N POR POSTO (ordenado por código), como
  // o "Ref" 1/2/3 do ERP. A API não expõe o código externo real, então numeramos.
  const tanqueSeq = useMemo(() => {
    const byEmpresa = new Map<number, number[]>()
    for (const t of tanquesAll) {
      const arr = byEmpresa.get(t.empresaCodigo) ?? []
      arr.push(t.tanqueCodigo)
      byEmpresa.set(t.empresaCodigo, arr)
    }
    const seq = new Map<string, number>()
    for (const [emp, codes] of byEmpresa) {
      codes.sort((a, b) => a - b)
      codes.forEach((c, i) => seq.set(`${emp}-${c}`, i + 1))
    }
    return seq
  }, [tanquesAll])

  // Dias decorridos e restantes do mês corrente (pra projeção)
  const diasDoMes = useMemo(() => {
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    return last
  }, [today])
  const diasDecorridos = today.getDate()
  const diasRestantesMes = Math.max(0, diasDoMes - diasDecorridos)

  const tanques: ReabastTanque[] = useMemo(() => {
    return tanquesAll
      .map((t) => {
        const capacidade = Number(t.capacidade) || 0
        const estoqueEscritural = Number(t.estoqueEscritural) || 0
        // Estoque estimado "agora" = físico da última medição + movimento do book
        // desde então (escritural atual − escritural do dia da medição). Aproxima
        // o ao-vivo do ERP. Sem medição no LMC → escritural puro (fallback).
        const anchor = fisicoByTanque.get(`${t.empresaCodigo}-${t.tanqueCodigo}`)
        const usaEstimativa = !!anchor && anchor.escrituralMedicao > 0
        const estoqueAtual = usaEstimativa
          ? Math.max(0, anchor!.fisico + (estoqueEscritural - anchor!.escrituralMedicao))
          : estoqueEscritural
        const estoqueFonte: 'estimado' | 'escritural' = usaEstimativa ? 'estimado' : 'escritural'
        const medicaoData = usaEstimativa ? anchor!.data : null
        // Ref do tanque = sequência 1..N por posto (espelha o "Ref" do ERP).
        const tanqueRef = tanqueSeq.get(`${t.empresaCodigo}-${t.tanqueCodigo}`) ?? t.tanqueCodigo
        const nivelPct = capacidade > 0 ? (estoqueAtual / capacidade) * 100 : 0
        const nivel: ReabastNivel =
          nivelPct < CRITICO_THRESHOLD ? 'critico' :
          nivelPct < ALERTA_THRESHOLD ? 'alerta' : 'ok'

        const consumoMes = detalhesByTanque.get(`${t.empresaCodigo}-${t.tanqueCodigo}`) ?? 0
        const ultimaCompra = ultimaCompraByProduto.get(`${t.empresaCodigo}-${t.produtoCodigo}`) ?? null
        const consumoDiarioMedio = diasDecorridos > 0 ? consumoMes / diasDecorridos : 0
        // Necessidade até fim do mês = consumo projetado − estoque atual (se >0).
        const consumoProjetadoRestante = consumoDiarioMedio * diasRestantesMes
        const necessidadeFimDoMes = Math.max(0, consumoProjetadoRestante - estoqueAtual)
        const diasRestantes = consumoDiarioMedio > 0
          ? Math.max(0, Math.floor(estoqueAtual / consumoDiarioMedio))
          : null

        return {
          empresaCodigo: t.empresaCodigo,
          empresaNome: empresaMap.get(t.empresaCodigo) ?? `Empresa ${t.empresaCodigo}`,
          tanqueCodigo: t.tanqueCodigo,
          tanqueNome: t.name || `Tanque ${tanqueRef}`,
          produtoCodigo: t.produtoCodigo,
          produtoNome: produtoMap.get(t.produtoCodigo) ?? `Produto ${t.produtoCodigo}`,
          capacidade,
          estoqueAtual,
          estoqueFonte,
          medicaoData,
          nivelPct,
          nivel,
          ultimaCompra,
          consumoDiarioMedio,
          necessidadeFimDoMes,
          diasRestantes,
        }
      })
      .sort((a, b) => {
        const order: Record<ReabastNivel, number> = { critico: 0, alerta: 1, ok: 2 }
        if (order[a.nivel] !== order[b.nivel]) return order[a.nivel] - order[b.nivel]
        return a.nivelPct - b.nivelPct
      })
  }, [tanquesAll, empresaMap, produtoMap, detalhesByTanque, fisicoByTanque, tanqueSeq, ultimaCompraByProduto, diasDecorridos, diasRestantesMes])

  const baixos = useMemo(() => tanques.filter((t) => t.nivel !== 'ok'), [tanques])
  const criticos = useMemo(() => tanques.filter((t) => t.nivel === 'critico'), [tanques])

  return {
    tanques,
    baixos,
    criticos,
    isLoading,
    hasAlertas: baixos.length > 0,
  }
}

export default useReabastecimento
