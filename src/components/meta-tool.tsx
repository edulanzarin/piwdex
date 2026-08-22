"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { metaTable, playableSet, type MetaMon } from "@/lib/meta";
import { unpackMon, type PackedMon } from "@/lib/meta-data";
import { buildMetaSearch, parseMetaState, type MetaState } from "@/lib/meta-url";
import { Field, FieldRow, Note, Panel, Segmented, Tabs } from "@/components/ui";
import { IconTm } from "@/components/game-icons";
import { MetaTier } from "@/components/meta-tier";
import { MetaProfile } from "@/components/meta-profile";
import { MetaDuel } from "@/components/meta-duel";
import { MetaTypes } from "@/components/meta-types";

/**
 * O Meta: quem presta, contra quem, e por que.
 *
 * Tres vistas sobre o mesmo catalogo, e a ordem nao e alfabetica — e da pergunta
 * mais comum pra mais especifica:
 *
 *   TIER LIST  "quem presta?" — o catalogo inteiro com nota e faixa.
 *   DUELO      "esse meu ganha desse?" — dois INDIVIDUOS, com nivel e quality.
 *   TIPOS      "meu time nao tem nada de Pedra, quem eu pego?" — o panorama
 *              ofensivo de cada tipo.
 *
 * O POOL de golpes vale pras tres, e por isso mora aqui em cima: todo golpe de
 * poder 600 do jogo e TM, entao trocar o pool troca o ranking inteiro. Escondido
 * dentro de uma aba, ele mudaria a resposta das outras duas em silencio.
 *
 * Onde isto diverge do piwtools esta no motor (`meta.ts`), de proposito: la o
 * ataque e `poder x stat` (que trata um golpe de 30s de recarga igual a um de 5s),
 * a defesa e `hp + def` (que diz que 200 de HP com 20 de Def aguenta o mesmo que o
 * contrario, quando o primeiro aguenta 10x) e o tier sai da POSICAO na fila (que
 * faz o tier significar "seu lugar", nao "sua forca").
 */
export function MetaTool({ mons: packed }: { mons: PackedMon[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [s, setS] = useState<MetaState>(() => parseMetaState(new URLSearchParams(sp.toString())));

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(`${pathname}${buildMetaSearch(s)}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [s, router, pathname]);

  const patch = useCallback((p: Partial<MetaState>) => setS((old) => ({ ...old, ...p })), []);

  const mons = useMemo<MetaMon[]>(() => packed.map(unpackMon), [packed]);
  // O conjunto JOGAVEL tira as variantes de skin (Brave Blastoise e companhia
  // apontam pra base e nao sao uma linha propria do catalogo). Sem isso a mesma
  // especie aparece duas vezes na tier list.
  const jogaveis = useMemo(() => playableSet(mons), [mons]);
  const table = useMemo(() => metaTable(mons, s.pool), [mons, s.pool]);
  const byId = useMemo(() => new Map(table.map((e) => [e.creature.pokeId, e])), [table]);

  const aberto = s.focus != null ? byId.get(s.focus) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={s.view}
        onChange={(view) => patch({ view })}
        items={[
          { value: "tiers", label: "Tier list", count: jogaveis.length },
          { value: "duelo", label: "Duelo" },
          { value: "tipos", label: "Tipos" },
        ]}
      />

      <Panel bodyClassName="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <FieldRow>
          <Field label="Golpes considerados" icon={<IconTm size={14} />}>
            <Segmented
              value={s.pool}
              onChange={(pool) => patch({ pool })}
              options={[
                { value: "natural", label: "só naturais", title: "O que a espécie aprende sozinha, sem comprar máquina" },
                { value: "tm", label: "com TM", title: "Inclui golpes de máquina; todo golpe de poder 600 do jogo é TM" },
              ]}
            />
          </Field>
        </FieldRow>
        <Note flush className="max-w-[46rem]">
          {s.pool === "tm"
            ? "Com TM a nota responde “quem presta se eu comprar a máquina”. O golpe de poder 600 abre um vale entre o básico e a evolução final, então o corte de cada tier cai noutro lugar."
            : "Só naturais é o que todo jogador tem sem gastar nada. A pergunta vira “entre o que eu já posso usar, quem presta?”, e a régua de corte muda junto."}
        </Note>
      </Panel>

      {s.view === "tiers" ? (
        <MetaTier
          table={table}
          state={s}
          patch={patch}
          onOpen={(m) => patch({ focus: m.pokeId })}
        />
      ) : s.view === "duelo" ? (
        <MetaDuel mons={jogaveis} state={s} patch={patch} pool={s.pool} />
      ) : (
        <MetaTypes mons={mons} pool={s.pool} onOpen={(m) => patch({ focus: m.pokeId })} />
      )}

      {/* O perfil e modal e nao aba: ele e sempre SOBRE alguem que voce acabou de
          ver numa lista, e virar de tela faria perder o lugar da lista. */}
      <MetaProfile
        entry={aberto}
        mons={jogaveis}
        pool={s.pool}
        onOpen={(m) => patch({ focus: m.pokeId })}
        onClose={() => patch({ focus: null })}
      />
    </div>
  );
}
