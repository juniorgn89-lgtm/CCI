-- ============================================
-- CONCORRÊNCIA — AUDITORIA (quem lançou + quem excluiu)
-- ============================================
-- Fase 1: "quem lançou" — denormaliza o nome do autor no INSERT (created_by_nome),
--   no mesmo padrão de qualidade_arquivados (evita depender da RLS de profiles).
-- Fase 2 (opção A): soft-delete — "excluir" deixa de ser DELETE físico e passa a
--   marcar deleted_at/deleted_by. Preserva o histórico (roadmap de elasticidade) e
--   registra QUEM excluiu e QUANDO. Leituras filtram deleted_at IS NULL.
--
-- Rode no SQL Editor do Supabase. Idempotente.
-- ============================================

alter table public.concorrencia_precos
  add column if not exists created_by_nome text,
  add column if not exists deleted_at      timestamptz,
  add column if not exists deleted_by      uuid references auth.users(id),
  add column if not exists deleted_by_nome text;

comment on column public.concorrencia_precos.created_by_nome is
  'Email/nome do autor, denormalizado no INSERT — exibe "quem lançou" sem ler profiles.';
comment on column public.concorrencia_precos.deleted_at is
  'Soft-delete: quando o concorrente foi excluído (NULL = ativo). Leituras filtram deleted_at IS NULL.';
comment on column public.concorrencia_precos.deleted_by is
  'Quem excluiu (auth.uid carimbado pelo trigger). Restaurar volta a NULL.';

-- "Preço atual" e leituras só consideram ativos.
create index if not exists idx_concorrencia_ativos
  on public.concorrencia_precos (empresa_codigo, observado_em desc)
  where deleted_at is null;

-- ============================================
-- UPDATE policy: só master (soft-delete/restore). O INSERT/SELECT seguem as
-- policies já existentes; o DELETE físico master fica como válvula de purga.
-- ============================================
drop policy if exists "concorrencia soft delete master" on public.concorrencia_precos;
create policy "concorrencia soft delete master"
on public.concorrencia_precos for update to authenticated
using ( public.is_current_user_master() )
with check ( public.is_current_user_master() );

-- ============================================
-- Guard: o log continua IMUTÁVEL — um UPDATE só pode mexer nas colunas de
-- soft-delete; qualquer outra alteração é rejeitada. O trigger carimba
-- deleted_at/deleted_by no servidor (autoritativo); deleted_by_nome vem do app.
-- ============================================
create or replace function public.concorrencia_guard_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.rede_id, new.empresa_codigo, new.combustivel, new.concorrente_nome,
      new.concorrente_postos, new.preco, new.observado_em, new.fonte,
      new.observacao, new.created_by, new.created_by_nome, new.created_at)
     is distinct from
     (old.rede_id, old.empresa_codigo, old.combustivel, old.concorrente_nome,
      old.concorrente_postos, old.preco, old.observado_em, old.fonte,
      old.observacao, old.created_by, old.created_by_nome, old.created_at)
  then
    raise exception 'concorrencia_precos é imutável (só soft-delete/restore permitido)';
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_at := now();         -- carimbo autoritativo
    new.deleted_by := auth.uid();
  elsif new.deleted_at is null and old.deleted_at is not null then
    new.deleted_by := null;          -- restore
    new.deleted_by_nome := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_concorrencia_guard_update on public.concorrencia_precos;
create trigger trg_concorrencia_guard_update
  before update on public.concorrencia_precos
  for each row execute function public.concorrencia_guard_update();
