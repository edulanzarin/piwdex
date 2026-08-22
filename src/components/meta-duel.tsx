"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  DEFAULT_IV,
  arenaDuel,
  type ArenaSide,
  type MetaMon,
  type MovePool,
} from "@/lib/meta";
import { IV_MAX } from "@/lib/stats";
import { effLabel } from "@/lib/hunt";
import type { MetaState } from "@/lib/meta-url";
import { animatedSpriteUrl, spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
import { STAT_LABEL, TYPE_LABEL, compact, monLabel, num} from "@/lib/labels";
import {
  Chip,
  Combobox,
  Empty,
  Field,
  FieldLabel,
  Note,
  NumberField,
  Panel,
  Segmented,
  Sprite,
  Switch,
  Tooltip,
} from "@/components/ui";
import { TypeBadge, TypeIcon } from "@/components/type-icon";
import { IconGem, IconLevel, STAT_ICONS } from "@/components/game-icons";

/**
 * O duelo.
 *
 * Aqui a pergunta e sobre INDIVIDUOS, nao sobre especies — e por isso ele nao usa a
 * nota da tier list. Dois Gyarados com nivel e quality diferentes sao dois pokemon
 * diferentes, e a tier list, que compara especie contra especie, nao tem como
 * responder qual dos dois ganha.
 *
 * Quem vence e quem DERRUBA PRIMEIRO, com o mesmo modelo de dano da Hunt. O lado
 * selvagem leva o reforco do jogo nos dois sentidos: mais HP pra aguentar e mais
 * dano por golpe — e e por isso que "eu ganho dele no Stadium" nao quer dizer "eu
 * cacço ele em paz".
 */
export function MetaDuel({
  mons,
  state,
  patch,
  pool,
}: {
  mons: MetaMon[];
  state: MetaState;
  patch: (p: Partial<MetaState>) => void;
  pool: MovePool;
}) {
  const byId = useMemo(() => new Map(mons.map((m) => [m.pokeId, m])), [mons]);
  const a = state.a != null ? byId.get(state.a) ?? null : null;
  const b = state.b != null ? byId.get(state.b) ?? null : null;

  const iv = state.iv === "perfeito" ? IV_MAX : DEFAULT_IV;
  const ivs = useMemo(() => Array<number>(6).fill(iv), [iv]);

  const resultado = useMemo(() => {
    if (!a || !b) return null;
    return arenaDuel(
      { mon: a, level: state.aLv, quality: state.aQ, ivs, wild: false },
      { mon: b, level: state.bLv, quality: state.bQ, ivs, wild: state.wild },
      pool,
    );
  }, [a, b, state.aLv, state.aQ, state.bLv, state.bQ, state.wild, ivs, pool]);

  const opcoes = useMemo(
    () =>
      mons
        .map((m) => ({
          value: m.pokeId,
          label: monLabel(m),
          keywords: String(m.pokeId),
          render: (
            <span className="flex items-center gap-2">
              <Sprite src={spriteUrl(m.pokeId)} alt={m.name} size={26} />
              {m.name}
            </span>
          ),
        }))
        .sort((x, y) => x.label.localeCompare(y.label)),
    [mons],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <LadoForm
          titulo="Você"
          id={state.a}
          level={state.aLv}
          quality={state.aQ}
          opcoes={opcoes}
          mon={a}
          onId={(v) => patch({ a: v })}
          onLevel={(v) => patch({ aLv: v })}
          onQuality={(v) => patch({ aQ: v })}
        />
        <LadoForm
          titulo="O adversário"
          id={state.b}
          level={state.bLv}
          quality={state.bQ}
          opcoes={opcoes}
          mon={b}
          onId={(v) => patch({ b: v })}
          onLevel={(v) => patch({ bLv: v })}
          onQuality={(v) => patch({ bQ: v })}
          extra={
            <Field>
              <Switch
                checked={state.wild}
                onChange={(e) => patch({ wild: e.currentTarget.checked })}
                label="é um selvagem de hunt"
                hint="HP x5 e dano x1.8, como o jogo reforça na caçada"
              />
            </Field>
          }
        />
      </div>

      <Panel bodyClassName="flex flex-wrap items-start gap-x-4 gap-y-3">
        <Field label="IV dos dois lados" hint="o jogo não mostra IV; aqui os dois usam o mesmo, pra a comparação ser só de espécie, nível e quality">
          <Segmented
            value={state.iv}
            onChange={(v) => patch({ iv: v as MetaState["iv"] })}
            options={[
              { value: "medio", label: `médio (${DEFAULT_IV})`, title: "A média do jogo" },
              { value: "perfeito", label: `perfeito (${IV_MAX})`, title: "O teto do jogo" },
            ]}
          />
        </Field>
      </Panel>

      {!a || !b || !resultado ? (
        <Panel>
          <Empty
            title="Escolha os dois lados"
            hint="O duelo compara indivíduos: espécie, nível e quality de cada um."
          />
        </Panel>
      ) : (
        <Panel
          title={
            <span className="pix">
              {resultado.win ? `${monLabel(a)} derruba primeiro` : `${monLabel(b)} derruba primeiro`}
            </span>
          }
        >
          <div className="flex flex-col gap-4">
            {/* a manchete: quem ganha e por quanto */}
            <div className="flex flex-wrap items-center justify-center gap-4 border border-line-strong bg-surface-2/60 p-4">
              <Lutador mon={a} level={state.aLv} vencedor={resultado.win} />
              <span className="flex flex-col items-center gap-1">
                <span className="pix text-[11px] text-text-mute">vantagem</span>
                <span
                  className={cn(
                    "text-[26px] leading-none font-bold tabular",
                    resultado.win ? "text-ok" : "text-danger",
                  )}
                >
                  {/* `margin` tem tres casos que nao sao razao: 0 (voce nao
                      machuca ele), Infinity (ele nao machuca voce) e 1 vindo de
                      empate por imunidade dos dois lados. O guarda antigo era so
                      `Number.isFinite`, e como ZERO e finito ele passava direto
                      pro ramo de derrota, onde `1 / 0` imprimia "Infinityx" na
                      tela. Vantagem impossivel de medir mostra o simbolo, dos
                      dois lados. */}
                  {resultado.margin > 0 && Number.isFinite(resultado.margin)
                    ? `${num(resultado.win ? resultado.margin : 1 / resultado.margin, 2)}x`
                    : "∞"}
                </span>
                <span className="pix text-[10px] text-text-mute">mais rápido</span>
              </span>
              <Lutador mon={b} level={state.bLv} vencedor={!resultado.win} selvagem={state.wild} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <LadoResultado titulo={monLabel(a)} lado={resultado.me} alvo={b} />
              <LadoResultado titulo={monLabel(b)} lado={resultado.foe} alvo={a} />
            </div>

            <Note flush>
              Quem ganha é quem derruba primeiro, com o mesmo modelo de dano da Hunt — não
              quem tem o maior número. Sem golpe que passe pela defesa do outro, o tempo de
              abate é infinito e o duelo não acontece.
            </Note>
          </div>
        </Panel>
      )}
    </div>
  );
}

function LadoForm({
  titulo,
  id,
  level,
  quality,
  opcoes,
  mon,
  onId,
  onLevel,
  onQuality,
  extra,
}: {
  titulo: string;
  id: number | null;
  level: number;
  quality: number;
  opcoes: { value: number; label: string; keywords: string; render: React.ReactNode }[];
  mon: MetaMon | null;
  onId: (v: number | null) => void;
  onLevel: (v: number) => void;
  onQuality: (v: number) => void;
  extra?: React.ReactNode;
}) {
  return (
    <Panel title={<span className="pix">{titulo}</span>}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
          <Field label="Espécie" className="min-w-[12rem] flex-1">
            <Combobox
              value={id}
              onChange={onId}
              options={opcoes}
              placeholder="nome do pokémon..."
              emptyText="nenhuma espécie com esse nome"
            />
          </Field>
          <Field label="Nível" icon={<IconLevel size={14} />} className="w-24">
            <NumberField min={1} fallback={1} value={level} onChange={onLevel} className="text-center text-[15px]" />
          </Field>
          <Field label="Quality" icon={<IconGem size={14} />} className="w-28">
            <NumberField
              min={0}
              step={0.01}
              fallback={1}
              value={quality}
              onChange={onQuality}
              className="text-center text-[15px]"
            />
          </Field>
        </div>
        {extra}
        {mon ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={mon.type1} size="xs" />
            {mon.type2 ? <TypeBadge type={mon.type2} size="xs" /> : null}
          </span>
        ) : null}
      </div>
    </Panel>
  );
}

