-- ============================================================================
-- Notas do NotaOK dentro do Visor (Compras › Notas recebidas) + sino.
--
-- O NotaOK espelha aqui as notas de entrada que AINDA NÃO FORAM LANÇADAS (a
-- conferir, em conferência, devolvidas e conferidas aguardando lançamento),
-- pela porta assinada `notaok-pedidos` (ação notas_espelho). Lançada sai do
-- espelho. O Visor só lê: quem confere e lança continua sendo o NotaOK/ERP.
--
-- Sino (tipo nota_lancar) → supervisor, diretor e quem libera compras:
--   * na hora em que o recebimento conclui a conferência ("aguardando lançamento"),
--     agrupado nas não lidas das últimas 12h ("N notas aguardando lançamento");
--   * todo dia às 8h30: "N notas paradas há mais de 2 dias sem lançamento";
--   * no celular: aviso na hora + entra no resumo da manhã.
--
-- Rodar no SQL Editor do Visor DEPOIS de 20261124000001_notificacoes_historico.sql.
-- Pode rodar de novo.
-- ============================================================================

create table if not exists public.notaok_notas (
  rede_id            uuid not null references public.redes(id) on delete cascade,
  nota_chave         text not null check (nota_chave ~ '^[0-9]{44}$'),
  notaok_nota_id     uuid,
  empresa_codigo     int,
  numero             int,
  serie              int,
  valor              numeric(14,2),
  emissao            date,
  fornecedor_nome    text,
  fornecedor_cnpj    text,
  status             text not null check (status in ('pendente', 'em_preenchimento', 'devolvida', 'enviada')),
  desde              timestamptz,          -- quando entrou na situação atual
  por_nome           text,                 -- quem conferiu (enviada) / quem devolveu (devolvida)
  motivo             text,                 -- motivo da devolução
  observacao         text,                 -- recado do recebimento para o escritório
  sem_pedido         boolean not null default false,
  sem_pedido_motivo  text,
  atualizado_em      timestamptz not null default now(),
  primary key (rede_id, nota_chave)
);
create index if not exists notaok_notas_status_idx on public.notaok_notas (rede_id, status, desde);

alter table public.notaok_notas enable row level security;
revoke all on public.notaok_notas from anon, authenticated;
grant select on public.notaok_notas to authenticated;
drop policy if exists notaok_notas_select on public.notaok_notas;
create policy notaok_notas_select on public.notaok_notas for select to authenticated
  using (rede_id in (select public.redes_legiveis()));

-- ─── Tipo novo no sino, na fila do celular e na configuração da rede ────────
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in ('pedido_aguardando', 'pedido_decidido', 'nota_devolvida', 'tarefa_atribuida', 'nota_lancar', 'teste', 'aviso'));
alter table public.notificacao_fila drop constraint if exists notificacao_fila_tipo_check;
alter table public.notificacao_fila add constraint notificacao_fila_tipo_check
  check (tipo in ('pedido_aguardando', 'pedido_decidido', 'nota_devolvida', 'tarefa_atribuida', 'nota_lancar'));
alter table public.notificacao_config add column if not exists nota_lancar boolean not null default true;

-- Quem recebe "nota aguardando lançamento": diretor, supervisor e quem libera compras.
create or replace function public.app_notif_lancar(p public.profiles) returns boolean
language sql stable set search_path = public as $$
  select p.is_master or p.pode_liberar_compras or p.role = 'supervisor'
$$;
revoke execute on function public.app_notif_lancar(public.profiles) from public, anon, authenticated;

