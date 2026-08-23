"use client";

import { useEffect, useState } from "react";
import { Loading, Modal, Note, Sprite } from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { compact, num, STAT_SHORT, TIER_LABEL } from "@/lib/labels";
import { qualityTier, TIER_COLOR } from "@/lib/rarity";
import { animatedSpriteUrl, spriteUrl } from "@/lib/sprites";
import { estimateIvs, IV_MAX, powerOf } from "@/lib/stats";
import type { PokeType } from "@/lib/types";

/**
 * A ficha de UM pokémon, venha ele de onde vier.
 *
 * Um componente só para o time, o box, o cartão colado no chat e — quando o
 * mercado entrar — o anúncio de outro jogador. Todas essas fontes respondem a
 * mesma pergunta ("esse bicho presta?") e chegam com a mesma informação: stats
 * finais, nível e qualidade. Uma ficha por origem daria quatro respostas
 * ligeiramente diferentes para a mesma pergunta.
 *
 * O cálculo é o da calculadora pública: `estimateIvs` inverte a fórmula de stat
 * do jogo para descobrir o IV de cada atributo a partir do que a tela mostra.
 * Não é uma segunda régua — é a mesma.
 */

const TOTAL_MAX = IV_MAX * 6;

/** O contrato mínimo. Qualquer origem que responda isso abre o modal. */
export interface FichaPoke {
  nome: string;
  level: number;
  quality: number;
  shiny: boolean;
  /** os seis finais, na ordem hp/atk/def/spAtk/spDef/speed */
  stats: number[];
  /** quando a fonte já traz; senão sai da soma dos estimados */
  ivTotal?: number | null;
  power?: number | null;
  /** quando a fonte já sabe (time e box sabem; o chat não) */
  speciesId?: number | null;
  sellValue?: number | null;
  hp?: number | null;
  maxHp?: number | null;
  locked?: boolean;
  /** o que trouxe este pokémon até aqui, para a tela poder dizer */
  origem?: string;
}

interface Especie {
  speciesId: number;
  nome: string;
  t1: PokeType;
  t2: PokeType | null;
  raridade: string;
  bases: number[];
}

/** Quão perto do teto o bicho está, em palavra. A escada é a mesma do jogo para
 *  IV: 32 por atributo, 192 no total. */
function veredito(pct: number): { texto: string; cor: string } {
  if (pct >= 0.98) return { texto: "perfeito", cor: "var(--color-neon)" };
  if (pct >= 0.9) return { texto: "quase perfeito", cor: "var(--color-ok)" };
  if (pct >= 0.75) return { texto: "muito bom", cor: "var(--color-ok)" };
  if (pct >= 0.6) return { texto: "bom", cor: "var(--color-accent)" };
  if (pct >= 0.4) return { texto: "mediano", cor: "var(--color-warn)" };
  return { texto: "fraco", cor: "var(--color-danger)" };
}

