-- ============================================================================
-- Histórico de notificações do Visor360 (o sino do topo) — mesmo modelo do NotaOK.
--
-- Cada pessoa vê os avisos dela, lidos e não lidos, com "Marcar todas"; o lido
-- vale entre aparelhos. Gravado NA HORA do evento para todos que recebem aquele
-- tipo — independe de ter o celular inscrito e da janela de envio (essas regras
-- continuam valendo só para o push, via notificacao_fila).
--
--   pedido_aguardando → quem libera   "N pedidos aguardando sua liberação" (agrupa as não lidas das últimas 12h)
--   pedido_decidido   → quem pediu    uma por pedido (liberado / em parte / recusado + motivo)
--   nota_devolvida    → quem pediu + quem libera   uma por nota, com o motivo
--   tarefa_atribuida  → o responsável uma por tarefa
--
-- Rodar no SQL Editor do Visor DEPOIS de docs/supabase-notificacoes.sql.
-- Pode rodar de novo.
-- ============================================================================

create table if not exists public.notificacoes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rede_id    uuid references public.redes(id) on delete cascade,
  tipo       text not null check (tipo in ('pedido_aguardando', 'pedido_decidido', 'nota_devolvida', 'tarefa_atribuida', 'teste', 'aviso')),
  titulo     text not null,
  texto      text,
  url        text,
  qtd        int not null default 1,
  ref_id     uuid,
  criada_em  timestamptz not null default now(),
  lida_em    timestamptz
);
create index if not exists notificacoes_user_idx on public.notificacoes (user_id, criada_em desc);
create index if not exists notificacoes_nao_lidas_idx on public.notificacoes (user_id, tipo, rede_id) where lida_em is null;

alter table public.notificacoes enable row level security;
drop policy if exists notificacoes_ler on public.notificacoes;
create policy notificacoes_ler on public.notificacoes for select to authenticated using (user_id = auth.uid());
revoke all on public.notificacoes from anon, authenticated;
grant select on public.notificacoes to authenticated;

