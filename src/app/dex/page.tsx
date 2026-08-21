import { Suspense } from "react";
import type { Metadata } from "next";
import { getDexPayload } from "@/lib/dex-data";
import { DexBrowser } from "@/components/dex-browser";
import { Panel, SkeletonGrid } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pokedex",
  description:
    "Todas as especies do Poke Idle World com filtro por tipo, raridade, origem, " +
    "estagio, fraqueza, drop e faixa de nivel, valor, XP, stats e poder de golpe.",
};

// Revalida de hora em hora: o catalogo se atualiza sozinho quando o jogo publica
// patch, sem redeploy. O `source.ts` ainda confere por ETag a cada request, isso
// aqui e so o teto da pagina renderizada.
export const revalidate = 3600;

export default async function DexPage() {
  const { entries, bounds, lootIndex, catalog, counts } = await getDexPayload();

  // O cabecalho conta o conjunto JOGAVEL (o padrao da tela). Contar as 482 do
  // catalogo cru anunciaria um numero que a lista so alcanca com a chave de
  // variantes ligada.
  const playable = entries.filter((e) => !e.variant).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="pix text-[9px] text-accent">catalogo completo</p>
          <h1 className="pix text-[18px] text-text">Pokedex</h1>
        </div>
        <p className="text-[11px] text-text-mute">
          {playable} especies · {counts.hunts} pontos de caca · {counts.drops} registros de drop
        </p>
      </header>

      {/* useSearchParams precisa de fronteira de Suspense pra a pagina poder ser
          pre-renderizada; o esqueleto tem a forma do grid que vai chegar. */}
      <Suspense
        fallback={
          <Panel>
            <SkeletonGrid count={10} />
          </Panel>
        }
      >
        <DexBrowser entries={entries} bounds={bounds} lootIndex={lootIndex} catalog={catalog} />
      </Suspense>
    </div>
  );
}
