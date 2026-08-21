/**
 * A marca — pokebola.
 *
 * Nao e mais pixel art. A versao anterior era um grid 16x16 desenhado a mao e o
 * Eduardo reprovou ("feiao isso ai"): num grid tao pequeno a curva vira escada,
 * e escada num logo le como erro de renderizacao, nao como estilo.
 *
 * Agora e geometria pura — dois arcos, uma faixa e um anel — entao ela e nitida
 * em 20px no header e em 96px na home, sem redesenhar nada. A metade de cima
 * herda `currentColor`, entao a marca vive dentro do tema em vez de ser um
 * vermelho fixo brigando com o acento.
 */
export interface PokeballProps {
  size?: number;
  className?: string;
  /** balanca como a bola do jogo durante a captura — ver o keyframe pix-wiggle */
  spinning?: boolean;
  title?: string;
}

export function Pokeball({ size = 24, className, spinning, title }: PokeballProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={[spinning ? "anim-wiggle" : "", className ?? ""].filter(Boolean).join(" ")}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        {/* o brilho que faz a esfera parecer esfera e nao circulo chapado */}
        <linearGradient id="pb-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id="pb-bot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f7ff" />
          <stop offset="100%" stopColor="#c3ccdf" />
        </linearGradient>
        <clipPath id="pb-clip">
          <circle cx="24" cy="24" r="21" />
        </clipPath>
      </defs>

      <g clipPath="url(#pb-clip)">
        <rect x="0" y="0" width="48" height="24" fill="url(#pb-top)" />
        <rect x="0" y="24" width="48" height="24" fill="url(#pb-bot)" />
        {/* faixa central */}
        <rect x="0" y="20.5" width="48" height="7" fill="#0b0d12" />
      </g>

      {/* casco */}
      <circle cx="24" cy="24" r="21" fill="none" stroke="#0b0d12" strokeWidth="3.5" />
      {/* botao */}
      <circle cx="24" cy="24" r="7.5" fill="#0b0d12" />
      <circle cx="24" cy="24" r="4.6" fill="#f4f7ff" />
      <circle cx="24" cy="24" r="2.2" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}
