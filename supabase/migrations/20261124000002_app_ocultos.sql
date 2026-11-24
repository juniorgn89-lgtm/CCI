-- ============================================================================
-- Ocultar módulos e abas (Painel › Parâmetros › Ocultar módulos e abas).
--
-- A CCI esconde do menu e das abas o que não é tão necessário agora — em
-- TODAS as redes ou só nas redes escolhidas. Nada é apagado: mostrar de novo
-- é tirar a linha. Vale para todo mundo da rede (inclusive diretores da CCI,
-- que assim veem o app como o cliente vê; a tela de ocultar lista tudo sempre).
--
--   chave = rota do módulo ('/financeiro') ou módulo::aba ('/financeiro::cartoes')
--   redes = null → todas as redes; senão só as redes da lista
--
-- Rodar no SQL Editor do Visor. Pode rodar de novo.
-- ============================================================================

create table if not exists public.app_ocultos (
  chave          text primary key check (chave ~ '^/[a-z0-9/_-]+(::[a-zA-Z0-9_-]+)?$'),
  redes          uuid[],
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null,
  check (redes is null or cardinality(redes) > 0)
);

alter table public.app_ocultos enable row level security;
revoke all on public.app_ocultos from anon, authenticated;
grant select, insert, update, delete on public.app_ocultos to authenticated;

-- Todo usuário logado lê (é o que decide o menu dele).
drop policy if exists app_ocultos_ler on public.app_ocultos;
create policy app_ocultos_ler on public.app_ocultos for select to authenticated using (true);

-- Só a CCI (master) grava.
drop policy if exists app_ocultos_master on public.app_ocultos;
create policy app_ocultos_master on public.app_ocultos for all to authenticated
  using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_master))
  with check (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_master));

-- Rede excluída sai das listas (lista vazia = linha apagada, para não virar "todas").
create or replace function public.tg_rede_tira_de_ocultos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from app_ocultos where redes = array[old.id];
  update app_ocultos set redes = array_remove(redes, old.id) where old.id = any(redes);
  return old;
end $$;
drop trigger if exists trg_rede_tira_de_ocultos on public.redes;
create trigger trg_rede_tira_de_ocultos before delete on public.redes
  for each row execute function public.tg_rede_tira_de_ocultos();
