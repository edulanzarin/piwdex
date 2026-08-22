-- Estende o totalizador CUMULATIVO (robot_sales) com o que a Hunt acumulou ao longo de
-- TODAS as caçadas (pra sempre, nunca zera). Preenchido no fim de cada hunt (logSummary),
-- a partir do analyzer daquela sessão: kills, capturas, XP, itens coletados e o dólar de
-- loot vs o gasto em supply. Alimenta o dashboard de Estatísticas.
ALTER TABLE robot_sales
  ADD COLUMN hunts       bigint NOT NULL DEFAULT 0,  -- hunts concluídas contadas
  ADD COLUMN kills       bigint NOT NULL DEFAULT 0,
  ADD COLUMN captures    bigint NOT NULL DEFAULT 0,
  ADD COLUMN xp_gained   bigint NOT NULL DEFAULT 0,
  ADD COLUMN loot_items  bigint NOT NULL DEFAULT 0,  -- quantidade de itens dropados
  ADD COLUMN loot_gold   bigint NOT NULL DEFAULT 0,  -- valor do loot coletado
  ADD COLUMN supply_gold bigint NOT NULL DEFAULT 0;  -- gasto em bolas/poções