function Barra({ razao, cor }: { razao: number; cor: string }) {
  return (
    <span className="flex h-1.5 w-full overflow-hidden bg-surface-3" aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(1, razao)) * 100}%`, backgroundColor: cor }} />
    </span>
  );
}

export function PokeModal({
  ficha,
  onFechar,
}: {
  ficha: FichaPoke | null;
  onFechar: () => void;
}) {
  const [especie, setEspecie] = useState<Especie | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!ficha) return;
    let vivo = true;
    setEspecie(null);
    setErro(false);
    const busca = ficha.speciesId
      ? `id=${ficha.speciesId}`
      : `nome=${encodeURIComponent(ficha.nome)}`;
    void fetch(`/api/robo/especie?${busca}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { especie?: Especie } | null) => {
        if (!vivo) return;
        if (j?.especie) setEspecie(j.especie);
        else setErro(true);
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [ficha]);

  if (!ficha) return null;

  const speciesId = ficha.speciesId ?? especie?.speciesId ?? 0;
  const tier = qualityTier(ficha.quality);

  /**
   * Os IVs individuais o jogo nunca manda: eles saem da inversão da fórmula de
   * stat, com os stats BASE da espécie.
   *
   * Só que a inversão pressupõe que os stats recebidos estão na MESMA escala em
   * que a fórmula foi verificada (a da tela de pokémon do jogo). Nem toda fonte
   * está: a vida que o frame `pokes` traz, por exemplo, é cerca de dez vezes
   * maior que o stat de HP. Escala errada não dá erro — dá IV 340 num teto de
   * 32, com cara de número.
   *
   * Por isso a leitura só é exibida quando **fecha com o total que o próprio
   * jogo declarou**. Divergiu, a tela mostra os stats e diz que não conseguiu
   * abrir por atributo. Melhor não responder do que responder errado com
   * confiança.
   */
  const leitura = especie ? estimateIvs(especie.bases, ficha.stats, ficha.level, ficha.quality) : null;
  const totalIv = ficha.ivTotal ?? leitura?.total ?? null;
  const confere =
    !!leitura &&
    leitura.ivs.every((v) => v >= 0 && v <= IV_MAX + 1) &&
    (ficha.ivTotal == null || Math.abs(leitura.total - ficha.ivTotal) <= Math.max(6, ficha.ivTotal * 0.1));
  // Arredondado e travado no teto: a inversao devolve fracionario (o stat que
  // entra ja veio arredondado pelo jogo), e "IV 31,7/32" e precisao que o dado
  // nao tem.
  const ivs = confere ? leitura.ivs.map((v) => Math.min(IV_MAX, Math.round(v))) : null;
  const pct = totalIv != null ? totalIv / TOTAL_MAX : null;
  const v = pct != null ? veredito(pct) : null;
  const poder = ficha.power ?? (ficha.stats.length ? powerOf(ficha.stats, ficha.quality) : null);
  const maiorStat = Math.max(...ficha.stats, 1);

  return (
    <Modal
      open
      onClose={onFechar}
      size="lg"
      eyebrow={ficha.origem ?? "pokémon"}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>{ficha.nome}</span>
          <span className="pix text-[11px] text-text-mute">nv {ficha.level}</span>
          {ficha.shiny ? <span className="pix text-[11px] text-warn">shiny</span> : null}
          {ficha.locked ? <span className="pix text-[11px] text-text-mute">cadeado</span> : null}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {/* ---- cabeçalho: arte, tipos, faixa ---- */}
        <div className="flex flex-wrap items-center gap-4 border border-line bg-bg-soft p-3">
          <Sprite
            src={spriteUrl(speciesId, ficha.shiny)}
            animatedSrc={speciesId ? animatedSpriteUrl(speciesId) : null}
            alt=""
            size={72}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="flex flex-wrap items-center gap-2">
              {especie ? (
                <>
                  <TypeBadge type={especie.t1} />
                  {especie.t2 ? <TypeBadge type={especie.t2} /> : null}
                </>
              ) : null}
              <span
                className="pix inline-flex h-6 items-center border px-2 text-[10px]"
                style={{ color: TIER_COLOR[tier], borderColor: `color-mix(in srgb, ${TIER_COLOR[tier]} 45%, transparent)` }}
              >
                {TIER_LABEL[tier]} · {ficha.quality.toFixed(2)}x
              </span>
            </span>

            <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
              {poder != null ? (
                <span className="flex items-baseline gap-1.5">
                  <span className="pix text-[10px] text-text-mute">poder</span>
                  <b className="text-[16px] tabular text-text">{compact(poder)}</b>
                </span>
              ) : null}
              {ficha.sellValue ? (
                <span className="flex items-baseline gap-1.5">
                  <span className="pix text-[10px] text-text-mute">NPC paga</span>
                  <b className="tabular text-warn">{compact(ficha.sellValue)}</b>
                </span>
              ) : null}
              {ficha.maxHp ? (
                <span className="flex items-baseline gap-1.5">
                  <span className="pix text-[10px] text-text-mute">vida</span>
                  <b className="tabular text-text-dim">
                    {num(ficha.hp ?? 0, 0)}/{num(ficha.maxHp, 0)}
                  </b>
                </span>
              ) : null}
            </span>
          </div>
        </div>

        {/* ---- o veredito ---- */}
        {pct != null && v ? (
          <div className="border border-line bg-bg-soft p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="pix text-[11px] text-text-mute">quão perto do teto</span>
              <span className="flex items-baseline gap-2">
                <b className="pix text-[13px]" style={{ color: v.cor }}>
                  {v.texto}
                </b>
                <span className="tabular text-[13px] text-text-dim">
                  {totalIv} / {TOTAL_MAX}
                </span>
              </span>
            </div>
            <span className="mt-2 block">
              <Barra razao={pct} cor={v.cor} />
            </span>
            <p className="mt-1.5 text-[11px] text-text-mute">
              {Math.round(pct * 100)}% do IV máximo. Quality e IV são grandezas separadas: a quality
              multiplica os stats, o IV soma antes da multiplicação.
            </p>
          </div>
        ) : null}

        {/* ---- os seis atributos ---- */}
        {erro ? (
          <Note tone="warn">
            Não achei esta espécie no catálogo do jogo, então os IVs por atributo ficam de fora.
          </Note>
        ) : !especie ? (
          <Loading />
        ) : (
          <div className="border border-line bg-bg-soft p-3">
            <p className="pix text-[11px] text-text-mute">atributos</p>
            <ul className="mt-2 flex flex-col gap-2">
              {ficha.stats.map((valor, i) => {
                const iv = ivs?.[i] ?? null;
                // Sem leitura confiável de IV, a barra ainda diz algo útil: o
                // peso deste atributo dentro do próprio bicho.
                const razao = iv != null ? iv / IV_MAX : valor / Math.max(1, maiorStat);
                const cor =
                  razao >= 0.95
                    ? "var(--color-neon)"
                    : razao >= 0.75
                      ? "var(--color-ok)"
                      : razao >= 0.5
                        ? "var(--color-accent)"
                        : "var(--color-warn)";
                return (
                  <li key={STAT_SHORT[i]} className="flex items-center gap-3">
                    <span className="pix w-14 shrink-0 text-[10px] text-text-mute">{STAT_SHORT[i]}</span>
                    <b className="w-16 shrink-0 text-right text-[13px] tabular text-text">
                      {compact(valor)}
                    </b>
                    <span className="min-w-0 flex-1">
                      <Barra razao={razao} cor={cor} />
                    </span>
                    <span className="w-16 shrink-0 text-right text-[11px] tabular" style={{ color: cor }}>
                      {iv != null ? `IV ${iv}/${IV_MAX}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-text-mute">
              {ivs
                ? "O jogo não publica o IV de cada atributo: estes saem da inversão da fórmula de stat, a mesma da calculadora do site. Erro de arredondamento pode mover um ponto."
                : "Esta fonte manda os atributos numa escala diferente da que a fórmula usa, então a divisão por atributo não fecha com o IV total que o jogo declarou. As barras mostram o peso de cada atributo dentro do bicho; o IV total acima é o número do jogo."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Converte o cartão colado no chat na ficha do modal. */
export const fichaDoChat = (p: {
  nome: string;
  level: number;
  quality: number;
  shiny: boolean;
  ivTotal: number;
  power: number;
  stats: { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number };
}): FichaPoke => ({
  nome: p.nome,
  level: p.level,
  quality: p.quality,
  shiny: p.shiny,
  ivTotal: p.ivTotal,
  power: p.power,
  stats: [p.stats.hp, p.stats.atk, p.stats.def, p.stats.spAtk, p.stats.spDef, p.stats.speed],
  origem: "anunciado no chat",
});

/** Converte um pokémon da conta (time ou box) na ficha do modal. */
export const fichaDaConta = (
  p: {
    name: string;
    speciesId: number;
    level: number;
    quality: number;
    shiny: boolean;
    ivTotal: number;
    power: number;
    sellValue: number;
    hp: number;
    maxHp: number;
    locked: boolean;
    stats: { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number };
  },
  origem = "da sua conta",
): FichaPoke => ({
  nome: p.name,
  speciesId: p.speciesId,
  level: p.level,
  quality: p.quality,
  shiny: p.shiny,
  ivTotal: p.ivTotal,
  power: p.power,
  sellValue: p.sellValue,
  hp: p.hp,
  maxHp: p.maxHp,
  locked: p.locked,
  stats: [p.stats.hp, p.stats.atk, p.stats.def, p.stats.spAtk, p.stats.spDef, p.stats.speed],
  origem,
});
