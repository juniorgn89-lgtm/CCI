-- ============================================================================
-- Notas do NotaOK no Visor: + aba "Lançadas" (só os últimos 90 dias).
--
-- O espelho (notaok_notas) passa a guardar também as notas lançadas, com a data
-- e quem lançou; as lançadas há mais de 90 dias saem sozinhas (limpeza diária).
--
-- Rodar no SQL Editor do Visor DEPOIS de 20261125000002_notaok_notas.sql.
-- Pode rodar de novo.
-- ============================================================================

alter table public.notaok_notas drop constraint if exists notaok_notas_status_check;
alter table public.notaok_notas add constraint notaok_notas_status_check
  check (status in ('pendente', 'em_preenchimento', 'devolvida', 'enviada', 'lancada'));

alter table public.notaok_notas add column if not exists lancada_em timestamptz;
alter table public.notaok_notas add column if not exists lancada_por_nome text;
-- 'conferida' | 'incompleta' | 'sem' (lançada no ERP sem passar pela conferência)
alter table public.notaok_notas add column if not exists lancada_conferencia text;

create index if not exists notaok_notas_lancada_idx on public.notaok_notas (rede_id, lancada_em desc) where status = 'lancada';

select cron.unschedule(jobid) from cron.job where jobname = 'visor-notas-lancadas-limpeza';
select cron.schedule('visor-notas-lancadas-limpeza', '40 4 * * *', $$
  delete from public.notaok_notas
   where status = 'lancada' and coalesce(lancada_em, atualizado_em) < now() - interval '90 days'
$$);
