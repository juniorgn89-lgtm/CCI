import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Repeat, Plus, Layers, Loader2, Check, Power, Copy, Pencil, X, Trash2, Camera } from 'lucide-react'
import {
  fetchRotinas, criarRotina, atualizarRotina, excluirRotina, criarSetor, atualizarSetor, gerarTarefasDeRotinas, proximaGeracao,
  RECORRENCIA_LABEL, REFERENTE_LABEL, DIAS_SEMANA, MODO_PERSONALIZADO_LABEL, PRIORIDADE_LABEL, MESES_CURTOS, exigeAnexo,
  type RotinaRow, type RotinaInput, type Recorrencia, type ReferenteA, type ModoPersonalizado, type Prioridade,
} from '@/api/supabase/gestaoTarefas'
import { SeloPrioridade } from './Prioridade'
import { useGestaoBase, containerCls, inputCls, selectCls, labelCls, btnPrimary, btnGhost, hojeLocal, fmtData, descreverRegra, fmtMmdd } from './comum'
import { Modal, ModalRodape, Erro } from './comumUi'
import { cn } from '@/lib/utils'
import { GUIAS } from '@/lib/guiasModais'
import InfoHint from '@/components/ui/InfoHint'

/**
 * Gestão → Rotinas: modelos recorrentes que geram as tarefas sozinhos
 * (cron à meia-noite + geração imediata ao criar). Só gestor/diretor mexe.
 */
