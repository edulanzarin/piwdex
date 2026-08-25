"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { unpackMon, type PackedMon } from "@/lib/meta-data";
import {
  bestMove,
  defaultIvs,
  metaTable,
  TIER_COLOR,
  type MetaMon,
  type Tier,
} from "@/lib/meta";
import { projectAll } from "@/lib/stats";
import { spriteUrl } from "@/lib/sprites";
import { compact, num, STAT_SHORT } from "@/lib/labels";
import { cartaLabel, lerBolsa, type Carta } from "@/lib/bolsa";
import type { PedraInfo } from "@/lib/eevee-data";
import {
  abatesPara,
  EEVEE_ID,
  melhorFonte,
  montarRamos,
  OURO_DA_TROCA,
  PEDRAS_DA_TROCA,
  TROCAS,
  type FonteDaPedra,
} from "@/lib/eevee";
import {
  buildEeveeSearch,
  EMPTY_EEVEE,
  parseEeveeState,
} from "@/lib/eevee-url";
import {
  Field,
  FieldRow,
  Metric,
  MetricGrid,
  Note,
  NumberField,
  Panel,
  Select,
  Sprite,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { EeveeEstrela } from "@/components/eevee-estrela";
import { EeveePedra } from "@/components/eevee-pedra";

const TINT = "var(--color-t-eevee)";

interface Linha {
  i: number;
  nome: string;
  pedra: string;
  mon: MetaMon | null;
  tier: Tier | null;
  score: number;
  /** poder projetado no nível/quality informados */
  poder: number;
  stats: number[];
  golpe: string | null;
  /** a melhor fonte que o nível alcança, e o caminho até dez pedras */
  fonte: FonteDaPedra | null;
  abates: number;
}

/**
 * A ESCOLHA DO EEVEE.
 *
 * A tela existe porque o jogo cobra o MESMO preço nas cinco trocas — $65.000 e
 * dez pedras — e, quando o custo não separa as opções, a decisão inteira se muda
 * para duas perguntas que ninguém responde de cabeça: qual pedra dá pra farmar no
 * meu nível, e qual eeveelution presta em combate.
 *
 * Por isso o painel central não é a estrela: é a TABELA dos cinco, com a nota de
 * combate ao lado dos abates até juntar dez pedras. Uma coluna sem a outra dá
 * conselho errado com a mesma confiança, e o catálogo de hoje mostra as duas
 * discordando: o Flareon lidera o combate (S, 83,8) e a Fire Stone é a pior
 * pedra de todas até o nível 60 — 4.477 abates num Charmeleon, contra 2.123 da
 * Thunder Stone num Pikachu. "Pegue o melhor" é uma resposta que depende de quem
 * pergunta.
 *
 * A estrela fica em cima porque ela responde outra coisa, antes das contas: que
 * são cinco, que são excludentes, e que o catálogo do jogo mente quando desenha
 * uma seta só.
 */
export function EeveeTool({
  mons: packed,
  pedras,
}: {
  mons: PackedMon[];
  pedras: PedraInfo[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [estado, setEstado] = useState(() =>
    parseEeveeState(new URLSearchParams(sp.toString())),
  );
  const { ramo: escolhido, level, quality } = estado;

  useEffect(() => {
    const id = window.setTimeout(() => {
      router.replace(`${pathname}${buildEeveeSearch(estado)}`, {
        scroll: false,
      });
    }, 250);
    return () => window.clearTimeout(id);
  }, [estado, router, pathname]);

  // ---- a coleção, só de leitura: aqui ninguém salva carta, só usa a que existe
  const [bolsa, setBolsa] = useState<Carta[]>([]);
  const [cartaId, setCartaId] = useState("");
  useEffect(() => setBolsa(lerBolsa()), []);
  const eevees = useMemo(
    () => bolsa.filter((c) => c.pokeId === EEVEE_ID),
    [bolsa],
  );
  const carta = eevees.find((c) => c.id === cartaId) ?? null;

  // Escolher uma carta EMPURRA nível e quality dela pro estado, em vez de manter
  // dois valores concorrentes. Dois eram o defeito da primeira versão: a carta
  // dizia nível 240 e os campos continuavam em 100, então a projeção respondia
  // sobre um Eevee que não era o dela.
  useEffect(() => {
    if (!carta) return;
    setEstado((s) => ({
      ...s,
      level: carta.level ?? s.level,
      quality: carta.quality || s.quality,
    }));
  }, [carta]);

  const ivs = carta?.ivs ?? defaultIvs();

  const mons = useMemo(() => packed.map(unpackMon) as MetaMon[], [packed]);
  const notas = useMemo(() => {
    const m = new Map<number, { tier: Tier; score: number }>();
    for (const e of metaTable(mons, "natural")) {
      m.set(e.creature.pokeId, { tier: e.tier, score: e.score });
    }
    return m;
  }, [mons]);

  const fontesPorPedra = useMemo(() => {
    const o: Record<string, FonteDaPedra[]> = {};
    for (const p of pedras) o[p.nome] = p.fontes;
    return o;
  }, [pedras]);

  const ramos = useMemo(
    () => montarRamos(mons, fontesPorPedra),
    [mons, fontesPorPedra],
  );

  const linhas: Linha[] = useMemo(
    () =>
      ramos.map((r, i) => {
        const nota = r.mon ? notas.get(r.mon.pokeId) : undefined;
        const bases = r.mon
          ? [
              r.mon.baseHp,
              r.mon.baseAtk,
              r.mon.baseDef,
              r.mon.baseSpAtk,
              r.mon.baseSpDef,
              r.mon.baseSpeed,
            ]
          : [0, 0, 0, 0, 0, 0];
        const proj = projectAll(bases, ivs, level, quality);
        const fonte = melhorFonte(r.fontes, level);
        return {
          i,
          nome: r.troca.nome,
          pedra: r.troca.pedra,
          mon: r.mon,
          tier: nota?.tier ?? null,
          score: nota?.score ?? 0,
          poder: proj.power,
          stats: proj.stats,
          golpe: r.mon
            ? (bestMove(r.mon, "natural")?.attack.name ?? null)
            : null,
          fonte,
          abates: fonte ? abatesPara(fonte) : Infinity,
        };
      }),
    [ramos, notas, ivs, level, quality],
  );

  const linha = linhas[escolhido];
  const pedra = pedras[escolhido];
  const melhorNota = Math.max(...linhas.map((l) => l.score));
  const menosAbates = Math.min(...linhas.map((l) => l.abates));

  return (
    <div
      className="flex flex-col gap-4"
      style={{ "--tint": TINT } as CSSProperties}
    >
      {/* A estrela e QUADRADA e tem teto de largura, entao numa tela larga ela
          sobra: 560px de figura num painel de 1050 deixavam 245px mortos de cada
          lado, e um painel de quase 800px de altura pra dizer cinco nomes. Os
          campos sobem pro vao em vez de empilhar embaixo. No celular a segunda
          coluna some e volta a ser pilha, que la e o certo. */}
      <Panel
        title={<span className="pix">A estrela</span>}
        actions={
          <span className="num text-[13px] text-text-mute">
            {TROCAS.length} destinos · mesmo preço
          </span>
        }
        bodyClassName="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <EeveeEstrela
          ramos={ramos}
          tiers={notas}
          escolhido={escolhido}
          onEscolher={(i) => setEstado((s) => ({ ...s, ramo: i }))}
        />

        <div className="flex flex-col gap-4">
          <FieldRow className="lg:flex-col lg:items-stretch">
            <Field
              label="Seu Eevee"
              hint={
                eevees.length === 0
                  ? "Nenhum Eevee na bolsa — dá pra digitar nível e quality à mão."
                  : "Da sua bolsa: puxa nível, quality e os IV de verdade."
              }
            >
              <Select
                value={cartaId}
                onChange={setCartaId}
                disabled={eevees.length === 0}
                options={[
                  { value: "", label: "Eevee genérico (IV 21)" },
                  ...eevees.map((c) => ({ value: c.id, label: cartaLabel(c) })),
                ]}
              />
            </Field>

            <Field label="Nível" hint="também corta as hunts acima de você">
              <NumberField
                value={level}
                onChange={(v) => setEstado((s) => ({ ...s, level: v }))}
                min={1}
                max={1000}
                fallback={EMPTY_EEVEE.level}
              />
            </Field>

            <Field label="Quality">
              <NumberField
                value={quality}
                onChange={(v) => setEstado((s) => ({ ...s, quality: v }))}
                min={0}
                max={4}
                step={0.1}
                fallback={EMPTY_EEVEE.quality}
              />
            </Field>
          </FieldRow>

          <Note flush>
            O catálogo do jogo diz que o Eevee evolui pro Vaporeon no nível 80 —
            um caminho só, por nível. Não é o que acontece: quem faz a troca é o
            Marlon, são cinco destinos e cada um pede a sua pedra. Esta tabela
            veio da tela da loja, porque é o único lugar em que ela aparece.
          </Note>
        </div>
      </Panel>

      <Panel
        title={<span className="pix">A troca</span>}
        actions={
          <span className="flex items-center gap-2">
            <Sprite
              src={spriteUrl(linha.mon?.pokeId ?? TROCAS[escolhido].pokeId)}
              alt=""
              size={22}
              className="[--sprite:22px]"
            />
            <span className="text-[13px] text-text-dim">{linha.nome}</span>
          </span>
        }
        bodyClassName="flex flex-col gap-4"
      >
        <MetricGrid cols={4}>
          <Metric
            size="sm"
            value={compact(OURO_DA_TROCA)}
            label="de ouro"
            tint={TINT}
            hint="igual nas cinco trocas"
          />
          <Metric
            size="sm"
            value={`${PEDRAS_DA_TROCA}x`}
            label={linha.pedra}
            tint={TINT}
            hint="a única coisa que muda entre os ramos"
          />
          <Metric
            size="sm"
            value={
              Number.isFinite(linha.abates)
                ? compact(Math.ceil(linha.abates))
                : "—"
            }
            label="abates pelas pedras"
            tint={linha.abates === menosAbates ? "var(--color-ok)" : undefined}
            hint={
              linha.fonte
                ? `caçando ${linha.fonte.nome}`
                : "nada no seu nível solta essa"
            }
          />
          <Metric
            size="sm"
            value={linha.tier ?? "—"}
            label={`nota ${num(linha.score, 1)}`}
            tint={linha.tier ? TIER_COLOR[linha.tier] : undefined}
            hint={
              linha.score === melhorNota
                ? "o melhor dos cinco"
                : "tier list do catálogo"
            }
          />
        </MetricGrid>

        {linha.mon ? (
          <div className="flex flex-col gap-3 border border-line-strong bg-surface-2/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <TypeBadge type={linha.mon.type1} />
                {linha.mon.type2 ? <TypeBadge type={linha.mon.type2} /> : null}
              </span>
              <span className="text-[13px] text-text-mute">
                melhor golpe natural:{" "}
                <span className="text-text-dim">
                  {linha.golpe ?? "nenhum ofensivo"}
                </span>
              </span>
            </div>

            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {linha.stats.map((v, i) => (
                <li
                  key={i}
                  className="flex flex-col items-center gap-0.5 rounded-pix border border-line py-1.5"
                >
                  <span className="pix text-[9px] tracking-[0.1em] text-text-mute">
                    {STAT_SHORT[i]}
                  </span>
                  <span className="num text-[14px] text-text">
                    {compact(v)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-[13px] leading-relaxed text-text-dim">
              É o que esse {linha.nome} teria no nível {level} com quality{" "}
              {num(quality, 2)}
              {carta ? ` e os IV do seu Eevee` : " e IV 21 nos seis"} — poder{" "}
              {compact(linha.poder)}.
            </p>

            {/* A ressalva fica AQUI, colada nos seis números, e não na
                documentação: é exatamente sobre estes números que a dúvida
                existe, e ressalva que mora noutra tela não alcança quem está
                lendo esta. O botão do jogo diz "Trocar", não "Evoluir", e a
                Pokepedia garante herança de nível e quality só pra evolução
                comum — o Eevee ela declara caso à parte sem dizer o que herda.
                Então isto compara espécie com espécie na mesma régua, que é uma
                afirmação verdadeira, em vez de prometer o que você vai receber,
                que seria palpite. */}
            <Note flush>
              Os seis números comparam as espécies na mesma régua — o mesmo nível, a mesma
              quality, os mesmos IV nos cinco ramos. Se a troca do Marlon devolve o bicho no
              nível em que ele entrou é coisa que o jogo não publica, e o botão dele diz
              &ldquo;Trocar&rdquo;, não &ldquo;Evoluir&rdquo;. Serve pra escolher entre os
              cinco; não é promessa do que vai chegar no seu time.
            </Note>
          </div>
        ) : (
          <Note tone="warn">
            {linha.nome} está na loja mas não está no catálogo de espécies,
            então não dá pra projetar nada. É o estado esperado enquanto o jogo
            não publica a espécie.
          </Note>
        )}
      </Panel>

      {/* `minmax(0,1fr)` na coluna base, e nao `grid` puro.
          Item de grade nasce com `min-width: auto`, entao a trilha CRESCE ate o
          min-content do conteudo em vez de espremer: num aparelho de 360px o
          painel das pedras media 374 e empurrava a PAGINA inteira 26px pra
          direita. Com o minimo zerado a trilha manda, e quem cede e o nome da
          criatura, que ja tem `truncate` pra isso. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <EeveePedra
          pedra={pedra.nome}
          icone={pedra.icone}
          fontes={pedra.fontes}
          nivel={level}
        />

        <Panel
          title={<span className="pix">Os cinco, lado a lado</span>}
          bodyClassName="flex flex-col gap-3"
          className="h-full"
        >
          <ul className="flex flex-col gap-1.5">
            {linhas.map((l) => {
              const on = l.i === escolhido;
              return (
                <li key={l.nome}>
                  <button
                    type="button"
                    onClick={() => setEstado((s) => ({ ...s, ramo: l.i }))}
                    aria-pressed={on}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-pix border px-2.5 py-2 text-left",
                      "transition-[border-color,background-color] duration-200",
                      on
                        ? "border-[var(--tint)] bg-[var(--tint)]/8"
                        : "border-line hover:border-[var(--tint)]/40 hover:bg-surface-2",
                    )}
                  >
                    <Sprite
                      src={spriteUrl(l.mon?.pokeId ?? TROCAS[l.i].pokeId)}
                      alt={l.nome}
                      size={36}
                      className="[--sprite:36px] shrink-0"
                    />

                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[13px] text-text">
                        {l.nome}
                      </span>
                      <span className="truncate text-[11px] text-text-mute">
                        {l.pedra}
                      </span>
                    </span>

                    <span className="num w-[64px] shrink-0 text-right text-[13px]">
                      <span
                        style={{
                          color:
                            l.abates === menosAbates
                              ? "var(--color-ok)"
                              : undefined,
                        }}
                      >
                        {Number.isFinite(l.abates)
                          ? compact(Math.ceil(l.abates))
                          : "—"}
                      </span>
                      <span className="block text-[10px] text-text-mute">
                        abates
                      </span>
                    </span>

                    <span className="w-[52px] shrink-0 text-right">
                      <span
                        className="pix text-[13px]"
                        style={{
                          color: l.tier ? TIER_COLOR[l.tier] : undefined,
                        }}
                      >
                        {l.tier ?? "—"}
                      </span>
                      <span className="num block text-[10px] text-text-mute">
                        {num(l.score, 1)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <Note flush>
            As duas colunas discordam de propósito, e é aí que está a escolha: a
            da esquerda é o caminho até as dez pedras no seu nível, a da direita
            é o que a espécie vale em combate. Quem lidera uma raramente lidera
            a outra.{" "}
            <Link
              href="/meta"
              className="underline decoration-dotted underline-offset-2"
            >
              A nota sai da tier list
            </Link>
            , que mede dano por segundo e resistência — não soma de stat.
          </Note>
        </Panel>
      </div>
    </div>
  );
}
