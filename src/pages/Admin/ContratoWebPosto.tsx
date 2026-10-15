import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileSignature, Building2, KeyRound, Fuel, Wallet, Receipt, Save, Loader2,
  AlertTriangle, CheckCircle2, RefreshCw, Info, Handshake,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { fetchAppConfig, updateAppConfig } from '@/api/supabase/appConfig'
import { fetchRedes, fetchEmpresasCountForRede, toggleRedeRepasseWebposto, type RedeRow } from '@/api/supabase/redes'
import { fetchFechamentos, salvarFechamento } from '@/api/supabase/contratoFechamentos'
import { cn } from '@/lib/utils'

/**
 * Painel → Contrato WebPosto (só master): a conta do repasse.
 *
 * Nem toda rede entra: as que a CCI já tinha antes do contrato são clientes
 * PRÓPRIOS e ficam fora. Cada rede tem a origem comercial (WebPosto × CCI),
 * marcada aqui mesmo na tabela; só as do WebPosto somam no repasse.
 *
 * Postos = o que a API da Quality devolve em /EMPRESAS para cada chave, ao
 * vivo — é o mesmo número que o WebPosto enxerga, por isso é a base do repasse.
 * Valor = postos × valor por posto (líquido); o faturado aplica o gross-up da
 * alíquota efetiva do Simples (ver proposta). Parâmetros ficam em app_config.
 *
 * Honestidade do número: rede cuja chave não respondeu aparece como "não
 * contou" e fica FORA do total, com aviso — melhor um total parcial declarado
 * do que um total cheio inventado.
 */

