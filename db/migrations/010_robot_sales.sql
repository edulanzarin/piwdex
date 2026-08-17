-- Totalizador CUMULATIVO (pra sempre, todas as hunts) do que o robo vendeu ATRAVES do
-- piwdex: itens e pokemon, contagem e valor em dolares. Nao conta vendas feitas no jogo
-- por fora — so o que passou pela nossa venda automatica. Nunca reseta (uma linha por
-- usuario, incrementada a cada venda confirmada).
CREATE TABLE robot_sales (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  items_count bigint NOT NULL DEFAULT 0,
  items_gold  bigint NOT NULL DEFAULT 0,
  pokes_count bigint NOT NULL DEFAULT 0,
  pokes_gold  bigint NOT NULL DEFAULT 0,
  updated_em  timestamptz NOT NULL DEFAULT now()
);
