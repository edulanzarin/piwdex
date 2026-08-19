import { Pokeball } from "./pokeball";

// Skeleton de grade da dex: MESMA grid (2/3/4/5) e MESMO card do CreatureCard
// (min-h 12rem, sprite 76, duas linhas de texto, badge de tipo na base) — a troca
// skeleton -> conteudo nao move um pixel.
// As barras espelham a CAIXA DE LINHA real do texto na base 16px: #id = text-sm
// (15px x 1.4 = 21px) e nome = text-lg/leading-tight (18px x 1.25 = 23px), 44px no
// total; h-4 + h-6 + gap-1 dao exatamente esses 44px.
export function GridSkeleton({ count = 20 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex min-h-[12rem] flex-col items-center gap-2 p-3">
          <div className="skeleton h-[76px] w-[76px] rounded" />
          <div className="flex w-full flex-1 flex-col items-center gap-1">
            <div className="skeleton h-4 w-12 rounded" />
            <div className="skeleton h-6 w-24 rounded" />
          </div>
          <div className="skeleton h-5 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

// Skeleton da lista de itens: MESMA grid (2/3/4) e MESMO card horizontal do
// ItemsBrowser (icone 44px + tres linhas de texto).
// O bloco de texto do card mede 68px na base 16px (text-sm 21 + text-sm 21 +
// mt-0.5 2 + text-base 24); tres barras h-5 com gap-1 dao os mesmos 68px, entao os
// dois cards tem a mesma altura fechada.
export function ItemsSkeleton({ count = 16 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 p-3">
          <div className="skeleton h-11 w-11 shrink-0 rounded" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="skeleton h-5 w-24 rounded" />
            <div className="skeleton h-5 w-16 rounded" />
            <div className="skeleton h-5 w-20 rounded" />
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
      <div className="pixel text-sm text-text-dim">{label}...</div>
    </div>
  );
}
