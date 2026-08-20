"use client";

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { arenaDuel, defaultIvs, type ArenaResult, type Fighter, type MetaMon, type MovePool } from "@/lib/meta";
import { STAT_LABELS } from "@/lib/stats";
import { Sprite } from "./sprite";
import { TypeBadges, TypeBadge } from "./badges";
import { StatIcon } from "./stat-icons";
import { PokemonCombobox } from "./pokemon-combobox";
import { Modal } from "./modal";
import { useT } from "./locale-provider";

const ACCENT = "var(--pink)";
const TEAM_MAX = 6;
const IV_MAX = 32;
const STORE_KEY = "piwdex-stadium-v1";

/** Carta do Stadium: a especie mais o que o individuo tem. Guardada por pokeId + nivel,
 *  entao a mesma especie pode entrar duas vezes com builds diferentes. */
interface Card {
  id: string;
  pokeId: number;
  level: number;
  quality: number;
  ivs: number[];
  wild: boolean;
}

interface Deck {
  name: string;
  target: Card | null;
  team: Card[];
}

const EMPTY: Deck = { name: "", target: null, team: [] };

const newCard = (mon: MetaMon, wild: boolean): Card => ({
  id: `${mon.pokeId}-${Math.round(performance.now() * 1000)}`,
  pokeId: mon.pokeId,
  level: Math.max(1, mon.huntLevel || 50),
  quality: wild ? 1 : 1.3,
  ivs: defaultIvs(),
  wild,
});

/** Codifica o deck pra URL. Base64 de JSON: o deck e pequeno (7 cartas no maximo) e o
 *  link tem que funcionar sem servidor — quem abre nao precisa ter o deck salvo. */
function encodeDeck(d: Deck): string {
  const json = JSON.stringify(d);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeDeck(code: string): Deck | null {
  try {
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
    const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!d || typeof d !== "object" || !Array.isArray(d.team)) return null;
    // Validacao: link vem de fora, entao nada entra sem caber nos limites do jogo.
    const okCard = (c: unknown): boolean => {
      const x = c as Card;
      return !!x && Number.isFinite(x.pokeId) && Number.isFinite(x.level) && x.level >= 1 && x.level <= 10000
        && Number.isFinite(x.quality) && x.quality >= 0.01 && x.quality <= 5
        && Array.isArray(x.ivs) && x.ivs.length === 6 && x.ivs.every((v) => Number.isFinite(v) && v >= 0 && v <= IV_MAX);
    };
    if (d.target && !okCard(d.target)) return null;
    if (d.team.length > TEAM_MAX || !d.team.every(okCard)) return null;
    return { name: String(d.name ?? "").slice(0, 80), target: d.target ?? null, team: d.team };
  } catch {
    return null;
  }
}

