import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Loader2, Search, X, Copy, Check } from 'lucide-react'
import { fetchEmpresasDaRede } from '@/api/endpoints/empresas'
import type { RedeRow } from '@/api/supabase/redes'

const fmtCnpj = (c: string | null | undefined) => {
  const d = (c ?? '').replace(/\D/g, '')
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c || '—'
}

/**
 * Postos de uma rede, lidos na hora do ERP (Quality /EMPRESAS) com a chave
 * DAQUELA rede — sem precisar trocar a rede selecionada. Só leitura.
 */
const PostosRedeModal = ({ rede, onClose }: { rede: RedeRow; onClose: () => void }) => {
  const q = useQuery({
    queryKey: ['empresas-da-rede', rede.id],
    queryFn: () => fetchEmpresasDaRede(rede),
    staleTime: 10 * 60_000,
    retry: 1,
  })
  const [busca, setBusca] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const postos = useMemo(() => {
    const t = busca.trim().toLowerCase()
    const dig = busca.replace(/\D/g, '')
    return [...(q.data?.resultados ?? [])]
      .sort((a, b) => (a.fantasia || a.razao || '').localeCompare(b.fantasia || b.razao || '', 'pt-BR'))
      .filter((e) => !t || (e.fantasia ?? '').toLowerCase().includes(t) || (e.razao ?? '').toLowerCase().includes(t)
        || (dig.length >= 2 && ((e.cnpj ?? '').replace(/\D/g, '').includes(dig) || String(e.codigo).includes(dig))))
  }, [q.data, busca])

  const copiar = async (texto: string, id: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(id); setTimeout(() => setCopiado(null), 1500) } catch { /* segue visível */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="postos-rede-titulo" className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/10 text-[#1e3a5f] dark:bg-blue-400/15 dark:text-blue-300"><Building2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p id="postos-rede-titulo" className="text-base font-semibold text-gray-900 dark:text-gray-100">{rede.nome}</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              {q.isLoading ? 'Buscando os postos no ERP…' : q.isError ? 'Não foi possível ler os postos' : `${q.data?.resultados?.length ?? 0} postos no ERP desta rede`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>

        {(q.data?.resultados?.length ?? 0) > 6 && (
          <div className="border-b border-gray-100 px-5 py-2.5 dark:border-gray-800">
            <span className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, código ou CNPJ" autoFocus
                className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-[#1e3a5f] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {q.isLoading ? (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Buscando os postos…</p>
          ) : q.isError ? (
            <p className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              O ERP não respondeu com a chave desta rede. Confira a CHAVE em Editar, ou tente de novo em instantes.
              <button type="button" onClick={() => q.refetch()} className="ml-2 font-semibold underline">Tentar de novo</button>
            </p>
          ) : postos.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">{busca ? 'Nenhum posto com essa busca.' : 'Nenhum posto cadastrado no ERP desta rede.'}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-2 font-semibold">Código</th>
                  <th className="px-3 py-2 font-semibold">Posto</th>
                  <th className="px-3 py-2 font-semibold">CNPJ</th>
                  <th className="px-5 py-2 font-semibold">Cidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {postos.map((e) => (
                  <tr key={e.codigo} className="text-gray-800 dark:text-gray-200">
                    <td className="px-5 py-2 font-mono text-[12px] tabular-nums text-gray-500">{e.codigo}</td>
                    <td className="px-3 py-2">
                      <span className="block font-medium">{e.fantasia || e.razao}</span>
                      {e.razao && e.razao !== e.fantasia && <span className="block text-[11px] text-gray-500 dark:text-gray-400">{e.razao}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        {fmtCnpj(e.cnpj)}
                        {e.cnpj && (
                          <button type="button" onClick={() => copiar(fmtCnpj(e.cnpj), String(e.codigo))} aria-label={`Copiar o CNPJ de ${e.fantasia || e.razao}`}
                            className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200">
                            {copiado === String(e.codigo) ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-[12.5px] text-gray-600 dark:text-gray-300">{[e.cidade, e.estado].filter(Boolean).join('/') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t border-gray-100 px-5 py-2.5 text-[11.5px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Lido agora do ERP (Quality) com a chave desta rede. Só leitura: nada é alterado.
        </div>
      </div>
    </div>
  )
}

export default PostosRedeModal
