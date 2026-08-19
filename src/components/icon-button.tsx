"use client";

// Botao-icone quadrado reusavel (fechar, remover, acao compacta). Mesmo chrome em
// todo lugar: classe .icon-btn (ghost discreto que acende no hover). O acento de
// hover carrega a intencao — vermelho pra fechar/remover, cyan pra acao neutra.

import { Close } from "./icons";

type HoverAccent = "red" | "cyan" | "text";

// utilities vencem a camada components sem precisar de important
const HOVER: Record<HoverAccent, string> = {
  red: "hover:text-red",
  cyan: "hover:text-cyan",
  text: "",
};

export function IconButton({
  onClick,
  title,
  hover = "text",
  className = "",
  children,
}: {
  onClick?: () => void;
  title?: string;
  hover?: HoverAccent;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      // h-10/w-10 = 40px: e botao de verdade, entao cumpre o alvo de toque do celular
      // (h-9 dava 36px depois que a base caiu de 18px pra 16px)
      className={`icon-btn h-10 w-10 shrink-0 ${HOVER[hover]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Botao de fechar/dispensar padrao: X pixel, hover vermelho. Usado em modais,
 *  cards descartaveis e linhas removiveis — um so em todo o site. */
export function CloseButton({
  onClick,
  title = "Fechar",
  // 16: o X sozinho dentro de um botao de 40px sumia a 12px (traco lucide fino)
  size = 16,
  className = "",
}: {
  onClick?: () => void;
  title?: string;
  size?: number;
  className?: string;
}) {
  return (
    <IconButton onClick={onClick} title={title} hover="red" className={className}>
      <Close size={size} />
    </IconButton>
  );
}
