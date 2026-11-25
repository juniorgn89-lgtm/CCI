-- ============================================================================
-- Ocultar módulos e abas PARA PESSOAS (Painel › Ocultar módulos e abas › Por pessoa).
--
-- Complementa public.app_ocultos (que vale para a rede inteira): aqui o diretor
-- (CCI) ou o supervisor da rede esconde módulos/abas de UM usuário. É só visual
-- (menu e abas), igual ao app_ocultos: a permissão de acesso continua no
-- cadastro do usuário (módulos liberados).
--
--   chave = rota do módulo ('/financeiro') ou módulo::aba ('/financeiro::pagar')
--
-- Quem lê: o próprio usuário (decide o menu dele) e quem gerencia a rede.
-- Quem grava: diretor (is_master) ou supervisor (profiles.role = 'supervisor')
-- de uma rede que ele enxerga (redes_legiveis). Supervisor não esconde nada de
-- diretor.
--
-- Rodar no SQL Editor do Visor. Pode rodar de novo.
-- ============================================================================

create table if not exists public.app_ocultos_pessoas (
  rede_id    uuid not null references public.redes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  chave      text not null check (chave ~ '^/[a-z0-9/_-]+(::[a-zA-Z0-9_-]+)?$'),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em  timestamptz not null default now(),
  primary key (rede_id, user_id, chave)
);

create or replace function public.pode_ocultar_para_pessoas()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (coalesce(p.is_master, false) or coalesce(p.role, 'user') = 'supervisor')
  )
$$;
revoke execute on function public.pode_ocultar_para_pessoas() from public, anon;
grant execute on function public.pode_ocultar_para_pessoas() to authenticated;

alter table public.app_ocultos_pessoas enable row level security;
revoke all on public.app_ocultos_pessoas from anon, authenticated;
grant select, insert, delete on public.app_ocultos_pessoas to authenticated;

drop policy if exists app_ocultos_pessoas_ler on public.app_ocultos_pessoas;
create policy app_ocultos_pessoas_ler on public.app_ocultos_pessoas for select to authenticated
  using (
    user_id = auth.uid()
    or (rede_id in (select public.redes_legiveis()) and public.pode_ocultar_para_pessoas())
  );

drop policy if exists app_ocultos_pessoas_gravar on public.app_ocultos_pessoas;
create policy app_ocultos_pessoas_gravar on public.app_ocultos_pessoas for insert to authenticated
  with check (
    rede_id in (select public.redes_legiveis())
    and public.pode_ocultar_para_pessoas()
    -- supervisor não esconde nada de diretor
    and (
      exists (select 1 from public.profiles me where me.user_id = auth.uid() and coalesce(me.is_master, false))
      or not exists (select 1 from public.profiles alvo where alvo.user_id = app_ocultos_pessoas.user_id and coalesce(alvo.is_master, false))
    )
  );

drop policy if exists app_ocultos_pessoas_apagar on public.app_ocultos_pessoas;
create policy app_ocultos_pessoas_apagar on public.app_ocultos_pessoas for delete to authenticated
  using (rede_id in (select public.redes_legiveis()) and public.pode_ocultar_para_pessoas());

create index if not exists app_ocultos_pessoas_user on public.app_ocultos_pessoas (user_id, rede_id);
