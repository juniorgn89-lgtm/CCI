-- RLS de leitura dos caches de apuração: de "função por linha" para "conjunto
-- avaliado uma vez" (28/09/2026).
--
-- PROBLEMA: as políticas SELECT das tabelas apuracao_* usavam
-- `user_can_read_rede(rede_id)`. Como o argumento é a coluna, o Postgres chama a
-- função pra CADA linha varrida (~125 µs por chamada: 3 subconsultas em profiles/
-- frentistas, sem inlining por ser SECURITY DEFINER). A view
-- apuracao_vendas_setor_diaria agrega ~115 mil linhas base num histórico de 6 meses
-- → 5,7 s na 1ª página e estouro do statement_timeout (8 s) nas seguintes. O app
-- recebia o histórico vazio e a projeção sazonal caía silenciosamente no modo
-- linear (a diferença que o usuário viu na Central em 28/09).
--
-- SOLUÇÃO: uma função SEM argumentos que devolve o conjunto de redes legíveis do
-- usuário logado, usada nas políticas como `rede_id in (select ...)`. Subconsulta
-- sem referência à linha vira um SubPlan hasheado: roda UMA vez por instrução e o
-- custo por linha cai pra um lookup em hash. Mesmas regras de acesso de
-- user_can_read_rede (master, acesso_todas_redes, própria rede, redes_permitidas,
-- frentista) — nada muda em quem vê o quê, só o custo.
--
-- Como aplicar: Supabase › SQL Editor › colar e rodar (idempotente). Reverter =
-- recriar as políticas com `using (public.user_can_read_rede(rede_id))`.

create or replace function public.redes_legiveis()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- Master / acesso a todas: todas as redes cadastradas.
  select r.id
  from public.redes r
  where exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.is_master = true or p.acesso_todas_redes = true)
  )
  union
  -- Rede própria + redes permitidas do perfil.
  select p.rede_id from public.profiles p
  where p.user_id = auth.uid() and p.rede_id is not null
  union
  select unnest(coalesce(p.redes_permitidas, '{}'::uuid[])) from public.profiles p
  where p.user_id = auth.uid()
  union
  -- Frentista: a rede do vínculo.
  select f.rede_id from public.frentistas f
  where f.user_id = auth.uid() and f.rede_id is not null;
$$;

revoke all on function public.redes_legiveis() from public;
grant execute on function public.redes_legiveis() to authenticated, service_role;

-- Políticas SELECT (mesmos nomes de antes, só o predicado muda).
drop policy if exists "apuracao_abast read" on public.apuracao_abastecimentos;
create policy "apuracao_abast read" on public.apuracao_abastecimentos
  for select to authenticated using (rede_id in (select public.redes_legiveis()));

drop policy if exists "apuracao_afer read" on public.apuracao_afericoes;
create policy "apuracao_afer read" on public.apuracao_afericoes
  for select to authenticated using (rede_id in (select public.redes_legiveis()));

drop policy if exists "apuracao_caixas read" on public.apuracao_caixas;
create policy "apuracao_caixas read" on public.apuracao_caixas
  for select to authenticated using (rede_id in (select public.redes_legiveis()));

drop policy if exists "apuracao_diaria read" on public.apuracao_diaria;
create policy "apuracao_diaria read" on public.apuracao_diaria
  for select to authenticated using (rede_id in (select public.redes_legiveis()));

drop policy if exists "apuracao_formas read" on public.apuracao_formas_pagamento;
create policy "apuracao_formas read" on public.apuracao_formas_pagamento
  for select to authenticated using (rede_id in (select public.redes_legiveis()));

drop policy if exists "apuracao_fuel_diaria read" on public.apuracao_fuel_diaria;
create policy "apuracao_fuel_diaria read" on public.apuracao_fuel_diaria
  for select to authenticated using (rede_id in (select public.redes_legiveis()));

drop policy if exists "vendas_select_own_rede" on public.apuracao_vendas;
create policy "vendas_select_own_rede" on public.apuracao_vendas
  for select to authenticated using (rede_id in (select public.redes_legiveis()));

drop policy if exists "vendas_func_select_own_rede" on public.apuracao_vendas_funcionario;
create policy "vendas_func_select_own_rede" on public.apuracao_vendas_funcionario
  for select to authenticated using (rede_id in (select public.redes_legiveis()));

-- Conferência (opcional): deve listar 8 políticas com "redes_legiveis" no qual.
-- select tablename, policyname from pg_policies where qual like '%redes_legiveis%';
