import { todayLocal } from '@/lib/period'

/** Linha do dia a dia de um cartão (a mesma da Central): realizado + projeção sazonal dos dias que faltam. */
export interface SerieRitmo {
  diario: number[]
  projecao: number[] | null
  diasNoMes: number
  cor: string
}

/** Cores dos setores (iguais às dos cartões da Central). */
export const COR_SETOR = { combustivel: '#5b7fb4', automotivos: '#c79a4a', conveniencia: '#4f9d84' } as const

/**
 * Monta a série do cartão a partir do valor diário. Só faz sentido com um mês
 * só no filtro (senão devolve null e o cartão fica sem a linha).
 *
 * Mês corrente: a linha cheia vai até ONTEM (hoje está pela metade) e os dias
 * que faltam são projetados pelo ritmo de cada dia da semana — ritmo =
 * realizado ÷ soma dos índices dos dias fechados; dia futuro = ritmo × índice
 * do dia da semana (índices vazios = 1, média simples). Mesma conta da Central.
 */
export const serieRitmo = ({ daily, dataInicial, dataFinal, indices, cor }: {
  daily: { data: string; value: number }[]
  dataInicial: string
  dataFinal: string
  /** Índice por dia da semana (0 = domingo). Vazio = média simples. */
  indices: Record<number, number>
  cor: string
}): SerieRitmo | null => {
  if (!dataInicial || !dataFinal || dataInicial.slice(0, 7) !== dataFinal.slice(0, 7)) return null
  const mes = dataInicial.slice(0, 7)
  const [y, m] = dataInicial.split('-').map(Number)
  const diasNoMes = new Date(y, m, 0).getDate()
  const porDia = new Map<number, number>()
  let ultimoDia = 0
  for (const d of daily) {
    if (d.data.slice(0, 7) !== mes) continue
    const dia = Number(d.data.slice(8, 10))
    porDia.set(dia, (porDia.get(dia) ?? 0) + d.value)
    if (d.value !== 0) ultimoDia = Math.max(ultimoDia, dia)
  }
  const hoje = todayLocal()
  const mesCorrente = hoje.slice(0, 7) === mes
  const ultimoFechado = mesCorrente ? Math.min(ultimoDia, Number(hoje.slice(8, 10)) - 1) : ultimoDia
  if (ultimoFechado <= 0) return null
  const diario = Array.from({ length: ultimoFechado }, (_, i) => porDia.get(i + 1) ?? 0)
  let projecao: number[] | null = null
  if (mesCorrente && ultimoFechado < diasNoMes) {
    const peso = (dia: number) => indices[new Date(y, m - 1, dia).getDay()] ?? 1
    let realizado = 0
    let somaPesos = 0
    for (let dia = 1; dia <= ultimoFechado; dia++) { realizado += porDia.get(dia) ?? 0; somaPesos += peso(dia) }
    const ritmo = somaPesos > 0 ? realizado / somaPesos : 0
    projecao = Array.from({ length: diasNoMes - ultimoFechado }, (_, i) => ritmo * peso(ultimoFechado + 1 + i))
  }
  return { diario, projecao, diasNoMes, cor }
}
