import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { CHANCE_MAX } from "@/lib/boost";
import { lastKnownTypeDay } from "@/lib/game-boosts";
import { itemIconUrl } from "@/lib/sprites";
import { enemyCombatStats, type EnemyCombat, type Species, type Move } from "@/lib/combat";
import { HuntTool } from "@/components/hunt-tool";
import type { HuntRow } from "@/components/hunt-planner";
import type { PokeType } from "@/lib/types";
import { T } from "@/components/locale-provider";
import { CatalogStamp } from "@/components/catalog-stamp";

export const metadata: Metadata = { title: "Hunt Planner" };

export default async function HuntPage() {
  const db = await getData();
  const { creatures, hunts } = db;
  const areas = [...new Set(hunts.map((h) => h.area))].sort();

  const rows: HuntRow[] = [];
  const enemies: EnemyCombat[] = [];
  const species: Species[] = [];
  // [chance, quantidade media, preco] por pokemon. E o minimo pro cliente refazer a conta
  // do ouro sob qualquer multiplicador RESPEITANDO o teto de chance — sem isso o Tipo do
  // Dia viraria um "+20% em cima do total", que e exatamente o erro que o teto desmente.
  const dropsByPoke: Record<number, [number, number, number][]> = {};

  for (const c of creatures) {
    const bases = [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed];
    // Todo pokemon vira "especie" selecionavel (o jogador pode ter qualquer um).
    const moves: Move[] = c.attacks.map((a) => ({
      type: a.type as PokeType,
      power: a.power,
      learn: a.learnLevel,
      category: a.category,
      cooldownMs: a.cooldownMs,
      tm: a.tm != null,
    }));
    species.push({
      pokeId: c.pokeId,
      name: c.name,
      t1: c.type1,
      t2: c.type2,
      bases,
      evolvesToId: c.evolvesToId,
      evolveLevel: c.evolveLevel,
      moves,
    });

    const locs = db.locationsOf(c);
    if (locs.length === 0) continue; // so quem tem spot vira alvo de hunt

    // Ouro esperado por kill (EV do loot) + o drop que MAIS PAGA.
    //
    // "Mais paga" e por valor esperado (chance x quantidade x preco), nao pelo item mais
    // caro: 346 das 482 especies listam o Strange Pheromone, que vale 1.000.000 e tem
    // chance ZERO — nunca cai. Ordenar por preco fazia a tabela inteira anunciar como
    // melhor drop um item que nao existe na pratica.
    let gold = 0;
    let top: { name: string; icon: string; ev: number } | null = null;
    for (const l of c.loot) {
      const it = db.getItemByName(l.name);
      const price = it?.npcPrice ?? 0;
      const qty = (l.minCount + l.maxCount) / 2;
      const ev = (Math.min(CHANCE_MAX, l.chance) / CHANCE_MAX) * qty * price;
      gold += ev;
      if (it && ev > 0 && (!top || ev > top.ev)) {
        top = { name: it.name, icon: itemIconUrl(it), ev };
      }
    }
    const goldEV = Math.round(gold);
    const rowAreas = [...new Set(locs.map((h) => h.area))].sort();

    const packed: [number, number, number][] = [];
    for (const l of c.loot) {
      const price = db.getItemByName(l.name)?.npcPrice ?? 0;
      if (price <= 0 || l.chance <= 0) continue;
      packed.push([l.chance, (l.minCount + l.maxCount) / 2, price]);
    }
    if (packed.length) dropsByPoke[c.pokeId] = packed;

    rows.push({
      pokeId: c.pokeId,
      name: c.name,
      type1: c.type1,
      type2: c.type2,
      xp: c.experience,
      gold: goldEV,
      sell: c.sellValue,
      huntLevel: c.huntLevel,
      areas: rowAreas,
      spotCount: locs.length,
      topDrop: top ? { name: top.name, icon: top.icon } : null,
      bases,
    });

    const hl = Math.max(1, c.huntLevel);
    const cs = enemyCombatStats(bases, hl);
    enemies.push({
      pokeId: c.pokeId,
      name: c.name,
      t1: c.type1,
      t2: c.type2,
      huntLevel: hl,
      areas: rowAreas,
      spotCount: locs.length,
      xp: c.experience,
      goldEV,
      ...cs, // hp (x5), def, spDef + atk/spAtk: o wild tambem bate (ver threatOf)
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecalho da ferramenta: sem a moldura colorida quem da corpo e o vidro do
          card — titulo e descricao ficam num painel so, e o conteudo
          abaixo (cards) nao fica solto na pagina. */}
      <header className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="pixel text-3xl [overflow-wrap:anywhere]" style={{ color: "var(--yellow)" }}><T k="hunt.title" /></h1>
          <CatalogStamp at={db.generatedAt} live={db.live} error={db.error} />
        </div>
        <p className="mt-3 max-w-2xl text-base text-text-dim">
          <T k="hunt.route.desc" />
        </p>
      </header>
      <HuntTool
        rows={rows}
        areas={areas}
        species={species}
        enemies={enemies}
        drops={dropsByPoke}
        dayType={lastKnownTypeDay()?.type ?? null}
        dayPct={lastKnownTypeDay()?.lootPct ?? null}
      />
    </div>
  );
}
