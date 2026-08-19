import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { itemIconUrl } from "@/lib/sprites";
import { pricedDrops } from "@/lib/boost";
import { BoostTool, type BoostRow } from "@/components/boost-tool";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Retorno de Boost" };

export default async function BoostPage() {
  const db = await getData();
  const areas = [...new Set(db.hunts.map((h) => h.area))].sort();

  // So quem tem spot entra: o boost se gasta caçando, e alvo sem hunt nao e
  // farmavel. O preco de cada drop e resolvido AQUI (uma vez) — o cliente so
  // recalcula o cenario em cima dos numeros ja prontos.
  const rows: BoostRow[] = [];
  for (const c of db.creatures) {
    const locs = db.locationsOf(c);
    if (locs.length === 0) continue;
    const drops = pricedDrops(
      c.loot,
      (name) => db.getItemByName(name)?.npcPrice ?? 0,
      (name) => {
        const it = db.getItemByName(name);
        return it ? itemIconUrl(it) : "";
      },
    );
    if (drops.length === 0) continue;
    rows.push({
      pokeId: c.pokeId,
      name: c.name,
      type1: c.type1,
      type2: c.type2,
      huntLevel: c.huntLevel,
      areas: [...new Set(locs.map((h) => h.area))].sort(),
      drops,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecalho da ferramenta: sem a moldura colorida quem da corpo e o vidro do
          card — titulo e descricao ficam num painel so, e o conteudo
          abaixo (cards) nao fica solto na pagina. */}
      <header className="card p-5 sm:p-6">
        <h1 className="pixel text-3xl [overflow-wrap:anywhere]" style={{ color: "var(--cyan)" }}>
          <T k="boost.title" />
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-dim">
          <T k="boost.desc" />
        </p>
      </header>
      <BoostTool rows={rows} areas={areas} />
    </div>
  );
}
