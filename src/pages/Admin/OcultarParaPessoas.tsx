import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, UserRound, Loader2, Check, EyeOff, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { APP_STRUCTURE, NAV_GROUPS, tabKey } from '@/lib/appStructure'
import { fetchUsuariosDaRede, type UsuarioRede } from '@/api/supabase/gestaoTarefas'
import { fetchOcultosPessoas, salvarOcultosPessoa } from '@/api/supabase/appOcultosPessoas'
import { ocultosPessoasKey } from '@/hooks/useOcultosCCI'
import { useRedeNomeExibicao } from '@/hooks/useDemo'
import { nomeLegivel } from '@/lib/nomeLegivel'
import InfoHint from '@/components/ui/InfoHint'

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Ocultar módulos e abas PARA PESSOAS da rede aberta (diretor ou supervisor).
 * Escolhe a pessoa à esquerda e marca o que ela NÃO deve ver à direita. Só
 * visual: a permissão de acesso continua no cadastro do usuário.
 */
const OcultarParaPessoas = () => {
  const qc = useQueryClient()
  const isMaster = useAuthStore((s) => s.isMaster)
  const meuId = useAuthStore((s) => s.user?.id ?? null)
  const rede = useTenantStore((s) => s.rede)
  const redeNome = useRedeNomeExibicao(rede?.nome)
  const redeId = rede?.id ?? null

  const { data: usuarios = [], isLoading: carregandoUsuarios } = useQuery({
    queryKey: ['gestao-usuarios', redeId],
    queryFn: () => fetchUsuariosDaRede(redeId!),
    enabled: !!redeId,
    staleTime: 5 * 60_000,
  })
  const { data: ocultos = [] } = useQuery({
    queryKey: ocultosPessoasKey(redeId),
    queryFn: () => fetchOcultosPessoas(redeId!),
    enabled: !!redeId,
    staleTime: 60_000,
  })

  const [busca, setBusca] = useState('')
  const [pessoa, setPessoa] = useState<UsuarioRede | null>(null)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [abertos, setAbertos] = useState<Set<string>>(new Set())

  // Supervisor não esconde nada de diretor nem de si mesmo; diretor não esconde de si mesmo.
  const elegiveis = useMemo(() => usuarios.filter((u) => u.user_id !== meuId && (isMaster || !u.is_master)), [usuarios, meuId, isMaster])
  const qtdPorPessoa = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of ocultos) m.set(o.user_id, (m.get(o.user_id) ?? 0) + 1)
    return m
  }, [ocultos])
  const lista = elegiveis.filter((u) => !busca.trim() || norm(`${u.nome} ${u.email}`).includes(norm(busca.trim())))

  const escolher = (u: UsuarioRede) => {
    setPessoa(u)
    setMsg(null)
    setMarcados(new Set(ocultos.filter((o) => o.user_id === u.user_id).map((o) => o.chave)))
  }
  const alternar = (chave: string) => setMarcados((s) => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n })
  const salvar = async () => {
    if (!pessoa || !redeId) return
    setSalvando(true); setMsg(null)
    try {
      await salvarOcultosPessoa(redeId, pessoa.user_id, [...marcados])
      await qc.invalidateQueries({ queryKey: ocultosPessoasKey(redeId) })
      setMsg({ ok: true, texto: marcados.size === 0 ? `${pessoa.nome} volta a ver tudo o que pode acessar.` : `Salvo: ${marcados.size} ${marcados.size === 1 ? 'item oculto' : 'itens ocultos'} para ${pessoa.nome}.` })
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message })
    } finally {
      setSalvando(false)
    }
  }

  if (!redeId) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Por pessoa · {redeNome ? nomeLegivel(redeNome) : 'rede aberta'}
          <InfoHint text="Esconde módulos e abas do menu de uma pessoa desta rede. É só o que ela vê: o acesso continua sendo definido no cadastro do usuário (módulos liberados). Diretores e supervisores podem usar; supervisor não esconde nada de diretor." />
        </h2>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">Escolha a pessoa e marque o que ela não deve ver.</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[320px_minmax(0,1fr)] dark:border-gray-700">
        {/* Pessoas */}
        <div className="min-w-0">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar entre ${elegiveis.length} pessoas…`}
              className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-[13px] outline-none focus:border-teal-500 dark:border-[#2f3b4f] dark:bg-[#0b1220] dark:text-gray-100" />
          </label>
          <ul className="mt-2 max-h-[420px] space-y-0.5 overflow-y-auto">
            {carregandoUsuarios && <li className="flex items-center gap-2 px-2 py-3 text-[12.5px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando pessoas…</li>}
            {lista.map((u) => {
              const n = qtdPorPessoa.get(u.user_id) ?? 0
              const ativo = pessoa?.user_id === u.user_id
              return (
                <li key={u.user_id}>
                  <button type="button" onClick={() => escolher(u)}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors', ativo ? 'bg-teal-50 dark:bg-[#0d9488]/[0.14]' : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]')}>
                    <UserRound className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[13px]', ativo ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200')}>{u.nome}</span>
                      <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{u.email}{u.role === 'supervisor' ? ' · supervisor' : u.is_master ? ' · diretor' : ''}</span>
                    </span>
                    {n > 0 && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"><EyeOff className="h-3 w-3" />{n}</span>}
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                  </button>
                </li>
              )
            })}
            {!carregandoUsuarios && lista.length === 0 && <li className="px-2 py-3 text-center text-[12px] text-gray-400">Ninguém com esse nome.</li>}
          </ul>
        </div>

        {/* O que esconder */}
        <div className="min-w-0">
          {!pessoa ? (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-200 text-[13px] text-gray-500 dark:border-[#2f3b4f] dark:text-gray-400">
              Escolha uma pessoa à esquerda.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-gray-700 dark:text-gray-200">Marque o que <b className="font-semibold">{pessoa.nome}</b> não deve ver:</p>
              <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
                {NAV_GROUPS.map((g) => {
                  const mods = APP_STRUCTURE.filter((m) => m.group === g.id)
                  if (mods.length === 0) return null
                  return (
                    <div key={g.id}>
                      <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">{g.label}</p>
                      <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-[#2f3b4f] dark:border-[#2f3b4f]">
                        {mods.map((m) => {
                          const modOculto = marcados.has(m.path)
                          const temAbas = m.tabs.length > 1
                          const aberto = abertos.has(m.path)
                          const abasOcultas = m.tabs.filter((t) => marcados.has(tabKey(m.path, t.id))).length
                          return (
                            <div key={m.path}>
                              <div className="flex items-center gap-2 px-3 py-2">
                                <input type="checkbox" checked={modOculto} onChange={() => alternar(m.path)} aria-label={`Ocultar ${m.label}`}
                                  className="h-4 w-4 cursor-pointer accent-amber-500" />
                                <span className={cn('min-w-0 flex-1 truncate text-[13px]', modOculto ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100')}>{m.label}</span>
                                {!modOculto && abasOcultas > 0 && <span className="text-[11px] text-amber-600 dark:text-amber-300">{abasOcultas} {abasOcultas === 1 ? 'aba oculta' : 'abas ocultas'}</span>}
                                {temAbas && !modOculto && (
                                  <button type="button" onClick={() => setAbertos((s) => { const n = new Set(s); if (n.has(m.path)) n.delete(m.path); else n.add(m.path); return n })}
                                    className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-teal-700 hover:underline dark:text-[#5eead4]">
                                    Abas <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', aberto && 'rotate-90')} />
                                  </button>
                                )}
                              </div>
                              {temAbas && !modOculto && aberto && (
                                <div className="grid gap-x-4 gap-y-1 bg-gray-50/60 px-3 py-2 pl-9 sm:grid-cols-2 dark:bg-[#0b1220]">
                                  {m.tabs.map((t) => {
                                    const k = tabKey(m.path, t.id)
                                    return (
                                      <label key={k} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-gray-700 dark:text-gray-300">
                                        <input type="checkbox" checked={marcados.has(k)} onChange={() => alternar(k)} className="h-3.5 w-3.5 accent-amber-500" />
                                        <span className={cn(marcados.has(k) && 'text-gray-400 line-through')}>{t.label}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-[#2f3b4f]">
                <span className={cn('text-[12.5px]', msg ? (msg.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400') : 'text-gray-500 dark:text-gray-400')}>
                  {msg ? msg.texto : marcados.size === 0 ? 'Nada oculto: vê tudo o que pode acessar.' : `${marcados.size} ${marcados.size === 1 ? 'item marcado' : 'itens marcados'} para ocultar.`}
                </span>
                <button type="button" onClick={() => void salvar()} disabled={salvando}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 text-[13px] font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar para {pessoa.nome.split(' ')[0]}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default OcultarParaPessoas