export function MetaStadium({ mons, pool }: { mons: MetaMon[]; pool: MovePool }) {
  const t = useT();
  const byId = useMemo(() => new Map(mons.map((m) => [m.pokeId, m])), [mons]);
  const combo = useMemo(() => [...mons].sort((a, b) => a.name.localeCompare(b.name)), [mons]);

  const [deck, setDeck] = useState<Deck>(EMPTY);
  const [editing, setEditing] = useState<Card | null>(null);
  const [adding, setAdding] = useState<"target" | "team" | null>(null);
  const [notice, setNotice] = useState("");

  // Link compartilhado ganha do que estava salvo: quem abriu o link quer VER o link.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("deck");
    const shared = code ? decodeDeck(code) : null;
    if (shared) { setDeck(shared); return; }
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) { const d = decodeDeck(saved); if (d) setDeck(d); }
  }, []);

  const persist = (d: Deck) => {
    setDeck(d);
    try { localStorage.setItem(STORE_KEY, encodeDeck(d)); } catch { /* quota cheia: o deck vive so na tela */ }
  };

  const monOf = (c: Card): MetaMon | null => byId.get(c.pokeId) ?? null;

  const target = deck.target;

  // Cada membro do time contra o alvo, do que ganha com mais folga pro que apanha.
  const results = useMemo(() => {
    const toFighter = (c: Card): Fighter | null => {
      const mon = byId.get(c.pokeId);
      return mon ? { mon, level: c.level, quality: c.quality, ivs: c.ivs, wild: c.wild } : null;
    };
    const foe = target ? toFighter(target) : null;
    if (!foe) return [];
    return deck.team
      .map((c) => {
        const f = toFighter(c);
        return f ? { card: c, mon: f.mon, res: arenaDuel(f, foe, pool) } : null;
      })
      .filter((x): x is { card: Card; mon: MetaMon; res: ArenaResult } => x !== null)
      .sort((a, b) => b.res.margin - a.res.margin);
  }, [deck.team, target, pool, byId]);

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?deck=${encodeDeck(deck)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(t("meta.stadium.shared"));
    } catch {
      setNotice(url);
    }
    window.setTimeout(() => setNotice(""), 4000);
  };

  const addCard = (mon: MetaMon) => {
    if (adding === "target") persist({ ...deck, target: newCard(mon, true) });
    else if (adding === "team" && deck.team.length < TEAM_MAX) persist({ ...deck, team: [...deck.team, newCard(mon, false)] });
    setAdding(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h3 className="pixel text-lg text-text">{t("meta.stadium.title")}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-dim">{t("meta.stadium.desc")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={share} disabled={!deck.target && !deck.team.length}>
            {t("meta.stadium.share")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => persist(EMPTY)}>
            {t("meta.stadium.clear")}
          </button>
        </div>
      </section>

      {notice && <p className="card p-3 text-center text-sm text-green [overflow-wrap:anywhere]">{notice}</p>}

      {/* ---- alvo ---- */}
      <section className="card p-4 sm:p-5">
        <h4 className="field-label">{t("meta.stadium.target")}</h4>
        <p className="mt-1 text-xs text-text-dim">{t("meta.stadium.targetHint")}</p>
        <div className="mt-3">
          {deck.target ? (
            <CardTile
              card={deck.target} mon={monOf(deck.target)}
              onEdit={() => setEditing(deck.target)}
              onRemove={() => persist({ ...deck, target: null })}
            />
          ) : (
            <button type="button" className="well well-hover flex w-full items-center justify-center gap-2 p-6 text-sm text-text-dim" onClick={() => setAdding("target")}>
              + {t("meta.stadium.addTarget")}
            </button>
          )}
        </div>
      </section>

      {/* ---- time ---- */}
      <section className="card p-4 sm:p-5">
        <h4 className="field-label">{t("meta.stadium.team", { n: deck.team.length, max: TEAM_MAX })}</h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {deck.team.map((c) => (
            <CardTile
              key={c.id} card={c} mon={monOf(c)}
              onEdit={() => setEditing(c)}
              onRemove={() => persist({ ...deck, team: deck.team.filter((x) => x.id !== c.id) })}
            />
          ))}
          {deck.team.length < TEAM_MAX && (
            <button type="button" className="well well-hover flex items-center justify-center gap-2 p-6 text-sm text-text-dim" onClick={() => setAdding("team")}>
              + {t("meta.stadium.addTeam")}
            </button>
          )}
        </div>
      </section>

      {/* ---- resultado ---- */}
      {target && results.length > 0 && (
        <section className="card p-4 sm:p-5">
          <h4 className="pixel text-lg text-text">{t("meta.stadium.result")}</h4>
          <p className="mt-1 text-xs text-text-dim">{t("meta.stadium.resultDesc")}</p>
          <div className="mt-4 flex flex-col gap-2">
            {results.map(({ card, mon, res }, i) => (
              <ResultRow key={card.id} rank={i + 1} mon={mon} card={card} res={res} />
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-text-dim">{t("meta.stadium.note")}</p>
        </section>
      )}

      {adding && (
        <Modal onClose={() => setAdding(null)}>
          <div className="p-4 sm:p-5">
            <h4 className="pixel text-lg text-text">
              {t(adding === "target" ? "meta.stadium.addTarget" : "meta.stadium.addTeam")}
            </h4>
            <div className="mt-4">
              <PokemonCombobox creatures={combo} value={null} onSelect={(m) => m && addCard(m)} placeholder={t("meta.searchPlaceholder")} />
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <CardEditor
          card={editing}
          mon={monOf(editing)}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            persist(
              editing.id === deck.target?.id
                ? { ...deck, target: c }
                : { ...deck, team: deck.team.map((x) => (x.id === c.id ? c : x)) },
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CardTile({
  card, mon, onEdit, onRemove,
}: {
  card: Card; mon: MetaMon | null; onEdit: () => void; onRemove: () => void;
}) {
  const t = useT();
  if (!mon) return null;
  return (
    <div className="well flex min-w-0 items-center gap-3 p-3">
      <Sprite src={spriteUrl(mon.pokeId)} alt={mon.name} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-text">{mon.name}</p>
        <p className="text-xs text-text-dim">
          Lv. {card.level} · Q {card.quality.toFixed(2)}
          {card.wild && <span className="ml-1 text-yellow">· {t("meta.stadium.wildTag")}</span>}
        </p>
        <div className="mt-1"><TypeBadges t1={mon.type1} t2={mon.type2} /></div>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>{t("meta.stadium.edit")}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>×</button>
      </div>
    </div>
  );
}

function ResultRow({ rank, mon, card, res }: { rank: number; mon: MetaMon; card: Card; res: ArenaResult }) {
  const t = useT();
  const win = res.win;
  const color = win ? "var(--green)" : "var(--red)";
  const margin = res.margin === Infinity ? "∞" : `${res.margin.toFixed(2)}x`;
  return (
    <div className="well flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <span className="pixel w-6 shrink-0 text-center text-text-dim">{rank}</span>
      <Sprite src={spriteUrl(mon.pokeId)} alt={mon.name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-text">{mon.name} <span className="text-xs text-text-dim">Lv. {card.level}</span></p>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-text-dim">
          {res.me.move ? (
            <>
              {res.me.move.name}
              <TypeBadge type={res.me.move.type} icon={false} />
              <span style={{ color: ACCENT }}>{res.me.eff.toFixed(2)}x</span>
            </>
          ) : t("meta.stadium.noMove")}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-4 text-xs">
        <span className="flex flex-col">
          <span className="field-label">{t("meta.stadium.ttk")}</span>
          <span className="tabular-nums text-text">{Number.isFinite(res.me.ttk) ? `${res.me.ttk.toFixed(1)}s` : "—"}</span>
        </span>
        <span className="flex flex-col">
          <span className="field-label">{t("meta.stadium.ttd")}</span>
          <span className="tabular-nums text-text">{Number.isFinite(res.foe.ttk) ? `${res.foe.ttk.toFixed(1)}s` : "∞"}</span>
        </span>
        <span className="flex flex-col">
          <span className="field-label">{t("meta.stadium.margin")}</span>
          <span className="pixel tabular-nums" style={{ color }}>{margin}</span>
        </span>
        <span className="chip" style={{ background: color, color: "#06131a" }}>
          {t(win ? "meta.stadium.win" : "meta.stadium.lose")}
        </span>
      </div>
    </div>
  );
}

function CardEditor({
  card, mon, onClose, onSave,
}: {
  card: Card; mon: MetaMon | null; onClose: () => void; onSave: (c: Card) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<Card>(card);
  if (!mon) return null;

  const setIv = (i: number, v: number) =>
    setDraft((d) => ({ ...d, ivs: d.ivs.map((x, j) => (j === i ? Math.max(0, Math.min(IV_MAX, v)) : x)) }));

  return (
    <Modal onClose={onClose}>
      <div className="flex max-h-[80vh] flex-col">
        <header className="flex items-center gap-3 border-b border-border p-4">
          <Sprite src={spriteUrl(mon.pokeId)} alt={mon.name} size={48} />
          <div className="min-w-0">
            <h4 className="pixel text-lg text-text">{mon.name}</h4>
            <TypeBadges t1={mon.type1} t2={mon.type2} />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="field-label">{t("meta.stadium.level")}</span>
              <input
                className="input" inputMode="numeric" value={draft.level}
                onChange={(e) => setDraft((d) => ({ ...d, level: Math.max(1, Math.min(10000, Number(e.target.value) || 1)) }))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="field-label">{t("meta.stadium.quality")}</span>
              <input
                className="input" inputMode="decimal" value={draft.quality}
                onChange={(e) => setDraft((d) => ({ ...d, quality: Math.max(0.01, Math.min(5, Number(String(e.target.value).replace(",", ".")) || 1)) }))}
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2">
            <input type="checkbox" checked={draft.wild} onChange={(e) => setDraft((d) => ({ ...d, wild: e.target.checked }))} />
            <span className="text-sm text-text">{t("meta.stadium.isWild")}</span>
          </label>
          <p className="mt-1 text-xs text-text-dim">{t("meta.stadium.isWildHint")}</p>

          <p className="field-label mt-4">{t("meta.stadium.ivs")}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {draft.ivs.map((v, i) => (
              <label key={i} className="flex items-center gap-2">
                <StatIcon index={i} size={16} />
                <span className="w-14 shrink-0 text-xs text-text-dim">{STAT_LABELS[i]}</span>
                <input className="input input-sm" inputMode="numeric" value={v} onChange={(e) => setIv(i, Number(e.target.value) || 0)} />
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-text-dim">{t("meta.stadium.ivsHint")}</p>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border p-4">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t("meta.stadium.cancel")}</button>
          <button type="button" className="btn btn-pink btn-sm" onClick={() => onSave(draft)}>{t("meta.stadium.save")}</button>
        </footer>
      </div>
    </Modal>
  );
}