const VALOR_PADRAO = 165.33

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}%`
const mascararChave = (c: string) => (c.length <= 8 ? '••••' : `${c.slice(0, 4)}…${c.slice(-4)}`)
const num = (v: number | string | null | undefined, fallback: number) => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500'
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400'
const cardCls = 'rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900'

interface Contagem {
  rede: RedeRow
  postos: number | null
}

const ContratoWebPosto = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const queryClient = useQueryClient()

  const { data: cfg, isLoading: cfgLoading } = useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig })
  const { data: redes = [], isLoading: redesLoading } = useQuery({ queryKey: ['redes'], queryFn: fetchRedes, enabled: isMaster })

  const ativas = useMemo(() => redes.filter((r) => r.ativo), [redes])
  const doRepasse = useMemo(() => ativas.filter((r) => !!r.repasse_webposto), [ativas])
  const proprias = useMemo(() => ativas.filter((r) => !r.repasse_webposto), [ativas])

  // Contagem ao vivo por chave: uma chamada /EMPRESAS por rede ativa (todas,
  // pra mostrar também o tamanho da base própria).
  const {
    data: contagens = [],
    isFetching: contando,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['contrato-webposto', 'postos', ativas.map((r) => r.id).join(',')],
    enabled: isMaster && ativas.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Contagem[]> =>
      Promise.all(ativas.map(async (rede) => ({ rede, postos: await fetchEmpresasCountForRede(rede) }))),
  })
  const contagemDe = (id: string) => contagens.find((c) => c.rede.id === id)

  // Fechamentos mensais (foto do repasse): histórico + botão "Fechar mês".
  const { data: fechamentos = [] } = useQuery({ queryKey: ['contrato-webposto', 'fechamentos'], queryFn: fetchFechamentos, enabled: isMaster })
  const [fechando, setFechando] = useState(false)
  const [erroFech, setErroFech] = useState<string | null>(null)

  // Origem comercial (WebPosto × CCI) editável na tabela.
  const origem = useMutation({
    mutationFn: ({ id, repasse }: { id: string; repasse: boolean }) => toggleRedeRepasseWebposto(id, repasse),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['redes'] }),
  })

  // Parâmetros editáveis
  const [valorPosto, setValorPosto] = useState(String(VALOR_PADRAO))
  const [aliquota, setAliquota] = useState('0')
  const [inicio, setInicio] = useState('')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvoEm, setSalvoEm] = useState<number | null>(null)

  useEffect(() => {
    if (!cfg) return
    setValorPosto(num(cfg.contrato_valor_posto, VALOR_PADRAO).toFixed(2))
    setAliquota(String(num(cfg.contrato_aliquota_pct, 0)))
    setInicio(cfg.contrato_inicio ?? '')
    setObs(cfg.contrato_observacoes ?? '')
  }, [cfg])

  if (!isMaster) return <Navigate to="/dashboard" replace />

  const valor = num(Number(valorPosto.replace(',', '.')), VALOR_PADRAO)
  const aliq = Math.min(99, Math.max(0, num(Number(aliquota.replace(',', '.')), 0)))

  // Só o canal WebPosto entra na conta.
  const contagensRepasse = doRepasse.map((r) => contagemDe(r.id)).filter((c): c is Contagem => !!c)
  const contadas = contagensRepasse.filter((c) => c.postos !== null)
  const falharam = contagensRepasse.filter((c) => c.postos === null)
  const totalPostos = contadas.reduce((a, c) => a + (c.postos ?? 0), 0)
  const liquidoMes = totalPostos * valor
  const faturadoMes = aliq > 0 ? liquidoMes / (1 - aliq / 100) : liquidoMes
  const impostoMes = faturadoMes - liquidoMes

  const postosProprios = proprias.reduce((a, r) => a + (contagemDe(r.id)?.postos ?? 0), 0)

  // Competência = mês corrente (1º dia). Já fechado → o botão vira "Refazer".
  const hoje = new Date()
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const jaFechado = fechamentos.some((f) => f.competencia === competencia)
  const mesLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
  const fecharMes = async () => {
    if (contadas.length === 0 || falharam.length > 0) return
    setFechando(true)
    setErroFech(null)
    try {
      await salvarFechamento({
        competencia,
        redes: contadas.length,
        postos: totalPostos,
        valor_posto: valor,
        aliquota_pct: aliq,
        liquido: liquidoMes,
        faturado: faturadoMes,
        detalhes: contadas.map((c) => ({ rede: c.rede.nome, postos: c.postos ?? 0, liquido: (c.postos ?? 0) * valor })),
        observacao: obs.trim() || null,
      })
      await queryClient.invalidateQueries({ queryKey: ['contrato-webposto', 'fechamentos'] })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErroFech(`Falha ao fechar o mês: ${msg}. Se falar em "relation ... does not exist", rode docs/supabase-contrato-fechamentos.sql.`)
    } finally {
      setFechando(false)
    }
  }

  const salvar = async () => {
    if (saving) return
    setSaving(true)
    setErro(null)
    try {
      await updateAppConfig({
        contrato_valor_posto: valor,
        contrato_aliquota_pct: aliq,
        contrato_inicio: inicio || null,
        contrato_observacoes: obs.trim(),
      })
      await queryClient.invalidateQueries({ queryKey: ['app-config'] })
      setSalvoEm(Date.now())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErro(`Falha ao salvar: ${msg}. Se falar em "column ... does not exist", rode docs/supabase-app-config-contrato.sql.`)
    } finally {
      setSaving(false)
    }
  }

  const carregando = cfgLoading || redesLoading

  const linhaRede = (r: RedeRow) => {
    const c = contagemDe(r.id)
    const postos = c?.postos ?? null
    const noRepasse = !!r.repasse_webposto
    return (
      <tr key={r.id} className="text-gray-800 dark:text-gray-200">
        <td className="px-5 py-2.5 font-medium">{r.nome}</td>
        <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{mascararChave(r.chave)}</td>
        <td className="px-3 py-2.5">
          <select
            value={noRepasse ? 'webposto' : 'cci'}
            onChange={(e) => origem.mutate({ id: r.id, repasse: e.target.value === 'webposto' })}
            disabled={origem.isPending}
            className={cn(
              'h-7 rounded-md border px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]',
              noRepasse
                ? 'border-[#1e3a5f]/30 bg-[#1e3a5f]/10 text-[#1e3a5f] dark:text-blue-300'
                : 'border-gray-300 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300',
            )}
            aria-label={`Origem comercial de ${r.nome}`}
          >
            <option value="webposto">Veio pelo WebPosto</option>
            <option value="cci">Cliente próprio da CCI</option>
          </select>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">
          {c === undefined ? <span className="text-gray-400">…</span> : postos === null ? <span className="text-amber-600">não contou</span> : postos}
        </td>
        <td className={cn('px-5 py-2.5 text-right tabular-nums', !noRepasse && 'text-gray-400')}>
          {postos === null || postos === undefined ? '—' : noRepasse ? brl(postos * valor) : 'fora do repasse'}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1e3a5f] text-white">
            <FileSignature className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Contrato WebPosto</h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              Quantos clientes vieram pelo WebPosto, quantas chaves, quantos postos e quanto eles repassam por mês. Visível só para diretores.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={contando || ativas.length === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', contando && 'animate-spin')} />
          {contando ? 'Contando postos…' : 'Recontar postos'}
        </button>
      </div>

      {/* KPIs — só o canal WebPosto */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi Icon={Handshake} rotulo="Clientes via WebPosto" valor={carregando ? '…' : String(doRepasse.length)} detalhe={`${proprias.length} cliente(s) próprio(s) da CCI fora da conta`} />
        <Kpi Icon={KeyRound} rotulo="Chaves no repasse" valor={carregando ? '…' : String(doRepasse.length)} detalhe="uma chave por rede" />
        <Kpi
          Icon={Fuel}
          rotulo="Postos no repasse"
          valor={contando && contagens.length === 0 ? '…' : String(totalPostos)}
          detalhe={falharam.length ? `${falharam.length} rede(s) não contou` : `+ ${postosProprios} postos próprios, fora da conta`}
          alerta={falharam.length > 0}
        />
        <Kpi Icon={Wallet} rotulo="Repasse líquido / mês" valor={brl(liquidoMes)} detalhe={`${totalPostos} × ${brl(valor)}`} destaque />
        <Kpi
          Icon={Receipt}
          rotulo="Valor faturado / mês"
          valor={brl(faturadoMes)}
          detalhe={aliq > 0 ? `imposto ${brl(impostoMes)} (${pct(aliq)})` : 'alíquota não informada'}
        />
      </div>

      {doRepasse.length === 0 && !carregando && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-[13px] text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Nenhuma rede marcada como "Veio pelo WebPosto" ainda. As redes atuais são clientes próprios da CCI. Quando entrar
            um cliente pelo WebPosto, troque a origem dele na coluna "Origem" e ele passa a contar no repasse.
          </span>
        </div>
      )}

      {falharam.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            A API não respondeu para {falharam.map((c) => c.rede.nome).join(', ')}. Esses postos estão fora do total acima.
            Confira a chave em Gerenciar redes ou tente recontar.
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Tabela por rede, em dois grupos */}
        <div className={cn(cardCls, 'p-0 overflow-hidden')}>
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Por rede</h2>
            {dataUpdatedAt > 0 && (
              <span className="text-[11px] text-gray-400">
                contagem às {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-2 font-semibold">Rede</th>
                  <th className="px-3 py-2 font-semibold">Chave</th>
                  <th className="px-3 py-2 font-semibold">Origem</th>
                  <th className="px-3 py-2 text-right font-semibold">Postos</th>
                  <th className="px-5 py-2 text-right font-semibold">Líquido / mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {ativas.length === 0 && !carregando && (
                  <tr><td colSpan={5} className="px-5 py-6 text-center text-gray-500">Nenhuma rede ativa cadastrada.</td></tr>
                )}
                {doRepasse.length > 0 && (
                  <tr className="bg-[#1e3a5f]/[0.06] text-[11px] font-semibold uppercase tracking-wide text-[#1e3a5f] dark:text-blue-300">
                    <td className="px-5 py-1.5" colSpan={5}>Vieram pelo WebPosto · entram no repasse</td>
                  </tr>
                )}
                {doRepasse.map(linhaRede)}
                {doRepasse.length > 0 && (
                  <tr className="bg-gray-50 font-semibold text-gray-900 dark:bg-gray-800/50 dark:text-gray-100">
                    <td className="px-5 py-2.5" colSpan={3}>Total do repasse ({contadas.length} de {doRepasse.length} redes contadas)</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{totalPostos}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{brl(liquidoMes)}</td>
                  </tr>
                )}
                {proprias.length > 0 && (
                  <tr className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
                    <td className="px-5 py-1.5" colSpan={5}>Clientes próprios da CCI · fora do repasse</td>
                  </tr>
                )}
                {proprias.map(linhaRede)}
              </tbody>
            </table>
          </div>
          {redes.some((r) => !r.ativo) && (
            <p className="border-t border-gray-100 px-5 py-2.5 text-[11px] text-gray-400 dark:border-gray-800">
              Inativas (fora de tudo): {redes.filter((r) => !r.ativo).map((r) => r.nome).join(', ')}
            </p>
          )}
        </div>

        {/* Parâmetros do contrato */}
        <div className={cn(cardCls, 'space-y-4')}>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Parâmetros do contrato</h2>
            <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">O que foi acordado com o WebPosto. Muda a conta na hora.</p>
          </div>
          <div>
            <label className={labelCls} htmlFor="valor-posto">Valor líquido por posto ativo (R$/mês)</label>
            <input id="valor-posto" className={cn(inputCls, 'mt-1 tabular-nums')} inputMode="decimal" value={valorPosto} onChange={(e) => { setValorPosto(e.target.value); setSalvoEm(null) }} />
          </div>
          <div>
            <label className={labelCls} htmlFor="aliquota">Alíquota efetiva do Simples (%)</label>
            <input id="aliquota" className={cn(inputCls, 'mt-1 tabular-nums')} inputMode="decimal" value={aliquota} onChange={(e) => { setAliquota(e.target.value); setSalvoEm(null) }} placeholder="ex.: 6,00" />
            <p className="mt-1 text-[11px] text-gray-400">Faturado = líquido ÷ (1 − alíquota). Zero enquanto o contador não apurar.</p>
          </div>
          <div>
            <label className={labelCls} htmlFor="inicio">Início da vigência</label>
            <input id="inicio" type="date" className={cn(inputCls, 'mt-1')} value={inicio} onChange={(e) => { setInicio(e.target.value); setSalvoEm(null) }} />
          </div>
          <div>
            <label className={labelCls} htmlFor="obs">Observações</label>
            <textarea id="obs" rows={3} className={cn(inputCls, 'mt-1')} value={obs} onChange={(e) => { setObs(e.target.value); setSalvoEm(null) }} placeholder="Reajuste anual, condições combinadas…" />
          </div>

          <div className="rounded-lg bg-gray-50 p-3 text-[12px] text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            <div className="flex justify-between"><span>Postos × valor</span><span className="tabular-nums">{brl(liquidoMes)}</span></div>
            <div className="flex justify-between"><span>Imposto ({pct(aliq)})</span><span className="tabular-nums">{brl(impostoMes)}</span></div>
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100"><span>Faturado / mês</span><span className="tabular-nums">{brl(faturadoMes)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Projeção 12 meses (líquido)</span><span className="tabular-nums">{brl(liquidoMes * 12)}</span></div>
          </div>

          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
            </div>
          )}

          <button
            type="button"
            onClick={() => void salvar()}
            disabled={saving}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] text-sm font-semibold text-white hover:bg-[#162d4a] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : salvoEm ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? 'Salvando…' : salvoEm ? 'Salvo' : 'Salvar parâmetros'}
          </button>

          {/* Fechar mês: congela a foto do repasse (redes, postos, valores) pra conferir o pagamento depois. */}
          <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fechamento de {mesLabel(competencia)}</h3>
              <button
                type="button"
                onClick={() => void fecharMes()}
                disabled={fechando || contando || contadas.length === 0 || falharam.length > 0}
                title={falharam.length > 0 ? 'Há redes sem contagem; tente novamente antes de fechar.' : contadas.length === 0 ? 'Nenhuma rede no repasse ainda.' : undefined}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#1e3a5f] px-3 text-xs font-semibold text-[#1e3a5f] hover:bg-[#1e3a5f]/5 disabled:opacity-50 dark:border-blue-300 dark:text-blue-300"
              >
                {fechando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {jaFechado ? 'Refazer fechamento' : 'Fechar mês'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Guarda redes, postos e valores de hoje como a conta do mês. Serve pra conferir o repasse quando ele chegar.
            </p>
            {erroFech && <p className="text-[12px] text-red-600 dark:text-red-400">{erroFech}</p>}
            {fechamentos.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="py-1 font-semibold">Mês</th>
                    <th className="py-1 text-right font-semibold">Redes</th>
                    <th className="py-1 text-right font-semibold">Postos</th>
                    <th className="py-1 text-right font-semibold">Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {fechamentos.slice(0, 12).map((f) => (
                    <tr key={f.id} className={cn(f.competencia === competencia && 'font-semibold text-gray-900 dark:text-gray-100')} title={f.observacao ?? undefined}>
                      <td className="py-1.5 capitalize">{mesLabel(f.competencia)}</td>
                      <td className="py-1.5 text-right tabular-nums">{f.redes}</td>
                      <td className="py-1.5 text-right tabular-nums">{f.postos}</td>
                      <td className="py-1.5 text-right tabular-nums">{brl(Number(f.liquido))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="flex items-start gap-1.5 text-[11px] text-gray-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A contagem de postos vem da API do WebPosto para cada chave, por isso é o mesmo número que eles enxergam. A origem
            (WebPosto ou CCI) é marcada por rede, nesta tela; quem muda é o diretor.
          </p>
        </div>
      </div>
    </div>
  )
}

const Kpi = ({
  Icon, rotulo, valor, detalhe, destaque, alerta,
}: {
  Icon: typeof Building2; rotulo: string; valor: string; detalhe?: string; destaque?: boolean; alerta?: boolean
}) => (
  <div className={cn(cardCls, 'p-4', destaque && 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:bg-[#1e3a5f]')}>
    <div className={cn('flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide', destaque ? 'text-white/70' : 'text-gray-500 dark:text-gray-400')}>
      <Icon className="h-3.5 w-3.5" /> {rotulo}
    </div>
    <div className={cn('mt-2 text-2xl font-bold tabular-nums', destaque ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>{valor}</div>
    {detalhe && <div className={cn('mt-1 text-[11px]', destaque ? 'text-white/70' : alerta ? 'text-amber-600' : 'text-gray-500 dark:text-gray-400')}>{detalhe}</div>}
  </div>
)

export default ContratoWebPosto
