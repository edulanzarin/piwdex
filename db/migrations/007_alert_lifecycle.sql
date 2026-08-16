-- Ciclo de vida do alerta de snipe.
--  - watchlist_id: vincula o alerta a busca que o gerou. Pausar a busca esconde os
--    alertas dela (filtro no SELECT); excluir a busca apaga por cascade.
--  - dismissed_at: "negar a oferta". Some da caixa, mas a linha PERMANECE como
--    tombstone pro dedup (UNIQUE user_id+dedup_key) nao re-inserir o mesmo anuncio no
--    proximo scan enquanto o poke ainda estiver no mercado.

ALTER TABLE notifications ADD COLUMN watchlist_id uuid REFERENCES watchlists(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN dismissed_at timestamptz;
CREATE INDEX notifications_watchlist_idx ON notifications (watchlist_id);

-- Zera as notificacoes pre-007: sao dados de dev/teste sem o vinculo novo, e alertas de
-- conta (streak/breeding) que sairam do escopo. O modelo daqui pra frente exige
-- watchlist_id, entao comecar limpo evita FK orfa.
DELETE FROM notifications;
