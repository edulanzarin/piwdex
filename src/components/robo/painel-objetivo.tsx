"use client";

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button, Combobox, Loading, Note, Segmented, Select, Sprite } from "@/components/ui";
import { Pokeball } from "@/components/ui/pokeball";
import { compact } from "@/lib/labels";
import { spriteUrl } from "@/lib/sprites";
import { Cartao, ICONE, Medidor, TOM } from "@/components/robo/pecas";
import type { ConfigAuto, EstadoHunt, PassoRota, Recomendacao } from "@/lib/robo/motor/tipos";
import type { HuntOpcao } from "@/components/robo/painel-tool";

type Modo = "manual" | "dolares" | "nivel";

/**
 * O que o robô deve perseguir.
 *
 * Aqui é onde "quero mais dinheiro" e "sobe esse até 200" viram conta. Os dois
 * são OBJETIVOS e não interruptores independentes, porque disputam a mesma
 * coisa: quem é o líder e em que campo ele está. Dois ligados ao mesmo tempo
 * brigariam pelo mesmo comando a cada varredura.
 *
 * A recomendação aparece ANTES de ligar. Decidir se concorda com o plano depois
 * de o robô começar a segui-lo é a ordem errada para algo que joga sozinho por
 * horas.
 */

const RISCO: Record<string, { texto: string; cor: string }> = {
  safe: { texto: "seguro", cor: TOM.vida },
  risky: { texto: "arriscado", cor: TOM.ouro },
  deadly: { texto: "letal", cor: TOM.perigo },
};

function LinhaPar({ r, atual }: { r: Recomendacao; atual: boolean }) {
  return (
    <li
      className="flex h-14 items-center gap-2 border bg-bg-soft px-2"
      style={{
        borderColor: atual
          ? "color-mix(in srgb, var(--color-t-robo) 55%, transparent)"
          : "var(--color-line)",
      }}
    >
      <Sprite src={spriteUrl(r.speciesId)} alt="" size={30} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <b className="truncate text-[13px] text-text">{r.nome}</b>
          <span className="pix text-[10px] text-text-mute">nv {r.level}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-text-mute">
          <span className="truncate">caçando {r.alvo}</span>
          <span className="pix shrink-0 text-[10px]" style={{ color: RISCO[r.risco]?.cor }}>
            {RISCO[r.risco]?.texto}
          </span>
        </span>
      </span>
      <Sprite src={spriteUrl(r.alvoSpeciesId)} alt="" size={26} />
      <span className="w-24 shrink-0 text-right">
        <b className="block text-[13px] tabular" style={{ color: TOM.ouro }}>
          {compact(r.goldH)}/h
        </b>
        <span className="block text-[11px] tabular" style={{ color: TOM.xp }}>
          {compact(r.xpH)} xp/h
        </span>
      </span>
    </li>
  );
}

