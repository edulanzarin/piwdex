"use client";

import type { CSSProperties } from "react";
import type { MetaMon } from "@/lib/meta";
import type { Carta } from "@/lib/bolsa";
import { cartaLabel } from "@/lib/bolsa";
import { IV_MAX_TOTAL } from "@/lib/breeding";
import { textoIv, textoIvTotal, type IvReading } from "@/lib/iv-reading";
import { STAT_LABEL, STAT_SHORT, num } from "@/lib/labels";
import { spriteUrl } from "@/lib/sprites";
import {
  Button,
  Field,
  FieldLabel,
  Input,
  Note,
  NumberField,
  Panel,
  Select,
  Sprite,
  Switch,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { IconGem, IconLevel, STAT_ICONS } from "@/components/game-icons";

const TINT = "var(--color-t-eevee)";

/**
 * SEU EEVEE — os seis stats, e não um Eevee médio.
 *
 * A primeira versão desta ferramenta pedia nível e quality e supunha IV 21 nos
 * seis. É o mesmo defeito que o Stadium já tinha cometido e corrigido: **IV é
 * exatamente o número que o jogo esconde**, então supor um valor médio faz a tela
 * responder sobre um Eevee que não é o seu — e a resposta muda de verdade. Entre
 * IV 0 e IV 32 em cada stat, o pokémon projetado no nível 100 varia perto de 30%.
 *
 * Com os seis stats na mão nada é suposto: o IV sai lido de volta pela fórmula, e
 * é ELE que atravessa pros cinco ramos. A leitura vem como FAIXA porque o jogo
 * mostra o stat já arredondado — em nível baixo o mesmo número cabe num intervalo
 * largo, e fingir precisão aí seria a mesma invenção de outro jeito.
 *
 * O painel também GUARDA na bolsa, que é do site inteiro: o mesmo Eevee vira pai
 * no Breeding e lutador no Stadium sem ser digitado três vezes.
 */
export function EeveeMeu({
  eevee,
  cartas,
  cartaId,
  onCarta,
  apelido,
  onApelido,
  shiny,
  onShiny,
  level,
  onLevel,
  quality,
  onQuality,
  stats,
  onStats,
  leitura,
  onGuardar,
  guardado,
}: {
  /** a espécie Eevee, do catálogo; null só se o catálogo mudar debaixo da tela */
  eevee: MetaMon | null;
  cartas: Carta[];
  cartaId: string;
  onCarta: (id: string) => void;
  apelido: string;
  onApelido: (v: string) => void;
  shiny: boolean;
  onShiny: (v: boolean) => void;
  level: number;
  onLevel: (v: number) => void;
  quality: number;
  onQuality: (v: number) => void;
  stats: number[];
  onStats: (v: number[]) => void;
  /** null enquanto os seis stats não estiverem preenchidos */
  leitura: IvReading | null;
  onGuardar: () => void;
  /** true logo depois de guardar, pra o botão confirmar sem abrir diálogo */
  guardado: boolean;
}) {
  const preenchido = stats.every((v) => v > 0);
  const podeGuardar =
    eevee != null &&
    preenchido &&
    level > 0 &&
    quality > 0 &&
    leitura != null &&
    !leitura.impossivel;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Sprite
            src={spriteUrl(133)}
            alt=""
            size={20}
            className="[--sprite:20px]"
          />
          <span className="pix">Seu Eevee</span>
        </span>
      }
      actions={
        eevee ? (
          <span className="flex items-center gap-1.5">
            <TypeBadge type={eevee.type1} size="xs" />
          </span>
        ) : null
      }
      bodyClassName="flex flex-col gap-3"
      style={{ "--tint": TINT } as CSSProperties}
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Da bolsa"
          hint={
            cartas.length === 0
              ? "nenhum Eevee cadastrado ainda"
              : `${cartas.length} cadastrado${cartas.length > 1 ? "s" : ""}`
          }
        >
          <Select
            value={cartaId}
            onChange={onCarta}
            disabled={cartas.length === 0}
            options={[
              { value: "", label: "Digitar à mão" },
              ...cartas.map((c) => ({ value: c.id, label: cartaLabel(c) })),
            ]}
          />
        </Field>

        <Field label="Apelido" hint="opcional; separa dois Eevee">
          <Input
            value={apelido}
            onChange={(e) => onApelido(e.currentTarget.value)}
            placeholder="Eevee"
            maxLength={40}
          />
        </Field>

        <Field
          label="Nível"
          icon={<IconLevel size={14} />}
          hint="corta as hunts acima de você"
        >
          <NumberField
            aria-label="Nível do Eevee"
            value={level}
            onChange={onLevel}
            min={1}
            max={1000}
            fallback={100}
          />
        </Field>

        <Field label="Quality" icon={<IconGem size={14} />}>
          <NumberField
            aria-label="Quality do Eevee"
            value={quality}
            onChange={onQuality}
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
            telefone de 390 tem 330 úteis. Mesma escada da carta do Stadium. */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
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
                  onChange={(v) =>
                    onStats(stats.map((x, j) => (j === i ? v : x)))
                  }
                  className="text-center text-[15px]"
                />
              </div>
            );
          })}
        </div>
      </div>

      {leitura ? (
        <div className="flex flex-col gap-2 border border-line-strong bg-surface-2/60 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <FieldLabel>IV que esses stats dão</FieldLabel>
            <span className="tabular text-[12px] text-text-mute">
              {textoIvTotal(leitura)} de {IV_MAX_TOTAL}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {STAT_LABEL.map((label, i) => (
              <div key={label} className="flex flex-col">
                <span className="pix text-[9px] text-text-mute">
                  {STAT_SHORT[i]}
                </span>
                <span className="tabular text-[13px]" style={{ color: TINT }}>
                  {textoIv(leitura, i)}
                </span>
              </div>
            ))}
          </div>

          {leitura.impossivel ? (
            <Note tone="danger" flush>
              Nenhum IV entre 0 e 32 explica esses stats. Confira o nível e a
              quality: é quase sempre um dos dois que veio errado. Enquanto não
              fechar, os cinco ramos continuam com o Eevee genérico.
            </Note>
          ) : !leitura.cravado ? (
            <Note flush>
              O jogo mostra o stat já arredondado, então em nível baixo o mesmo
              número cabe numa faixa larga de IV. A projeção usa o inteiro que
              reproduz o stat — a largura aqui é o tamanho da dúvida, não erro.
            </Note>
          ) : null}
        </div>
      ) : (
        <Note>
          Preencha os seis stats da tela do pokémon. Sem eles a projeção dos
          cinco ramos supõe IV 21 em tudo, e IV é justamente o que o jogo
          esconde — o mesmo Eevee de nível 100 rende perto de 30% a mais ou a
          menos conforme o IV que ele tirou.
        </Note>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Switch
          checked={shiny}
          onChange={(e) => onShiny(e.currentTarget.checked)}
          label="é shiny"
        />
        <Button
          variant="ghost"
          onClick={onGuardar}
          disabled={!podeGuardar}
          title={
            leitura?.impossivel
              ? "Os stats não fecham com o nível e a quality informados"
              : "Guarda na bolsa do site — serve de pai no Breeding e de lutador no Stadium"
          }
        >
          {guardado ? "Guardado na bolsa" : "Guardar na bolsa"}
        </Button>
      </div>

      {eevee && preenchido && leitura && !leitura.impossivel ? (
        <Note flush>
          Poder {num(stats.reduce((a, b) => a + b, 0) * quality, 0)} · soma de
          IV {textoIvTotal(leitura)}. É este IV que atravessa pros cinco ramos
          abaixo: os stats projetados lá são o que ESTE Eevee viraria, não um
          médio.
        </Note>
      ) : null}
    </Panel>
  );
}
