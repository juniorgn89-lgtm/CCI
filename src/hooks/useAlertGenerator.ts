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

    // --- Estoque alerts ---
    const estoqueCache = queryClient.getQueryData<PaginatedResponse<ProdutoEstoque>>(
      ['produtoEstoque', empresaCodigo]
    )

    if (estoqueCache?.resultados) {
      const items = estoqueCache.resultados
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
          id: 'estoque-zero',
          category: 'estoque',
          severity: 'danger',
          title: `${zeroCount} produto${zeroCount > 1 ? 's' : ''} sem estoque`,
          description: 'Verifique os produtos com saldo zerado para evitar rupturas.',
          timestamp: now,
          read: false,
        })
      }

      if (criticalCount > 0) {
        alerts.push({
          id: 'estoque-critico',
          category: 'estoque',
          severity: 'warning',
          title: `${criticalCount} produto${criticalCount > 1 ? 's' : ''} com estoque crítico`,
          description: 'Produtos com saldo igual ou inferior a 5 unidades.',
          timestamp: now,
          read: false,
        })
      }
    }

    // --- Financeiro alerts (Receber) ---
    const receberCache = queryClient.getQueryData<PaginatedResponse<TituloReceber>>(
      ['titulosReceber', empresaCodigo, dataInicial, dataFinal]
    )

    if (receberCache?.resultados) {
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
          id: 'financeiro-overdue-receber',
          category: 'financeiro',
          severity: 'danger',
          title: `${vencidos.length} título${vencidos.length > 1 ? 's' : ''} vencido${vencidos.length > 1 ? 's' : ''} a receber`,
          description: `Total vencido: ${formatCurrency(vencidosValor)}`,
          timestamp: now,
          read: false,
        })
      }

      if (vencemEmBreve.length > 0) {
        alerts.push({
          id: 'financeiro-soon-receber',
          category: 'financeiro',
          severity: 'warning',
          title: `${vencemEmBreve.length} título${vencemEmBreve.length > 1 ? 's' : ''} vencem nos próximos 7 dias`,
          description: 'Acompanhe os recebíveis com vencimento próximo.',
          timestamp: now,
          read: false,
        })
      }
    }

    // --- Financeiro alerts (Pagar) ---
    const pagarCache = queryClient.getQueryData<PaginatedResponse<TituloPagar>>(
      ['titulosPagar', empresaCodigo, dataInicial, dataFinal]
    )

    if (pagarCache?.resultados) {
      const hoje = new Date().toISOString().split('T')[0]

      const abertos = pagarCache.resultados.filter((t) => t.situacao !== 'PAGO' && t.situacao !== 'CANCELADO')
      const vencidos = abertos.filter((t) => t.vencimento < hoje)
      const vencidosValor = vencidos.reduce((acc, t) => acc + (t.valor - t.valorPago), 0)

      if (vencidos.length > 0) {
        alerts.push({
          id: 'financeiro-overdue-pagar',
          category: 'financeiro',
          severity: 'danger',
          title: `${vencidos.length} título${vencidos.length > 1 ? 's' : ''} vencido${vencidos.length > 1 ? 's' : ''} a pagar`,
          description: `Total vencido: ${formatCurrency(vencidosValor)}`,
          timestamp: now,
          read: false,
        })
      }
    }

    // --- Combustivel alerts (margin) ---
    const abastecimentosCache = queryClient.getQueryData<Abastecimento[]>(
      ['abastecimentos', dataInicial, dataFinal]
    )

    if (abastecimentosCache && abastecimentosCache.length > 0) {
      const totalFaturamento = abastecimentosCache.reduce((acc, a) => acc + a.valorTotal, 0)
      const totalCusto = abastecimentosCache.reduce((acc, a) => acc + a.precoCadastro * a.quantidade, 0)

      if (totalFaturamento > 0) {
        const margemPercent = ((totalFaturamento - totalCusto) / totalFaturamento) * 100

        if (margemPercent < 5 && margemPercent >= 0) {
          alerts.push({
            id: 'combustivel-margem-baixa',
            category: 'combustivel',
            severity: 'warning',
            title: 'Margem de combustível abaixo de 5%',
            description: `Margem atual: ${margemPercent.toFixed(1)}%. Revise a precificação.`,
            timestamp: now,
            read: false,
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

        // Litros bombeados por bomba (filtrando pela empresa)
        const litrosPorBomba = new Map<number, number>()
        for (const a of abastecimentosCache) {
          if (a.empresaCodigo !== empresaCodigo) continue
          const bombaCod = bicoToBomba.get(a.codigoBico)
          if (!bombaCod) continue
          // Considera apenas abastecimentos a partir da data da última manutenção
          const manutHist = manutState.manutencoes[`manutencao_${empresaCodigo}_${bombaCod}`]
          const manut = manutHist && manutHist.length > 0 ? manutHist[0] : null
          if (!manut?.dataUltima) continue
          const abastDate = (a.dataHoraAbastecimento || a.dataFiscal || '').substring(0, 10)
          if (abastDate < manut.dataUltima) continue
          litrosPorBomba.set(bombaCod, (litrosPorBomba.get(bombaCod) ?? 0) + a.quantidade)
        }

        const intervaloLitros = empresaConfig.intervaloLitros
        const limiteAviso = empresaConfig.avisarAoAtingirPct

        for (const bomba of bombas) {
          const manutHist = manutState.manutencoes[`manutencao_${empresaCodigo}_${bomba.bombaCodigo}`]
          const manut = manutHist && manutHist.length > 0 ? manutHist[0] : null
          if (!manut?.dataUltima) continue  // sem registro → sem alerta

          const litros = litrosPorBomba.get(bomba.bombaCodigo) ?? 0
          const desgastePct = intervaloLitros > 0 ? (litros / intervaloLitros) * 100 : 0
          const nome = bomba.descricao || `Bomba ${bomba.bombaCodigo}`

          if (desgastePct > 90) {
            alerts.push({
              id: `bomba-danger-${bomba.bombaCodigo}`,
              category: 'bombas',
              severity: 'danger',
              title: `${nome} — verificar agora (${desgastePct.toFixed(0)}%)`,
              description: 'Bomba ultrapassou 90% do intervalo configurado. Manutenção urgente.',
              timestamp: now,
              read: false,
            })
          } else if (desgastePct >= limiteAviso) {
            alerts.push({
              id: `bomba-warning-${bomba.bombaCodigo}`,
              category: 'bombas',
              severity: 'warning',
              title: `${nome} — manutenção próxima (${desgastePct.toFixed(0)}%)`,
              description: `Atingiu o limite de aviso configurado (${limiteAviso}%).`,
              timestamp: now,
              read: false,
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
