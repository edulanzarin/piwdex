import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconInfo } from "./icons";

/**
 * Aviso, ressalva e nota de rodape — tudo que a tela DIZ em vez de mostrar.
 *
 * Existe pra o recado ter uma forma so no site inteiro, e essa forma e
 * **italica**. Nao e enfeite: o italico separa a voz da ferramenta ("cuidado
 * com isto", "este numero sai daquela conta") do dado que ela apresenta. Sem a
 * separacao, uma ressalva de tres linhas no meio de uma tela de numeros parece
 * mais um campo, e o olho pula ela junto com o resto do texto corrido.
 *
 * Antes disso, cada painel repetia a sua propria `<p className="text-[13px]
 * leading-relaxed text-text-mute">` — sete variacoes quase iguais, e nenhuma
 * delas se distinguia do conteudo.
 */
type Tone = "muted" | "warn" | "danger" | "ok" | "accent";

const TONE: Record<Tone, string> = {
  muted: "border-line bg-bg-soft text-text-mute",
  warn: "border-warn/45 bg-warn/12 text-warn",
  danger: "border-danger/45 bg-danger/12 text-danger",
  ok: "border-ok/45 bg-ok/12 text-ok",
  accent: "border-accent/45 bg-accent/12 text-accent",
};

export interface NoteProps extends HTMLAttributes<HTMLParagraphElement> {
  tone?: Tone;
  /** sem caixa: so uma linha divisoria em cima. Pra rodape dentro de painel. */
  flush?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Note({ tone = "muted", flush, icon, className, children, ...props }: NoteProps) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-[13px] leading-relaxed italic",
        flush
          ? cn("border-t pt-2", tone === "muted" ? "border-line text-text-mute" : TONE[tone].replace(/bg-\S+/, ""))
          : cn("border px-3 py-2", TONE[tone]),
        className,
      )}
      {...props}
    >
      {icon === undefined ? null : (
        <span className="mt-0.5 shrink-0 not-italic">{icon ?? <IconInfo size={15} />}</span>
      )}
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}
