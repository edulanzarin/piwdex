import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Junta classes resolvendo CONFLITO de utilitaria.
 *
 * Concatenar nao basta: quando o default do primitivo e utilitario (`h-8`) e o
 * chamador manda `h-9`, as duas classes existem e quem vence e a ordem no CSS
 * gerado — que nao e a ordem do atributo. O merge remove a perdedora, entao a
 * classe do chamador vence de verdade sem `!important`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
