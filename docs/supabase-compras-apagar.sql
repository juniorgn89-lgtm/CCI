-- ============================================================================
-- Compras · apagar registros (pedidos e transferências) de qualquer situação
--
-- Para limpar TESTES. Não é permissão de rede: é um flag por usuário,
-- ligado à mão só para quem administra a plataforma (18/10/2026: só
-- contato@cci.app.br). Itens e histórico caem junto (on delete cascade).
-- Idempotente; rode via `supabase db query --linked -f`.
-- ============================================================================

alter table public.profiles add column if not exists pode_apagar_compras boolean not null default false;
comment on column public.profiles.pode_apagar_compras is 'Apaga pedidos/transferências do Compras em qualquer situação (limpeza de testes). Não vem do master: liga à mão.';

create or replace function public.pode_apagar_compras()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.pode_apagar_compras from public.profiles p where p.user_id = auth.uid()), false)
$$;
revoke execute on function public.pode_apagar_compras() from public, anon;
grant execute on function public.pode_apagar_compras() to authenticated;

drop policy if exists compras_pedidos_delete on public.compras_pedidos;
create policy compras_pedidos_delete on public.compras_pedidos for delete to authenticated
  using (rede_id in (select public.redes_legiveis()) and (
    public.pode_apagar_compras()
    or public.pode_liberar_compras()
    or (solicitante_id = auth.uid() and status = 'rascunho')
  ));

drop policy if exists compras_transf_delete on public.compras_transferencias;
create policy compras_transf_delete on public.compras_transferencias for delete to authenticated
  using (rede_id in (select public.redes_legiveis()) and (
    public.pode_apagar_compras()
    or (status = 'rascunho' and (solicitante_id = auth.uid() or public.pode_liberar_compras()))
  ));

update public.profiles set pode_apagar_compras = true
  where user_id = (select id from auth.users where email = 'contato@cci.app.br');
