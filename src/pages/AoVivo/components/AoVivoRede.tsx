import { useEffect, useRef, useState } from 'react'
import { Building2, Wallet, RefreshCw, Lock, CalendarDays, Trophy, TrendingDown } from 'lucide-react'
import useTurnosAoVivo, { type DiaSemana, type EmpresaAoVivo, type PostoDia, type PrevisaoDia } from '@/pages/AoVivo/hooks/useTurnosAoVivo'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import useIsMobile from '@/hooks/useIsMobile'

/** Contador "atualiza em 0:SS · última HH:MM:SS" — sincronizado ao último fetch. */
const ContadorAoVivo = ({ dataUpdatedAt }: { dataUpdatedAt: number }) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const segDecorridos = dataUpdatedAt ? Math.floor((now - dataUpdatedAt) / 1000) : 0
  const segRestantes = dataUpdatedAt ? Math.max(0, 60 - segDecorridos) : 60
  const ultima = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700 dark:border-green-800/40 dark:bg-green-900/20 dark:text-green-300"
      title="Os dados ao vivo se atualizam sozinhos a cada 60 segundos."
    >
      <RefreshCw className={`h-3 w-3 ${segRestantes <= 1 ? 'animate-spin' : ''}`} />
      Atualiza em 0:{String(segRestantes).padStart(2, '0')}
      <span className="text-green-600/60 dark:text-green-400/50">·</span>
      <span className="tabular-nums text-green-700/80 dark:text-green-300/80">última {ultima}</span>
    </span>
  )
}

const formatHora = (iso: string): string => {
  if (!iso) return '-'
  if (iso.includes('T')) return iso.split('T')[1]?.substring(0, 5) ?? '-'
  if (iso.includes(' ')) return iso.split(' ')[1]?.substring(0, 5) ?? '-'
  return iso.substring(0, 5)
}

const Pulso = ({ className }: { className?: string }) => (
  <span className={cn('relative flex h-1.5 w-1.5', className)}>
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
  </span>
)

/** Card compacto de um posto HOJE (ao vivo). */
const CardPostoVivo = ({ emp }: { emp: EmpresaAoVivo }) => (
  <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-2.5 text-left shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
    <div className="flex items-start justify-between gap-1.5">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-bold text-gray-900 dark:text-gray-100" title={emp.empresaNome}>{emp.empresaNome}</p>
        <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{emp.caixas.length} {emp.caixas.length === 1 ? 'caixa aberto' : 'caixas abertos'}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-green-700 dark:bg-green-900/30 dark:text-green-400"><Pulso /> Vivo</span>
    </div>
    {emp.apuradoParcial > 0 && (
      <p className="mt-1.5 flex items-center gap-1.5" title="Faturamento fiscal total de hoje (todos os setores) deste posto">
        <Wallet className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="text-[15px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(emp.apuradoParcial)}</span>
        <span className="text-[9px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">parcial</span>
      </p>
    )}
    <div className="mt-2 flex flex-col gap-0.5 border-t border-gray-100 pt-1.5 text-[10px] dark:border-gray-800">
      {emp.caixas.map((c) => (
        <span key={`${c.empresaCodigo}-${c.caixaCodigo}`} className="flex items-center gap-1" title={`${c.turno} · ${formatHora(c.abertura)} · ${c.responsavelNome}`}>
          <span className="shrink-0 rounded bg-gray-100 px-1 py-px font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">{c.turno}</span>
          <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">{formatHora(c.abertura)}</span>
          <span className="truncate text-gray-700 dark:text-gray-300">{c.responsavelNome}</span>
        </span>
      ))}
    </div>
  </div>
)

/** Card compacto de um posto num dia ENCERRADO (apagado). */
const CardPostoEncerrado = ({ p }: { p: PostoDia }) => (
  <div className="flex flex-col rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-left opacity-75 grayscale dark:border-gray-800 dark:bg-gray-900/60">
    <div className="flex items-start justify-between gap-1.5">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-bold text-gray-600 dark:text-gray-300" title={p.empresaNome}>{p.empresaNome}</p>
        <p className="text-[10px] uppercase tracking-wide text-gray-400">{p.caixas.length} {p.caixas.length === 1 ? 'turno' : 'turnos'}</p>
      </div>
      <Lock className="h-3 w-3 shrink-0 text-gray-400" />
    </div>
    <p className="mt-1.5 flex items-center gap-1.5">
      <Wallet className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span className="text-[15px] font-bold tabular-nums text-gray-600 dark:text-gray-300">{formatCurrency(p.faturamento)}</span>
    </p>
    <div className="mt-2 flex flex-col gap-0.5 border-t border-gray-200 pt-1.5 text-[10px] dark:border-gray-800">
      {p.caixas.length === 0 && <span className="text-gray-400">sem turnos registrados</span>}
      {p.caixas.map((c) => (
        <span key={c.caixaCodigo} className="flex items-center gap-1" title={`${c.turno} · ${formatHora(c.abertura)}–${formatHora(c.fechamento)} · ${c.responsavelNome}${c.diferenca ? ` · diferença ${formatCurrency(c.diferenca)}` : ''}`}>
          <span className="shrink-0 rounded bg-gray-200 px-1 py-px font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">{c.turno}</span>
          <span className="shrink-0 tabular-nums text-gray-400">{formatHora(c.abertura)}–{c.fechado ? formatHora(c.fechamento) : 'aberto'}</span>
          <span className="truncate text-gray-500 dark:text-gray-400">{c.responsavelNome}</span>
        </span>
      ))}
    </div>
  </div>
)

