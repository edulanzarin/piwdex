// Icone por tipo de pokemon — lucide, currentColor (a cor vem do badge que embrulha).
// Mesma API de antes: TypeIcon({ type, size }). Tipos fora dos 18 canonicos
// (ex.: golpe "NEUTRAL") nao tem icone — nao renderiza nada.

import type { LucideIcon } from "lucide-react";
import {
  Circle, Flame, Droplets, Zap, Leaf, Snowflake, Swords, FlaskConical, Mountain,
  Feather, Eye, Bug, Pyramid, Ghost, Shell, Moon, Shield, Sparkles,
} from "lucide-react";
import type { PokeType } from "@/lib/types";

const ICONS: Record<PokeType, LucideIcon> = {
  NORMAL: Circle,
  FIRE: Flame,
  WATER: Droplets,
  ELECTRIC: Zap,
  GRASS: Leaf,
  ICE: Snowflake,
  FIGHTING: Swords,
  POISON: FlaskConical,
  GROUND: Mountain,
  FLYING: Feather,
  PSYCHIC: Eye,
  BUG: Bug,
  ROCK: Pyramid,
  GHOST: Ghost,
  DRAGON: Shell,
  DARK: Moon,
  STEEL: Shield,
  FAIRY: Sparkles,
};

export function TypeIcon({ type, size = 12 }: { type: PokeType | string; size?: number }) {
  const Icon = ICONS[type as PokeType];
  if (!Icon) return null;
  return <Icon size={size} className="shrink-0" aria-hidden />;
}
