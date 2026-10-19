import { Database, Truck, LineChart, Briefcase, MessageCircle, Check, type LucideIcon } from 'lucide-react'
import { FONTE_TITULO } from '@/pages/Diagnostico/lib/marca'
import type { Recomendacao, ServicoId } from '@/pages/Diagnostico/lib/recomendacoes'
import { IconeOuro, SecaoTitulo, Sobrelinha } from '@/pages/Diagnostico/components/Marca'

/** WhatsApp COMERCIAL da CCI (venda de serviço; dúvidas do diagnóstico vão para os consultores). */
const CCI_COMERCIAL = '5527992725459'
const ICONE: Record<ServicoId, LucideIcon> = { 'bpo-financeiro': Database, fleetpass: Truck, relatorios: LineChart, consultoria: Briefcase }

const link = (servico: string, posto: string) =>
  `https://wa.me/${CCI_COMERCIAL}?text=${encodeURIComponent(`Olá! Vi no Diagnóstico do ${posto} a recomendação de ${servico} e quero saber mais.`)}`

/**
 * O que a CCI recomenda para este posto/rede: só serviços que o próprio
 * diagnóstico justifica, cada um com a prova (números daqui) e o contato.
 * Sem preço — consultoria e BPO variam por porte.
 */
const Recomendacoes = ({ recs, n, posto, sujeito }: { recs: Recomendacao[]; n: number; posto: string; sujeito: 'posto' | 'rede' }) => (
  <section>
    <SecaoTitulo n={n} sobre="O que a CCI recomenda" titulo={recs.length === 1 ? `Um serviço que faz sentido para ${sujeito === 'rede' ? 'a rede' : 'o posto'}` : `${recs.length} serviços que fazem sentido para ${sujeito === 'rede' ? 'a rede' : 'o posto'}`}
      sub="Cada recomendação sai de um número deste diagnóstico. Nada genérico: se o sinal não aparece, o serviço não aparece." />
    <div className={recs.length >= 3 ? 'grid gap-4 lg:grid-cols-3' : 'grid gap-4 lg:grid-cols-2'}>
      {recs.map((r) => {
        const Icone = ICONE[r.id]
        return (
          <article key={r.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#0F766E]/15 bg-white shadow-[0_10px_30px_rgba(11,74,68,.08)] dark:border-white/10 dark:bg-[#0b2e2b]">
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#0F766E] to-[#0B4F4A] px-5 py-4 text-white">
              <IconeOuro><Icone className="h-5 w-5" /></IconeOuro>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#FCB619]">Serviço CCI</p>
                <p className="text-[19px] font-extrabold leading-tight" style={{ fontFamily: FONTE_TITULO }}>{r.nome}</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <p className="text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-200">{r.resumo}</p>
              {r.contratado && (
                <p className="rounded-lg bg-[#0F766E]/[0.07] px-3 py-2 text-[12.5px] text-[#0B4A44] dark:bg-teal-400/10 dark:text-teal-200">
                  <b className="font-semibold">Já contratado em {r.contratado.em.length} de {r.contratado.total} postos</b> ({r.contratado.em.join(', ')}). A recomendação vale para os demais.
                </p>
              )}
              <div className="rounded-xl border-l-4 border-[#FCB619] bg-[#FFF8E6] px-3.5 py-2.5 dark:bg-[#2a2410]">
                <Sobrelinha className="text-[#8a5a00] dark:text-[#FCD35E]">Por que recomendamos</Sobrelinha>
                <ul className="mt-1.5 space-y-1.5">
                  {r.porque.map((t) => <li key={t} className="text-[13px] leading-relaxed text-[#0B4A44] dark:text-white">{t}</li>)}
                </ul>
              </div>
              <ul className="space-y-1">
                {r.incluso.map((t) => <li key={t} className="flex gap-2 text-[12.5px] text-gray-600 dark:text-gray-300"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F766E] dark:text-teal-300" />{t}</li>)}
              </ul>
              <a href={link(r.nome, posto)} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#FCB619] px-4 py-2.5 text-[14px] font-extrabold text-[#0B4A44] shadow-[0_8px_20px_rgba(252,182,25,.3)] transition-transform hover:-translate-y-0.5" style={{ fontFamily: FONTE_TITULO }}>
                <MessageCircle className="h-4 w-4" /> Quero saber mais
              </a>
            </div>
          </article>
        )
      })}
    </div>
  </section>
)

export default Recomendacoes
