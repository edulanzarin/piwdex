import { animatedSpriteUrl } from "@/lib/sprites";
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

// Loader de tela cheia: pikachu pixel pulando + pokebola chacoalhando.
export function LoadingBall({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="relative flex h-20 items-end gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={animatedSpriteUrl(25)}
          alt=""
          className="bounce-y h-16 w-16"
          style={{ imageRendering: "pixelated" }}
        />
        <Pokeball size={26} className="wiggle mb-1" />
      </div>
      <div className="pixel text-[0.6rem] text-text-dim">{label}...</div>
    </div>
  );
}
