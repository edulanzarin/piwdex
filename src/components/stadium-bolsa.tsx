"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { cartaCompleta, cartaLabel, type Carta } from "@/lib/bolsa";
import { IV_MAX_TOTAL } from "@/lib/breeding";
import type { Deck } from "@/lib/decks";
import { spriteUrl } from "@/lib/sprites";
import { compact, num } from "@/lib/labels";
import {
  Badge,
  Button,
  Empty,
  Field,
  IconButton,
  IconClose,
  Input,
  Modal,
  Note,
  SearchInput,
  Select,
  Sprite,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { Pencil, Trash2 } from "lucide-react";

const TINT = "var(--color-t-stadium)";

/**
 * A BOLSA: os pokémon cadastrados, prontos pra entrar no time.
 *
 * Ela abre de dois jeitos, e a diferença muda o verbo do botão. Aberta pelo
 * "abrir bolsa" ela é um armário — você olha, edita, apaga. Aberta por um SLOT
 * ela é uma escolha, e cada carta vira "pôr no #3". A mesma lista servindo às
 * duas evita o erro de ter uma tela de coleção e outra de seleção discordando
 * sobre o que existe.
 *
 * Carta sem stats aparece, e aparece MARCADA. Ela é da estante antiga do
 * Breeding, salva só com o IV, e não tem número que ponha no ringue. Escondê-la
 * faria a bolsa contar menos pokémon do que a pessoa salvou, que é pior do que
 * mostrar um que ainda precisa de trabalho.
 */
export function StadiumBolsa({
  aberta,
  cartas,
  /** slot que pediu a bolsa; null = aberta pelo armário */
  slotAlvo,
  onEscolher,
  onEditar,
  onApagar,
  onNova,
  onFechar,
}: {
  aberta: boolean;
  cartas: Carta[];
  slotAlvo: number | null;
  onEscolher: (c: Carta) => void;
  onEditar: (c: Carta) => void;
  onApagar: (id: string) => void;
  onNova: () => void;
  onFechar: () => void;
}) {
  const [q, setQ] = useState("");

  const filtradas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cartas;
    return cartas.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) || c.species.toLowerCase().includes(needle),
    );
  }, [cartas, q]);

  return (
    <Modal
      open={aberta}
      onClose={onFechar}
      size="lg"
      eyebrow={slotAlvo != null ? `escolhendo pro slot #${slotAlvo + 1}` : "sua coleção"}
      title="Bolsa de pokémon"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="pix text-[10px] text-text-mute">
            {cartas.length} {cartas.length === 1 ? "CARTA" : "CARTAS"}
          </span>
          <span className="flex items-center gap-2">
            <Button variant="ghost" onClick={onFechar}>
              Fechar
            </Button>
            <Button onClick={onNova}>Nova carta</Button>
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {cartas.length > 4 ? (
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Buscar por nome ou espécie..."
          />
        ) : null}

        {!cartas.length ? (
          <Empty
            title="A bolsa está vazia"
            hint="Cadastre um pokémon com os stats que o jogo mostra. Ele fica salvo neste navegador e serve no Stadium e no Breeding."
            action={<Button onClick={onNova}>Nova carta</Button>}
          />
        ) : !filtradas.length ? (
          <Empty title="Nenhuma carta com esse nome" hint="Tente pela espécie." />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {filtradas.map((c) => {
              const pronta = cartaCompleta(c);
              const totalIv = c.ivs.reduce((a, b) => a + b, 0);
              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-pix border bg-surface-2/60 p-2",
                    pronta ? "border-line-strong" : "border-warn/40",
                  )}
                >
                  <Sprite
                    src={spriteUrl(c.pokeId, c.shiny)}
                    alt={c.species}
                    size={38}
                    className="[--sprite:38px]"
                  />

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[13px] text-text">{cartaLabel(c)}</span>
                      {c.shiny ? <Badge tone="accent" dot={false}>shiny</Badge> : null}
                      {!pronta ? <Badge tone="warn">sem stats</Badge> : null}
                    </span>
                    <span className="pix flex flex-wrap items-center gap-x-2 text-[10px] text-text-mute">
                      {pronta ? <span>LV {c.level}</span> : null}
                      <span>Q {num(c.quality, 2)}</span>
                      <span>IV {totalIv}/{IV_MAX_TOTAL}</span>
                      {pronta ? <span>VID {compact(c.stats![0])}</span> : null}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      <TypeBadge type={c.type1} size="xs" />
                      {c.type2 ? <TypeBadge type={c.type2} size="xs" /> : null}
                    </span>
                  </div>

                  <span className="flex shrink-0 items-center gap-1">
                    <IconButton label={`Editar ${cartaLabel(c)}`} title="Editar" size="sm" onClick={() => onEditar(c)}>
                      <Pencil size={13} strokeWidth={2.25} />
                    </IconButton>
                    <IconButton
                      label={`Apagar ${cartaLabel(c)}`}
                      title="Apagar da bolsa"
                      size="sm"
                      onClick={() => onApagar(c.id)}
                    >
                      <Trash2 size={13} strokeWidth={2.25} />
                    </IconButton>
                    <Button
                      size="sm"
                      onClick={() => onEscolher(c)}
                      disabled={!pronta}
                      title={pronta ? undefined : "Esta carta ainda não tem stats"}
                    >
                      {slotAlvo != null ? `Pôr no #${slotAlvo + 1}` : "Pôr no time"}
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {cartas.some((c) => !cartaCompleta(c)) ? (
          <Note tone="warn" flush>
            As cartas marcadas vieram da estante antiga do Breeding, salvas só com o IV.
            Abra a edição e digite os stats pra elas poderem entrar no time.
          </Note>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * A barra do DECK: qual time está aberto, e o que dá pra fazer com ele.
 *
 * Deck é referência a carta, não cópia — corrigir o nível do Charizard numa
 * carta arruma todos os decks em que ele está. Por isso "salvar" aqui grava
 * quais CARTAS estão nos seis lugares, e nada dos números.
 */
export function BarraDeck({
  decks,
  atual,
  nome,
  onNome,
  onCarregar,
  onSalvar,
  onApagar,
  onNovo,
  onAbrirBolsa,
  podeSalvar,
}: {
  decks: Deck[];
  /** nome do deck aberto; "" = time montado na hora */
  atual: string;
  nome: string;
  onNome: (v: string) => void;
  onCarregar: (id: string) => void;
  onSalvar: () => void;
  onApagar: (id: string) => void;
  onNovo: () => void;
  onAbrirBolsa: () => void;
  podeSalvar: boolean;
}) {
  const deckAberto = decks.find((d) => d.nome === atual) ?? null;

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Deck" className="min-w-[10rem] flex-1">
          <Select
            value={deckAberto?.id ?? ""}
            onChange={onCarregar}
            options={[
              { value: "", label: decks.length ? "escolher um deck..." : "nenhum deck salvo" },
              ...decks.map((d) => ({
                value: d.id,
                label: d.nome,
                hint: `${d.cartas.filter(Boolean).length} de 6`,
              })),
            ]}
          />
        </Field>

        <Field label="Nome deste time" className="min-w-[10rem] flex-1">
          <Input
            value={nome}
            onChange={(e) => onNome(e.currentTarget.value)}
            placeholder="ex: caçada de boss"
            maxLength={32}
          />
        </Field>

        <Button onClick={onSalvar} disabled={!podeSalvar || !nome.trim()}>
          Salvar deck
        </Button>
        <Button variant="ghost" onClick={onNovo}>
          Novo deck
        </Button>
        <Button variant="ghost" onClick={onAbrirBolsa}>
          Abrir bolsa
        </Button>
      </div>

      {decks.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {decks.map((d) => (
            <span
              key={d.id}
              className={cn(
                "flex items-center gap-1 rounded-pix border py-0.5 pl-2 pr-0.5 text-[12px]",
                d.nome === atual
                  ? "border-[color-mix(in_oklab,var(--tint)_45%,var(--color-line))] bg-surface-3 text-text"
                  : "border-line-strong bg-surface-2 text-text-dim",
              )}
              style={{ "--tint": TINT } as React.CSSProperties}
            >
              <button
                type="button"
                className="max-w-[10rem] truncate hover:text-text"
                onClick={() => onCarregar(d.id)}
              >
                {d.nome}
              </button>
              <IconButton
                label={`Apagar o deck ${d.nome}`}
                title="Apagar deck"
                size="sm"
                onClick={() => onApagar(d.id)}
              >
                <IconClose size={12} />
              </IconButton>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
