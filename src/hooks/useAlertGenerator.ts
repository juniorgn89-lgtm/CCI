import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { useNotificationStore, type AppAlert } from '@/store/notifications'
import { useManutencaoStore } from '@/store/manutencao'
import type { PaginatedResponse } from '@/api/types/common'
import type { ProdutoEstoque } from '@/api/types/estoque'
import type { TituloReceber, TituloPagar } from '@/api/types/financeiro'
import type { Abastecimento, Bomba, Bico } from '@/api/types/combustivel'
import type { Produto } from '@/api/types/produto'
import type { Empresa } from '@/api/types/empresa'
import { formatCurrency } from '@/lib/formatters'

const CHECK_INTERVAL_MS = 60_000

const useAlertGenerator = () => {
  const queryClient = useQueryClient()
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const setAlerts = useNotificationStore((s) => s.setAlerts)
  const empresaCodigo = empresaCodigos[0] ?? null

  const generateAlerts = useCallback(() => {
    const alerts: AppAlert[] = []
    const now = Date.now()

    // Build product name map from cache
    const produtosCache = queryClient.getQueryData<Produto[]>(['produtos'])
    const produtoMap = new Map<number, string>()
    if (produtosCache) {
      for (const p of produtosCache) {
        produtoMap.set(p.produtoCodigo, p.nome)
      }
    }

    // Build empresa name map — usado pra rotular alertas por posto
    const empresasCache = queryClient.getQueryData<PaginatedResponse<Empresa>>(['empresas'])
    const empresaNomeMap = new Map<number, string>()
    for (const e of empresasCache?.resultados ?? []) {
      empresaNomeMap.set(e.codigo, e.fantasia || e.razao || `Posto ${e.codigo}`)
    }
    const nomeDoPosto = (cod: number): string =>
      empresaNomeMap.get(cod) ?? `Posto ${cod}`

    // --- Estoque alerts ---
    const estoqueCache = queryClient.getQueryData<PaginatedResponse<ProdutoEstoque>>(
      ['produtoEstoque', empresaCodigo]
    )

    if (estoqueCache?.resultados && empresaCodigo !== null) {
      const items = estoqueCache.resultados
      const posto = nomeDoPosto(empresaCodigo)
      let zeroCount = 0
      let criticalCount = 0

      for (const pe of items) {
        const saldo = pe.saldoEstoque
          ? pe.saldoEstoque.reduce((sum, se) => sum + se.quantidade, 0)
          : pe.saldo

        if (saldo <= 0) zeroCount++
        else if (saldo <= 5) criticalCount++
      }

      if (zeroCount > 0) {
        alerts.push({
          id: `estoque-zero-${empresaCodigo}`,
          category: 'estoque',
          severity: 'danger',
          title: `${zeroCount} produto${zeroCount > 1 ? 's' : ''} sem estoque em ${posto}`,
          description: 'Verifique os produtos com saldo zerado para evitar rupturas.',
          timestamp: now,
          read: false,
          empresaCodigo,
          empresaNome: posto,
        })
      }

      if (criticalCount > 0) {
        alerts.push({
          id: `estoque-critico-${empresaCodigo}`,
          category: 'estoque',
          severity: 'warning',
          title: `${criticalCount} produto${criticalCount > 1 ? 's' : ''} com estoque crítico em ${posto}`,
          description: 'Produtos com saldo igual ou inferior a 5 unidades.',
          timestamp: now,
          read: false,
          empresaCodigo,
          empresaNome: posto,
        })
      }
    }

    // --- Financeiro alerts (Receber) ---
    const receberCache = queryClient.getQueryData<PaginatedResponse<TituloReceber>>(
      ['titulosReceber', empresaCodigo, dataInicial, dataFinal]
    )

    if (receberCache?.resultados && empresaCodigo !== null) {
      const posto = nomeDoPosto(empresaCodigo)
      const hoje = new Date().toISOString().split('T')[0]
      const seteDiasMs = 7 * 24 * 60 * 60 * 1000
      const seteDias = new Date(Date.now() + seteDiasMs).toISOString().split('T')[0]

      const pendentes = receberCache.resultados.filter((t) => t.pendente)

      const vencidos = pendentes.filter((t) => t.dataVencimento < hoje)
      const vencidosValor = vencidos.reduce((acc, t) => acc + t.valor, 0)

      const vencemEmBreve = pendentes.filter(
        (t) => t.dataVencimento >= hoje && t.dataVencimento <= seteDias
      )

      if (vencidos.length > 0) {
        alerts.push({
          id: `financeiro-overdue-receber-${empresaCodigo}`,
          category: 'financeiro',
          severity: 'danger',
          title: `${vencidos.length} título${vencidos.length > 1 ? 's' : ''} vencido${vencidos.length > 1 ? 's' : ''} a receber em ${posto}`,
          description: `Total vencido: ${formatCurrency(vencidosValor)}`,
          timestamp: now,
          read: false,
          empresaCodigo,
          empresaNome: posto,
        })
      }

      if (vencemEmBreve.length > 0) {
        alerts.push({
          id: `financeiro-soon-receber-${empresaCodigo}`,
          category: 'financeiro',
          severity: 'warning',
          title: `${vencemEmBreve.length} título${vencemEmBreve.length > 1 ? 's' : ''} vencem nos próximos 7 dias em ${posto}`,
          description: 'Acompanhe os recebíveis com vencimento próximo.',
          timestamp: now,
          read: false,
          empresaCodigo,
          empresaNome: posto,
        })
      }
    }

    // --- Financeiro alerts (Pagar) ---
    const pagarCache = queryClient.getQueryData<PaginatedResponse<TituloPagar>>(
      ['titulosPagar', empresaCodigo, dataInicial, dataFinal]
    )

    if (pagarCache?.resultados && empresaCodigo !== null) {
      const posto = nomeDoPosto(empresaCodigo)
      const hoje = new Date().toISOString().split('T')[0]

      const abertos = pagarCache.resultados.filter((t) => t.situacao !== 'PAGO' && t.situacao !== 'CANCELADO')
      const vencidos = abertos.filter((t) => t.vencimento < hoje)
      const vencidosValor = vencidos.reduce((acc, t) => acc + (t.valor - t.valorPago), 0)

      if (vencidos.length > 0) {
        alerts.push({
          id: `financeiro-overdue-pagar-${empresaCodigo}`,
          category: 'financeiro',
          severity: 'danger',
          title: `${vencidos.length} título${vencidos.length > 1 ? 's' : ''} vencido${vencidos.length > 1 ? 's' : ''} a pagar em ${posto}`,
          description: `Total vencido: ${formatCurrency(vencidosValor)}`,
          timestamp: now,
          read: false,
          empresaCodigo,
          empresaNome: posto,
        })
      }
    }

    // --- Combustivel alerts (margin) ---
    // Por empresa: agrupa abastecimentos e gera UM alerta por posto com margem
    // abaixo de 5%. Antes era um alerta global, sem indicação do posto culpado.
    const abastecimentosCache = queryClient.getQueryData<Abastecimento[]>(
      ['abastecimentos', dataInicial, dataFinal]
    )

    if (abastecimentosCache && abastecimentosCache.length > 0) {
      type Totals = { fat: number; custo: number }
      const porEmpresa = new Map<number, Totals>()
      for (const a of abastecimentosCache) {
        const prev = porEmpresa.get(a.empresaCodigo) ?? { fat: 0, custo: 0 }
        porEmpresa.set(a.empresaCodigo, {
          fat: prev.fat + a.valorTotal,
          custo: prev.custo + a.precoCadastro * a.quantidade,
        })
      }

      for (const [empCod, totals] of porEmpresa) {
        if (totals.fat <= 0) continue
        const margem = ((totals.fat - totals.custo) / totals.fat) * 100
        if (margem < 5 && margem >= 0) {
          const posto = nomeDoPosto(empCod)
          alerts.push({
            id: `combustivel-margem-baixa-${empCod}`,
            category: 'combustivel',
            severity: 'warning',
            title: `Margem combustível baixa em ${posto}`,
            description: `Margem atual: ${margem.toFixed(1)}%. Revise a precificação.`,
            timestamp: now,
            read: false,
            empresaCodigo: empCod,
            empresaNome: posto,
          })
        }
      }
    }

    // --- Bomba alerts (manutenção) ---
    // Disparam apenas quando a empresa tem config + a bomba tem registro de manutenção
    const manutState = useManutencaoStore.getState()
    const empresaConfig = empresaCodigo !== null ? manutState.configs[empresaCodigo] : undefined

    if (empresaCodigo !== null && empresaConfig && abastecimentosCache && abastecimentosCache.length > 0) {
      const bombasCache = queryClient.getQueryData<PaginatedResponse<Bomba>>(['bombas', empresaCodigo])
      const bicosCache = queryClient.getQueryData<PaginatedResponse<Bico>>(['bicos', empresaCodigo])

      const bombas = bombasCache?.resultados ?? []
      const bicos = bicosCache?.resultados ?? []

      if (bombas.length > 0) {
        const bicoToBomba = new Map<number, number>()
        for (const bi of bicos) bicoToBomba.set(bi.bicoCodigo, bi.bombaCodigo)

        const isAutoMode = manutState.mode === 'auto'

        // Litros bombeados por bomba (filtrando pela empresa).
        // - Manual: só conta abastecimentos a partir da data da última manutenção
        // - Auto sem registro: conta todos os abastecimentos (período inteiro como base)
        const litrosPorBomba = new Map<number, number>()
        for (const a of abastecimentosCache) {
          if (a.empresaCodigo !== empresaCodigo) continue
          const bombaCod = bicoToBomba.get(a.codigoBico)
          if (!bombaCod) continue
          const manutHist = manutState.manutencoes[`manutencao_${empresaCodigo}_${bombaCod}`]
          const manut = manutHist && manutHist.length > 0 ? manutHist[0] : null
          if (!manut?.dataUltima && !isAutoMode) continue  // manual sem registro → ignora
          if (manut?.dataUltima) {
            const abastDate = (a.dataHoraAbastecimento || a.dataFiscal || '').substring(0, 10)
            if (abastDate < manut.dataUltima) continue
          }
          litrosPorBomba.set(bombaCod, (litrosPorBomba.get(bombaCod) ?? 0) + a.quantidade)
        }

        const intervaloLitros = empresaConfig.intervaloLitros
        const limiteAviso = empresaConfig.avisarAoAtingirPct

        for (const bomba of bombas) {
          const manutHist = manutState.manutencoes[`manutencao_${empresaCodigo}_${bomba.bombaCodigo}`]
          const manut = manutHist && manutHist.length > 0 ? manutHist[0] : null
          // Sem registro manual e fora do modo auto → sem alerta
          if (!manut?.dataUltima && !isAutoMode) continue

          const litros = litrosPorBomba.get(bomba.bombaCodigo) ?? 0
          if (litros <= 0) continue  // sem litros bombeados → nada a alertar
          const desgastePct = intervaloLitros > 0 ? (litros / intervaloLitros) * 100 : 0
          const nome = bomba.descricao || `Bomba ${bomba.bombaCodigo}`

          const posto = nomeDoPosto(empresaCodigo)
          if (desgastePct > 90) {
            alerts.push({
              id: `bomba-danger-${empresaCodigo}-${bomba.bombaCodigo}`,
              category: 'bombas',
              severity: 'danger',
              title: `${nome} (${posto}) — verificar agora (${desgastePct.toFixed(0)}%)`,
              description: 'Bomba ultrapassou 90% do intervalo configurado. Manutenção urgente.',
              timestamp: now,
              read: false,
              empresaCodigo,
              empresaNome: posto,
            })
          } else if (desgastePct >= limiteAviso) {
            alerts.push({
              id: `bomba-warning-${empresaCodigo}-${bomba.bombaCodigo}`,
              category: 'bombas',
              severity: 'warning',
              title: `${nome} (${posto}) — manutenção próxima (${desgastePct.toFixed(0)}%)`,
              description: `Atingiu o limite de aviso configurado (${limiteAviso}%).`,
              timestamp: now,
              read: false,
              empresaCodigo,
              empresaNome: posto,
            })
          }
        }
      }
    }

    // Sort by severity: danger first, then warning, then info
    const severityOrder: Record<string, number> = { danger: 0, warning: 1, info: 2 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    setAlerts(alerts)
  }, [queryClient, empresaCodigo, dataInicial, dataFinal, setAlerts])

  useEffect(() => {
    // Generate immediately
    generateAlerts()

    // Then check periodically
    const interval = setInterval(generateAlerts, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [generateAlerts])
}

export default useAlertGenerator
