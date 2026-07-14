import { useMemo, useState } from 'react'
import { FlaskConical, TriangleAlert, User, CalendarDays, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt, formatDate, formatLiters, formatNumber } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { buildAfericoesResumo, grupoDaLinha, type AfericoesGrupo } from '@/lib/afericoes'
import type { AfericaoRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

interface Props {
  rows: AfericaoRow[]
  isLoading: boolean
}

type Eixo = 'frentista' | 'dia'
interface Selecao { eixo: Eixo; chave: string; nome: string }

const hhmm = (iso: string) => (iso || '').slice(11, 16) || '—'

const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
    <p className="mt-1 text-xl font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>}
  </div>
)

const Tabela = ({ Icon, titulo, primeiraCol, grupos, isData, onSelect }: {
  Icon: typeof User
  titulo: string
  primeiraCol: string
  grupos: AfericoesGrupo[]
  isData?: boolean
  onSelect: (g: AfericoesGrupo) => void
}) => (
  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
    <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-500">
      <Icon className="h-3.5 w-3.5" /> {titulo}
    </div>
    <div className="max-h-64 overflow-y-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-gray-400 dark:bg-gray-900 dark:text-gray-500">
          <tr>
            <th className="px-3 py-1.5 text-left font-semibold">{primeiraCol}</th>
            <th className="px-2 py-1.5 text-right font-semibold">Aferições</th>
            <th className="px-2 py-1.5 text-right font-semibold">Litros</th>
            <th className="px-3 py-1.5 text-right font-semibold">R$ estim.</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <tr
              key={g.chave}
              onClick={() => onSelect(g)}
              className={cn('group cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50',
                g.atipico && 'bg-amber-50/60 dark:bg-amber-950/20')}
            >
              <td className="px-3 py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600" />
                  <span className="truncate text-gray-700 dark:text-gray-200" title={g.nome}>{isData ? formatDate(g.nome) : g.nome}</span>
                  {g.atipico && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title="Volume fora do padrão ou concentração alta">
                      <TriangleAlert className="h-2.5 w-2.5" /> atenção
                    </span>
                  )}
                </span>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{g.count}</td>
              <td className={cn('px-2 py-1.5 text-right font-semibold tabular-nums', g.atipico ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-200')}>{formatLiters(g.litros)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(g.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

/**
 * Aferições de bomba — visibilidade do combustível que sai como teste (INMETRO)
 * e NÃO é venda. Tom neutro/informativo; realça (âmbar) o atípico. Clicar num
 * frentista/dia abre um MODAL com as aferições individuais daquele grupo.
 */
const AfericoesCard = ({ rows, isLoading }: Props) => {
  const resumo = useMemo(() => buildAfericoesResumo(rows), [rows])
  const [sel, setSel] = useState<Selecao | null>(null)

  const detalhe = useMemo(() => {
    if (!sel) return []
    return rows
      .filter((r) => grupoDaLinha(r, sel.eixo) === sel.chave)
      .sort((a, b) => (b.dataHora || '').localeCompare(a.dataHora || ''))
  }, [rows, sel])

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />
  if (resumo.count === 0) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
          <FlaskConical className="h-5 w-5" />
        </span>
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Aferições
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">informativo</span>
            {resumo.nAtipicos > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <TriangleAlert className="h-3 w-3" /> {resumo.nAtipicos} p/ revisar
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Teste de bomba (INMETRO) — combustível que sai e não é venda · clique num frentista/dia pra ver o detalhe</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Kpi label="Aferições" value={formatNumber(resumo.count)} sub="no período" />
        <Kpi label="Total de litros" value={formatLiters(resumo.litros)} sub="saída física" />
        <Kpi label="R$ estimado" value={formatCurrencyInt(resumo.valor)} sub="a preço de bomba" />
      </div>

      {/* Quanto (por frentista) e quando (por dia) — clicáveis */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tabela Icon={User} titulo="Por frentista" primeiraCol="Frentista" grupos={resumo.porFrentista}
          onSelect={(g) => setSel({ eixo: 'frentista', chave: g.chave, nome: g.nome })} />
        <Tabela Icon={CalendarDays} titulo="Por dia" primeiraCol="Data" grupos={resumo.porDia} isData
          onSelect={(g) => setSel({ eixo: 'dia', chave: g.chave, nome: formatDate(g.nome) })} />
      </div>

      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span>
          Aferição é exigência do INMETRO — normal. O realce <strong className="text-amber-600 dark:text-amber-400">âmbar</strong> aponta o que merece um olhar: volume fora do padrão (≠ ~20/40L) ou concentração alta por frentista/dia. O R$ é <strong>notional</strong> (o combustível volta pro tanque) — o número que importa é o de litros.
        </span>
      </p>

      {/* Modal de detalhe — aferições individuais do grupo clicado */}
      <Dialog open={sel !== null} onOpenChange={(o) => { if (!o) setSel(null) }}>
        <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"><FlaskConical className="h-4 w-4" /></span>
              Aferições · {sel?.eixo === 'frentista' ? sel?.nome : sel?.nome}
            </DialogTitle>
            <DialogDescription>
              {detalhe.length} aferiç{detalhe.length === 1 ? 'ão' : 'ões'} · {formatLiters(detalhe.reduce((s, r) => s + r.litros, 0))} · {formatCurrencyInt(detalhe.reduce((s, r) => s + r.valorEstimado, 0))} estimados
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Data / hora</th>
                  {sel?.eixo === 'dia' && <th className="px-3 py-2 text-left font-semibold">Frentista</th>}
                  <th className="px-3 py-2 text-left font-semibold">Posto</th>
                  <th className="px-3 py-2 text-left font-semibold">Bomba / bico</th>
                  <th className="px-3 py-2 text-left font-semibold">Combustível</th>
                  <th className="px-3 py-2 text-right font-semibold">Litros</th>
                  <th className="px-3 py-2 text-right font-semibold">R$ estim.</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.map((r) => {
                  const atipica = resumo.atipicaSet.has(r.codigo)
                  return (
                    <tr key={r.codigo} className={cn('border-t border-gray-100 dark:border-gray-800', atipica && 'bg-amber-50/60 dark:bg-amber-950/20')}>
                      <td className="px-3 py-1.5 tabular-nums text-gray-700 dark:text-gray-200">{formatDate(r.dataFiscal)} · {hhmm(r.dataHora)}</td>
                      {sel?.eixo === 'dia' && <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{r.frentistaNome}</td>}
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{r.empresaNome}</td>
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{r.bombaDescricao}</td>
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{r.combustivelNome}</td>
                      <td className={cn('px-3 py-1.5 text-right font-semibold tabular-nums', atipica ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-200')}>
                        <span className="inline-flex items-center justify-end gap-1">
                          {atipica && <TriangleAlert className="h-3 w-3 text-amber-500" />}
                          {formatLiters(r.litros)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(r.valorEstimado)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AfericoesCard
