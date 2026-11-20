-- ============================================================================
-- Meus chamados + cancelamento + status vindo da Central CCI (Visor360).
-- Mesmo modelo do NotaOK (supabase/migrations/20261120000009_meus_chamados.sql).
--
--  - Quem pode abrir chamado (pode_abrir_chamados(): diretor ou chave ligada)
--    VÊ os próprios chamados (tela "Meus chamados"). Diretores continuam vendo
--    todos (Painel › Chamados).
--  - Status e resposta passam a ser da Central CCI: o Visor só espelha o que a
--    Central informa (Edge Function chamados-central → consultar-chamados).
--  - O autor (ou um diretor) pode CANCELAR o chamado, com motivo obrigatório.
--    O cancelamento é avisado à Central (cancelar-chamado).
--
-- Depende de supabase-chamados.sql, -acesso.sql e -central.sql.
-- Rodar no SQL Editor DO VISOR. Pode rodar mais de uma vez.
-- ============================================================================

alter table public.chamados drop constraint if exists chamados_status_check;
alter table public.chamados add constraint chamados_status_check
  check (status in ('novo', 'analise', 'resolvido', 'descartado', 'cancelado'));

alter table public.chamados add column if not exists cancelado_motivo text;
alter table public.chamados add column if not exists cancelado_em timestamptz;
alter table public.chamados add column if not exists cancelado_por uuid references auth.users(id) on delete set null;
alter table public.chamados add column if not exists central_cancelado_em timestamptz;     -- a Central confirmou o cancelamento
alter table public.chamados add column if not exists resolvido_por_nome text;              -- vem da Central
alter table public.chamados add column if not exists central_sincronizado_em timestamptz;  -- última leitura do status na Central

alter table public.chamados drop constraint if exists chamados_cancelado_motivo_tam;
alter table public.chamados add constraint chamados_cancelado_motivo_tam
  check (cancelado_motivo is null or char_length(cancelado_motivo) <= 500);

-- O autor (com a permissão) vê os próprios chamados.
drop policy if exists chamados_meus on public.chamados;
create policy chamados_meus on public.chamados for select to authenticated
  using (autor_id = auth.uid() and public.pode_abrir_chamados());

-- Cancelar: o autor (com a permissão) ou um diretor; motivo obrigatório.
create or replace function public.chamado_cancelar(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor uuid;
  v_status text;
  v_master boolean := coalesce((select p.is_master from public.profiles p where p.user_id = auth.uid()), false);
begin
  select autor_id, status into v_autor, v_status from public.chamados where id = p_id;
  if not found then raise exception 'Chamado não encontrado.'; end if;
  if not (v_master or (v_autor = auth.uid() and public.pode_abrir_chamados())) then
    raise exception 'Só quem abriu o chamado pode cancelar.';
  end if;
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escreva o motivo do cancelamento.';
  end if;
  if v_status in ('resolvido', 'descartado', 'cancelado') then
    raise exception 'Este chamado já foi encerrado.';
  end if;
  update public.chamados
     set status = 'cancelado', cancelado_motivo = trim(p_motivo), cancelado_em = now(),
         cancelado_por = auth.uid(), atualizado_em = now()
   where id = p_id;
end;
$$;

revoke execute on function public.chamado_cancelar(uuid, text) from public, anon;
grant execute on function public.chamado_cancelar(uuid, text) to authenticated;
