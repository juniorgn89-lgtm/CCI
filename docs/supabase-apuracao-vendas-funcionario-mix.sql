-- ============================================
-- Migração: mix de aditivada por frentista no apuracao_vendas_funcionario
-- ============================================
-- Adiciona a quebra gasolina/aditivada (litros) às linhas de COMBUSTÍVEL do
-- cache de produtividade por funcionário. Com isso a Produtividade calcula o mix
-- de aditivada por frentista DIRETO do cache (rede-wide, uma leitura) em vez de
-- ir ao vivo no /ABASTECIMENTO posto a posto.
--
-- Só afeta setor='combustivel' (loja fica 0). Mesmo critério do buildScoreInputs
-- do front (isGasolina = nome contém "GASOLINA"; isAditivada = contém "ADITIVADA";
-- aditivada é subconjunto da gasolina → mix = aditivada ÷ gasolina).
--
-- ORDEM: rode este SQL ANTES de fazer o deploy da Edge Function apurar-cron
-- (senão o upsert com as colunas novas quebra). Depois re-apure o período em
-- Admin · Apuração pra popular os valores dos dias fechados.

alter table apuracao_vendas_funcionario
  add column if not exists aditivada_litros numeric not null default 0,
  add column if not exists gasolina_litros  numeric not null default 0;
