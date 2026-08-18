// Pokebola vetorial lisa (logo e spinner): metade vermelha, banda escura, botao
// central. Trocou o grid pixel por vetor limpo (decisao do Eduardo, ago/2026 —
// icones normais; o pixel fica nos sprites do jogo). Mesma API (size/className).

const RED = "#ec3b3b";
const WHITE = "#f4f6fb";
const DARK = "#141821";

export function Pokeball({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      {/* metade de cima vermelha, metade de baixo branca */}
      <path d="M12 2a10 10 0 0 1 10 10H2A10 10 0 0 1 12 2Z" fill={RED} />
      <path d="M22 12a10 10 0 0 1-20 0Z" fill={WHITE} />
      {/* banda central + contorno */}
      <rect x="2" y="10.75" width="20" height="2.5" fill={DARK} />
      <circle cx="12" cy="12" r="10" fill="none" stroke={DARK} strokeWidth="2" />
      {/* botao central */}
      <circle cx="12" cy="12" r="3.4" fill={DARK} />
      <circle cx="12" cy="12" r="2.1" fill={WHITE} />
    </svg>
  );
}
