import { useMemo, useState } from 'react'
import { Wallet, AlertTriangle, Percent, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import HeaderHint from '@/components/tables/HeaderHint'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import CalendarioVencimentos, { type ItemVencimento } from '@/pages/Financeiro/components/CalendarioVencimentos'
import { GUIAS } from '@/lib/guiasModais'
import useCartoesAReceber, { type CartaoPend, type Modalidade } from '@/pages/Cartoes/hooks/useCartoesAReceber'

/**
 * Cartões → "A receber": a carteira de cartões e apps pendentes de repasse.
 * Responde: quanto entra (líquido), quanto a administradora leva (taxa),
 * quando entra (calendário por dia de repasse) e o que já deveria ter entrado
 * e não foi baixado (vencidos). Snapshot do pendente agora, por posto do escopo.
 */

const MOD_COR: Record<Modalidade, string> = {
  'Crédito': 'bg-blue-500', 'Débito': 'bg-cyan-500', 'PIX': 'bg-emerald-500', 'Carteira Digital': 'bg-teal-500', 'Vale': 'bg-amber-500', 'Outros': 'bg-gray-400',
}
const pctFmt = (v: number) => `${v.toFixed(2).replace('.', ',')}%`
const cardCls = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black'
const brDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')

const Kpi = ({ Icon, rotulo, valor, detalhe, ajuda, tom }: { Icon: typeof Wallet; rotulo: string; valor: string; detalhe?: string; ajuda: string; tom?: 'alerta' | 'destaque' }) => (
  <div className={cn(cardCls, 'p-4', tom === 'destaque' && 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:bg-[#1e3a5f]')}>
    <p className={cn('flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider', tom === 'destaque' ? 'text-white/70' : 'text-gray-500 dark:text-gray-400')}>
      <Icon className="h-3.5 w-3.5" /> {rotulo} <InfoHint text={ajuda} className={tom === 'destaque' ? 'text-white/60 hover:text-white' : undefined} />
    </p>
    <p className={cn('mt-1.5 text-[22px] font-extrabold tabular-nums leading-tight', tom === 'destaque' ? 'text-white' : tom === 'alerta' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100')}>{valor}</p>
    {detalhe && <p className={cn('mt-0.5 text-[11px]', tom === 'destaque' ? 'text-white/70' : 'text-gray-500 dark:text-gray-400')}>{detalhe}</p>}
  </div>
)

const AReceberTab = () => {
  const r = useCartoesAReceber()
  const [dia, setDia] = useState<{ dia: string; ids: Set<string> } | null>(null)
  const [vencidosAbertos, setVencidosAbertos] = useState(false)

  const itensCal = useMemo<ItemVencimento[]>(() => r.itens.map((it) => ({ id: it.id, venc: it.vencimento, valor: it.liquido, nome: `${it.administradora} · ${it.modalidade}` })), [r.itens])
  const doDia = useMemo(() => (dia ? r.itens.filter((it) => dia.ids.has(it.id)).sort((a, b) => b.liquido - a.liquido) : []), [dia, r.itens])
  const vencidos = useMemo(() => r.itens.filter((it) => it.vencido).sort((a, b) => b.diasAtraso - a.diasAtraso), [r.itens])
  const vencidosPorAdmin = useMemo(() => {
    const m = new Map<string, { administradora: string; modalidade: Modalidade; qtd: number; liquido: number; maisAntigo: number; empresas: Set<number> }>()
    for (const it of vencidos) {
      const k = `${it.administradora}|${it.modalidade}`
      const g = m.get(k) ?? { administradora: it.administradora, modalidade: it.modalidade, qtd: 0, liquido: 0, maisAntigo: 0, empresas: new Set<number>() }
      g.qtd++; g.liquido += it.liquido; g.maisAntigo = Math.max(g.maisAntigo, it.diasAtraso); g.empresas.add(it.empresaCodigo)
      m.set(k, g)
    }
    return Array.from(m.values()).sort((a, b) => b.liquido - a.liquido)
  }, [vencidos])

  if (r.scopeCodes.length === 0) return <div className="p-6 text-sm text-gray-500">Selecione uma rede para ver a carteira de cartões.</div>
  if (r.isLoading) {
    return <div className="flex h-32 items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Buscando recebíveis de cartão por posto…</div>
  }
  if (r.isError) return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">Não foi possível buscar os cartões: {r.erro}</div>
  if (r.itens.length === 0) return <div className={cn(cardCls, 'p-8 text-center text-sm text-gray-500')}>Nenhum cartão ou app pendente de repasse nos postos selecionados.</div>

  const t = r.totais
  const modalidades = Array.from(r.porModalidade.entries()).sort((a, b) => b[1].liquido - a[1].liquido)

  return (
    <div className="space-y-4">
      {r.truncadas.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>A busca bateu no teto de páginas em {r.truncadas.map((e) => r.empresaNome.get(e) ?? e).join(', ')}: pode haver recebíveis de fora da conta. Os totais abaixo são o mínimo garantido.</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi Icon={Wallet} rotulo="Líquido a receber" valor={formatCurrencyInt(t.liquido)} detalhe={`${formatNumber(t.qtd)} transações pendentes`} tom="destaque" ajuda="Tudo que a administradora ainda vai repassar, já descontada a taxa de cada transação. É o que entra na conta." />
        <Kpi Icon={Percent} rotulo="Bruto e taxa" valor={formatCurrencyInt(t.bruto)} detalhe={`taxa ${formatCurrencyInt(t.taxa)} (${t.bruto > 0 ? pctFmt((t.taxa / t.bruto) * 100) : '—'} média)`} ajuda="Valor vendido no cartão e quanto a administradora fica. A taxa é a praticada em cada transação, não a do contrato." />
        <Kpi Icon={AlertTriangle} rotulo="Vencidos sem baixa" valor={formatCurrencyInt(t.vencidoLiquido)} detalhe={`${formatNumber(t.vencidoQtd)} transações já deveriam ter caído`} tom="alerta" ajuda="Repasse com data já passada e ainda pendente no sistema. Ou a administradora atrasou, ou o dinheiro caiu e falta dar baixa no WebPosto. Dos dois jeitos, vale olhar: é o dinheiro mais fácil de recuperar." />
        <Kpi Icon={Clock} rotulo="Entra hoje" valor={formatCurrencyInt(t.hojeLiquido)} detalhe="líquido com repasse hoje" ajuda="Transações cujo repasse está marcado para hoje." />
        <Kpi Icon={Clock} rotulo="Próximos 7 dias" valor={formatCurrencyInt(t.d7Liquido)} detalhe="líquido de amanhã a 7 dias" ajuda="O que a administradora deve repassar na próxima semana." />
      </div>

      {/* Por modalidade */}
      <div className={cardCls}>
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">Por modalidade <InfoHint text="Crédito, débito, PIX, carteira digital e vale, pelo tipo cadastrado na administradora (ou pela descrição, quando não há cadastro)." /></p>
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          {modalidades.map(([m, v]) => <span key={m} className={cn('h-full', MOD_COR[m])} style={{ width: `${t.liquido > 0 ? (v.liquido / t.liquido) * 100 : 0}%` }} title={`${m}: ${formatCurrencyInt(v.liquido)}`} />)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
          {modalidades.map(([m, v]) => (
            <span key={m} className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
              <span className={cn('h-2 w-2 rounded-full', MOD_COR[m])} /> {m} <b className="tabular-nums">{formatCurrencyInt(v.liquido)}</b>
              <span className="text-gray-400">{t.liquido > 0 ? Math.round((v.liquido / t.liquido) * 100) : 0}% · {v.qtd}</span>
              {v.vencidoLiquido > 0 && <span className="text-orange-600 dark:text-orange-400">· {formatCurrencyInt(v.vencidoLiquido)} vencido</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Calendário de repasse */}
      <CalendarioVencimentos
        titulo="Calendário de repasse"
        itens={itensCal}
        onDia={(d, its) => setDia({ dia: d, ids: new Set(its.map((i) => i.id)) })}
        corVencido="orange"
        nomeItens="transações"
        hint="Dia em que cada transação deve ser repassada pela administradora, pelo líquido. Laranja = já deveria ter caído; âmbar = até 7 dias; verde = depois. Subtotal por semana na lateral."
      />

      {/* Por administradora */}
      <div className={cn(cardCls, 'p-0 overflow-hidden')}>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">Por administradora e bandeira <InfoHint text="Cada linha é uma administradora numa modalidade (a mesma bandeira pode aparecer em crédito e em débito). Taxa praticada = média ponderada das transações; taxa contrato = o cadastro no WebPosto; prazo médio real = dias entre a venda e o repasse previsto." /></p>
          <span className="ml-auto text-[11px] text-gray-400">{r.administradoras.length} linhas · ordenado pelo líquido</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-y border-gray-100 bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-transparent dark:text-gray-400">
              <tr>
                <HeaderHint align="left" label="Administradora" help="Nome no WebPosto e modalidade." />
                <HeaderHint label="Transações" help="Quantidade pendente." />
                <HeaderHint label="Bruto" help="Valor vendido." />
                <HeaderHint label="Taxa" help="Quanto a administradora fica (R$)." />
                <HeaderHint label="Líquido" help="O que entra na conta." />
                <HeaderHint label="Taxa praticada" help="Média ponderada das transações pendentes." />
                <HeaderHint label="Taxa contrato" help="Percentual de comissão cadastrado na administradora. Diferença contra a praticada merece conferência na aba Taxas." />
                <HeaderHint label="Prazo médio" help="Dias entre a venda e o repasse previsto, na média das transações pendentes." />
                <HeaderHint label="Vencido" help="Líquido com repasse atrasado e o atraso mais antigo." />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {r.administradoras.map((a) => {
                const difTaxa = a.taxaContrato !== null ? a.taxaPraticada - a.taxaContrato : null
                return (
                  <tr key={a.chave} className="text-gray-800 dark:text-gray-200">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', MOD_COR[a.modalidade])} />
                        <span className="font-medium">{a.administradora}</span>
                        <span className="rounded bg-gray-100 px-1.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">{a.modalidade}</span>
                        {a.empresas.size > 1 && <span className="text-[10px] text-gray-400">{a.empresas.size} postos</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(a.qtd)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(a.bruto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(a.taxaValor)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrencyInt(a.liquido)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pctFmt(a.taxaPraticada)}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', difTaxa !== null && difTaxa > 0.05 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')} title={difTaxa !== null && difTaxa > 0.05 ? 'Praticada acima do contrato' : undefined}>
                      {a.taxaContrato === null ? '—' : pctFmt(a.taxaContrato)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.prazoMedio > 0 ? `${Math.round(a.prazoMedio)} dias` : '—'}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', a.vencidoLiquido > 0 ? 'font-semibold text-orange-600 dark:text-orange-400' : 'text-gray-400')}>
                      {a.vencidoLiquido > 0 ? <>{formatCurrencyInt(a.vencidoLiquido)} <span className="text-[10px] font-normal">({a.maisAntigoDias}d)</span></> : '—'}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(t.qtd)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(t.bruto)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(t.taxa)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(t.liquido)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.bruto > 0 ? pctFmt((t.taxa / t.bruto) * 100) : '—'}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right tabular-nums text-orange-600 dark:text-orange-400">{formatCurrencyInt(t.vencidoLiquido)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Vencidos e não baixados */}
      <div className={cn(cardCls, 'p-0 overflow-hidden')}>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100"><AlertTriangle className="h-4 w-4 text-orange-500" /> Vencidos e não baixados <InfoHint text="Repasses com data já passada e ainda pendentes. O que fazer: conferir o extrato da adquirente; se caiu, dar baixa no WebPosto; se não caiu, cobrar a administradora. Lista por administradora; abra para ver transação a transação." /></p>
          <span className="ml-auto text-[11px] text-gray-400">{formatNumber(t.vencidoQtd)} transações · {formatCurrencyInt(t.vencidoLiquido)} líquido</span>
        </div>
        {vencidosPorAdmin.length === 0 ? (
          <p className="px-5 pb-4 text-[12px] text-emerald-700 dark:text-emerald-400">Nada vencido. Todos os repasses pendentes ainda estão no prazo.</p>
        ) : (
          <>
            <table className="w-full text-[12px]">
              <thead className="border-y border-gray-100 bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-transparent dark:text-gray-400">
                <tr>
                  <th className="px-5 py-2 text-left font-semibold">Administradora</th>
                  <th className="px-3 py-2 text-right font-semibold">Transações</th>
                  <th className="px-3 py-2 text-right font-semibold">Líquido vencido</th>
                  <th className="px-3 py-2 text-right font-semibold">Mais antigo</th>
                  <th className="px-5 py-2 text-left font-semibold">O que fazer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {vencidosPorAdmin.map((v) => (
                  <tr key={`${v.administradora}|${v.modalidade}`} className="text-gray-800 dark:text-gray-200">
                    <td className="px-5 py-2"><span className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', MOD_COR[v.modalidade])} /><span className="font-medium">{v.administradora}</span><span className="text-[10px] text-gray-400">{v.modalidade}</span></span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(v.qtd)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-orange-600 dark:text-orange-400">{formatCurrencyInt(v.liquido)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.maisAntigo} dias</td>
                    <td className="px-5 py-2 text-[11px] text-gray-600 dark:text-gray-300">{v.maisAntigo > 60 ? 'Provável baixa pendente no WebPosto: confira o extrato e dê baixa.' : 'Confira o repasse no extrato da adquirente; se não caiu, cobre.'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-5 py-2.5 dark:border-gray-800">
              <button type="button" className="text-[12px] font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300" onClick={() => setVencidosAbertos((v) => !v)}>
                {vencidosAbertos ? 'Ocultar transações' : `Ver as ${Math.min(200, vencidos.length)} transações mais atrasadas`}
              </button>
              {vencidosAbertos && (
                <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr><th className="px-3 py-1.5 text-left">Posto</th><th className="px-3 py-1.5 text-left">Administradora</th><th className="px-3 py-1.5 text-left">NSU / autorização</th><th className="px-3 py-1.5 text-right">Venda</th><th className="px-3 py-1.5 text-right">Repasse previsto</th><th className="px-3 py-1.5 text-right">Atraso</th><th className="px-3 py-1.5 text-right">Bruto</th><th className="px-3 py-1.5 text-right">Líquido</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {vencidos.slice(0, 200).map((it: CartaoPend) => (
                        <tr key={it.id} className="text-gray-700 dark:text-gray-300">
                          <td className="px-3 py-1.5">{r.empresaNome.get(it.empresaCodigo) ?? it.empresaCodigo}</td>
                          <td className="px-3 py-1.5">{it.administradora} <span className="text-gray-400">{it.modalidade}</span></td>
                          <td className="px-3 py-1.5 font-mono text-[10px] text-gray-500">{it.nsu || '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{brDate(it.movimento)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{brDate(it.vencimento)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-orange-600 dark:text-orange-400">{it.diasAtraso}d</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{formatCurrency(it.bruto)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatCurrency(it.liquido)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Snapshot do que está pendente agora, por posto do filtro; não segue o período da barra. Líquido = bruto − taxa arredondada por transação, igual ao WebPosto. Cheques não aparecem porque a API não expõe cheques a compensar.
      </p>

      {/* Modal do dia */}
      <Dialog open={!!dia} onOpenChange={(v) => !v && setDia(null)}>
        <DialogContent guia={GUIAS.aReceberRepasses} className="max-h-[90vh] max-w-3xl overflow-y-auto dark:border-gray-700 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">Repasses de {dia ? brDate(dia.dia) : ''} · {doDia.length} transações · {formatCurrencyInt(doDia.reduce((s, it) => s + it.liquido, 0))} líquido</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr><th className="px-3 py-1.5 text-left">Posto</th><th className="px-3 py-1.5 text-left">Administradora</th><th className="px-3 py-1.5 text-left">NSU</th><th className="px-3 py-1.5 text-right">Venda</th><th className="px-3 py-1.5 text-right">Bruto</th><th className="px-3 py-1.5 text-right">Taxa</th><th className="px-3 py-1.5 text-right">Líquido</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {doDia.slice(0, 300).map((it) => (
                  <tr key={it.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-3 py-1.5">{r.empresaNome.get(it.empresaCodigo) ?? it.empresaCodigo}</td>
                    <td className="px-3 py-1.5">{it.administradora} <span className="text-gray-400">{it.modalidade}</span></td>
                    <td className="px-3 py-1.5 font-mono text-[10px] text-gray-500">{it.nsu || '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{brDate(it.movimento)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{formatCurrency(it.bruto)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{formatCurrency(it.taxaValor)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatCurrency(it.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {doDia.length > 300 && <p className="px-3 py-2 text-[11px] text-gray-400">Mostrando as 300 maiores de {doDia.length}.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AReceberTab
