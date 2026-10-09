-- Rollback do ledger do Cotação Hub.
-- Não apaga dado de domínio alheio: só as tabelas criadas em
-- 20261009120000_cotacao_hub_ledger.sql. Políticas caem junto com as tabelas.
-- Os envios, vínculos e retornos da integração são perdidos — aplicar este
-- rollback exige decidir antes se a conexão ainda está ativa.

drop table if exists public.cotacao_hub_draft;
drop table if exists public.cotacao_hub_inbox;
drop table if exists public.cotacao_hub_submission;
