-- ============================================================================
-- Notificações no celular (Web Push) do Visor360 — mesmo desenho do NotaOK.
--
-- Cada pessoa liga no PRÓPRIO aparelho (Configurações › Notificações); a
-- inscrição do navegador fica em push_inscricoes. Cada pessoa também desliga
-- os tipos que não quer (notificacao_pref).
--
-- Eventos (cada um liga/desliga por rede em notificacao_config):
--   pedido_aguardando  pedido enviado para liberação        → quem libera compras
--   pedido_decidido    pedido liberado / parcial / recusado → quem pediu
--   nota_devolvida     nota do pedido devolvida no NotaOK   → quem pediu + quem libera
--   tarefa_atribuida   tarefa avulsa passou a ser sua       → o responsável
--   lembrete           resumo das pendências de cada um, quando a janela abre no dia
--                      (pedidos a liberar, tarefas que vencem hoje / atrasadas,
--                       pedidos seus com nota devolvida)
--
-- Janela de envio por rede (supervisor ou diretor escolhe): dias e horário.
-- Fora dela NADA é enviado; o que acontecer entra no resumo da abertura.
--
-- A cada minuto o pg_cron chama a Edge Function `notificacoes` (--no-verify-jwt,
-- protegida por x-cron-secret = NOTIFICACOES_CRON_SECRET), que pega a fila já agrupada por pessoa
-- (notificacao_preparar) e envia.
--
-- Rodar no SQL Editor do Visor. Pode rodar mais de uma vez.
-- ANTES de rodar: troque <NOTIFICACOES_CRON_SECRET> (no fim) pelo valor do secret
-- NOTIFICACOES_CRON_SECRET da Edge Function (um segredo só dos avisos; não salve o valor aqui).
-- ============================================================================

-- ─── Aparelhos inscritos ─────────────────────────────────────────────────────
create table if not exists public.push_inscricoes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  aparelho   text check (char_length(aparelho) <= 200),
  criada_em  timestamptz not null default now(),
  usada_em   timestamptz
);
create index if not exists push_inscricoes_user_idx on public.push_inscricoes(user_id);
alter table public.push_inscricoes enable row level security;
revoke all on public.push_inscricoes from anon, authenticated;
grant select on public.push_inscricoes to authenticated;
drop policy if exists push_inscricoes_select on public.push_inscricoes;
create policy push_inscricoes_select on public.push_inscricoes for select to authenticated using (user_id = auth.uid());

create or replace function public.push_inscrever(p_endpoint text, p_p256dh text, p_auth text, p_aparelho text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where user_id = auth.uid() and ativo is not false) then
    raise exception 'Não autenticado';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' then raise exception 'Inscrição inválida'; end if;
  insert into push_inscricoes (user_id, endpoint, p256dh, auth, aparelho)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_aparelho, 200))
  on conflict (endpoint) do update
     set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
         aparelho = excluded.aparelho, criada_em = now();
end $$;
revoke execute on function public.push_inscrever(text, text, text, text) from public, anon;
grant execute on function public.push_inscrever(text, text, text, text) to authenticated;

