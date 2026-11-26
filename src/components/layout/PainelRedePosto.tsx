import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Network, Fuel, Check, Search, ArrowLeftRight, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useDemoStore } from '@/store/demo'
import { useFilters } from '@/hooks/useFilters'
import { useRedeNomeExibicao } from '@/hooks/useDemo'
import { fetchRedes, redeParaTenant } from '@/api/supabase/redes'
import { fetchEmpresasDaRede } from '@/api/endpoints/empresas'
import { nomeLegivel } from '@/lib/nomeLegivel'
import ComoFuncionaButton from '@/components/help/ComoFuncionaButton'
import type { Empresa } from '@/api/types/empresa'

interface Props {
  postos: Empresa[]
  /** O módulo aceita "Todos os postos" (rede consolidada). */
  allowTodos: boolean
  /** O módulo compara a rede toda: o filtro de posto não se aplica. */
  redeWide: boolean
  /** Ao Vivo: posto travado. */
  /** Ao Vivo: só o período fica travado; o posto continua escolhível. */
  liveLock: boolean
  onClose: () => void
}

const ROTULO = 'mb-1.5 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-[#64748b]'
const linha = (ativo: boolean) => cn(
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors',
  ativo
    ? 'bg-teal-50 font-semibold text-teal-900 dark:bg-teal-500/[0.12] dark:text-white'
    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.05]',
)

/**
 * Janela de Rede e Posto (pílula do topo): duas listas simples, um clique troca.
 * Rede: a CCI escolhe na lista; quem tem mais de uma rede vai para Selecionar
 * rede; com uma rede só, apenas mostra. Posto: "Todos os postos" é a primeira
 * linha da lista (quando o módulo aceita); "Marcar vários" para comparar postos.
 */
