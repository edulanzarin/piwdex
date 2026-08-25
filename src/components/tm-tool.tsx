"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { unpackMon, type PackedMon } from "@/lib/meta-data";
import { metaTable, playableSet, type MetaMon, type Tier } from "@/lib/meta";
import { lerBolsa, type Carta } from "@/lib/bolsa";
import { ALL_TYPES } from "@/lib/typing";
import { TYPE_LABEL, compact, num } from "@/lib/labels";
import type { PokeType } from "@/lib/types";
import type { DiscoItem } from "@/lib/tm-data";
import {
  aprendeTm,
  ganhoDe,
  ganhoDoDisco,
  montarDiscos,
  statsDaCarta,
  type GanhoTm,
} from "@/lib/tm";
import { buildTmSearch, parseTmState } from "@/lib/tm-url";
import { Metric, MetricGrid, Note, Panel } from "@/components/ui";
import { TmDiscos, type LinhaDisco } from "@/components/tm-discos";
import { TmQuem, type LinhaQuem } from "@/components/tm-quem";

const TINT = "var(--color-t-tm)";
const MOSTRA = 12;

/**
 * O DISCO DE TM: qual trocar, e em quem pôr.
 *
 * A ferramenta existe porque o TM é o maior salto de poder do jogo e ninguém
 * publica onde ele rende: o melhor golpe natural das 482 espécies faz 43,3 de
 * poder por segundo, e todo golpe de TM faz 60. E porque a escolha é do mesmo
 * formato da troca do Eevee — o Researcher cobra o MESMO tanto de peças por
 * qualquer disco, então o preço não separa nada e a pergunta inteira vira "quem
 * aproveita".
 *
 * A tela responde nas duas direções que a pessoa realmente tem:
 *
 *  - **"Vou trocar minhas peças — por qual disco?"** A grade de cima, com quantos
 *    DOS SEUS aprendem cada um quando há bolsa cadastrada.
 *  - **"Tenho o disco de Fogo — em quem eu ponho?"** A lista de baixo, ordenada
 *    pelo salto e não pelo dano final.
 *
 * E ela mostra o que o disco faz com o TIER, que é a leitura que fecha a decisão:
 * um Jolteon que sobe de B pra S com um disco de Elétrico é outra conversa que um
 * Scizor que já era B e continua B batendo mais.
 */
