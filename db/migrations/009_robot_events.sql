-- Atividade do robo: o que os robos server-side (Hunt Analyzer + venda automatica)
-- fizeram enquanto rodavam, INCLUSIVE com o jogador offline (rodam no container, nao no
-- navegador). Tabela propria (nao a `notifications`, que e acoplada a watchlists de
-- mercado). A aba Alertas mostra esses eventos ao lado dos achados do mercado.
CREATE TABLE robot_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL,                     -- 'shiny' | 'hunt-summary' | 'poke-sold' | 'item-sold'
  title      text NOT NULL,
  body       text,
  data       jsonb,                             -- payload (species, gold, counts, sprite...)
  read_at    timestamptz,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX robot_events_user_idx ON robot_events (user_id, criado_em DESC);
