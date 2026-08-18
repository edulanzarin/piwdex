// Icone por stat (ordem do jogo: HP, ATK, DEF, SP.ATK, SP.DEF, SPEED) — lucide,
// currentColor, mesma API de antes (index/size/className).

import type { LucideIcon } from "lucide-react";
import { Heart, Sword, Shield, Sparkles, ShieldPlus, Gauge } from "lucide-react";

const ICONS: LucideIcon[] = [Heart, Sword, Shield, Sparkles, ShieldPlus, Gauge];

export function StatIcon({ index, size = 12, className = "" }: { index: number; size?: number; className?: string }) {
  const Icon = ICONS[index] ?? Gauge;
  return <Icon size={size} className={`inline-block shrink-0 ${className}`} aria-hidden />;
}
