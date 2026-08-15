// Icones pixel dos 6 stats (12x12), na ordem canonica HP, ATK, DEF, SP.ATK,
// SP.DEF, SPEED. Usados ao lado de todo label de stat pelo site.

const HP = { R: "#e0454b", S: "#ff8a8f" };
const HP_ROWS = [
  "............",
  ".RR....RR...",
  "RSRR..RSRR..",
  "RSSRRRRSSRR.",
  "RSSSSSSSSSR.",
  "RSSSSSSSSSR.",
  ".RSSSSSSSR..",
  "..RSSSSSR...",
  "...RSSSR....",
  "....RSR.....",
  ".....R......",
  "............",
];

const ATK = { W: "#cdd6e6", K: "#8a97ad", y: "#a9781f", Y: "#f4d24a" };
const ATK_ROWS = [
  "..........W.",
  ".........WKW",
  "........WKW.",
  ".......WKW..",
  "......WKW...",
  ".....WKW....",
  "....WKW.....",
  "..y.KW......",
  ".yYyW.......",
  "yYYYy.......",
  ".yYy........",
  "..y.........",
];

const DEF = { b: "#234d80", B: "#4a8bd0", w: "#cdefff" };
const DEF_ROWS = [
  "..bBBBBb....",
  ".bBBBBBBb...",
  "bBBBBBBBBb..",
  "bBBwwwwBBb..",
  "bBBBBBBBBb..",
  "bBBBwBBBBb..",
  ".bBBwBBBb...",
  ".bBBBBBBb...",
  "..bBBBBb....",
  "...bBBb.....",
  "....bb......",
  "............",
];

const SPATK = { p: "#6a3fc0", P: "#b98cff", W: "#ffffff" };
const SPATK_ROWS = [
  ".....p......",
  ".....P......",
  "....PPP.....",
  "....PPP.....",
  "pPPPWPPPp...",
  ".PPPWWPPP...",
  "pPPPWPPPp...",
  "....PPP.....",
  "....PPP.....",
  ".....P......",
  ".....p......",
  "............",
];

const SPDEF = { g: "#1f8f5a", G: "#35e08e", W: "#eafff4" };
const SPDEF_ROWS = [
  "..gGGGGg....",
  ".gGGGGGGg...",
  "gGGGWGGGGg..",
  "gGGWWWGGGg..",
  "gGGGWGGGGg..",
  "gGGGGGWGGg..",
  ".gGGGGWGg...",
  ".gGGGGGGg...",
  "..gGGGGg....",
  "...gGGg.....",
  "....gg......",
  "............",
];

const SPEED = { c: "#37d3e6" };
const SPEED_ROWS = [
  "............",
  "......ccc...",
  ".....ccccc..",
  "....cc..cc..",
  "...cc...c...",
  "..cc..cc....",
  ".cc..cc.....",
  "ccccccc.....",
  ".cc..cc.....",
  "..c...c.....",
  "............",
  "............",
];

const ICONS: { rows: string[]; C: Record<string, string> }[] = [
  { rows: HP_ROWS, C: HP },
  { rows: ATK_ROWS, C: ATK },
  { rows: DEF_ROWS, C: DEF },
  { rows: SPATK_ROWS, C: SPATK },
  { rows: SPDEF_ROWS, C: SPDEF },
  { rows: SPEED_ROWS, C: SPEED },
];

export function StatIcon({ index, size = 12, className = "" }: { index: number; size?: number; className?: string }) {
  const icon = ICONS[index] ?? ICONS[0];
  const rects: React.ReactNode[] = [];
  icon.rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch !== "." && icon.C[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={icon.C[ch]} />);
    }
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      className={className}
      style={{ imageRendering: "pixelated", flexShrink: 0, display: "inline-block", verticalAlign: "-2px" }}
      aria-hidden="true"
    >
      {rects}
    </svg>
  );
}
