-- Camada logada do piwdex: conta do site, vinculo com a conta do jogo, estado
-- desejado do robo e historico de pagamento.
--
-- E uma migration CONSOLIDADA, e nao a replay das 20 do piwdex v1. Banco novo
-- nao ganha nada replicando a arqueologia de um banco que nao existe mais — uma
-- delas ate criava a tabela de OAuth que a seguinte derrubava. O que se perderia
-- (o PORQUE de cada coluna) esta preservado onde importa: nos comentarios.
--
-- SQL puro, sem ORM. `gen_random_uuid()` e nativo do Postgres 13+.

-- Toca `atualizado_em` em todo UPDATE.
CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Conta do PIWDEX. Nao confundir com a conta do JOGO: sao duas coisas, e a
-- separacao e o produto inteiro. Esta aqui tem email e senha nossos; a do jogo
-- entra por token e vive em `game_links`.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,           -- sempre minusculo (normalizado no app)
  nome          text,
  senha_hash    text NOT NULL,                  -- bcrypt
  vip           boolean NOT NULL DEFAULT false, -- gate da area logada
  vip_ate       timestamptz,                    -- fim da assinatura
  is_admin      boolean NOT NULL DEFAULT false,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ---------------------------------------------------------------------------
-- Vinculo com a conta do jogo (Poke Idle World), um por usuario.
--
-- Os tokens ficam CIFRADOS (AES-256-GCM com `SESSION_SECRET`). Trocar essa chave
-- invalida todo vinculo: o codigo nao consegue decifrar e trata como "sem
-- vinculo", o que e o comportamento certo — melhor pedir reconexao do que
-- operar com credencial que nao se sabe ler.
--
-- Por que TOKEN e nao senha: o `/login` do jogo exige captcha amarrado ao
-- navegador, entao proxiar credencial no servidor simplesmente nao funciona. De
-- brinde, e o modelo mais seguro — a senha do jogo nunca sai do jogo.
--
-- `status` tem TRES valores, e a diferenca entre os dois ultimos decide se vale
-- tentar de novo:
--   active   vinculo bom;
--   expired  o refresh falhou — reconectar RESOLVE (token novo);
--   blocked  o jogo recusou a conta (403). Reconectar NAO resolve nada, e
--            insistir a cada restart era exatamente o comportamento a eliminar.
-- ---------------------------------------------------------------------------
CREATE TABLE game_links (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token  text NOT NULL,                  -- cifrado
  refresh_token text,                           -- cifrado
  cmid          text,                           -- id do personagem no jogo
  player_name   text,                           -- rotulo cacheado (ex: "Zashz")
  status        text NOT NULL DEFAULT 'active',

  -- O shard do WebSocket e POR CONTA e nenhum campo o revela: descobre-se por
  -- sondagem paralela (conectar no errado fecha com 4003). Cacheado pra abrir 1
  -- conexao em vez de varrer 64 toda vez.
  shard         int,

  -- Snapshot do time lido no connect. O time individual (com IV) so vem pelo WS,
  -- e abrir WS TOMA a sessao de jogo — entao a tela le o snapshot e so quem
  -- pediu "atualizar" paga o preco de chutar a aba do jogo.
  team_snapshot jsonb,
  team_total    int,
  team_at       timestamptz,

  -- Evidencia da recusa, quando `status = 'blocked'`. A mensagem e do JOGO, nao
  -- nossa: guardar o corpo cru truncado evita quebrar a deteccao quando o jogo
  -- reescreve a frase, e e o que o dono da conta precisa ler.
  block_status  integer,
  block_reason  text,
  blocked_em    timestamptz,

  conectado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER game_links_touch BEFORE UPDATE ON game_links
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ---------------------------------------------------------------------------
-- Estado DESEJADO do robo.
--
-- O estado VIVO (socket, analyzer da sessao) fica em memoria, e some com o
-- processo. Aqui mora o que o usuario QUER — e e isso que permite religar
-- sozinho depois de um restart, em vez de esperar alguem abrir a tela.
--
-- `last_status` nao e redundante com o estado vivo: e o que o monitor mostra
-- quando o processo acabou de nascer e ainda nao reconectou nada.
-- ---------------------------------------------------------------------------
CREATE TABLE robot_sessions (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled     boolean NOT NULL DEFAULT false,  -- "quero o robo rodando"
  mode        text NOT NULL DEFAULT 'manual',  -- manual | auto
  slug        text,                            -- a hunt em que ele esta
  last_status text NOT NULL DEFAULT 'idle',
  last_error  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Pagamentos da assinatura (Mercado Pago).
--
-- A tabela existe por IDEMPOTENCIA antes de existir por historico: o webhook do
-- Mercado Pago chega repetido, e sem a chave primaria no id do pagamento o
-- mesmo pagamento estenderia a assinatura duas ou tres vezes.
--
-- O acesso em si nao mora aqui — mora em `users.vip` / `users.vip_ate`. Cada
-- pagamento aprovado estende a data; esta tabela e o extrato.
-- ---------------------------------------------------------------------------
CREATE TABLE vip_payments (
  id        text PRIMARY KEY,                              -- id do pagamento no MP
  user_id   uuid REFERENCES users(id) ON DELETE SET NULL,  -- historico sobrevive ao usuario
  status    text NOT NULL,                                 -- approved | pending | rejected | ...
  amount    numeric(10,2),
  raw       jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vip_payments_user_idx ON vip_payments (user_id);
