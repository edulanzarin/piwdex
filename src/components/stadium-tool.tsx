"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { unpackMon, type PackedMon } from "@/lib/meta-data";
import type { PackedBoss } from "@/lib/stadium-data";
import type { MetaMon } from "@/lib/meta";
import { pingDestaque } from "@/lib/destaque-cliente";
import { IV_MAX } from "@/lib/stats";
import { DEFAULT_IV } from "@/lib/meta";
import { apagarCarta, cartaCompleta, lerBolsa, salvarCarta, type Carta } from "@/lib/bolsa";
import { apagarDeck, lerDecks, salvarDeck, type Deck } from "@/lib/decks";
import {
  fichaDe,
  melhorDoTime,
  simularArena,
  statsEstimados,
  type ArenaAlvo,
  type ArenaMon,
  type FichaMembro,
} from "@/lib/stadium";
import {
  EMPTY_STADIUM,
  buildStadiumSearch,
  parseStadiumState,
  slotVazio,
  type SlotState,
  type StadiumState,
} from "@/lib/stadium-url";
import { StadiumAlvo } from "@/components/stadium-alvo";
import { StadiumTime } from "@/components/stadium-time";
import { StadiumCombate } from "@/components/stadium-combate";
import { StadiumCarta } from "@/components/stadium-carta";
import { BarraDeck, StadiumBolsa } from "@/components/stadium-bolsa";
import { Empty, Field, FieldRow, Note, Panel, Segmented } from "@/components/ui";
import { IconGem, IconTm } from "@/components/game-icons";

const TINT = "var(--color-t-stadium)";

/**
 * O Stadium: o time de seis contra um boss.
 *
 * ## O que ele responde, e por que não é o Duelo com mais gente
 *
 * O Duelo do `/meta` pergunta "este ganha daquele?". Aqui a pergunta é "o meu
 * TIME derruba este boss?", e ela tem uma mecânica que nenhuma soma de duelos
 * alcança: o HP do boss atravessa a troca de lutador. Um time de seis medianos
 * derruba o que nenhum dos seis derruba sozinho. O motor está em
 * `lib/stadium.ts`.
 *
 * ## Os dois lados não têm a mesma certeza, e a tela não finge que têm
 *
 * O TIME entra com os stats de verdade, copiados da tela do jogo pra uma carta
 * na bolsa. O motor usa aqueles seis números e não supõe IV nenhum — IV é
 * justamente o que o jogo esconde.
 *
 * O ALVO não tem essa sorte: o jogo não publica stat de boss. Ali os stats são
 * PROJETADOS de nível, quality e um IV escolhido no controle lá em cima, e isso
 * está dito na tela. Um lado medido e o outro estimado é a melhor conta
 * disponível; fingir que os dois são iguais é que seria o defeito.
 *
 * ## Onde o estado mora
 *
 * O alvo e o time vão pra URL com os NÚMEROS dentro, porque time montado é uma
 * proposta e proposta se manda pro grupo — id de `localStorage` não quer dizer
 * nada no navegador do outro. A bolsa e os decks ficam no `localStorage`: o site
 * não tem login, e coleção pessoal não viaja em link.
 */
