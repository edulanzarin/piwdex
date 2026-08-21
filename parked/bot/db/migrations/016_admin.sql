-- Portal admin do Eduardo. Uma flag por usuario: quem tem is_admin cai na area /admin
-- (visao de TODAS as contas, moedas ao vivo, "entrar como") em vez da area VIP/Conta.
-- IF NOT EXISTS pra ser idempotente: em producao a coluna ja foi aplicada a mao antes
-- deste arquivo existir (id registrado no schema_migrations); num banco novo, roda aqui.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
