import { useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import { nomeLegivel } from '@/lib/nomeLegivel'
import type { CaixaCacheRow, FormaPagamentoCacheRow } from '@/api/supabase/apuracao'
import { grupoDe, type GrupoRecebimento } from '@/components/briefing/useResumoOntem'

export type TipoDetalhe =
  | { tipo: 'abertos' }
  | { tipo: 'diferenca' }
  | { tipo: 'recebido'; grupo?: GrupoRecebimento }

const RECEB: Record<GrupoRecebimento, string> = { cartao: 'Cartões e PIX', dinheiro: 'Dinheiro', outros: 'Outros', prazo: 'A prazo' }
const CARD = 'rounded-2xl border border-[#2f3b4f] bg-[#1e293b]'
const sinal = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatCurrency(Math.abs(v))}`

interface Props {
  detalhe: TipoDetalhe
  caixas: CaixaCacheRow[]
  formas: FormaPagamentoCacheRow[]
  nomePosto: (c: number) => string
  onVoltar: () => void
}

/**
 * Detalhe dentro do Resumo de ontem: a lista EXATA do que o resumo contou
 * (mesmas linhas da apuração de ontem), para o clique cair naquela situação.
 */
const DetalheOntem = ({ detalhe, caixas, formas, nomePosto, onVoltar }: Props) => {
  const posto = (c: number) => nomeLegivel(nomePosto(c))

  const titulo = detalhe.tipo === 'abertos' ? 'Caixas de ontem ainda abertos'
    : detalhe.tipo === 'diferenca' ? 'Diferença de caixa de ontem'
    : detalhe.grupo ? `Recebido ontem · ${RECEB[detalhe.grupo]}` : 'Recebido ontem'

  const abertos = useMemo(() => caixas.filter((c) => !c.fechado).sort((a, b) => a.empresa_codigo - b.empresa_codigo || a.caixa_codigo - b.caixa_codigo), [caixas])
  const comDiferenca = useMemo(() => caixas.filter((c) => Math.abs(c.diferenca ?? 0) >= 0.01).sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca)), [caixas])
  const recebidoPorForma = useMemo(() => {
    const g = detalhe.tipo === 'recebido' ? detalhe.grupo : undefined
    const m = new Map<string, { nome: string; grupo: GrupoRecebimento; valor: number; porPosto: Map<number, number> }>()
    for (const f of formas) {
      const grupo = grupoDe(f.tipo_forma_pagamento ?? '', f.nome_forma_pagamento ?? '')
      if (g && grupo !== g) continue
      const nome = (f.nome_forma_pagamento || f.tipo_forma_pagamento || 'Outros').trim()
      const cur = m.get(nome) ?? { nome, grupo, valor: 0, porPosto: new Map<number, number>() }
      cur.valor += f.valor_pagamento
      cur.porPosto.set(f.empresa_codigo, (cur.porPosto.get(f.empresa_codigo) ?? 0) + f.valor_pagamento)
      m.set(nome, cur)
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor)
  }, [formas, detalhe])

  return (
    <div className="space-y-3">
      <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-[#5eead4] hover:bg-white/[0.05]">
        <ArrowLeft className="h-4 w-4" /> Voltar ao resumo
      </button>
      <section className={cn(CARD, 'overflow-hidden')}>
        <div className="border-b border-white/[0.06] px-4 py-3">
          <p className="text-[15px] font-semibold text-[#f1f5f9]">{titulo}</p>
          <p className="text-[12px] text-[#64748b]">Os mesmos registros que o resumo contou, da apuração de ontem.</p>
        </div>

        {detalhe.tipo === 'abertos' && (
          abertos.length === 0 ? <p className="p-4 text-[13px] text-[#94a3b8]">Nenhum caixa de ontem ficou aberto.</p> : (
            <ul className="divide-y divide-white/[0.05]">
              {abertos.map((c) => (
                <li key={`${c.empresa_codigo}-${c.caixa_codigo}-${c.turno_codigo}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[#f1f5f9]">{posto(c.empresa_codigo)}</p>
                    <p className="text-[12px] text-[#94a3b8]">Caixa <span className="font-mono">#{c.caixa_codigo}</span>{c.turno ? ` · ${c.turno}` : ''}{c.pdv_codigo != null ? ` · PDV ${c.pdv_codigo}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13.5px] font-semibold tabular-nums text-[#f1f5f9]">{formatCurrency(c.apurado ?? 0)}</p>
                    <p className="text-[11px] text-[#fda4af]">aberto</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {detalhe.tipo === 'diferenca' && (
          comDiferenca.length === 0 ? <p className="p-4 text-[13px] text-[#94a3b8]">Todos os caixas de ontem bateram.</p> : (
            <>
              <ul className="divide-y divide-white/[0.05]">
                {comDiferenca.map((c) => (
                  <li key={`${c.empresa_codigo}-${c.caixa_codigo}-${c.turno_codigo}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-[#f1f5f9]">{posto(c.empresa_codigo)}</p>
                      <p className="text-[12px] text-[#94a3b8]">Caixa <span className="font-mono">#{c.caixa_codigo}</span>{c.turno ? ` · ${c.turno}` : ''}{!c.fechado ? ' · ainda aberto' : ''}</p>
                    </div>
                    <p className={cn('text-[14px] font-bold tabular-nums', c.diferenca < 0 ? 'text-[#fda4af]' : 'text-[#5eead4]')}>{sinal(c.diferenca)}</p>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-white/[0.06] px-4 py-3 text-[13px]">
                <span className="text-[#94a3b8]">Somando {comDiferenca.length} {comDiferenca.length === 1 ? 'caixa' : 'caixas'}</span>
                {(() => { const t = comDiferenca.reduce((s, c) => s + c.diferenca, 0); return <span className={cn('font-bold tabular-nums', t < 0 ? 'text-[#fda4af]' : 'text-[#5eead4]')}>{sinal(t)}</span> })()}
              </div>
            </>
          )
        )}

        {detalhe.tipo === 'recebido' && (
          recebidoPorForma.length === 0 ? <p className="p-4 text-[13px] text-[#94a3b8]">Nada recebido nessa forma ontem.</p> : (
            <ul className="divide-y divide-white/[0.05]">
              {recebidoPorForma.map((f) => (
                <li key={f.nome} className="px-4 py-3">
                  <div className="flex items-baseline gap-2">
                    <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#f1f5f9]">{nomeLegivel(f.nome)}</p>
                    <p className="text-[14px] font-bold tabular-nums text-[#f1f5f9]">{formatCurrency(f.valor)}</p>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {[...f.porPosto.entries()].sort((a, b) => b[1] - a[1]).map(([cod, v]) => (
                      <p key={cod} className="flex justify-between text-[12px] text-[#94a3b8]"><span className="truncate">{posto(cod)}</span><span className="tabular-nums">{formatCurrency(v)}</span></p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  )
}

export default DetalheOntem
