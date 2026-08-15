import { Pokeball } from "./pokeball";

// Skeleton de grade (dex/itens) e tela cheia com pokebola girando.
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

export function LoadingBall({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Pokeball size={40} className="spin" />
      <div className="pixel text-[0.6rem] text-text-dim">{label}...</div>
    </div>
  );
}
