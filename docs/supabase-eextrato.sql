-- ============================================================================
-- e-extrato (Boavista) — conciliadora de cartão. Estrutura do lado do Visor.
-- AINDA NÃO APLICADO: aguarda a Boavista confirmar (a) se a chave é por rede
-- ou da CCI e (b) como cada posto aparece nos retornos (codigoLoja,
-- codigoLojaErp ou codigoEstabelecimento). Idempotente; rode via
-- `supabase db query --linked -f docs/supabase-eextrato.sql`.
--
-- O Visor só LÊ da e-extrato (retornos). A Edge Function `eextrato` guarda
-- aqui a cópia; o app lê a cópia. Escrita só pelo service role.
-- ============================================================================

-- 1) Que posto do Visor é cada loja/estabelecimento da e-extrato.
--    Um posto pode ter vários estabelecimentos (um por adquirente).
create table if not exists public.eextrato_postos (
  rede_id                uuid not null references public.redes(id) on delete cascade,
  empresa_codigo         integer not null,
  codigo_loja            text,            -- codigoLoja / codigoLojaErp da e-extrato
  codigo_estabelecimento text,            -- código do estabelecimento na adquirente
  criado_em              timestamptz not null default now(),
  unique (rede_id, codigo_loja, codigo_estabelecimento)
);
create index if not exists eextrato_postos_rede_idx on public.eextrato_postos (rede_id, empresa_codigo);

-- 2) Cópia dos retornos. Um registro por linha do retorno, com as colunas
--    que filtram e ordenam; o resto inteiro fica em `dados` (o formato real
--    da Boavista ainda pode trazer campos a mais).
create table if not exists public.eextrato_registros (
  rede_id         uuid not null references public.redes(id) on delete cascade,
  tipo            text not null check (tipo in ('venda', 'vendaDetalhada', 'pagamento', 'ajuste', 'recebivel')),
  chave           text not null,          -- identidade da linha (montada pela função: nsu/autorização/parcela/data/estabelecimento…)
  empresa_codigo  integer,                -- posto do Visor (via eextrato_postos); null = loja ainda não ligada
  data_ref        date not null,          -- data da venda, do pagamento ou do crédito/débito, conforme o tipo
  valor           numeric(14, 2),         -- bruto (venda/parcela/pagamento) ou crédito − débito (ajuste/recebível)
  status          text,                   -- PRE/PAG/ANT/CAN/CTP/CPP quando houver
  conciliado      boolean,                -- statusConciliacao = 1
  dados           jsonb not null,         -- linha normalizada (supabase/functions/_shared/eextrato.ts)
  sincronizado_em timestamptz not null default now(),
  primary key (rede_id, tipo, chave)
);
create index if not exists eextrato_registros_consulta_idx on public.eextrato_registros (rede_id, tipo, data_ref);
create index if not exists eextrato_registros_posto_idx on public.eextrato_registros (rede_id, empresa_codigo, tipo, data_ref);

-- 3) Até onde a cópia está completa (por rede e tipo) — a tela diz "dados até
--    dd/mm" e marca leitura incompleta em vez de somar o que veio pela metade.
create table if not exists public.eextrato_sincronizacoes (
  rede_id     uuid not null references public.redes(id) on delete cascade,
  tipo        text not null,
  de          date not null,
  ate         date not null,
  registros   integer not null default 0,
  completo    boolean not null,
  erro        text,
  rodado_em   timestamptz not null default now()
);
create index if not exists eextrato_sincronizacoes_idx on public.eextrato_sincronizacoes (rede_id, tipo, rodado_em desc);

alter table public.eextrato_postos enable row level security;
alter table public.eextrato_registros enable row level security;
alter table public.eextrato_sincronizacoes enable row level security;

drop policy if exists eextrato_postos_select on public.eextrato_postos;
create policy eextrato_postos_select on public.eextrato_postos for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists eextrato_registros_select on public.eextrato_registros;
create policy eextrato_registros_select on public.eextrato_registros for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists eextrato_sincronizacoes_select on public.eextrato_sincronizacoes;
create policy eextrato_sincronizacoes_select on public.eextrato_sincronizacoes for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
-- Escrita só pela Edge Function (service role): nenhuma policy de insert/update/delete.

comment on table public.eextrato_registros is 'Cópia dos retornos da conciliadora e-extrato (vendas, parcelas, pagamentos, ajustes, recebíveis). Somente leitura no app.';
