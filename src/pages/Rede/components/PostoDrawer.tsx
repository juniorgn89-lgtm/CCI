import { useEffect } from 'react'
import {
  X, Building2, FileText, MapPin, Hash, Trophy, ExternalLink, CalendarClock, MapPinned,
} from 'lucide-react'
import type { RedePosto } from '@/pages/Rede/hooks/useRedePostos'
import { formatCnpj, prospeccaoStatusLabel, prospeccaoStatusTone, enderecoLinha } from '@/pages/Rede/lib'

const fmtData = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
}

/** Modal centralizado com a ficha completa de um posto (dados empresariais +
 *  endereço + vínculo de prospecção). Fecha no backdrop, no X ou no Esc. */
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
  const pros = posto.prospeccao

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
          {/* Vínculo de prospecção — destaque no topo */}
          {pros ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Trophy className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Conquistado por</span>
              </div>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{pros.vendedor || '—'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${prospeccaoStatusTone(pros.status)}`}>
                  {prospeccaoStatusLabel(pros.status)}
                </span>
                {pros.atualizadoEm && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <CalendarClock className="h-3 w-3" /> {fmtData(pros.atualizadoEm)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-3 text-center text-xs text-gray-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-gray-400">
              Sem vínculo de prospecção — este posto não veio (ou não foi casado por CNPJ) do Prospecção360.
            </div>
          )}

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
