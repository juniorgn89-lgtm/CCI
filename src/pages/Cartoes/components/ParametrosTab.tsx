import { useMemo, useState } from 'react'
import { MessageSquare, Phone, Link2, Copy, ExternalLink, Check, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCartoesParams, getPostoConfig, type PostoNotifConfig } from '@/pages/Cartoes/store'

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

interface ParametrosTabProps {
  postos: { codigo: number; nome: string }[]
  dia: string
  onOpenPosto: (codigo: number) => void
}

const ParametrosTab = ({ postos, dia, onOpenPosto }: ParametrosTabProps) => {
  const byPosto = useCartoesParams((s) => s.byPosto)
  const setConfig = useCartoesParams((s) => s.setConfig)

  // Rascunho por posto — só grava no store ao clicar "Salvar".
  const [draft, setDraft] = useState<Record<number, PostoNotifConfig>>(() => {
    const init: Record<number, PostoNotifConfig> = {}
    for (const p of postos) init[p.codigo] = getPostoConfig(byPosto, p.codigo)
    return init
  })
  const [savedFlash, setSavedFlash] = useState(false)

  const dirty = useMemo(
    () => postos.some((p) => {
      const a = draft[p.codigo] ?? getPostoConfig(byPosto, p.codigo)
      const b = getPostoConfig(byPosto, p.codigo)
      return a.enabled !== b.enabled || a.gerente !== b.gerente || a.whatsapp !== b.whatsapp
    }),
    [draft, byPosto, postos],
  )

  const patch = (codigo: number, p: Partial<PostoNotifConfig>) =>
    setDraft((d) => ({ ...d, [codigo]: { ...getPostoConfig(byPosto, codigo), ...d[codigo], ...p } }))

  const salvar = () => {
    for (const p of postos) {
      const cfg = draft[p.codigo] ?? getPostoConfig(byPosto, p.codigo)
      setConfig(p.codigo, cfg)
    }
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2000)
  }

  const [copiedCodigo, setCopiedCodigo] = useState<number | null>(null)
  const copyLink = (codigo: number, url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedCodigo(codigo)
      window.setTimeout(() => setCopiedCodigo(null), 1600)
    })
  }

  return (
    <div className="space-y-4">
      {/* Faixa — deixa CLARO que nada dispara nesta fase */}
      <div className="flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <MessageSquare className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notificação por posto</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
              Aqui você só <strong>salva a configuração</strong> de cada posto (gerente, WhatsApp, envio ligado/desligado). O <strong>envio pelo WhatsApp e o link do dia ainda NÃO disparam</strong> nesta fase — entra numa etapa posterior.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={salvar}
          disabled={!dirty && !savedFlash}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white transition-colors',
            savedFlash ? 'bg-emerald-600' : dirty ? 'bg-[#1e3a5f] hover:bg-[#162a44]' : 'cursor-not-allowed bg-gray-300 dark:bg-gray-700',
          )}
        >
          {savedFlash ? <><Check className="h-4 w-4" /> Salvo</> : 'Salvar'}
        </button>
      </div>

      {postos.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          Nenhum posto disponível para configurar.
        </p>
      )}

      {postos.map((p) => {
        const cfg = draft[p.codigo] ?? getPostoConfig(byPosto, p.codigo)
        const url = `https://visor360.com.br/c/${slug(p.nome)}/${dia}`
        return (
          <div key={p.codigo} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2563eb] dark:bg-blue-950/40">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">{p.nome}</span>
              </span>
              {/* Toggle Notificar por WhatsApp */}
              <label className="inline-flex cursor-pointer items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Notificar por WhatsApp</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={cfg.enabled}
                  onClick={() => patch(p.codigo, { enabled: !cfg.enabled })}
                  className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', cfg.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')}
                >
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', cfg.enabled ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Gerente responsável</label>
                <input
                  type="text"
                  value={cfg.gerente}
                  onChange={(e) => patch(p.codigo, { gerente: e.target.value })}
                  placeholder="Nome do gerente"
                  className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">WhatsApp do gerente</label>
                <div className="relative mt-1">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={cfg.whatsapp}
                    onChange={(e) => patch(p.codigo, { whatsapp: e.target.value })}
                    placeholder="+55 (00) 00000-0000"
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-900 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* Link do dia (prévia read-only) */}
            <div className="mt-4">
              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Link do dia <span className="text-gray-400">— prévia (somente leitura); o link real é gerado na fase de envio</span>
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={url}
                    readOnly
                    className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-[12px] text-gray-500 outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => copyLink(p.codigo, url)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {copiedCodigo === p.codigo ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCodigo === p.codigo ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPosto(p.codigo)}
                  title="Abrir o Resultado filtrado por este posto (no app)"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ParametrosTab
