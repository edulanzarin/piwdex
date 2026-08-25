"use client";

import { useMemo, type CSSProperties } from "react";
import type { MetaMon } from "@/lib/meta";
import type { PackedBoss } from "@/lib/stadium-data";
import type { StadiumState } from "@/lib/stadium-url";
import { spriteUrl, assetIconUrl } from "@/lib/sprites";
import { projectAll, IV_MAX } from "@/lib/stats";
import { DEFAULT_IV } from "@/lib/meta";
import { REFORCO_HP, REFORCO_DANO } from "@/lib/stadium";
import { STAT_LABEL, STAT_SHORT, compact, monLabel, num } from "@/lib/labels";
import {
  Button,
  Chip,
  Combobox,
  Field,
  FieldLabel,
  NumberField,
  Note,
  Panel,
  Segmented,
  Sprite,
  Switch,
  type ComboOption,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { IconGem, IconLevel, STAT_ICONS } from "@/components/game-icons";

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

  /**
   * Os seis do alvo: os que a pessoa DIGITOU, ou a projeção.
   *
   * Digitado vence sempre, e é o caminho certo pra boss — o jogo não publica
   * stat nenhum deles, e a barra de vida durante o combate é a única fonte que
   * existe. O Ancient Aero tem 72 mil de vida; a projeção sobre o Aerodactyl dá
   * 4,6 mil. Não é imprecisão, é outra grandeza.
   */
  const projetados = alvo
    ? projectAll(
        [alvo.baseHp, alvo.baseAtk, alvo.baseDef, alvo.baseSpAtk, alvo.baseSpDef, alvo.baseSpeed],
        Array<number>(6).fill(state.iv === "perfeito" ? IV_MAX : DEFAULT_IV),
        state.alvoLv,
        state.alvoQ,
      ).stats
    : null;
  const conhecidos = state.alvoStats.some((v) => v > 0);
  const stats = conhecidos ? state.alvoStats : projetados;

  const setStat = (i: number, v: number) =>
    patch({
      // Mexer num stat CONGELA os seis: a partir daí eles são dados, não
      // projeção. Deixar os outros cinco seguirem o nível faria metade da ficha
      // andar quando a pessoa corrigisse a vida.
      alvoStats: (conhecidos ? state.alvoStats : projetados ?? [0, 0, 0, 0, 0, 0]).map((x, j) =>
        j === i ? Math.max(0, Math.round(v)) : x,
      ),
    });

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

      <Field
        label="Elemento"
        hint={
          state.neutro
            ? "é o que a ficha do boss no jogo mostra: ninguém tem vantagem, nos dois sentidos"
            : "usa o tipo da espécie; vale pra selvagem, não pra boss"
        }
      >
        <Segmented
          value={state.neutro ? "neutro" : "tipo"}
          onChange={(v) => patch({ neutro: v === "neutro" })}
          options={[
            { value: "neutro", label: "neutro", title: "Elemento: Neutro — como o jogo mostra na ficha do boss" },
            { value: "tipo", label: "tipo da espécie", title: "Aerodactyl entra como Pedra/Voador" },
          ]}
        />
      </Field>

      <Field>
        <Switch
          checked={state.reforco}
          onChange={(e) => patch({ reforco: e.currentTarget.checked })}
          label="leva o reforço de selvagem"
          hint={`HP x${REFORCO_HP} e dano x${REFORCO_DANO}. É a regra da caçada; com a vida do boss digitada, deixe desligado`}
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

          <div className="flex flex-col gap-1.5 border-t border-line pt-2">
            <div className="flex items-baseline justify-between gap-2">
              <FieldLabel>Stats do alvo</FieldLabel>
              {conhecidos ? (
                <button
                  type="button"
                  className="pix text-[10px] text-text-mute underline-offset-2 hover:text-text hover:underline"
                  onClick={() => patch({ alvoStats: [0, 0, 0, 0, 0, 0] })}
                >
                  VOLTAR À ESTIMATIVA
                </button>
              ) : (
                <span className="pix text-[10px] text-warn">ESTIMADO</span>
              )}
            </div>
            {/* Duas colunas: a coluna do alvo tem 21rem, e três campos de número
                não cabem. Mesma escada do formulário de carta. */}
            <div className="grid grid-cols-2 gap-1.5">
              {STAT_LABEL.map((label, i) => {
                const Icon = STAT_ICONS[i];
                return (
                  <div key={label}>
                    <FieldLabel className="mb-0.5 flex items-center gap-1 text-text-mute">
                      <Icon size={13} />
                      {STAT_SHORT[i]}
                    </FieldLabel>
                    <NumberField
                      min={0}
                      fallback={0}
                      grouped
                      aria-label={`${label} do alvo`}
                      value={stats[i]}
                      onChange={(v) => setStat(i, v)}
                      className="text-center text-[14px]"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {conhecidos ? (
            <Note flush className="text-[12px]">
              {state.reforco
                ? `A vida entra reforçada: ${compact(stats[0])} x ${REFORCO_HP} = ${compact(stats[0] * REFORCO_HP)}. Se ${compact(stats[0])} já é o que o jogo mostra, desligue o reforço.`
                : `A vida entra como está: ${compact(stats[0])}.`}
            </Note>
          ) : (
            <Note tone="warn" flush className="text-[12px]">
              O jogo não publica stat de boss, então isto é projetado da espécie. Na luta, a
              barra de vida dele mostra o número de verdade — o Ancient Aero tem 72 mil, e a
              estimativa aqui dá {compact((stats[0] ?? 0) * (state.reforco ? REFORCO_HP : 1))}.
              Digite o que você viu e ele fica guardado.
            </Note>
          )}

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
