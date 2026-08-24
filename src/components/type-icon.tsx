/**
 * Simbolo dos 18 tipos.
 *
 * Os desenhos vem de `tipos/glifos.tsx` — os OFICIAIS dos jogos recentes, e nao
 * um desenho nosso. O porque esta la, e ele vale a leitura: tipo e canone do
 * jogo, e simbolo proprio disputa com um que a pessoa ja tem decorado.
 *
 * O par COR + FORMA continua de pe: a cor sai do `TYPE_COLOR` do site e o glifo
 * herda por `currentColor`, entao quem nao distingue matiz continua separando os
 * tipos pela forma.
 */
import type { PokeType } from "@/lib/types";
import { TIPO_GLIFO, TIPO_VIEWBOX } from "@/components/tipos/glifos";
import { TYPE_COLOR } from "@/lib/typing";
import { TYPE_LABEL, multWord } from "@/lib/labels";
import type { TypeMult } from "@/lib/typing";
import { cn } from "@/lib/cn";


export function TypeIcon({
  type,
  size = 14,
  className,
  style,
}: {
  type: PokeType;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const corpo = TIPO_GLIFO[type];
  if (!corpo) return null;
  // Piso de 16, e nao de 13.
  //
  // Ele subiu junto com o desenho. Enquanto o simbolo era traco de biblioteca,
  // 13px passava — nao havia detalhe pra perder. Estes tem palpebra, faceta,
  // dedo: a 13 isso vira uma mancha torta, que foi exatamente a queixa.
  //
  // Piso e melhor que corrigir os 21 pontos de uso um a um: quem pedir menos
  // recebe 16 e a peca continua legivel, e o proximo ponto de uso ja nasce certo.
  const s = Math.max(16, size);
  return (
    <svg
      viewBox={TIPO_VIEWBOX}
      width={s}
      height={s}
      fill="currentColor"
      className={cn("shrink-0", className)}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {corpo}
    </svg>
  );
}

/**
 * Selo de tipo: icone + nome, na cor canonica do tipo.
 *
 * A cor vem de `TYPE_COLOR` (dado do jogo), nunca do tema — por isso entra por
 * `style` e nao por classe utilitaria.
 */
export function TypeBadge({
  type,
  size = "sm",
  showLabel = true,
  className,
}: {
  type: PokeType | "NEUTRAL";
  size?: "xs" | "sm";
  showLabel?: boolean;
  className?: string;
}) {
  // Golpe sem tipo existe no jogo (`NEUTRAL`) e nao esta nos 18 — cai no neutro.
  const known = type !== "NEUTRAL";
  const color = known ? TYPE_COLOR[type] : "var(--color-text-mute)";
  const label = known ? TYPE_LABEL[type] : "Sem tipo";

  return (
    <span
      style={{ borderColor: `${color}5c`, backgroundColor: `${color}1f`, color }}
      className={cn(
        "inline-flex items-center gap-1.5 border whitespace-nowrap",
        size === "xs" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px]",
        "font-medium tracking-wide",
        // Com rotulo e uma PASTILHA (retangulo de canto miudo); sem rotulo e um
        // DISCO. Nao e capricho: um quadrado de 28px com um glifo dentro le como
        // botao de barra de ferramentas, e um disco le como emblema. O selo de
        // tipo sem palavra e emblema — ele identifica, nao aciona.
        showLabel ? "rounded-[var(--radius-xs)]" : "rounded-pill",
        !showLabel && (size === "xs" ? "w-6 justify-center px-0" : "w-7 justify-center px-0"),
        className,
      )}
      title={label}
    >
      {known ? <TypeIcon type={type} size={size === "xs" ? 16 : 17} /> : null}
      {showLabel ? label : null}
    </span>
  );
}

/**
 * Tipo + multiplicador de efetividade, na cor do tipo.
 *
 * O `title` traz a leitura por EXTENSO ("dano dobrado") porque "x2" e "1/4" sao
 * dialeto de quem ja joga — e a ficha tambem serve quem esta chegando.
 */
export function TypeMultChip({
  m,
  tone,
  className,
}: {
  m: TypeMult;
  /** classe de cor do multiplicador: perigo, ok, acento ou neutro */
  tone: string;
  className?: string;
}) {
  const color = TYPE_COLOR[m.type];
  return (
    <span
      style={{ borderColor: `${color}5c`, backgroundColor: `${color}1c` }}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-xs)] border px-2.5 text-[12px] font-medium",
        className,
      )}
      title={`${TYPE_LABEL[m.type]}: ${multWord(m.mult)}`}
    >
      <TypeIcon type={m.type} size={16} style={{ color }} />
      <span style={{ color }}>{TYPE_LABEL[m.type]}</span>
      <span className={cn("font-bold", tone)}>{m.label}</span>
    </span>
  );
}
