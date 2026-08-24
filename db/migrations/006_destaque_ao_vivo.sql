-- O reinado de tres dias SAI.
--
-- O desenho original contava tres dias e o vencedor reinava os tres seguintes.
-- O Eduardo apontou o defeito antes de isso chegar a producao, e ele e do
-- conceito, nao da implementacao: com mandato, o card mostra sempre o vencedor
-- da janela ANTERIOR — ou seja, o que estava em alta tres dias atras. Um rotulo
-- que diz "em alta" e aponta pro passado e a definicao de mentira educada.
--
-- Sem mandato, o que fica e uma consulta sobre janela rolante: quem teve mais
-- votantes nas ultimas 24 horas, agora. Nao ha estado pra guardar — o "quem esta
-- em alta" e sempre derivavel do registro de uso, e derivar na hora e o que
-- torna a resposta atual por construcao.
--
-- A tabela de uso fica; e ela que tem a resposta.
DROP TABLE IF EXISTS destaque_reinado;

-- A janela rolante le por TIMESTAMP, e nao por dia: "ultimas 24 horas" as 14h de
-- terca nao e "segunda e terca inteiras". O indice acompanha a pergunta.
CREATE INDEX IF NOT EXISTS destaque_uso_criado ON destaque_uso (criado);
DROP INDEX IF EXISTS destaque_uso_dia;
