-- =============================================================================
-- Excluir rede pelo sistema (Painel › Redes › Excluir), sem estourar o tempo e
-- sem deixar sujeira.
--
-- Por que: um único `delete from redes` arrasta centenas de milhares de linhas
-- de apuração em cascata e passa do tempo limite da API (erro, nada apagado).
-- Agora o front chama `excluir_rede_lote` em loop: cada chamada apaga um
-- pedaço pequeno; quando não sobra nada grande, apaga as tabelas sem ligação
-- (acesso_log, cadu_conversas...), tira a rede das permissões dos usuários e
-- apaga a própria rede (o resto, pequeno, vai em cascata).
--
-- Só master. Rodar no SQL Editor do Supabase (projeto do Visor).
-- =============================================================================

-- Prévia: quantas linhas a rede tem no banco e quem ainda trava a exclusão.
create or replace function public.excluir_rede_previa(p_rede uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  n bigint;
  total bigint := 0;
begin
  if not exists (select 1 from profiles where user_id = auth.uid() and is_master) then
    raise exception 'Só a CCI (master) pode excluir rede.';
  end if;
  for t in
    select c.table_name from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'rede_id' and c.table_name not in ('redes', 'profiles')
  loop
    execute format('select count(*) from public.%I where rede_id = $1', t) into n using p_rede;
    total := total + n;
  end loop;
  return jsonb_build_object(
    'linhas', total,
    'usuarios_principal', (select count(*) from profiles where rede_id = p_rede)
  );
end $$;

-- Um lote: apaga até p_lote linhas das tabelas grandes; quando acabar, fecha a
-- exclusão (tabelas sem ligação + permissões + a rede). Retorna
-- { apagadas, terminou }.
create or replace function public.excluir_rede_lote(p_rede uuid, p_lote int default 10000)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  n int;
  apagadas int := 0;
  grandes text[] := array[
    'apuracao_abastecimentos', 'apuracao_formas_pagamento', 'apuracao_vendas',
    'apuracao_vendas_funcionario', 'apuracao_fuel_diaria', 'apuracao_caixas',
    'apuracao_afericoes', 'apuracao_diaria'
  ];
begin
  if not exists (select 1 from profiles where user_id = auth.uid() and is_master) then
    raise exception 'Só a CCI (master) pode excluir rede.';
  end if;
  if not exists (select 1 from redes where id = p_rede) then
    return jsonb_build_object('apagadas', 0, 'terminou', true);
  end if;
  -- Usuário com a rede como principal trava a exclusão (ligação sem cascata):
  -- avisa ANTES de apagar qualquer coisa.
  if exists (select 1 from profiles where rede_id = p_rede) then
    raise exception 'Ainda há % usuário(s) com esta rede como principal. Troque a rede deles em Usuários antes de excluir.',
      (select count(*) from profiles where rede_id = p_rede);
  end if;

  p_lote := greatest(1000, least(coalesce(p_lote, 10000), 50000));

  foreach t in array grandes loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format(
      'delete from public.%I where ctid = any(array(select ctid from public.%I where rede_id = $1 limit $2))', t, t)
      using p_rede, p_lote - apagadas;
    get diagnostics n = row_count;
    apagadas := apagadas + n;
    if apagadas >= p_lote then
      return jsonb_build_object('apagadas', apagadas, 'terminou', false);
    end if;
  end loop;

  -- Fechamento: tabelas com rede_id SEM ligação à rede (não iriam em cascata).
  for t in
    select c.table_name from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'rede_id' and c.table_name not in ('redes', 'profiles')
       and not exists (
         select 1 from pg_constraint k
          where k.contype = 'f' and k.confrelid = 'public.redes'::regclass
            and k.conrelid = ('public.' || quote_ident(c.table_name))::regclass)
  loop
    execute format('delete from public.%I where rede_id = $1', t) using p_rede;
    get diagnostics n = row_count;
    apagadas := apagadas + n;
  end loop;

  -- frentistas aponta para a rede SEM cascata: travaria o delete final.
  delete from frentistas where rede_id = p_rede;
  get diagnostics n = row_count;
  apagadas := apagadas + n;

  -- Tira a rede da lista de redes permitidas de quem tinha.
  update profiles set redes_permitidas = array_remove(redes_permitidas, p_rede)
   where p_rede = any(redes_permitidas);

  -- A rede em si; o que sobrou (compras, tarefas, avisos...) vai em cascata.
  delete from redes where id = p_rede;
  return jsonb_build_object('apagadas', apagadas, 'terminou', true);
end $$;

revoke all on function public.excluir_rede_previa(uuid) from public, anon;
revoke all on function public.excluir_rede_lote(uuid, int) from public, anon;
grant execute on function public.excluir_rede_previa(uuid) to authenticated;
grant execute on function public.excluir_rede_lote(uuid, int) to authenticated;
