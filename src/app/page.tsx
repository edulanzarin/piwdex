import Link from "next/link";
import { counts, generatedAt, totalDropEntries } from "@/lib/data";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-2xl font-bold text-accent">{value}</div>
      <div className="text-sm text-text-dim">{label}</div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Poke Idle World, completo.</h1>
        <p className="max-w-2xl text-text-dim">
          Stats, movesets, evolucoes, <strong>chance real de cada drop</strong>, onde
          farmar cada item e em que area cada pokemon aparece. Dados puxados direto da
          fonte-mestra do jogo.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={counts.creatures} label="pokemons" />
        <Stat value={counts.items} label="itens" />
        <Stat value={totalDropEntries.toLocaleString("pt-BR")} label="entradas de drop" />
        <Stat value={counts.hunts} label="pontos de hunt" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/dex" className="card p-6 hover:border-accent transition-colors">
          <h2 className="text-lg font-semibold">Pokedex</h2>
          <p className="mt-1 text-sm text-text-dim">
            Busca por nome, tipo e raridade. Cada ficha traz stats, fraquezas,
            evolucao, drops com % e onde caçar.
          </p>
        </Link>
        <Link href="/items" className="card p-6 hover:border-accent transition-colors">
          <h2 className="text-lg font-semibold">Itens & drops</h2>
          <p className="mt-1 text-sm text-text-dim">
            O indice reverso: escolha um item e veja <strong>quem dropa</strong> e a
            melhor taxa — o que o piwtools nao mostra.
          </p>
        </Link>
      </section>

      <p className="text-xs text-text-dim">
        Snapshot dos dados: {new Date(generatedAt).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}
