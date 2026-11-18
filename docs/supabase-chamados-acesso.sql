-- ============================================================================
-- Chamados: acesso por pessoa (Admin › Usuários, chave "Chamados").
-- Administrador (is_master) sempre abre e é o ÚNICO que vê a lista / o print
-- (Painel › Chamados). Quem tem pode_abrir_chamados só ABRE chamado (insere o
-- registro + envia o print); não lê nem altera chamados.
-- Rodar no SQL Editor do Supabase (projeto yzmorbfadoxowchkwspl), depois de
-- docs/supabase-chamados.sql.
-- ============================================================================

alter table public.profiles add column if not exists pode_abrir_chamados boolean not null default false;
comment on column public.profiles.pode_abrir_chamados is 'Vê o botão de chamados (bug/melhoria com print). Master sempre pode.';

create or replace function public.pode_abrir_chamados()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_master or p.pode_abrir_chamados from public.profiles p where p.user_id = auth.uid()),
    false
  )
$$;
revoke execute on function public.pode_abrir_chamados() from public, anon;
grant execute on function public.pode_abrir_chamados() to authenticated;

-- Quem tem a permissão pode INSERIR o próprio chamado (autor = ele mesmo).
drop policy if exists chamados_abrir on public.chamados;
create policy chamados_abrir on public.chamados for insert to authenticated
  with check (public.pode_abrir_chamados() and autor_id = auth.uid());

-- …e enviar o print (só envio; ler/apagar continua só administrador).
drop policy if exists chamados_obj_abrir on storage.objects;
create policy chamados_obj_abrir on storage.objects for insert to authenticated
  with check (bucket_id = 'chamados' and public.pode_abrir_chamados());
