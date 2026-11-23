-- Compras: "Desfazer liberação" e "Desfazer recebimento" (com motivo), só supervisor e acima.
-- Rodar no SQL Editor do Visor DEPOIS de docs/supabase-compras-notas-devolucao.sql. Pode rodar de novo.

-- 1. Histórico ganha os tipos 'liberacao_desfeita' e 'recebimento_desfeito'.
alter table public.compras_eventos drop constraint if exists compras_eventos_tipo_check;
alter table public.compras_eventos add constraint compras_eventos_tipo_check
  check (tipo in ('criado', 'editado', 'enviado', 'liberado', 'liberado_parcial', 'recusado', 'recebido', 'cancelado', 'reaberto', 'comentario',
                  'nota_vinculada', 'nota_desvinculada', 'recebimento_encerrado', 'nota_devolvida',
                  'liberacao_desfeita', 'recebimento_desfeito'));

-- 2. Supervisor e acima (diretor = is_master) que também libera compras.
create or replace function public.pode_desfazer_compras()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_master or (p.role = 'supervisor' and p.pode_liberar_compras) from public.profiles p where p.user_id = auth.uid()),
    false
  )
$$;
revoke execute on function public.pode_desfazer_compras() from public, anon;
grant execute on function public.pode_desfazer_compras() to authenticated;

-- 3. Trava no banco: voltar o pedido para trás (liberado → aguardando, recebido → liberado)
--    só com pode_desfazer_compras(). Escritas sem usuário (Edge Function do NotaOK,
--    service role: auth.uid() nulo) seguem livres: são o NotaOK tirando uma nota.
create or replace function public.compras_trava_desfazer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (old.status in ('liberado', 'liberado_parcial') and new.status in ('aguardando', 'rascunho'))
     or (old.status = 'recebido' and new.status in ('liberado', 'liberado_parcial', 'aguardando', 'rascunho')) then
    if not public.pode_desfazer_compras() then
      raise exception 'Só supervisor (ou diretor) que libera compras pode desfazer liberação ou recebimento.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists compras_trava_desfazer on public.compras_pedidos;
create trigger compras_trava_desfazer before update of status on public.compras_pedidos
  for each row execute function public.compras_trava_desfazer();
