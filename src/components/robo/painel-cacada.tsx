"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button, Combobox, Empty, Note, Sprite } from "@/components/ui";
import { Pokeball } from "@/components/ui/pokeball";
import { compact, num, TIER_LABEL } from "@/lib/labels";
import { qualityTier, TIER_COLOR } from "@/lib/rarity";
import { spriteUrl } from "@/lib/sprites";
import { xpProgress } from "@/lib/xp";
import { Cartao, ICONE, Medidor, TOM, Valor } from "@/components/robo/pecas";
import { fichaDaConta, type FichaPoke } from "@/components/robo/poke-modal";
import { PainelObjetivo } from "@/components/robo/painel-objetivo";
import type { ConfigAuto, EstadoHunt, Evento } from "@/lib/robo/motor/tipos";
import type { HuntOpcao } from "@/components/robo/painel-tool";

/**
 * A aba da caçada: o comando dela, os números dela, e o que está acontecendo.
 *
 * O seletor de hunt e a faixa de números moram AQUI, e não no topo. Eles são
 * assunto de uma aba só — ficavam ocupando a tela inteira para quem estava
 * mexendo em automação ou lendo o chat, e o "parar a caçada" ainda por cima
 * aparecia longe do lugar onde a caçada se acompanha.
 *
 * Os quatro cartões têm ALTURA FIXA e rolagem própria. Sem isso cada um crescia
 * por conta e as duas colunas terminavam em alturas diferentes; o do time é o
 * caso mais fácil, porque o máximo é conhecido: seis.
 */

const COR = "var(--color-t-robo)";
/** Seis linhas de time cabem aqui. É o teto do jogo, então é o teto do cartão. */
const ALTURA = 430;

/** O rótulo de cada linha do feed, e a cor que ele carrega. */
const LINHA: Record<Evento["tipo"], { texto: string; cor: string }> = {
  kill: { texto: "abateu", cor: "var(--color-text-mute)" },
  captura: { texto: "pegou", cor: COR },
  compra: { texto: "comprou", cor: TOM.ouro },
  venda: { texto: "vendeu", cor: TOM.vida },
  cura: { texto: "curou", cor: "var(--color-accent)" },
  aviso: { texto: "aviso", cor: TOM.perigo },
};

function LinhaTime({
  p,
  ocupado,
  comandar,
  onFicha,
}: {
  p: EstadoHunt["time"][number];
  ocupado: boolean;
  comandar: (rota: string, corpo?: unknown) => Promise<void>;
  onFicha: (f: FichaPoke) => void;
}) {
  const tier = qualityTier(p.quality);
  const xp = xpProgress(p.level, p.xp);
  const baixo = p.maxHp > 0 && p.hp / p.maxHp < 0.3;
  return (
    <li
      className="flex items-center gap-3 border border-line bg-bg-soft p-2 transition-colors hover:border-line-strong"
      style={p.leader ? { borderColor: "color-mix(in srgb, var(--color-t-robo) 45%, transparent)" } : undefined}
    >
      <button
        type="button"
        onClick={() => onFicha(fichaDaConta(p, p.leader ? "líder da caçada" : "no seu time"))}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        title="ver a ficha completa"
      >
        <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt="" size={p.leader ? 44 : 36} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <b className="truncate text-[13px] text-text">{p.name}</b>
            <span className="pix text-[10px] text-text-mute">nv {p.level}</span>
            {p.leader ? (
              <span className="pix text-[10px]" style={{ color: COR }}>
                líder
              </span>
            ) : null}
            {p.shiny ? <span className="pix text-[10px] text-warn">shiny</span> : null}
            {/* Largura fixa: os nomes vao de "Raro" a "Ancestral", e texto solto
                empurrava o resto da linha um pouco diferente em cada pokemon. */}
            <span className="pix w-16 shrink-0 text-[10px]" style={{ color: TIER_COLOR[tier] }}>
              {TIER_LABEL[tier]}
            </span>
            <span className="pix text-[10px] text-text-mute">IV {p.ivTotal}</span>
          </span>
          <Medidor
            valor={p.hp}
            max={p.maxHp}
            cor={baixo ? TOM.perigo : TOM.vida}
            sufixo={`${num(p.hp, 0)}/${num(p.maxHp, 0)}`}
          />
          <Medidor
            valor={xp.pct ?? 0}
            max={1}
            compacto
            tom="xp"
            sufixo={xp.pct != null ? `${Math.round(xp.pct * 100)}% do nível` : `nível custa ${compact(xp.need)} xp`}
          />
        </span>
      </button>
      {!p.leader ? (
        <span className="flex shrink-0 flex-col gap-1">
          <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => void comandar("lider", { pokeId: p.id })}>
            caçar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={ocupado}
            onClick={() => void comandar("mover", { pokeId: p.id, dir: "store" })}
          >
            guardar
          </Button>
        </span>
      ) : null}
    </li>
  );
}

