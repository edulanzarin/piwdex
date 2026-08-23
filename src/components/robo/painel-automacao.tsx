"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Loading, Note, NumberField, Select, Sprite, Switch } from "@/components/ui";
import { Pokeball } from "@/components/ui/pokeball";
import { Secao } from "@/components/robo/pecas";
import { compact } from "@/lib/labels";
import type { BolaEstoque, EstadoAuto, EstadoHunt } from "@/lib/robo/motor/tipos";

/**
 * A aba do USO: o que o jogo faz sozinho com o que a conta já tem.
 *
 * Tudo aqui é o Auto-Helper — captura, poção e revive automáticos. Quem executa
 * é o **servidor do jogo**, e o robô só liga o interruptor. Isso muda o que a
 * tela precisa dizer: quando o `autoCatch` não pega, o motivo é o VIP do jogo, e
 * a tela fala isso em vez de deixar a culpa cair no robô.
 *
 * O que GASTA ouro — repor consumível, vender drop, vender pokémon — mora na aba
 * Loja. As duas camadas falham de jeitos diferentes (uma por regra do jogo, a
 * outra por saldo e por recusa de REST) e misturá-las numa aba só deixava a
 * decisão de quanto gastar a três rolagens da de quanto se recebe.
 */

function BolaSelect({
  valor,
  onMudar,
  bolas,
  desabilitado,
}: {
  valor: number;
  onMudar: (id: number) => void;
  bolas: BolaEstoque[];
  desabilitado: boolean;
}) {
  return (
    <Select
      value={String(valor || "")}
      onChange={(v) => onMudar(Number(v))}
      placeholder="escolha a bola"
      disabled={desabilitado}
      options={bolas.map((b) => ({
        value: String(b.id),
        label: b.infinita ? `${b.nome} · ilimitada` : `${b.nome} · ${compact(b.quantidade)} na bolsa`,
        render: (
          <span className="flex min-w-0 items-center gap-2">
            {b.icone ? <Sprite src={b.icone} alt="" size={18} /> : null}
            <span className="min-w-0 flex-1 truncate">{b.nome}</span>
            <span className="shrink-0 text-[11px] tabular text-text-mute">
              {b.infinita ? "∞" : compact(b.quantidade)}
            </span>
          </span>
        ),
      }))}
    />
  );
}

/** Um interruptor do jogo e o ajuste que ele carrega. `justify-between` porque
 *  dois dos quatro têm campo embaixo e dois não — sem isso a grade desenhava
 *  quatro alturas. */
function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-2 border border-line bg-bg-soft p-3">{children}</div>
  );
}

