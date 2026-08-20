import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { MetaTool } from "@/components/meta-tool";
import { isOffensive, type MetaMon } from "@/lib/meta";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Meta Analyzer" };

export default async function MetaPage() {
  const db = await getData();

  // Payload enxuto: o motor de meta roda no CLIENTE, porque trocar o pool de golpes,
  // abrir o perfil de outro pokemon ou montar um time no Stadium sao perguntas que o
  // usuario faz em sequencia — cada uma custaria uma ida ao servidor. Entao mandamos o
  // que o motor le e nada mais: sem loot, sem descricao, sem preco, e so os golpes que
  // causam dano (STATUS nao entra em nenhuma conta daqui).
  const mons: MetaMon[] = db.creatures.map((c) => ({
    pokeId: c.pokeId,
    name: c.name,
    type1: c.type1,
    type2: c.type2,
    rarity: c.rarity,
    huntLevel: c.huntLevel,
    baseHp: c.baseHp,
    baseAtk: c.baseAtk,
    baseDef: c.baseDef,
    baseSpAtk: c.baseSpAtk,
    baseSpDef: c.baseSpDef,
    baseSpeed: c.baseSpeed,
    attacks: c.attacks.filter(isOffensive),
    area: c.area,
    captureBase: c.captureBase,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecalho da ferramenta: sem a moldura colorida quem da corpo e o vidro do
          card — titulo e descricao ficam num painel so, e o conteudo
          abaixo (cards) nao fica solto na pagina. */}
      <header className="card p-5 sm:p-6">
        <h1 className="pixel text-3xl [overflow-wrap:anywhere]" style={{ color: "var(--pink)" }}>
          <T k="meta.title" />
        </h1>
        <p className="mt-3 max-w-3xl text-base text-text-dim">
          <T k="meta.desc" />
        </p>
      </header>
      <MetaTool mons={mons} />
    </div>
  );
}
