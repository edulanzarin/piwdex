import { cn } from "@/lib/cn";
import { Pokeball } from "./pokeball";

/**
 * Carregando.
 *
 * Duas coisas de proposito: a bola BALANCA (nao gira liso) porque e o gesto que
 * o jogo usa na captura — movimento com personagem le como "trabalhando",
 * spinner generico le como "travou"; e a barra e INDETERMINADA de proposito,
 * porque nao ha progresso real pra reportar. Barra que finge porcentagem exata
 * e a que trava em 99%.
 */
export function Loading({
  label = "Carregando",
  hint,
  className,
}: {
  label?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-5 px-6 py-20", className)}
    >
      <span className="relative grid place-items-center">
        <span
          aria-hidden="true"
          className="anim-glow absolute h-20 w-20 rounded-full bg-accent/40 blur-2xl"
        />
        <Pokeball size={56} spinning className="relative text-accent" />
      </span>

      <span className="flex flex-col items-center gap-2">
        <span className="pix text-[12px] text-text-dim">{label}</span>
        {hint ? <span className="text-[13px] text-text-mute">{hint}</span> : null}
      </span>

      <span
        aria-hidden="true"
        className="h-1 w-48 overflow-hidden rounded-none bg-surface-2 ring-1 ring-line"
      >
        <span className="anim-bar block h-full rounded-none bg-accent/80" />
      </span>
    </div>
  );
}
