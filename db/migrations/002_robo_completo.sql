-- O robo COMPLETO: as automacoes que rodam em cima da sessao segurada.
--
-- A 001 entregou o chassi (conta, vinculo, "quero rodando"). Faltava o que
-- transforma "uma conexao aberta numa hunt" em robo: repor consumivel sozinho,
-- vender o que entope a mochila, e deixar registro do que fez enquanto ninguem
-- olhava.
--
-- Mesma forma da 001 — tudo `IF NOT EXISTS` — pelo mesmo motivo: ela roda em
-- banco virgem E em cima do banco do v1, que ja tem `robot_events` (criada la
-- pela 009 com estas mesmas colunas).

-- ---------------------------------------------------------------------------
-- A configuracao das automacoes.
--
-- Mora junto do estado desejado, e nao em tabela propria, porque e a mesma
-- pergunta: "o que o usuario quer que o robo faca". Separar so criaria um JOIN
-- em todo lugar que ja le `robot_sessions`.
--
-- Tudo em jsonb: sao travas do usuario, mudam com a mesma frequencia com que a
-- tela ganha um controle novo, e nenhuma delas e chave de busca. Coluna por
-- trava significaria migration a cada checkbox.
--
--   auto_cfg   {"comprarBola":bool, "pisoBola":int, "alvoBola":int,
--               "bolaId":int|null, "comprarPocao":bool, "pocaoId":int|null,
--               "comprarRevive":bool, "reviveId":int|null,
--               "venderDrop":bool, "dropIds":[int], "venderPoke":bool,
--               "manterShiny":bool, "ivMinimo":int, "nivelMaximo":int,
--               "manterEspecies":[int]}
-- ---------------------------------------------------------------------------
ALTER TABLE robot_sessions ADD COLUMN IF NOT EXISTS auto_cfg jsonb;

-- ---------------------------------------------------------------------------
-- O que o robo fez.
--
-- Nao e log de servidor: e a MEMORIA do usuario. O robo trabalha justamente
-- quando ninguem esta olhando, entao "o que aconteceu de madrugada" so existe
-- se estiver gravado — o feed em memoria morre com o processo, e o processo
-- reinicia a cada deploy.
--
-- O que entra aqui e o que o dono da conta precisaria saber sem ter visto:
-- shiny capturado, venda feita, compra feita, conta recusada, reconexao. Kill a
-- kill NAO entra — sao milhares por hora, e o analyzer ja conta.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS robot_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  title      text NOT NULL,
  body       text,
  data       jsonb,
  read_at    timestamptz,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS robot_events_user_idx ON robot_events (user_id, criado_em DESC);

-- ---------------------------------------------------------------------------
-- O shard cacheado do v1 pode estar velho.
--
-- O shard e por conta e o jogo remaneja: conectar no errado fecha com 4003, e o
-- motor antigo lia isso como "queda de rede" e reconectava no MESMO shard
-- errado pra sempre — a cacada que nunca comeca. O motor novo redescobre
-- sozinho, mas comecar de um shard nulo poupa a primeira rodada de erro em quem
-- ja carrega um numero herdado.
--
-- Custa uma sondagem paralela de ~300ms na primeira conexao. Vale.
-- ---------------------------------------------------------------------------
UPDATE game_links SET shard = NULL WHERE shard IS NOT NULL;
