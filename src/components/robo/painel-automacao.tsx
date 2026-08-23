"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Checkbox, Empty, Loading, Note, NumberField, Panel, Select, Sprite, Switch } from "@/components/ui";
import { compact } from "@/lib/labels";
import type { ConfigAuto, EstadoAuto, EstadoHunt } from "@/lib/robo/motor/tipos";

/**
 * A aba que transforma "uma conexão aberta numa hunt" em robô.
 *
 * As automações vivem em duas camadas que o painel mantém separadas porque
 * falham de jeitos diferentes:
 *
 * - **No jogo** (Auto-Helper): captura, poção e revive automáticos. O servidor do
 *   jogo é quem executa. Se o `autoCatch` não liga, o motivo é o VIP do jogo, e a
 *   tela diz isso em vez de deixar a culpa cair no robô.
 * - **No robô**: repor consumível e vender. São chamadas REST nossas, não
 *   disputam a sessão de jogo, e rodam com a caçada correndo.
 *
 * Nenhuma nasce ligada. Toda automação daqui gasta ouro ou destrói pokémon.
 */

const COR = "var(--color-t-robo)";

interface ItemMochila {
  id: number;
  nome: string;
  icone: string;
  quantidade: number;
  precoNpc: number;
  categoria: string;
}
interface Loja {
  ouro: number;
  bolas: { id: number; nome: string; preco: number; icone: string }[];
  itens: { id: number; nome: string; preco: number; icone: string; categoria: string }[];
}

function Secao({
  titulo,
  hint,
  children,
  acao,
}: {
  titulo: string;
  hint?: string;
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="pix text-[13px] text-text-dim">{titulo}</h2>
          {hint ? <p className="mt-1 max-w-prose text-[12px] text-text-mute">{hint}</p> : null}
        </div>
        {acao}
      </div>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </Panel>
  );
}

/** Piso e alvo, na mesma linha, porque a decisão é a faixa e não os dois números. */
function Faixa({
  piso,
  alvo,
  onPiso,
  onAlvo,
  unidade,
}: {
  piso: number;
  alvo: number;
  onPiso: (n: number) => void;
  onAlvo: (n: number) => void;
  unidade: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="pix text-[10px] text-text-mute">abaixo de</span>
        <NumberField value={piso} onChange={onPiso} min={0} max={100000} className="w-28" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="pix text-[10px] text-text-mute">repõe até</span>
        <NumberField value={alvo} onChange={onAlvo} min={1} max={100000} className="w-28" />
      </label>
      <span className="pb-2 text-[12px] text-text-mute">{unidade}</span>
    </div>
  );
}

