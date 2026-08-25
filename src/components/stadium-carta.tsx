"use client";

import { useEffect, useMemo, useState } from "react";
import type { MetaMon } from "@/lib/meta";
import { cartaLabel, uid, type Carta } from "@/lib/bolsa";
import { IV_MAX_TOTAL } from "@/lib/breeding";
import { lerIvs, textoIv, textoIvTotal } from "@/lib/iv-reading";
import { spriteUrl } from "@/lib/sprites";
import { STAT_LABEL, STAT_SHORT, monLabel, num } from "@/lib/labels";
import {
  Button,
  Combobox,
  Field,
  FieldLabel,
  Input,
  Modal,
  Note,
  NumberField,
  Sprite,
  Switch,
  type ComboOption,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { IconGem, IconLevel, STAT_ICONS } from "@/components/game-icons";

const TINT = "var(--color-t-stadium)";

/**
 * A CARTA: um pokémon seu, como o jogo o mostra.
 *
 * Ela pede os SEIS STATS, e essa é a diferença que justifica a tela existir. A
 * versão anterior do Stadium pedia espécie, nível e quality e supunha o IV
 * médio — e IV é exatamente o número que o jogo esconde. O combate respondia
 * sobre um Charizard médio, não sobre o seu, e nada na tela avisava.
 *
 * Com os stats na mão o motor não supõe nada: os números que ele usa são os que
 * a pessoa está lendo no jogo. O IV aparece de brinde, lido de volta pela
 * fórmula — é o que diz se o bicho presta, e vem como FAIXA porque o stat da
 * tela já chegou arredondado.
 *
 * A carta vai pra bolsa, que é do site inteiro e não do Stadium. O mesmo
 * Charizard serve de pai no Breeding e de lutador aqui.
 */
export function StadiumCarta({
  aberta,
  carta,
  mons,
  onSalvar,
  onFechar,
}: {
  aberta: boolean;
  /** a carta em edição; null = criando uma nova */
  carta: Carta | null;
  mons: MetaMon[];
  onSalvar: (c: Carta) => void;
  onFechar: () => void;
}) {
  const [pokeId, setPokeId] = useState<number | null>(null);
  const [apelido, setApelido] = useState("");
  const [level, setLevel] = useState(100);
  const [quality, setQuality] = useState(1);
  const [stats, setStats] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [shiny, setShiny] = useState(false);

  // O formulário se recarrega quando a modal ABRE, e não a cada render: assim
  // editar uma carta traz os números dela, e "nova carta" traz o formulário
  // limpo, sem um efeito brigando com o que a pessoa está digitando.
  useEffect(() => {
    if (!aberta) return;
    setPokeId(carta?.pokeId ?? null);
    setApelido(carta && carta.name !== carta.species ? carta.name : "");
    setLevel(carta?.level ?? 100);
    setQuality(carta?.quality ?? 1);
    setStats(carta?.stats ? [...carta.stats] : [0, 0, 0, 0, 0, 0]);
    setShiny(carta?.shiny ?? false);
  }, [aberta, carta]);

  const byId = useMemo(() => new Map(mons.map((m) => [m.pokeId, m])), [mons]);
  const mon = pokeId != null ? byId.get(pokeId) ?? null : null;

  const opcoes = useMemo<ComboOption<number>[]>(
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

  const bases = mon
    ? [mon.baseHp, mon.baseAtk, mon.baseDef, mon.baseSpAtk, mon.baseSpDef, mon.baseSpeed]
    : null;
  const preenchido = stats.every((v) => v > 0);
  const leitura = bases && preenchido ? lerIvs(bases, stats, level, quality) : null;

  /**
   * Leitura IMPOSSÍVEL não salva, e essa trava não é preciosismo de formulário.
   *
   * Quando nenhum IV entre 0 e 32 reproduz os stats informados, `lerIvs` devolve
   * tudo travado no teto — e salvar assim grava um pokémon de IV 32 em cada
   * stat, que não existe e que ninguém digitou. O estrago não fica na carta: o
   * Breeding lê esse mesmo campo como o IV do PAI, então um nível digitado
   * errado aqui vira uma projeção de ovo mentindo lá, sem nada na tela ligando
   * as duas coisas.
   *
   * A tela já diz o que fazer (conferir nível e quality), então o botão desligado
   * não deixa ninguém sem saída.
   */
  const podeSalvar =
    mon != null && preenchido && level > 0 && quality > 0 && leitura != null && !leitura.impossivel;

  const salvar = () => {
    if (!mon || !leitura || leitura.impossivel) return;
    onSalvar({
      id: carta?.id ?? uid(),
      pokeId: mon.pokeId,
      name: apelido.trim().slice(0, 40) || mon.name,
      species: mon.name,
      type1: mon.type1,
      type2: mon.type2,
      level,
      quality,
      stats: [...stats],
      // O IV guardado é o INTEIRO que reproduz o stat, e não o ponto médio da
      // faixa: é ele que o Breeding lê como o IV do pai.
      ivs: [...leitura.inteiros],
      shiny,
      createdAt: carta?.createdAt || Date.now(),
    });
    onFechar();
  };

  return (
    <Modal
      open={aberta}
      onClose={onFechar}
      size="lg"
      eyebrow={carta ? "editando" : "nova carta"}
      title={
        <span className="flex items-center gap-2">
          {mon ? <Sprite src={spriteUrl(mon.pokeId)} alt="" size={28} /> : null}
          {mon ? (apelido.trim() || mon.name) : "Cadastrar um pokémon"}
        </span>
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            onClick={salvar}
            disabled={!podeSalvar}
            title={
              leitura?.impossivel
                ? "Os stats não fecham com o nível e a quality informados"
                : undefined
            }
          >
            {carta ? "Salvar mudanças" : "Guardar na bolsa"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Espécie">
            <Combobox
              value={pokeId}
              onChange={setPokeId}
              options={opcoes}
              placeholder="Procure pelo nome..."
            />
          </Field>
          <Field label="Apelido" hint="opcional; serve pra separar dois da mesma espécie">
            <Input
              value={apelido}
              onChange={(e) => setApelido(e.currentTarget.value)}
              placeholder={mon?.name ?? "sem apelido"}
              maxLength={40}
            />
          </Field>
        </div>

        {mon ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={mon.type1} size="xs" />
            {mon.type2 ? <TypeBadge type={mon.type2} size="xs" /> : null}
          </span>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Nível" icon={<IconLevel size={14} />}>
            <NumberField
              aria-label="Nível do pokémon"
              value={level}
              onChange={setLevel}
              min={1}
              max={1000}
              fallback={100}
            />
          </Field>
          <Field label="Quality" icon={<IconGem size={14} />}>
            <NumberField
              aria-label="Quality do pokémon"
              value={quality}
              onChange={setQuality}
              min={0}
              max={10}
              step={0.001}
              fallback={1}
            />
          </Field>
        </div>

        <div>
          <FieldLabel className="mb-1.5">Stats, como o jogo mostra</FieldLabel>
          {/* Duas colunas antes de `sm`: três campos de número pedem ~342px e o
              telefone de 390 tem 330 dentro da modal. Mesma escada do Breeding. */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
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
                    fallback={0}
                    aria-label={label}
                    value={stats[i]}
                    onChange={(v) => setStats((old) => old.map((x, j) => (j === i ? v : x)))}
                    className="text-center text-[15px]"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <Field>
          <Switch
            checked={shiny}
            onChange={(e) => setShiny(e.currentTarget.checked)}
            label="é shiny"
          />
        </Field>

        {leitura ? (
          <div className="flex flex-col gap-2 border border-line-strong bg-surface-2/60 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <FieldLabel>IV que esses stats dão</FieldLabel>
              <span className="tabular text-[12px] text-text-mute">
                {textoIvTotal(leitura)} de {IV_MAX_TOTAL}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
              {STAT_LABEL.map((label, i) => (
                <div key={label} className="flex flex-col">
                  <span className="pix text-[9px] text-text-mute">{STAT_SHORT[i]}</span>
                  <span className="tabular text-[13px]" style={{ color: TINT }}>
                    {textoIv(leitura, i)}
                  </span>
                </div>
              ))}
            </div>
            {leitura.impossivel ? (
              <Note tone="danger" flush>
                Nenhum IV entre 0 e 32 explica esses stats. Confira o nível e a quality: é
                quase sempre um deles que veio errado.
              </Note>
            ) : !leitura.cravado ? (
              <Note flush>
                O jogo mostra o stat já arredondado, então em nível baixo o mesmo número
                cabe numa faixa larga de IV. O combate não sofre com isso — ele usa os
                stats, não o IV.
              </Note>
            ) : null}
          </div>
        ) : mon ? (
          <Note>
            Preencha os seis stats. São os números da tela do pokémon no jogo, e é com eles
            que o combate roda — sem supor nada.
          </Note>
        ) : null}

        {carta && !preenchido ? (
          <Note tone="warn">
            Esta carta veio da estante antiga do Breeding, salva só com o IV. Digite os
            stats pra ela poder entrar no time. Quality {num(carta.quality, 3)},{" "}
            {cartaLabel(carta)}.
          </Note>
        ) : null}
      </div>
    </Modal>
  );
}
