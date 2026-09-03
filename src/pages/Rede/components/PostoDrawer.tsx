import { useEffect } from 'react'
import { X, Building2, FileText, MapPin, Hash, ExternalLink, MapPinned } from 'lucide-react'
import type { RedePosto } from '@/pages/Rede/hooks/useRedePostos'
import { formatCnpj, enderecoLinha } from '@/pages/Rede/lib'

/** Modal centralizado com a ficha completa de um posto (dados empresariais +
 *  endereço). Fecha no backdrop, no X ou no Esc. */
const PostoDrawer = ({ posto, onClose }: { posto: RedePosto | null; onClose: () => void }) => {
  useEffect(() => {
    if (!posto) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [posto, onClose])

  if (!posto) return null

  const endereco = enderecoLinha(posto)
  const cidadeUf = [posto.cidade, posto.estado].filter(Boolean).join(' · ')
  const temCoord = Number.isFinite(posto.latitude) && Number.isFinite(posto.longitude) && (posto.latitude !== 0 || posto.longitude !== 0)
  const mapsQuery = temCoord
    ? `${posto.latitude},${posto.longitude}`
    : encodeURIComponent([endereco, posto.cidade, posto.estado].filter(Boolean).join(', '))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Ficha de ${posto.fantasia || posto.razao}`}>
      <button className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-label="Fechar" onClick={onClose} />
      <aside className="relative flex max-h-[85vh] w-full max-w-md animate-fade-in flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f0f0f]">
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-gray-200 p-4 dark:border-white/10">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1e3a5f] text-white">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">{posto.fantasia || posto.razao}</h2>
            {posto.fantasia && posto.razao && posto.fantasia !== posto.razao && (
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{posto.razao}</p>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-4">
          {/* Dados empresariais */}
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Dados empresariais</p>
            <Campo Icon={FileText} label="CNPJ" valor={formatCnpj(posto.cnpj)} />
            <Campo Icon={Building2} label="Razão social" valor={posto.razao} />
            <Campo Icon={Hash} label="Código do posto" valor={String(posto.codigo)} />
            {posto.sigla && <Campo Icon={Hash} label="Sigla" valor={posto.sigla} />}
          </section>

          {/* Endereço */}
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Endereço</p>
            <Campo Icon={MapPin} label="Logradouro" valor={endereco} />
            <Campo Icon={MapPin} label="Cidade / UF" valor={cidadeUf} />
            {posto.cep && <Campo Icon={MapPin} label="CEP" valor={posto.cep} />}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-[#1e3a5f] transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
            >
              <MapPinned className="h-4 w-4" /> Abrir no mapa
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>
          </section>
        </div>
      </aside>
    </div>
  )
}

const Campo = ({ Icon, label, valor }: { Icon: typeof MapPin; label: string; valor: string }) => (
  <div className="flex items-start gap-2">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="break-words text-sm text-gray-900 dark:text-gray-100">{valor || <span className="text-gray-400">—</span>}</p>
    </div>
  </div>
)

export default PostoDrawer
