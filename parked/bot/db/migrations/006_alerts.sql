-- Alertas VIP: watchlists de mercado + inbox de notificacoes in-app.
-- O worker (piwdex-worker) varre as watchlists ativas de todo VIP e grava
-- as notificacoes aqui; o sininho da area VIP le desta tabela. Tudo e LEITURA
-- do jogo (nao escreve nada na conta) — por isso roda sem a extensao.

-- Criterios de caca no mercado. Uma linha = um "quero isso": especie + orcamento
-- + piso de qualidade. Campos null = "qualquer".
CREATE TABLE watchlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id  int,                              -- null = qualquer especie
  currency    text,                             -- 'GOLD' | 'DIAMONDS' | null (qualquer)
  max_price   bigint,                           -- teto na moeda; null = sem teto
  min_quality numeric(5,3),                     -- Quality minima; null = qualquer
  min_iv      int,                              -- IV total minimo; null = qualquer
  shiny_only  boolean NOT NULL DEFAULT false,
  below_fair  boolean NOT NULL DEFAULT false,   -- so avisa se abaixo do preco justo
  active      boolean NOT NULL DEFAULT true,
  label       text,                             -- rotulo opcional do usuario
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX watchlists_user_idx ON watchlists (user_id);
CREATE INDEX watchlists_active_idx ON watchlists (user_id) WHERE active;

-- Inbox in-app. dedup_key garante idempotencia: o worker roda a cada ~60s e nao
-- pode duplicar o mesmo anuncio/evento. Snipe -> por anuncio; evento de conta ->
-- por entidade ou por dia (ver lib/alerts.ts).
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL,                     -- 'snipe' | 'egg' | 'breeding' | 'streak' | 'vip'
  dedup_key  text NOT NULL,
  title      text NOT NULL,
  body       text,
  data       jsonb,                             -- payload (listingId, price, sprite, speciesId...)
  read_at    timestamptz,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedup_key)
);
CREATE INDEX notifications_user_idx ON notifications (user_id, criado_em DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
