// Icones grandes dos cards de ferramenta da home — lucide, currentColor, mesma API
// (size) dos antigos desenhos pixel.

import { PackageOpen, MapPinned, Calculator, FlaskConical, Egg } from "lucide-react";

export const ItemsIcon = ({ size = 52 }: { size?: number }) => (
  <PackageOpen size={size} strokeWidth={1.5} aria-hidden />
);
export const HuntIcon = ({ size = 52 }: { size?: number }) => (
  <MapPinned size={size} strokeWidth={1.5} aria-hidden />
);
export const CalcIcon = ({ size = 52 }: { size?: number }) => (
  <Calculator size={size} strokeWidth={1.5} aria-hidden />
);
export const LabIcon = ({ size = 52 }: { size?: number }) => (
  <FlaskConical size={size} strokeWidth={1.5} aria-hidden />
);
export const BreedIcon = ({ size = 52 }: { size?: number }) => (
  <Egg size={size} strokeWidth={1.5} aria-hidden />
);
