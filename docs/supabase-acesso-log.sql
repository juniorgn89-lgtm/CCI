-- ============================================================================
-- acesso_log — registro de uso pra a aba "Controle de acesso" (Configurações).
-- Grava cada visita de tela (quem, quando, qual tela/módulo). Só o gerente lê.
-- Rode UMA vez no SQL Editor do projeto Visor360 (yzmorbfadoxowchkwspl).
-- Idempotente.
-- ============================================================================

create table if not exists public.acesso_log (
  id         bigint generated always as identity primary key,
  rede_id    uuid,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path       text not null,
  modulo     text,
  created_at timestamptz not null default now()
);

create index if not exists acesso_log_rede_created_idx on public.acesso_log (rede_id, created_at desc);
create index if not exists acesso_log_user_created_idx on public.acesso_log (user_id, created_at desc);

alter table public.acesso_log enable row level security;

-- Inserir: qualquer autenticado grava o PRÓPRIO evento (user_id = auth.uid()).
drop policy if exists acesso_log_insert on public.acesso_log;
create policy acesso_log_insert on public.acesso_log
  for insert to authenticated
  with check (user_id = auth.uid());

-- Ler: só o gerente (is_master). O app filtra por rede_id da rede conectada.
drop policy if exists acesso_log_select on public.acesso_log;
create policy acesso_log_select on public.acesso_log
  for select to authenticated
  using (exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_master));

-- (Opcional) Retenção: apagar registros com mais de 90 dias. Rode manualmente
-- de vez em quando, ou agende num cron:
--   delete from public.acesso_log where created_at < now() - interval '90 days';
