"use client";

import { useEffect, useRef, useState } from "react";
import { assetIconUrl, skinSpriteUrl, skinName, spriteUrl } from "@/lib/sprites";
import type { Account, AccountItem, ActivePoke } from "@/lib/game-account";
import { useVipLive } from "./vip-live";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { Pokeball } from "./pokeball";
import { StatTile } from "./stat-tile";
import type { ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";
import { Panel } from "./ui/panel";
import { Star, Coin, Diamond, Skull, Xp, Check, ArrowDown, Infinity_, ChevronRight, Chart } from "./icons";
import { PokeStatsModal } from "./mon-stats";
import { QualityBadge } from "./badges";
import { HpBar, HpText, FaintedChip, isFainted } from "./ui/hp";
import type { MarketDex } from "./market-advisor";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
// placeholder padrao de slot vazio: o valor ausente ocupa o MESMO lugar, esmaecido
const dash = <span className="slot-empty">—</span>;
const pct = (n: number) => `${n > 0 ? "+" : ""}${+n.toFixed(1)}%`;
const ivColor = (v: number) => (v >= 150 ? "text-green" : v >= 100 ? "text-yellow" : "text-text");

interface TeamSnapshot { list: ActivePoke[]; total: number; at: string }

// Bookmarklet: le sessionStorage["pokeweb:tokens"] na aba do jogo e abre /conectar com o
// token no hash. Gerado com a origem atual (dev/prod). href setado via ref pra o React nao
// sanitizar o javascript:. O usuario arrasta pra barra de favoritos uma vez.
function Bookmarklet() {
  const t = useT();
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // O bookmarklet abre <piwdex>/conectar a partir de onde foi arrastado. Em dev
    // (localhost) isso gera um favorito quebrado — entao cai pro dominio de producao.
    const here = window.location.origin;
    const origin = /localhost|127\.0\.0\.1/.test(here) ? "https://piwdex.com.br" : here;
    const alertMsg = t("account.bm.alert").replace(/['\\]/g, " ");
    const code =
      "javascript:(function(){try{var r=sessionStorage.getItem('pokeweb:tokens')||localStorage.getItem('pokeweb:tokens');if(!r){alert('" +
      alertMsg +
      "');return}window.open('" +
      origin +
      "/conectar#'+encodeURIComponent(r),'_blank')}catch(e){alert('piwdex: '+e.message)}})()";
    ref.current?.setAttribute("href", code);
  }, [t]);
  return (
    <a ref={ref} href="/conta" onClick={(e) => e.preventDefault()} draggable className="btn btn-cyan inline-flex cursor-grab select-none items-center gap-1.5" title={t("account.bm.drag")}>
      <ArrowDown size={14} /> {t("account.bm.btn")}
    </a>
  );
}

function ConnectForm({ expired }: { expired?: boolean }) {
  const t = useT();
  return (
    <div className="card p-5">
      <h2 className="section-title">{t("account.connect.title")}</h2>
      {expired && (
        <div
          className="glass mt-3 rounded border border-[color:var(--yellow)]/50 px-3 py-2 text-base text-yellow"
          style={{ background: "color-mix(in srgb, var(--yellow) 12%, var(--surface))" }}
        >
          {t("account.expired")}
        </div>
      )}
      <p className="mt-3 text-sm text-text-dim">{t("account.connect.help")}</p>

      {/* poco CHAPADO dentro do card de vidro (nada de vidro sobre vidro): o rgba azul
          solto que estava aqui nem batia com a borda cyan da caixa */}
      <div className="mt-4 rounded border border-[color:var(--cyan)]/40 bg-[color:var(--cyan)]/5 p-4">
        <div className="section-title">{t("account.bm.title")}</div>
        <ol className="mt-2 flex flex-col gap-1 text-base leading-relaxed text-text-dim">
          {["s1", "s2", "s3"].map((s) => (
            <li key={s} className="flex items-start gap-2"><span className="mt-0.5 inline-flex shrink-0 text-cyan"><ChevronRight size={16} /></span><span>{t(`account.bm.${s}`)}</span></li>
          ))}
        </ol>
        <div className="mt-3"><Bookmarklet /></div>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">{t("account.bm.note")}</p>
      </div>
    </div>
  );
}

// Mini-tile de stat: agora no poco padrao (.well via StatTile), com icone pixel opcional.
// A cor do valor continua vindo por classe (`color`) pra preservar os spans internos.
function Stat({ label, value, color = "text-text", icon }: { label: string; value: React.ReactNode; color?: string; icon?: React.ReactNode }) {
  return <StatTile label={label} value={<span className={color}>{value}</span>} icon={icon} />;
}
// Linha rótulo/valor text-forward (config escrita, sem tile) — Treinador/Automação.
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-b-0">
      <span className="field-label">{label}</span>
      {/* a Chakra tem peso de verdade: o valor sai em 500 e o rotulo fica em 400/dim —
          a hierarquia da linha nao depende mais so de cor */}
      <span className="text-right text-base text-text">{value}</span>
    </div>
  );
}
// secao da Conta: Panel primitivo (titulo colorido + slot a direita)
function Section({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Panel title={title} right={extra}>
      {children}
    </Panel>
  );
}
const OnOff = ({ on }: { on: boolean }) => {
  const t = useT();
  return <span className={on ? "text-green" : "text-text-dim"}>{t(on ? "account.on" : "account.off")}</span>;
};

