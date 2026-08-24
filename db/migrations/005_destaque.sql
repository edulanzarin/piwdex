-- O DESTAQUE DA HOME sai do uso, e nao da forca.
--
-- Ele era o numero 1 da tier list. Isso e uma afirmacao boa e um problema
-- pratico: o mais forte do jogo nao muda, entao a home nunca muda. A troca e
-- passar a mostrar o que o pessoal esta de fato PESQUISANDO, num reinado de tres
-- dias — durante o reinado se conta, no fim do reinado o mais contado assume.
--
-- Duas decisoes de modelagem que sao o coracao disto:
--
-- 1. **A unidade de conta e o VOTANTE, nao o evento.** Contar clique faz vencer
--    quem recarrega mais — e um placar de F5, nao de interesse. A chave primaria
--    (poke_id, dia, votante) faz o mesmo visitante contar UMA vez por pokemon
--    por dia, e o `ON CONFLICT DO NOTHING` transforma spam em nada.
--
-- 2. **`votante` e um hash com sal e data, e nao um identificador.** Ele nasce de
--    IP + user-agent + dia + segredo, entao muda sozinho a cada meia-noite e nao
--    volta atras: serve pra deduplicar dentro do dia e nao serve pra seguir
--    ninguem. Nao guardamos IP.
CREATE TABLE IF NOT EXISTS destaque_uso (
  poke_id  integer     NOT NULL,
  dia      date        NOT NULL,
  votante  text        NOT NULL,
  criado   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poke_id, dia, votante)
);

-- A apuracao le por janela de dias, entao o indice e por dia.
CREATE INDEX IF NOT EXISTS destaque_uso_dia ON destaque_uso (dia);

-- O reinado e uma LINHA SO, e a trava garante isso.
--
-- Sem a trava, uma corrida entre duas visitas simultaneas no instante em que o
-- reinado vence gravaria dois vencedores e a home passaria a depender de qual
-- consulta chegasse primeiro. Com uma linha unica, o `INSERT ... ON CONFLICT DO
-- UPDATE` condicionado ao fim ja passado e atomico: a segunda visita encontra o
-- trabalho feito.
CREATE TABLE IF NOT EXISTS destaque_reinado (
  id      integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  poke_id integer     NOT NULL,
  inicio  timestamptz NOT NULL DEFAULT now(),
  fim     timestamptz NOT NULL
);
