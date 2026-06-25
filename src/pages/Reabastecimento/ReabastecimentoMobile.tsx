import { useMemo } from 'react'
import { Fuel, AlertTriangle, Clock, Droplet, DollarSign } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
import useReabastecimento, { type ReabastNivel } from '@/pages/Dashboard/hooks/useReabastecimento'
import { formatNumber } from '@/lib/formatters'
import { KpiCard, Section, ProgressBar, Badge, type Tone } from '@/components/mobile/primitives'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brlShort, liters, litersShort } from '@/components/mobile/format'

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
  // Consolidado: 1 posto → escopa no hook; Todos/subconjunto → rede-wide + filtro
  // client-side (cada tanque carrega empresaNome). Tanque é físico por-posto, então
  // a "rede" é a lista de todos os tanques de todos os postos do filtro.
  const single1Posto = empresaCodigos.length === 1
  const { tanques: tanquesRaw, isLoading } = useReabastecimento({
    empresaCodigo: single1Posto ? empresaCodigos[0] : null,
    includeDetalhes: true,
  })
  const tanques = useMemo(
    () => empresaCodigos.length === 0
      ? tanquesRaw
      : tanquesRaw.filter((t) => empresaCodigos.includes(t.empresaCodigo)),
    [tanquesRaw, empresaCodigos],
  )

  const resumo = useMemo(() => {
    let critico = 0, alerta = 0, ok = 0, necessidade = 0, volume = 0, valor = 0
    let somaDias = 0, comDias = 0
    for (const t of tanques) {
      if (t.nivel === 'critico') critico++
      else if (t.nivel === 'alerta') alerta++
      else ok++
      necessidade += t.necessidadeFimDoMes
      volume += t.estoqueAtual
      if (t.diasRestantes != null) { somaDias += t.diasRestantes; comDias++ }
      // Valor estimado = estoque atual × custo unitário da última compra.
      if (t.ultimaCompra && t.ultimaCompra.volume > 0) {
        valor += t.estoqueAtual * (t.ultimaCompra.valorEstimado / t.ultimaCompra.volume)
      }
    }
    return { critico, alerta, ok, necessidade, volume, valor, coberturaMedia: comDias > 0 ? somaDias / comDias : 0 }
  }, [tanques])

  if (isLoading) return <LoadingScreen message="Carregando tanques…" />
  if (tanques.length === 0) return <EmptyCard title="Sem tanques" desc="Nenhum tanque cadastrado pro posto selecionado." />

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Reabastecimento</h1>

      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Volume em tanque" tone="blue" Icon={Droplet} value={litersShort(resumo.volume)} sub={`${formatNumber(tanques.length)} tanques`} />
        <KpiCard label="Cobertura média" tone="teal" Icon={Clock} value={`${resumo.coberturaMedia.toFixed(1).replace('.', ',')} dias`} sub="no ritmo atual" />
        <KpiCard label="Tanques em alerta" tone="rose" Icon={AlertTriangle} value={formatNumber(resumo.critico + resumo.alerta)} sub={`de ${formatNumber(tanques.length)}`} />
        <KpiCard label="Valor em estoque" tone="navy" Icon={DollarSign} value={brlShort(resumo.valor)} sub="custo da última compra" />
      </div>

      {resumo.critico > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span><span className="font-semibold">{resumo.critico} tanque{resumo.critico > 1 ? 's' : ''}</span> em nível crítico (&lt; 20% da capacidade). Reposição sugerida abaixo.</span>
        </div>
      )}

      <Section Icon={Fuel} title="Níveis de tanque" right={<Badge tone="navy">{tanques.length}</Badge>} flush>
        <div className="divide-y divide-gray-100 dark:divide-[#303030]">
          {tanques.map((t) => {
            const cfg = NIVEL[t.nivel]
            return (
              <div key={`${t.empresaCodigo}-${t.tanqueCodigo}`} className="px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{t.produtoNome}</p>
                    <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">
                      {!single1Posto ? `${t.empresaNome} · ` : ''}{t.tanqueNome}
                    </p>
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
