import { useAuthStore } from '@/store/auth'
import useVisivel from '@/hooks/useVisivel'
import { useTenantStore } from '@/store/tenant'
import { formatCurrency } from '@/lib/formatters'
import type { TarefaInicial } from '@/pages/Gestao/Tarefas'

/** Um título marcado na modal do dia, no formato que vira etapa da tarefa. */
export interface TituloSelecionado {
  nome: string
  documento: string
  valor: number
  empresaCodigo: number
  posto: string
  /** Vencimento yyyy-MM-dd (quando a lista mistura dias). */
  venc?: string
}

/**
 * Criar tarefa a partir de títulos: só onde o módulo Tarefas está ligado na rede
 * e para quem pode criar tarefa (gestor ou diretor) — mesma regra do /gestao.
 */
export const usePodeCriarTarefa = () => {
  const gestao = useTenantStore((s) => !!s.rede?.gestao_habilitado)
  const isMaster = useAuthStore((s) => s.isMaster)
  const canGerir = useAuthStore((s) => s.canGerirTarefas)
  const tarefasVisivel = useVisivel().modulo('/gestao')
  return gestao && tarefasVisivel && (isMaster || canGerir)
}

const MAX_ETAPAS = 40
const brData = (iso: string) => iso.split('-').reverse().join('/')
const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Prazo padrão: hoje às 18:00; depois das 17h, daqui a uma hora (tarefa de urgência é do dia). */
const horaPadrao = () => {
  const d = new Date()
  if (d.getHours() < 17) return '18:00'
  const h = Math.min(23, d.getHours() + 1)
  return `${String(h).padStart(2, '0')}:${h === 23 ? '59' : String(d.getMinutes()).padStart(2, '0')}`
}

/** Monta título, descrição e etapas da tarefa a partir dos títulos marcados. */
export const montarTarefaDeTitulos = (tipo: 'receber' | 'pagar', diaVenc: string | null, itens: TituloSelecionado[], vencido: boolean): TarefaInicial => {
  const dias = [...new Set(itens.map((i) => i.venc).filter((d): d is string => !!d))].sort()
  const umDia = diaVenc ?? (dias.length === 1 ? dias[0] : null)
  const curta = (d: string) => brData(d).slice(0, 5)
  const total = itens.reduce((s, i) => s + i.valor, 0)
  const nomes = [...new Set(itens.map((i) => i.nome))]
  const postos = [...new Set(itens.map((i) => i.empresaCodigo))]
  const n = itens.length
  const qtd = `${n} título${n > 1 ? 's' : ''}`
  const verbo = tipo === 'receber' ? (vencido ? 'Cobrar' : 'Acompanhar recebimento de') : 'Pagar'
  const quem = nomes.length === 1 ? nomes[0] : tipo === 'receber' ? `${nomes.length} clientes` : `${nomes.length} fornecedores`
  const titulo = `${verbo} ${quem} · ${qtd} · ${formatCurrency(total)}`

  const etapas = itens.slice(0, MAX_ETAPAS).map((i) => ({
    texto: [nomes.length > 1 ? i.nome : null, `doc. ${i.documento}`, formatCurrency(i.valor), postos.length > 1 ? i.posto : null, !umDia && i.venc ? `venc. ${curta(i.venc)}` : null].filter(Boolean).join(' · '),
    feito: false,
  }))
  const descricao = [
    `${tipo === 'receber' ? 'Títulos a receber' : 'Títulos a pagar'} ${umDia ? `com vencimento em ${brData(umDia)}` : dias.length ? `com vencimentos de ${brData(dias[0])} a ${brData(dias[dias.length - 1])}` : 'selecionados'}${vencido ? ' (com vencidos)' : ''}.`,
    `Total: ${formatCurrency(total)} em ${qtd}${postos.length === 1 ? ` · ${itens[0].posto}` : ` · ${postos.length} postos`}.`,
    n > MAX_ETAPAS ? `A lista de etapas mostra os ${MAX_ETAPAS} primeiros; os outros ${n - MAX_ETAPAS} estão no Financeiro.` : null,
    `Criada a partir do Financeiro › Contas a ${tipo}. A baixa continua sendo feita no ERP.`,
  ].filter(Boolean).join('\n')

  return {
    titulo,
    descricao,
    empresaCodigo: postos.length === 1 ? postos[0] : null,
    prioridade: 'urgente',
    checklist: etapas,
    data: hoje(),
    hora: horaPadrao(),
  }
}
