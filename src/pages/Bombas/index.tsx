import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useIsMobile from '@/hooks/useIsMobile'
import BombaMobile from '@/pages/Bombas/BombaMobile'
import ControleBombas, { CabecalhoManutencao, type FiltroBombas } from '@/pages/Operacao/components/ControleBombas'
import { useManutencoesPosto } from '@/pages/Operacao/hooks/useManutencaoBombas'

const STATUS_OPCOES: { v: FiltroBombas['status']; l: string; dot?: string }[] = [
  { v: 'todos', l: 'Todas' },
  { v: 'critical', l: 'Verificar agora', dot: 'bg-red-500' },
  { v: 'warn', l: 'Manutenção próxima', dot: 'bg-amber-500' },
  { v: 'ok', l: 'Regular', dot: 'bg-green-500' },
  { v: 'sem-registro', l: 'Sem movimento', dot: 'bg-gray-400' },
]

/** Até quantos postos os grupos já abrem expandidos (acima disso, abre sob demanda). */
const ABRE_TODOS_ATE = 5

/** Bombas de UM posto — só monta (e só busca) quando o grupo está aberto. */
const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const BombasDoPosto = ({ codigo, nome, onRecolher, filtro }: { codigo: number; nome: string; onRecolher: () => void; filtro: FiltroBombas }) => {
  const { dataInicial } = useFilterStore()
  const manut = useManutencoesPosto(codigo)
  // Com manutenção registrada, os litros têm de vir DESDE ela até hoje (o
  // desgaste não reinicia com o filtro). Busca do mais antigo entre o filtro e
  // a última manutenção de cada bomba.
  const periodo = manut.desdeMaisAntigo
    ? { dataInicial: manut.desdeMaisAntigo < dataInicial ? manut.desdeMaisAntigo : dataInicial, dataFinal: hojeISO() }
    : undefined
  const { bombaRows, bombaRowsPrev, isLoading } = useOperacaoData(codigo, periodo)
  if (isLoading && bombaRows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="px-1 text-[13px] font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">{nome}</p>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }
  return <ControleBombas bombaRows={bombaRows} bombaRowsPrev={bombaRowsPrev} empresaCodigo={codigo} grupo={{ nome, onRecolher }} manut={manut} periodoEstendido={!!periodo} filtro={filtro} />
}

/**
 * Manutenção (aba da Operação) — as bombas de TODOS os postos do filtro do
 * topo, em grupos por posto (mesmo padrão do Reabastecimento). Cada grupo busca
 * os próprios dados; com mais de 5 postos os grupos começam fechados e carregam
 * ao abrir, para a tela não ficar pesada em rede grande. `empresaCodigo` (vindo
 * de um clique em outra tela) abre aquele posto.
 */
const Bombas = ({ empresaCodigo }: { embedded?: boolean; empresaCodigo?: number | null } = {}) => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postos = (empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  ).slice().sort((a, b) => a.fantasia.localeCompare(b.fantasia, 'pt-BR'))
  const isMobile = useIsMobile()

  // Grupos abertos: todos quando são poucos; senão só o que veio de um clique.
  // `null` = ainda no padrão (deriva do nº de postos, que chega depois).
  const [abertosUser, setAbertosUser] = useState<Set<number> | null>(null)
  const abertos = abertosUser ?? new Set(postos.length <= ABRE_TODOS_ATE ? postos.map((p) => p.codigo) : (empresaCodigo != null ? [empresaCodigo] : []))
  const alternar = (c: number) => {
    const n = new Set(abertos)
    if (n.has(c)) n.delete(c); else n.add(c)
    setAbertosUser(n)
  }

  const [filtro, setFiltro] = useState<FiltroBombas>({ status: 'todos', semRegistro: false, busca: '' })
  const filtrando = filtro.status !== 'todos' || filtro.semRegistro || filtro.busca.trim() !== ''

  if (isMobile) return <BombaMobile />

  return (
    <div className="space-y-6">
      <CabecalhoManutencao />

      {/* Filtros — valem para os grupos de todos os postos. */}
      {postos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f]">
          <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-gray-50 p-0.5 dark:bg-gray-900">
            {STATUS_OPCOES.map((o) => (
              <button key={o.v} type="button" onClick={() => setFiltro((f) => ({ ...f, status: o.v }))}
                className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                  filtro.status === o.v ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')}>
                {o.dot && <span className={cn('h-1.5 w-1.5 rounded-full', o.dot)} />}{o.l}
              </button>
            ))}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800">
            <input type="checkbox" checked={filtro.semRegistro} onChange={(e) => setFiltro((f) => ({ ...f, semRegistro: e.target.checked }))} className="h-3.5 w-3.5 accent-[#1e3a5f]" />
            Sem manutenção registrada
          </label>
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input value={filtro.busca} onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))} placeholder="Buscar bomba…"
              className="w-44 rounded-md border border-gray-200 bg-white py-1 pl-7 pr-2 text-[12px] focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          </div>
          {filtrando && (
            <button type="button" onClick={() => setFiltro({ status: 'todos', semRegistro: false, busca: '' })} className="text-[11px] font-semibold text-[#2563eb] hover:underline dark:text-blue-300">Limpar</button>
          )}
        </div>
      )}

      {postos.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          Nenhum posto disponível.
        </p>
      )}

      {postos.length > ABRE_TODOS_ATE && (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          {postos.length} postos no filtro: abra cada um para ver as bombas, ou filtre no topo.
        </p>
      )}

      {postos.map((p) => (
        abertos.has(p.codigo) ? (
          <BombasDoPosto key={p.codigo} codigo={p.codigo} nome={p.fantasia} onRecolher={() => alternar(p.codigo)} filtro={filtro} />
        ) : (
          <button
            key={p.codigo}
            type="button"
            onClick={() => alternar(p.codigo)}
            className="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-[#2563eb] dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black"
          >
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-[13px] font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">{p.fantasia}</span>
            <span className="ml-auto text-[11px] font-semibold text-[#2563eb] dark:text-blue-300">Ver bombas</span>
          </button>
        )
      ))}
    </div>
  )
}

export default Bombas
