-- ─────────────────────────────────────────────────────────────────────────
-- Plano comercial por rede (Basic / Premium / Pro)
--
-- Fase "informativa": a coluna alimenta a vitrine da landing e o card
-- "Meu plano" em Configurações. NÃO trava módulo ainda (o acesso real segue
-- em profiles.modulos_permitidos). Ver src/lib/planos.ts.
--
-- Default 'pro': as redes existentes hoje veem tudo (sem trava), então 'pro'
-- reflete o acesso atual sem "rebaixar" ninguém. O rep ajusta por rede depois
-- (Admin · Redes → seletor de plano, ou este UPDATE manual).
--
-- Rodar UMA VEZ no projeto visor360 (yzmorbfadoxowchkwspl).
-- ─────────────────────────────────────────────────────────────────────────

alter table redes
  add column if not exists plano text not null default 'pro';

-- Só aceita os três planos válidos (defensivo contra typo em UPDATE manual).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'redes_plano_check'
  ) then
    alter table redes
      add constraint redes_plano_check
      check (plano in ('basic', 'premium', 'pro'));
  end if;
end $$;

-- Exemplo de ajuste por rede (o rep faz pela tela Admin · Redes):
--   update redes set plano = 'premium' where nome = 'Grupo AutoBem';
--   update redes set plano = 'basic'   where nome = 'Posto Aurora Demonstração';
