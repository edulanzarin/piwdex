-- Varias contas do JOGO por usuario do piwdex.
--
-- Ate aqui o modelo inteiro dizia "uma conta por pessoa", e dizia isso da forma
-- mais dura possivel: `user_id` era a CHAVE PRIMARIA de `game_links` e de
-- `robot_sessions`. Nao era uma regra escrita em codigo, que se afrouxa com um
-- if — era a estrutura do banco, e por isso nao havia como duplicar por engano.
--
-- Agora a chave passa a ser o VINCULO. Cada linha de `game_links` vira uma conta
-- de jogo com id proprio, e tudo que era "do usuario" e na verdade "da conta":
-- o estado desejado, a config das automacoes, o placar, o registro de eventos.
-- Um WebSocket por conta, e nao mais um por assinante.
--
-- O que continua do USUARIO: quem paga, e quem pode ver. `robot_events` guarda
-- os dois — `link_id` diz qual conta fez, `user_id` responde "o que aconteceu
-- comigo" sem precisar de join pra pintar o numero da aba.

-- ---------------------------------------------------------------------------
-- 1. game_links: de "uma por usuario" para "varias por usuario"
-- ---------------------------------------------------------------------------

ALTER TABLE game_links ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

-- O apelido e do DONO, nao do jogo: duas contas do mesmo jogador se distinguem
-- pelo papel que cada uma cumpre ("a de farm", "a do clã"), e o `player_name`
-- que vem do jogo nao carrega isso.
ALTER TABLE game_links ADD COLUMN IF NOT EXISTS apelido text;
ALTER TABLE game_links ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now();

ALTER TABLE game_links DROP CONSTRAINT IF EXISTS game_links_pkey;
ALTER TABLE game_links ADD PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS game_links_user_idx ON game_links (user_id, criado_em);

-- A mesma conta de jogo vinculada duas vezes no mesmo usuario seriam dois
-- sockets brigando pela MESMA sessao de jogo: cada um derrubando o outro, para
-- sempre. O jogo aceita uma sessao por conta, e o banco passa a dizer isso.
CREATE UNIQUE INDEX IF NOT EXISTS game_links_user_cmid_idx
  ON game_links (user_id, cmid) WHERE cmid IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. robot_sessions: o desejo passa a ser da CONTA
-- ---------------------------------------------------------------------------

ALTER TABLE robot_sessions ADD COLUMN IF NOT EXISTS link_id uuid;

UPDATE robot_sessions rs
   SET link_id = gl.id
  FROM game_links gl
 WHERE gl.user_id = rs.user_id AND rs.link_id IS NULL;

-- Desejo sem vinculo nao tem o que religar: o boot leria uma linha que nao
-- aponta pra credencial nenhuma.
DELETE FROM robot_sessions WHERE link_id IS NULL;

ALTER TABLE robot_sessions DROP CONSTRAINT IF EXISTS robot_sessions_pkey;
ALTER TABLE robot_sessions ALTER COLUMN link_id SET NOT NULL;
ALTER TABLE robot_sessions ADD PRIMARY KEY (link_id);

ALTER TABLE robot_sessions
  ADD CONSTRAINT robot_sessions_link_fk
  FOREIGN KEY (link_id) REFERENCES game_links(id) ON DELETE CASCADE;

-- `user_id` sai: ele e derivavel por join e, mantido, seria uma segunda verdade
-- sobre de quem e a sessao — divergiria no dia em que uma conta trocasse de dono.
ALTER TABLE robot_sessions DROP COLUMN IF EXISTS user_id;

-- ---------------------------------------------------------------------------
-- 3. robot_events: o registro diz QUAL conta fez
-- ---------------------------------------------------------------------------

ALTER TABLE robot_events ADD COLUMN IF NOT EXISTS link_id uuid
  REFERENCES game_links(id) ON DELETE CASCADE;

UPDATE robot_events re
   SET link_id = gl.id
  FROM game_links gl
 WHERE gl.user_id = re.user_id AND re.link_id IS NULL;

-- Fica NULO no historico de quem ja apagou o vinculo. Nulo aqui e honesto:
-- "aconteceu, e nao sei mais em qual conta" — melhor que atribuir a uma.
CREATE INDEX IF NOT EXISTS robot_events_link_idx ON robot_events (link_id, criado_em DESC);
