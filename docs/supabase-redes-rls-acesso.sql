-- ============================================================================
-- REDES — leitura conforme o acesso do usuário (multi-rede)
-- ============================================================================
-- Hoje a RLS de `redes` só devolve a rede do próprio usuário (rede_id) pra um
-- não-master, então a tela "Selecionar rede" de um usuário marcado com várias
-- redes / "todas" vem com 1 só. Esta policy (PERMISSIVA, soma com as existentes)
-- libera o usuário a LER as redes que ele tem acesso:
--   is_master = true        -> todas
--   acesso_todas_redes=true -> todas
--   redes.id em redes_permitidas -> essas
--   redes.id = rede_id      -> a dele (legado)
--
-- Só expõe redes a que o usuário tem direito (não vaza chave de rede alheia).
-- Idempotente (drop + create). Depende de docs/supabase-usuario-redes.sql.
-- ============================================================================

drop policy if exists "redes_select_by_access" on public.redes;

create policy "redes_select_by_access" on public.redes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.is_master = true
          or coalesce(p.acesso_todas_redes, false) = true
          or redes.id = any(coalesce(p.redes_permitidas, '{}'::uuid[]))
          or redes.id = p.rede_id
        )
    )
  );
