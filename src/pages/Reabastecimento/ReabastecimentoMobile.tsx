import { useMemo } from 'react'
import { Fuel, AlertTriangle, Clock, TrendingDown } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
import useReabastecimento, { type ReabastNivel } from '@/pages/Dashboard/hooks/useReabastecimento'
import { formatNumber } from '@/lib/formatters'
import { KpiCard, Section, ProgressBar, Badge, type Tone } from '@/components/mobile/primitives'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { liters, litersShort } from '@/components/mobile/format'

const NIVEL: Record<ReabastNivel, { tone: Tone; label: string; bar: string }> = {
  critico: { tone: 'rose', label: 'Crítico', bar: '#e11d48' },
  alerta: { tone: 'amber', label: 'Alerta', bar: '#d97706' },
  ok: { tone: 'emerald', label: 'OK', bar: '#059669' },
}

const fmtDia = (iso: string): string => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '—')

/**
 * Reabastecimento — versão mobile. Reusa useReabastecimento (nível dos tanques,
 * última compra, projeção até o fim do mês). KPIs + lista de tanques com barra
 * de nível, dias de cobertura e sugestão de compra.
 */
const ReabastecimentoMobile = () => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const { tanques, isLoading } = useReabastecimento({ empresaCodigo, includeDetalhes: true })

  const resumo = useMemo(() => {
    let critico = 0, alerta = 0, ok = 0, necessidade = 0
    for (const t of tanques) {
      if (t.nivel === 'critico') critico++
      else if (t.nivel === 'alerta') alerta++
      else ok++
      necessidade += t.necessidadeFimDoMes
    }
    return { critico, alerta, ok, necessidade }
  }, [tanques])

  if (!hasEmpresa || empresaCodigo === null) {
    return (
      <div className="space-y-3 pb-2">
        <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Reabastecimento</h1>
        <EmptyCard title="Selecione um posto" desc="Escolha um posto no filtro pra ver os tanques." />
      </div>
    )
  }
  if (isLoading) return <LoadingScreen message="Carregando tanques…" />
  if (tanques.length === 0) return <EmptyCard title="Sem tanques" desc="Nenhum tanque cadastrado pro posto selecionado." />

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Reabastecimento</h1>

      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Tanques" tone="navy" Icon={Fuel} value={formatNumber(tanques.length)} sub={`${resumo.ok} ok`} />
        <KpiCard label="A comprar" tone="blue" Icon={TrendingDown} value={litersShort(resumo.necessidade)} sub="até o fim do mês" />
        <KpiCard label="Críticos" tone="rose" Icon={AlertTriangle} value={formatNumber(resumo.critico)} sub="< 20% do tanque" />
        <KpiCard label="Alerta" tone="amber" Icon={Clock} value={formatNumber(resumo.alerta)} sub="< 30% do tanque" />
      </div>

      <Section Icon={Fuel} title="Tanques" right={<Badge tone="navy">{tanques.length}</Badge>} flush>
        <div className="divide-y divide-gray-100 dark:divide-[#303030]">
          {tanques.map((t) => {
            const cfg = NIVEL[t.nivel]
            return (
              <div key={`${t.empresaCodigo}-${t.tanqueCodigo}`} className="px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{t.produtoNome}</p>
                    <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">{t.tanqueNome}</p>
                  </div>
                  <Badge tone={cfg.tone}>{cfg.label} · {Math.round(t.nivelPct)}%</Badge>
                </div>
                <div className="mt-1.5"><ProgressBar pct={t.nivelPct} color={cfg.bar} height={6} /></div>
                <div className="mt-1 flex items-center justify-between text-[10.5px] tabular-nums text-gray-400 dark:text-gray-500">
                  <span>{liters(t.estoqueAtual)} / {liters(t.capacidade)}</span>
                  <span>{t.diasRestantes != null ? `cobre ${Math.round(t.diasRestantes)}d` : 'sem consumo'}</span>
                </div>
                {(t.necessidadeFimDoMes > 0 || t.ultimaCompra) && (
                  <div className="mt-1 flex items-center justify-between text-[10.5px]">
                    {t.necessidadeFimDoMes > 0
                      ? <span className="font-semibold text-blue-600 dark:text-blue-400">comprar {liters(t.necessidadeFimDoMes)}</span>
                      : <span className="text-gray-400 dark:text-gray-500">abastecido</span>}
                    {t.ultimaCompra && (
                      <span className="text-gray-400 dark:text-gray-500">última {fmtDia(t.ultimaCompra.data)} · {litersShort(t.ultimaCompra.volume)}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

export default ReabastecimentoMobile