export function TmTool({
  mons: packed,
  discos: itens,
}: {
  mons: PackedMon[];
  discos: DiscoItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [estado, setEstado] = useState(() =>
    parseTmState(new URLSearchParams(sp.toString())),
  );
  const [ordem, setOrdem] = useState<"razao" | "final">("razao");
  const { disco: escolhido, meus } = estado;

  useEffect(() => {
    const id = window.setTimeout(() => {
      router.replace(`${pathname}${buildTmSearch(estado)}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(id);
  }, [estado, router, pathname]);

  const [bolsa, setBolsa] = useState<Carta[]>([]);
  useEffect(() => setBolsa(lerBolsa()), []);

  const mons = useMemo(() => packed.map(unpackMon) as MetaMon[], [packed]);
  const porId = useMemo(() => new Map(mons.map((m) => [m.pokeId, m])), [mons]);

  /**
   * O conjunto do CATÁLOGO é o jogável, o mesmo da tier list: sem variantes de
   * skin, que apareceriam duas vezes (Charizard e Brave Charizard aprendem o
   * mesmo disco). A bolsa não passa por esse filtro — se a pessoa cadastrou um
   * Brave Charizard, é dele que ela quer saber.
   */
  const jogaveis = useMemo(() => playableSet(mons).filter(aprendeTm), [mons]);

  const discos = useMemo(
    () => montarDiscos(jogaveis, [...ALL_TYPES]),
    [jogaveis],
  );
  const itemPorNome = useMemo(
    () => new Map(itens.map((i) => [i.nome, i])),
    [itens],
  );
  const aoe = itens.find((i) => i.tipo == null && i.nome.startsWith("AoE"));

  /** As cartas que dão pra medir: precisam de nível, senão a projeção inventa. */
  const cartas = useMemo(
    () =>
      bolsa
        .map((c) => ({ carta: c, mon: porId.get(c.pokeId) }))
        .filter(
          (x): x is { carta: Carta; mon: MetaMon } =>
            x.mon != null && aprendeTm(x.mon),
        )
        .filter((x) => typeof x.carta.level === "number" && x.carta.level > 0),
    [bolsa, porId],
  );
  const semNivel = bolsa.filter(
    (c) =>
      porId.get(c.pokeId) &&
      aprendeTm(porId.get(c.pokeId)!) &&
      !(c.level && c.level > 0),
  ).length;
  const temBolsa = cartas.length > 0;

  // Os dois tiers, do mesmo motor da tier list. É a comparação que fecha a
  // decisão: subir de faixa é outra conversa que somar dano dentro da mesma.
  const tiers = useMemo(() => {
    const nat = new Map<number, Tier>();
    const tm = new Map<number, Tier>();
    for (const e of metaTable(mons, "natural"))
      nat.set(e.creature.pokeId, e.tier);
    for (const e of metaTable(mons, "tm")) tm.set(e.creature.pokeId, e.tier);
    return { nat, tm };
  }, [mons]);

  const statsDe = (c: Carta, mon: MetaMon) =>
    statsDaCarta(mon, c.level ?? 100, c.quality || 1, c.ivs);

  // ---- a grade dos dezenove
  const linhasDisco: LinhaDisco[] = useMemo(
    () =>
      discos.map((d) => {
        const minhas = temBolsa
          ? cartas.filter((x) => x.mon.attacks.some((a) => a.tm === d.tipo))
              .length
          : null;
        const universo =
          temBolsa && meus
            ? cartas
                .filter((x) => x.mon.attacks.some((a) => a.tm === d.tipo))
                .map((x) =>
                  ganhoDoDisco(x.mon, d.tipo, statsDe(x.carta, x.mon)),
                )
            : d.quem.map((m) => ganhoDoDisco(m, d.tipo));
        const finitos = universo
          .map((g) => g.razao)
          .filter((r) => Number.isFinite(r));
        return {
          disco: d,
          item: itemPorNome.get(d.item),
          quantas: d.quem.length,
          minhas,
          melhorRazao: finitos.length ? Math.max(...finitos) : 0,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [discos, itemPorNome, cartas, temBolsa, meus],
  );

  // ---- a lista de baixo
  const linhasQuem: LinhaQuem[] = useMemo(() => {
    const doCatalogo = (): {
      mon: MetaMon;
      ganho: GanhoTm;
      carta: string | null;
    }[] => {
      const base = escolhido
        ? (discos.find((d) => d.tipo === escolhido)?.quem ?? [])
        : jogaveis;
      return base.map((m) => ({
        mon: m,
        ganho: escolhido ? ganhoDoDisco(m, escolhido) : ganhoDe(m),
        carta: null,
      }));
    };

    const daBolsa = (): {
      mon: MetaMon;
      ganho: GanhoTm;
      carta: string | null;
    }[] =>
      cartas
        .filter((x) =>
          escolhido ? x.mon.attacks.some((a) => a.tm === escolhido) : true,
        )
        .map((x) => {
          const st = statsDe(x.carta, x.mon);
          return {
            mon: x.mon,
            ganho: escolhido
              ? ganhoDoDisco(x.mon, escolhido, st)
              : ganhoDe(x.mon, st),
            carta: x.carta.name,
          };
        });

    const cru = meus && temBolsa ? daBolsa() : doCatalogo();

    return cru
      .map(({ mon, ganho, carta }) => ({
        ganho,
        carta,
        tierNat: tiers.nat.get(mon.pokeId) ?? null,
        tierTm: tiers.tm.get(mon.pokeId) ?? null,
        // STAB do golpe do disco: é o que separa um salto grande de um enorme.
        stab: ganho.golpes.some(
          (a) => a.type === mon.type1 || a.type === mon.type2,
        ),
      }))
      .sort((a, b) =>
        ordem === "razao"
          ? (Number.isFinite(b.ganho.razao) ? b.ganho.razao : 1e9) -
            (Number.isFinite(a.ganho.razao) ? a.ganho.razao : 1e9)
          : b.ganho.comTm - a.ganho.comTm,
      )
      .slice(0, MOSTRA);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolhido, meus, temBolsa, cartas, discos, jogaveis, tiers, ordem]);

  // Contado, e não escrito à mão. O primeiro número aqui era 28, medido sobre o
  // catálogo inteiro — mas a tela fala do conjunto JOGÁVEL, onde são 17: as skins
  // (Brave Charizard e companhia) herdam os discos da base e inflavam a conta.
  const comDois = useMemo(
    () =>
      jogaveis.filter(
        (m) => new Set(m.attacks.filter((a) => a.tm).map((a) => a.tm)).size > 1,
      ).length,
    [jogaveis],
  );

  const discoAtual = escolhido
    ? discos.find((d) => d.tipo === escolhido)
    : undefined;
  const comGolpe = discos.filter((d) => d.golpe != null).length;
  const sobem = linhasQuem.filter(
    (l) => l.tierTm && l.tierNat && l.tierTm !== l.tierNat,
  ).length;

  return (
    <div
      className="flex flex-col gap-4"
      style={{ "--tint": TINT } as CSSProperties}
    >
      <Panel bodyClassName="flex flex-col gap-3">
        <MetricGrid cols={4}>
          <Metric
            size="sm"
            value="60"
            suffix="/s"
            label="poder de todo TM"
            tint={TINT}
            hint="600 de poder a cada 10s"
          />
          <Metric
            size="sm"
            value="43,3"
            suffix="/s"
            label="o melhor natural"
            hint="entre os golpes de todas as 482 espécies"
          />
          <Metric
            size="sm"
            value={`${comGolpe}`}
            suffix={`/${discos.length}`}
            label="discos com golpe"
            hint="Normal, Aço e Fada têm disco e nenhum golpe"
          />
          <Metric
            size="sm"
            value={`${jogaveis.length}`}
            label="espécies aprendem"
            hint={`de 482 no catálogo; ${comDois} aprendem dois discos`}
          />
        </MetricGrid>

        <Note flush>
          O Researcher cobra o mesmo tanto de peças por qualquer disco — o preço
          não separa nada, então a escolha inteira é sobre quem aproveita. Um
          aviso do catálogo:{" "}
          <strong>
            Draconic Soul, o TM de Dragão, tem 300 de poder e não 600
          </strong>
          . É o único dos quinze pela metade, e quem troca esperando o salto dos
          outros leva metade dele.
        </Note>
      </Panel>

      <TmDiscos
        linhas={linhasDisco}
        escolhido={escolhido}
        onEscolher={(t) => setEstado((s) => ({ ...s, disco: t }))}
        aoe={aoe}
        temBolsa={temBolsa}
      />

      <TmQuem
        tipo={escolhido}
        golpe={discoAtual?.golpe ?? null}
        linhas={linhasQuem}
        ordem={ordem}
        onOrdem={setOrdem}
        meus={meus}
        onMeus={(v) => setEstado((s) => ({ ...s, meus: v }))}
        temBolsa={temBolsa}
      />

      {semNivel > 0 ? (
        <Note tone="warn">
          {semNivel} carta{semNivel > 1 ? "s" : ""} da sua bolsa aprende
          {semNivel > 1 ? "m" : ""} TM mas está sem nível — provavelmente vinda
          da estante antiga do Breeding, que só guardava o IV. Sem nível não dá
          pra projetar stat, então ela fica de fora do recorte “só os meus”.
        </Note>
      ) : null}

      {sobem > 0 ? (
        <Note>
          {sobem} d{sobem > 1 ? "os" : "o"} {linhasQuem.length} desta lista muda
          {sobem > 1 ? "m" : ""} de faixa na tier list com o disco. Subir nível
          e quality mexem no número e não na posição, porque todo mundo pode
          fazer o mesmo; o disco não, porque nem todo mundo aprende.
        </Note>
      ) : null}
    </div>
  );
}