/** Melhor e pior dia da semana: só entre os dias ENCERRADOS com venda (hoje é
 *  parcial e não entra, senão seria sempre o "pior"). Precisa de 2+ dias. */
const extremosSemana = (semana: DiaSemana[]) => {
  const fechados = semana.filter((d) => d.estado === 'passado' && d.faturamento > 0)
  if (fechados.length < 2) return { melhor: null, pior: null }
  const ord = [...fechados].sort((a, b) => b.faturamento - a.faturamento)
  return { melhor: ord[0].dia, pior: ord[ord.length - 1].dia }
}

type Destaque = 'melhor' | 'pior' | null

const NOME_DIA: Record<string, string> = { Dom: 'domingo', Seg: 'segunda', Ter: 'terça', Qua: 'quarta', Qui: 'quinta', Sex: 'sexta', 'Sáb': 'sábado' }

/** Previsão do dia corrente: a mesma projeção sazonal da Central (índice do dia
 *  da semana em 6 meses × ritmo do mês), com barra de quanto já entrou. */
const PrevisaoHoje = ({ parcial, previsao, rotulo }: { parcial: number; previsao: PrevisaoDia; rotulo: string }) => {
  const pct = previsao.valor > 0 ? (parcial / previsao.valor) * 100 : 0
  const dia = NOME_DIA[rotulo] ?? 'hoje'
  const pctIdx = Math.round((previsao.indice - 1) * 100)
  const peso = previsao.linear
    ? 'sem peso por dia da semana (menos de 90 dias de histórico)'
    : `${dia} costuma vender ${pctIdx === 0 ? 'igual à média' : `${Math.abs(pctIdx)}% ${pctIdx > 0 ? 'acima' : 'abaixo'} da média`} (últimos 6 meses)`
  const ritmo = previsao.origem === 'mes'
    ? `ritmo dos ${previsao.diasBase} dias fechados do mês`
    : 'ritmo dos últimos 7 dias fechados (o mês acabou de começar)'
  return (
    <div
      className="mt-2 border-t border-green-200/70 pt-1.5 dark:border-green-800/40"
      title={`Mesma projeção sazonal da Central: dia médio no ${ritmo} (${formatCurrencyInt(previsao.ritmo)}) × peso do ${dia}: ${peso}. É uma estimativa; feriado e promoção mudam o dia.`}
    >
      <div className="flex items-baseline justify-between gap-1 text-[10px]">
        <span className="font-semibold uppercase tracking-wide text-green-700/80 dark:text-green-300/80">Previsão</span>
        <span className="font-bold tabular-nums text-gray-700 dark:text-gray-200">~{formatCurrencyInt(previsao.valor)}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-green-100 dark:bg-green-950/60">
        <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-0.5 text-[9.5px] text-gray-500 dark:text-gray-400">
        {pct >= 100 ? 'passou da previsão' : `${Math.round(pct)}% do previsto`} · {previsao.linear ? 'projeção linear' : 'projeção sazonal'}
      </p>
    </div>
  )
}

