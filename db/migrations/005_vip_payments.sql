-- Pagamentos VIP (Mercado Pago, avulso mensal). Registra cada pagamento pra
-- idempotencia (webhook do MP chega repetido) e historico. O acesso VIP em si mora
-- em users.vip / users.vip_ate (cada pagamento aprovado estende +30 dias).
CREATE TABLE vip_payments (
  id        text PRIMARY KEY,                              -- id do pagamento no Mercado Pago
  user_id   uuid REFERENCES users(id) ON DELETE SET NULL,  -- mantem historico se o user sumir
  status    text NOT NULL,                                 -- approved | pending | rejected | ...
  amount    numeric(10,2),
  raw       jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vip_payments_user_idx ON vip_payments (user_id);
