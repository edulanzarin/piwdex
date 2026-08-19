"use client";

// Estatisticas: DASHBOARD cumulativo (pra sempre, todas as hunts) do robo — o que ele
// caçou, coletou, vendeu e mantem no acervo. Nunca zera (vem de robot_sales + captured_pokes).
// Leitura pura, AO VIVO via SSE (totals do provider — zero fetch aqui). Graficos em barra
// CSS (sem lib), na estetica pixel/neon.

import { StatTile } from "./stat-tile";
import { Panel } from "./ui/panel";
import { useT } from "./locale-provider";
import { useVipLive } from "./vip-live";
import { Coin, Dollar, Loot, Xp, Skull, Star, Robot } from "./icons";
import { Pokeball } from "./pokeball";
import { RARITY_COLOR, RARITY_ORDER } from "@/lib/typing";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

// uma barra horizontal (label · trilho preenchido pela fracao do maximo · valor).
// `empty` = slot sem dado ainda: trilho vazio + placeholder esmaecido no MESMO lugar,
// pra linha nunca sumir/aparecer conforme o dado chega.
function Bar({ label, value, max, color, valueText, empty = false }: { label: React.ReactNode; value: number; max: number; color: string; valueText?: string; empty?: boolean }) {
  const pctW = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0; // piso de 3% pra barra nao sumir
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-base text-text-dim">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-sm bg-[var(--well-bg)]">
        <div className="h-full rounded-sm transition-[width] duration-500" style={{ width: `${empty ? 0 : pctW}%`, background: color }} />
      </div>
      <span className={`w-20 shrink-0 pixel text-right text-sm tabular-nums ${empty ? "slot-empty" : ""}`} style={empty ? undefined : { color }}>
        {empty ? "—" : (valueText ?? fmt(value))}
      </span>
    </div>
  );
}

// secao do dashboard: Panel colapsavel (primitivo de ui/) com acento proprio
function Card({ title, accent, icon, children }: { title: string; accent: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Panel collapsible icon={icon} accent={accent} title={<span style={{ color: accent }}>{title}</span>} className="p-5" bodyClassName="gap-4">
      {children}
    </Panel>
  );
}

