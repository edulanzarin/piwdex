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

/** Esqueleto do card de ITEM — outra forma que a do card da dex: o item nao tem
 *  espinha de stats, tem duas colunas de numero e uma linha de fonte no rodape.
 *  Reusar o esqueleto da dex aqui faria a tela SALTAR quando o dado entrasse. */
export function SkeletonItemCard() {
  return (
    <div className="panel flex flex-col gap-3 p-3.5" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-5 w-10" />
      </div>
      <Skeleton className="mx-auto aspect-square w-full max-w-18" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
        <Skeleton className="mx-auto h-8 w-12" />
        <Skeleton className="mx-auto h-8 w-12" />
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
        <Skeleton className="h-7 w-7 shrink-0" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonItemGrid({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonItemCard key={i} />
      ))}
    </div>
  );
}

/** Esqueleto do formulario da calculadora: tres campos em cima, seis embaixo.
 *  Barras genericas nao seguravam o lugar — a tela pulava na hidratacao. */
export function SkeletonForm() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_150px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-56" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