function Overview({ account }: { account: Account }) {
  const t = useT();
  const p = account.profile;
  const xpPct = p.xpForNext > 0 ? Math.min(100, (p.xpInLevel / p.xpForNext) * 100) : 0;
  const skinUrl = skinSpriteUrl(account.trainer.lookType);
  const skin = skinName(account.trainer.lookType);
  return (
    <div className="card p-4">
      {/* celular: skin em cima, ficha embaixo — lado a lado sobravam ~200px pros seis
          tiles a 360px. Muda por breakpoint, nunca por dado. */}
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        {/* moldura da skin SEMPRE presente: sem sprite = pokebola esmaecida no mesmo
            quadro, e a linha do nome vira "—" — nada empurra o resto quando carrega */}
        <div className="shrink-0 text-center">
          <div className="flex h-[68px] w-[68px] items-center justify-center rounded-lg border border-[color:var(--cyan)]/40 bg-[var(--well-bg)]">
            {skinUrl ? (
              <Sprite src={skinUrl} alt={skin ?? "skin"} size={56} />
            ) : (
              <span className="slot-empty"><Pokeball size={24} /></span>
            )}
          </div>
          <div className={`mt-1 w-[68px] truncate text-xs leading-tight ${skin ? "text-text-dim" : "slot-empty"}`}>{skin ?? "—"}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="pixel text-base text-green">{p.name}</span>
            {/* chip VIP com espaco reservado (invisible quando nao-VIP) */}
            <span className={`chip ${account.trainer.vip ? "" : "invisible"}`} style={{ background: "var(--yellow)", color: "#3a2c00" }}>VIP</span>
            <span className="text-xs uppercase tracking-wide text-text-dim">{t(`account.gender.${account.trainer.gender}`)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <Stat label={t("account.profile.level")} value={fmt(p.level)} color="text-cyan" icon={<Xp size={14} className="text-cyan" />} />
            <Stat label={t("account.profile.gold")} value={fmt(p.gold)} color="text-green" icon={<Coin size={14} />} />
            <Stat label={t("account.profile.diamonds")} value={fmt(p.diamonds)} color="text-cyan" icon={<Diamond size={14} className="text-cyan" />} />
            <Stat label={t("account.profile.catches")} value={fmt(p.catches)} icon={<Pokeball size={14} />} />
            <Stat label={t("account.profile.pokedex")} value={<span className="text-green">{p.pokedexCount}<span className="text-text-dim">/{p.pokedexTotal}</span></span>} icon={<Star size={14} className="text-green" />} />
            <Stat label={t("account.f.rank")} value={p.rank > 0 ? `#${fmt(p.rank)}` : "—"} color={p.rank > 0 ? "text-text" : "slot-empty"} />
          </div>
          {/* barra de XP sempre presente: sem dado = trilho a 0% e numeros esmaecidos */}
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-text-dim">
              <span>XP · {t("account.profile.level")} {p.level}</span>
              <span className={`tabular-nums ${p.xpForNext > 0 ? "" : "slot-empty"}`}>{p.xpForNext > 0 ? `${fmt(p.xpInLevel)} / ${fmt(p.xpForNext)}` : "—"}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-[var(--well-bg)]">
              <div className="h-full rounded bg-[color:var(--green)]" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainerCard({ account }: { account: Account }) {
  const t = useT();
  const tr = account.trainer;
  return (
    <Section title={t("account.sec.trainer")}>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Row label={t("account.f.skin")} value={skinName(tr.lookType) ? `${skinName(tr.lookType)} · #${tr.lookType}` : `#${tr.lookType}`} />
        <Row label={t("account.f.clan")} value={tr.clan ? `${tr.clan} · #${tr.clanRank}` : dash} />
        <Row label={t("account.f.profession")} value={tr.profession ? `${tr.profession}${tr.professionRankName ? " · " + tr.professionRankName : ""}` : dash} />
        <Row label={t("account.f.catchBonus")} value={<span className="text-green">{pct(tr.catchBonusPct)}</span>} />
        <Row label={t("account.f.vipUntil")} value={tr.vipUntil ? fmtDate(tr.vipUntil) : dash} />
        <Row label={t("account.f.breedingSlots")} value={fmt(tr.breedingSlots)} />
        <Row label={t("account.f.diamondsBought")} value={fmt(tr.diamondsPurchased)} />
        <Row label={t("account.f.referral")} value={tr.referralCode ?? dash} />
      </div>
    </Section>
  );
}

function AutomationCard({ account, nameById }: { account: Account; nameById: (id: number) => string | undefined }) {
  const t = useT();
  const a = account.auto;
  const ballName = (id: number) => account.balls.find((b) => b.id === id)?.name ?? `#${id}`;
  return (
    <Section title={t("account.sec.auto")}>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Row label={t("account.f.autoCatch")} value={<span><OnOff on={a.autoCatch} /> · {ballName(a.autoCatchBallId)}</span>} />
        <Row label={t("account.f.autoCatchShiny")} value={<span><OnOff on={a.autoCatchShiny} /> · {ballName(a.autoCatchShinyBallId)}</span>} />
        <Row label={t("account.f.autoPotion")} value={<span><OnOff on={a.autoPotion} /> · {a.autoPotionThreshold}%</span>} />
        <Row label={t("account.f.autoRevive")} value={<OnOff on={a.autoRevive} />} />
        <Row label={t("account.f.selectedBall")} value={ballName(a.selectedBallId)} />
        <Row label={t("account.f.starter")} value={nameById(a.starterId) ?? `#${a.starterId}`} />
      </div>
    </Section>
  );
}

function StreakCard({ account }: { account: Account }) {
  const t = useT();
  const s = account.streak;
  return (
    <Section title={t("account.sec.streak")}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        <Stat label={t("account.f.streakPoints")} value={fmt(s.available)} color="text-yellow" icon={<Coin size={14} />} />
        <Stat label={t("account.f.streakKills")} value={fmt(s.totalKills)} icon={<Skull size={14} className="text-text-dim" />} />
        <Stat label={t("account.f.streakBonus")} value={<span className="text-green">{pct(s.bonusExp + s.bonusLoot + s.bonusShiny)}</span>} icon={<Xp size={14} className="text-green" />} />
        <Stat label="EXP · Loot · Shiny" value={<span className="text-green">{pct(s.bonusExp)} · {pct(s.bonusLoot)} · {pct(s.bonusShiny)}</span>} icon={<Star size={14} className="text-green" />} />
      </div>
    </Section>
  );
}

// Battle pass + pontos de atividade (characters/me). O passe some se a conta nunca pontuou;
// dos pontos, so aparecem os != 0 (a maioria das contas nao toca em todos os modos).
function BattlePassCard({ account }: { account: Account }) {
  const t = useT();
  const bp = account.pass;
  const pts = account.points;
  const activities: { key: string; value: number }[] = [
    { key: "pictures", value: pts.pictures },
    { key: "pokelog", value: pts.pokelog },
    { key: "boss", value: pts.boss },
    { key: "stylist", value: pts.stylist },
    { key: "engineer", value: pts.engineer },
    { key: "professor", value: pts.professor },
    { key: "adventurer", value: pts.adventurer },
    { key: "nightmare", value: pts.nightmare },
  ].filter((a) => a.value !== 0);
  if (bp.points === 0 && !bp.premium && activities.length === 0) return null;
  return (
    <Section title={t("account.sec.pass")}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        <Stat label={t("account.f.passPoints")} value={fmt(bp.points)} color="text-purple" icon={<Star size={14} className="text-purple" />} />
        <Stat label={t("account.f.passTier")} value={bp.premium
          ? <span className="text-yellow">{t("account.f.passPremium")}</span>
          : <span className="text-text-dim">{t("account.f.passFree")}</span>} />
        <Stat label={t("account.f.passClaimed")} value={<span>{fmt(bp.claimed)}<span className="text-text-dim"> + {fmt(bp.claimedPremium)} premium</span></span>} />
        <Stat label={t("account.f.passTotal")} value={fmt(bp.claimed + bp.claimedPremium)} />
      </div>
      {activities.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {activities.map((a) => (
            <Stat key={a.key} label={t(`account.f.pts.${a.key}`)} value={fmt(a.value)} />
          ))}
        </div>
      )}
    </Section>
  );
}

function BreedingCard({ account }: { account: Account }) {
  const t = useT();
  const b = account.breeding;
  if (!b.unlocked && b.eggs.length === 0 && b.usedSlots === 0 && b.pheromones === 0) return null;
  return (
    <Section title={t("account.sec.breeding")}>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("account.f.breedSlots")} value={`${b.usedSlots}/${b.maxSlots}`} />
        <Stat label={t("account.f.pheromones")} value={fmt(b.pheromones)} />
        <Stat label={t("account.f.eggs")} value={fmt(b.eggs.length)} />
      </div>
      {b.eggs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {b.eggs.map((e) => (
            <span key={e.id} className="chip inline-flex items-center gap-1">
              {e.name}{e.dexId ? ` · #${e.dexId}` : ""}{e.shiny && <span className="text-yellow"><Star size={14} /></span>}{e.ready && <span className="text-green"><Check size={14} /></span>}
            </span>
          ))}
        </div>
      )}
    </Section>
  );
}