-- ─── Marcar como lida ────────────────────────────────────────────────────────
create or replace function public.notificacoes_marcar_lida(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update notificacoes set lida_em = now() where id = p_id and user_id = auth.uid() and lida_em is null;
$$;
-- p_rede: só as da rede aberta (os diretores da CCI veem várias redes); null = todas.
create or replace function public.notificacoes_marcar_todas(p_rede uuid default null)
returns void language sql security definer set search_path = public as $$
  update notificacoes set lida_em = now()
   where user_id = auth.uid() and lida_em is null and (p_rede is null or rede_id = p_rede or rede_id is null);
$$;
revoke execute on function public.notificacoes_marcar_lida(bigint) from public, anon;
revoke execute on function public.notificacoes_marcar_todas(uuid) from public, anon;
grant execute on function public.notificacoes_marcar_lida(bigint) to authenticated;
grant execute on function public.notificacoes_marcar_todas(uuid) to authenticated;

-- ─── Gravar no histórico ─────────────────────────────────────────────────────
-- Destinatários = as mesmas regras do push (notificacao_preparar), sem exigir
-- aparelho inscrito nem janela.
create or replace function public.app_notif_historico(
  p_rede uuid, p_tipo text, p_ref uuid, p_empresa int, p_alvo uuid, p_autor uuid,
  p_titulo text, p_texto text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tipo = 'pedido_aguardando' then
    -- Agrupa na não lida das últimas 12h da mesma rede, se houver.
    with alvo as (
      select p.user_id from profiles p
       where app_notif_ve(p, p_rede, p_empresa) and p.user_id is distinct from p_autor
         and (p.is_master or p.pode_liberar_compras)
    ), somadas as (
      update notificacoes h
         set qtd = h.qtd + 1,
             titulo = (h.qtd + 1) || ' pedidos aguardando sua liberação',
             texto = 'O mais recente: ' || p_texto,
             url = p_url, ref_id = p_ref, criada_em = now()
        from alvo a
       where h.user_id = a.user_id and h.tipo = 'pedido_aguardando' and h.rede_id = p_rede
         and h.lida_em is null and h.criada_em > now() - interval '12 hours'
      returning h.user_id
    )
    insert into notificacoes (user_id, rede_id, tipo, titulo, texto, url, ref_id)
    select a.user_id, p_rede, p_tipo, p_titulo, p_texto, p_url, p_ref
      from alvo a where a.user_id not in (select user_id from somadas);
    return;
  end if;

  insert into notificacoes (user_id, rede_id, tipo, titulo, texto, url, ref_id)
  select p.user_id, p_rede, p_tipo, p_titulo, p_texto, p_url, p_ref
    from profiles p
   where app_notif_ve(p, p_rede, p_empresa)
     and p.user_id is distinct from p_autor
     and case p_tipo
           when 'nota_devolvida' then p.user_id = p_alvo or p.is_master or p.pode_liberar_compras
           else p.user_id = p_alvo
         end;
end $$;
revoke execute on function public.app_notif_historico(uuid, text, uuid, int, uuid, uuid, text, text, text) from public, anon, authenticated;

create or replace function public.app_brl(v numeric) returns text
language sql immutable as $$
  select case when v is null then null else 'R$ ' || replace(to_char(round(v), 'FM999G999G999'), ',', '.') end
$$;

-- ─── Gatilhos: histórico SEMPRE; fila do push só se há aparelho inscrito ─────
create or replace function public.tg_pedido_notificacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dados jsonb; v_desc text; v_tipo text; v_titulo text; v_texto text; v_autor uuid;
begin
  v_dados := jsonb_build_object('numero', new.numero, 'fornecedor', new.fornecedor_nome, 'status', new.status,
                                'valor', coalesce(new.total_liberado, new.total_solicitado), 'motivo', new.motivo_recusa);
  v_desc := concat_ws(' · ', 'Pedido nº ' || new.numero, nullif(trim(new.fornecedor_nome), ''));

  if new.status = 'aguardando' and (tg_op = 'INSERT' or old.status is distinct from 'aguardando') then
    v_autor := coalesce(auth.uid(), new.solicitante_id);
    perform app_notif_historico(new.rede_id, 'pedido_aguardando', new.id, new.empresa_codigo, null, v_autor,
      'Pedido aguardando sua liberação', concat_ws(' · ', v_desc, app_brl(new.total_solicitado)), '/compras');
    if exists (select 1 from push_inscricoes) then
      insert into notificacao_fila (rede_id, tipo, ref_id, empresa_codigo, autor, dados)
      values (new.rede_id, 'pedido_aguardando', new.id, new.empresa_codigo, v_autor, v_dados);
    end if;

  elsif tg_op = 'UPDATE' and old.status = 'aguardando' and new.status in ('liberado', 'liberado_parcial', 'recusado')
        and new.solicitante_id is not null then
    v_titulo := case new.status when 'recusado' then 'Pedido nº ' || new.numero || ' recusado'
                                when 'liberado_parcial' then 'Pedido nº ' || new.numero || ' liberado em parte'
                                else 'Pedido nº ' || new.numero || ' liberado' end;
    v_texto := case when new.status = 'recusado'
                    then concat_ws(' · ', nullif(trim(new.fornecedor_nome), ''), coalesce(nullif(trim(new.motivo_recusa), ''), 'sem motivo informado'))
                    else concat_ws(' · ', nullif(trim(new.fornecedor_nome), ''), app_brl(coalesce(new.total_liberado, new.total_solicitado))) end;
    perform app_notif_historico(new.rede_id, 'pedido_decidido', new.id, new.empresa_codigo, new.solicitante_id, auth.uid(),
      v_titulo, v_texto, '/compras');
    if exists (select 1 from push_inscricoes) then
      insert into notificacao_fila (rede_id, tipo, ref_id, empresa_codigo, alvo, autor, dados)
      values (new.rede_id, 'pedido_decidido', new.id, new.empresa_codigo, new.solicitante_id, auth.uid(), v_dados);
    end if;
  end if;
  return null;
end $$;

-- Nota do pedido devolvida pelo escritório no NotaOK (escrita pela Edge, sem usuário).
create or replace function public.tg_pedido_nota_notificacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; v_motivo text;
begin
  if new.situacao = 'devolvida' and (tg_op = 'INSERT' or old.situacao is distinct from 'devolvida') then
    select id, numero, fornecedor_nome, empresa_codigo, solicitante_id into p from compras_pedidos where id = new.pedido_id;
    if p.id is not null then
      v_motivo := coalesce(
        nullif(trim(new.devolucao->>'geral'), ''),
        nullif(trim(new.devolucao->>'nf'), ''),
        nullif(trim(new.devolucao->>'boleto'), ''),
        nullif(trim(new.devolucao->'itens'->0->>'motivo'), ''),
        'veja os pontos apontados no pedido');
      perform app_notif_historico(new.rede_id, 'nota_devolvida', p.id, p.empresa_codigo, p.solicitante_id, null,
        'Nota devolvida para correção',
        concat_ws(' · ', 'Pedido nº ' || p.numero, 'NF ' || new.nota_numero, nullif(trim(p.fornecedor_nome), '')) || ': ' || v_motivo,
        '/compras');
      if exists (select 1 from push_inscricoes) then
        insert into notificacao_fila (rede_id, tipo, ref_id, empresa_codigo, alvo, dados)
        values (new.rede_id, 'nota_devolvida', p.id, p.empresa_codigo, p.solicitante_id,
                jsonb_build_object('numero', p.numero, 'fornecedor', p.fornecedor_nome, 'nota', new.nota_numero));
      end if;
    end if;
  end if;
  return null;
end $$;

-- Tarefa AVULSA que passou a ser de alguém (as de rotina entram só no resumo da manhã).
create or replace function public.tg_tarefa_notificacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.responsavel_id is not null and new.rotina_id is null and new.status in ('a_fazer', 'em_andamento')
     and (tg_op = 'INSERT' or old.responsavel_id is distinct from new.responsavel_id) then
    perform app_notif_historico(new.rede_id, 'tarefa_atribuida', new.id, new.empresa_codigo, new.responsavel_id, auth.uid(),
      'Nova tarefa para você',
      new.titulo || coalesce(' · vence ' || to_char(new.vence_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), ''),
      '/gestao?tab=tarefas');
    if exists (select 1 from push_inscricoes) then
      insert into notificacao_fila (rede_id, tipo, ref_id, empresa_codigo, alvo, autor, dados)
      values (new.rede_id, 'tarefa_atribuida', new.id, new.empresa_codigo, new.responsavel_id, auth.uid(),
              jsonb_build_object('titulo', new.titulo, 'vence_em', new.vence_em));
    end if;
  end if;
  return null;
end $$;

-- ─── Tempo real: o sino atualiza sozinho quando chega aviso ──────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificacoes') then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end $$;

-- ─── Limpeza diária: lidas há mais de 30 dias e qualquer uma com mais de 90 ──
select cron.unschedule(jobid) from cron.job where jobname = 'visor-notificacoes-limpeza';
select cron.schedule('visor-notificacoes-limpeza', '15 4 * * *', $$
  delete from public.notificacoes
   where (lida_em is not null and lida_em < now() - interval '30 days')
      or criada_em < now() - interval '90 days'
$$);
