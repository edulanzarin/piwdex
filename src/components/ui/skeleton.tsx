import { cn } from "@/lib/cn";

/**
 * Esqueleto de carregamento. Imita a FORMA do conteudo que vai chegar — se o
 * bloco final tem 96px de altura, o esqueleto tem 96px, senao a tela salta
 * quando o dado entra.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden="true" />;
}

/** Esqueleto do card da dex — mesma caixa, mesma proporcao do card real. */
export function SkeletonCard() {
  return (
    <div className="panel flex flex-col gap-2 p-2" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-8" />
      </div>
      <Skeleton className="mx-auto aspect-square w-full max-w-20 rounded-pix-lg" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-1">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-6 w-full" />
    </div>
  );
}

/** Grade de esqueletos com a mesma contagem do grid real. */
export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
