-- Escolha de qual POCAO e qual REVIVE a auto-compra repoe (antes so repunha bolas). O jogo
-- nao tem campo de "qual pocao" no auto-helper (ele usa a melhor sozinho), entao a escolha
-- vive do lado do piwdex, junto do estado desejado do robo. null = "a melhor disponivel".
-- shape: {"potionId": int|null, "reviveId": int|null}
ALTER TABLE robot_sessions ADD COLUMN IF NOT EXISTS supply_cfg jsonb;
