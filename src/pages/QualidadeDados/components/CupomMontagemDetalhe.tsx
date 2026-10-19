import { useState } from 'react'
import { Check, Copy, Minus, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { fpgCategoria, MONTAGEM, type CupomMultiAbast } from '@/pages/QualidadeDados/hooks/useQualidadeDados'
import { nivelCupom } from '@/pages/QualidadeDados/lib/cupomNivel'

/**
 * Corpo do modal de um cupom com vários abastecimentos ("montagem"). Lê de
 * cima pra baixo como um relatório: o veredito numa frase, os quatro sinais
 * (acesos ou não, com o dado que sustenta cada um), a linha do tempo dos
 * abastecimentos, o fechamento do cupom e o que fazer. Sem emoji, sem caixa
 * vermelha: a cor fica no selo e nos sinais acesos.
 */

const minutosTxt = (min: number) => {
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}
const horaDe = (iso: string | null) => (iso ? (iso.includes('T') ? iso.split('T')[1]?.slice(0, 5) : iso.slice(11, 16)) ?? null : null)
const listar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)
const bonito = (s: string) => { const t = s.trim().replace(/\.+$/, '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1) }
const nomeProprio = (s: string) => s.trim().toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())


const Rotulo = ({ children }: { children: React.ReactNode }) => (
  <p className="border-b border-gray-200 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-gray-700 dark:border-gray-700 dark:text-gray-200">{children}</p>
)

const CupomMontagemDetalhe = ({ c }: { c: CupomMultiAbast }) => {
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(String(c.vendaCodigo)).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500) }, () => {})
  }

  const combustiveis = [...new Set(c.abastecimentos.map((a) => bonito(a.tipoCombustivel || a.produtoNome)))]
  const porCategoria = new Map<string, number>()
  for (const f of c.formasPagamento) { const k = fpgCategoria(f.tipo, f.nome); porCategoria.set(k, (porCategoria.get(k) ?? 0) + f.valor) }
  const pagoTotal = [...porCategoria.values()].reduce((s, v) => s + v, 0)
  const naoDinheiro = pagoTotal - c.dinheiro
  const pctDinheiro = c.totalVenda > 0 ? (c.dinheiro / c.totalVenda) * 100 : 0
  const nivel = nivelCupom(c.riscoScore)

  // Veredito numa frase.
  const n = c.abastecimentos.length
  const partes: string[] = [`${n} abastecimentos${c.mixCombustiveis ? ` de ${combustiveis.length} combustíveis (${listar(combustiveis.map((x) => x.toLowerCase()))})` : ' do mesmo combustível'}`]
  if (c.spreadMin != null) partes.push(c.espalhado ? `espalhados por ${minutosTxt(c.spreadMin)}` : `em ${minutosTxt(c.spreadMin)}`)
  const pagamento = c.formasPagamento.length === 0 ? 'sem forma de pagamento registrada' : c.mixPagamentos ? `pagos parte em dinheiro (${formatCurrency(c.dinheiro)}) e parte ${listar([...porCategoria.keys()].filter((k) => k !== 'Dinheiro').map((k) => `em ${k.toLowerCase()}`))}` : c.dinheiro > 0 && naoDinheiro > 0 ? `pagos quase todo ${listar([...porCategoria.keys()].filter((k) => k !== 'Dinheiro').map((k) => `em ${k.toLowerCase()}`))}, com ${formatCurrency(c.dinheiro)} em dinheiro` : c.dinheiro > 0 ? 'pagos em dinheiro' : `pagos ${listar([...porCategoria.keys()].map((k) => `em ${k.toLowerCase()}`))}`
  const veredito = `${partes.join(', ')}, ${pagamento}, num cupom só.`

  const sinais: { nome: string; ativo: boolean; dado: string; indica: string }[] = [
    { nome: 'Vários abastecimentos', ativo: true, dado: `${n} itens`, indica: 'Cliente comum abastece uma vez por cupom. Vários itens é o primeiro traço de montagem.' },
    { nome: 'Combustíveis diferentes', ativo: c.mixCombustiveis, dado: c.mixCombustiveis ? listar(combustiveis) : combustiveis[0] ?? '—', indica: c.mixCombustiveis
      ? (combustiveis.some((x) => /diesel/i.test(x)) ? 'Um veículo não leva diesel e gasolina ou etanol. Dois combustíveis assim no mesmo cupom são abastecimentos de clientes diferentes.' : 'Etanol e gasolina no mesmo cupom pode ser um carro flex, mas dois abastecimentos separados é raro: o mais comum é serem clientes diferentes.')
      : 'Mesmo combustível em todos os itens: pode ser frota ou caminhão com dois tanques.' },
    { nome: 'Horários espalhados', ativo: c.espalhado, dado: c.spreadMin == null ? 'sem hora na bomba' : minutosTxt(c.spreadMin), indica: c.espalhado ? `Mais de ${MONTAGEM.espalhadoMin} min entre o primeiro e o último: os itens foram juntados depois, não abastecidos juntos.` : c.spreadMin == null ? 'Sem a hora real da bomba não dá para medir o intervalo.' : 'Intervalo curto: compatível com um cliente abastecendo de uma vez.' },
    { nome: 'Pagamento misto', ativo: c.mixPagamentos, dado: c.formasPagamento.length === 0 ? 'sem registro' : [...porCategoria.entries()].map(([k, v]) => `${k} ${formatCurrency(v)}`).join(' · '), indica: c.mixPagamentos ? 'Parte em dinheiro e parte rastreável: é a parte em dinheiro que pode não entrar no caixa.' : c.dinheiro > 0 && !c.mixPagamentos && naoDinheiro > 0 ? `Dinheiro de ${formatCurrency(c.dinheiro)} (${pctDinheiro.toFixed(1).replace('.', ',')}% do cupom) é troco, não mistura: só conta acima de ${formatCurrency(MONTAGEM.dinheiroMinimo)} e de ${MONTAGEM.dinheiroMinimoPct}%.` : 'Uma forma de pagamento só.' },
  ]

  // Linha do tempo com o intervalo entre itens.
  const comHora = c.abastecimentos.map((a) => ({ a, ms: a.dataHoraAbastecimento ? new Date(a.dataHoraAbastecimento).getTime() : NaN }))

  return (
    <div className="space-y-4 text-[12.5px] text-gray-800 dark:text-gray-200">
      {/* Veredito */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-gray-900 dark:text-white">{veredito}</p>
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold', nivel.cls)}><span className={cn('h-2 w-2 rounded-full', nivel.dot)} />{nivel.label} · {c.nSinais} de 4 sinais</span>
      </div>

      {/* Sinais */}
      <section>
        <Rotulo>Por que está aqui</Rotulo>
        <ul className="mt-2 space-y-2">
          {sinais.map((s) => (
            <li key={s.nome} className="flex gap-2.5">
              <span className={cn('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full', s.ativo ? cn('text-white', nivel.dot) : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400')}>
                {s.ativo ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className={cn('font-semibold', s.ativo ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400')}>{s.nome}</span>
                  <span className={cn('text-[12px] tabular-nums', s.ativo ? cn('font-semibold', nivel.cls) : 'text-gray-500')}>{s.dado}</span>
                </p>
                <p className="text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">{s.indica}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Linha do tempo */}
      <section>
        <Rotulo>Linha do tempo dos abastecimentos</Rotulo>
        <ol className="mt-2">
          {comHora.map(({ a, ms }, i) => {
            const ant = i > 0 ? comHora[i - 1].ms : NaN
            const gap = !Number.isNaN(ms) && !Number.isNaN(ant) ? (ms - ant) / 60000 : null
            return (
              <li key={i}>
                {gap != null && (
                  <p className={cn('ml-[9px] border-l-2 border-dashed py-1 pl-4 text-[11px]', gap > MONTAGEM.espalhadoMin ? cn('border-current', nivel.cls) : 'border-gray-200 text-gray-400 dark:border-gray-700')}>+{minutosTxt(gap)} depois</p>
                )}
                <div className="flex items-center gap-3">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#1e3a5f] text-[10px] font-semibold text-white dark:bg-blue-700">{i + 1}</span>
                  <span className="w-12 shrink-0 font-mono text-[12px] tabular-nums text-gray-700 dark:text-gray-300">{horaDe(a.dataHoraAbastecimento) ?? '—:—'}</span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{bonito(a.produtoNome)}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{a.bombaDescricao} · {formatNumber(a.quantidade)} L × {formatCurrency(a.precoVenda)}</p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-white">{formatCurrency(a.totalVenda)}</span>
                </div>
              </li>
            )
          })}
        </ol>
        {c.spreadMin != null && <p className="mt-2 text-[11.5px] text-gray-500 dark:text-gray-400">Do primeiro ao último: <b className={cn('font-semibold', c.espalhado ? nivel.cls : 'text-gray-700 dark:text-gray-200')}>{minutosTxt(c.spreadMin)}</b>.</p>}
      </section>

      {/* Fechamento do cupom */}
      <section>
        <Rotulo>Fechamento do cupom</Rotulo>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            { label: 'Abastecido', valor: c.totalVenda, destaque: false },
            { label: naoDinheiro > 0 ? listar([...porCategoria.keys()].filter((k) => k !== 'Dinheiro')) : 'Rastreável', valor: naoDinheiro, destaque: false },
            { label: 'Dinheiro', valor: c.dinheiro, destaque: c.dinheiro > 0 },
          ].map((t) => (
            <div key={t.label} className={cn('rounded-lg border px-3 py-2', t.destaque ? 'border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700')}>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-500" title={t.label}>{t.label}</p>
              <p className={cn('mt-0.5 text-[15px] font-bold tabular-nums', t.destaque ? nivel.cls : 'text-gray-900 dark:text-white')}>{formatCurrency(t.valor)}</p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11.5px] text-gray-500 dark:text-gray-400">
          {c.formasPagamento.length === 0
            ? 'Sem forma de pagamento registrada neste cupom: não dá para saber quanto entrou em dinheiro.'
            : c.dinheiro > 0
              ? `Dinheiro é ${pctDinheiro.toFixed(1).replace('.', ',')}% do cupom. É a parte que não passa pela maquininha, então é a que se confere no caixa.`
              : 'Nada em dinheiro: tudo passou por meio rastreável.'}
          {Math.abs(pagoTotal - c.totalVenda) > 0.05 && pagoTotal > 0 ? ` Pago (${formatCurrency(pagoTotal)}) difere do abastecido (${formatCurrency(c.totalVenda)}).` : ''}
        </p>
      </section>

      {/* O que fazer */}
      <section>
        <Rotulo>O que fazer</Rotulo>
        <ol className="mt-2 space-y-2">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">1</span>
            <div className="min-w-0 flex-1">
              <p>Abrir o cupom no Quality: <b className="font-semibold">Vendas</b> e buscar pelo código.</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[13px] font-bold tabular-nums text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">{c.vendaCodigo}</span>
                <button type="button" onClick={copiar} className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors', copiado ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200')}>
                  {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copiado ? 'Copiado' : 'Copiar código'}
                </button>
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><ExternalLink className="h-3 w-3" /> Quality › Vendas</span>
              </div>
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">2</span>
            <p>Conferir o cupom físico e o fechamento do turno de <b className="font-semibold">{nomeProprio(c.funcionarioNome)}</b>: o dinheiro do cupom entrou no caixa?</p>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">3</span>
            <p>Perguntar ao frentista por que os abastecimentos foram juntados. Frota, caminhão com dois tanques ou cliente que voltou são respostas possíveis; sem explicação, é caso para a gerência.</p>
          </li>
        </ol>
      </section>
    </div>
  )
}

export default CupomMontagemDetalhe
