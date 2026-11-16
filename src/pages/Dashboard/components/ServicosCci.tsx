import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Database, LineChart, Sparkles, Truck, Check, MessageCircle, ChevronDown, Lightbulb, type LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import useCciServicos from '@/hooks/useCciServicos'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import useContasResumo from '@/pages/Dashboard/hooks/useContasResumo'
import { CATALOGO } from '@/pages/Diagnostico/lib/recomendacoes'
import SecaoTitulo from './SecaoTitulo'

/** WhatsApp COMERCIAL da CCI (venda de serviço). */
const CCI_COMERCIAL = '5527992725459'
const RECOLHIDO_KEY = 'visor360.central.servicosCci.recolhido'

type Id = 'consultoria' | 'bpo-financeiro' | 'relatorios' | 'fleetpass' | 'visor360'
const ORDEM: Id[] = ['consultoria', 'bpo-financeiro', 'relatorios', 'fleetpass', 'visor360']
const ICONE: Record<Id, LucideIcon> = { consultoria: Briefcase, 'bpo-financeiro': Database, relatorios: LineChart, fleetpass: Truck, visor360: Sparkles }
const INFO: Record<Id, { nome: string; resumo: string }> = {
  ...CATALOGO,
  visor360: { nome: 'Visor360', resumo: 'O painel da rede no computador e no celular, com analista de IA junto.' },
}

const pct = (a: number, b: number) => Math.abs((a / b - 1) * 100).toFixed(1).replace('.', ',')

/** Papel do usuário logado: o bloco é só para dono (supervisor da rede) e diretor. */
const useSouSupervisor = () =>
  useQuery({
    queryKey: ['meu-papel'],
    queryFn: async () => {
      if (!supabase) return false
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) return false
      const { data } = await supabase.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle()
      return (data as { role?: string } | null)?.role === 'supervisor'
    },
    staleTime: 30 * 60 * 1000,
  })

/**
 * Vitrine dos serviços da CCI na Central (estilo "Game Pass" no meio da página):
 * o que a rede já tem, marcado, e o que mais pode contratar — sem preço. Um
 * serviço ganha destaque quando um número DESTA tela justifica (contas vencidas,
 * lucro caindo, vendas a prazo). Só dono e diretor veem.
 */
const ServicosCci = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const souSupervisor = useSouSupervisor()
  if (!isMaster && !souSupervisor.data) return null
  return <Vitrine />
}

