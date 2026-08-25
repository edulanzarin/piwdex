"use client";

import { useMemo, type CSSProperties } from "react";
import type { MetaMon } from "@/lib/meta";
import type { PackedBoss } from "@/lib/stadium-data";
import type { StadiumState } from "@/lib/stadium-url";
import { spriteUrl, assetIconUrl } from "@/lib/sprites";
import { projectAll } from "@/lib/stats";
import { REFORCO_HP, REFORCO_DANO } from "@/lib/stadium";
import { STAT_SHORT, compact, monLabel, num } from "@/lib/labels";
import {
  Chip,
  Combobox,
  Field,
  NumberField,
  Note,
  Panel,
  Segmented,
  Sprite,
  Switch,
  type ComboOption,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { IconGem, IconLevel } from "@/components/game-icons";

const TINT = "var(--color-t-stadium)";

/**
 * O ALVO: quem o time vai encarar.
 *
 * Duas entradas, e elas não são a mesma coisa em roupagens diferentes:
 *
 * - **Boss do jogo** é uma lista FECHADA, com o nível oficial de cada um. É o
 *   caminho de quem já sabe onde vai entrar, e é o único que traz a arte e os
 *   drops de verdade.
 * - **Espécie livre** é qualquer pokémon em qualquer nível. Serve pro boss que
 *   não tem espécie (metade do catálogo), pro selvagem de hunt e pra pergunta
 *   "e se fosse".
 *
 * O boss escolhido PREENCHE a espécie e o nível; a partir daí os dois campos
 * continuam editáveis. Travá-los seria mais "correto" e menos útil: o nível
 * oficial é o do boss, mas quem quer saber o que muda subindo vinte níveis está
 * fazendo a pergunta certa.
 */
export function StadiumAlvo({
  mons,
  bosses,
  state,
  patch,
}: {
  mons: MetaMon[];
  bosses: PackedBoss[];
  state: StadiumState;
  patch: (p: Partial<StadiumState>) => void;
}) {
  const byId = useMemo(() => new Map(mons.map((m) => [m.pokeId, m])), [mons]);
  const alvo = state.alvo != null ? byId.get(state.alvo) ?? null : null;
  const boss = state.boss ? bosses.find((b) => b.key === state.boss) ?? null : null;

  const modo = state.fonte;

  const opcoesBoss = useMemo<ComboOption<string>[]>(
    () =>
      bosses.map((b) => ({
        value: b.key,
        label: `${b.name} · Lv ${b.level}`,
        keywords: `${b.category} ${b.level}`,
        render: (
          <span className="flex min-w-0 items-center gap-2">
            <Sprite
              src={b.img ? assetIconUrl(b.img) : b.mon != null ? spriteUrl(b.mon) : null}
              alt={b.name}
              size={26}
            />
            <span className="min-w-0 flex-1 truncate">{b.name}</span>
            <span className="pix shrink-0 text-[10px] text-text-mute">
              {b.category} · LV {b.level}
            </span>
          </span>
        ),
      })),
    [bosses],
  );

  const opcoesMon = useMemo<ComboOption<number>[]>(
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
        .sort((a, b) => a.label.localeCompare(b.label)),
    [mons],
  );

  const escolherBoss = (key: string | null) => {
    if (!key) return patch({ boss: "" });
    const b = bosses.find((x) => x.key === key);
    if (!b) return;
    // A espécie só é sobrescrita quando o boss TEM uma. Boss sem espécie mantém o
    // que já estava no campo: quem escolheu um Terror e depois um pokémon de base
    // pra ele não pode perder a escolha ao trocar de boss dentro da mesma família.
    patch({ boss: key, alvoLv: b.level, ...(b.mon != null ? { alvo: b.mon } : {}) });
  };

  const stats = alvo
    ? projectAll(
        [alvo.baseHp, alvo.baseAtk, alvo.baseDef, alvo.baseSpAtk, alvo.baseSpDef, alvo.baseSpeed],
        Array<number>(6).fill(state.iv === "perfeito" ? 32 : 21),
        state.alvoLv,
        state.alvoQ,
      )
    : null;

  return (
    <Panel
      title={<span className="pix">O alvo</span>}
      actions={
        boss ? (
          <Chip size="xs" tone="neutral">
            {boss.category}
          </Chip>
        ) : null
      }
      bodyClassName="flex flex-col gap-3"
      style={{ "--tint": TINT } as CSSProperties}
    >
      <Field label="De onde vem o alvo">
        <Segmented
          value={modo}
          onChange={(fonte) =>
            // Sair da lista de bosses SOLTA a chave. O alvo passa a ser a espécie
            // que está no campo, e seguir exibindo o nome e a arte do boss em cima
            // de um nível que a pessoa mudou faria a tela afirmar um boss que ela
            // não está mais medindo.
            patch(fonte === "livre" ? { fonte, boss: "" } : { fonte })
          }
          options={[
            { value: "boss" as const, label: "boss do jogo", title: "A lista oficial, com o nível de cada um" },
            { value: "livre" as const, label: "espécie livre", title: "Qualquer pokémon, em qualquer nível" },
          ]}
        />
      </Field>

      {modo === "boss" ? (
        <Field label="Boss" hint={`${bosses.length} no catálogo do jogo`}>
          <Combobox
            value={state.boss || null}
            onChange={escolherBoss}
            options={opcoesBoss}
            placeholder="Procure pelo nome ou pela categoria..."
            emptyText="nenhum boss com esse nome"
          />
        </Field>
      ) : null}

      <Field
        label="Espécie"
        hint={
          boss && boss.mon == null
            ? "este boss não é pokémon nenhum: escolha a base que ele usa"
            : undefined
        }
      >
        <Combobox
          value={state.alvo}
          onChange={(v) => patch({ alvo: v })}
          options={opcoesMon}
          placeholder="Procure pelo nome..."
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Nível" icon={<IconLevel size={14} />}>
          <NumberField
            value={state.alvoLv}
            onChange={(v) => patch({ alvoLv: v })}
            min={1}
            max={1000}
            fallback={100}
          />
        </Field>
        <Field label="Quality" icon={<IconGem size={14} />}>
          <NumberField
            value={state.alvoQ}
            onChange={(v) => patch({ alvoQ: v })}
            min={0}
            max={10}
            step={0.001}
            fallback={1}
          />
        </Field>
      </div>

      <Field>
        <Switch
          checked={state.reforco}
          onChange={(e) => patch({ reforco: e.currentTarget.checked })}
          label="leva o reforço do jogo"
          hint={`HP x${REFORCO_HP} e dano x${REFORCO_DANO}, como o jogo reforça o lado selvagem`}
        />
      </Field>

      {boss && boss.mon == null && state.alvo == null ? (
        <Note tone="warn">
          O jogo não publica tipo nem stat de {boss.name}, e o nome dele não é de nenhuma
          espécie do catálogo. Sem espécie não há combate a simular. Escolha acima a base
          que ele usa, ou meça contra outro boss.
        </Note>
      ) : null}

      {alvo && stats ? (
        <div className="flex flex-col gap-2 border border-line-strong bg-surface-2/60 p-3">
          <div className="flex items-center gap-3">
            <Sprite
              src={boss?.img ? assetIconUrl(boss.img) : spriteUrl(alvo.pokeId)}
              alt={boss?.name ?? alvo.name}
              size={56}
              className="[--sprite:56px]"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="pix truncate text-[13px]" style={{ color: TINT }}>
                {boss?.name ?? monLabel(alvo)}
              </span>
              <span className="pix text-[10px] text-text-mute">
                LV {state.alvoLv} · Q {num(state.alvoQ, 2)}
                {boss && boss.mon !== alvo.pokeId ? ` · base ${alvo.name}` : ""}
              </span>
              <span className="flex flex-wrap gap-1">
                <TypeBadge type={alvo.type1} size="xs" />
                {alvo.type2 ? <TypeBadge type={alvo.type2} size="xs" /> : null}
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-x-3 gap-y-1">
            {stats.stats.map((v, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <dt className="pix text-[10px] text-text-mute">{STAT_SHORT[i]}</dt>
                <dd className="tabular text-[12px] text-text-dim">
                  {/* O HP mostra o valor REFORÇADO, que é o que a luta usa. Mostrar
                      o cru ao lado de um combate que consumiu cinco vezes isso faria
                      a pessoa conferir a conta e achar que a tela errou. */}
                  {i === 0 && state.reforco
                    ? compact(Math.round(v * REFORCO_HP))
                    : compact(v)}
                </dd>
              </div>
            ))}
          </dl>

          {state.reforco ? (
            <Note flush className="text-[12px]">
              A vida mostrada já é a reforçada: {compact(stats.stats[0])} x {REFORCO_HP}.
            </Note>
          ) : null}

          {boss?.drops.length ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
              <span className="pix text-[10px] text-text-mute">DROPA</span>
              {boss.drops.map((d) => (
                <Chip key={d} size="xs" tone="neutral">
                  {d}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <Note>
          {modo === "boss"
            ? "Escolha um boss pra ver o tipo, os stats no nível dele e o que ele dropa."
            : `Escolha a espécie do alvo. São ${mons.length} no catálogo, e o tipo dela é o que mais muda a resposta.`}
        </Note>
      )}
    </Panel>
  );
}
