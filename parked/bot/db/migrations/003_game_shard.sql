-- O time/colecao ativa (pokemons individuais com IV) so vem pelo WebSocket, num
-- shard especifico por conta (wss://.../ws<N>). O shard e descoberto por sondagem;
-- cacheamos aqui pra abrir 1 conexao em vez de varrer todos os shards toda vez.
ALTER TABLE game_links ADD COLUMN shard int;
