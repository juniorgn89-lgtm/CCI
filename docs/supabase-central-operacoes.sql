-- ============================================================================
-- Central CCI → Visor: registro das operações que ALTERAM usuários
-- (Edge Function central-cci: criar, alterar, desativar, reativar, link_senha).
--
--  - Cada pedido da Central vem com um id próprio (x-cci-operacao). Ele é gravado
--    aqui ANTES de executar: se o mesmo pedido chegar de novo (copiado de um log,
--    por exemplo), é recusado. Isso importa sobretudo no link de senha.
--  - Também serve de log do lado do Visor: o que a Central pediu, quem pediu
--    (e-mail do diretor) e em quem. NUNCA guarda senha nem link de senha.
--  - Só a service role (a Edge Function) lê e grava: RLS ligada, sem políticas.
--
-- Rodar no SQL Editor DO VISOR. Pode rodar mais de uma vez.
-- ============================================================================

create table if not exists public.central_operacoes (
  operacao    uuid primary key,                 -- x-cci-operacao
  acao        text not null,                    -- criar | alterar | desativar | reativar | link_senha
  diretor     text,                             -- x-cci-diretor (e-mail)
  alvo_id     uuid,                             -- usuário afetado (quando já se sabe)
  alvo_email  text,
  resultado   text not null default 'pendente' check (resultado in ('pendente', 'ok', 'erro')),
  erro        text,
  criado_em   timestamptz not null default now()
);

create index if not exists central_operacoes_criado_idx on public.central_operacoes (criado_em desc);
create index if not exists central_operacoes_alvo_idx on public.central_operacoes (alvo_id);

alter table public.central_operacoes enable row level security;
revoke all on public.central_operacoes from anon, authenticated;

comment on table public.central_operacoes is
  'Pedidos da Central CCI que alteram usuários do Visor (anti-repetição + log). Sem senha nem link.';
