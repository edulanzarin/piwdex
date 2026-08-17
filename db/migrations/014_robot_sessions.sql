-- Estado DESEJADO do robo, persistido: sobrevive a restart do container e alimenta a
-- reconexao automatica. O estado vivo (socket, analyzer) segue em memoria (game-hunt-session);
-- esta tabela guarda o que o usuario QUER (bot ligado, modo, hunt, travas) + o ultimo status
-- observado (pro monitor mostrar algo mesmo com o processo recem-nascido).
CREATE TABLE robot_sessions (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled       boolean NOT NULL DEFAULT false,  -- "quero o robo rodando" (religa sozinho)
  mode          text NOT NULL DEFAULT 'manual',  -- manual | auto | leveling
  slug          text,                            -- hunt atual (manual: escolhida; auto/leveling: a que o cerebro escolheu)
  sell_item_ids jsonb NOT NULL DEFAULT '[]',     -- drops marcados pra vender (manual)
  poke_sell_cfg jsonb,                           -- travas de venda de pokemon (null = off)
  autobuy       boolean NOT NULL DEFAULT false,  -- auto-compra de pokebolas
  leveling      jsonb,                           -- {pokeId, speciesId, name, startLevel, targetLevel, currentLevel, done}
  last_status   text NOT NULL DEFAULT 'idle',    -- ultimo SessStatus observado
  last_error    text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
