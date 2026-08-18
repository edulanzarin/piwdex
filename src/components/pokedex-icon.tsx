// Icone da Pokedex no card da home — lucide (linha, currentColor), mesma API (size).
import { BookOpen } from "lucide-react";

export function PokedexIcon({ size = 40 }: { size?: number }) {
  return <BookOpen size={size} strokeWidth={1.5} aria-hidden />;
}
