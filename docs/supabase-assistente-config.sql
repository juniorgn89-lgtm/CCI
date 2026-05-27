-- ─────────────────────────────────────────────────────────────────────────
-- Configuração do Assistente Inteligente por rede.
--
-- Cada rede (cliente) tem sua própria configuração: se o Assistente IA está
-- habilitado, em qual tier (Light/Medium/Heavy/Custom), e qual o limite de
-- gasto mensal em USD pra orientar o gerente do Visor360 na precificação.
--
-- Os campos são INFORMACIONAIS no front (não bloqueiam chamadas — a chave
-- de API e o spend limit real ficam configurados no console.anthropic.com
-- via workspaces). O objetivo é dar visibilidade central pro gerente.
-- ─────────────────────────────────────────────────────────────────────────

alter table redes
  add column if not exists assistente_habilitado boolean not null default false;

alter table redes
  add column if not exists assistente_tier text not null default 'light'
  check (assistente_tier in ('light', 'medium', 'heavy', 'custom'));

alter table redes
  add column if not exists assistente_limite_mensal_usd numeric(10, 2) default 15.00;

alter table redes
  add column if not exists assistente_observacoes text;

-- Workspace ID na Anthropic (opcional — pra rastrear qual workspace foi
-- criado pra essa rede no console.anthropic.com). Não é a chave em si.
alter table redes
  add column if not exists assistente_workspace_id text;

-- Email do contato responsável pela conta na rede (pra suporte/cobrança).
alter table redes
  add column if not exists assistente_contato_email text;

-- Anotação de quando o assistente foi habilitado/ajustado pela última vez.
-- Útil pra rastreio de mudanças de tier.
alter table redes
  add column if not exists assistente_atualizado_em timestamptz;

-- Chave da API da Anthropic configurada pelo gerente do Visor360 pra essa rede.
-- O usuário final NÃO configura a chave — ele só usa o Assistente quando o gerente
-- já habilitou e plugou uma chave válida nessa coluna.
--
-- ATENÇÃO: a chave fica em texto plano protegida por RLS do Supabase. Garanta que
-- a policy de SELECT em `redes` restrinja leitura aos roles apropriados (master
-- e usuários daquela rede via profile.rede_id). NUNCA exponha esse campo em
-- endpoints públicos.
alter table redes
  add column if not exists assistente_chave_anthropic text;

comment on column redes.assistente_habilitado is 'Se o Assistente IA está liberado pra essa rede usar.';
comment on column redes.assistente_tier is 'Tier de uso esperado: light (~20 perg/dia), medium (~50), heavy (100+), custom.';
comment on column redes.assistente_limite_mensal_usd is 'Limite de gasto mensal em USD configurado no workspace da Anthropic dessa rede.';
comment on column redes.assistente_workspace_id is 'ID do workspace na Anthropic pra rastreio (opcional).';
comment on column redes.assistente_contato_email is 'Email do responsável pela rede pra suporte/cobrança do Assistente.';
