-- ============================================================================
-- Gestão · Tarefas — lote 3 (15/10/2026): histórico ganha "adiada" e "editada".
-- Idempotente. Rodar depois de supabase-gestao-tarefas.sql e -2.sql.
-- ============================================================================
alter table public.gestao_atividades drop constraint if exists gestao_atividades_tipo_check;
alter table public.gestao_atividades add constraint gestao_atividades_tipo_check
  check (tipo in ('criada', 'iniciada', 'concluida', 'reaberta', 'cancelada', 'checklist', 'gerada', 'adiada', 'editada'));
create index if not exists gestao_atividades_tarefa_idx on public.gestao_atividades (tarefa_id, criado_em desc);
notify pgrst, 'reload schema';
