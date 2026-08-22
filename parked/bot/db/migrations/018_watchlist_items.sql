-- Desejos de ITEM alem de pokemon: a watchlist ganha um tipo (kind) e o item vigiado.
-- kind 'pokemon' (default, tudo que ja existia) | 'item' (item_id = refId do jogo).
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'pokemon';
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS item_id integer;
