-- O time so vem pelo WS, que toma a sessao de jogo. Pra nao reconectar (e rechutar) a
-- cada visita da Conta, guardamos um SNAPSHOT do time no momento do connect (quando a
-- sessao ja e tomada de qualquer jeito). A Conta mostra o snapshot; "atualizar" repuxa.
ALTER TABLE game_links ADD COLUMN team_snapshot jsonb;
ALTER TABLE game_links ADD COLUMN team_total    int;
ALTER TABLE game_links ADD COLUMN team_at       timestamptz;
