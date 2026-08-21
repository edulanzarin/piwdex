-- Desejo por TIPO: "me avise quando aparecer QUALQUER lutador abaixo do justo".
-- Exclusivo com species_id (uma especie ja e de um tipo so) — o app garante que so um
-- dos dois vem preenchido. null = qualquer tipo.
ALTER TABLE watchlists ADD COLUMN type text;
