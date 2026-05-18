import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTanques, fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'

export type ReabastNivel = 'critico' | 'alerta' | 'ok'

export interface UltimaCompra {
  data: string  // yyyy-MM-dd
  volume: number  // litros
  valorEstimado: number  // estimativa: volume × precoCusto naquela data
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
  nivelPct: number
  nivel: ReabastNivel
  /** Última nota de compra registrada no LMC (90 dias atrás), null se não houver. */
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
    queryFn: () =>
      fetchAllPages(
        (p) => fetchLmc({
          empresaCodigo: empresasCodes,
          dataInicial: lmcInicial, dataFinal: lmcFinal,
          ultimoCodigo: p.ultimoCodigo, limite: p.limite,
        }),
        1000, 50
      ),
    enabled: includeDetalhes && empresasCodes.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  // Indexa LMC por (empresa, tanque) → lista ordenada de entries
  // Também acumula consumo do mês corrente por tanque.
  const detalhesByTanque = useMemo(() => {
    const m = new Map<string, {
      ultimaCompra: UltimaCompra | null
      consumoMes: number  // soma saída do mês corrente
    }>()
    if (!includeDetalhes) return m

    const currentMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const todayStr = fmtDate(today)

    for (const lmc of lmcData) {
      // Acumula saída do mês corrente
      if (lmc.dataMovimento >= currentMonthStart && lmc.dataMovimento <= todayStr) {
        // Cada LMC tem lmcTanque[] com saída por tanque? Olhando o tipo,
        // tem `lmcTanque[]` (abertura/fechamento) e `saida` no nível LMC raiz.
        // Pra precisão por tanque, somo do tanqueCodigo do lmcTanque[0] (se há).
        const totalSaidaTanqueLmc = lmc.lmcTanque?.reduce((s, t) => {
          // Saída = abertura - fechamento (positivo quando consumiu)
          return s + Math.max(0, (t.abertura ?? 0) - (t.fechamento ?? 0))
        }, 0) ?? 0
        // Se há múltiplos tanques no LMC, distribuir proporcionalmente
        for (const lt of lmc.lmcTanque ?? []) {
          const consumoTanque = Math.max(0, (lt.abertura ?? 0) - (lt.fechamento ?? 0))
          if (consumoTanque <= 0) continue
          const key = `${lmc.empresaCodigo}-${lt.tanqueCodigo}`
          const prev = m.get(key) ?? { ultimaCompra: null, consumoMes: 0 }
          prev.consumoMes += consumoTanque
          m.set(key, prev)
        }
        void totalSaidaTanqueLmc  // mantido como referência mental
      }

      // Última compra: itera lmcNota
      for (const nota of lmc.lmcNota ?? []) {
        if (!nota.volumeRecebido || nota.volumeRecebido <= 0) continue
        const key = `${lmc.empresaCodigo}-${nota.tanqueCodigo}`
        const prev = m.get(key) ?? { ultimaCompra: null, consumoMes: 0 }
        const isLatest = !prev.ultimaCompra || (nota.dataEntrada > prev.ultimaCompra.data)
        if (isLatest) {
          prev.ultimaCompra = {
            data: nota.dataEntrada.slice(0, 10),
            volume: nota.volumeRecebido,
            valorEstimado: nota.volumeRecebido * (lmc.precoCusto || 0),
          }
        }
        m.set(key, prev)
      }
    }
    return m
  }, [lmcData, includeDetalhes, today])

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
        const estoqueAtual = Number(t.estoqueEscritural) || 0
        const nivelPct = capacidade > 0 ? (estoqueAtual / capacidade) * 100 : 0
        const nivel: ReabastNivel =
          nivelPct < CRITICO_THRESHOLD ? 'critico' :
          nivelPct < ALERTA_THRESHOLD ? 'alerta' : 'ok'

        const detalhe = detalhesByTanque.get(`${t.empresaCodigo}-${t.tanqueCodigo}`)
        const consumoMes = detalhe?.consumoMes ?? 0
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
          tanqueNome: t.name || `Tanque ${t.tanqueCodigo}`,
          produtoCodigo: t.produtoCodigo,
          produtoNome: produtoMap.get(t.produtoCodigo) ?? `Produto ${t.produtoCodigo}`,
          capacidade,
          estoqueAtual,
          nivelPct,
          nivel,
          ultimaCompra: detalhe?.ultimaCompra ?? null,
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
  }, [tanquesAll, empresaMap, produtoMap, detalhesByTanque, diasDecorridos, diasRestantesMes])

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
