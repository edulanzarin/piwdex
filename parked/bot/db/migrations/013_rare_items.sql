-- Itens RAROS coletados (cumulativo, pra sempre): a quantidade de drops marcados como
-- `rare` nos dados do jogo, somada no fim de cada hunt a partir do breakdown do analyzer
-- (resolve cada drop pelo nome -> item -> rare). Alimenta o dashboard de Estatisticas.
ALTER TABLE robot_sales
  ADD COLUMN rare_items bigint NOT NULL DEFAULT 0;
