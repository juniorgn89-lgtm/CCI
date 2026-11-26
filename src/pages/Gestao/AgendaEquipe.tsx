import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTarefas, adiarTarefa, type TarefaRow } from '@/api/supabase/gestaoTarefas'
import { useGestaoBase, hojeLocal } from './comum'
import { TarefaForm, TarefaDetalheSolto, type TarefaInicial } from './Tarefas'
import AgendaVisao, { type PeriodoAgenda } from './AgendaVisao'

/**
 * Agenda da equipe (Gestão › Tarefas › Agenda): liga a AgendaVisao (a tela,
 * no modelo do Google Agenda) aos dados — tarefas do período, equipe da rede,
 * quem pode mover/criar — e grava o arraste como "adiada" no histórico.
 */
export const AgendaEquipe = () => {
  const base = useGestaoBase()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [criando, setCriando] = useState<TarefaInicial | null>(null)
  const redeId = base.redeId

  // Hook de período passado para a tela (sempre o mesmo: regra dos hooks ok).
  const usePeriodo = useCallback((de: string, ate: string): PeriodoAgenda => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const q = useQuery({
      queryKey: ['gestao-tarefas', redeId, 'agenda-equipe', de, ate],
      queryFn: () => fetchTarefas(redeId!, de, ate),
      enabled: !!redeId,
      refetchInterval: 60_000,
      placeholderData: (prev) => prev,
    })
    return { tarefas: q.data ?? [], carregando: q.isLoading, buscando: q.isFetching && !q.isLoading, erro: q.error ? (q.error as Error).message : null }
  }, [redeId])

  const equipe = useMemo(() => base.usuarios.map((u) => ({ id: u.user_id, nome: u.nome })), [base.usuarios])

  const onMover = async (t: TarefaRow, novoVenceEm: string, motivo: string) => {
    const d = new Date(novoVenceEm)
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    // Otimista: a tarefa já aparece no lugar novo em todos os períodos carregados.
    qc.setQueriesData<TarefaRow[]>({ queryKey: ['gestao-tarefas', redeId, 'agenda-equipe'] }, (l) => l?.map((x) => (x.id === t.id ? { ...x, vence_em: novoVenceEm, vence_dia: dia } : x)))
    try {
      await adiarTarefa(t, novoVenceEm, base.autor, motivo)
    } finally {
      void qc.invalidateQueries({ queryKey: ['gestao-tarefas'] })
    }
  }

  if (!redeId) return null

  return (
    <>
      <AgendaVisao
        usePeriodo={usePeriodo}
        equipe={equipe}
        nomeUsuario={base.nomeUsuario}
        nomePosto={base.nomePosto}
        nomeSetor={base.nomeSetor}
        podeMover={(t) => (t.status === 'a_fazer' || t.status === 'em_andamento') && (base.podeGerir || t.responsavel_id === base.userId)}
        podeCriar={base.podeGerir}
        onMover={onMover}
        onAbrirTarefa={(t) => navigate(`/gestao?tab=tarefas&tarefa=${t.id}`)}
        // Abre a tarefa inteira na própria agenda: concluir, etapas, adiar e editar sem trocar de aba.
        renderDetalhe={(t, fechar) => <TarefaDetalheSolto key={t.id} tarefa={t} onClose={fechar} />}
        onCriar={(inicial) => setCriando(inicial)}
        hoje={hojeLocal()}
      />
      {criando && (
        <TarefaForm
          inicial={criando}
          onClose={() => setCriando(null)}
          onSalva={() => { setCriando(null); void qc.invalidateQueries({ queryKey: ['gestao-tarefas'] }) }}
        />
      )}
    </>
  )
}

export default AgendaEquipe
