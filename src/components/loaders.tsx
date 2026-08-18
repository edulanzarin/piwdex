import { Pokeball } from "./pokeball";

// Skeleton de grade (dex/itens): imita a forma dos cards.
export function GridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex flex-col items-center gap-2 p-3">
          <div className="skeleton h-[76px] w-[76px] rounded" />
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-4 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

// Skeleton da lista de itens: imita o card horizontal (icone + texto).
export function ItemsSkeleton({ count = 16 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 p-3">
          <div className="skeleton h-11 w-11 shrink-0 rounded" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="skeleton h-3.5 w-24 rounded" />
            <div className="skeleton h-2.5 w-16 rounded" />
            <div className="skeleton h-3 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Loader de tela cheia: pokebola pixel chacoalhando.
export function LoadingBall({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Pokeball size={64} className="wiggle" />
      <div className="pixel text-[0.8rem] text-text-dim">{label}...</div>
    </div>
  );
}
