-- FILA de planos de leveling: o robo termina o plano do pokemon atual e ja comeca o
-- proximo da fila sozinho (summon do bicho + rota nova), ate 3 planos no total (o que
-- roda + 2 na espera). O plano EM ANDAMENTO continua em `leveling`; aqui ficam so os
-- que ainda nao comecaram. shape: [{"pokeId":"...","speciesId":1,"name":"Golem","targetLevel":200}]
ALTER TABLE robot_sessions ADD COLUMN IF NOT EXISTS leveling_queue jsonb;
