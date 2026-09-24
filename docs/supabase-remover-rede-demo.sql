-- ============================================================================
-- Remove a antiga "Rede Demonstração" (dados fictícios servidos pela Edge
-- Function mock-quality) e TUDO que ela deixou no banco.
--
-- Localiza a rede pela URL (mock-quality). As tabelas de apuração/gestão têm
-- FK `on delete cascade` pra redes → somem junto com a rede. Este bloco cuida
-- do que NÃO cascateia: acesso_log, cadu_conversas (rede_id text), vínculos em
-- profiles (rede_id / redes_permitidas) e frentistas.
--
-- IRREVERSÍVEL. Rode UMA vez no SQL Editor do projeto Visor360.
-- Depois, apague a função no painel do Supabase (Edge Functions → mock-quality)
-- ou via CLI: `supabase functions delete mock-quality`.
-- ============================================================================

do $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.redes
  where api_base_url ilike '%mock-quality%'
  limit 1;

  if v_id is null then
    raise notice 'Rede de demonstração (mock-quality) não encontrada — nada a fazer.';
    return;
  end if;

  raise notice 'Removendo rede % ...', v_id;

  -- Sem FK/cascade:
  delete from public.acesso_log where rede_id = v_id;
  delete from public.cadu_conversas where rede_id = v_id::text;

  -- Desvincula usuários que apontavam pra ela (rede "home" e lista de permitidas).
  update public.profiles set rede_id = null where rede_id = v_id;
  begin
    update public.profiles
      set redes_permitidas = array_remove(redes_permitidas, v_id::text)
      where redes_permitidas is not null and v_id::text = any(redes_permitidas);
  exception when others then
    -- coluna pode ser uuid[] em vez de text[]: tenta a outra forma
    begin
      execute 'update public.profiles set redes_permitidas = array_remove(redes_permitidas, $1) where redes_permitidas is not null and $1 = any(redes_permitidas)'
        using v_id;
    exception when others then
      raise notice 'redes_permitidas: não foi possível limpar (%); ajuste manualmente se precisar.', sqlerrm;
    end;
  end;

  -- Frentistas cadastrados nessa rede.
  begin
    delete from public.frentistas where rede_id = v_id;
  exception when others then
    raise notice 'frentistas: % (ignorado)', sqlerrm;
  end;

  -- A rede em si — o cascade leva apuracao_*, gestao_precos_*, concorrencia,
  -- compliance, cartoes, qualidade_arquivados, caixa_snapshots/alteracoes...
  delete from public.redes where id = v_id;

  raise notice 'Rede de demonstração removida.';
end $$;
