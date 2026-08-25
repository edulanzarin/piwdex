"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { unpackMon, type PackedMon } from "@/lib/meta-data";
import type { PackedBoss } from "@/lib/stadium-data";
import type { MetaMon } from "@/lib/meta";
import { pingDestaque } from "@/lib/destaque-cliente";
import { IV_MAX } from "@/lib/stats";
import { DEFAULT_IV } from "@/lib/meta";
import {
  fichaDe,
  melhorDoTime,
  simularArena,
  type ArenaAlvo,
  type ArenaMon,
  type FichaMembro,
} from "@/lib/stadium";
import {
  EMPTY_STADIUM,
  SLOT_VAZIO,
  buildStadiumSearch,
  parseStadiumState,
  type SlotState,
  type StadiumState,
} from "@/lib/stadium-url";
import { apagarTime, lerTimes, salvarTime, type TimeSalvo } from "@/lib/stadium-store";
import { StadiumAlvo } from "@/components/stadium-alvo";
import { StadiumTime } from "@/components/stadium-time";
import { StadiumCombate } from "@/components/stadium-combate";
import {
  Button,
  Empty,
  Field,
  FieldRow,
  IconButton,
  IconClose,
  Input,
  Note,
  Panel,
  Segmented,
  Select,
} from "@/components/ui";
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
 * derruba o que nenhum dos seis derruba sozinho, e é essa diferença que a
 * ferramenta existe pra mostrar. O motor está em `lib/stadium.ts`.
 *
 * ## Onde o estado mora
 *
 * O alvo e o time vão pra URL, porque time montado é uma PROPOSTA e proposta se
 * manda pro grupo. Os times salvos ficam no `localStorage`, porque a coleção
 * pessoal de quem abriu o site não tem por que viajar num link.
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

  const onSlot = useCallback((i: number, p: Partial<SlotState>) => {
    setS((old) => {
      const time = old.time.slice();
      // Trocar a espécie de um slot NÃO reaproveita nível e quality de quem
      // estava lá: são de outro pokémon. Tirar (id null) devolve o slot ao
      // padrão inteiro, senão o próximo a entrar herda um nível que ninguém
      // digitou pra ele.
      time[i] = p.id === null ? { ...SLOT_VAZIO } : { ...time[i], ...p };
      return { ...old, time };
    });
    if (p.id != null) pingDestaque(p.id);
  }, []);

  const mons = useMemo<MetaMon[]>(() => packed.map(unpackMon), [packed]);
  const byId = useMemo(() => new Map(mons.map((m) => [m.pokeId, m])), [mons]);

  const iv = s.iv === "perfeito" ? IV_MAX : DEFAULT_IV;
  const ivs = useMemo(() => Array<number>(6).fill(iv), [iv]);

  const alvoMon = s.alvo != null ? byId.get(s.alvo) ?? null : null;
  const bossAtual = s.boss ? bosses.find((b) => b.key === s.boss) ?? null : null;

  const alvo = useMemo<ArenaAlvo | null>(
    () =>
      alvoMon
        ? { mon: alvoMon, level: s.alvoLv, quality: s.alvoQ, ivs, reforco: s.reforco }
        : null,
    [alvoMon, s.alvoLv, s.alvoQ, s.reforco, ivs],
  );

  /** O time como o motor entende, junto com o slot de origem de cada um. */
  const escalados = useMemo(
    () =>
      s.time
        .map((slot, i) => {
          const mon = slot.id != null ? byId.get(slot.id) : null;
          if (!mon) return null;
          return { i, membro: { mon, level: slot.level, quality: slot.quality, ivs } as ArenaMon };
        })
        .filter((x): x is { i: number; membro: ArenaMon } => x != null),
    [s.time, byId, ivs],
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
    // mesma página, e o de baixo sempre errado quando há buraco no meio do time.
    return {
      ...bruto,
      passagens: bruto.passagens.map((p) => ({ ...p, slot: escalados[p.slot].i })),
      carregou: bruto.carregou != null ? escalados[bruto.carregou].i : null,
    };
  }, [escalados, alvo, s.pool]);

  const melhor = useMemo(() => melhorDoTime([...fichas.values()]), [fichas]);

  // ---- os times salvos ----
  const [salvos, setSalvos] = useState<TimeSalvo[]>([]);
  const [nome, setNome] = useState("");
  useEffect(() => setSalvos(lerTimes()), []);

  const carregar = (id: string) => {
    const t = salvos.find((x) => x.id === id);
    if (t) patch({ time: t.time.map((x) => ({ ...x })) });
  };

  const temTime = escalados.length > 0;
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
          <Field label="IV dos dois lados" icon={<IconGem size={14} />}>
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
          Os dois lados usam o mesmo IV. Assim o que separa o seu time do boss é espécie,
          nível e quality, e não a sorte de um número que o jogo nem chega a mostrar.
        </Note>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
        <StadiumAlvo mons={mons} bosses={bosses} state={s} patch={patch} />

        <Panel
          title={<span className="pix">O time</span>}
          actions={
            <span className="pix text-[10px] text-text-mute">
              {escalados.length}/{s.time.length}
            </span>
          }
          bodyClassName="flex flex-col gap-3"
        >
          <StadiumTime
            mons={mons}
            state={s}
            fichas={fichas}
            onSlot={onSlot}
            temAlvo={alvo != null}
          />

          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <Field label="Times salvos" className="min-w-[11rem] flex-1">
              <Select
                value=""
                onChange={(v) => carregar(v)}
                options={[
                  { value: "", label: salvos.length ? "carregar um time..." : "nenhum time salvo" },
                  ...salvos.map((t) => ({ value: t.id, label: t.nome })),
                ]}
              />
            </Field>
            <Field label="Salvar este como" className="min-w-[11rem] flex-1">
              <Input
                value={nome}
                onChange={(e) => setNome(e.currentTarget.value)}
                placeholder="nome do time"
                maxLength={32}
              />
            </Field>
            <Button
              onClick={() => {
                setSalvos(salvarTime(nome, s.time));
                setNome("");
              }}
              disabled={!temTime || !nome.trim()}
            >
              Salvar
            </Button>
            <Button
              variant="ghost"
              onClick={() => patch({ time: EMPTY_STADIUM.time.map((x) => ({ ...x })) })}
              disabled={!temTime}
            >
              Limpar time
            </Button>
          </div>

          {salvos.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {salvos.map((t) => (
                <span
                  key={t.id}
                  className="flex items-center gap-1 rounded-pix border border-line-strong bg-surface-2 py-0.5 pl-2 pr-0.5 text-[12px] text-text-dim"
                >
                  <button
                    type="button"
                    className="max-w-[10rem] truncate hover:text-text"
                    onClick={() => carregar(t.id)}
                  >
                    {t.nome}
                  </button>
                  <IconButton
                    label={`Apagar o time ${t.nome}`}
                    title="Apagar"
                    size="sm"
                    onClick={() => setSalvos(apagarTime(t.id))}
                  >
                    <IconClose size={12} />
                  </IconButton>
                </span>
              ))}
            </div>
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
                : `Ponha ao menos um pokémon nos seis slots. A ordem é a ordem de entrada: o primeiro segura o começo e quem vem depois pega ${alvoNome} com o HP que sobrou.`
            }
          />
        </Panel>
      )}

      <p className="pix text-[10px] text-text-mute">
        CATÁLOGO DE BOSSES BAIXADO EM {new Date(bossesGeradoEm).toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
}