export function AbaAutomacao({ estado }: { estado: EstadoHunt }) {
  /**
   * Rascunho.
   *
   * Cada clique gravando na hora significava mandar um comando ao jogo por
   * caractere digitado no limiar da poção. A tela acumula a mudança e só age
   * quando alguém confirma.
   */
  const [auto, setAuto] = useState<EstadoAuto | null>(estado.auto);
  const [rascunho, setRascunho] = useState<EstadoAuto | null>(null);
  const [bolas, setBolas] = useState<BolaEstoque[]>(estado.bolas);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  // O frame `autohelper` chega pela sessão e é mais fresco que o GET: quando ele
  // vier, ele manda.
  useEffect(() => {
    if (estado.auto) setAuto(estado.auto);
  }, [estado.auto]);
  useEffect(() => {
    if (estado.bolas.length) setBolas(estado.bolas);
  }, [estado.bolas]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const a = (await fetch("/api/robo/auto")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as { auto?: EstadoAuto; bolas?: BolaEstoque[] } | null;
      if (!vivo) return;
      if (a?.auto) setAuto(a.auto);
      if (a?.bolas?.length) setBolas(a.bolas);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const mudar = useCallback(
    (patch: Partial<EstadoAuto>) => setRascunho((r) => ({ ...(r ?? auto)!, ...patch })),
    [auto],
  );

  const atual = rascunho ?? auto;

  /** O que mudou — só isso vai para o jogo. Mandar o estado inteiro faria uma
   *  recusa em qualquer campo derrubar a mudança que a pessoa pediu. */
  const patch = useMemo(() => {
    if (!rascunho || !auto) return {};
    const campos: (keyof EstadoAuto)[] = [
      "autoCatch", "autoCatchBallId", "autoCatchShiny", "autoCatchShinyBallId",
      "autoPotion", "autoPotionThreshold", "autoRevive",
    ];
    const out: Record<string, number | boolean> = {};
    for (const c of campos) if (rascunho[c] !== auto[c]) out[c] = rascunho[c] as number | boolean;
    return out;
  }, [rascunho, auto]);

  const sujo = Object.keys(patch).length > 0;

  async function salvar() {
    setSalvando(true);
    setRecado(null);
    try {
      const res = await fetch("/api/robo/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = (await res.json().catch(() => ({}))) as {
        auto?: EstadoAuto;
        bolas?: BolaEstoque[];
        erro?: string;
      };
      if (!res.ok) {
        setRecado(j.erro === "jogo_recusou" ? "o jogo recusou essa mudança" : "não consegui salvar no jogo");
        return;
      }
      if (j.auto) setAuto(j.auto);
      if (j.bolas?.length) setBolas(j.bolas);
      setRascunho(null);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      {recado ? <Note tone="danger">{recado}</Note> : null}

      <Secao
        titulo="Automação do jogo"
        icone={<Pokeball size={14} />}
        hint="Captura, poção e revive automáticos rodam no servidor do jogo — o robô só liga o interruptor. Manter a bolsa cheia é trabalho da aba Loja."
      >
        {!atual ? (
          <Note tone="warn">Não consegui ler a configuração do jogo. Reconecte a conta.</Note>
        ) : (
          <>
            {!atual.vipNoJogo ? (
              <Note tone="warn">
                A captura automática é recurso VIP do jogo, e esta conta não tem. O interruptor abaixo
                não vai pegar até o VIP entrar lá.
              </Note>
            ) : null}

            <div className="grid items-stretch gap-3 sm:grid-cols-2">
              <Cartao>
                <Switch
                  block
                  checked={atual.autoCatch}
                  disabled={salvando}
                  onChange={(e) => mudar({ autoCatch: e.currentTarget.checked })}
                  label="capturar sozinho"
                />
                {atual.autoCatch ? (
                  <BolaSelect
                    valor={atual.autoCatchBallId}
                    onMudar={(autoCatchBallId) => mudar({ autoCatchBallId })}
                    bolas={bolas}
                    desabilitado={salvando}
                  />
                ) : null}
              </Cartao>

              <Cartao>
                <Switch
                  block
                  checked={atual.autoCatchShiny}
                  disabled={salvando}
                  onChange={(e) => mudar({ autoCatchShiny: e.currentTarget.checked })}
                  label="bola separada para shiny"
                />
                {atual.autoCatchShiny ? (
                  <BolaSelect
                    valor={atual.autoCatchShinyBallId}
                    onMudar={(autoCatchShinyBallId) => mudar({ autoCatchShinyBallId })}
                    bolas={bolas}
                    desabilitado={salvando}
                  />
                ) : null}
              </Cartao>

              <Cartao>
                <Switch
                  block
                  checked={atual.autoPotion}
                  disabled={salvando}
                  onChange={(e) => mudar({ autoPotion: e.currentTarget.checked })}
                  label="usar poção sozinho"
                />
                {atual.autoPotion ? (
                  <label className="flex items-end gap-2">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="pix text-[10px] text-text-mute">usa abaixo de</span>
                      <NumberField
                        value={atual.autoPotionThreshold}
                        onChange={(n) => mudar({ autoPotionThreshold: n })}
                        min={0}
                        max={100}
                      />
                    </span>
                    <span className="pb-2 text-[11px] text-text-mute">% da vida</span>
                  </label>
                ) : null}
              </Cartao>

              <Cartao>
                <Switch
                  block
                  checked={atual.autoRevive}
                  disabled={salvando}
                  onChange={(e) => mudar({ autoRevive: e.currentTarget.checked })}
                  label="usar revive sozinho"
                />
              </Cartao>
            </div>
          </>
        )}
      </Secao>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-bg/95 px-1 py-3 backdrop-blur">
        <Button size="lg" variant="primary" disabled={!sujo || salvando} onClick={() => void salvar()}>
          {salvando ? "salvando…" : "salvar alterações"}
        </Button>
        <Button size="lg" variant="ghost" disabled={!sujo || salvando} onClick={() => setRascunho(null)}>
          descartar
        </Button>
        <span className="text-[12px]" style={{ color: sujo ? "var(--color-warn)" : "var(--color-text-mute)" }}>
          {sujo ? "Há alterações que ainda não foram aplicadas." : "Tudo salvo."}
        </span>
      </div>
    </div>
  );
}
