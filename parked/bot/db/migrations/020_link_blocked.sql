-- Conta RECUSADA pelo jogo (ban/suspensao) e um estado diferente de token vencido, e
-- exige tratamento oposto: token vencido se resolve reconectando, recusa NAO se resolve
-- tentando de novo. Sem essa distincao o robo ficava batendo na porta de uma conta banida
-- e o usuario via so "nao conectou", sem motivo.
--
-- `status` passa a aceitar 'blocked' alem de 'active'/'expired'. Guardamos TAMBEM o que o
-- jogo respondeu (codigo + corpo truncado): a mensagem exata e do jogo, nao nossa, entao
-- ela e evidencia — e e o que se mostra pro dono da conta.
ALTER TABLE game_links ADD COLUMN IF NOT EXISTS block_status  integer;
ALTER TABLE game_links ADD COLUMN IF NOT EXISTS block_reason  text;
ALTER TABLE game_links ADD COLUMN IF NOT EXISTS blocked_em    timestamptz;