export function AbaAutomacao({
  estado,
  config,
  onConfig,
  erro,
}: {
  estado: EstadoHunt;
  config: ConfigAuto;
  onConfig: (patch: Partial<ConfigAuto>) => Promise<void>;
  erro: string | null;
}) {
  const [loja, setLoja] = useState<Loja | null>(null);
  const [mochila, setMochila] = useState<ItemMochila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [auto, setAuto] = useState<EstadoAuto | null>(estado.auto);
  const [salvandoAuto, setSalvandoAuto] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  // O frame `autohelper` chega pela sessão e é mais fresco que o GET: quando ele
  // vier, ele manda.
  useEffect(() => {
    if (estado.auto) setAuto(estado.auto);
  }, [estado.auto]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [l, a] = await Promise.all([
        fetch("/api/robo/loja").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/robo/auto").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!vivo) return;
      if (l) {
        setLoja(l.loja as Loja);
        setMochila((l.mochila ?? []) as ItemMochila[]);
      }
      if (a?.auto) setAuto(a.auto as EstadoAuto);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const mudarAuto = useCallback(async (patch: Partial<Record<string, number | boolean>>) => {
    setSalvandoAuto(true);
    setRecado(null);
    try {
      const res = await fetch("/api/robo/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = (await res.json().catch(() => ({}))) as { auto?: EstadoAuto; erro?: string };
      if (!res.ok) {
        setRecado(j.erro === "jogo_recusou" ? "o jogo recusou essa mudança" : "não consegui salvar no jogo");
        return;
      }
      if (j.auto) setAuto(j.auto);
    } finally {
      setSalvandoAuto(false);
    }
  }, []);

  const bolasOpcoes = (loja?.bolas ?? []).map((b) => ({
    value: String(b.id),
    label: `${b.nome} · ${compact(b.preco)} ouro`,
  }));
  const pocoes = (loja?.itens ?? []).filter((i) => i.categoria === "heal");
  const revives = (loja?.itens ?? []).filter((i) => i.categoria === "revive");

  const estoqueBolas = estado.bolas.reduce((s, b) => (b.infinita ? s : s + b.quantidade), 0);

  if (carregando) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      {erro ? <Note tone="danger">{erro}</Note> : null}
      {recado ? <Note tone="danger">{recado}</Note> : null}

      {/* ------------------------------------------------------------------ */}
      <Secao
        titulo="Automação do jogo"
        hint="Captura, poção e revive automáticos rodam no servidor do jogo. O robô só liga o interruptor e mantém a bolsa cheia."
      >
        {!auto ? (
          <Note tone="warn">Não consegui ler a configuração do jogo. Reconecte a conta.</Note>
        ) : (
          <>
            {!auto.vipNoJogo ? (
              <Note tone="warn">
                A captura automática é recurso VIP do jogo, e esta conta não tem. O interruptor abaixo
                não vai pegar até o VIP entrar lá.
              </Note>
            ) : null}

            <Switch
              checked={auto.autoCatch}
              disabled={salvandoAuto}
              onChange={(e) => void mudarAuto({ autoCatch: e.currentTarget.checked })}
              label="capturar sozinho"
              hint="o jogo joga a bola nos corpos da fila"
            />

            {auto.autoCatch ? (
              <label className="flex max-w-sm flex-col gap-1">
                <span className="pix text-[10px] text-text-mute">bola da captura</span>
                <Select
                  value={String(auto.autoCatchBallId || "")}
                  onChange={(v) => void mudarAuto({ autoCatchBallId: Number(v) })}
                  options={bolasOpcoes}
                  placeholder="escolha a bola"
                  disabled={salvandoAuto}
                />
              </label>
            ) : null}

            <Switch
              checked={auto.autoCatchShiny}
              disabled={salvandoAuto}
              onChange={(e) => void mudarAuto({ autoCatchShiny: e.currentTarget.checked })}
              label="bola separada para shiny"
              hint="gasta a bola boa só no que vale"
            />
            {auto.autoCatchShiny ? (
              <label className="flex max-w-sm flex-col gap-1">
                <span className="pix text-[10px] text-text-mute">bola do shiny</span>
                <Select
                  value={String(auto.autoCatchShinyBallId || "")}
                  onChange={(v) => void mudarAuto({ autoCatchShinyBallId: Number(v) })}
                  options={bolasOpcoes}
                  placeholder="escolha a bola"
                  disabled={salvandoAuto}
                />
              </label>
            ) : null}

            <Switch
              checked={auto.autoPotion}
              disabled={salvandoAuto}
              onChange={(e) => void mudarAuto({ autoPotion: e.currentTarget.checked })}
              label="usar poção sozinho"
              hint="antes de desmaiar, que custa a caçada inteira"
            />
            {auto.autoPotion ? (
              <label className="flex flex-col gap-1">
                <span className="pix text-[10px] text-text-mute">usa quando a vida cair abaixo de</span>
                <div className="flex items-center gap-2">
                  <NumberField
                    value={auto.autoPotionThreshold}
                    onChange={(n) => void mudarAuto({ autoPotionThreshold: n })}
                    min={0}
                    max={100}
                    className="w-24"
                  />
                  <span className="text-[12px] text-text-mute">% da vida</span>
                </div>
              </label>
            ) : null}

            <Switch
              checked={auto.autoRevive}
              disabled={salvandoAuto}
              onChange={(e) => void mudarAuto({ autoRevive: e.currentTarget.checked })}
              label="usar revive sozinho"
              hint="o robô também levanta o líder por conta, com ou sem isto"
            />
          </>
        )}
      </Secao>

      {/* ------------------------------------------------------------------ */}
      <Secao
        titulo="Reposição"
        hint="Bola zerada trava a fila de captura do jogo. Uma caçada boa queima centenas por hora."
        acao={
          <span className="pix text-[11px] text-text-mute">
            {estoqueBolas > 0 ? `${compact(estoqueBolas)} bolas na bolsa` : "bolsa sem bolas"}
          </span>
        }
      >
        <Switch
          checked={config.comprarBola}
          onChange={(e) => void onConfig({ comprarBola: e.currentTarget.checked })}
          label="repor bolas"
        />
        {config.comprarBola ? (
          <>
            <Faixa
              piso={config.pisoBola}
              alvo={config.alvoBola}
              onPiso={(n) => void onConfig({ pisoBola: n })}
              onAlvo={(n) => void onConfig({ alvoBola: n })}
              unidade="bolas"
            />
            <label className="flex max-w-sm flex-col gap-1">
              <span className="pix text-[10px] text-text-mute">qual bola</span>
              <Select
                value={String(config.bolaId ?? "")}
                onChange={(v) => void onConfig({ bolaId: v ? Number(v) : null })}
                options={[{ value: "", label: "a mais barata da loja" }, ...bolasOpcoes]}
              />
            </label>
          </>
        ) : null}

        <Switch
          checked={config.comprarPocao}
          onChange={(e) => void onConfig({ comprarPocao: e.currentTarget.checked })}
          label="repor poções"
        />
        {config.comprarPocao ? (
          <>
            <Faixa
              piso={config.pisoPocao}
              alvo={config.alvoPocao}
              onPiso={(n) => void onConfig({ pisoPocao: n })}
              onAlvo={(n) => void onConfig({ alvoPocao: n })}
              unidade="poções"
            />
            <label className="flex max-w-sm flex-col gap-1">
              <span className="pix text-[10px] text-text-mute">qual poção</span>
              <Select
                value={String(config.pocaoId ?? "")}
                onChange={(v) => void onConfig({ pocaoId: v ? Number(v) : null })}
                options={[
                  { value: "", label: "a mais barata da loja" },
                  ...pocoes.map((i) => ({ value: String(i.id), label: `${i.nome} · ${compact(i.preco)} ouro` })),
                ]}
              />
            </label>
          </>
        ) : null}

        <Switch
          checked={config.comprarRevive}
          onChange={(e) => void onConfig({ comprarRevive: e.currentTarget.checked })}
          label="repor revives"
        />
        {config.comprarRevive ? (
          <>
            <Faixa
              piso={config.pisoRevive}
              alvo={config.alvoRevive}
              onPiso={(n) => void onConfig({ pisoRevive: n })}
              onAlvo={(n) => void onConfig({ alvoRevive: n })}
              unidade="revives"
            />
            <label className="flex max-w-sm flex-col gap-1">
              <span className="pix text-[10px] text-text-mute">qual revive</span>
              <Select
                value={String(config.reviveId ?? "")}
                onChange={(v) => void onConfig({ reviveId: v ? Number(v) : null })}
                options={[
                  { value: "", label: "o mais barato da loja" },
                  ...revives.map((i) => ({ value: String(i.id), label: `${i.nome} · ${compact(i.preco)} ouro` })),
                ]}
              />
            </label>
          </>
        ) : null}

        <label className="flex max-w-xs flex-col gap-1 border-t border-line pt-3">
          <span className="pix text-[10px] text-text-mute">gasto máximo por rodada</span>
          <NumberField
            value={config.tetoOuro}
            onChange={(n) => void onConfig({ tetoOuro: n })}
            min={0}
            max={100000000}
            grouped
          />
          <span className="text-[11px] text-text-mute">
            O robô nunca gasta além disso de uma vez, mesmo com a conta cheia.
          </span>
        </label>
      </Secao>

      {/* ------------------------------------------------------------------ */}
      <Secao
        titulo="Venda de drop"
        hint="Marque o que pode sair. O que não estiver marcado fica na mochila, inclusive item que o jogo lançar depois."
      >
        <Switch
          checked={config.venderDrop}
          disabled={!config.dropIds.length}
          onChange={(e) => void onConfig({ venderDrop: e.currentTarget.checked })}
          label="vender os itens marcados"
          hint={config.dropIds.length ? undefined : "marque pelo menos um item abaixo"}
        />

        {mochila.length === 0 ? (
          <Empty title="Mochila vazia" hint="Os drops aparecem aqui depois dos primeiros abates." />
        ) : (
          <ul className="grid max-h-[360px] gap-1 overflow-y-auto sm:grid-cols-2">
            {mochila.map((i) => {
              const marcado = config.dropIds.includes(i.id);
              return (
                <li key={i.id} className="flex items-center gap-2 border border-line bg-bg-soft px-2 py-1.5">
                  <Checkbox
                    checked={marcado}
                    onChange={() =>
                      void onConfig({
                        dropIds: marcado
                          ? config.dropIds.filter((x) => x !== i.id)
                          : [...config.dropIds, i.id],
                      })
                    }
                  />
                  {i.icone ? <Sprite src={i.icone} alt="" size={20} /> : null}
                  <span className="min-w-0 flex-1 truncate text-[13px] text-text">{i.nome}</span>
                  <span className="shrink-0 text-[11px] tabular text-text-mute">
                    {compact(i.quantidade)}x · {compact(i.quantidade * i.precoNpc)} ouro
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      {/* ------------------------------------------------------------------ */}
      <Secao
        titulo="Venda de pokémon"
        hint="Vender é irreversível. O robô só vende o que passa por todos os filtros abaixo, e nunca toca no time, no líder, no inicial nem no que está cadeado."
      >
        <Switch
          checked={config.venderPoke}
          onChange={(e) => void onConfig({ venderPoke: e.currentTarget.checked })}
          label="vender o que o box acumula"
        />
        {config.venderPoke ? (
          <>
            <Note tone="warn">
              Com isto ligado, o robô vende sozinho todo pokémon do box abaixo dos limites. Confira os
              números antes de sair da tela.
            </Note>
            <Switch
              checked={config.manterShiny}
              onChange={(e) => void onConfig({ manterShiny: e.currentTarget.checked })}
              label="nunca vender shiny"
            />
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="pix text-[10px] text-text-mute">fica com IV a partir de</span>
                <NumberField
                  value={config.ivMinimo}
                  onChange={(n) => void onConfig({ ivMinimo: n })}
                  min={0}
                  max={186}
                  className="w-28"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="pix text-[10px] text-text-mute">fica com nível a partir de</span>
                <NumberField
                  value={config.nivelMinimo}
                  onChange={(n) => void onConfig({ nivelMinimo: n })}
                  min={1}
                  max={1000}
                  className="w-28"
                />
              </label>
            </div>
          </>
        ) : null}
      </Secao>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={!estado.conectado}
          onClick={() => void fetch("/api/robo/agora", { method: "POST" })}
        >
          rodar as automações agora
        </Button>
        <span className="text-[12px] text-text-mute">
          {estado.conectado
            ? "Roda uma vez, sem esperar a varredura de minuto."
            : "Ligue o robô para poder testar."}
        </span>
      </div>
    </div>
  );
}