const PainelRedePosto = ({ postos, allowTodos, redeWide, onClose }: Props) => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const acessoTodas = useAuthStore((s) => s.acessoTodasRedes)
  const redesPermitidas = useAuthStore((s) => s.redesPermitidas)
  const tenant = useTenantStore((s) => s.rede)
  const setRede = useTenantStore((s) => s.setRede)
  const demo = useDemoStore((s) => s.ativo)
  const redeAtual = useRedeNomeExibicao(tenant?.nome)
  const { empresaCodigos, setEmpresas } = useFilters()
  const qc = useQueryClient()

  const [buscaRede, setBuscaRede] = useState('')
  const [buscaPosto, setBuscaPosto] = useState('')
  // Padrão: marcar vários (caixinhas + Aplicar). Só onde o módulo aceita mais de um posto.
  const [varios, setVarios] = useState(allowTodos && !redeWide)
  const [rascunho, setRascunho] = useState<number[]>(empresaCodigos)

  // ── Redes (só a CCI escolhe aqui) ──
  const { data: redes = [] } = useQuery({ queryKey: ['redes'], queryFn: fetchRedes, enabled: isMaster, staleTime: 5 * 60_000 })
  const redesAtivas = useMemo(() => redes.filter((r) => r.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [redes])
  const redesVisiveis = redesAtivas
    .map((r, i) => ({ r, nome: demo ? `Rede ${i + 1}` : nomeLegivel(r.nome) }))
    .filter((x) => !buscaRede.trim() || x.nome.toLowerCase().includes(buscaRede.trim().toLowerCase()))
  // Rede escolhida e ainda NÃO aplicada (null = fica na atual). A janela continua
  // aberta mostrando os postos dela, com "Todos os postos" marcado; só troca no "Aplicar filtro".
  const [redeAlvoId, setRedeAlvoId] = useState<string | null>(null)
  const redeAlvo = redeAlvoId ? redes.find((r) => r.id === redeAlvoId) ?? null : null
  const [postosAlvoSel, setPostosAlvoSel] = useState<number[]>([])
  const escolherRede = (id: string) => {
    if (id === tenant?.id) { setRedeAlvoId(null); return }
    setRedeAlvoId(id)
    setPostosAlvoSel([])
    setRascunho([])
    setBuscaPosto('')
  }
  const { data: empresasAlvo, isLoading: carregandoAlvo } = useQuery({
    queryKey: ['empresas-da-rede', redeAlvo?.id],
    queryFn: () => fetchEmpresasDaRede({ chave: redeAlvo!.chave, api_base_url: redeAlvo!.api_base_url }),
    enabled: !!redeAlvo,
    staleTime: 10 * 60_000,
  })
  const aplicarRede = () => {
    if (!redeAlvo) return
    setRede(redeParaTenant(redeAlvo))
    qc.clear() // os dados antigos são da rede anterior
    setEmpresas(postosAlvoSel)
    onClose()
  }
  const aplicarRedeCom = (codigos: number[]) => {
    if (!redeAlvo) return
    setRede(redeParaTenant(redeAlvo))
    qc.clear()
    setEmpresas(codigos)
    onClose()
  }
  const podeTrocar = !isMaster && (acessoTodas || redesPermitidas.length > 1)

  // ── Postos ──
  const listaPostos = useMemo(() => [...(redeAlvo ? (empresasAlvo?.resultados ?? []) : postos)]
    .map((p) => ({ codigo: p.codigo, nome: nomeLegivel(p.fantasia || p.razao || `Posto ${p.codigo}`), cidade: p.cidade ? nomeLegivel(p.cidade) : '' }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [redeAlvo, empresasAlvo, postos])
  const postosVisiveis = listaPostos.filter((p) => !buscaPosto.trim() || `${p.nome} ${p.cidade}`.toLowerCase().includes(buscaPosto.trim().toLowerCase()))
  const escolherPosto = (codigos: number[]) => { setEmpresas(codigos); onClose() }
  const alternarRascunho = (c: number) => setRascunho((d) => (d.includes(c) ? d.filter((x) => x !== c) : [...d, c]))
  const mostraPostos = !redeWide && listaPostos.length > 1
  // Com rede nova escolhida: a seleção de posto é rascunho (vale no Aplicar).
  const selAtual = redeAlvo ? postosAlvoSel : empresaCodigos
  const clicarPosto = (codigos: number[]) => (redeAlvo ? setPostosAlvoSel(codigos) : escolherPosto(codigos))

  return (
    <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[min(640px,80vh)] w-[380px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#2f3b4f] dark:bg-[#1e293b]">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {/* ── Rede ── */}
        <section>
          <p className={ROTULO}>
            <span className="flex items-center gap-1.5"><Network className="h-3.5 w-3.5" /> Rede</span>
            {podeTrocar && (
              <Link to="/painel/selecionar-rede" onClick={onClose} className="inline-flex items-center gap-1 normal-case tracking-normal text-teal-700 hover:underline dark:text-[#5eead4]">
                <ArrowLeftRight className="h-3 w-3" /> Trocar de rede
              </Link>
            )}
          </p>
          {isMaster && redesAtivas.length > 1 ? (
            <>
              {redesAtivas.length > 6 && (
                <span className="relative mb-1.5 block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input value={buscaRede} onChange={(e) => setBuscaRede(e.target.value)} placeholder="Buscar rede"
                    className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-[12.5px] outline-none focus:border-teal-500 dark:border-[#2f3b4f] dark:bg-[#0f172a] dark:text-gray-100" />
                </span>
              )}
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                {redesVisiveis.map(({ r, nome }) => (
                  <button key={r.id} type="button" onClick={() => escolherRede(r.id)} className={linha(r.id === (redeAlvoId ?? tenant?.id))}>
                    <span className="min-w-0 flex-1 truncate">{nome}</span>
                    {r.id === redeAlvoId && <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">a aplicar</span>}
                    {r.id === (redeAlvoId ?? tenant?.id) && <Check className="h-4 w-4 shrink-0 text-teal-600 dark:text-[#5eead4]" />}
                  </button>
                ))}
                {redesVisiveis.length === 0 && <p className="px-2.5 py-2 text-[12px] text-gray-400">Nenhuma rede com esse nome.</p>}
              </div>
            </>
          ) : (
            <div className={linha(true)}>
              <span className="min-w-0 flex-1 truncate">{redeAtual ? nomeLegivel(redeAtual) : '—'}</span>
            </div>
          )}
        </section>

        {/* ── Posto ── */}
        <section>
          <p className={ROTULO}>
            <span className="flex items-center gap-1.5"><Fuel className="h-3.5 w-3.5" /> Posto</span>
            {mostraPostos && allowTodos && (
              <button type="button" onClick={() => { setVarios((v) => !v); setRascunho(selAtual) }}
                className="normal-case tracking-normal text-teal-700 hover:underline dark:text-[#5eead4]">
                {varios ? 'Escolher um só' : 'Marcar vários'}
              </button>
            )}
          </p>

          {redeWide ? (
            <p className="flex items-start gap-2 rounded-lg bg-gray-50 px-2.5 py-2 text-[12.5px] text-gray-500 dark:bg-[#0f172a] dark:text-[#94a3b8]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Esta tela compara todos os postos da rede; aqui não se escolhe posto.
            </p>
          ) : redeAlvo && carregandoAlvo ? (
            <p className="flex items-center gap-2 px-2.5 py-2 text-[12.5px] text-gray-500 dark:text-[#94a3b8]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando os postos da rede…</p>
          ) : !mostraPostos ? (
            <div className={linha(true)}><span className="truncate">{listaPostos[0]?.nome ?? '—'}</span></div>
          ) : (
            <>
              {listaPostos.length > 6 && (
                <span className="relative mb-1.5 block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input value={buscaPosto} onChange={(e) => setBuscaPosto(e.target.value)} placeholder="Buscar posto ou cidade"
                    className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-[12.5px] outline-none focus:border-teal-500 dark:border-[#2f3b4f] dark:bg-[#0f172a] dark:text-gray-100" />
                </span>
              )}
              <div className="max-h-72 space-y-0.5 overflow-y-auto">
                {allowTodos && !varios && !buscaPosto.trim() && (
                  <button type="button" onClick={() => clicarPosto([])} className={linha(selAtual.length === 0)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">Todos os postos</span>
                      <span className="block text-[11px] font-normal text-gray-500 dark:text-[#94a3b8]">a rede inteira somada</span>
                    </span>
                    {selAtual.length === 0 && <Check className="h-4 w-4 shrink-0 text-teal-600 dark:text-[#5eead4]" />}
                  </button>
                )}
                {postosVisiveis.map((p) => {
                  const ativo = varios ? rascunho.includes(p.codigo) : selAtual.length === 1 && selAtual[0] === p.codigo
                  return (
                    <button key={p.codigo} type="button" onClick={() => (varios ? alternarRascunho(p.codigo) : clicarPosto([p.codigo]))} className={linha(ativo)}>
                      {varios && (
                        <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', ativo ? 'border-teal-600 bg-teal-600 text-white' : 'border-gray-300 dark:border-[#3e4c63]')}>
                          {ativo && <Check className="h-3 w-3" />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{p.nome}</span>
                        {p.cidade && <span className="block truncate text-[11px] font-normal text-gray-500 dark:text-[#94a3b8]">{p.cidade}</span>}
                      </span>
                      {!varios && ativo && <Check className="h-4 w-4 shrink-0 text-teal-600 dark:text-[#5eead4]" />}
                    </button>
                  )
                })}
                {postosVisiveis.length === 0 && <p className="px-2.5 py-2 text-[12px] text-gray-400">Nenhum posto com esse nome.</p>}
              </div>
            </>
          )}
        </section>
      </div>

      {redeAlvo ? (
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2.5 dark:border-white/[0.06]">
          {varios && mostraPostos && !carregandoAlvo ? (
            <span className="flex flex-col gap-0.5">
              <span className="text-[12.5px] text-gray-500 dark:text-[#94a3b8]">{rascunho.length === 0 ? 'Nenhum marcado = todos' : `${rascunho.length} ${rascunho.length === 1 ? 'posto marcado' : 'postos marcados'}`}</span>
              <button type="button" onClick={() => setRascunho(listaPostos.every((p) => rascunho.includes(p.codigo)) ? [] : listaPostos.map((p) => p.codigo))}
                className="w-fit text-[12px] font-semibold text-teal-700 hover:underline dark:text-[#5eead4]">
                {listaPostos.length > 0 && listaPostos.every((p) => rascunho.includes(p.codigo)) ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </span>
          ) : <span />}
          <span className="flex items-center gap-3">
            <button type="button" onClick={() => setRedeAlvoId(null)} className="text-[12.5px] text-gray-500 hover:text-gray-800 dark:text-[#94a3b8] dark:hover:text-white">Cancelar</button>
            <button type="button" onClick={() => (varios ? aplicarRedeCom(rascunho) : aplicarRede())} disabled={carregandoAlvo}
              className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Aplicar filtro</button>
          </span>
        </div>
      ) : varios && mostraPostos && !redeWide ? (
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2.5 dark:border-white/[0.06]">
          <span className="flex flex-col gap-0.5">
            <span className="text-[12.5px] text-gray-500 dark:text-[#94a3b8]">{rascunho.length === 0 ? 'Nenhum marcado = todos' : `${rascunho.length} ${rascunho.length === 1 ? 'posto marcado' : 'postos marcados'}`}</span>
            {/* Marcar / desmarcar todos de uma vez */}
            <button type="button" onClick={() => setRascunho(listaPostos.every((p) => rascunho.includes(p.codigo)) ? [] : listaPostos.map((p) => p.codigo))}
              className="w-fit text-[12px] font-semibold text-teal-700 hover:underline dark:text-[#5eead4]">
              {listaPostos.length > 0 && listaPostos.every((p) => rascunho.includes(p.codigo)) ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </span>
          <button type="button" onClick={() => escolherPosto(rascunho)} className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-teal-700">Aplicar</button>
        </div>
      ) : (
        <div className="border-t border-gray-100 px-3 py-2 dark:border-white/[0.06]">
          <ComoFuncionaButton />
        </div>
      )}
    </div>
  )
}

export default PainelRedePosto
