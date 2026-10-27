import { useMemo, useState } from 'react'
import { CreditCard, CheckCircle2, AlertTriangle, CalendarClock, Percent, ShieldAlert, Eye, KeyRound, Loader2, Info } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import InfoHint from '@/components/ui/InfoHint'
import RowActionButton from '@/components/tables/RowAction'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import { nomeProduto, STATUS_PARCELA } from '@/lib/eextrato/codigos'
import type { VendaEextrato } from '@/api/supabase/eextrato'
import useConciliacaoCartao, { DIAS_AGENDA } from '@/pages/Financeiro/hooks/useConciliacaoCartao'
import { agendaPorDia, ajustesPorMotivo, motivoLegivel, resumir, rotuloBandeira, rotuloRede, taxaLinha, valorLinha } from '@/pages/Financeiro/lib/conciliacaoCartao'

const painelCls = 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black'
const brData = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`

const TONS = {
  navy: 'bg-blue-100 text-[#1e3a5f] dark:bg-blue-900/30 dark:text-blue-300',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

const Card = ({ label, hint, valor, sub, Icon, tom }: { label: string; hint: string; valor: string; sub: string; Icon: typeof CreditCard; tom: keyof typeof TONS }) => (
  <div className={cn(painelCls, 'p-4')}>
    <div className="flex items-center justify-between">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}<InfoHint text={hint} /></p>
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', TONS[tom])}><Icon className="h-4 w-4" /></span>
    </div>
    <p className="mt-1.5 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{valor}</p>
    <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">{sub}</p>
  </div>
)

const Aviso = ({ tom = 'amber', children }: { tom?: 'amber' | 'red' | 'blue'; children: React.ReactNode }) => (
  <p className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px]',
    tom === 'red' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
      : tom === 'blue' ? 'border-blue-200 bg-blue-50 text-[#1e3a5f] dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200'
        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200')}>
    {tom === 'red' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
    <span>{children}</span>
  </p>
)

type Aba = 'pendentes' | 'agenda' | 'ajustes'

/** Linha de campo do modal (rótulo à esquerda, valor à direita). */
const Campo = ({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-1.5 text-[13px] last:border-0 dark:border-gray-800">
    <span className="text-gray-500 dark:text-gray-400">{rotulo}</span>
    <span className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{valor ?? '—'}</span>
  </div>
)

/** Tudo de uma venda sem conciliar, para quem vai lançar ou cobrar. */
const VendaModal = ({ v, onClose }: { v: VendaEextrato; onClose: () => void }) => {
  const taxa = taxaLinha(v)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] w-[95vw] max-w-lg overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle>Venda sem conciliar · {formatCurrency(valorLinha(v))}</DialogTitle>
          <DialogDescription>
            {motivoLegivel(v) ? <>A e-extrato não achou o par desta venda: <b>{motivoLegivel(v)}</b>.</> : 'A e-extrato não achou o par desta venda e não informou o motivo.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <section>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">A venda</p>
            <Campo rotulo="Dia e hora" valor={`${brData(v.dataVenda)}${v.horaVenda ? ` às ${v.horaVenda.slice(0, 5)}` : ''}`} />
            <Campo rotulo="NSU" valor={v.nsu} />
            <Campo rotulo="Autorização" valor={v.autorizacao} />
            {v.tid && <Campo rotulo="TID" valor={v.tid} />}
            <Campo rotulo="Cartão" valor={v.numeroCartao} />
            <Campo rotulo="Máquina" valor={v.maquinaLoja} />
            <Campo rotulo="Captura" valor={v.modoCaptura} />
          </section>
          <section>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Cartão e repasse</p>
            <Campo rotulo="Adquirente" valor={rotuloRede(v)} />
            <Campo rotulo="Bandeira" valor={`${rotuloBandeira(v)} · ${nomeProduto(v.produto)}`} />
            <Campo rotulo="Parcela" valor={v.plano && v.plano > 1 ? `${v.parcela ?? '?'} de ${v.plano}` : 'À vista'} />
            <Campo rotulo="Valor da venda" valor={v.valorVenda != null ? formatCurrency(v.valorVenda) : null} />
            {v.valorParcela != null && <Campo rotulo="Valor da parcela" valor={formatCurrency(v.valorParcela)} />}
            <Campo rotulo="Taxa" valor={taxa != null ? `${formatCurrency(taxa)}${v.taxaAdministracao != null ? ` (${pct(v.taxaAdministracao)})` : ''}` : null} />
            {v.valorLiquidoParcela != null && <Campo rotulo="Líquido" valor={formatCurrency(v.valorLiquidoParcela)} />}
            <Campo rotulo="Crédito previsto" valor={brData(v.dataCredito)} />
            <Campo rotulo="Situação" valor={v.status ? STATUS_PARCELA[v.status] : null} />
            <Campo rotulo="Estabelecimento" valor={v.codigoEstabelecimento} />
          </section>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
            Confira no caixa do dia se a venda foi lançada com o mesmo valor, bandeira e parcelas. O Visor só mostra: o acerto é feito no WebPosto ou com a adquirente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Financeiro › Conciliação de cartão (e-extrato). Por ora só diretores e a
 * conta da CCI veem (fase de integração). Sem chave configurada, a tela diz
 * isso; nunca mostra zero no lugar de dado que não veio.
 */
const ConciliacaoCartaoTab = () => {
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const { status, configurado, vendas, ajustes, previsoes } = useConciliacaoCartao(dataInicial, dataFinal)
  const [aba, setAba] = useState<Aba>('pendentes')
  const [aberta, setAberta] = useState<VendaEextrato | null>(null)

  const resumo = useMemo(() => (vendas.data ? resumir(vendas.data.itens) : null), [vendas.data])
  const agenda = useMemo(() => (previsoes.data ? agendaPorDia(previsoes.data.itens) : null), [previsoes.data])
  const grupos = useMemo(() => (ajustes.data ? ajustesPorMotivo(ajustes.data.itens) : null), [ajustes.data])

  if (status.isLoading) {
    return <div className={cn(painelCls, 'flex items-center gap-2 p-6 text-sm text-gray-500')}><Loader2 className="h-4 w-4 animate-spin" /> Verificando a integração com a e-extrato…</div>
  }
  if (status.isError) {
    return <div className={cn(painelCls, 'p-6')}><Aviso tom="red">Não deu para falar com o servidor da integração: {(status.error as Error).message}</Aviso></div>
  }
  if (configurado === false) {
    return (
      <div className={cn(painelCls, 'flex flex-col items-center px-6 py-14 text-center')}>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1e3a5f] dark:bg-blue-950/40 dark:text-blue-300"><KeyRound className="h-6 w-6" /></span>
        <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Aguardando a chave de acesso da e-extrato</p>
        <p className="mt-1 max-w-md text-[13px] text-gray-500 dark:text-gray-400">
          A tela está pronta. Assim que a Boavista enviar a chave e ela for cadastrada no servidor, as vendas de cartão, a conciliação, a agenda de créditos e as tarifas aparecem aqui.
        </p>
        <p className="mt-3 text-[11.5px] text-gray-400">Visível só para diretores durante a integração.</p>
      </div>
    )
  }

  const carregandoVendas = vendas.isLoading
  const naoConc = resumo?.naoConciliadas ?? []
  const comStatus = resumo ? resumo.linhas - resumo.semStatus : 0
  const chargebacks = grupos?.find((g) => g.historico === 6)
  const tarifasTotal = grupos?.reduce((n, g) => n + g.debito, 0) ?? 0
  const proxCreditos = agenda?.reduce((n, d) => n + d.liquido, 0) ?? 0
  const parcial = [vendas.data, ajustes.data, previsoes.data].some((d) => d && !d.completo)

  return (
    <div className="space-y-4">
      {/* Frescor e avisos — antes dos números. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-gray-500 dark:text-gray-400">
        <span>Fonte: e-extrato (Boavista) · {brData(dataInicial)} a {brData(dataFinal)}</span>
        {resumo?.ultimaVenda && <span>· vendas recebidas até <b className="text-gray-700 dark:text-gray-200">{brData(resumo.ultimaVenda)}</b></span>}
        <span>· rede inteira (o filtro de posto ainda não se aplica)<InfoHint text="Para separar por posto falta ligar cada loja da e-extrato ao posto do Visor. Até lá, os números são da rede inteira." /></span>
      </div>
      {parcial && <Aviso>Leitura incompleta: a e-extrato devolveu mais páginas do que o limite desta consulta. Os totais abaixo são só do que veio; reduza o período para ver tudo.</Aviso>}
      {vendas.isError && <Aviso tom="red">As vendas não vieram da e-extrato: {(vendas.error as Error).message}</Aviso>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        {carregandoVendas || !resumo ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)
        ) : (
          <>
            <Card label="Vendas em cartão" Icon={CreditCard} tom="navy" valor={formatCurrencyInt(resumo.bruto)}
              sub={`${resumo.linhas.toLocaleString('pt-BR')} ${resumo.linhas === 1 ? 'lançamento' : 'lançamentos'} (parcelas contam separado)`}
              hint="Valor bruto das vendas de cartão no período, como a e-extrato recebeu das adquirentes. Venda parcelada aparece uma vez por parcela." />
            <Card label="Conciliadas" Icon={CheckCircle2} tom="emerald"
              valor={comStatus > 0 ? pct((resumo.conciliadas / comStatus) * 100) : '—'}
              sub={comStatus > 0 ? `${resumo.conciliadas.toLocaleString('pt-BR')} de ${comStatus.toLocaleString('pt-BR')}${resumo.semStatus ? ` · ${resumo.semStatus} sem status` : ''}` : 'A e-extrato não informou a conciliação'}
              hint="Quantas vendas a e-extrato casou entre o que o posto registrou e o que a adquirente informou." />
            <Card label="Sem conciliar" Icon={AlertTriangle} tom="amber" valor={formatCurrencyInt(resumo.valorNaoConciliado)}
              sub={`${naoConc.length.toLocaleString('pt-BR')} ${naoConc.length === 1 ? 'venda' : 'vendas'} para conferir`}
              hint="Vendas que a e-extrato não conseguiu casar. Cada uma tem o motivo (valor, bandeira, parcelas…) e os dados para conferir no caixa." />
            <Card label="A receber" Icon={CalendarClock} tom="sky"
              valor={previsoes.isLoading ? '…' : previsoes.isError ? '—' : formatCurrencyInt(proxCreditos)}
              sub={previsoes.isError ? 'A agenda não veio da e-extrato' : `créditos previstos nos próximos ${DIAS_AGENDA} dias`}
              hint={`Soma do que as adquirentes vão depositar nos próximos ${DIAS_AGENDA} dias, pela data prevista de crédito de cada parcela, já sem as taxas.`} />
            <Card label="Taxa efetiva" Icon={Percent} tom="violet"
              valor={resumo.brutoComTaxa > 0 ? pct((resumo.taxa / resumo.brutoComTaxa) * 100) : '—'}
              sub={resumo.brutoComTaxa > 0 ? `${formatCurrencyInt(resumo.taxa)} em taxas${resumo.brutoComTaxa < resumo.bruto ? ' (parte das vendas sem taxa informada)' : ''}` : 'Taxa não informada nas vendas'}
              hint="Quanto as adquirentes ficaram, em média, sobre o valor vendido no período (taxa ÷ bruto das vendas que trazem a taxa)." />
            <Card label="Tarifas e chargeback" Icon={ShieldAlert} tom="red"
              valor={ajustes.isLoading ? '…' : ajustes.isError ? '—' : formatCurrencyInt(tarifasTotal)}
              sub={ajustes.isError ? 'Os ajustes não vieram da e-extrato' : `${chargebacks?.qtd ?? 0} chargeback${(chargebacks?.qtd ?? 0) === 1 ? '' : 's'} · aluguel de POS, cancelamentos e tarifas`}
              hint="Débitos que as adquirentes lançaram no período fora da taxa da venda: aluguel de máquina, cancelamentos, chargebacks e tarifas." />
          </>
        )}
      </div>

      <div className={painelCls}>
        <div className="flex flex-wrap gap-1 border-b border-gray-100 px-3 pt-3 dark:border-gray-800">
          {([['pendentes', `Sem conciliar${naoConc.length ? ` (${naoConc.length})` : ''}`], ['agenda', 'Agenda de créditos'], ['ajustes', 'Tarifas e ajustes']] as const).map(([id, rotulo]) => (
            <button key={id} type="button" onClick={() => setAba(id)}
              className={cn('-mb-px rounded-t-lg border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors',
                aba === id ? 'border-[#2563eb] text-[#1e3a5f] dark:text-blue-200' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200')}>
              {rotulo}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto p-3">
          {aba === 'pendentes' && (
            carregandoVendas ? <Skeleton className="h-40 w-full" />
              : naoConc.length === 0 ? (
                <p className="px-2 py-8 text-center text-[13px] text-gray-500">{resumo && comStatus > 0 ? 'Nenhuma venda sem conciliar no período.' : 'A e-extrato não informou a conciliação das vendas deste período.'}</p>
              ) : (
                <table className="w-full min-w-[760px] text-[12.5px]">
                  <thead className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="px-2 py-2 text-left font-semibold">Dia</th>
                      <th className="px-2 py-2 text-left font-semibold">Adquirente · bandeira</th>
                      <th className="px-2 py-2 text-left font-semibold">NSU · autorização</th>
                      <th className="px-2 py-2 text-left font-semibold">Motivo</th>
                      <th className="px-2 py-2 text-right font-semibold">Valor</th>
                      <th className="px-2 py-2 text-right font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {naoConc.map((v, i) => (
                      <tr key={`${v.nsu}-${v.autorizacao}-${v.parcela}-${i}`} className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                        <td className="px-2 py-2 tabular-nums">{brData(v.dataVenda)}{v.horaVenda ? <span className="text-gray-400"> {v.horaVenda.slice(0, 5)}</span> : null}</td>
                        <td className="px-2 py-2">{rotuloRede(v)} · {rotuloBandeira(v)} <span className="text-gray-400">{nomeProduto(v.produto)}</span></td>
                        <td className="px-2 py-2 font-mono text-[11.5px]">{v.nsu ?? '—'} · {v.autorizacao ?? '—'}</td>
                        <td className="px-2 py-2">{motivoLegivel(v) ?? <span className="text-gray-400">não informado</span>}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatCurrency(valorLinha(v))}</td>
                        <td className="px-2 py-2 text-right"><RowActionButton icon={Eye} label="Ver detalhe" onClick={() => setAberta(v)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          )}

          {aba === 'agenda' && (
            previsoes.isLoading ? <Skeleton className="h-40 w-full" />
              : previsoes.isError ? <Aviso tom="red">A agenda não veio da e-extrato: {(previsoes.error as Error).message}</Aviso>
                : !agenda?.length ? <p className="px-2 py-8 text-center text-[13px] text-gray-500">Nenhum crédito agendado para os próximos {DIAS_AGENDA} dias.</p>
                  : (
                    <table className="w-full min-w-[560px] text-[12.5px]">
                      <thead className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className="px-2 py-2 text-left font-semibold">Dia do crédito</th>
                          <th className="px-2 py-2 text-left font-semibold">Adquirentes</th>
                          <th className="px-2 py-2 text-right font-semibold">Parcelas</th>
                          <th className="px-2 py-2 text-right font-semibold">Bruto</th>
                          <th className="px-2 py-2 text-right font-semibold">Taxas</th>
                          <th className="px-2 py-2 text-right font-semibold">Cai na conta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {agenda.map((d) => (
                          <tr key={d.dia}>
                            <td className="px-2 py-2 tabular-nums">{brData(d.dia)}</td>
                            <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{[...d.porOperadora.entries()].sort((a, b) => b[1] - a[1]).map(([op, v]) => `${op} ${formatCurrencyInt(v)}`).join(' · ')}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{d.parcelas}{d.antecipadas ? <span className="text-gray-400"> ({d.antecipadas} antecip.)</span> : null}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{formatCurrencyInt(d.bruto)}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{d.taxas ? `− ${formatCurrencyInt(d.taxas)}` : '—'}</td>
                            <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatCurrencyInt(d.liquido)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
          )}

          {aba === 'ajustes' && (
            ajustes.isLoading ? <Skeleton className="h-40 w-full" />
              : ajustes.isError ? <Aviso tom="red">Os ajustes não vieram da e-extrato: {(ajustes.error as Error).message}</Aviso>
                : !grupos?.length ? <p className="px-2 py-8 text-center text-[13px] text-gray-500">Nenhuma tarifa ou ajuste no período.</p>
                  : (
                    <table className="w-full min-w-[560px] text-[12.5px]">
                      <thead className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className="px-2 py-2 text-left font-semibold">Motivo</th>
                          <th className="px-2 py-2 text-right font-semibold">Lançamentos</th>
                          <th className="px-2 py-2 text-right font-semibold">Débitos</th>
                          <th className="px-2 py-2 text-right font-semibold">Créditos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {grupos.map((g) => (
                          <tr key={String(g.historico)}>
                            <td className={cn('px-2 py-2 font-medium', g.historico === 6 && 'text-red-600 dark:text-red-400')}>{g.nome}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{g.qtd}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{g.debito ? formatCurrencyInt(g.debito) : '—'}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{g.credito ? formatCurrencyInt(g.credito) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
          )}
        </div>
      </div>

      {resumo && (resumo.antecipadas.qtd > 0 || resumo.canceladas.qtd > 0) && (
        <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
          {resumo.antecipadas.qtd > 0 && <>{resumo.antecipadas.qtd} {resumo.antecipadas.qtd === 1 ? 'parcela antecipada' : 'parcelas antecipadas'} ({formatCurrencyInt(resumo.antecipadas.valor)}). </>}
          {resumo.canceladas.qtd > 0 && <>{resumo.canceladas.qtd} {resumo.canceladas.qtd === 1 ? 'cancelamento' : 'cancelamentos'} ({formatCurrencyInt(resumo.canceladas.valor)}).</>}
        </p>
      )}

      {aberta && <VendaModal v={aberta} onClose={() => setAberta(null)} />}
    </div>
  )
}

export default ConciliacaoCartaoTab
