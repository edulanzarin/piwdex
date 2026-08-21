-- piwdex camada 4: login do site + vinculo com a conta do jogo por usuario.
-- SQL puro (sem ORM). gen_random_uuid() e nativo no Postgres 13+.

-- Toca atualizado_em em todo UPDATE.
CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Usuarios do piwdex (nao confundir com a conta do jogo).
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,          -- sempre em minusculo (normalizado no app)
  nome          text,
  senha_hash    text,                          -- null = usuario so-OAuth (Google)
  avatar_url    text,
  vip           boolean NOT NULL DEFAULT false, -- gate da area VIP (Mercado Pago depois)
  vip_ate       timestamptz,                    -- fim da assinatura, quando houver
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- Contas OAuth vinculadas (Google). Um provider+id externo aponta pra um user.
CREATE TABLE oauth_accounts (
  provider            text NOT NULL,            -- 'google'
  provider_account_id text NOT NULL,            -- 'sub' do provedor
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  criado_em           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_account_id)
);

CREATE INDEX oauth_accounts_user_idx ON oauth_accounts (user_id);

-- Vinculo com a conta do jogo (Poke Idle World). Um vinculo por usuario.
-- Tokens guardados cifrados (AES-GCM com SESSION_SECRET, igual ao cookie antigo).
-- status: 'active' = conectado; 'expired' = refresh falhou, pedir reconexao.
CREATE TABLE game_links (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text,
  cmid          text,                           -- id do personagem/membro no jogo
  player_name   text,                           -- rotulo cacheado (ex: "Zashz")
  status        text NOT NULL DEFAULT 'active',
  conectado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER game_links_touch BEFORE UPDATE ON game_links
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
