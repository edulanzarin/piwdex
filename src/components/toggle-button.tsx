// Botao de alternancia segmentado (liga/desliga ou opcao de um grupo): borda e cor
// no acento quando ativo, cinza discreto quando nao. Mesmo dialeto em toda ferramenta
// (prioridade da rota, VIP, filtro de shiny...). O acento carrega a intencao, nao o
// tamanho — variar cor, nunca px.

type Accent = "cyan" | "yellow" | "green";

// Classes estaticas (Tailwind nao le string interpolada com var()).
const ON: Record<Accent, string> = {
  cyan: "border-[color:var(--cyan)] bg-surface-2 text-cyan",
  yellow: "border-[color:var(--yellow)] bg-surface-2 text-yellow",
  green: "border-[color:var(--green)] bg-surface-2 text-green",
};
const OFF = "border-border text-text-dim hover:text-text";

export function ToggleButton({
  active,
  onClick,
  accent = "cyan",
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent?: Accent;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`inline-flex min-h-9 items-center gap-2 rounded border px-3 text-[0.7rem] transition active:translate-y-px ${active ? ON[accent] : OFF}`}
    >
      {children}
    </button>
  );
}