function Lutador({
  mon,
  level,
  vencedor,
  selvagem,
}: {
  mon: MetaMon;
  level: number;
  vencedor: boolean;
  selvagem?: boolean;
}) {
  return (
    <span className={cn("flex flex-col items-center gap-1", !vencedor && "opacity-60")}>
      <Sprite
        src={spriteUrl(mon.pokeId)}
        animatedSrc={animatedSpriteUrl(mon.pokeId)}
        alt={mon.name}
        size={72}
      />
      <span className="text-[15px] font-semibold text-text">{monLabel(mon)}</span>
      <span className="flex items-center gap-1.5">
        <span className="pix text-[11px] text-text-mute">nível {level}</span>
        {selvagem ? <Chip size="xs" tone="warn">selvagem</Chip> : null}
      </span>
    </span>
  );
}

function LadoResultado({ titulo, lado, alvo }: { titulo: string; lado: ArenaSide; alvo: MetaMon }) {
  return (
    <div className="flex flex-col gap-2 border border-line bg-surface/60 p-3">
      <FieldLabel>{titulo} bate em {alvo.name}</FieldLabel>
      {lado.move ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tint={TYPE_COLOR[lado.move.type]} icon={<TypeIcon type={lado.move.type} size={14} />}>
              {lado.move.name}
            </Chip>
            <span className="text-[18px] leading-none font-bold text-text tabular">{effLabel(lado.eff)}</span>
          </div>
          <dl className="grid grid-cols-3 gap-px overflow-hidden border border-line bg-line">
            {[
              { label: "dano por golpe", valor: compact(Math.round(lado.hit)) },
              { label: "dano por segundo", valor: compact(Math.round(lado.dps)) },
              {
                label: "segundos pra derrubar",
                valor: Number.isFinite(lado.ttk) ? `${num(lado.ttk, 1)}s` : "nunca",
              },
            ].map((k) => (
              <div key={k.label} className="bg-surface px-2.5 py-2">
                <dd className="text-[17px] leading-none font-semibold text-text tabular">{k.valor}</dd>
                <dt className="pix mt-1.5 text-[10px] text-text-mute">{k.label}</dt>
              </div>
            ))}
          </dl>
          <Tooltip content={`Poder ${lado.power.toLocaleString("pt-BR")} — soma dos stats vezes a quality.`}>
            <span className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-text-mute">
              {lado.stats.map((v, i) => {
                const Icon = STAT_ICONS[i];
                return (
                  <span key={i} className="inline-flex items-center gap-1" title={STAT_LABEL[i]}>
                    <Icon size={12} />
                    <span className="tabular">{v}</span>
                  </span>
                );
              })}
            </span>
          </Tooltip>
        </>
      ) : (
        <p className="text-[13px] text-text-mute">
          Nenhum golpe disponível passa pela defesa de {alvo.name} neste nível.
        </p>
      )}
    </div>
  );
}