/** Dia encerrado: quanto fechou contra a previsão que a tela mostrava naquele dia. */
const PrevisaoFechado = ({ fechou, previsao, rotulo }: { fechou: number; previsao: PrevisaoDia; rotulo: string }) => {
  if (previsao.valor <= 0) return null
  const pct = (fechou / previsao.valor) * 100
  const dif = fechou - previsao.valor
  const acima = dif >= 0
  const dia = rotulo.toLowerCase()
  return (
    <div className="mt-2 border-t border-gray-200 pt-1.5 dark:border-gray-800"
      title={`Previsão que a tela mostrava na manhã de ${dia}: ritmo dos ${previsao.diasBase} dias fechados até a véspera (${formatCurrencyInt(previsao.ritmo)} por dia médio) × peso do ${dia}. É uma estimativa; feriado e promoção mudam o dia.`}>
      <div className="flex items-center justify-between gap-1 text-[10px]">
        <span className="font-semibold uppercase tracking-wide text-gray-400">Previsão</span>
        <span className="font-semibold tabular-nums text-gray-500 dark:text-gray-400">~{formatCurrencyInt(previsao.valor)}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div className={cn('h-full rounded-full', acima ? 'bg-emerald-500/70' : 'bg-amber-500/80')} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className={cn('mt-0.5 text-[9.5px] font-semibold', acima ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
        {Math.abs(pct - 100) < 1 ? 'fechou no previsto' : acima ? `fechou ${formatCurrencyInt(dif)} acima (${Math.round(pct)}%)` : `faltaram ${formatCurrencyInt(-dif)} (${Math.round(pct)}%)`}
      </p>
    </div>
  )
}

/** Cabeçalho da coluna do dia: data, total, turnos. Verde e pulsando hoje; cinza nos encerrados. */
const CabecalhoDia = ({ d, destaque = null }: { d: DiaSemana; destaque?: Destaque }) => {
  const [, m, dd] = d.dia.split('-')
  return (
    <div
      className={cn(
        'flex min-h-[84px] flex-col rounded-xl border p-3',
        d.estado === 'hoje' && 'border-green-400 bg-green-50/70 ring-2 ring-green-400/60 dark:border-green-600 dark:bg-green-950/30 dark:ring-green-500/40',
        d.estado === 'passado' && 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400',
        d.estado === 'futuro' && 'border-dashed border-gray-200 bg-transparent text-gray-300 dark:border-gray-800 dark:text-gray-600',
      )}
      title={d.estado === 'futuro' ? 'Ainda não chegou' : d.estado === 'hoje' ? 'Hoje, ao vivo' : 'Dia encerrado'}
    >
      <span className="flex items-center justify-between gap-1">
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', d.estado === 'hoje' && 'text-green-700 dark:text-green-300')}>{d.rotulo} <span className="tabular-nums">{dd}/{m}</span></span>
        {d.estado === 'hoje' && <Pulso className="h-2 w-2" />}
        {d.estado === 'passado' && (
          destaque === 'melhor' ? (
            <span className="-my-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" title="Melhor dia da semana (entre os dias já encerrados)">
              <Trophy className="h-3 w-3" /> Melhor
            </span>
          ) : destaque === 'pior' ? (
            <span className="-my-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-500/15 dark:text-red-300" title="Pior dia da semana (entre os dias já encerrados)">
              <TrendingDown className="h-3 w-3" /> Pior
            </span>
          ) : (
            <Lock className="h-3 w-3 opacity-60" />
          )
        )}
      </span>
      {d.estado === 'futuro' ? (
        <span className="mt-2 text-lg font-bold">—</span>
      ) : (
        <>
          <span className={cn('mt-1.5 text-[17px] font-extrabold tabular-nums leading-tight', d.estado === 'hoje' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400')}>
            {formatCurrencyInt(d.faturamento)}
          </span>
          <span className="mt-0.5 text-[10px]">
            {d.estado === 'hoje'
              ? `${d.turnos} ${d.turnos === 1 ? 'caixa aberto' : 'caixas abertos'} · parcial`
              : `${d.turnos} ${d.turnos === 1 ? 'turno' : 'turnos'} · ${d.postos} ${d.postos === 1 ? 'posto' : 'postos'} · encerrado`}
          </span>
          {d.estado === 'hoje' && d.previsao && <PrevisaoHoje parcial={d.faturamento} previsao={d.previsao} rotulo={d.rotulo} />}
          {d.estado === 'passado' && d.previsao && d.faturamento > 0 && <PrevisaoFechado fechou={d.faturamento} previsao={d.previsao} rotulo={d.rotulo} />}
        </>
      )}
    </div>
  )
}

/** Conteúdo de um dia: cards ao vivo (hoje) ou encerrados (passado). */
const ConteudoDia = ({ d, empresas }: { d: DiaSemana; empresas: EmpresaAoVivo[] }) => (
  <>
    {d.estado === 'hoje' && (
      empresas.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-4 text-center dark:border-gray-700">
          <Building2 className="mx-auto h-5 w-5 text-gray-400" />
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">Nenhum caixa aberto agora</p>
        </div>
      ) : (
        empresas.map((emp) => <CardPostoVivo key={emp.empresaCodigo} emp={emp} />)
      )
    )}
    {d.estado === 'passado' && (
      d.porPosto.length === 0
        ? <p className="px-1 text-[10px] text-gray-400">sem turnos nem vendas</p>
        : d.porPosto.map((p) => <CardPostoEncerrado key={p.empresaCodigo} p={p} />)
    )}
    {d.estado === 'futuro' && <p className="px-1 text-[10px] text-gray-400">ainda não chegou</p>}
  </>
)

/**
 * Ao vivo na rede, em colunas: uma coluna por dia da semana (segunda a
 * domingo). Dias encerrados ficam em cinza com os cards dos postos daquele
 * dia; hoje fica verde, pulsando, com os postos ao vivo; os próximos dias
 * ficam vazios.
 */
const AoVivoRede = () => {
  const { empresas, totalAoVivo, totalEmpresas, empresasComAoVivo, isLoading, dataUpdatedAt, semana } = useTurnosAoVivo()
  // Celular: sem espaço pra 7 colunas → fita de dias (rolável) + o dia escolhido embaixo (hoje por padrão).
  const isMobile = useIsMobile()
  const [diaSel, setDiaSel] = useState<string | null>(null)
  const hojeDia = semana.find((d) => d.estado === 'hoje')?.dia ?? null
  const diaAtivo = semana.find((d) => d.dia === (diaSel ?? hojeDia)) ?? null
  const extremos = extremosSemana(semana)
  const destaqueDe = (d: DiaSemana): Destaque => (d.dia === extremos.melhor ? 'melhor' : d.dia === extremos.pior ? 'pior' : null)
  // Fita do celular: rola até HOJE uma vez, assim que o chip existe.
  const fitaRolada = useRef(false)
  const rolarAteHoje = (el: HTMLButtonElement | null) => {
    if (!el || fitaRolada.current) return
    fitaRolada.current = true
    el.scrollIntoView({ inline: 'center', block: 'nearest' })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
            Ao vivo na rede
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {isLoading ? (
              'Carregando turnos da rede...'
            ) : totalAoVivo > 0 ? (
              <>
                {totalAoVivo} {totalAoVivo === 1 ? 'caixa aberto' : 'caixas abertos'} em{' '}
                {empresasComAoVivo} {empresasComAoVivo === 1 ? 'posto' : 'postos'} agora
              </>
            ) : (
              'Nenhum turno aberto na rede neste momento'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ContadorAoVivo dataUpdatedAt={dataUpdatedAt} />
          {totalEmpresas > 0 && (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              {totalEmpresas} {totalEmpresas === 1 ? 'posto na rede' : 'postos na rede'}
            </span>
          )}
        </div>
      </div>

      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <CalendarDays className="h-3.5 w-3.5" /> Semana
        <InfoHint text="Uma coluna por dia, de segunda a domingo. Dias já encerrados ficam em cinza, com o faturamento fiscal do dia e os turnos de cada posto; hoje fica verde e atualiza sozinho a cada minuto; os próximos dias ficam vazios. O troféu marca o melhor dia e a seta para baixo o pior, comparando só os dias já encerrados (hoje ainda está em andamento e não entra). Nos dias encerrados aparece a previsão que a tela mostrava naquele dia (com os dias fechados até a véspera) e quanto o dia fechou acima ou abaixo dela. Em hoje, a Previsão usa a mesma projeção sazonal da Central: o ritmo do mês ajustado pelo peso do dia da semana nos últimos 6 meses (com menos de 90 dias de histórico vira linear). A barra mostra quanto já entrou; é estimativa e não considera feriado nem promoção." />
      </p>

      {/* Loading inicial (ainda nem retornou empresas) */}
      {isLoading && totalEmpresas === 0 ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[84px] animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50" />
          ))}
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {semana.map((d) => {
              const ativo = diaAtivo?.dia === d.dia
              return (
                <button
                  key={d.dia}
                  ref={d.estado === 'hoje' ? rolarAteHoje : undefined}
                  type="button"
                  disabled={d.estado === 'futuro'}
                  onClick={() => setDiaSel(d.dia)}
                  className={cn('w-[150px] shrink-0 rounded-xl text-left transition-opacity disabled:cursor-default', ativo ? 'ring-2 ring-offset-2 ring-[#1e3a5f] ring-offset-white dark:ring-blue-400 dark:ring-offset-black' : 'opacity-80')}
                >
                  <CabecalhoDia d={d} destaque={destaqueDe(d)} />
                </button>
              )
            })}
          </div>
          {diaAtivo && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {diaAtivo.rotulo} {diaAtivo.dia.split('-').reverse().slice(0, 2).join('/')} · {diaAtivo.estado === 'hoje' ? 'ao vivo' : diaAtivo.estado === 'passado' ? 'encerrado' : 'ainda não chegou'}
              </p>
              <ConteudoDia d={diaAtivo} empresas={empresas} />
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[1100px] grid-cols-7 gap-2">
            {/* Linha 1 = cabeçalhos (mesma altura, mesmo com a previsão em hoje); linha 2 = postos. */}
            {semana.map((d) => <CabecalhoDia key={`c-${d.dia}`} d={d} destaque={destaqueDe(d)} />)}
            {semana.map((d) => (
              <div key={d.dia} className="flex flex-col gap-2">
                <ConteudoDia d={d} empresas={empresas} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AoVivoRede
