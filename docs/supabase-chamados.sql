-- ============================================================================
-- Chamados internos (bug / melhoria / número estranho / dúvida) com print.
-- Só diretores da CCI (profiles.is_master) abrem, leem e mudam status.
-- O print fica no bucket PRIVADO "chamados" (mostra dado financeiro da rede).
-- Rodar no SQL Editor do Supabase (projeto yzmorbfadoxowchkwspl).
-- ============================================================================

create table if not exists public.chamados (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('bug', 'melhoria', 'numero', 'duvida')),
  descricao   text not null check (char_length(trim(descricao)) > 0),
  status      text not null default 'novo' check (status in ('novo', 'analise', 'resolvido', 'descartado')),
  print_path  text,                       -- caminho no bucket "chamados" (null = sem print)
  contexto    jsonb not null default '{}', -- tela, aba, filtros, rede, versão, navegador, erros recentes
  rede_id     uuid references public.redes(id) on delete set null,
  autor_id    uuid references auth.users(id) on delete set null,
  autor_nome  text,
  resposta    text,                       -- nota de quem resolveu
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists chamados_criado_idx on public.chamados (criado_em desc);
create index if not exists chamados_status_idx on public.chamados (status);

alter table public.chamados enable row level security;

drop policy if exists chamados_master_all on public.chamados;
create policy chamados_master_all on public.chamados for all to authenticated
  using (exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_master))
  with check (exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_master));

-- Bucket privado do print.
insert into storage.buckets (id, name, public)
values ('chamados', 'chamados', false)
on conflict (id) do nothing;

drop policy if exists chamados_obj_master on storage.objects;
create policy chamados_obj_master on storage.objects for all to authenticated
  using (bucket_id = 'chamados' and exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_master))
  with check (bucket_id = 'chamados' and exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_master));
