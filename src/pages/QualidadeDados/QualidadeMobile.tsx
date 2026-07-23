import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, Fuel, Search, Wallet, Boxes, Landmark } from 'lucide-react'
import useQualidadeDados from '@/pages/QualidadeDados/hooks/useQualidadeDados'
import type { QualidadeIssue } from '@/pages/QualidadeDados/hooks/useQualidadeDados'
import type { IssueSeverity } from '@/pages/QualidadeDados/components/IssueSection'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import PostoLocalSelect from '@/components/filters/PostoLocalSelect'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { KpiCard, Section, Badge, type Tone } from '@/components/mobile/primitives'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'

const SEV: Record<IssueSeverity, { tone: Tone; label: string; bar: string }> = {
  high: { tone: 'rose', label: 'Crítico', bar: 'border-l-rose-500' },
  medium: { tone: 'amber', label: 'Atenção', bar: 'border-l-amber-500' },
  low: { tone: 'blue', label: 'Info', bar: 'border-l-blue-500' },
}

/**
 * Qualidade de Dados — versão mobile (triagem). Reusa useQualidadeDados. Mostra
 * KPIs e as inconsistências por categoria (label · severidade · contagem ·
 * descrição). O detalhe item-a-item e o arquivamento ficam no desktop.
 */
const QualidadeMobile = () => {
  // Fraude é por-posto → um posto por vez, com seletor quando há mais de um.
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  const [activeCodigo, setActiveCodigo] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = activeCodigo != null && postoCodes.includes(activeCodigo)
    ? activeCodigo
    : (postos[0]?.codigo ?? null)

  const q = useQualidadeDados(selectedCodigo)

  const postoTabs = postos.length > 1 ? (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      <PostoLocalSelect postos={postos} value={selectedCodigo} onChange={setActiveCodigo} />
    </div>
  ) : null

  if (postos.length === 0) {
    return (
      <div className="space-y-3 pb-2">
        <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Qualidade de Dados</h1>
        <EmptyCard title="Sem posto" desc="Nenhum posto disponível." />
      </div>
    )
  }
  if (q.isLoading) return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Qualidade de Dados</h1>
      {postoTabs}
      <LoadingScreen message="Verificando os dados…" />
    </div>
  )

  const cats: { key: keyof typeof catData; label: string; Icon: typeof Fuel }[] = [
    { key: 'abastecimentos', label: 'Abastecimentos', Icon: Fuel },
    { key: 'vendas', label: 'Vendas', Icon: Search },
    { key: 'caixa', label: 'Caixa & Turnos', Icon: Wallet },
    { key: 'estoque', label: 'Estoque', Icon: Boxes },
    { key: 'financeiro', label: 'Financeiro', Icon: Landmark },
  ]
  const catData = { abastecimentos: q.abastecimentos, vendas: q.vendas, caixa: q.caixa, estoque: q.estoque, financeiro: q.financeiro }

  const IssueRow = (issue: QualidadeIssue) => {
    const sev = SEV[issue.severity]
    return (
      <div key={issue.id} className={cn('border-l-[3px] px-3.5 py-2.5', sev.bar)}>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{issue.label}</span>
          <Badge tone={sev.tone}>{formatNumber(issue.count)}</Badge>
        </div>
        <p className="mt-0.5 text-[10.5px] leading-snug text-gray-400 dark:text-gray-500">{issue.description}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Qualidade de Dados</h1>
      {postoTabs}

      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Inconsistências" tone="navy" Icon={ShieldAlert} value={formatNumber(q.totalIssues)} />
        <KpiCard label="Críticas" tone="rose" Icon={AlertTriangle} value={formatNumber(q.totalCriticos)} />
        <KpiCard label="Atenção" tone="amber" Icon={AlertTriangle} value={formatNumber(q.totalAtencao)} />
        <KpiCard label="Informativas" tone="blue" Icon={Info} value={formatNumber(q.totalInfo)} />
      </div>

      {q.totalIssues === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-8 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Tudo certo</span>
          <span className="max-w-[230px] text-[11.5px] text-gray-500 dark:text-gray-400">Nenhuma inconsistência encontrada no período e posto selecionados.</span>
        </div>
      ) : (
        cats.map(({ key, label, Icon }) => {
          const issues = catData[key]
          if (issues.length === 0) return null
          const total = issues.reduce((s, i) => s + i.count, 0)
          return (
            <Section key={key} Icon={Icon} title={label} right={<Badge tone="navy">{formatNumber(total)}</Badge>} flush>
              <div className="divide-y divide-gray-100 dark:divide-[#303030]">
                {issues.map(IssueRow)}
              </div>
            </Section>
          )
        })
      )}

      <p className="px-1 text-center text-[10px] text-gray-400 dark:text-gray-500">
        Detalhe item a item e arquivamento de ocorrências disponíveis na versão desktop.
      </p>
    </div>
  )
}

export default QualidadeMobile
