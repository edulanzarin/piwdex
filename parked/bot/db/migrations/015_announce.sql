-- Anuncio automatico no chat do jogo (divulgacao): config persistida junto do estado
-- desejado do robo — sobrevive a restart e religa com a sessao.
-- shape: {"on": bool, "text": string, "everyMin": int, "channel": "world"|"trade"|"help"}
ALTER TABLE robot_sessions ADD COLUMN announce jsonb;
