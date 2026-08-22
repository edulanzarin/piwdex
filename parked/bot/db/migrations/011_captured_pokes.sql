-- Acervo de pokemon CAPTURADOS/mantidos pelo robo: os que NAO foram vendidos (ficaram por
-- estarem acima das travas). Persistente pra sempre (uma linha por bicho, por usuario);
-- so limpa quando o usuario mandar. Guarda os stats desnormalizados (tipo/raridade) pra
-- filtrar direto no SQL, igual ao mercado.
CREATE TABLE captured_pokes (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  poke_id    text NOT NULL,               -- id unico do bicho na conta do jogo
  species_id integer NOT NULL,
  name       text NOT NULL,
  level      integer NOT NULL DEFAULT 1,
  shiny      boolean NOT NULL DEFAULT false,
  iv_total   integer NOT NULL DEFAULT 0,  -- 0..192
  quality    real    NOT NULL DEFAULT 0,
  rarity     text    NOT NULL DEFAULT 'COMMON',
  type1      text    NOT NULL DEFAULT 'NORMAL',
  type2      text,
  seen_em    timestamptz NOT NULL DEFAULT now(),  -- 1a vez que o robo viu (hora de "captura")
  PRIMARY KEY (user_id, poke_id)
);
CREATE INDEX captured_pokes_user_idx ON captured_pokes (user_id, seen_em DESC);
