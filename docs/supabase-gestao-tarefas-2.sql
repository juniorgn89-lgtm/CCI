-- ============================================================================
-- Gestão · etapa 3: liberação por rede, anexos das tarefas
-- Complementa docs/supabase-gestao-tarefas.sql. Idempotente.
-- ============================================================================

-- ─── Módulo ligado por rede (default desligado; CCI liga pra quem contratar) ──
alter table public.redes
  add column if not exists gestao_habilitado boolean not null default false;
comment on column public.redes.gestao_habilitado is 'Módulo Gestão (tarefas/rotinas) visível para os usuários desta rede.';

-- ─── Anexos (foto ou documento na tarefa) ────────────────────────────────────
create table if not exists public.gestao_anexos (
  id         uuid primary key default gen_random_uuid(),
  rede_id    uuid not null references public.redes(id) on delete cascade,
  tarefa_id  uuid not null references public.gestao_tarefas(id) on delete cascade,
  nome       text not null,
  -- caminho no bucket: <rede_id>/<tarefa_id>/<uuid>-<nome>
  path       text not null unique,
  tamanho    int,
  tipo       text,
  autor_id   uuid references auth.users(id) on delete set null default auth.uid(),
  autor_nome text,
  criado_em  timestamptz not null default now()
);
create index if not exists gestao_anexos_tarefa_idx on public.gestao_anexos (tarefa_id);
alter table public.gestao_anexos enable row level security;
drop policy if exists gestao_anexos_select on public.gestao_anexos;
create policy gestao_anexos_select on public.gestao_anexos for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists gestao_anexos_insert on public.gestao_anexos;
create policy gestao_anexos_insert on public.gestao_anexos for insert to authenticated
  with check (rede_id in (select public.redes_legiveis()) and autor_id = auth.uid());
drop policy if exists gestao_anexos_delete on public.gestao_anexos;
create policy gestao_anexos_delete on public.gestao_anexos for delete to authenticated
  using (autor_id = auth.uid() or public.pode_gerir_tarefas());

-- Bucket privado; acesso por URL assinada. Primeira pasta do caminho = rede_id.
insert into storage.buckets (id, name, public, file_size_limit)
values ('gestao-anexos', 'gestao-anexos', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = 15728640;

drop policy if exists gestao_anexos_obj_select on storage.objects;
create policy gestao_anexos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'gestao-anexos' and ((storage.foldername(name))[1])::uuid in (select public.redes_legiveis()));
drop policy if exists gestao_anexos_obj_insert on storage.objects;
create policy gestao_anexos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'gestao-anexos' and ((storage.foldername(name))[1])::uuid in (select public.redes_legiveis()));
drop policy if exists gestao_anexos_obj_delete on storage.objects;
create policy gestao_anexos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'gestao-anexos' and (owner = auth.uid() or public.pode_gerir_tarefas()));

notify pgrst, 'reload schema';