export function PainelObjetivo({
  estado,
  config,
  onConfig,
  hunts,
  slug,
  setSlug,
  ocupado,
  comandar,
}: {
  estado: EstadoHunt;
  config: ConfigAuto;
  onConfig: (cfg: ConfigAuto) => Promise<void>;
  hunts: HuntOpcao[];
  slug: string;
  setSlug: Dispatch<SetStateAction<string>>;
  ocupado: boolean;
  comandar: (rota: string, corpo?: unknown) => Promise<void>;
}) {
  const [previa, setPrevia] = useState<Recomendacao[] | null>(null);
  const [rota, setRota] = useState<PassoRota[] | null>(null);
  const [erroRota, setErroRota] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  /**
   * O nível fica em rascunho até alguém pedir.
   *
   * Buscar a cada tecla montava uma rota para "5", outra para "50" e outra para
   * "500" — três planos, dois deles jogados fora, e a tela piscando entre eles
   * enquanto se digita.
   */
  const [nivelRascunho, setNivelRascunho] = useState(String(config.nivelAlvo));
  const [pedido, setPedido] = useState(0);

  /**
   * O modo é do OLHO; o objetivo é do robô.
   *
   * Antes, clicar em "mais dinheiro" já punha o robô no piloto, e o seletor de
   * caçada travava com um aviso mandando voltar para manual. Ver o plano e
   * mandar seguir viraram a mesma ação, e não são: olhar é de graça, delegar
   * não. Agora cada modo mostra o seu plano, e um botão explícito entrega o
   * comando.
   */
  const [modo, setModo] = useState<Modo>(config.objetivo === "nenhum" ? "manual" : config.objetivo);
  useEffect(() => {
    if (config.objetivo !== "nenhum") setModo(config.objetivo);
  }, [config.objetivo]);

  const seguindo = config.objetivo !== "nenhum";

  const objetivo = modo;
  const alvoEscolhido =
    estado.time.find((p) => p.id === config.pokeAlvo) ??
    estado.time.find((p) => p.leader) ??
    estado.time[0] ??
    null;

  // A prévia do par: só quando o objetivo é dinheiro e o robô ainda não calculou
  // por conta (a conta DELE manda, é a que ele vai seguir).
  useEffect(() => {
    if (objetivo !== "dolares" || estado.recomendacoes.length) {
      setPrevia(null);
      return;
    }
    let vivo = true;
    setCarregando(true);
    void fetch("/api/robo/objetivo")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { recomendacoes?: Recomendacao[] } | null) => {
        if (vivo) setPrevia(j?.recomendacoes ?? []);
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [objetivo, estado.recomendacoes.length]);

  // A prévia da subida, pelo mesmo motivo.
  useEffect(() => {
    setNivelRascunho(String(config.nivelAlvo));
  }, [config.nivelAlvo]);

  // Só busca quando pedem: `pedido` muda no clique, e é ele que dispara.
  useEffect(() => {
    if (objetivo !== "nivel" || estado.rota.length) {
      setRota(null);
      return;
    }
    let vivo = true;
    setCarregando(true);
    void (async () => {
      const res = await fetch(`/api/robo/rota?alvo=${config.nivelAlvo}`).catch(() => null);
      const j = (await res?.json().catch(() => null)) as
        | { passos?: PassoRota[]; erro?: string }
        | null;
      if (!vivo) return;
      setRota(j?.passos ?? []);
      setErroRota(res?.ok ? null : (j?.erro ?? "sem_rota"));
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [objetivo, config.nivelAlvo, config.pokeAlvo, estado.rota.length, pedido]);

  const nivelPedido = Math.max(2, Math.min(1000, Number(nivelRascunho) || 0));
  const sujo = nivelPedido !== config.nivelAlvo;

  async function aplicarNivel() {
    if (sujo) await onConfig({ ...config, nivelAlvo: nivelPedido });
    else setPedido((n) => n + 1);
  }

  const pares = estado.recomendacoes.length ? estado.recomendacoes : (previa ?? []);
  const passos = estado.rota.length ? estado.rota : (rota ?? []);

  const progresso = (() => {
    if (objetivo !== "nivel" || !passos.length || !alvoEscolhido) return null;
    const inicio = passos[0].de;
    if (config.nivelAlvo <= inicio) return null;
    const feito = Math.max(
      0,
      Math.min(1, (alvoEscolhido.level - inicio) / (config.nivelAlvo - inicio)),
    );
    const faltam = passos
      .filter((p) => p.ate > alvoEscolhido.level)
      .reduce((soma, p) => {
        const parte = p.de >= alvoEscolhido.level ? 1 : (p.ate - alvoEscolhido.level) / (p.ate - p.de);
        return soma + p.horas * parte;
      }, 0);
    return { feito, faltam, inicio };
  })();

  /** O comando de cada modo, num lugar só: ver o plano e mandar seguir são
   *  ações diferentes, e o botão é onde a segunda acontece. */
  async function seguir() {
    if (modo === "manual") return;
    await onConfig({ ...config, objetivo: modo });
  }
  async function soltar() {
    await onConfig({ ...config, objetivo: "nenhum" });
  }

  const opcoes = hunts.map((h) => ({
    value: h.slug,
    label: `${h.nome} · nv ${h.level}`,
    keywords: `${h.slug} ${h.area}`,
  }));

  return (
    <Cartao
      titulo="Caçada"
      icone={<Pokeball size={14} />}
      altura={0}
      acao={
        <span className="flex items-center gap-2">
          {seguindo ? (
            <span className="pix flex items-center gap-1.5 text-[10px]" style={{ color: TOM.vida }}>
              <ICONE.abates size={12} />
              no piloto
            </span>
          ) : null}
          <Segmented
            value={modo}
            onChange={setModo}
            size="sm"
            options={[
              { value: "manual", label: "manual" },
              { value: "dolares", label: "mais dinheiro" },
              { value: "nivel", label: "subir de nível" },
            ]}
          />
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        {/* ---------------- manual ---------------- */}
        {modo === "manual" ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-72">
                <span className="pix text-[10px] text-text-mute">onde caçar</span>
                <div className="mt-1">
                  <Combobox
                    value={slug}
                    onChange={(v) => setSlug(String(v))}
                    options={opcoes}
                    placeholder="Escolha onde caçar…"
                  />
                </div>
              </div>
              <Button
                size="lg"
                variant={estado.slug ? "outline" : "primary"}
                disabled={ocupado || !slug || !estado.conectado || estado.slug === slug}
                onClick={async () => {
                  if (seguindo) await soltar();
                  await comandar("cacar", { slug });
                }}
              >
                {estado.slug ? "trocar de caçada" : "começar a caçar"}
              </Button>
              {estado.slug ? (
                <Button
                  size="lg"
                  variant="danger"
                  disabled={ocupado}
                  onClick={async () => {
                    if (seguindo) await soltar();
                    await comandar("cacar", {});
                  }}
                >
                  parar a caçada
                </Button>
              ) : null}
            </div>
            {seguindo ? (
              <Note tone="warn">
                O piloto está ligado e vai trocar de caçada na próxima reavaliação. Começar uma
                caçada aqui desliga ele.
              </Note>
            ) : (
              <Note>Você escolhe a caçada, e o robô não troca por conta.</Note>
            )}
          </>
        ) : null}

        {/* ---------------- mais dinheiro ---------------- */}
        {modo === "dolares" ? (
          carregando && !pares.length ? (
            <Loading />
          ) : pares.length === 0 ? (
            <Note tone="warn">
              Preciso do seu time para calcular. Ligue o robô uma vez para eu ler quem está nele.
            </Note>
          ) : (
            <>
              <ul className="flex flex-col gap-1">
                {pares.map((r, i) => (
                  <LinhaPar key={r.pokeId} r={r} atual={i === 0} />
                ))}
              </ul>
              <Note>
                Alvo letal fica de fora: ele lidera o dinheiro por hora até o primeiro desmaio, e aí
                a média real vira zero.
              </Note>
            </>
          )
        ) : null}

        {/* ---------------- subir de nível ---------------- */}
        {modo === "nivel" ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
                <span className="pix text-[10px] text-text-mute">qual pokémon</span>
                <Select
                  value={config.pokeAlvo ?? ""}
                  onChange={(v) => void onConfig({ ...config, pokeAlvo: v || null })}
                  options={[
                    { value: "", label: "o líder de agora" },
                    ...estado.time.map((p) => ({
                      value: p.id,
                      label: `${p.name} · nv ${p.level}`,
                      render: (
                        <span className="flex min-w-0 items-center gap-2">
                          <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt="" size={18} />
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          <span className="shrink-0 text-[11px] tabular text-text-mute">
                            nv {p.level}
                          </span>
                        </span>
                      ),
                    })),
                  ]}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="pix text-[10px] text-text-mute">até o nível</span>
                <input
                  type="number"
                  min={2}
                  max={1000}
                  value={nivelRascunho}
                  onChange={(e) => setNivelRascunho(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void aplicarNivel();
                  }}
                  className="field w-28 tabular"
                />
              </label>
              <Button
                size="lg"
                variant={sujo ? "primary" : "outline"}
                disabled={carregando}
                onClick={() => void aplicarNivel()}
              >
                {sujo ? "montar a subida" : "refazer"}
              </Button>
            </div>

            {progresso ? (
              <div className="border border-line bg-bg-soft p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="pix text-[11px] text-text-mute">
                    {alvoEscolhido?.name}: nível {alvoEscolhido?.level} de {config.nivelAlvo}
                  </span>
                  <span className="text-[12px] tabular text-text-dim">
                    {estado.rotaConcluida
                      ? "meta alcançada"
                      : progresso.faltam < 1
                        ? "falta menos de uma hora"
                        : `faltam ~${Math.round(progresso.faltam)}h`}
                  </span>
                </div>
                <span className="mt-2 block">
                  <Medidor
                    valor={progresso.feito}
                    max={1}
                    tom={estado.rotaConcluida ? "vida" : "xp"}
                  />
                </span>
              </div>
            ) : null}

            {passos.length === 0 ? (
              <Note tone={erroRota === "sem_lider" ? "warn" : "muted"}>
                {erroRota === "sem_lider"
                  ? "Não sei qual é o seu time ainda. Ligue o robô uma vez para eu ler."
                  : erroRota === "ja_passou"
                    ? "Esse pokémon já passou do nível pedido. Escolha um alvo mais alto."
                    : erroRota
                      ? "Não consegui montar uma rota para este pokémon."
                      : "Montando a subida…"}
              </Note>
            ) : (
              <ul className="flex max-h-[240px] flex-col gap-1 overflow-y-auto">
                {passos.map((p) => {
                  const atual = estado.passoAtual?.slug === p.slug && estado.passoAtual?.de === p.de;
                  const passou = alvoEscolhido != null && alvoEscolhido.level >= p.ate;
                  return (
                    <li
                      key={`${p.de}-${p.slug}`}
                      className="flex h-11 items-center gap-2 border bg-bg-soft px-2"
                      style={{
                        borderColor: atual
                          ? "color-mix(in srgb, var(--color-t-robo) 55%, transparent)"
                          : "var(--color-line)",
                        opacity: passou ? 0.45 : 1,
                      }}
                    >
                      <Sprite src={spriteUrl(p.speciesId)} alt="" size={24} />
                      <span className="pix w-16 shrink-0 text-[10px] text-text-mute">
                        {p.de}–{p.ate}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{p.alvo}</span>
                      <span
                        className="pix w-16 shrink-0 text-[10px]"
                        style={{ color: RISCO[p.risco]?.cor }}
                      >
                        {RISCO[p.risco]?.texto}
                      </span>
                      <span
                        className="w-20 shrink-0 text-right text-[11px] tabular"
                        style={{ color: TOM.xp }}
                      >
                        {compact(p.xpH)} xp/h
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}

        {/* ---------------- o comando ---------------- */}
        {modo !== "manual" ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            {seguindo && config.objetivo === modo ? (
              <>
                <Button size="lg" variant="danger" onClick={() => void soltar()}>
                  parar o piloto
                </Button>
                <span className="text-[12px] text-text-dim">
                  {estado.slug ? (
                    <>
                      Caçando em <b className="text-text">{estado.slug}</b> por decisão do robô.
                    </>
                  ) : estado.conectado ? (
                    "Escolhendo o alvo…"
                  ) : (
                    "Ligue o robô no topo para começar."
                  )}
                </span>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="primary"
                  disabled={!estado.conectado || (modo === "nivel" ? !passos.length : !pares.length)}
                  onClick={() => void seguir()}
                >
                  seguir o plano
                </Button>
                <span className="text-[12px] text-text-mute">
                  {!estado.conectado
                    ? "Ligue o robô no topo primeiro."
                    : modo === "dolares"
                      ? "O robô troca de líder e de caçada sozinho, e refaz a conta a cada dez minutos."
                      : "O robô troca de caçada sozinho conforme o pokémon sobe, e para ao chegar na meta."}
                </span>
              </>
            )}
          </div>
        ) : null}
      </div>
    </Cartao>
  );
}
