"use client";

import { useEffect, useState } from "react";
import { Button, Empty, Loading, Note, Segmented, Select, Sprite } from "@/components/ui";
import { compact } from "@/lib/labels";
import { spriteUrl } from "@/lib/sprites";
import { Cartao, ICONE, Medidor, TOM } from "@/components/robo/pecas";
import type {
  ConfigAuto,
  EstadoHunt,
  PassoRota,
  Recomendacao,
} from "@/lib/robo/motor/tipos";

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
}: {
  estado: EstadoHunt;
  config: ConfigAuto;
  onConfig: (cfg: ConfigAuto) => Promise<void>;
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

  const objetivo = config.objetivo;
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

  return (
    <Cartao
      titulo="Objetivo"
      altura={0}
      acao={
        <Segmented
          value={objetivo}
          onChange={(v) => void onConfig({ ...config, objetivo: v })}
          size="sm"
          options={[
            { value: "nenhum", label: "manual" },
            { value: "dolares", label: "mais dinheiro" },
            { value: "nivel", label: "subir de nível" },
          ]}
        />
      }
    >
      {objetivo === "nenhum" ? (
        <Note>
          O robô caça onde você mandar e não troca por conta. Escolha um objetivo acima para ele
          decidir o alvo e o líder sozinho.
        </Note>
      ) : null}

      {/* ---------------- mais dinheiro ---------------- */}
      {objetivo === "dolares" ? (
        carregando && !pares.length ? (
          <Loading />
        ) : pares.length === 0 ? (
          <Note tone="warn">
            Preciso do seu time para calcular. Ligue o robô uma vez para eu ler quem está nele.
          </Note>
        ) : (
          <div className="flex flex-col gap-3">
            <Note>
              O robô troca de líder e de caçada sozinho para o par que mais paga, e refaz a conta a
              cada dez minutos. Alvo letal fica de fora: ele lidera o ouro por hora até o primeiro
              desmaio, e aí a média real vira zero.
            </Note>
            <ul className="flex flex-col gap-1">
              {pares.map((r, i) => (
                <LinhaPar key={r.pokeId} r={r} atual={i === 0} />
              ))}
            </ul>
          </div>
        )
      ) : null}

      {/* ---------------- subir de nível ---------------- */}
      {objetivo === "nivel" ? (
        <div className="flex flex-col gap-3">
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
                        <span className="shrink-0 text-[11px] tabular text-text-mute">nv {p.level}</span>
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
              <p className="mt-1.5 text-[11px] text-text-mute">
                {Math.round(progresso.feito * 100)}% do caminho, desde o nível {progresso.inicio}.
                {estado.passoAtual ? ` Agora em ${estado.passoAtual.alvo}.` : ""}
              </p>
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
                    <span className="pix w-16 shrink-0 text-[10px]" style={{ color: RISCO[p.risco]?.cor }}>
                      {RISCO[p.risco]?.texto}
                    </span>
                    <span className="w-20 shrink-0 text-right text-[11px] tabular" style={{ color: TOM.xp }}>
                      {compact(p.xpH)} xp/h
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {objetivo !== "nenhum" && !estado.conectado ? (
        <Note tone="warn" className="mt-3">
          Ligue o robô no topo: o objetivo só corre com a sessão do jogo aberta.
        </Note>
      ) : null}

      {objetivo !== "nenhum" ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-text-mute">
          <ICONE.abates size={12} />
          {estado.slug ? (
            <>
              Caçando em <b className="text-text-dim">{estado.slug}</b> por decisão do objetivo.
            </>
          ) : estado.conectado ? (
            "Escolhendo o alvo…"
          ) : (
            "Ligue o robô no topo para o objetivo começar."
          )}
        </p>
      ) : null}
    </Cartao>
  );
}
