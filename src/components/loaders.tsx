import { animatedSpriteUrl } from "@/lib/sprites";

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

// Loader de tela cheia: Mew pixel girando.
export function LoadingBall({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={animatedSpriteUrl(151)}
        alt=""
        className="spin h-20 w-20"
        style={{ imageRendering: "pixelated" }}
      />
      <div className="pixel text-[0.6rem] text-text-dim">{label}...</div>
    </div>
  );
}
