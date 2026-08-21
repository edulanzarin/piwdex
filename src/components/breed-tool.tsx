"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { PokeType, Rarity } from "@/lib/types";
import {
  IV_MAX,
  IV_MAX_TOTAL,
  QUALITY_DIFF_MAX,
  QUALITY_MAX_NORMAL,
  type BreedMode,
  type BreedMon,
  checkCompat,
  expectedGain,
  ivTotal,
  projectEgg,
  round3,
} from "@/lib/breeding";
import { gravarEstante, lerEstante, uid } from "@/lib/breed-store";
import {
  EMPTY_BREED,
  EMPTY_PARENT,
  buildBreedSearch,
  parseBreedState,
  type BreedState,
  type ParentState,
} from "@/lib/breed-url";
import { spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
import { STAT_LABEL, STAT_SHORT } from "@/lib/labels";
import { TypeBadge } from "@/components/type-icon";
import { IconGem, IconStone, STAT_ICONS } from "@/components/game-icons";
import {
  Button,
  Chip,
  Combobox,
  FieldLabel,
  IconCheck,
  IconClose,
  IconLink,
  IconStar,
  Note,
  NumberField,
  Panel,
  Segmented,
  Sprite,
  Switch,
} from "@/components/ui";
import { BreedEgg } from "@/components/breed-egg";
import { BreedPlanner } from "@/components/breed-planner";

/**
 * Ferramenta de Breeding.
 *
 * Ela responde tres perguntas, e a ordem da tela e a ordem delas:
 *
 * 1. **Esse par presta?** — mesma especie e Quality a no maximo 0.150. O jogo so
 *    diz "nao" na hora de confirmar; aqui o veredito aparece enquanto se digita.
 * 2. **O que sai do ovo?** — Quality e sorteio, IV herdado, custo. Ver `BreedEgg`.
 * 3. **Quantos breeds ate a Quality que eu quero?** — ver `BreedPlanner`, que e
 *    a unica parte que nao existe no jogo de forma nenhuma.
 *
 * O estado dos dois pais mora na URL (mesma regra da dex e da calculadora): um
 * par de breeding e uma decisao cara que se discute com outra pessoa. A ESTANTE
 * de pokemon salvos e o contrario — colecao pessoal, `localStorage`, nao viaja
 * em link nenhum.
 */
export interface BreedSpecies {
  id: number;
  name: string;
  bases: number[];
  type1: PokeType;
  type2: PokeType | null;
  rarity: Rarity;
}

const q3 = (n: number) => n.toFixed(3);

/** Por que ainda nao ha ovo, em portugues. `checkCompat` devolve chave de i18n
 *  porque o motor veio do piwdex antigo, que era bilingue. */
const MOTIVO: Record<string, string> = {
  "breed.invalid.fill": "Escolha a espécie dos dois lados.",
  "breed.invalid.species": "Os pais têm de ser da mesma espécie.",
  "breed.invalid.quality": `A diferença de Quality passa de ${q3(QUALITY_DIFF_MAX)}.`,
};

function paraMon(p: ParentState, especies: BreedSpecies[], id: string): BreedMon | null {
  if (p.id == null || p.quality <= 0) return null;
  const e = especies.find((x) => x.id === p.id);
  if (!e) return null;
  return {
    id,
    pokeId: e.id,
    name: e.name,
    species: e.name,
    type1: e.type1,
    type2: e.type2,
    quality: round3(p.quality),
    ivs: p.ivs.map((v) => Math.min(IV_MAX, Math.max(0, Math.round(v)))),
    shiny: p.shiny,
    createdAt: 0,
  };
}

export function BreedTool({ especies }: { especies: BreedSpecies[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [s, setS] = useState<BreedState>(() => parseBreedState(new URLSearchParams(sp.toString())));
  const [estante, setEstante] = useState<BreedMon[]>([]);
  const [montado, setMontado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(`${pathname}${buildBreedSearch(s)}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [s, router, pathname]);

  // A estante so pode ser lida depois da hidratacao: `localStorage` nao existe no
  // servidor, e ler no primeiro render faria o HTML do servidor divergir do
  // cliente. `montado` guarda o trilho enquanto isso.
  useEffect(() => {
    setEstante(lerEstante());
    setMontado(true);
  }, []);
  useEffect(() => {
    if (montado) gravarEstante(estante);
  }, [estante, montado]);

  const patch = useCallback((p: Partial<BreedState>) => setS((old) => ({ ...old, ...p })), []);
  const patchPai = useCallback(
    (lado: "a" | "b", p: Partial<ParentState>) =>
      setS((old) => ({ ...old, [lado]: { ...old[lado], ...p } })),
    [],
  );

  const monA = useMemo(() => paraMon(s.a, especies, "A"), [s.a, especies]);
  const monB = useMemo(() => paraMon(s.b, especies, "B"), [s.b, especies]);
  const compat = checkCompat(monA, monB);
  const egg = useMemo(
    () => (compat.ok && monA && monB ? projectEgg(monA, monB, s.mode, s.double) : null),
    [compat.ok, monA, monB, s.mode, s.double],
  );

  const especie = useMemo(
    () => especies.find((e) => e.id === (monA?.pokeId ?? monB?.pokeId ?? -1)) ?? null,
    [especies, monA, monB],
  );
  const tint = especie ? TYPE_COLOR[especie.type1] : "var(--color-t-breed)";

  // A base do plano e o pai de maior Quality: e dele que o filho parte.
  const basePlano = useMemo(() => {
    const cand = [monA, monB].filter((m): m is BreedMon => m != null);
    if (cand.length === 0) return null;
    return cand.reduce((melhor, m) => (m.quality > melhor.quality ? m : melhor));
  }, [monA, monB]);

  const salvar = (lado: "a" | "b") => {
    const mon = lado === "a" ? monA : monB;
    if (!mon) return;
    const novo: BreedMon = { ...mon, id: uid(), createdAt: Date.now() };
    setEstante((prev) => {
      // Mesmo bicho salvo duas vezes vira uma entrada so: especie + Quality + IV
      // identicos e o mesmo pokemon, nao dois.
      const igual = prev.findIndex(
        (m) =>
          m.pokeId === novo.pokeId &&
          Math.abs(m.quality - novo.quality) < 1e-9 &&
          m.ivs.every((v, i) => v === novo.ivs[i]) &&
          m.shiny === novo.shiny,
      );
      if (igual >= 0) return prev;
      return [novo, ...prev];
    });
  };

  const carregar = (lado: "a" | "b", m: BreedMon) =>
    patchPai(lado, { id: m.pokeId, quality: m.quality, ivs: [...m.ivs], shiny: m.shiny });

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      /* o link da barra de endereco ja e o certo */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ============================ os pais ============================ */}
      <Panel
        title={<span className="flex items-center gap-2"><IconGem size={16} />Os dois pais</span>}
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={copiarLink}
              iconLeft={copiado ? <IconCheck size={15} /> : <IconLink size={15} />}
              disabled={!monA && !monB}
            >
              {copiado ? "copiado" : "copiar link"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setS({ ...EMPTY_BREED, mode: s.mode, double: s.double })}
              disabled={!monA && !monB}
            >
              limpar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <PainelPai
              slot="1"
              estado={s.a}
              especies={especies}
              doador={egg?.fromParent === "a"}
              onChange={(p) => patchPai("a", p)}
              onSave={() => salvar("a")}
              podeSalvar={monA != null}
            />
            <PainelPai
              slot="2"
              estado={s.b}
              especies={especies}
              doador={egg?.fromParent === "b"}
              onChange={(p) => patchPai("b", p)}
              onSave={() => salvar("b")}
              podeSalvar={monB != null}
            />
          </div>

          <Veredito compat={compat} monA={monA} monB={monB} />
        </div>
      </Panel>

      {/* ============================ a estante ============================ */}
      <Panel
        title={<span className="pix">A estante</span>}
        actions={
          <span className="pix text-[11px] text-text-mute tabular">
            {montado ? estante.length : "—"}
          </span>
        }
      >
        <div className="flex min-h-[3.6rem] items-center gap-2 overflow-x-auto">
          {!montado ? (
            <span className="text-[13px] text-text-mute">carregando…</span>
          ) : estante.length === 0 ? (
            <span className="text-[13px] text-text-mute italic">
              Salve um pai aqui e ele volta com um clique em vez de doze campos digitados. Fica
              só neste navegador.
            </span>
          ) : (
            estante.map((m) => (
              <div
                key={m.id}
                className="flex shrink-0 items-center gap-2 border border-line bg-surface-2/60 px-2 py-1.5"
              >
                <span className="relative grid shrink-0 place-items-center">
                  <Sprite src={spriteUrl(m.pokeId, m.shiny)} alt={m.name} size={32} />
                  {m.shiny ? (
                    <IconStar size={14} className="absolute -top-1 -right-1 text-warn" />
                  ) : null}
                </span>
                <span className="min-w-0 text-[13px] leading-tight">
                  <span className="block max-w-[7.5rem] truncate text-text">{m.name}</span>
                  <span className="block text-text-mute tabular">
                    Q {q3(m.quality)} · IV {ivTotal(m.ivs)}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    title="mandar pro slot 1"
                    onClick={() => carregar("a", m)}
                    className="pix h-8 w-8 border border-line text-[12px] text-text-dim transition-colors hover:border-accent hover:text-accent"
                  >
                    1
                  </button>
                  <button
                    type="button"
                    title="mandar pro slot 2"
                    onClick={() => carregar("b", m)}
                    className="pix h-8 w-8 border border-line text-[12px] text-text-dim transition-colors hover:border-accent hover:text-accent"
                  >
                    2
                  </button>
                  <button
                    type="button"
                    title="tirar da estante"
                    onClick={() => setEstante((prev) => prev.filter((x) => x.id !== m.id))}
                    className="grid h-8 w-8 place-items-center border border-line text-text-mute transition-colors hover:border-danger hover:text-danger"
                  >
                    <IconClose size={14} />
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </Panel>

      {/* ============================ o modo ============================ */}
      <Panel title={<span className="pix">Como vai ser o breed</span>}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <FieldLabel>Modo</FieldLabel>
            <Segmented
              aria-label="Modo de breeding"
              value={s.mode}
              onChange={(mode) => patch({ mode })}
              options={[
                { value: "free", label: "Free", title: "Só dinheiro e Stones" },
                { value: "pheromone", label: "Pheromone", title: "Gasta 9 Strange Pheromones" },
              ]}
            />
            <span className="text-[13px] text-text-mute">
              {s.mode === "free"
                ? `+${expectedGain("free").toFixed(4)} de Quality por breed, em média`
                : `+${expectedGain("pheromone").toFixed(4)} por breed, ao custo de 9 Pheromones`}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel className="flex items-center gap-1.5">
              <IconStone size={14} />
              Double Stones
            </FieldLabel>
            <Switch
              checked={s.double}
              onChange={(e) => patch({ double: e.target.checked })}
              label="usar 40 Stones em vez de 20"
              hint="5% de +1 IV num stat abaixo de 32"
            />
          </div>
        </div>
      </Panel>

      {/* ============================ o ovo ============================ */}
      <BreedEgg
        egg={egg}
        a={monA}
        b={monB}
        especie={especie}
        mode={s.mode}
        double={s.double}
        level={s.level}
        onLevel={(level) => patch({ level })}
        tint={tint}
      />

      {/* ============================ o plano ============================ */}
      <BreedPlanner
        base={basePlano}
        target={s.target}
        onTarget={(target) => patch({ target })}
        mode={s.mode}
        tint={tint}
      />
    </div>
  );
}

/** Um dos dois pais. */
function PainelPai({
  slot,
  estado,
  especies,
  doador,
  onChange,
  onSave,
  podeSalvar,
}: {
  slot: "1" | "2";
  estado: ParentState;
  especies: BreedSpecies[];
  doador: boolean;
  onChange: (p: Partial<ParentState>) => void;
  onSave: () => void;
  podeSalvar: boolean;
}) {
  const especie = especies.find((e) => e.id === estado.id) ?? null;
  const total = estado.ivs.reduce((a, b) => a + b, 0);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border bg-surface-2/40 p-3 transition-colors",
        doador ? "border-accent/55" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="pix flex items-center gap-2 text-[12px] text-text-dim">
          Slot {slot}
          {doador ? <Chip size="xs" tone="accent">doa o IV</Chip> : null}
        </span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onSave} disabled={!podeSalvar}>
            salvar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange({ ...EMPTY_PARENT, ivs: [...EMPTY_PARENT.ivs] })}
            disabled={estado.id == null}
          >
            limpar
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <span className="relative grid h-16 w-16 shrink-0 place-items-center border border-line bg-bg-soft">
          {especie ? (
            <Sprite src={spriteUrl(especie.id, estado.shiny)} alt={especie.name} size={56} />
          ) : (
            <span className="text-[20px] text-text-mute">?</span>
          )}
          {estado.shiny && especie ? (
            <IconStar size={15} className="absolute top-0.5 right-0.5 text-warn" />
          ) : null}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Combobox
            value={estado.id}
            onChange={(id) => onChange({ id })}
            options={especies.map((e) => ({
              value: e.id,
              label: e.name,
              keywords: String(e.id),
              render: (
                <span className="flex items-center gap-2">
                  <Sprite src={spriteUrl(e.id)} alt={e.name} size={24} />
                  {e.name}
                </span>
              ),
            }))}
            placeholder="espécie..."
            emptyText="nenhuma espécie com esse nome"
          />
          <div className="flex items-center gap-2">
            <FieldLabel className="shrink-0">Quality</FieldLabel>
            <NumberField
              min={0}
              max={999}
              step={0.001}
              fallback={1}
              aria-label={`Quality do slot ${slot}`}
              value={estado.quality}
              onChange={(quality) => onChange({ quality })}
              wrapClassName="w-28"
              className="text-center text-[15px]"
            />
            {especie ? (
              <span className="ml-auto flex min-w-0 gap-1">
                <TypeBadge type={especie.type1} />
                {especie.type2 ? <TypeBadge type={especie.type2} /> : null}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <FieldLabel>IV, como o jogo mostra</FieldLabel>
          <span className="text-[12px] text-text-mute tabular">
            {total} de {IV_MAX_TOTAL}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {STAT_LABEL.map((label, i) => {
            const Icon = STAT_ICONS[i];
            return (
              <div key={label}>
                <FieldLabel className="mb-1 flex items-center gap-1 text-text-mute">
                  <Icon size={14} />
                  {STAT_SHORT[i]}
                </FieldLabel>
                <NumberField
                  min={0}
                  max={IV_MAX}
                  fallback={0}
                  aria-label={`${label} do slot ${slot}`}
                  value={estado.ivs[i]}
                  onChange={(v) => onChange({ ivs: estado.ivs.map((x, j) => (j === i ? v : x)) })}
                  className="text-center text-[15px]"
                />
              </div>
            );
          })}
        </div>
      </div>

      <Switch
        checked={estado.shiny}
        onChange={(e) => onChange({ shiny: e.target.checked })}
        label="Shiny"
        hint={estado.shiny ? "sem teto de Quality, e o filho nasce Shiny" : undefined}
      />
    </div>
  );
}

/**
 * O veredito do par.
 *
 * Ele nao diz so "invalido": diz o NUMERO que reprovou e o quanto falta. A
 * diferenca de Quality e a regra que mais pega gente de surpresa no jogo, e
 * "0.180, o limite e 0.150" resolve sozinho — "par incompativel" manda a pessoa
 * adivinhar qual das duas regras quebrou.
 */
function Veredito({
  compat,
  monA,
  monB,
}: {
  compat: ReturnType<typeof checkCompat>;
  monA: BreedMon | null;
  monB: BreedMon | null;
}) {
  const cheio = monA != null && monB != null;
  const razao = compat.reasons[0];

  if (!cheio) {
    return <Note icon={null}>{MOTIVO[razao] ?? "Preencha os dois slots."}</Note>;
  }

  const proporcao = Math.min(1, compat.qualityDiff / QUALITY_DIFF_MAX);
  const tetoNormal = !monA.shiny && !monB.shiny;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border p-3",
        compat.ok ? "border-ok/45 bg-ok/8" : "border-danger/45 bg-danger/8",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={cn("pix text-[12px]", compat.ok ? "text-ok" : "text-danger")}>
          {compat.ok ? "par válido" : "par inválido"}
        </span>

        <span className="flex min-w-[190px] flex-1 items-center gap-2">
          <span className="pix text-[11px] text-text-mute">diferença</span>
          <span className="h-2 flex-1 overflow-hidden border border-line bg-bg-soft">
            <span
              className="block h-full transition-all"
              style={{
                width: `${proporcao * 100}%`,
                backgroundColor: compat.ok ? "var(--color-ok)" : "var(--color-danger)",
              }}
            />
          </span>
          <span
            className={cn(
              "shrink-0 text-[14px] font-semibold tabular",
              compat.ok ? "text-text" : "text-danger",
            )}
          >
            {q3(compat.qualityDiff)}
          </span>
          <span className="shrink-0 text-[12px] text-text-mute tabular">
            / {q3(QUALITY_DIFF_MAX)}
          </span>
        </span>
      </div>

      {!compat.ok ? (
        <span className="text-[13px] text-text-dim">
          {compat.reasons.map((r) => MOTIVO[r] ?? r).join(" ")}
          {!compat.sameSpecies ? "" : ` Abaixe ${q3(compat.qualityDiff - QUALITY_DIFF_MAX)} de distância entre os dois.`}
        </span>
      ) : (
        <span className="text-[13px] text-text-dim">
          Os dois serão consumidos e sai um ovo.
          {tetoNormal && Math.max(monA.quality, monB.quality) >= QUALITY_MAX_NORMAL
            ? ` Os dois já estão no teto de ${q3(QUALITY_MAX_NORMAL)} — não há Quality a ganhar aqui.`
            : ""}
        </span>
      )}
    </div>
  );
}