const Rotinas = () => {
  const base = useGestaoBase()
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [setorSel, setSetorSel] = useState('todos')
  const [statusSel, setStatusSel] = useState<'todas' | 'ativas' | 'inativas'>('todas')
  const [novaAberta, setNovaAberta] = useState(false)
  const [setoresAberto, setSetoresAberto] = useState(false)
  const [editando, setEditando] = useState<RotinaRow | null>(null)
  // Duplicar: abre o formulário preenchido com a rotina-modelo, mas cria uma nova.
  const [copiaDe, setCopiaDe] = useState<RotinaRow | null>(null)
  // Excluir de vez: pede confirmação num modal (as tarefas já geradas ficam).
  const [excluindo, setExcluindo] = useState<RotinaRow | null>(null)
  const [excluindoSalva, setExcluindoSalva] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const rotinas = useQuery({
    queryKey: ['gestao-rotinas', base.redeId],
    queryFn: () => fetchRotinas(base.redeId!),
    enabled: !!base.redeId,
  })

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (rotinas.data ?? []).filter((r) => {
      if (setorSel !== 'todos' && r.setor_id !== setorSel) return false
      if (statusSel === 'ativas' && !r.ativa) return false
      if (statusSel === 'inativas' && r.ativa) return false
      return !q || r.nome.toLowerCase().includes(q) || (r.descricao ?? '').toLowerCase().includes(q)
    })
  }, [rotinas.data, busca, setorSel, statusSel])

  if (base.profileLoaded && !base.podeGerir) return <Navigate to="/dashboard" replace />
  if (!base.redeId) return <div className="p-6 text-sm text-gray-500">Selecione uma rede para ver as rotinas.</div>

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['gestao-rotinas', base.redeId] })
    void qc.invalidateQueries({ queryKey: ['gestao-tarefas', base.redeId] })
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    setExcluindoSalva(true); setErro(null)
    try { await excluirRotina(excluindo.id); setExcluindo(null); invalidar() } catch (e) { setErro(e instanceof Error ? e.message : String(e)) } finally { setExcluindoSalva(false) }
  }
  const alternarAtiva = async (r: RotinaRow) => {
    setErro(null)
    try { await atualizarRotina(r.id, { ativa: !r.ativa }); invalidar() } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }

  const descreverRecorrencia = (r: RotinaRow) => `${descreverRegra(r)} · vence às ${r.hora_vencimento.slice(0, 5)}`

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center gap-2">
        <input className={cn(inputCls, 'h-9 flex-1 min-w-[12rem]')} placeholder="Buscar rotina…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className={cn(selectCls, 'h-9 w-auto')} value={setorSel} onChange={(e) => setSetorSel(e.target.value)}>
          <option value="todos">Todos os setores</option>
          {base.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select className={cn(selectCls, 'h-9 w-auto')} value={statusSel} onChange={(e) => setStatusSel(e.target.value as typeof statusSel)}>
          <option value="todas">Todos os status</option>
          <option value="ativas">Ativas</option>
          <option value="inativas">Inativas</option>
        </select>
        <button type="button" className={btnGhost} onClick={() => setSetoresAberto(true)}><Layers className="h-4 w-4" /> Setores</button>
        <button type="button" className={btnPrimary} onClick={() => setNovaAberta(true)}><Plus className="h-4 w-4" /> Nova rotina</button>
        <InfoHint text="Rotina é o modelo: diz o que fazer, em quais postos, quem faz e com que frequência. Todo dia à meia-noite ela gera as tarefas do dia, uma por posto. Pausar (botão de energia) para de gerar sem apagar o histórico; Duplicar cria uma cópia para ajustar; a lixeira exclui de vez (as tarefas já geradas ficam)." />
      </div>

      <Erro msg={erro} />

      <div className={cn(containerCls, 'overflow-hidden')}>
        {rotinas.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando rotinas…</div>
        ) : lista.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
            <Repeat className="mx-auto mb-2 h-6 w-6 opacity-50" />
            {rotinas.data?.length ? 'Nenhuma rotina com esses filtros.' : 'Nenhuma rotina ainda. Uma rotina gera as tarefas do dia sozinha, posto por posto.'}
            {!rotinas.data?.length && (
              <div className="mt-3"><button type="button" className={btnPrimary} onClick={() => setNovaAberta(true)}><Plus className="h-4 w-4" /> Criar a primeira rotina</button></div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {lista.map((r) => (
              <li key={r.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !r.ativa && 'opacity-60')}>
                <button type="button" onClick={() => setEditando(r)} className="min-w-0 flex-1 text-left">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100"><span className="truncate hover:underline">{r.nome}</span><SeloPrioridade p={r.prioridade} /></p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{descreverRecorrencia(r)}</span>
                    <span>Referente: {REFERENTE_LABEL[r.referente_a]}</span>
                    <span>{r.empresa_codigos.length ? `${r.empresa_codigos.length} posto(s)` : 'sem posto'}</span>
                    <span>{base.nomeUsuario(r.responsavel_id) ?? 'Sem responsável (não gera)'}</span>
                    {r.setor_id && <span>{base.nomeSetor(r.setor_id)}</span>}
                    {r.checklist.length > 0 && <span>{r.checklist.length} etapa(s)</span>}
                    {exigeAnexo(r) && <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" />{r.documentos_exigidos.length ? `${r.documentos_exigidos.length} documento(s) exigido(s)` : 'foto obrigatória'}</span>}
                    {r.ativa && r.responsavel_id && (() => { const p = proximaGeracao(r, hojeLocal()); return p ? <span className="text-emerald-700 dark:text-emerald-400">próxima: {fmtData(p)}</span> : null })()}
                  </p>
                </button>
                <button type="button" className={cn(btnGhost, 'h-8 px-2')} onClick={() => setCopiaDe(r)} title="Duplicar rotina (cria uma cópia para ajustar)">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {r.ativa && !r.responsavel_id && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title="Sem responsável nenhuma tarefa é gerada. Abra a rotina e escolha quem faz.">
                    não gera tarefas
                  </span>
                )}
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', r.ativa ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')}>
                  {r.ativa ? 'Ativa' : 'Inativa'}
                </span>
                <button type="button" className={cn(btnGhost, 'h-8 px-2')} onClick={() => void alternarAtiva(r)} title={r.ativa ? 'Pausar rotina' : 'Reativar rotina'}>
                  <Power className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={cn(btnGhost, 'h-8 px-2 text-red-600 hover:text-red-700 dark:text-red-400')} onClick={() => setExcluindo(r)} title="Excluir rotina de vez (só gestor ou diretor)">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        As tarefas de cada dia são geradas à meia-noite (horário de Brasília) para as rotinas ativas com responsável. Ao criar uma rotina, as de hoje já aparecem.
      </p>

      {(novaAberta || editando || copiaDe) && (
        <RotinaForm
          rotina={editando}
          copiaDe={copiaDe}
          onClose={() => { setNovaAberta(false); setEditando(null); setCopiaDe(null) }}
          onSalva={() => { setNovaAberta(false); setEditando(null); setCopiaDe(null); invalidar() }}
        />
      )}
      {setoresAberto && <SetoresDialog onClose={() => setSetoresAberto(false)} />}
      {excluindo && (
        <Modal
          open
          onClose={() => { if (!excluindoSalva) setExcluindo(null) }}
          titulo={<span className="inline-flex items-center gap-2 text-red-600 dark:text-red-400"><Trash2 className="h-4 w-4" /> Excluir esta rotina de vez?</span>}
          descricao="Esta ação não tem volta."
        >
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <b className="text-gray-800 dark:text-gray-100">{excluindo.nome}</b> deixa de existir e nada mais é gerado a partir dela. As tarefas que ela já criou continuam no histórico, só sem o vínculo. Se a ideia é só parar por um tempo, use Pausar (botão de energia).
          </p>
          <Erro msg={erro} />
          <ModalRodape className="static mt-2">
            <button type="button" className={btnGhost} onClick={() => setExcluindo(null)} disabled={excluindoSalva}>Cancelar</button>
            <button type="button" className={cn(btnPrimary, 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700')} onClick={() => void confirmarExclusao()} disabled={excluindoSalva}>
              {excluindoSalva ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Excluir de vez
            </button>
          </ModalRodape>
        </Modal>
      )}
    </div>
  )
}

/* ─── formulário de rotina ─────────────────────────────────────────────── */

const RotinaForm = ({ rotina: editando, copiaDe, onClose, onSalva }: { rotina: RotinaRow | null; copiaDe?: RotinaRow | null; onClose: () => void; onSalva: () => void }) => {
  const base = useGestaoBase()
  // Edição usa a própria rotina; duplicação usa a cópia só como modelo (salva como nova).
  const rotina = editando ?? copiaDe ?? null
  const [nome, setNome] = useState(editando ? editando.nome : copiaDe ? `${copiaDe.nome} (cópia)` : '')
  const [descricao, setDescricao] = useState(rotina?.descricao ?? '')
  const [empresas, setEmpresas] = useState<number[]>(rotina?.empresa_codigos ?? [])
  const [responsavel, setResponsavel] = useState(rotina?.responsavel_id ?? '')
  const [setor, setSetor] = useState(rotina?.setor_id ?? '')
  const [recorrencia, setRecorrencia] = useState<Recorrencia>(rotina?.recorrencia ?? 'diaria')
  const [dias, setDias] = useState<number[]>(rotina?.dias_semana ?? [1, 2, 3, 4, 5])
  const [inicio, setInicio] = useState(rotina?.inicio_em ?? hojeLocal())
  const [hora, setHora] = useState(rotina?.hora_vencimento.slice(0, 5) ?? '18:00')
  const [referente, setReferente] = useState<ReferenteA>(rotina?.referente_a ?? 'proprio_dia')
  const [checklist, setChecklist] = useState<string[]>(rotina?.checklist ?? [])
  const [novaEtapa, setNovaEtapa] = useState('')
  const [modo, setModo] = useState<ModoPersonalizado>(rotina?.modo_personalizado ?? 'semana')
  const [diasMes, setDiasMes] = useState<number[]>(rotina?.dias_mes ?? [])
  const [datasAno, setDatasAno] = useState<string[]>(rotina?.datas_ano ?? [])
  const [novaDataDia, setNovaDataDia] = useState('1')
  const [novaDataMes, setNovaDataMes] = useState('1')
  const [escTrab, setEscTrab] = useState(String(rotina?.escala_trabalha ?? 1))
  const [escFolga, setEscFolga] = useState(String(rotina?.escala_folga ?? 1))
  const [prioridade, setPrioridade] = useState<Prioridade>(rotina?.prioridade ?? 'media')
  const [exigeFoto, setExigeFoto] = useState(rotina?.exige_anexo ?? false)
  const [documentos, setDocumentos] = useState<string[]>(rotina?.documentos_exigidos ?? [])
  const [novoDoc, setNovoDoc] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const alternarEmpresa = (c: number) => setEmpresas((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]))
  const alternarDia = (d: number) => setDias((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]))
  const addEtapa = () => { const t = novaEtapa.trim(); if (!t) return; setChecklist((xs) => [...xs, t]); setNovaEtapa('') }
  const alternarDiaMes = (d: number) => setDiasMes((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]))
  const addDataAno = () => {
    const mmdd = `${novaDataMes.padStart(2, '0')}-${novaDataDia.padStart(2, '0')}`
    if (!datasAno.includes(mmdd)) setDatasAno((xs) => [...xs, mmdd].sort())
  }
  const addDoc = () => { const t = novoDoc.trim(); if (!t || documentos.includes(t)) return; setDocumentos((xs) => [...xs, t]); setNovoDoc(''); setExigeFoto(true) }
  const trab = Math.max(0, Math.round(Number(escTrab) || 0))
  const folga = Math.max(0, Math.round(Number(escFolga) || 0))
  const pers = recorrencia === 'personalizada'
  const regra = {
    recorrencia, modo_personalizado: modo,
    dias_semana: pers && modo === 'semana' ? dias : [],
    dias_mes: pers && modo === 'mes' ? diasMes : [],
    datas_ano: pers && modo === 'ano' ? datasAno : [],
    escala_trabalha: pers && modo === 'escala' ? trab : null,
    escala_folga: pers && modo === 'escala' ? folga : null,
  }
  const resumo = `${descreverRegra(regra)}, com vencimento às ${hora}.`

  const salvar = async () => {
    if (nome.trim().length < 3) { setErro('Dê um nome à rotina.'); return }
    if (pers && modo === 'semana' && dias.length === 0) { setErro('Escolha ao menos um dia da semana.'); return }
    if (pers && modo === 'mes' && diasMes.length === 0) { setErro('Escolha ao menos um dia do mês.'); return }
    if (pers && modo === 'ano' && datasAno.length === 0) { setErro('Adicione ao menos uma data do ano.'); return }
    if (pers && modo === 'escala' && trab < 1) { setErro('Na escala, informe quantos dias trabalha (1 ou mais).'); return }
    setSalvando(true); setErro(null)
    const input: RotinaInput = {
      nome: nome.trim(), descricao: descricao.trim() || null, empresa_codigos: empresas,
      responsavel_id: responsavel || null, setor_id: setor || null, ...regra,
      hora_vencimento: hora, inicio_em: inicio || hojeLocal(), referente_a: referente, checklist, ativa: rotina?.ativa ?? true,
      prioridade, exige_anexo: exigeFoto || documentos.length > 0, documentos_exigidos: exigeFoto || documentos.length > 0 ? documentos : [],
    }
    try {
      if (editando) await atualizarRotina(editando.id, input)
      else await criarRotina(base.redeId!, input)
      // As tarefas de hoje aparecem na hora (idempotente).
      try { await gerarTarefasDeRotinas() } catch { /* o cron da meia-noite cobre */ }
      onSalva()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setSalvando(false)
    }
  }

  return (
    <Modal guia={GUIAS.rotinaForm} open onClose={onClose} titulo={<span className="inline-flex items-center gap-2"><Repeat className="h-4 w-4" /> {editando ? 'Editar rotina' : copiaDe ? 'Duplicar rotina' : 'Nova rotina'}</span>} largura="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Nome</label>
          <input className={inputCls} placeholder="Ex.: Medição dos tanques" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </div>
        <div>
          <label className={labelCls}>Descrição (opcional)</label>
          <textarea className={inputCls} rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div>
          <label className={cn(labelCls, 'inline-flex items-center gap-1')}>Postos ({empresas.length ? `${empresas.length} selecionado(s)` : 'nenhum = uma tarefa só, sem posto'}) <InfoHint text="Cada posto marcado vira uma tarefa própria todo dia, com o mesmo responsável e checklist. Sem posto marcado, nasce uma tarefa só, da rede." /></label>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
            {base.postos.length === 0 && <span className="text-xs text-gray-400">Carregando postos da rede…</span>}
            {base.postos.map((p) => {
              const on = empresas.includes(p.codigo)
              return (
                <button key={p.codigo} type="button" onClick={() => alternarEmpresa(p.codigo)}
                  className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', on ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-blue-600 dark:bg-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800')}>
                  {on && <Check className="mr-1 inline h-3 w-3" />}{p.fantasia || p.razao || `Posto ${p.codigo}`}
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={cn(labelCls, 'inline-flex items-center gap-1')}>Responsável <InfoHint text="Quem recebe as tarefas geradas. Sem responsável a rotina fica cadastrada mas não gera nada, e aparece com o selo 'não gera tarefas' na lista." /></label>
            <select className={selectCls} value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Sem responsável (não gera)</option>
              {base.usuarios.map((u) => <option key={u.user_id} value={u.user_id}>{u.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Setor</label>
            <select className={selectCls} value={setor} onChange={(e) => setSetor(e.target.value)}>
              <option value="">Sem setor</option>
              {base.setores.filter((s) => s.ativo || s.id === setor).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={cn(labelCls, 'inline-flex items-center gap-1')}>Prioridade <InfoHint text="Vai para cada tarefa gerada. Alta e Urgente ganham selo na lista e sobem na ordem dentro do mesmo prazo. Mudar aqui também atualiza as tarefas desta rotina que ainda estão em aberto." /></label>
            <select className={selectCls} value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>
              {(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((p) => <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div>
            <label className={cn(labelCls, 'inline-flex items-center gap-1')}>Recorrência <InfoHint text="Todos os dias, só dias úteis (segunda a sexta) ou Personalizada: dias da semana, dias do mês (ex.: todo dia 5, ou o último dia), datas no ano (ex.: 31/12) ou escala (ex.: trabalha 1, folga 1). 'Início em' é a partir de quando gera, e na escala é o primeiro dia de trabalho; 'vence às' é a hora limite de cada tarefa. A linha verde resume e mostra a próxima geração." /></label>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(RECORRENCIA_LABEL) as Recorrencia[]).map((r) => (
                <button key={r} type="button" onClick={() => setRecorrencia(r)}
                  className={cn('rounded-md px-3 py-1.5 text-xs font-semibold', recorrencia === r ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#0f0f0f] dark:text-gray-300')}>
                  {RECORRENCIA_LABEL[r]}
                </button>
              ))}
              <span className="flex w-full flex-wrap items-center gap-2 text-xs text-gray-500 sm:ml-auto sm:w-auto">
                <span className="whitespace-nowrap">início em</span> <input type="date" className={cn(inputCls, 'h-8 w-auto py-1')} value={inicio} onChange={(e) => setInicio(e.target.value)} />
                <span className="whitespace-nowrap">vence às</span> <input type="time" className={cn(inputCls, 'h-8 w-auto py-1')} value={hora} onChange={(e) => setHora(e.target.value)} />
              </span>
            </div>
            {pers && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 sm:grid-cols-4 dark:bg-[#0f0f0f]">
                  {(Object.keys(MODO_PERSONALIZADO_LABEL) as ModoPersonalizado[]).map((m) => (
                    <button key={m} type="button" onClick={() => setModo(m)}
                      className={cn('rounded-md px-2 py-1.5 text-xs font-semibold', modo === m ? 'bg-white text-[#1e3a5f] shadow-sm dark:bg-gray-800 dark:text-blue-200' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200')}>
                      {MODO_PERSONALIZADO_LABEL[m]}
                    </button>
                  ))}
                </div>
                {modo === 'semana' && (
                  <div className="flex flex-wrap gap-1.5">
                    {DIAS_SEMANA.map((d, i) => (
                      <button key={d} type="button" onClick={() => alternarDia(i)}
                        className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', dias.includes(i) ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-blue-600 dark:bg-blue-700' : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300')}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}
                {modo === 'mes' && (
                  <div>
                    <div className="grid grid-cols-7 gap-1 sm:grid-cols-11">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <button key={d} type="button" onClick={() => alternarDiaMes(d)}
                          className={cn('h-8 rounded-md border text-xs font-medium tabular-nums', diasMes.includes(d) ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-blue-600 dark:bg-blue-700' : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300')}>
                          {d}
                        </button>
                      ))}
                      <button type="button" onClick={() => alternarDiaMes(0)}
                        className={cn('col-span-3 h-8 rounded-md border text-xs font-medium sm:col-span-2', diasMes.includes(0) ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-blue-600 dark:bg-blue-700' : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300')}>
                        Último dia
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">Mês que não tem o dia (ex.: 31 em abril) é pulado. Para o fim de todo mês, use "Último dia".</p>
                  </div>
                )}
                {modo === 'ano' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select className={cn(selectCls, 'h-8 w-auto py-1')} value={novaDataDia} onChange={(e) => setNovaDataDia(e.target.value)} aria-label="Dia">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <select className={cn(selectCls, 'h-8 w-auto py-1')} value={novaDataMes} onChange={(e) => setNovaDataMes(e.target.value)} aria-label="Mês">
                        {MESES_CURTOS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                      </select>
                      <button type="button" className={cn(btnGhost, 'h-8 px-2 text-xs')} onClick={addDataAno}><Plus className="h-3.5 w-3.5" /> Data</button>
                    </div>
                    {datasAno.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {datasAno.map((d) => (
                          <span key={d} className="inline-flex items-center gap-1 rounded-full bg-[#1e3a5f] px-2.5 py-1 text-xs font-medium text-white dark:bg-blue-700">
                            {fmtMmdd(d)}
                            <button type="button" onClick={() => setDatasAno((xs) => xs.filter((x) => x !== d))} aria-label="Remover data"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {modo === 'escala' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      Trabalha <input type="number" min={1} className={cn(inputCls, 'h-8 w-16 py-1 text-center')} value={escTrab} onChange={(e) => setEscTrab(e.target.value)} /> dia(s), folga
                      <input type="number" min={0} className={cn(inputCls, 'h-8 w-16 py-1 text-center')} value={escFolga} onChange={(e) => setEscFolga(e.target.value)} /> dia(s)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {([['12×36 (1 por 1)', 1, 1], ['5×1', 5, 1], ['6×1', 6, 1], ['5×2', 5, 2], ['4×2', 4, 2]] as const).map(([rot, t, fo]) => (
                        <button key={rot} type="button" onClick={() => { setEscTrab(String(t)); setEscFolga(String(fo)) }}
                          className={cn('rounded-md px-2 py-1 text-[11px] font-medium', trab === t && folga === fo ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#0f0f0f] dark:text-gray-300')}>
                          {rot}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-500">O ciclo começa em "início em": esse é o primeiro dia de trabalho.</p>
                  </div>
                )}
              </div>
            )}
            <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">{resumo}</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {!responsavel
                ? 'Sem responsável, nada é gerado.'
                : (() => {
                  const p = proximaGeracao({ ...regra, inicio_em: inicio || hojeLocal() }, hojeLocal())
                  if (!p) return 'Com essa recorrência, nenhuma tarefa seria gerada no próximo ano.'
                  const n = empresas.length || 1
                  return `Próxima geração: ${fmtData(p)}${p === hojeLocal() ? ' (hoje, assim que salvar)' : ''} · ${n} tarefa${n > 1 ? 's' : ''}${empresas.length ? ' (uma por posto)' : ''}.`
                })()}
            </p>
          </div>
          <div>
            <label className={cn(labelCls, 'inline-flex items-center gap-1')}>Referente a <InfoHint text="De que dia a tarefa trata. 'Conferir o caixa' gerada hoje normalmente é sobre ontem (dia anterior); um fechamento gerado no dia 1 é sobre o mês anterior. Isso aparece na tarefa como 'referente a'." /></label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(REFERENTE_LABEL) as ReferenteA[]).map((r) => (
                <button key={r} type="button" onClick={() => setReferente(r)}
                  className={cn('rounded-md px-3 py-1.5 text-xs font-semibold', referente === r ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#0f0f0f] dark:text-gray-300')}>
                  {REFERENTE_LABEL[r]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">
              {referente === 'proprio_dia' ? 'A tarefa se refere ao dia em que é feita.' : referente === 'mes_anterior' ? 'A tarefa trata do mês anterior (ex.: fechamento mensal).' : 'A tarefa trata do dia anterior (ex.: conferir o caixa de ontem).'}
            </p>
          </div>
        </div>

        <div>
          <label className={cn(labelCls, 'inline-flex items-center gap-1')}>Checklist-modelo (copiado para cada tarefa gerada) <InfoHint text="As etapas entram em toda tarefa que a rotina gerar. Mudar aqui vale só para as próximas; as já geradas ficam como estão." /></label>
          {checklist.length > 0 && (
            <ul className="mb-2 space-y-1">
              {checklist.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <span className="flex-1">{i + 1}. {c}</span>
                  <button type="button" className="text-xs text-gray-400 hover:text-red-600" onClick={() => setChecklist((xs) => xs.filter((_, j) => j !== i))}>remover</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Adicionar etapa e pressionar Enter…" value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEtapa() } }} />
            <button type="button" className={btnGhost} onClick={addEtapa}><Plus className="h-4 w-4" /></button>
          </div>
        </div>

        <ExigirAnexoCampos exige={exigeFoto} onExige={setExigeFoto} documentos={documentos} onDocumentos={setDocumentos} novoDoc={novoDoc} onNovoDoc={setNovoDoc} onAdd={addDoc} />

        {editando && <p className="text-[11px] text-gray-500">Alterações valem para as próximas tarefas geradas. Nas tarefas em aberto desta rotina, só a prioridade e os anexos exigidos são atualizados.</p>}

        <Erro msg={erro} />
        <ModalRodape>
          <button type="button" className={btnGhost} onClick={onClose}>Cancelar</button>
          <button type="button" className={btnPrimary} onClick={() => void salvar()} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {editando ? 'Salvar' : 'Criar rotina'}
          </button>
        </ModalRodape>
      </div>
    </Modal>
  )
}

/* ─── exigir foto ou documento ─────────────────────────────────────────── */

/** "Exigir foto ou documento para concluir" + nomes dos documentos obrigatórios. Usado na rotina e na tarefa avulsa. */
export const ExigirAnexoCampos = ({ exige, onExige, documentos, onDocumentos, novoDoc, onNovoDoc, onAdd }: {
  exige: boolean; onExige: (v: boolean) => void
  documentos: string[]; onDocumentos: (d: string[]) => void
  novoDoc: string; onNovoDoc: (v: string) => void; onAdd: () => void
}) => (
  <div className="space-y-2">
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
      <input type="checkbox" className="h-4 w-4 accent-[#1e3a5f]" checked={exige || documentos.length > 0} onChange={(e) => { onExige(e.target.checked); if (!e.target.checked) onDocumentos([]) }} />
      Exigir foto ou documento para concluir
      <InfoHint text="A tarefa só conclui com anexo. Sem nomes, basta uma foto ou documento qualquer. Com nomes (ex.: PDF do fechamento de caixa), cada um vira um item a anexar e a tarefa só conclui com todos. A trava vale também no banco: ninguém conclui sem anexar." />
    </label>
    {(exige || documentos.length > 0) && (
      <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Documentos exigidos <span className="font-normal text-gray-400">(opcional)</span></p>
        <p className="mb-2 text-[11px] text-gray-500">Dê nome a cada anexo obrigatório; a tarefa só conclui com todos anexados. Sem nomes, basta uma foto ou documento.</p>
        {documentos.length > 0 && (
          <ul className="mb-2 space-y-1">
            {documentos.map((d, i) => (
              <li key={d} className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1 text-sm text-gray-700 dark:bg-white/[0.04] dark:text-gray-200">
                <Camera className="h-3.5 w-3.5 text-gray-400" /><span className="flex-1">{d}</span>
                <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => onDocumentos(documentos.filter((_, j) => j !== i))} aria-label="Remover documento"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Ex.: PDF do fechamento de caixa e pressione Enter" value={novoDoc} onChange={(e) => onNovoDoc(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }} />
          <button type="button" className={cn(btnGhost, 'shrink-0')} onClick={onAdd} disabled={!novoDoc.trim()}><Plus className="h-4 w-4" /></button>
        </div>
      </div>
    )}
  </div>
)

/* ─── setores ──────────────────────────────────────────────────────────── */

export const SetoresDialog = ({ onClose }: { onClose: () => void }) => {
  const base = useGestaoBase()
  const qc = useQueryClient()
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['gestao-setores', base.redeId] })

  const criar = async () => {
    if (nome.trim().length < 2) return
    setSalvando(true); setErro(null)
    try { await criarSetor(base.redeId!, nome); setNome(''); invalidar() } catch (e) { setErro(e instanceof Error ? e.message : String(e)) } finally { setSalvando(false) }
  }
  const alternar = async (id: string, ativo: boolean) => {
    setErro(null)
    try { await atualizarSetor(id, { ativo: !ativo }); invalidar() } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }
  // Renomear: um setor por vez, salva no Enter ou no botão.
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null)
  const renomear = async () => {
    if (!renomeando || renomeando.nome.trim().length < 2) return
    setErro(null)
    try { await atualizarSetor(renomeando.id, { nome: renomeando.nome.trim() }); setRenomeando(null); invalidar() } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <Modal guia={GUIAS.setores} open onClose={onClose} titulo={<span className="inline-flex items-center gap-2"><Layers className="h-4 w-4" /> Setores</span>} descricao="Agrupam rotinas e tarefas (ex.: Pista, Loja, Financeiro). Um setor inativo some das listas mas mantém o histórico.">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Novo setor…" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void criar() }} />
          <button type="button" className={btnPrimary} onClick={() => void criar()} disabled={salvando || nome.trim().length < 2}><Plus className="h-4 w-4" /> Adicionar</button>
        </div>
        <Erro msg={erro} />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
          {base.setores.length === 0 && <li className="p-4 text-center text-xs text-gray-400">Nenhum setor ainda.</li>}
          {base.setores.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              {renomeando?.id === s.id ? (
                <>
                  <input className={cn(inputCls, 'h-8 py-1')} value={renomeando.nome} autoFocus onChange={(e) => setRenomeando({ id: s.id, nome: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') void renomear(); if (e.key === 'Escape') setRenomeando(null) }} />
                  <button type="button" className={cn(btnGhost, 'h-8 px-2')} onClick={() => void renomear()} title="Salvar nome"><Check className="h-3.5 w-3.5" /></button>
                  <button type="button" className={cn(btnGhost, 'h-8 px-2')} onClick={() => setRenomeando(null)} title="Cancelar"><X className="h-3.5 w-3.5" /></button>
                </>
              ) : (
                <>
                  <span className={cn('min-w-0 flex-1 truncate', !s.ativo && 'text-gray-400 line-through')}>{s.nome}</span>
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline" onClick={() => setRenomeando({ id: s.id, nome: s.nome })}><Pencil className="h-3 w-3" /> Renomear</button>
                  <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => void alternar(s.id, s.ativo)}>{s.ativo ? 'Desativar' : 'Reativar'}</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-gray-400">Criado em {base.setores[0] ? fmtData(base.setores[0].criado_em.slice(0, 10)) : '—'} o primeiro; os setores valem para toda a rede.</p>
      </div>
    </Modal>
  )
}

export default Rotinas