export function StadiumTool({
  mons: packed,
  bosses,
  bossesGeradoEm,
}: {
  mons: PackedMon[];
  bosses: PackedBoss[];
  bossesGeradoEm: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [s, setS] = useState<StadiumState>(() => parseStadiumState(new URLSearchParams(sp.toString())));

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(`${pathname}${buildStadiumSearch(s)}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [s, router, pathname]);

  const patch = useCallback((p: Partial<StadiumState>) => setS((old) => ({ ...old, ...p })), []);

  const mons = useMemo<MetaMon[]>(() => packed.map(unpackMon), [packed]);
  const byId = useMemo(() => new Map(mons.map((m) => [m.pokeId, m])), [mons]);

  // ---- bolsa e decks ----
  //
  // Lidos só depois da hidratação: `localStorage` não existe no servidor, e ler
  // no primeiro render faria o HTML do servidor divergir do cliente.
  const [cartas, setCartas] = useState<Carta[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  useEffect(() => {
    setCartas(lerBolsa());
    setDecks(lerDecks());
  }, []);

  const [bolsaAberta, setBolsaAberta] = useState(false);
  const [slotAlvo, setSlotAlvo] = useState<number | null>(null);
  const [editando, setEditando] = useState<Carta | null>(null);
  const [cartaAberta, setCartaAberta] = useState(false);
  const [nomeDeck, setNomeDeck] = useState(s.deck);

  /**
   * Abrir o editor FECHA a bolsa.
   *
   * As duas são modal, e deixar a de baixo aberta empilha dois véus: o fundo
   * escurece duas vezes e a tela fica mais preta do que qualquer uma das duas
   * pediu. Pior que o visual é o teclado — com dois diálogos montados, quem
   * responde ao Escape passa a depender de ordem de montagem, e o Escape deixa
   * de ter resposta previsível.
   *
   * `slotAlvo` NÃO se perde: ele é a pergunta ("pro slot 3"), e a carta nova cai
   * direto lá quando for salva.
   */
  const abrirEditor = (c: Carta | null) => {
    setEditando(c);
    setCartaAberta(true);
    setBolsaAberta(false);
  };

  const porCartaId = useMemo(() => new Map(cartas.map((c) => [c.id, c])), [cartas]);

  /** A carta vira slot: os seis números dela, mais a origem. */
  const slotDaCarta = (c: Carta): SlotState => ({
    id: c.pokeId,
    level: c.level ?? 100,
    quality: c.quality,
    stats: c.stats ? [...c.stats] : [0, 0, 0, 0, 0, 0],
    carta: c.id,
  });

  const porNoSlot = useCallback((c: Carta, slot: number | null) => {
    setS((old) => {
      const time = old.time.slice();
      // Sem slot pedido (bolsa aberta pelo armário), cai no primeiro vazio. Time
      // cheio substitui o último: é o que menos entrou em combate, e portanto o
      // menos custoso de perder.
      const vazio = time.findIndex((x) => x.id == null);
      const i = slot ?? (vazio >= 0 ? vazio : time.length - 1);
      time[i] = {
        id: c.pokeId,
        level: c.level ?? 100,
        quality: c.quality,
        stats: c.stats ? [...c.stats] : [0, 0, 0, 0, 0, 0],
        carta: c.id,
      };
      return { ...old, time };
    });
    pingDestaque(c.pokeId);
    setBolsaAberta(false);
    setSlotAlvo(null);
  }, []);

  const guardarCarta = (c: Carta) => {
    setCartas(salvarCarta(c));
    // Editar a carta atualiza TODO slot que veio dela, e é o ponto inteiro da
    // referência: corrigir o nível do Charizard numa carta arruma os decks em
    // que ele está, em vez de deixar cada cópia envelhecer sozinha.
    setS((old) => ({
      ...old,
      time: old.time.map((x) => (x.carta === c.id ? slotDaCarta(c) : x)),
    }));
  };

  const apagar = (id: string) => {
    setCartas(apagarCarta(id));
    // O slot que vinha dela perde a ORIGEM e guarda os números: apagar a carta
    // da coleção não é tirar o pokémon do time que está montado agora.
    setS((old) => ({
      ...old,
      time: old.time.map((x) => (x.carta === id ? { ...x, carta: null } : x)),
    }));
  };

  const carregarDeck = (id: string) => {
    const d = decks.find((x) => x.id === id);
    if (!d) return;
    const time = d.cartas.map((cid) => {
      const c = cid ? porCartaId.get(cid) : null;
      // Carta apagada devolve o slot VAZIO em vez de sumir da fila: um time de
      // seis virando de cinco em silêncio é pior do que o buraco à vista.
      return c && cartaCompleta(c) ? slotDaCarta(c) : slotVazio();
    });
    patch({ time, deck: d.nome });
    setNomeDeck(d.nome);
  };

  const guardarDeck = () => {
    const { decks: proximos, deck } = salvarDeck(nomeDeck, s.time.map((x) => x.carta));
    setDecks(proximos);
    if (deck) patch({ deck: deck.nome });
  };

  const novoDeck = () => {
    patch({ time: EMPTY_STADIUM.time.map(() => slotVazio()), deck: "" });
    setNomeDeck("");
  };

  // ---- o combate ----

  const iv = s.iv === "perfeito" ? IV_MAX : DEFAULT_IV;
  const ivs = useMemo(() => Array<number>(6).fill(iv), [iv]);

  const alvoMon = s.alvo != null ? byId.get(s.alvo) ?? null : null;
  const bossAtual = s.boss ? bosses.find((b) => b.key === s.boss) ?? null : null;

  const alvo = useMemo<ArenaAlvo | null>(
    () =>
      alvoMon
        ? {
            mon: alvoMon,
            level: s.alvoLv,
            // O único lado projetado da tela. Ver o cabeçalho.
            stats: statsEstimados(alvoMon, s.alvoLv, s.alvoQ, ivs),
            reforco: s.reforco,
          }
        : null,
    [alvoMon, s.alvoLv, s.alvoQ, s.reforco, ivs],
  );

  /** O time como o motor entende, junto com o slot de origem de cada um. */
  const escalados = useMemo(
    () =>
      s.time
        .map((slot, i) => {
          const mon = slot.id != null ? byId.get(slot.id) : null;
          // Slot sem stats não entra: ele não tem número pra pôr no ringue, e
          // completar com estimativa seria o defeito que esta versão corrigiu.
          if (!mon || slot.stats.some((v) => v <= 0)) return null;
          return { i, membro: { mon, level: slot.level, stats: slot.stats } as ArenaMon };
        })
        .filter((x): x is { i: number; membro: ArenaMon } => x != null),
    [s.time, byId],
  );

  const fichas = useMemo(() => {
    const m = new Map<number, FichaMembro>();
    if (!alvo) return m;
    for (const e of escalados) m.set(e.i, fichaDe(e.membro, e.i, alvo, s.pool));
    return m;
  }, [escalados, alvo, s.pool]);

  const resultado = useMemo(() => {
    if (!alvo || !escalados.length) return null;
    const bruto = simularArena(escalados.map((e) => e.membro), alvo, s.pool);
    // O motor numera pela ordem em que RECEBEU o time, e ele recebe só os slots
    // preenchidos. Devolver esse número pra tela faria a fila chamar de "#2" o
    // pokémon que a carta dele chama de "#4" — o mesmo bicho com dois números na
    // mesma página, e o de baixo sempre errado quando há buraco no meio.
    return {
      ...bruto,
      passagens: bruto.passagens.map((p) => ({ ...p, slot: escalados[p.slot].i })),
      carregou: bruto.carregou != null ? escalados[bruto.carregou].i : null,
    };
  }, [escalados, alvo, s.pool]);

  const melhor = useMemo(() => melhorDoTime([...fichas.values()]), [fichas]);

  /**
   * Como o alvo se chama na tela.
   *
   * O nome do boss só vale enquanto a espécie no campo AINDA é a dele. Quem
   * escolhe "Mega Alakazam" e depois troca a espécie está medindo outra coisa, e
   * seguir chamando aquilo de Mega Alakazam faria a manchete do combate afirmar
   * um boss que a conta não usou. Boss sem espécie é o caso contrário: ali a
   * espécie é uma base escolhida à mão, e o nome do boss continua sendo o certo.
   */
  const alvoNome =
    bossAtual && (bossAtual.mon == null || bossAtual.mon === s.alvo)
      ? bossAtual.name
      : alvoMon?.name ?? "o alvo";

  return (
    <div className="flex flex-col gap-4" style={{ "--tint": TINT } as CSSProperties}>
      <Panel bodyClassName="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <FieldRow>
          <Field label="Golpes considerados" icon={<IconTm size={14} />}>
            <Segmented
              value={s.pool}
              onChange={(pool) => patch({ pool })}
              options={[
                { value: "natural", label: "só naturais", title: "O que a espécie aprende sozinha, sem comprar máquina" },
                { value: "tm", label: "com TM", title: "Inclui golpes de máquina; todo golpe de poder 600 do jogo é TM" },
              ]}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="IV suposto do alvo" icon={<IconGem size={14} />}>
            <Segmented
              value={s.iv}
              onChange={(v) => patch({ iv: v as StadiumState["iv"] })}
              options={[
                { value: "medio", label: `médio (${DEFAULT_IV})`, title: "A média do jogo" },
                { value: "perfeito", label: `perfeito (${IV_MAX})`, title: "O teto do jogo" },
              ]}
            />
          </Field>
        </FieldRow>
        <Note flush className="max-w-[46rem]">
          {s.pool === "tm"
            ? "Com TM o combate usa golpes que o seu pokémon só tem depois de comprar a máquina. A diferença chega a dez vezes de dano por segundo, então ligue isto só pro que você tem de verdade."
            : "Só naturais é o que todo pokémon aprende sozinho. É a leitura certa pra saber se dá pra encarar o boss com o time como ele está hoje."}
        </Note>
        <Note flush className="max-w-[46rem]">
          O seu time entra com os stats que você copiou do jogo. O alvo não: o jogo não
          publica stat de boss, então os seis números dele saem de nível, quality e este IV.
        </Note>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
        <StadiumAlvo mons={mons} bosses={bosses} state={s} patch={patch} />

        <Panel
          title={
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="pix">O time</span>
              {s.deck ? <span className="pix text-[10px] text-text-mute">{s.deck}</span> : null}
            </span>
          }
          actions={
            <span className="pix text-[10px] text-text-mute">
              {escalados.length}/{s.time.length}
            </span>
          }
          bodyClassName="flex flex-col gap-3"
        >
          <StadiumTime
            mons={mons}
            cartas={cartas}
            state={s}
            fichas={fichas}
            temAlvo={alvo != null}
            onAbrirBolsa={(slot) => {
              setSlotAlvo(slot);
              setBolsaAberta(true);
            }}
            onEditarCarta={abrirEditor}
            onTirar={(i) =>
              setS((old) => {
                const time = old.time.slice();
                time[i] = slotVazio();
                return { ...old, time };
              })
            }
          />

          <BarraDeck
            decks={decks}
            atual={s.deck}
            nome={nomeDeck}
            onNome={setNomeDeck}
            onCarregar={carregarDeck}
            onSalvar={guardarDeck}
            onApagar={(id) => setDecks(apagarDeck(id))}
            onNovo={novoDeck}
            onAbrirBolsa={() => {
              setSlotAlvo(null);
              setBolsaAberta(true);
            }}
            podeSalvar={s.time.some((x) => x.carta != null)}
          />

          {s.time.some((x) => x.id != null && x.carta == null) ? (
            <Note flush>
              Tem pokémon no time que não é carta da sua bolsa, provavelmente vindo de um
              link. Cadastre como carta pra poder guardar num deck.
            </Note>
          ) : null}
        </Panel>
      </div>

      {resultado && alvo ? (
        <StadiumCombate
          resultado={resultado}
          fichas={fichas}
          melhor={melhor}
          alvoNome={alvoNome}
        />
      ) : (
        <Panel title={<span className="pix">O combate</span>}>
          <Empty
            title={!alvo ? "Escolha o alvo" : "Monte o time"}
            hint={
              !alvo
                ? `São ${bosses.length} bosses no catálogo do jogo, com o nível oficial de cada um. Dá pra medir contra qualquer espécie também.`
                : `Ponha ao menos um pokémon nos seis lugares. A ordem é a ordem de entrada: o primeiro segura o começo e quem vem depois pega ${alvoNome} com o HP que sobrou.`
            }
          />
        </Panel>
      )}

      <p className="pix text-[10px] text-text-mute">
        CATÁLOGO DE BOSSES BAIXADO EM {new Date(bossesGeradoEm).toLocaleDateString("pt-BR")}
      </p>

      <StadiumBolsa
        aberta={bolsaAberta}
        cartas={cartas}
        slotAlvo={slotAlvo}
        onEscolher={(c) => porNoSlot(c, slotAlvo)}
        onEditar={abrirEditor}
        onApagar={apagar}
        onNova={() => abrirEditor(null)}
        onFechar={() => {
          setBolsaAberta(false);
          setSlotAlvo(null);
        }}
      />

      <StadiumCarta
        aberta={cartaAberta}
        carta={editando}
        mons={mons}
        onSalvar={(c) => {
          const nova = !porCartaId.has(c.id);
          guardarCarta(c);
          // Carta NOVA cai direto no lugar que pediu a bolsa. É o caminho de quem
          // clicou num slot vazio: mandá-la voltar à lista pra escolher o pokémon
          // que acabou de cadastrar seria um passo a troco de nada.
          if (nova && slotAlvo != null) porNoSlot(c, slotAlvo);
        }}
        onFechar={() => {
          setCartaAberta(false);
          setEditando(null);
        }}
      />
    </div>
  );
}