-- ─── Histórico (sino): + nota_lancar, agrupada como pedido_aguardando ───────
create or replace function public.app_notif_historico(
  p_rede uuid, p_tipo text, p_ref uuid, p_empresa int, p_alvo uuid, p_autor uuid,
  p_titulo text, p_texto text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tipo in ('pedido_aguardando', 'nota_lancar') then
    -- Agrupa na não lida das últimas 12h da mesma rede, se houver.
    with alvo as (
      select p.user_id from profiles p
       where app_notif_ve(p, p_rede, p_empresa) and p.user_id is distinct from p_autor
         and case p_tipo when 'pedido_aguardando' then (p.is_master or p.pode_liberar_compras) else app_notif_lancar(p) end
    ), somadas as (
      update notificacoes h
         set qtd = h.qtd + 1,
             titulo = (h.qtd + 1) || case p_tipo when 'pedido_aguardando' then ' pedidos aguardando sua liberação'
                                                 else ' notas aguardando lançamento' end,
             texto = 'A mais recente: ' || p_texto,
             url = p_url, ref_id = p_ref, criada_em = now()
        from alvo a
       where h.user_id = a.user_id and h.tipo = p_tipo and h.rede_id = p_rede
         and h.lida_em is null and h.criada_em > now() - interval '12 hours'
         and h.titulo not like '%paradas%'
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

-- ─── Gatilho: nota conferida → sino + celular ───────────────────────────────
-- Só avisa o que acabou de acontecer (até 1 dia): a primeira carga do espelho
-- não dispara aviso de nota antiga.
create or replace function public.tg_notaok_nota_notificacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'enviada' and (tg_op = 'INSERT' or old.status is distinct from 'enviada')
     and coalesce(new.desde, now()) > now() - interval '1 day' then
    perform app_notif_historico(new.rede_id, 'nota_lancar', null, new.empresa_codigo, null, null,
      'Nota aguardando lançamento',
      concat_ws(' · ', 'NF ' || new.numero, nullif(trim(new.fornecedor_nome), ''), app_brl(new.valor)),
      '/compras?tab=notas');
    if exists (select 1 from push_inscricoes) then
      insert into notificacao_fila (rede_id, tipo, ref_id, empresa_codigo, dados)
      values (new.rede_id, 'nota_lancar', gen_random_uuid(), new.empresa_codigo,
              jsonb_build_object('nota', new.numero, 'fornecedor', new.fornecedor_nome, 'valor', new.valor));
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_notaok_nota_notificacao on public.notaok_notas;
create trigger trg_notaok_nota_notificacao after insert or update of status on public.notaok_notas
  for each row execute function public.tg_notaok_nota_notificacao();

-- ─── Lembrete diário: conferidas há mais de 2 dias sem lançamento ──────────
create or replace function public.notaok_lembrar_paradas() returns void
language sql security definer set search_path = public as $$
  -- Uma por pessoa e rede, contando só as notas dos postos que ela enxerga.
  insert into notificacoes (user_id, rede_id, tipo, titulo, texto, url)
  select p.user_id, n.rede_id, 'nota_lancar',
         case when count(*) = 1 then '1 nota parada há mais de 2 dias sem lançamento'
              else count(*) || ' notas paradas há mais de 2 dias sem lançamento' end,
         concat_ws(' · ', app_brl(sum(n.valor)), 'conferidas no NotaOK, falta lançar no ERP'),
         '/compras?tab=notas'
    from notaok_notas n
    join profiles p on app_notif_ve(p, n.rede_id, n.empresa_codigo) and app_notif_lancar(p)
   where n.status = 'enviada' and n.desde < now() - interval '2 days'
   group by p.user_id, n.rede_id;
$$;
revoke execute on function public.notaok_lembrar_paradas() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'visor-notas-paradas';
select cron.schedule('visor-notas-paradas', '30 11 * * *', $$select public.notaok_lembrar_paradas()$$);

-- ─── Configuração da rede: + nota_lancar (parâmetro opcional) ───────────────
drop function if exists public.notificacao_config_salvar(uuid, boolean, int[], time, time, boolean, boolean, boolean, boolean, boolean);
create or replace function public.notificacao_config_salvar(
  p_rede uuid, p_ativo boolean, p_dias int[], p_inicio time, p_fim time,
  p_aguardando boolean, p_decidido boolean, p_devolvida boolean, p_tarefa boolean, p_lembrete boolean,
  p_lancar boolean default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles p where p.user_id = auth.uid()
                  and (p.is_master or (p.role = 'supervisor' and app_notif_ve(p, p_rede, null)))) then
    raise exception 'Só supervisor ou diretor muda as notificações da rede.';
  end if;
  if p_dias is null or cardinality(p_dias) = 0 then raise exception 'Escolha pelo menos um dia da semana.'; end if;
  if not (p_dias <@ '{1,2,3,4,5,6,7}'::int[]) then raise exception 'Dia da semana inválido.'; end if;
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then raise exception 'O horário final precisa ser depois do inicial.'; end if;
  insert into notificacao_config (rede_id, ativo, dias, hora_inicio, hora_fim, pedido_aguardando, pedido_decidido,
                                  nota_devolvida, tarefa_atribuida, lembrete, nota_lancar, atualizada_em, atualizada_por)
  values (p_rede, coalesce(p_ativo, true), (select array_agg(distinct d order by d) from unnest(p_dias) d), p_inicio, p_fim,
          coalesce(p_aguardando, true), coalesce(p_decidido, true), coalesce(p_devolvida, true),
          coalesce(p_tarefa, true), coalesce(p_lembrete, true), coalesce(p_lancar, true), now(), auth.uid())
  on conflict (rede_id) do update set
    ativo = excluded.ativo, dias = excluded.dias, hora_inicio = excluded.hora_inicio, hora_fim = excluded.hora_fim,
    pedido_aguardando = excluded.pedido_aguardando, pedido_decidido = excluded.pedido_decidido,
    nota_devolvida = excluded.nota_devolvida, tarefa_atribuida = excluded.tarefa_atribuida,
    lembrete = excluded.lembrete,
    nota_lancar = coalesce(p_lancar, notificacao_config.nota_lancar),
    atualizada_em = now(), atualizada_por = auth.uid();
end $$;
revoke execute on function public.notificacao_config_salvar(uuid, boolean, int[], time, time, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.notificacao_config_salvar(uuid, boolean, int[], time, time, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- ─── Envio ao celular: + nota_lancar e "notas a lançar" no resumo da manhã ──
create or replace function public.notificacao_preparar()
returns table (user_id uuid, tipo text, qtd int, itens jsonb, resumo jsonb)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_ids bigint[];
begin
  select array_agg(f.id) into v_ids
    from (select id from notificacao_fila where processada_em is null order by id limit 2000 for update skip locked) f;

  if v_ids is not null then
    return query
    with itens as (
      select f.*, c.rede_id is not null and app_notif_na_janela(c)
                  and case f.tipo when 'pedido_aguardando' then c.pedido_aguardando when 'pedido_decidido' then c.pedido_decidido
                                  when 'nota_devolvida' then c.nota_devolvida when 'tarefa_atribuida' then c.tarefa_atribuida
                                  when 'nota_lancar' then c.nota_lancar
                                  else false end as vale
        from notificacao_fila f
        left join notificacao_config c on c.rede_id = f.rede_id
       where f.id = any(v_ids)
    ), destinos as (
      select p.user_id, i.tipo, i.ref_id, i.dados, i.id as fila_id
        from itens i
        join profiles p on app_notif_ve(p, i.rede_id, i.empresa_codigo)
       where i.vale
         and p.user_id is distinct from i.autor
         and case i.tipo
               when 'pedido_aguardando' then (p.is_master or p.pode_liberar_compras)
               when 'nota_devolvida'    then p.user_id = i.alvo or p.is_master or p.pode_liberar_compras
               when 'nota_lancar'       then app_notif_lancar(p)
               else p.user_id = i.alvo
             end
         and exists (select 1 from push_inscricoes s where s.user_id = p.user_id)
         and not exists (select 1 from notificacao_pref np where np.user_id = p.user_id and i.tipo = any(np.desligados))
    ), unicos as (
      select distinct on (d.user_id, d.tipo, d.ref_id) d.user_id, d.tipo, d.ref_id, d.dados, d.fila_id
        from destinos d order by d.user_id, d.tipo, d.ref_id, d.fila_id desc
    )
    select u.user_id, u.tipo, count(*)::int,
           jsonb_agg(u.dados || jsonb_build_object('id', u.ref_id) order by u.fila_id desc),
           null::jsonb
      from unicos u
     group by u.user_id, u.tipo;

    update notificacao_fila set processada_em = now() where id = any(v_ids);
  end if;

  -- Resumo do dia: redes com lembrete ligado, dentro da janela e sem resumo hoje.
  return query
  with abertas as (
    update notificacao_config c
       set ultimo_lembrete = (now() at time zone c.fuso)::date
     where c.lembrete and app_notif_na_janela(c)
       and (c.ultimo_lembrete is null or c.ultimo_lembrete < (now() at time zone c.fuso)::date)
    returning c.rede_id
  ), pessoas as (
    select distinct p.user_id, p.is_master, p.pode_liberar_compras, app_notif_lancar(p) as lanca, a.rede_id, p.empresa_codigos
      from abertas a
      join profiles p on app_notif_ve(p, a.rede_id, null)
     where exists (select 1 from push_inscricoes s where s.user_id = p.user_id)
       and not exists (select 1 from notificacao_pref np where np.user_id = p.user_id and 'lembrete' = any(np.desligados))
  ), contas as (
    select x.user_id,
      sum((select count(*) from compras_pedidos cp
            where cp.rede_id = x.rede_id and cp.status = 'aguardando' and (x.is_master or x.pode_liberar_compras)
              and (x.is_master or x.empresa_codigos is null or cardinality(x.empresa_codigos) = 0 or cp.empresa_codigo = any(x.empresa_codigos))))::int as a_liberar,
      sum((select count(*) from compras_pedidos cp
            where cp.rede_id = x.rede_id and cp.solicitante_id = x.user_id
              and exists (select 1 from compras_pedido_notas n where n.pedido_id = cp.id and n.situacao = 'devolvida')))::int as notas_devolvidas,
      sum((select count(*) from notaok_notas nn
            where nn.rede_id = x.rede_id and nn.status = 'enviada' and nn.desde < now() - interval '2 days' and x.lanca
              and (x.is_master or x.empresa_codigos is null or cardinality(x.empresa_codigos) = 0 or nn.empresa_codigo = any(x.empresa_codigos))))::int as notas_lancar,
      sum((select count(*) from gestao_tarefas t
            where t.rede_id = x.rede_id and t.responsavel_id = x.user_id and t.status in ('a_fazer', 'em_andamento')
              and t.vence_em < now()))::int as atrasadas,
      sum((select count(*) from gestao_tarefas t
            where t.rede_id = x.rede_id and t.responsavel_id = x.user_id and t.status in ('a_fazer', 'em_andamento')
              and t.vence_em >= now() and t.vence_dia = (now() at time zone 'America/Sao_Paulo')::date))::int as vencem_hoje
      from pessoas x
     group by x.user_id
  )
  select c.user_id, 'lembrete'::text, 0, null::jsonb,
         jsonb_build_object('a_liberar', c.a_liberar, 'notas_devolvidas', c.notas_devolvidas, 'notas_lancar', c.notas_lancar,
                            'atrasadas', c.atrasadas, 'vencem_hoje', c.vencem_hoje)
    from contas c
   where (c.a_liberar + c.notas_devolvidas + c.notas_lancar + c.atrasadas + c.vencem_hoje) > 0;

  delete from notificacao_fila where processada_em < now() - interval '7 days';
end $$;
revoke execute on function public.notificacao_preparar() from public, anon, authenticated;
grant execute on function public.notificacao_preparar() to service_role;