// Inventario/deposito: a secao NAO some quando vazia — o par ocupa as duas colunas
// do grid sempre, e a lista vazia vira um tracinho esmaecido no mesmo espaco.
function ItemsCard({ title, items }: { title: string; items: AccountItem[] }) {
  if (!items.length) {
    return (
      <Section title={`${title} (0)`}>
        <p className="slot-empty flex min-h-16 items-center justify-center text-base">—</p>
      </Section>
    );
  }
  return (
    <Section title={`${title} (${items.length})`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 rounded border border-border bg-[var(--well-bg)] px-2 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
              <Sprite src={assetIconUrl(it.icon)} alt={it.name} size={26} />
            </span>
            <div className="min-w-0 text-sm leading-tight">
              <div className="truncate">{it.name}</div>
              <div className="tabular-nums text-text-dim">x{fmt(it.quantity)}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BallsCard({ account }: { account: Account }) {
  const t = useT();
  // Mostra as bolas reais do catalogo (x0 esmaecido). Esconde a Master Ball (id 5) a
  // menos que voce TENHA uma — ninguem tem, nao e compravel, so ocupava espaco — e as
  // entradas ocultas do jogo (sem icone e sem estoque).
  const balls = account.balls.filter((b) => (b.id !== 5 || b.count > 0) && (b.iconUrl || b.infinite || b.count > 0));
  // secao sempre presente: catalogo vazio (dado ainda nao veio) = tracinho no lugar
  if (!balls.length) {
    return (
      <Section title={t("account.sec.balls")}>
        <p className="slot-empty flex min-h-16 items-center justify-center text-base">—</p>
      </Section>
    );
  }
  return (
    <Section title={t("account.sec.balls")}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {balls.map((b) => {
          const owned = b.infinite || b.count > 0;
          return (
            <div
              key={b.id}
              className={`flex items-center gap-2 rounded border border-border bg-[var(--well-bg)] px-2 py-1.5 ${owned ? "" : "opacity-45"}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                <Sprite src={b.iconUrl ? assetIconUrl(b.iconUrl) : null} alt={b.name} size={22} />
              </span>
              <div className="min-w-0 text-sm leading-tight">
                <div className="truncate text-text">{b.name}</div>
                <div className="tabular-nums text-text-dim">{b.infinite ? <Infinity_ size={14} /> : `x${fmt(b.count)}`}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// A faixa mostrada aqui e a do INDIVIDUO (quality), a mesma do painel, do modal de stats
// e do jogo. Antes vinha a raridade da ESPECIE do catalogo: o time inteiro aparecia
// "comum" enquanto o resto do site dizia lendaria pro mesmo bicho.
function TeamMon({ p, onStats }: { p: ActivePoke; onStats?: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded border border-border bg-[var(--well-bg)] p-2.5">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
        <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={48} />
        {p.shiny && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={14} /></span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {/* nome do bicho fica como veio (sem caixa alta) — so o peso 500 separa ele
              do resto da linha; os chips nao encolhem, quem trunca e o nome */}
          <span className="truncate text-sm">{p.name}</span>
          {p.leader && <span className="chip shrink-0" style={{ background: "var(--green)", color: "#052012" }}>{t("account.team.leader")}</span>}
          {isFainted(p) && <FaintedChip />}
          <QualityBadge quality={p.quality} />
        </div>
        <div className="text-sm text-text-dim">Lv.{p.level}</div>
        <HpBar hp={p.hp} maxHp={p.maxHp} className="mt-1.5" />
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-text-dim">
          <span>{t("account.col.hp")} <HpText hp={p.hp} maxHp={p.maxHp} className="font-bold" /></span>
          <span>{t("account.col.power")} <span className="font-bold text-yellow">{fmt(p.power)}</span></span>
          <span>{t("account.col.iv")} <span className={`font-bold ${ivColor(p.ivTotal)}`}>{p.ivTotal}</span>/192</span>
          <span>{t("account.col.quality")} <span className="font-bold text-cyan">{p.quality.toFixed(3)}</span></span>
        </div>
      </div>
      {/* botao de stats com slot fixo (40px de toque); sem stats = espaco reservado */}
      {onStats ? (
        <button
          type="button"
          onClick={onStats}
          title={t("vip.team.viewStats")}
          className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded border border-border text-text-dim transition hover:border-[color:var(--cyan)]/60 hover:text-cyan"
        >
          <Chart size={18} />
        </button>
      ) : (
        <span aria-hidden className="h-10 w-10 shrink-0 self-start" />
      )}
    </div>
  );
}

// Time ativo (READ-ONLY): a Conta jamais abre sessao no jogo. Mas quando o ROBO ja esta
// conectado, o time ao vivo dele ja chega aqui pelo mesmo stream — usar esse e leitura,
// nao roubo de sessao, e e o unico jeito de a VIDA ser confiavel (snapshot de horas atras
// dizendo "cheio" foi como um Abra morto passou despercebido). Sem robo, cai no snapshot
// do connect, rotulado com a hora. Gestao continua fora: o botao leva a Meus Pokemons.
const hhmm = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

function ActiveTeamCard({ initial, dex, onManage }: { initial: TeamSnapshot | null; dex?: Record<number, MarketDex>; onManage?: () => void }) {
  const t = useT();
  // stats reais de um pokemon do snapshot (mesmo modal do painel/box)
  const [statsPoke, setStatsPoke] = useState<ActivePoke | null>(null);
  const hunt = useVipLive().hunt;
  const liveTeam = hunt?.wsOpen && hunt.team?.length ? (hunt.team as unknown as ActivePoke[]) : null;
  const list = liveTeam ?? initial?.list ?? [];
  if (list.length === 0) {
    return (
      <Section title={t("account.sec.team")}>
        <p className="text-base leading-relaxed text-text-dim">{t("account.team.snapshotEmpty")}</p>
      </Section>
    );
  }
  return (
    <Section
      title={t("account.sec.team")}
      extra={
        <span className="flex items-center gap-2 text-xs text-text-dim">
          {/* de onde vem o que voce esta lendo: ao vivo (robo ligado) ou a foto do connect */}
          {liveTeam ? (
            <span className="inline-flex items-center gap-1.5 uppercase text-green">
              <span className="hud-led pulse-soft" style={{ "--led": "var(--green)" } as React.CSSProperties} />
              {t("vip.ov.live")}
            </span>
          ) : (
            <span className="chip" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>{t("vip.team.snapshot")}</span>
          )}
          {initial && (
            <span>
              {t("account.team.total").replace("{n}", fmt(initial.total))}
              {!liveTeam && hhmm(initial.at) && ` · ${hhmm(initial.at)}`}
            </span>
          )}
        </span>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => <TeamMon key={p.id} p={p} onStats={p.stats ? () => setStatsPoke(p) : undefined} />)}
      </div>
      {/* a gestao (lider, box, curar) mora em Meus Pokemons — a Conta so aponta pra la */}
      {onManage && (
        <button type="button" onClick={onManage} className="btn btn-ghost self-start">
          {t("vip.sec.pokemons")} <ChevronRight size={14} />
        </button>
      )}
      {statsPoke && <PokeStatsModal poke={statsPoke} dex={dex?.[statsPoke.speciesId]} onClose={() => setStatsPoke(null)} />}
    </Section>
  );
}

export function AccountPanel({ creatures, dex, onGo }: { creatures: ComboCreature[]; dex?: Record<number, MarketDex>; onGo?: (section: string) => void }) {
  const t = useT();
  // Dados AO VIVO via SSE (mesmo shape do GET /api/collection) — sem fetch nem interval aqui.
  const live = useVipLive().account;
  // "desconectando" e estado local: mostra o ConnectForm na hora e deixa o proximo push
  // do stream confirmar (connected:false); nada de refetch manual.
  const [disconnecting, setDisconnecting] = useState(false);
  const nameById = (id: number) => creatures.find((c) => c.pokeId === id)?.name;

  useEffect(() => {
    if (live && !live.connected) setDisconnecting(false);
  }, [live]);

  const disconnect = async () => {
    setDisconnecting(true);
    await fetch("/api/disconnect", { method: "POST" });
  };

  if (live === null) return <div className="card p-8"><LoadingBall label={t("account.loading")} /></div>;
  if (disconnecting) return <ConnectForm />;
  if (!live.connected || !live.account) return <ConnectForm expired={live.reason === "expired"} />;

  // o payload do stream espelha o GET /api/collection — os tipos client-side do provider
  // sao mais estreitos, entao afunilamos pro tipo completo da UI aqui.
  const account = live.account as unknown as Account;
  const team = (live.team ?? null) as unknown as TeamSnapshot | null;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">{t("account.connected.title")}</h2>
        <button type="button" onClick={disconnect} className="btn btn-ghost">{t("account.disconnect")}</button>
      </div>
      <Overview account={account} />
      <ActiveTeamCard initial={team} dex={dex} onManage={onGo ? () => onGo("pokemons") : undefined} />
      <TrainerCard account={account} />
      <AutomationCard account={account} nameById={nameById} />
      <StreakCard account={account} />
      <BattlePassCard account={account} />
      <BreedingCard account={account} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ItemsCard title={t("account.sec.inventory")} items={account.inventory} />
        <ItemsCard title={t("account.sec.depot")} items={account.depot} />
      </div>
      <BallsCard account={account} />
    </div>
  );
}