export function RoboStats() {
  const t = useT();
  const d = useVipLive().totals;
  // dolar RECEBIDO (so o que entrou de verdade: venda). O valor do loot coletado NAO
  // entra aqui — ele vira venda depois; contar os dois duplicaria a mesma moeda.
  const received = (d?.itemsGold ?? 0) + (d?.pokesGold ?? 0);
  const goldMax = Math.max(1, d?.itemsGold ?? 0, d?.pokesGold ?? 0, d?.supplyGold ?? 0);
  // acervo por raridade: TODAS as raridades, sempre, na ordem oficial — raridade sem
  // bicho fica com o trilho vazio (slot), a lista nunca cresce/encolhe ao vivo
  const rarMax = Math.max(1, ...RARITY_ORDER.map((r) => d?.acervo.byRarity[r] ?? 0));
  // valor de tile antes do stream chegar: placeholder esmaecido no mesmo slot
  const sv = (n: number | null | undefined): React.ReactNode => (d ? fmt(n ?? 0) : <span className="slot-empty">—</span>);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="section-title flex items-center gap-2 text-cyan"><Robot size={18} /> {t("robo.stats.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.stats.desc")}</p>
      </div>

      {/* Caçada — o que o robo acumulou cacando (todas as hunts) */}
      <Card title={t("robo.stats.huntTitle")} accent="var(--cyan)" icon={<Skull size={18} />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <StatTile live label={t("robo.stats.hunts")} value={sv(d?.hunts)} icon={<Robot size={14} className="text-cyan" />} />
          <StatTile live label={t("robo.stats.kills")} value={sv(d?.kills)} icon={<Skull size={14} className="text-text-dim" />} />
          <StatTile live label={t("robo.stats.captures")} value={sv(d?.captures)} icon={<Pokeball size={14} />} />
          <StatTile live label={t("robo.stats.lootItems")} value={sv(d?.lootItems)} icon={<Loot size={14} className="text-text-dim" />} />
          <StatTile live label={t("robo.stats.rareItems")} value={sv(d?.rareItems)} accent="var(--yellow)" icon={<Star size={14} className="text-yellow" />} />
          <StatTile live label={t("robo.stats.xp")} value={sv(d?.xpGained)} accent="var(--cyan)" icon={<Xp size={14} className="text-cyan" />} />
        </div>
        {/* valor do loot que dropou: INFORMATIVO — so vira dolar quando o robo vende */}
        <p className="flex items-center gap-1.5 text-sm text-text-dim">
          <Coin size={14} />
          {t("robo.stats.lootGoldHint", { v: fmt(d?.lootGold ?? 0) })}
        </p>
      </Card>

      {/* Dólar RECEBIDO — so venda gera dolar (loot coletado nao entra: duplicaria) */}
      <Card title={t("robo.stats.goldTitle")} accent="var(--green)" icon={<Coin size={18} />}>
        <p className="-mt-2 text-sm leading-relaxed text-text-dim">{t("robo.stats.goldHint")}</p>
        <div className="flex flex-col gap-2.5">
          <Bar label={t("robo.stats.src.items")} value={d?.itemsGold ?? 0} max={goldMax} color="var(--green)" empty={!d} />
          <Bar label={t("robo.stats.src.pokes")} value={d?.pokesGold ?? 0} max={goldMax} color="var(--yellow)" empty={!d} />
          <Bar label={t("robo.stats.src.supply")} value={d?.supplyGold ?? 0} max={goldMax} color="var(--pink)" valueText={`-${fmt(d?.supplyGold ?? 0)}`} empty={!d} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatTile live label={t("robo.stats.received")} value={sv(received)} accent="var(--green)" icon={<Coin size={14} />} />
          <StatTile live label={t("robo.stats.supply")} value={d ? `-${fmt(d.supplyGold)}` : sv(null)} accent="var(--pink)" icon={<Dollar size={14} className="text-pink" />} />
          <StatTile live label={t("robo.stats.net")} value={sv(received - (d?.supplyGold ?? 0))} accent={received - (d?.supplyGold ?? 0) >= 0 ? "var(--green)" : "var(--pink)"} icon={<Coin size={14} />} />
        </div>
      </Card>

      {/* Vendas — itens e pokemon vendidos pelo robo (contagem + dolar) */}
      <Card title={t("robo.stats.sellTitle")} accent="var(--green)" icon={<Coin size={18} />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile live label={t("robo.stats.itemsSold")} value={sv(d?.itemsCount)} icon={<Loot size={14} className="text-text-dim" />} />
          <StatTile live label={t("robo.stats.itemsSoldGold")} value={sv(d?.itemsGold)} accent="var(--green)" icon={<Coin size={14} />} />
          <StatTile live label={t("robo.stats.pokesSold")} value={sv(d?.pokesCount)} icon={<Pokeball size={14} />} />
          <StatTile live label={t("robo.stats.pokesSoldGold")} value={sv(d?.pokesGold)} accent="var(--green)" icon={<Coin size={14} />} />
        </div>
      </Card>

      {/* Acervo — o que o robo MANTEVE (nao vendeu), total + shiny + por raridade */}
      <Card title={t("robo.stats.acervoTitle")} accent="var(--yellow)" icon={<Star size={18} />}>
        <div className="grid grid-cols-2 gap-2">
          <StatTile live label={t("robo.stats.acervoTotal")} value={sv(d?.acervo.total)} accent="var(--yellow)" icon={<Star size={14} className="text-yellow" />} />
          <StatTile live label={t("robo.stats.shiny")} value={sv(d?.acervo.shiny)} icon={<Star size={14} className="text-text-dim" />} />
        </div>
        {/* todas as raridades sempre presentes: sem bicho = trilho vazio no mesmo slot,
            a secao nao muda de altura quando uma raridade nova chega ao vivo */}
        <div className="flex flex-col gap-2.5">
          {RARITY_ORDER.map((r) => {
            const v = d?.acervo.byRarity[r] ?? 0;
            return <Bar key={r} label={r} value={v} max={rarMax} color={RARITY_COLOR[r]} empty={v === 0} />;
          })}
        </div>
      </Card>
    </div>
  );
}