export function AbaCacada({
  estado,
  ocupado,
  comandar,
  hunts,
  slug,
  setSlug,
  onFicha,
  config,
  onConfig,
}: {
  estado: EstadoHunt;
  ocupado: boolean;
  comandar: (rota: string, corpo?: unknown) => Promise<void>;
  hunts: HuntOpcao[];
  slug: string;
  setSlug: Dispatch<SetStateAction<string>>;
  onFicha: (f: FichaPoke) => void;
  config: ConfigAuto;
  onConfig: (cfg: ConfigAuto) => Promise<void>;
}) {
  const a = estado.analyzer;
  const p = estado.placar;
  const drops = a?.drops ?? [];
  const opcoes = hunts.map((h) => ({
    value: h.slug,
    label: `${h.nome} · nv ${h.level}`,
    keywords: `${h.slug} ${h.area}`,
  }));
  const estoqueBolas = estado.bolas.reduce((s, b) => (b.infinita ? s : s + b.quantidade), 0);
  // O saldo do analyzer conta só o que a caçada rendeu. As automações movem ouro
  // por fora dela, então somar as duas coisas é o único número que responde
  // "estou ganhando dinheiro?".
  const liquido = (a?.balance ?? 0) + p.ouroVendas + p.ouroPokes - p.ouroCompras;
  const ouroDrops = drops.reduce((soma, d) => soma + d.gold, 0);
  const noPiloto = config.objetivo !== "nenhum";

  return (
    <div className="flex flex-col gap-4">
      {/* ---- comando da caçada ----
           Com objetivo ligado, quem escolhe é o robô: os controles ficam
           desabilitados em vez de aceitarem uma ordem que a próxima reavaliação
           desfaria em segundos. */}
      <div className="flex flex-wrap items-end gap-3 border border-line bg-surface p-3">
        <div className="min-w-0 flex-1 basis-72">
          <p className="pix flex items-center gap-1.5 text-[11px] text-text-mute">
            <Pokeball size={12} />
            Onde caçar
          </p>
          <div className="mt-1">
            <Combobox
              value={slug}
              onChange={(v) => setSlug(String(v))}
              options={opcoes}
              placeholder="Escolha onde caçar…"
              disabled={noPiloto}
            />
          </div>
        </div>
        {noPiloto ? (
          <span className="flex h-10 items-center gap-2 text-[12px] text-text-dim">
            <ICONE.abates size={14} />
            O objetivo está no comando. Volte para <b>manual</b> para escolher você.
          </span>
        ) : (
          <>
            <Button
              size="lg"
              variant={estado.slug ? "outline" : "primary"}
              disabled={ocupado || !slug || !estado.conectado || estado.slug === slug}
              onClick={() => void comandar("cacar", { slug })}
            >
              {estado.slug ? "trocar de caçada" : "começar a caçar"}
            </Button>
            {estado.slug ? (
              <Button size="lg" variant="danger" disabled={ocupado} onClick={() => void comandar("cacar", {})}>
                parar a caçada
              </Button>
            ) : null}
            {!estado.conectado ? (
              <span className="pb-2 text-[12px] text-warn">Ligue o robô no topo para poder caçar.</span>
            ) : null}
          </>
        )}
      </div>

      {/* ---- o objetivo ---- */}
      <PainelObjetivo estado={estado} config={config} onConfig={onConfig} />

      {/* ---- os números desta caçada ---- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Valor rotulo="Derrotados" valor={a?.kills} icone={<ICONE.abates size={12} />} />
        <Valor
          rotulo="Capturas"
          valor={a?.captures}
          icone={<Pokeball size={12} />}
          sufixo={a?.shinyCaptures ? `${a.shinyCaptures} shiny` : undefined}
          tom={a?.shinyCaptures ? "ouro" : "neutro"}
        />
        <Valor rotulo="XP/h" valor={a ? Math.round(a.xpPerHour) : null} icone={<ICONE.xp size={12} />} tom="xp" />
        <Valor rotulo="Dólares/h" valor={a ? Math.round(a.goldPerHour) : null} icone={<ICONE.ouro size={12} />} tom="ouro" />
        <Valor
          rotulo="Saldo"
          valor={a ? Math.round(liquido) : null}
          sufixo="dólares"
          icone={<ICONE.ouro size={12} />}
          tom={liquido < 0 ? "perigo" : "vida"}
        />
        <Valor
          rotulo="Bolsa"
          valor={estoqueBolas || null}
          sufixo="bolas"
          icone={<Pokeball size={12} />}
          tom={estoqueBolas === 0 && estado.ligado ? "perigo" : "neutro"}
        />
        <Valor rotulo="Dólares" valor={estado.ouro} icone={<ICONE.ouro size={12} />} tom="ouro" />
        <Valor
          rotulo="Nível"
          valor={estado.nivelLider}
          sufixo={estado.passoAtual ? `de ${estado.passoAtual.ate}` : "líder"}
          icone={<ICONE.nivel size={12} />}
          tom={estado.rotaConcluida ? "vida" : "neutro"}
        />
      </div>

      {/* O placar das automações só aparece quando há o que contar: uma linha de
          zeros ocuparia espaço para dizer que nada aconteceu. */}
      {p.ouroCompras || p.ouroVendas || p.ouroPokes ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border border-line bg-bg-soft px-3 py-2 text-[12px]">
          <span className="pix text-[10px] text-text-mute">nesta sessão</span>
          {p.bolasCompradas ? (
            <span className="flex items-center gap-1 text-text-dim">
              <Pokeball size={12} />
              {compact(p.bolasCompradas)} repostas
            </span>
          ) : null}
          {p.pocoesCompradas ? <span className="text-text-dim">{compact(p.pocoesCompradas)} poções</span> : null}
          {p.revivesComprados ? <span className="text-text-dim">{compact(p.revivesComprados)} revives</span> : null}
          {p.itensVendidos ? (
            <span className="flex items-center gap-1" style={{ color: TOM.vida }}>
              <ICONE.ouro size={12} />
              {compact(p.itensVendidos)} itens por <b>{compact(p.ouroVendas)}</b>
            </span>
          ) : null}
          {p.pokesVendidos ? (
            <span style={{ color: TOM.vida }}>
              {compact(p.pokesVendidos)} pokémons por <b>{compact(p.ouroPokes)}</b>
            </span>
          ) : null}
          {p.ouroCompras ? (
            <span style={{ color: TOM.ouro }}>−{compact(p.ouroCompras)} em compras</span>
          ) : null}
        </div>
      ) : null}

      {/* ---- os quatro cartões, alinhados ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao
          titulo="Time"
          altura={ALTURA}
          acao={
            <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void comandar("curar")}>
              curar na Joy
            </Button>
          }
        >
          {estado.caido ? (
            <Note tone="warn" className="mb-2">
              O líder desmaiou. O robô usa um Revive da bolsa; sem Revive, sai do campo, cura de graça
              e volta sozinho.
            </Note>
          ) : null}
          {estado.time.length === 0 ? (
            <Empty title="Time ainda não carregou" hint="Ele chega no primeiro ciclo da sessão." />
          ) : (
            <ul className="flex flex-col gap-2">
              {estado.time.map((t) => (
                <LinhaTime key={t.id} p={t} ocupado={ocupado} comandar={comandar} onFicha={onFicha} />
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao
          titulo="Ao vivo"
          altura={ALTURA}
          acao={
            estado.campoVivo ? (
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: TOM.vida }}>
                <Pokeball size={12} spinning />
                caçando
              </span>
            ) : null
          }
        >
          {estado.eventos.length === 0 ? (
            <Empty
              title="Nada ainda"
              hint={estado.slug ? "Os primeiros abates aparecem em segundos." : "Comece uma caçada."}
            />
          ) : (
            <ul className="flex flex-col">
              {estado.eventos.map((e, i) => {
                const l = LINHA[e.tipo];
                return (
                  <li
                    key={`${e.em}-${i}`}
                    className="flex items-center gap-2 border-b border-line/60 py-1.5 text-[13px] last:border-0"
                  >
                    {e.speciesId ? (
                      <Sprite src={spriteUrl(e.speciesId, e.shiny)} alt="" size={24} />
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                        <Pokeball size={14} />
                      </span>
                    )}
                    <span className="pix shrink-0 text-[10px]" style={{ color: l.cor }}>
                      {l.texto}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-text">
                      {e.especie}
                      {e.shiny ? <b className="ml-1 text-warn">shiny</b> : null}
                    </span>
                    <span
                      className="shrink-0 text-[11px] tabular"
                      style={{
                        color:
                          e.ouro != null
                            ? e.ouro < 0
                              ? TOM.ouro
                              : TOM.vida
                            : e.xp > 0
                              ? TOM.xp
                              : "var(--color-text-mute)",
                      }}
                    >
                      {e.ouro != null
                        ? `${e.ouro < 0 ? "−" : "+"}${compact(Math.abs(e.ouro))}`
                        : e.xp > 0
                          ? `+${compact(e.xp)} xp`
                          : (e.bola ?? "")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        <Cartao
          titulo="Fila de captura"
          altura={ALTURA}
          acao={<span className="pix text-[11px] text-text-mute">{estado.fila.length} corpos</span>}
        >
          {estado.fila.length === 0 ? (
            <Empty
              title="Fila vazia"
              hint="Os corpos entram aqui a cada abate e saem conforme o auto-catch processa."
            />
          ) : (
            <ul className="flex flex-wrap content-start gap-2">
              {estado.fila.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-1.5 border border-line bg-bg-soft px-2 py-1"
                  style={f.shiny ? { borderColor: "color-mix(in srgb, var(--color-warn) 55%, transparent)" } : undefined}
                  title={`${f.nome} nv ${f.level}`}
                >
                  <Sprite src={spriteUrl(f.speciesId, f.shiny)} alt="" size={22} />
                  <span className="pix text-[10px] text-text-mute">nv {f.level}</span>
                  {f.shiny ? <span className="pix text-[10px] text-warn">shiny</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao
          titulo="Drops desta caçada"
          altura={ALTURA}
          acao={
            drops.length ? (
              <span className="flex items-center gap-1 text-[11px] tabular" style={{ color: TOM.ouro }}>
                <ICONE.ouro size={12} />
                {compact(ouroDrops)}
              </span>
            ) : null
          }
        >
          {drops.length === 0 ? (
            <Empty
              title="Nada caiu ainda"
              hint={estado.slug ? "O analyzer conta a partir do primeiro abate." : "Comece uma caçada."}
            />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {[...drops]
                .sort((x, y) => y.gold - x.gold)
                .map((d) => (
                  <li key={d.itemId} className="flex items-center gap-2 text-[13px]">
                    {d.icone ? (
                      <Sprite src={d.icone} alt="" size={22} />
                    ) : (
                      <span className="h-[22px] w-[22px] shrink-0 border border-line" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-text">{d.name}</span>
                      <Medidor
                        valor={d.gold}
                        max={ouroDrops || 1}
                        compacto
                        tom="ouro"
                        className="mt-0.5"
                      />
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[11px] tabular text-text-mute">{compact(d.qty)}x</span>
                      <b className="block text-[11px] tabular" style={{ color: TOM.ouro }}>
                        {compact(d.gold)}
                      </b>
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Cartao>
      </div>

    </div>
  );
}
