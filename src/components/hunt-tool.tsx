"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IV_MAX, powerOf } from "@/lib/stats";
import { lerIvs } from "@/lib/iv-reading";
import { pingDestaque } from "@/lib/destaque-cliente";
import { SIM_IV } from "@/lib/combat";
import {
  economyOf,
  movesResolver,
  perHourLabel,
  rankHunts,
  unpackSpecies,
  withEconomy,
  type HuntEntrada,
} from "@/lib/hunt";
import { TIER_COLOR, qualityTier } from "@/lib/rarity";
import { animatedSpriteUrl, spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
import { STAT_LABEL, STAT_SHORT, TIER_LABEL, TYPE_LABEL, compact } from "@/lib/labels";
import { TYPE_DAY_BONUS } from "@/lib/boost";
import type { HuntPayload } from "@/lib/hunt-data";
import {
  EMPTY_HUNT,
  HUNT_BALLS,
  QUALITY_MIN,
  buildHuntSearch,
  parseHuntState,
  type HuntState,
} from "@/lib/hunt-url";
import type { PokeType } from "@/lib/types";
import {
  Button,
  Chip,
  Combobox,
  Empty,
  Field,
  FieldRow,
  IconChevronRight,
  Loading,
  Note,
  NumberField,
  Panel,
  Segmented,
  Select,
  Sprite,
  Switch,
  Checkbox,
  Tabs,
  Tooltip,
  IconExemplo,
  IconLimpar,
  IconCoin,
  IconLista,
} from "@/components/ui";
import { TypeBadge, TypeIcon } from "@/components/type-icon";
import { RarityIcon } from "@/components/rarity-icon";
import {
  IconGem,
  IconLevel,
  IconLoot,
  IconRota,
  IconScale,
  IconTm,
  IconTarget,
  IconXp,
  STAT_ICONS,
} from "@/components/game-icons";
import { HuntGold } from "@/components/hunt-gold";
import { HuntRanking } from "@/components/hunt-ranking";
import { HuntRoute } from "@/components/hunt-route";
import { BallIcon } from "@/components/ball-icon";

/**
 * A Hunt.
 *
 * A pergunta e uma so — **onde eu cacço?** — e ela nao tem resposta sem o pokemon:
 * a melhor hunt do jogo depende de quem esta batendo. Por isso a tela abre com o
 * lutador e nao com uma lista ordenada por XP, que seria a mesma pra todo mundo (e
 * estaria errada pra quase todo mundo).
 *
 * A tela tem DOIS TEMPOS, e essa separacao e a decisao de forma que importa:
 *
 *   ENTRADA — o pokemon e o cenario. Mudar aqui nao mexe no resultado sozinho:
 *             muda o rascunho, e o botao passa a dizer RECALCULAR. Sao 342 alvos
 *             x dois lados de combate x cada nivel da rota; refazer isso a cada
 *             tecla digitada e a tela piscando enquanto se digita "1.8".
 *   RESULTADO — a rota primeiro (a pergunta que quase todo mundo tem: "ate onde
 *             eu subo e como"), e a tabela inteira em seguida, pra quem quer
 *             comparar numero a numero.
 *
 * O que separa isso do piwtools esta no motor (`combat.ts`): o rendimento aqui e
 * EFETIVO — se a hunt te derruba, o tempo parado na Joy ja saiu do XP/h. Hunt que
 * te mata nao ganha de hunt que rende.
 */

/** Exemplo real do catalogo (Electrode nv54, quality 1.8) — o mesmo da conferencia
 *  da formula em `stats.ts`. Existe porque tela que abre vazia nao ensina. */
const EXEMPLO = { id: 101, level: 54, quality: 1.8, stats: [113, 78, 73, 124, 95, 196] };

/** Piso do "calculando". O calculo em si leva dezenas de ms; sem o piso, a tela
 *  pisca um loader que ninguem chega a ler e o resultado parece nao ter mudado. */
const PISO_CALCULO_MS = 700;

const TIPOS: PokeType[] = [
  "NORMAL", "FIRE", "WATER", "ELECTRIC", "GRASS", "ICE", "FIGHTING", "POISON", "GROUND",
  "FLYING", "PSYCHIC", "BUG", "ROCK", "GHOST", "DRAGON", "DARK", "STEEL", "FAIRY",
];

/** O que precisa de um CALCULAR pra valer e a `HuntEntrada` do motor; o que fica
 *  de fora (filtro, ordem, nivel alvo) e barato e responde na hora. */
type Entrada = HuntEntrada;

const entradaDe = (s: HuntState): Entrada | null =>
  s.id == null
    ? null
    : { id: s.id, level: s.level, quality: s.quality, stats: s.stats, pool: s.pool, vip: s.vip,
        day: s.day, xpPct: s.xpPct, lootPct: s.lootPct, cap: s.cap, ball: s.ball };

const mesmaEntrada = (a: Entrada | null, b: Entrada | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function HuntTool({ payload }: { payload: HuntPayload }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [s, setS] = useState<HuntState>(() => parseHuntState(new URLSearchParams(sp.toString())));
  // O PEDIDO e o que foi mandado calcular; a APLICADA e o que ja foi calculado. Sao
  // dois estados e nao um porque entre os dois existe o tempo de espera — e e ele
  // que a tela precisa mostrar.
  const [pedido, setPedido] = useState<Entrada | null>(() => entradaDe(parseHuntState(new URLSearchParams(sp.toString()))));
  const [aplicada, setAplicada] = useState<Entrada | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(`${pathname}${buildHuntSearch(s)}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [s, router, pathname]);

  // O calculo em si e sincrono e leva dezenas de ms; o piso existe pra a espera ser
  // VISTA. O timer vive dentro do efeito (e nao num ref) porque em StrictMode o
  // efeito monta, desmonta e monta de novo: um ref guardando "ja calculei" ficaria
  // preso no meio dessa dança e a tela nunca sairia do carregando.
  useEffect(() => {
    if (!pedido) return;
    const t = setTimeout(() => setAplicada(pedido), PISO_CALCULO_MS);
    return () => clearTimeout(t);
  }, [pedido]);

  const patch = useCallback((p: Partial<HuntState>) => setS((old) => ({ ...old, ...p })), []);

  const rascunho = entradaDe(s);
  const desatualizado = aplicada != null && !mesmaEntrada(aplicada, rascunho);
  const calculando = pedido != null && !mesmaEntrada(pedido, aplicada);

  /** Manda calcular. Objeto novo a cada chamada: pedir de novo o MESMO cenario
   *  ainda assim refaz a conta (e mostra a espera), em vez de nao fazer nada. */
  const calcular = useCallback((entrada: Entrada | null) => {
    if (!entrada) return;
    setPedido({ ...entrada });
  }, []);

  // ---- o lutador, sempre a partir do que foi APLICADO (nao do rascunho) ----
  const packed = useMemo(
    () => (aplicada ? payload.species.find((e) => e.id === aplicada.id) ?? null : null),
    [payload.species, aplicada],
  );
  const fighter = useMemo(() => (packed ? unpackSpecies(packed) : null), [packed]);
  const movesOf = useMemo(() => movesResolver(payload.species), [payload.species]);

  const temStats = s.stats.some((v) => v > 0);

  /** O IV do lutador, pela MESMA leitura da calculadora e do breeding — tres telas
   *  nao podem discordar sobre o mesmo pokemon. Sem stats, cai no IV medio do jogo
   *  (21 de 32), e a tela DIZ isso em vez de fingir que sabe. */
  const leituraRascunho = useMemo(() => {
    const esp = s.id != null ? payload.species.find((e) => e.id === s.id) : null;
    if (!esp || !temStats) return null;
    return lerIvs(esp.bases, s.stats, s.level, s.quality);
  }, [payload.species, s.id, s.stats, s.level, s.quality, temStats]);

  const leitura = useMemo(() => {
    if (!packed || !aplicada || !aplicada.stats.some((v) => v > 0)) return null;
    return lerIvs(packed.bases, aplicada.stats, aplicada.level, aplicada.quality);
  }, [packed, aplicada]);

  const ivs = useMemo(
    () =>
      leitura && !leitura.impossivel
        ? leitura.ivs.map((v) => Math.min(IV_MAX, Math.max(0, v)))
        : Array<number>(6).fill(SIM_IV),
    [leitura],
  );

  const tint = packed ? TYPE_COLOR[packed.t1] : "var(--color-t-hunt)";
  /* A faixa do INDIVIDUO, lida da quality aplicada — nao a raridade da especie.
     Sao duas grandezas com os mesmos seis nomes; ver o aviso em `lib/rarity.ts`. */
  const tierQ = qualityTier(aplicada?.quality ?? 1);
  const diaPct = Math.round(TYPE_DAY_BONUS * 100);

  /* ================= a conta, UMA vez ==================================

     A economia (Tipo do Dia, VIP, bonus digitados, bola) e o ranking dos 342
     alvos moravam DENTRO de cada aba, com os mesmos argumentos e o mesmo
     resultado. Tres copias da mesma conta: a de ouro e a de "todas as hunts"
     rodavam `economyOf` + `rankHunts` identicos e so discordavam no filtro e na
     ordem depois; a rota rodava o `withEconomy` por conta propria.

     Subiram pra ca por dois motivos, e o segundo importa mais que o primeiro.
     Um: o custo, que era pago duas vezes a cada troca de aba. Dois: o cabecalho
     abaixo AFIRMA qual e o melhor XP/h e o melhor ouro/h do pokemon, e essa
     afirmacao tem que sair do mesmo array que a tabela mostra. Numero de resumo
     calculado por fora e uma segunda fonte de verdade — e ja se viu nesta base
     como isso termina (a home apontando um pokemon e a tier list apontando
     outro). */
  const econ = useMemo(
    () =>
      aplicada
        ? economyOf(payload.targets, {
            day: aplicada.day,
            drops: payload.drops,
            ballKey: aplicada.ball,
            vip: aplicada.vip,
            xpPct: aplicada.xpPct,
            lootPct: aplicada.lootPct,
          })
        : null,
    [payload.targets, payload.drops, aplicada],
  );

  /** Os alvos com o ouro do dia ja embutido — o que o motor consome. */
  const alvos = useMemo(
    () => (econ ? withEconomy(payload.targets, econ) : []),
    [payload.targets, econ],
  );

  const rows = useMemo(
    () =>
      fighter && aplicada && econ
        ? rankHunts(fighter, {
            targets: alvos,
            econ,
            movesOf,
            level: aplicada.level,
            ivs,
            quality: aplicada.quality,
            pool: aplicada.pool,
          })
        : [],
    [fighter, aplicada, econ, alvos, movesOf, ivs],
  );

  /**
   * O RESUMO do cabecalho.
   *
   * Letal fica de fora dos tres numeros, e nao por delicadeza: rendimento de
   * hunt que te derruba antes de dois abates ja e zero na pratica, e coroar ela
   * no lugar mais visivel da tela seria mandar o jogador pro matadouro com o
   * numero grande dando razao. E o mesmo criterio que a aba de ouro e a rota
   * aplicam — tres telas nao podem discordar sobre o que conta como hunt.
   */
  const resumo = useMemo(() => {
    if (rows.length === 0) return null;
    const seguras = rows.filter((r) => r.est.threat.risk !== "deadly");
    if (seguras.length === 0) return { seguras: 0, total: rows.length, xpH: 0, goldH: 0 };
    return {
      seguras: seguras.length,
      total: rows.length,
      xpH: Math.max(...seguras.map((r) => r.est.xpH)),
      goldH: Math.max(...seguras.map((r) => r.est.goldH)),
    };
  }, [rows]);

  const preencherExemplo = () => {
    const alvo = payload.species.find((e) => e.id === EXEMPLO.id) ?? payload.species[0];
    if (!alvo) return;
    const nova = {
      ...s,
      id: alvo.id,
      level: EXEMPLO.level,
      quality: EXEMPLO.quality,
      stats: alvo.id === EXEMPLO.id ? [...EXEMPLO.stats] : [0, 0, 0, 0, 0, 0],
      page: 0,
    };
    setS(nova);
    calcular(entradaDe(nova));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ============================ entrada ============================ */}
      <Panel
        title={<span className="flex items-center gap-2"><IconScale size={16} />O seu pokémon</span>}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={preencherExemplo} iconLeft={<IconExemplo size={15} />}>
              preencher exemplo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setS({ ...EMPTY_HUNT, view: s.view }); setPedido(null); setAplicada(null); }}
              disabled={s.id == null && !temStats}
              iconLeft={<IconLimpar size={15} />}
            >
              limpar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FieldRow>
            <Field label="Espécie" className="min-w-[16rem] flex-1">
              <Combobox
                value={s.id}
                onChange={(id) => {
                  patch({ id, page: 0 });
                  pingDestaque(id);
                }}
                options={payload.species.map((e) => ({
                  value: e.id,
                  label: e.name,
                  keywords: String(e.id),
                  render: (
                    <span className="flex items-center gap-2">
                      <Sprite src={spriteUrl(e.id)} alt={e.name} size={26} />
                      {e.name}
                    </span>
                  ),
                }))}
                placeholder="nome do pokémon..."
                emptyText="nenhuma espécie com esse nome"
              />
            </Field>

            <Field label="Nível" icon={<IconLevel size={14} />} className="w-28">
              <NumberField
                min={1}
                fallback={1}
                value={s.level}
                onChange={(level) => patch({ level, page: 0 })}
                className="text-center text-[15px]"
              />
            </Field>

            {/* quality 0 zera o `pow(q, 0.95)` de todo stat e o motor inteiro colapsa
                em silencio (dano 0 -> kos/h 0 -> xp/h 0 pra todo alvo), entao o piso
                e do campo, nao da conta. O mesmo piso vale no parse da URL. */}
            <Field label="Quality" icon={<IconGem size={14} />} className="w-32">
              <NumberField
                min={QUALITY_MIN}
                step={0.01}
                fallback={1}
                value={s.quality}
                onChange={(quality) => patch({ quality, page: 0 })}
                className="text-center text-[15px]"
              />
            </Field>
          </FieldRow>

          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="pix text-[11px] text-text-mute">Stats atuais, como o jogo mostra</span>
              <span className="text-[13px] text-text-mute">
                {temStats ? (
                  leituraRascunho?.impossivel ? (
                    <span className="text-warn">
                      nenhum IV entre 0 e {IV_MAX} explica esses stats — confira nível e quality
                    </span>
                  ) : leituraRascunho ? (
                    <>
                      IV total <span className="text-neon tabular">{Math.round(leituraRascunho.somaIv)}</span> ·
                      poder <span className="text-accent tabular">{compact(powerOf(s.stats, s.quality))}</span>
                    </>
                  ) : null
                ) : (
                  <>opcional — em branco, a simulação usa IV {SIM_IV} nos seis</>
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {STAT_LABEL.map((label, i) => {
                const Icon = STAT_ICONS[i];
                return (
                  <Field key={label} label={STAT_SHORT[i]} icon={<Icon size={14} />}>
                    <NumberField
                      min={0}
                      fallback={0}
                      aria-label={label}
                      value={s.stats[i]}
                      onChange={(v) => patch({ stats: s.stats.map((x, j) => (j === i ? v : x)), page: 0 })}
                      className="text-center text-[15px]"
                    />
                  </Field>
                );
              })}
            </div>
          </div>

          {/* ---- o cenario ----
              Os interruptores que mudam a RESPOSTA sem mudar o pokemon. Todos na
              mesma fila e na mesma altura: sao `Field`, e todo controle veste a
              casca de 2.5rem (ver `ui/field.tsx`). */}
          <div className="border-t border-line pt-4">
            <FieldRow>
              <Field label="Golpes considerados" icon={<IconTm size={14} />}>
                <Segmented
                  value={s.pool}
                  onChange={(pool) => patch({ pool, page: 0 })}
                  options={[
                    { value: "natural", label: "só naturais", title: "O que a espécie aprende sozinha — o que todo jogador tem" },
                    { value: "tm", label: "com TM", title: "Inclui golpes de máquina; todo golpe de poder 600 do jogo é TM" },
                  ]}
                />
              </Field>

              <Field label="Tipo do dia" className="w-[13rem]">
                <Select
                  value={s.day}
                  onChange={(day) => patch({ day: day as PokeType | "", page: 0 })}
                  options={[
                    { value: "", label: "nenhum" },
                    ...TIPOS.map((t) => ({
                      value: t,
                      label: TYPE_LABEL[t],
                      render: (
                        <span className="flex items-center gap-2">
                          <TypeIcon type={t} size={14} />
                          {TYPE_LABEL[t]}
                        </span>
                      ),
                    })),
                  ]}
                />
              </Field>

              <Field>
                <Switch
                  checked={s.vip}
                  onChange={(e) => patch({ vip: e.currentTarget.checked, page: 0 })}
                  label="VIP (+50% de XP)"
                />
              </Field>

              {/* O que a ferramenta nao tem como saber: evento de servidor, boost da
                  loja, trilha de streak. Sem campo, o XP/h saia curto e ninguem
                  descobria por que — numa sessao medida, 0,66x do real. */}
              <Field label="XP extra (%)" icon={<IconXp size={14} />} className="w-32">
                <NumberField
                  min={0}
                  fallback={0}
                  value={s.xpPct}
                  onChange={(xpPct) => patch({ xpPct, page: 0 })}
                  className="text-center text-[15px]"
                />
              </Field>

              <Field label="Loot extra (%)" icon={<IconLoot size={14} />} className="w-32">
                <NumberField
                  min={0}
                  fallback={0}
                  value={s.lootPct}
                  onChange={(lootPct) => patch({ lootPct, page: 0 })}
                  className="text-center text-[15px]"
                />
              </Field>

              <Field>
                <Checkbox
                  boxed
                  checked={s.cap}
                  onChange={(e) => patch({ cap: e.currentTarget.checked, page: 0 })}
                  label="estimar a captura"
                />
              </Field>

              {s.cap ? (
                <Field label="Bola usada" className="w-[15rem]">
                  <Select
                    value={s.ball}
                    onChange={(ball) => patch({ ball, page: 0 })}
                    options={HUNT_BALLS.map((b) => ({
                      value: b.key,
                      label: b.name,
                      // preco e multiplicador vao na dica: no gatilho fica so o
                      // icone e o nome, que e o que se reconhece de relance
                      hint: `x${b.catchRate} · ${b.priceGold} de ouro`,
                      render: (
                        <span className="flex items-center gap-2">
                          <BallIcon ball={b} />
                          {b.name}
                        </span>
                      ),
                    }))}
                  />
                </Field>
              ) : null}
            </FieldRow>

            {s.day ? (
              <Note className="mt-3">
                O bônus do dia multiplica a chance de cada drop, e a chance tem teto: alvo cujo
                loot já sai em 95% aproveita quase nada dos {diaPct}%. A conta é refeita drop a
                drop, não somada no total.
              </Note>
            ) : null}
            {s.xpPct > 0 || s.lootPct > 0 ? (
              <Note className="mt-3">
                As fontes de bônus somam entre si e o total multiplica, como o jogo mostra no
                detalhamento de ganho. Um evento de XP dobrado é 100 aqui, e com VIP e o tipo
                do dia o XP por abate sai 2,7 vezes o do catálogo.
              </Note>
            ) : null}
            {s.cap ? (
              <Note className="mt-3">
                A captura entra como coluna ao lado, e não no ouro por hora: a lei que estima
                ela erra por ~1,9x na mediana, e numa sessão medida de 738 abates errou por
                5,7. Junto dela vai o ponto em que a bola se paga, que sai só do preço da bola
                e do valor de venda e você confere numa hunt.
              </Note>
            ) : null}
          </div>

          {/* ---- o botao ----
              Ele e o meio da tela: a conta e cara e o resultado tem hora pra
              chegar. Enquanto o rascunho e igual ao aplicado, ele fica quieto
              (desabilitado); mudou alguma coisa, ele vira RECALCULAR aceso. */}
          <div className="border-t border-line pt-4">
            <Button
              size="lg"
              variant="primary"
              className="w-full justify-center"
              disabled={!rascunho || calculando || (aplicada != null && !desatualizado)}
              onClick={() => calcular(rascunho)}
              iconLeft={<IconTarget size={16} />}
            >
              {calculando
                ? "calculando..."
                : aplicada == null
                  ? "calcular a rota e as hunts"
                  : desatualizado
                    ? "recalcular"
                    : "calculado"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* ============================ resultado ============================ */}
      {calculando ? (
        <Panel bodyClassName="p-0">
          <Loading size="inline" label="Simulando os combates de todas as hunts" />
        </Panel>
      ) : !packed || !fighter || !aplicada ? (
        <Panel>
          <Empty
            title="Escolha o seu pokémon e mande calcular"
            hint="A melhor caçada depende de quem está batendo, então a conta só começa depois que você escolher o pokémon."
            action={
              <Button variant="primary" onClick={preencherExemplo} iconLeft={<IconExemplo size={16} />}>
                preencher exemplo
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          {/* ==================== o lutador ====================

              Era uma FAIXA fina: sprite de 52px, nome em 19 e dois selos de
              tipo, tudo numa linha de 60px de altura. Ela dizia o necessario e
              nada mais — e o problema nao era o que faltava, era o REGISTRO. A
              tela ao lado (a calculadora) responde a mesma pergunta sobre o
              mesmo pokemon e abre com arte grande, epiteto na cor da faixa,
              discos de tipo e tres manchetes. Duas telas irmas com o mesmo
              assunto e dois vocabularios diferentes leem como dois sites.

              Entao o cabecalho passa a ser o mesmo bloco: halo, arte, epiteto,
              nome, manchetes. O que muda e o CONTEUDO das manchetes, porque a
              pergunta e outra — la e "quanto vale este pokemon", aqui e "quanto
              ele rende e onde". Os tres numeros sao o resumo do que as abas
              abrem, e saem do mesmo `rows` que elas usam. */}
          <section className="panel relative flex flex-col">
            <header className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-7">
              <div className="relative grid shrink-0 place-items-center self-center">
                {/* O halo sai da QUALITY, e nao da raridade da especie — mesma
                    razao da calculadora: esta tela e de individuo, e quem manda
                    aqui e o numero que a pessoa digitou. Ver `lib/rarity.ts`. */}
                <span
                  aria-hidden="true"
                  className="anim-glow absolute h-36 w-36 rounded-full blur-3xl"
                  style={{ backgroundColor: TIER_COLOR[tierQ] }}
                />
                {/* Sem `animatedSrc`: o gif do gen5 tem 96px e entra por cima do
                    render oficial assim que carrega, entao num corpo de 132 ele
                    troca a arte boa por pixel esticado. A faixa antiga podia usar
                    ele porque mostrava 52px. */}
                <Sprite
                  src={spriteUrl(packed.id)}
                  alt={packed.name}
                  size={132}
                  priority
                  className="anim-float relative"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <span
                  className="pix flex flex-wrap items-center gap-x-2 text-[10px] tracking-[0.18em]"
                  style={{ color: TIER_COLOR[tierQ] }}
                >
                  <RarityIcon rarity={tierQ} size={15} />
                  {TIER_LABEL[tierQ]} · quality {aplicada.quality} ·
                  <Tooltip
                    content={
                      leitura && !leitura.impossivel
                        ? "IV lido dos stats que você digitou — a mesma leitura da calculadora."
                        : `Sem os stats, a simulação usa IV ${SIM_IV} nos seis (a média do jogo).`
                    }
                  >
                    <span className={cn(leitura && !leitura.impossivel ? "text-neon" : "text-text-mute")}>
                      IV {leitura && !leitura.impossivel ? Math.round(leitura.somaIv) : `${SIM_IV * 6} MÉDIO`}
                    </span>
                  </Tooltip>
                </span>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {/* Os discos de tipo, grandes o bastante pro glifo passar do
                      piso de 14px — o mesmo arranjo da ficha e da calculadora. */}
                  <span aria-hidden="true" className="flex shrink-0 items-center">
                    {[packed.t1, packed.t2].filter(Boolean).map((t, i) => (
                      <span
                        key={t as string}
                        title={TYPE_LABEL[t!]}
                        className={cn(
                          "grid place-items-center rounded-pill border-2 bg-surface shadow-elev-2",
                          i === 0 ? "z-10 h-9 w-9" : "-ml-2 h-8 w-8",
                        )}
                        style={{ borderColor: TYPE_COLOR[t!], color: TYPE_COLOR[t!] }}
                      >
                        <TypeIcon type={t!} size={i === 0 ? 18 : 16} />
                      </span>
                    ))}
                  </span>
                  <span className="sr-only">
                    {[packed.t1, packed.t2].filter(Boolean).map((t) => TYPE_LABEL[t!]).join(" e ")}
                  </span>

                  <h2 className="pix text-[24px] leading-none tracking-[0.08em] text-text">
                    {packed.name}
                  </h2>
                  <span className="pix text-[13px]" style={{ color: tint }}>
                    nível {aplicada.level}
                  </span>

                  {/* Os selos do CENARIO. Eles nao descrevem o pokemon, descrevem
                      a conta que esta na tela — e por isso continuam aqui em cima:
                      quem esquece que deixou o VIP ligado le os numeros de baixo
                      como se fossem os do jogo dele. */}
                  {aplicada.vip ? <Chip size="xs" tone="neon">VIP</Chip> : null}
                  {aplicada.pool === "tm" ? <Chip size="xs" tone="accent">com TM</Chip> : null}
                  {aplicada.day ? (
                    <Chip size="xs" tint={TYPE_COLOR[aplicada.day]} icon={<TypeIcon type={aplicada.day} size={12} />}>
                      dia de {TYPE_LABEL[aplicada.day]}
                    </Chip>
                  ) : null}

                  <Link
                    href={`/dex/${packed.id}`}
                    className="pix ml-auto flex items-center gap-1 text-[11px] text-text-mute transition-colors hover:text-accent"
                  >
                    ver na dex
                    <IconChevronRight size={14} />
                  </Link>
                </div>

                {/* As tres manchetes: o teto do que ele rende, e quantos alvos ele
                    aguenta. O denominador vai junto de proposito — "300 hunts
                    seguras" sem o "de 342" e um numero que nao se compara com
                    nada. */}
                <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-pix border border-line bg-line">
                  {[
                    {
                      label: "melhor XP/h",
                      value: resumo && resumo.xpH > 0 ? perHourLabel(resumo.xpH) : "—",
                      tone: "text-ok",
                      grande: true,
                    },
                    {
                      label: "melhor ouro/h",
                      value: resumo && resumo.goldH > 0 ? perHourLabel(resumo.goldH) : "—",
                      tone: "text-warn",
                    },
                    {
                      label: resumo ? `de ${resumo.total} hunts, seguras` : "hunts seguras",
                      value: resumo ? resumo.seguras : "—",
                      tone: resumo && resumo.seguras === 0 ? "text-danger" : "text-text",
                    },
                  ].map((k) => (
                    <div key={k.label} className="bg-surface px-3 py-2.5">
                      <dd
                        className={cn(
                          "leading-none font-bold tabular",
                          k.grande ? "text-[26px]" : "text-[22px]",
                          k.tone,
                        )}
                      >
                        {k.value}
                      </dd>
                      <dt className="pix mt-1.5 text-[11px] text-text-mute">{k.label}</dt>
                    </div>
                  ))}
                </dl>
              </div>
            </header>
          </section>

          {/* A ROTA vem primeiro: "ate onde eu subo e como" e a pergunta de quem
              abre a tela. Depois vem OURO, que e a outra pergunta inteira: ela nao
              tem nivel alvo nem linha de chegada, e por isso nao cabia como modo da
              rota (ver o cabecalho de `hunt-gold.tsx`). A tabela inteira fica por
              ultimo, pra quem quer comparar alvo a alvo. */}
          <Tabs
            value={s.view}
            onChange={(view) => patch({ view, page: 0 })}
            items={[
              {
                value: "rota",
                label: "Rota de treino",
                icon: <IconRota size={14} />,
              },
              {
                value: "ouro",
                label: "Farmar ouro",
                icon: <IconCoin size={14} />,
              },
              {
                value: "ranking",
                label: "Todas as hunts",
                icon: <IconLista size={14} />,
              },
            ]}
          />

          {s.view === "rota" ? (
            <HuntRoute
              state={s}
              patch={patch}
              fighter={fighter}
              ivs={ivs}
              entrada={aplicada}
              payload={payload}
              movesOf={movesOf}
              alvos={alvos}
              tint={tint}
            />
          ) : s.view === "ouro" ? (
            <HuntGold
              state={s}
              patch={patch}
              fighter={fighter}
              ivs={ivs}
              entrada={aplicada}
              payload={payload}
              movesOf={movesOf}
              rows={rows}
              tint={tint}
            />
          ) : (
            <HuntRanking
              state={s}
              patch={patch}
              fighter={fighter}
              ivs={ivs}
              entrada={aplicada}
              payload={payload}
              movesOf={movesOf}
              rows={rows}
              tint={tint}
            />
          )}
        </>
      )}
    </div>
  );
}