create or replace function public.push_cancelar(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_inscricoes where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke execute on function public.push_cancelar(text) from public, anon;
grant execute on function public.push_cancelar(text) to authenticated;

-- ─── Preferência de cada pessoa (tipos que ela desligou) ─────────────────────
create table if not exists public.notificacao_pref (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  desligados  text[] not null default '{}',
  atualizada_em timestamptz not null default now()
);
alter table public.notificacao_pref enable row level security;
revoke all on public.notificacao_pref from anon, authenticated;
grant select on public.notificacao_pref to authenticated;
drop policy if exists notificacao_pref_select on public.notificacao_pref;
create policy notificacao_pref_select on public.notificacao_pref for select to authenticated using (user_id = auth.uid());

create or replace function public.notificacao_pref_salvar(p_desligados text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if not (coalesce(p_desligados, '{}') <@ array['pedido_aguardando','pedido_decidido','nota_devolvida','tarefa_atribuida','lembrete']) then
    raise exception 'Tipo de notificação inválido.';
  end if;
  insert into notificacao_pref (user_id, desligados, atualizada_em) values (auth.uid(), coalesce(p_desligados, '{}'), now())
  on conflict (user_id) do update set desligados = excluded.desligados, atualizada_em = now();
end $$;
revoke execute on function public.notificacao_pref_salvar(text[]) from public, anon;
grant execute on function public.notificacao_pref_salvar(text[]) to authenticated;

-- ─── Quem enxerga o quê ──────────────────────────────────────────────────────
-- A pessoa (perfil) vê esta rede e este posto?
create or replace function public.app_notif_ve(p public.profiles, p_rede uuid, p_empresa int) returns boolean
language sql stable set search_path = public as $$
  select p.ativo is not false
     and (p.is_master or p.acesso_todas_redes or p.rede_id = p_rede or p_rede = any(coalesce(p.redes_permitidas, '{}')))
     and (p_empresa is null or p.is_master or p.empresa_codigos is null or cardinality(p.empresa_codigos) = 0
          or p_empresa = any(p.empresa_codigos))
$$;
revoke execute on function public.app_notif_ve(public.profiles, uuid, int) from public, anon, authenticated;

-- ─── Configuração da rede ────────────────────────────────────────────────────
create table if not exists public.notificacao_config (
  rede_id            uuid primary key references public.redes(id) on delete cascade,
  ativo              boolean not null default true,
  dias               int[] not null default '{1,2,3,4,5,6}',   -- 1 = segunda … 7 = domingo
  hora_inicio        time not null default '07:00',
  hora_fim           time not null default '19:00',
  fuso               text not null default 'America/Sao_Paulo',
  pedido_aguardando  boolean not null default true,
  pedido_decidido    boolean not null default true,
  nota_devolvida     boolean not null default true,
  tarefa_atribuida   boolean not null default true,
  lembrete           boolean not null default true,
  ultimo_lembrete    date,
  atualizada_em      timestamptz not null default now(),
  atualizada_por     uuid references auth.users(id) on delete set null,
  check (dias <@ '{1,2,3,4,5,6,7}'::int[]),
  check (hora_fim > hora_inicio)
);
alter table public.notificacao_config enable row level security;
revoke all on public.notificacao_config from anon, authenticated;
grant select on public.notificacao_config to authenticated;
drop policy if exists notificacao_config_select on public.notificacao_config;
create policy notificacao_config_select on public.notificacao_config for select to authenticated
  using (rede_id in (select public.redes_legiveis()));

insert into public.notificacao_config (rede_id) select id from public.redes on conflict do nothing;

create or replace function public.tg_rede_notificacao_config() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notificacao_config (rede_id) values (new.id) on conflict do nothing;
  return null;
end $$;
drop trigger if exists trg_rede_notificacao_config on public.redes;
create trigger trg_rede_notificacao_config after insert on public.redes
  for each row execute function public.tg_rede_notificacao_config();

-- Salvar: diretor, ou supervisor que enxerga a rede.
create or replace function public.notificacao_config_salvar(
  p_rede uuid, p_ativo boolean, p_dias int[], p_inicio time, p_fim time,
  p_aguardando boolean, p_decidido boolean, p_devolvida boolean, p_tarefa boolean, p_lembrete boolean
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
                                  nota_devolvida, tarefa_atribuida, lembrete, atualizada_em, atualizada_por)
  values (p_rede, coalesce(p_ativo, true), (select array_agg(distinct d order by d) from unnest(p_dias) d), p_inicio, p_fim,
          coalesce(p_aguardando, true), coalesce(p_decidido, true), coalesce(p_devolvida, true),
          coalesce(p_tarefa, true), coalesce(p_lembrete, true), now(), auth.uid())
  on conflict (rede_id) do update set
    ativo = excluded.ativo, dias = excluded.dias, hora_inicio = excluded.hora_inicio, hora_fim = excluded.hora_fim,
    pedido_aguardando = excluded.pedido_aguardando, pedido_decidido = excluded.pedido_decidido,
    nota_devolvida = excluded.nota_devolvida, tarefa_atribuida = excluded.tarefa_atribuida,
    lembrete = excluded.lembrete, atualizada_em = now(), atualizada_por = auth.uid();
end $$;
revoke execute on function public.notificacao_config_salvar(uuid, boolean, int[], time, time, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.notificacao_config_salvar(uuid, boolean, int[], time, time, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- Quantas pessoas / aparelhos que enxergam a rede têm a notificação ligada.
create or replace function public.notificacao_aparelhos(p_rede uuid)
returns table (pessoas int, aparelhos int) language plpgsql stable security definer set search_path = public as $$
begin
  if p_rede not in (select public.redes_legiveis()) then raise exception 'Sem acesso a esta rede.'; end if;
  return query
    select count(distinct i.user_id)::int, count(*)::int
      from push_inscricoes i join profiles p on p.user_id = i.user_id
     where app_notif_ve(p, p_rede, null);
end $$;
revoke execute on function public.notificacao_aparelhos(uuid) from public, anon;
grant execute on function public.notificacao_aparelhos(uuid) to authenticated;

create or replace function public.app_notif_na_janela(c public.notificacao_config) returns boolean
language sql stable set search_path = public as $$
  select c.ativo
     and extract(isodow from (now() at time zone c.fuso))::int = any(c.dias)
     and (now() at time zone c.fuso)::time >= c.hora_inicio
     and (now() at time zone c.fuso)::time <  c.hora_fim
$$;
revoke execute on function public.app_notif_na_janela(public.notificacao_config) from public, anon, authenticated;

-- ─── Fila de eventos ─────────────────────────────────────────────────────────
create table if not exists public.notificacao_fila (
  id              bigint generated always as identity primary key,
  rede_id         uuid not null references public.redes(id) on delete cascade,
  tipo            text not null check (tipo in ('pedido_aguardando', 'pedido_decidido', 'nota_devolvida', 'tarefa_atribuida')),
  ref_id          uuid not null,              -- pedido ou tarefa
  empresa_codigo  int,
  alvo            uuid,                       -- pessoa específica (quem pediu / responsável)
  autor           uuid,                       -- quem causou (não recebe o próprio aviso)
  dados           jsonb not null default '{}',
  criada_em       timestamptz not null default now(),
  processada_em   timestamptz
);
create index if not exists notificacao_fila_aberta_idx on public.notificacao_fila(criada_em) where processada_em is null;
alter table public.notificacao_fila enable row level security;
revoke all on public.notificacao_fila from anon, authenticated;

-- Pedidos: enviado para liberação; decidido (liberado/parcial/recusado).
create or replace function public.tg_pedido_notificacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dados jsonb;
begin
  if not exists (select 1 from push_inscricoes) then return null; end if;
  v_dados := jsonb_build_object('numero', new.numero, 'fornecedor', new.fornecedor_nome, 'status', new.status,
                                'valor', coalesce(new.total_liberado, new.total_solicitado), 'motivo', new.motivo_recusa);
  if new.status = 'aguardando' and (tg_op = 'INSERT' or old.status is distinct from 'aguardando') then
    insert into notificacao_fila (rede_id, tipo, ref_id, empresa_codigo, autor, dados)
    values (new.rede_id, 'pedido_aguardando', new.id, new.empresa_codigo, coalesce(auth.uid(), new.solicitante_id), v_dados);
  elsif tg_op = 'UPDATE' and old.status = 'aguardando' and new.status in ('liberado', 'liberado_parcial', 'recusado')
        and new.solicitante_id is not null then
    insert into notificacao_fila (rede_id, tipo, ref_id, empresa_codigo, alvo, autor, dados)
    values (new.rede_id, 'pedido_decidido', new.id, new.empresa_codigo, new.solicitante_id, auth.uid(), v_dados);
  end if;
  return null;
end $$;
drop trigger if exists trg_pedido_notificacao on public.compras_pedidos;
create trigger trg_pedido_notificacao after insert or update of status on public.compras_pedidos
  for each row execute function public.tg_pedido_notificacao();

-- Nota do pedido devolvida pelo escritório no NotaOK (escrita pela Edge, sem usuário).
create or replace function public.tg_pedido_nota_notificacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if not exists (select 1 from push_inscricoes) then return null; end if;
  if new.situacao = 'devolvida' and (tg_op = 'INSERT' or old.situacao is distinct from 'devolvida') then
    select id, numero, fornecedor_nome, empresa_codigo, solicitante_id into p from compras_pedidos where id = new.pedido_id;
    if p.id is not null then
      insert into notificacao_fila (rede_id, tipo, ref_id, empresa_codigo, alvo, dados)
      values (new.rede_id, 'nota_devolvida', p.id, p.empresa_codigo, p.solicitante_id,
              jsonb_build_object('numero', p.numero, 'fornecedor', p.fornecedor_nome, 'nota', new.nota_numero));
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_pedido_nota_notificacao on public.compras_pedido_notas;
create trigger trg_pedido_nota_notificacao after insert or update of situacao on public.compras_pedido_notas
  for each row execute function public.tg_pedido_nota_notificacao();

-- Tarefa AVULSA que passou a ser de alguém (as de rotina entram só no resumo da manhã).
create or replace function public.tg_tarefa_notificacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from push_inscricoes) then return null; end if;
  if new.responsavel_id is not null and new.rotina_id is null and new.status in ('a_fazer', 'em_andamento')
     and (tg_op = 'INSERT' or old.responsavel_id is distinct from new.responsavel_id) then
    insert into notificacao_fila (rede_id, tipo, ref_id, empresa_codigo, alvo, autor, dados)
    values (new.rede_id, 'tarefa_atribuida', new.id, new.empresa_codigo, new.responsavel_id, auth.uid(),
            jsonb_build_object('titulo', new.titulo, 'vence_em', new.vence_em));
  end if;
  return null;
end $$;
drop trigger if exists trg_tarefa_notificacao on public.gestao_tarefas;
create trigger trg_tarefa_notificacao after insert or update of responsavel_id on public.gestao_tarefas
  for each row execute function public.tg_tarefa_notificacao();

-- ─── Preparar o envio (só a Edge Function, com service_role) ─────────────────
-- Uma linha por pessoa e tipo, já agrupada; marca a fila como processada.
-- Fora da janela (ou evento desligado) o item só é descartado (vai pro resumo).
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
    select distinct p.user_id, p.is_master, p.pode_liberar_compras, a.rede_id, p.empresa_codigos
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
         jsonb_build_object('a_liberar', c.a_liberar, 'notas_devolvidas', c.notas_devolvidas,
                            'atrasadas', c.atrasadas, 'vencem_hoje', c.vencem_hoje)
    from contas c
   where (c.a_liberar + c.notas_devolvidas + c.atrasadas + c.vencem_hoje) > 0;

  delete from notificacao_fila where processada_em < now() - interval '7 days';
end $$;
revoke execute on function public.notificacao_preparar() from public, anon, authenticated;
grant execute on function public.notificacao_preparar() to service_role;

-- ─── Agendamento: a cada minuto, só chama a função se houver o que enviar ───
create or replace function public.visor_notificacoes_pendentes() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from notificacao_fila where processada_em is null)
      or (exists (select 1 from push_inscricoes)
          and exists (select 1 from notificacao_config c
                       where c.lembrete and app_notif_na_janela(c)
                         and (c.ultimo_lembrete is null or c.ultimo_lembrete < (now() at time zone c.fuso)::date)))
$$;
revoke execute on function public.visor_notificacoes_pendentes() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'visor-notificacoes';
select cron.schedule('visor-notificacoes', '* * * * *', $$
  select case when public.visor_notificacoes_pendentes() then
    net.http_post(
      url     := 'https://yzmorbfadoxowchkwspl.supabase.co/functions/v1/notificacoes',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<NOTIFICACOES_CRON_SECRET>'),
      body    := '{"acao":"processar"}'::jsonb,
      timeout_milliseconds := 60000)
  end
$$);
