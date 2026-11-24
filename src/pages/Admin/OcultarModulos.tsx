import { useMemo, useState, type ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { EyeOff, Eye, Pencil, ChevronRight, Loader2, X, Search, Building2, Globe2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { APP_STRUCTURE, NAV_GROUPS, tabKey, type AppModule } from '@/lib/appStructure'
import { fetchRedes, type RedeRow } from '@/api/supabase/redes'
import { salvarAppOculto, removerAppOculto, type AppOculto } from '@/api/supabase/appOcultos'
import { useAppOcultos, OCULTOS_QUERY_KEY } from '@/hooks/useOcultosCCI'
import RowActionButton from '@/components/tables/RowAction'
import InfoHint from '@/components/ui/InfoHint'

/**
 * Painel › Parâmetros › Ocultar módulos e abas (só a CCI).
 *
 * Esconde do menu e das abas o que não é tão necessário agora — em TODAS as
 * redes ou só nas escolhidas. Nada é apagado nem bloqueado no banco: mostrar de
 * novo devolve na hora. Vale para todos os usuários da rede (inclusive para a
 * CCI, que assim vê o app como o cliente vê). Esta tela lista tudo sempre.
 */

interface Alvo { chave: string; titulo: string; detalhe: string }

const OcultarModulos = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const qc = useQueryClient()
  const { data: ocultos = [], isLoading } = useAppOcultos()
  const { data: redes = [] } = useQuery({ queryKey: ['redes'], queryFn: fetchRedes, enabled: isMaster, staleTime: 5 * 60_000 })
  const [aberto, setAberto] = useState<string | null>(null)
  const [editando, setEditando] = useState<Alvo | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const porChave = useMemo(() => new Map(ocultos.map((o) => [o.chave, o])), [ocultos])
  const nomeRede = useMemo(() => new Map(redes.map((r) => [r.id, r.nome])), [redes])

  if (!isMaster) return <Navigate to="/painel/config" replace />

  const recarregar = () => qc.invalidateQueries({ queryKey: OCULTOS_QUERY_KEY })
  const mostrar = async (chave: string) => {
    setOcupado(chave); setErro(null)
    try { await removerAppOculto(chave); await recarregar() } catch (e) { setErro((e as Error).message) } finally { setOcupado(null) }
  }

  const qtdModulos = ocultos.filter((o) => !o.chave.includes('::')).length
  const qtdAbas = ocultos.length - qtdModulos

  const onde = (o: AppOculto) => (o.redes == null
    ? 'Oculto em todas as redes'
    : o.redes.length === 1
      ? `Oculto em ${nomeRede.get(o.redes[0]) ?? '1 rede'}`
      : `Oculto em ${o.redes.length} redes`)
  const nomesRedes = (o: AppOculto) => (o.redes ?? []).map((id) => nomeRede.get(id) ?? 'rede removida').join(', ')

  const Status = ({ o, sobMódulo }: { o?: AppOculto; sobMódulo?: boolean }) => {
    if (o) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11.5px] font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            {o.redes == null ? <Globe2 className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
            {onde(o)}
          </span>
          {o.redes && o.redes.length > 1 && <InfoHint text={nomesRedes(o)} />}
        </span>
      )
    }
    if (sobMódulo) return <span className="text-[11.5px] text-gray-400">Some junto com o módulo</span>
    return <span className="text-[11.5px] text-gray-400">Visível</span>
  }

  const Acoes = ({ alvo }: { alvo: Alvo }) => {
    const o = porChave.get(alvo.chave)
    const carregando = ocupado === alvo.chave
    return (
      <div className="flex justify-end gap-1.5">
        {o ? (
          <>
            <RowActionButton icon={Pencil} label="Onde" onClick={() => setEditando(alvo)} />
            <RowActionButton icon={carregando ? Loader2 : Eye} iconClassName={carregando ? 'animate-spin' : undefined} label="Mostrar" disabled={carregando} onClick={() => void mostrar(alvo.chave)} />
          </>
        ) : (
          <RowActionButton icon={EyeOff} label="Ocultar" onClick={() => setEditando(alvo)} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/[0.08] text-[#1e3a5f] dark:bg-white/[0.06] dark:text-gray-200">
            <EyeOff className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ocultar módulos e abas</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Esconde do menu o que não é tão necessário agora, em todas as redes ou só nas escolhidas. Nada é apagado: “Mostrar” devolve na hora.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11.5px] tabular-nums text-gray-600 dark:border-gray-700 dark:text-gray-300">
          {qtdModulos} {qtdModulos === 1 ? 'módulo oculto' : 'módulos ocultos'} · {qtdAbas} {qtdAbas === 1 ? 'aba oculta' : 'abas ocultas'}
        </span>
      </div>

      {erro && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{erro}</p>}

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (
        NAV_GROUPS.map((g) => {
          const mods = APP_STRUCTURE.filter((m) => m.group === g.id)
          if (!mods.length) return null
          return (
            <section key={g.id} className="space-y-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{g.label}</h3>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
                {mods.map((m) => (
                  <LinhaModulo key={m.path} m={m} aberto={aberto === m.path} onAbrir={() => setAberto(aberto === m.path ? null : m.path)}
                    oculto={porChave.get(m.path)} porChave={porChave} Status={Status} Acoes={Acoes} />
                ))}
              </div>
            </section>
          )
        })
      )}

      {editando && (
        <ModalOndeOcultar
          alvo={editando}
          atual={porChave.get(editando.chave)}
          redes={redes}
          onFechar={() => setEditando(null)}
          onSalvo={async () => { await recarregar(); setEditando(null) }}
        />
      )}
    </div>
  )
}

interface LinhaModuloProps {
  m: AppModule
  aberto: boolean
  onAbrir: () => void
  oculto?: AppOculto
  porChave: Map<string, AppOculto>
  Status: (p: { o?: AppOculto; sobMódulo?: boolean }) => ReactElement
  Acoes: (p: { alvo: Alvo }) => ReactElement
}

const LinhaModulo = ({ m, aberto, onAbrir, oculto, porChave, Status, Acoes }: LinhaModuloProps) => {
  const abasOcultas = m.tabs.filter((t) => porChave.has(tabKey(m.path, t.id))).length
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button type="button" onClick={onAbrir} disabled={!m.tabs.length} aria-expanded={aberto}
          className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default">
          <ChevronRight className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-90', !m.tabs.length && 'invisible')} />
          <span className={cn('truncate text-[13.5px] font-medium', oculto ? 'text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600' : 'text-gray-900 dark:text-gray-100')}>{m.label}</span>
          {m.tabs.length > 0 && (
            <span className="shrink-0 text-[11px] text-gray-400">
              {m.tabs.length} {m.tabs.length === 1 ? 'aba' : 'abas'}{abasOcultas ? ` · ${abasOcultas} oculta${abasOcultas > 1 ? 's' : ''}` : ''}
            </span>
          )}
        </button>
        <div className="hidden shrink-0 sm:block"><Status o={oculto} /></div>
        <Acoes alvo={{ chave: m.path, titulo: m.label, detalhe: 'Módulo inteiro (some do menu com todas as abas).' }} />
      </div>
      {aberto && m.tabs.length > 0 && (
        <div className="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50/60 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-800/30">
          {m.tabs.map((t) => {
            const chave = tabKey(m.path, t.id)
            const o = porChave.get(chave)
            return (
              <div key={t.id} className="flex items-center gap-3 py-2 pl-11 pr-4">
                <span className={cn('min-w-0 flex-1 truncate text-[13px]', o || oculto ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300', o && 'line-through decoration-gray-300 dark:decoration-gray-600')}>{t.label}</span>
                <div className="hidden shrink-0 sm:block"><Status o={o} sobMódulo={!o && !!oculto} /></div>
                <Acoes alvo={{ chave, titulo: `${m.label} › ${t.label}`, detalhe: 'Só esta aba (o módulo continua).' }} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface ModalProps {
  alvo: Alvo
  atual?: AppOculto
  redes: RedeRow[]
  onFechar: () => void
  onSalvo: () => Promise<void>
}

const ModalOndeOcultar = ({ alvo, atual, redes, onFechar, onSalvo }: ModalProps) => {
  const [todas, setTodas] = useState(atual ? atual.redes == null : true)
  const [escolhidas, setEscolhidas] = useState<Set<string>>(() => new Set(atual?.redes ?? []))
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return [...redes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).filter((r) => !q || r.nome.toLowerCase().includes(q))
  }, [redes, busca])
  const alternar = (id: string) => setEscolhidas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const podeSalvar = todas || escolhidas.size > 0

  const salvar = async () => {
    if (!podeSalvar) return
    setSalvando(true); setErro(null)
    try { await salvarAppOculto(alvo.chave, todas ? null : [...escolhidas]); await onSalvo() } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  const Opcao = ({ valor, titulo, texto, Icone }: { valor: boolean; titulo: string; texto: string; Icone: typeof Globe2 }) => (
    <button type="button" onClick={() => setTodas(valor)}
      className={cn('flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
        todas === valor ? 'border-[#1e3a5f] bg-[#1e3a5f]/[0.04] dark:border-blue-500 dark:bg-white/[0.04]' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800')}>
      <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', todas === valor ? 'border-[#1e3a5f] dark:border-blue-400' : 'border-gray-300 dark:border-gray-600')}>
        {todas === valor && <span className="h-2 w-2 rounded-full bg-[#1e3a5f] dark:bg-blue-400" />}
      </span>
      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <span>
        <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">{titulo}</span>
        <span className="block text-[11.5px] text-gray-500 dark:text-gray-400">{texto}</span>
      </span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Ocultar ${alvo.titulo}`}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100"><EyeOff className="h-4 w-4 shrink-0" /> <span className="truncate">Ocultar {alvo.titulo}</span></h2>
            <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">{alvo.detalhe}</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <Opcao valor={true} Icone={Globe2} titulo="Em todas as redes" texto="Inclusive nas redes que forem cadastradas depois." />
          <Opcao valor={false} Icone={Building2} titulo="Só nas redes escolhidas" texto="As outras redes continuam vendo normalmente." />

          {!todas && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                <Search className="h-3.5 w-3.5 text-gray-400" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar rede" className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100" />
                <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{escolhidas.size} de {redes.length}</span>
              </div>
              <div className="max-h-60 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
                {lista.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <input type="checkbox" checked={escolhidas.has(r.id)} onChange={() => alternar(r.id)} className="h-4 w-4 accent-[#1e3a5f]" />
                    <span className="truncate text-[13px] text-gray-800 dark:text-gray-200">{r.nome}</span>
                  </label>
                ))}
                {!lista.length && <p className="px-3 py-4 text-center text-[12px] text-gray-400">Nenhuma rede encontrada.</p>}
              </div>
            </div>
          )}

          {erro && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{erro}</p>}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button type="button" onClick={onFechar} className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Cancelar</button>
          <button type="button" onClick={() => void salvar()} disabled={!podeSalvar || salvando}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#16293f] disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700">
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />} {atual ? 'Salvar' : 'Ocultar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OcultarModulos