const Vitrine = () => {
  const rede = useTenantStore((s) => s.rede?.nome ?? 'minha rede')
  const { ativosPorPosto, carregando } = useCciServicos()
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const { global, comparisonMode, isLoading: setoresCarregando } = useRedeSetores()
  const contas = useContasResumo()
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem(RECOLHIDO_KEY) === '1' } catch { return false } })
  const alternar = () => setRecolhido((v) => { try { localStorage.setItem(RECOLHIDO_KEY, v ? '0' : '1') } catch { /* sem storage */ } return !v })

  const total = empresas.length
  const cmp = comparisonMode === 'prevYear' ? 'mesmo período do ano passado' : 'mesmo período do mês passado'

  // Quantos postos têm cada serviço. Visor360: quem está aqui já usa.
  const emPostos = useMemo(() => {
    const m = new Map<Id, number>()
    for (const id of ORDEM) {
      if (id === 'visor360') { m.set(id, total); continue }
      m.set(id, empresas.filter((e) => ativosPorPosto.get(e.empresaCodigo)?.has(id)).length)
    }
    return m
  }, [empresas, ativosPorPosto, total])

  // Motivo ligado aos números da tela (só quando o dado já carregou e existe).
  const motivo = useMemo(() => {
    const m = new Map<Id, string>()
    const venc = contas.pagar?.buckets.vencidas
    if (!contas.isLoading && venc && venc.total > 0) {
      m.set('bpo-financeiro', `${formatCurrencyInt(venc.total)} em contas a pagar vencidas (${venc.count} docs.). Com o financeiro em dia, isso não acumula.`)
    }
    if (!setoresCarregando && global.lucroBrutoAnoAnterior > 0) {
      const lbCaiu = global.lucroBruto < global.lucroBrutoAnoAnterior
      const fatSubiu = global.faturamentoAnoAnterior > 0 && global.faturamento > global.faturamentoAnoAnterior
      if (lbCaiu) m.set('consultoria', `O lucro bruto está ${pct(global.lucroBruto, global.lucroBrutoAnoAnterior)}% abaixo do ${cmp}.`)
      if (lbCaiu && fatSubiu) m.set('relatorios', `O faturamento subiu ${pct(global.faturamento, global.faturamentoAnoAnterior)}%, mas o lucro bruto caiu. O relatório mostra onde a margem ficou.`)
    }
    const prazo = (contas.receber?.categorias ?? []).filter((c) => c.id === 'notas' || c.id === 'faturas')
    const prazoTotal = prazo.reduce((s, c) => s + c.total, 0)
    if (!contas.isLoading && prazoTotal > 0) {
      m.set('fleetpass', `${formatCurrencyInt(prazoTotal)} a receber de clientes a prazo (notas e faturas). Com frota pré-aprovada, o posto só abastece o que já foi autorizado.`)
    }
    return m
  }, [contas, global, setoresCarregando, cmp])

  if (carregando || total === 0) return null

  const tem = (id: Id) => (emPostos.get(id) ?? 0) > 0
  const completo = (id: Id) => (emPostos.get(id) ?? 0) >= total
  // Destacados primeiro, depois os disponíveis, por fim os já contratados.
  const peso = (id: Id) => (completo(id) ? 2 : motivo.has(id) ? 0 : 1)
  const lista = [...ORDEM].sort((a, b) => peso(a) - peso(b))
  const tudoContratado = ORDEM.every(completo)
  const qtdTem = ORDEM.filter(tem).length

  const link = (nome: string) =>
    `https://wa.me/${CCI_COMERCIAL}?text=${encodeURIComponent(`Olá! Sou da ${rede} e vi no Visor360 o serviço ${nome}. Quero conhecer.`)}`

  return (
    <section className="space-y-3">
      <SecaoTitulo
        titulo={tudoContratado ? 'Seus serviços CCI' : 'Serviços CCI'}
        subtitulo={tudoContratado ? 'Sua rede já conta com todos os serviços da CCI' : `Sua rede tem ${qtdTem} de ${ORDEM.length} · veja o que mais a CCI pode fazer por ela`}
      >
        <button type="button" onClick={alternar} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100">
          {recolhido ? 'Mostrar' : 'Recolher'} <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !recolhido && 'rotate-180')} />
        </button>
      </SecaoTitulo>

      {!recolhido && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {lista.map((id) => {
            const Icone = ICONE[id]
            const n = emPostos.get(id) ?? 0
            const ativo = n > 0
            const porque = !completo(id) ? motivo.get(id) : undefined
            return (
              <article
                key={id}
                className={cn(
                  'flex flex-col gap-2.5 rounded-xl border p-4',
                  porque
                    ? 'border-amber-400/60 bg-amber-50/60 dark:border-amber-400/40 dark:bg-amber-400/[0.06]'
                    : ativo
                      ? 'border-emerald-500/30 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/[0.05]'
                      : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-transparent',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200"><Icone className="h-4 w-4" /></span>
                  {ativo ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <Check className="h-3 w-3" /> {completo(id) || total === 1 ? 'Você tem' : `${n} de ${total} postos`}
                    </span>
                  ) : (
                    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">Disponível</span>
                  )}
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{INFO[id].nome}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-gray-600 dark:text-gray-400">{INFO[id].resumo}</p>
                </div>
                {porque && (
                  <p className="flex gap-1.5 rounded-lg bg-amber-100/70 px-2.5 py-2 text-[12px] leading-snug text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{porque}</span>
                  </p>
                )}
                {!completo(id) && (
                  <a
                    href={link(INFO[id].nome)}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                      porque ? 'bg-amber-500 text-white hover:bg-amber-600' : 'border border-gray-200 text-gray-700 hover:border-[#2563eb] hover:text-[#2563eb] dark:border-gray-700 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-300',
                    )}
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> {ativo ? 'Levar para os outros postos' : 'Quero conhecer'}
                  </a>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default ServicosCci
