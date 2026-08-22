-- Decisao do Eduardo (ago/2026): login so por email/senha, sem OAuth. A tabela de
-- vinculos OAuth fica orfa -> removida. Se um dia entrar Google, volta por migration.
DROP TABLE IF EXISTS oauth_accounts;
