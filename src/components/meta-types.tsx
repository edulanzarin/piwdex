"use client";

import { useMemo, useState } from "react";
import { ALL_TYPES, effectiveness, TYPE_COLOR } from "@/lib/typing";
import { amplify } from "@/lib/combat";
import { playableSet, typeStandings, type MetaMon } from "@/lib/meta";
import type { PokeType } from "@/lib/types";
import { Sprite } from "./sprite";
import { spriteUrl } from "@/lib/sprites";
import { TypeBadge, TypeBadges } from "./badges";
import { fmtDps, MonCell } from "./meta-tool";
import { useT } from "./locale-provider";

const ACCENT = "var(--pink)";

/** Cor do multiplicador: quente = te machuca, fria = voce aguenta. */
const multColor = (m: number): string =>
  m === 0 ? "var(--text-dim)" : m > 2 ? "var(--red)" : m > 1 ? "var(--yellow)" : m < 1 ? "var(--green)" : "var(--text-dim)";

const fmtMult = (m: number): string => (m === 0 ? "0" : `${Math.round(m * 100) / 100}x`);

/** Analise por TIPO, nao por pokemon: serve pra decidir "que tipo levar pra essa hunt"
 *  antes de escolher a especie. Os multiplicadores sao os de hunt (ja amplificados). */
export function MetaTypes({ mons, onOpen }: { mons: MetaMon[]; onOpen: (m: MetaMon) => void }) {
  const t = useT();
  const [picked, setPicked] = useState<PokeType[]>([]);
  const playable = useMemo(() => playableSet(mons), [mons]);
  const standings = useMemo(() => typeStandings(mons, "tm"), [mons]);

  const toggle = (ty: PokeType) =>
    setPicked((cur) =>
      cur.includes(ty) ? cur.filter((x) => x !== ty) : cur.length >= 2 ? [cur[1], ty] : [...cur, ty],
    );

  const [d1, d2] = [picked[0] ?? null, picked[1] ?? null];

  // Defesa: o que cada um dos 18 tipos faz contra a combinacao escolhida.
  const incoming = useMemo(() => {
    if (!d1) return [];
    return ALL_TYPES
      .map((atk) => ({ type: atk, mult: amplify(effectiveness(atk, d1, d2)) }))
      .sort((a, b) => b.mult - a.mult);
  }, [d1, d2]);

  // Ataque: o melhor multiplicador que a combinacao escolhida consegue contra cada
  // defensor — e o que interessa, porque voce escolhe qual dos dois golpes usar.
  const outgoing = useMemo(() => {
    if (!d1) return [];
    const atkTypes = d2 ? [d1, d2] : [d1];
    return ALL_TYPES
      .map((def) => ({
        type: def,
        mult: Math.max(...atkTypes.map((a) => amplify(effectiveness(a, def, null)))),
      }))
      .sort((a, b) => b.mult - a.mult);
  }, [d1, d2]);

  const withCombo = useMemo(() => {
    if (!d1) return [];
    return playable.filter((m) => {
      const ts = [m.type1, m.type2].filter(Boolean);
      return d2 ? ts.includes(d1) && ts.includes(d2) : ts.includes(d1);
    });
  }, [playable, d1, d2]);

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-4 sm:p-5">
        <h3 className="pixel text-lg text-text">{t("meta.typePick")}</h3>
        <p className="mt-1 text-xs text-text-dim">{t("meta.typePickDesc")}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ALL_TYPES.map((ty) => {
            const on = picked.includes(ty);
            return (
              <button
                key={ty}
                type="button"
                onClick={() => toggle(ty)}
                className={`transition ${on ? "" : "opacity-45 hover:opacity-80"}`}
                style={on ? { filter: "drop-shadow(0 0 8px currentColor)", color: TYPE_COLOR[ty] } : undefined}
              >
                <TypeBadge type={ty} />
              </button>
            );
          })}
          {picked.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked([])}>
              {t("meta.clear")}
            </button>
          )}
        </div>
      </section>

      {d1 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <MultGrid
            title={t("meta.typeIncoming")}
            desc={t("meta.typeIncomingDesc")}
            rows={incoming}
          />
          <MultGrid
            title={t("meta.typeOutgoing")}
            desc={t("meta.typeOutgoingDesc")}
            rows={outgoing}
          />
        </div>
      )}

      {d1 && (
        <section className="card p-4 sm:p-5">
          <h3 className="pixel text-lg text-text">{t("meta.typeSpecies")}</h3>
          <p className="mt-1 text-xs text-text-dim">{t("meta.typeSpeciesDesc", { n: withCombo.length })}</p>
          {withCombo.length === 0 ? (
            <p className="mt-4 text-sm text-text-dim">{t("meta.none")}</p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {withCombo.map((m) => (
                <div key={m.pokeId} className="well flex min-w-0 items-center gap-2 p-2.5">
                  <MonCell mon={m} onOpen={onOpen} />
                  <span className="ml-auto shrink-0"><TypeBadges t1={m.type1} t2={m.type2} /></span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Panorama: quem bate mais forte com cada tipo. Sempre com TM, porque a pergunta
          aqui e "de qual tipo sai o golpe mais forte do jogo" — o teto, nao o comum. */}
      <section className="card p-4 sm:p-5">
        <h3 className="pixel text-lg text-text">{t("meta.typeTop")}</h3>
        <p className="mt-1 text-xs text-text-dim">{t("meta.typeTopDesc")}</p>
        <div className="mt-4 max-w-full overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-text-dim">
              <tr>
                <th className="w-32 px-2 py-2">{t("meta.col.type")}</th>
                <th className="px-2 py-2">{t("meta.col.bestUser")}</th>
                <th className="px-2 py-2">{t("meta.col.move")}</th>
                <th className="w-24 px-2 py-2 text-right">{t("meta.col.dps")}</th>
                <th className="w-20 px-2 py-2 text-right">{t("meta.col.users")}</th>
                <th className="w-20 px-2 py-2 text-right">{t("meta.col.speciesOfType")}</th>
              </tr>
            </thead>
            <tbody>
              {ALL_TYPES.map((ty) => {
                const s = standings.get(ty);
                if (!s) return null;
                return (
                  <tr key={ty} className="border-t border-border/60">
                    <td className="px-2 py-2"><TypeBadge type={ty} /></td>
                    <td className="px-2 py-2">
                      {s.bestUser ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <Sprite src={spriteUrl(s.bestUser.pokeId)} alt={s.bestUser.name} size={28} />
                          <button type="button" className="truncate text-text transition hover:text-cyan" onClick={() => onOpen(s.bestUser!)}>
                            {s.bestUser.name}
                          </button>
                        </span>
                      ) : <span className="text-text-dim">—</span>}
                    </td>
                    <td className="px-2 py-2 text-text-dim">{s.bestMove?.name ?? "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: ACCENT }}>{fmtDps(s.bestDps)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-text-dim">{s.users}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-text-dim">{s.species}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MultGrid({
  title, desc, rows,
}: {
  title: string; desc: string; rows: { type: PokeType; mult: number }[];
}) {
  return (
    <section className="card p-4 sm:p-5">
      <h3 className="pixel text-lg text-text">{title}</h3>
      <p className="mt-1 text-xs text-text-dim">{desc}</p>
      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.type} className="well flex items-center justify-between gap-2 p-2">
            <TypeBadge type={r.type} />
            <span className="pixel tabular-nums" style={{ color: multColor(r.mult) }}>{fmtMult(r.mult)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
