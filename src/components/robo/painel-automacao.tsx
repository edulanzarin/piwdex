"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Empty, Loading, Note, NumberField, Panel, Select, Sprite, Switch } from "@/components/ui";
import { Pokeball } from "@/components/ui/pokeball";
import { ICONE } from "@/components/robo/pecas";
import { compact, TIER_LABEL } from "@/lib/labels";
import { qualityTier, TIER_COLOR, TIER_MIN, TIER_ORDER } from "@/lib/rarity";
import type { BolaEstoque, ConfigAuto, EstadoAuto, EstadoHunt } from "@/lib/robo/motor/tipos";

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

/** Uma seção da automação. Usa o cabeçalho do `Panel`, como as fichas da dex —
 *  o `<h2>` solto dentro do corpo deixava o painel do robô liso ao lado delas. */
function Secao({
  titulo,
  icone,
  hint,
  children,
  acao,
}: {
  titulo: string;
  icone?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {icone}
          {titulo}
        </span>
      }
      actions={acao}
    >
      {hint ? <p className="mb-3 max-w-prose text-[12px] text-text-mute">{hint}</p> : null}
      <div className="flex flex-col gap-3">{children}</div>
    </Panel>
  );
}

/**
 * Um consumível e as três decisões que ele carrega: repor ou não, entre que
 * limites, e qual item.
 *
 * Cartão, e não uma pilha de campos soltos: os três consumíveis fazem a mesma
 * pergunta, e empilhá-los verticalmente obrigava a rolar para comparar bola com
 * poção. Lado a lado, a comparação é a leitura.
 */
function Consumivel({
  titulo,
  unidade,
  ligado,
  onLigar,
  piso,
  alvo,
  onPiso,
  onAlvo,
  itemId,
  onItem,
  opcoes,
  rotuloPadrao,
  estoque,
}: {
  titulo: string;
  unidade: string;
  ligado: boolean;
  onLigar: (v: boolean) => void;
  piso: number;
  alvo: number;
  onPiso: (n: number) => void;
  onAlvo: (n: number) => void;
  itemId: number | null;
  onItem: (n: number | null) => void;
  opcoes: { value: string; label: string }[];
  rotuloPadrao: string;
  estoque?: string;
}) {
  return (
    <div
      className="flex h-full flex-col gap-2 border border-line bg-bg-soft p-3 transition-colors"
      style={ligado ? { borderColor: "color-mix(in srgb, var(--color-t-robo) 45%, transparent)" } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <Switch
          block
          checked={ligado}
          onChange={(e) => onLigar(e.currentTarget.checked)}
          label={titulo}
          className="min-w-0 flex-1"
        />
        {estoque ? <span className="pix shrink-0 text-[10px] text-text-mute">{estoque}</span> : null}
      </div>

      {ligado ? (
        <>
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="pix text-[10px] text-text-mute">abaixo de</span>
              <NumberField value={piso} onChange={onPiso} min={0} max={100000} />
            </label>
            <span className="pb-2 text-[11px] text-text-mute">→</span>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="pix text-[10px] text-text-mute">repõe até</span>
              <NumberField value={alvo} onChange={onAlvo} min={1} max={100000} />
            </label>
            <span className="pb-2 text-[11px] text-text-mute">{unidade}</span>
          </div>
          <label className="flex flex-col gap-1">
            <span className="pix text-[10px] text-text-mute">qual</span>
            <Select
              value={String(itemId ?? "")}
              onChange={(v) => onItem(v ? Number(v) : null)}
              options={[{ value: "", label: rotuloPadrao }, ...opcoes]}
            />
          </label>
        </>
      ) : null}
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
  onConfig: (cfg: ConfigAuto) => Promise<void>;
  erro: string | null;
}) {
  /**
   * Rascunho.
   *
   * Antes, cada clique gravava e passava a valer na hora — inclusive um "vender
   * o que o box acumula" ligado por engano, que destrói pokémon e não desfaz. A
   * tela agora acumula a mudança e só age quando alguém confirma.
   *
   * A automação do JOGO (Auto-Helper) entra no mesmo rascunho, mesmo indo por
   * outra rota: para quem mexe, é tudo "as configurações do robô", e ter metade
   * salvando sozinha seria a pior das duas regras.
   */
  const [rascunho, setRascunho] = useState<ConfigAuto>(config);
  const [autoRascunho, setAutoRascunho] = useState<EstadoAuto | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [mochila, setMochila] = useState<ItemMochila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [auto, setAuto] = useState<EstadoAuto | null>(estado.auto);
  const [bolas, setBolas] = useState<BolaEstoque[]>(estado.bolas);
  const [salvandoAuto, setSalvandoAuto] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  // O frame `autohelper` chega pela sessão e é mais fresco que o GET: quando ele
  // vier, ele manda.
  useEffect(() => {
    if (estado.auto) setAuto(estado.auto);
  }, [estado.auto]);

  // O salvo mudou por fora (outra aba, o servidor corrigiu um valor): o rascunho
  // acompanha, MENOS quando há edição pendente — sobrescrever ali apagaria o que
  // a pessoa está digitando.
  const sujoRef = useRef(false);
  useEffect(() => {
    if (!sujoRef.current) setRascunho(config);
  }, [config]);
  useEffect(() => {
    if (estado.bolas.length) setBolas(estado.bolas);
  }, [estado.bolas]);

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
      if (a?.bolas?.length) setBolas(a.bolas as BolaEstoque[]);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /** Uma mudança entra no rascunho. Nada sai daqui para o servidor. */
  const mudar = useCallback((patch: Partial<ConfigAuto>) => {
    setRascunho((r) => ({ ...r, ...patch }));
  }, []);

  const mudarAutoLocal = useCallback((patch: Partial<EstadoAuto>) => {
    setAutoRascunho((a) => ({ ...(a ?? auto)!, ...patch }));
  }, [auto]);

  const autoAtual = autoRascunho ?? auto;

  /** O que mudou na automação do JOGO — só isso vai para lá. */
  const patchAuto = useMemo(() => {
    if (!autoRascunho || !auto) return {};
    const campos: (keyof EstadoAuto)[] = [
      "autoCatch", "autoCatchBallId", "autoCatchShiny", "autoCatchShinyBallId",
      "autoPotion", "autoPotionThreshold", "autoRevive",
    ];
    const out: Record<string, number | boolean> = {};
    for (const c of campos) {
      if (autoRascunho[c] !== auto[c]) out[c] = autoRascunho[c] as number | boolean;
    }
    return out;
  }, [autoRascunho, auto]);

  const sujo =
    JSON.stringify(rascunho) !== JSON.stringify(config) || Object.keys(patchAuto).length > 0;
  sujoRef.current = sujo;

  const mudarAuto = useCallback(async (patch: Partial<Record<string, number | boolean>>) => {
    setSalvandoAuto(true);
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
    } finally {
      setSalvandoAuto(false);
    }
  }, []);

  /**
   * Duas listas de bola, e a diferença é o que faz a Idle Ball aparecer.
   *
   * O auto-catch escolhe entre as bolas que a CONTA tem (`/api/game/balls`), que
   * inclui bola infinita e bola que não está à venda. A reposição escolhe entre
   * as bolas da LOJA, porque só se pode comprar o que está lá. Usar o catálogo da
   * loja para as duas coisas escondia a Idle Ball da captura automática.
   */
  async function salvar() {
    setSalvando(true);
    setRecado(null);
    try {
      if (Object.keys(patchAuto).length) await mudarAuto(patchAuto);
      if (JSON.stringify(rascunho) !== JSON.stringify(config)) await onConfig(rascunho);
      setAutoRascunho(null);
    } finally {
      setSalvando(false);
    }
  }

  function descartar() {
    setRascunho(config);
    setAutoRascunho(null);
    setRecado(null);
  }

  const bolasDaConta = (bolas.length ? bolas : estado.bolas).map((b) => ({
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
  }));

  const bolasDaLoja = (loja?.bolas ?? []).map((b) => ({
    value: String(b.id),
    label: `${b.nome} · ${compact(b.preco)} dólares`,
    render: (
      <span className="flex min-w-0 items-center gap-2">
        {b.icone ? <Sprite src={b.icone} alt="" size={18} /> : null}
        <span className="min-w-0 flex-1 truncate">{b.nome}</span>
        <span className="shrink-0 text-[11px] tabular text-text-mute">{compact(b.preco)}</span>
      </span>
    ),
  }));

  const comIcone = (i: { id: number; nome: string; preco: number; icone: string }) => ({
    value: String(i.id),
    label: `${i.nome} · ${compact(i.preco)} dólares`,
    render: (
      <span className="flex min-w-0 items-center gap-2">
        {i.icone ? <Sprite src={i.icone} alt="" size={18} /> : null}
        <span className="min-w-0 flex-1 truncate">{i.nome}</span>
        <span className="shrink-0 text-[11px] tabular text-text-mute">{compact(i.preco)}</span>
      </span>
    ),
  });
  const pocoes = (loja?.itens ?? []).filter((i) => i.categoria === "heal");
  const revives = (loja?.itens ?? []).filter((i) => i.categoria === "revive");

  const estoqueBolas = estado.bolas.reduce((s, b) => (b.infinita ? s : s + b.quantidade), 0);
  // Quanto de ouro esta parado no que ja foi marcado: e o numero que responde
  // "vale a pena ligar isso?", e sem ele a lista e so uma lista de nomes.
  const rendeMarcado = mochila
    .filter((i) => config.dropIds.includes(i.id))
    .reduce((soma, i) => soma + i.quantidade * i.precoNpc, 0);

  if (carregando) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      {erro ? <Note tone="danger">{erro}</Note> : null}
      {recado ? <Note tone="danger">{recado}</Note> : null}

      {/* Duas colunas a partir de xl: as quatro seções são independentes, e
          empilhadas obrigavam a rolar a tela inteira para comparar o que o robô
          gasta com o que ele recolhe. */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          {/* ---------------- automação do jogo ---------------- */}
          <Secao
            titulo="Automação do jogo"
            icone={<Pokeball size={14} />}
            hint="Captura, poção e revive automáticos rodam no servidor do jogo. O robô liga o interruptor e mantém a bolsa cheia."
          >
            {!autoAtual ? (
              <Note tone="warn">Não consegui ler a configuração do jogo. Reconecte a conta.</Note>
            ) : (
              <>
                {!autoAtual.vipNoJogo ? (
                  <Note tone="warn">
                    A captura automática é recurso VIP do jogo, e esta conta não tem. O interruptor
                    abaixo não vai pegar até o VIP entrar lá.
                  </Note>
                ) : null}

                {/* `items-stretch` + `justify-between`: os quatro cartões têm
                    conteúdo de tamanhos diferentes (dois têm campo embaixo, dois
                    não) e sem isso a grade desenhava quatro alturas. */}
                <div className="grid items-stretch gap-3 sm:grid-cols-2">
                  <div className="flex flex-col justify-between gap-2 border border-line bg-bg-soft p-3">
                    <Switch
                      block
                      checked={autoAtual.autoCatch}
                      disabled={salvandoAuto}
                      onChange={(e) => mudarAutoLocal({ autoCatch: e.currentTarget.checked })}
                      label="capturar sozinho"
                    />
                    {autoAtual.autoCatch ? (
                      <Select
                        value={String(autoAtual.autoCatchBallId || "")}
                        onChange={(v) => mudarAutoLocal({ autoCatchBallId: Number(v) })}
                        options={bolasDaConta}
                        placeholder="escolha a bola"
                        disabled={salvandoAuto}
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-col justify-between gap-2 border border-line bg-bg-soft p-3">
                    <Switch
                      block
                      checked={autoAtual.autoCatchShiny}
                      disabled={salvandoAuto}
                      onChange={(e) => mudarAutoLocal({ autoCatchShiny: e.currentTarget.checked })}
                      label="bola separada para shiny"
                    />
                    {autoAtual.autoCatchShiny ? (
                      <Select
                        value={String(autoAtual.autoCatchShinyBallId || "")}
                        onChange={(v) => mudarAutoLocal({ autoCatchShinyBallId: Number(v) })}
                        options={bolasDaConta}
                        placeholder="escolha a bola"
                        disabled={salvandoAuto}
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-col justify-between gap-2 border border-line bg-bg-soft p-3">
                    <Switch
                      block
                      checked={autoAtual.autoPotion}
                      disabled={salvandoAuto}
                      onChange={(e) => mudarAutoLocal({ autoPotion: e.currentTarget.checked })}
                      label="usar poção sozinho"
                    />
                    {autoAtual.autoPotion ? (
                      <label className="flex items-end gap-2">
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="pix text-[10px] text-text-mute">usa abaixo de</span>
                          <NumberField
                            value={autoAtual.autoPotionThreshold}
                            onChange={(n) => mudarAutoLocal({ autoPotionThreshold: n })}
                            min={0}
                            max={100}
                          />
                        </span>
                        <span className="pb-2 text-[11px] text-text-mute">% da vida</span>
                      </label>
                    ) : null}
                  </div>

                  <div className="flex flex-col justify-between gap-2 border border-line bg-bg-soft p-3">
                    <Switch
                      block
                      checked={autoAtual.autoRevive}
                      disabled={salvandoAuto}
                      onChange={(e) => mudarAutoLocal({ autoRevive: e.currentTarget.checked })}
                      label="usar revive sozinho"
                    />
                  </div>
                </div>
              </>
            )}
          </Secao>

          {/* ---------------- reposição ---------------- */}
          <Secao
            titulo="Reposição"
            icone={<ICONE.ouro size={14} />}
            hint="Bola zerada trava a fila de captura do jogo. Uma caçada boa queima centenas por hora."
            acao={
              <span className="pix text-[11px]" style={{ color: estoqueBolas ? "var(--color-text-mute)" : "var(--color-danger)" }}>
                {estoqueBolas > 0 ? `${compact(estoqueBolas)} bolas na bolsa` : "bolsa sem bolas"}
              </span>
            }
          >
            <div className="grid items-stretch gap-3 sm:grid-cols-3">
              <Consumivel
                titulo="bolas"
                unidade="un"
                estoque={estoqueBolas ? compact(estoqueBolas) : undefined}
                ligado={rascunho.comprarBola}
                onLigar={(v) => mudar({ comprarBola: v })}
                piso={rascunho.pisoBola}
                alvo={rascunho.alvoBola}
                onPiso={(n) => mudar({ pisoBola: n })}
                onAlvo={(n) => mudar({ alvoBola: n })}
                itemId={rascunho.bolaId}
                onItem={(n) => mudar({ bolaId: n })}
                opcoes={bolasDaLoja}
                rotuloPadrao="a mais barata da loja"
              />
              <Consumivel
                titulo="poções"
                unidade="un"
                ligado={rascunho.comprarPocao}
                onLigar={(v) => mudar({ comprarPocao: v })}
                piso={rascunho.pisoPocao}
                alvo={rascunho.alvoPocao}
                onPiso={(n) => mudar({ pisoPocao: n })}
                onAlvo={(n) => mudar({ alvoPocao: n })}
                itemId={rascunho.pocaoId}
                onItem={(n) => mudar({ pocaoId: n })}
                opcoes={pocoes.map(comIcone)}
                rotuloPadrao="a mais barata da loja"
              />
              <Consumivel
                titulo="revives"
                unidade="un"
                ligado={rascunho.comprarRevive}
                onLigar={(v) => mudar({ comprarRevive: v })}
                piso={rascunho.pisoRevive}
                alvo={rascunho.alvoRevive}
                onPiso={(n) => mudar({ pisoRevive: n })}
                onAlvo={(n) => mudar({ alvoRevive: n })}
                itemId={rascunho.reviveId}
                onItem={(n) => mudar({ reviveId: n })}
                opcoes={revives.map(comIcone)}
                rotuloPadrao="o mais barato da loja"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
              <label className="flex flex-col gap-1">
                <span className="pix text-[10px] text-text-mute">gasto máximo por rodada</span>
                <NumberField
                  value={rascunho.tetoOuro}
                  onChange={(n) => mudar({ tetoOuro: n })}
                  min={0}
                  max={100000000}
                  grouped
                  className="w-40"
                />
              </label>
              <p className="max-w-xs pb-1 text-[11px] text-text-mute">
                O robô nunca gasta além disso de uma vez, mesmo com a conta cheia.
                {loja ? ` Você tem ${compact(loja.ouro)} em dólares.` : ""}
              </p>
            </div>
          </Secao>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* ---------------- venda de drop ---------------- */}
          <Secao
            titulo="Venda de drop"
            icone={<ICONE.ouro size={14} />}
            hint="Marque o que pode sair. O que não estiver marcado fica na mochila, inclusive item que o jogo lançar depois."
            acao={
              mochila.length ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => mudar({ dropIds: mochila.map((i) => i.id) })}
                  >
                    marcar tudo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!rascunho.dropIds.length}
                    onClick={() => mudar({ dropIds: [], venderDrop: false })}
                  >
                    limpar
                  </Button>
                </div>
              ) : undefined
            }
          >
            <Switch
              block
              checked={rascunho.venderDrop}
              disabled={!rascunho.dropIds.length}
              onChange={(e) => mudar({ venderDrop: e.currentTarget.checked })}
              label="vender os itens marcados"
              hint={
                rascunho.dropIds.length
                  ? `${rascunho.dropIds.length} marcados · ${compact(rendeMarcado)} em dólares parados na mochila`
                  : "marque pelo menos um item abaixo"
              }
            />

            {mochila.length === 0 ? (
              <Empty title="Mochila vazia" hint="Os drops aparecem aqui depois dos primeiros abates." />
            ) : (
              <ul className="grid max-h-[320px] content-start gap-1 overflow-y-auto sm:grid-cols-2">
                {mochila.map((i) => {
                  const marcado = rascunho.dropIds.includes(i.id);
                  return (
                    <li key={i.id}>
                      {/* A LINHA inteira marca. Obrigar a acertar o quadradinho
                          de 16px numa lista de vinte itens é trabalho manual que
                          o clique já podia resolver. */}
                      <label
                        className="flex h-11 cursor-pointer select-none items-center gap-2 border bg-bg-soft px-2 transition-colors hover:border-line-strong"
                        style={{
                          borderColor: marcado
                            ? "color-mix(in srgb, var(--color-ok) 45%, transparent)"
                            : "var(--color-line)",
                        }}
                      >
                        <Checkbox
                          checked={marcado}
                          onChange={() =>
                            mudar({
                              dropIds: marcado
                                ? rascunho.dropIds.filter((x) => x !== i.id)
                                : [...rascunho.dropIds, i.id],
                            })
                          }
                        />
                        {i.icone ? (
                          <Sprite src={i.icone} alt="" size={20} />
                        ) : (
                          <span className="h-5 w-5 shrink-0 border border-line" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[13px] text-text">{i.nome}</span>
                        <span className="shrink-0 text-right text-[11px] tabular text-text-mute">
                          {compact(i.quantidade)}x · {compact(i.quantidade * i.precoNpc)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Secao>

          {/* ---------------- venda de pokémon ---------------- */}
          <Secao
            titulo="Venda de pokémon"
            icone={<Pokeball size={14} />}
            hint="Vender é irreversível. O robô só vende o que passa por todos os filtros, e nunca toca no time, no líder, no inicial nem no que está cadeado."
            acao={
              <span className="pix shrink-0 text-[11px] text-text-mute">
                {estado.noBox} no box
              </span>
            }
          >
            <Switch
              block
              checked={rascunho.venderPoke}
              onChange={(e) => mudar({ venderPoke: e.currentTarget.checked })}
              label="vender o que o box acumula"
            />
            {rascunho.venderPoke ? (
              <>
                <Note tone="warn">
                  Com isto ligado, o robô vende sozinho todo pokémon do box abaixo dos limites. Confira
                  os números antes de sair da tela.
                </Note>
                <div className="grid items-stretch gap-3 sm:grid-cols-2">
                  <div className="flex items-center border border-line bg-bg-soft p-3">
                    <Switch
                      block
                      checked={rascunho.manterShiny}
                      onChange={(e) => mudar({ manterShiny: e.currentTarget.checked })}
                      label="nunca vender shiny"
                    />
                  </div>
                  {/* Qualidade e IV são grandezas diferentes e as duas seguram o
                      bicho: um IV médio de qualidade DIVINA vale mais que um IV
                      alto de qualidade comum. */}
                  <label className="flex flex-col justify-between gap-1 border border-line bg-bg-soft p-3">
                    <span className="pix text-[10px] text-text-mute">fica com qualidade a partir de</span>
                    <Select
                      value={qualityTier(rascunho.qualidadeMinima)}
                      onChange={(t) => mudar({ qualidadeMinima: TIER_MIN[t] })}
                      options={TIER_ORDER.filter((t) => t !== "WEAK").map((t) => ({
                        value: t,
                        label: TIER_LABEL[t],
                        render: (
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0"
                              style={{ backgroundColor: TIER_COLOR[t] }}
                              aria-hidden="true"
                            />
                            <span className="flex-1">{TIER_LABEL[t]}</span>
                            <span className="text-[11px] tabular text-text-mute">{TIER_MIN[t].toFixed(2)}x</span>
                          </span>
                        ),
                      }))}
                    />
                  </label>
                  <label className="flex flex-col justify-between gap-1 border border-line bg-bg-soft p-3">
                    <span className="pix text-[10px] text-text-mute">fica com IV a partir de</span>
                    <NumberField
                      value={rascunho.ivMinimo}
                      onChange={(n) => mudar({ ivMinimo: n })}
                      min={0}
                      max={192}
                    />
                  </label>
                  <label className="flex flex-col justify-between gap-1 border border-line bg-bg-soft p-3">
                    <span className="pix text-[10px] text-text-mute">fica com nível a partir de</span>
                    <NumberField
                      value={rascunho.nivelMinimo}
                      onChange={(n) => mudar({ nivelMinimo: n })}
                      min={1}
                      max={1000}
                    />
                  </label>
                </div>
              </>
            ) : null}
          </Secao>
        </div>
      </div>

      {/* A barra de salvar gruda no rodapé porque as seções são altas: a mudança
          acontece no topo e a confirmação não pode ficar a uma rolagem dela. */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-bg/95 px-1 py-3 backdrop-blur">
        <Button size="lg" variant="primary" disabled={!sujo || salvando} onClick={() => void salvar()}>
          {salvando ? "salvando…" : "salvar alterações"}
        </Button>
        <Button size="lg" variant="ghost" disabled={!sujo || salvando} onClick={descartar}>
          descartar
        </Button>
        <span className="text-[12px]" style={{ color: sujo ? "var(--color-warn)" : "var(--color-text-mute)" }}>
          {sujo ? "Há alterações que ainda não foram aplicadas." : "Tudo salvo."}
        </span>
        <span className="ml-auto flex items-center gap-3">
          <Button
            size="lg"
            variant="outline"
            disabled={!estado.conectado || sujo}
            onClick={() => void fetch("/api/robo/agora", { method: "POST" })}
          >
            rodar agora
          </Button>
          <span className="text-[12px] text-text-mute">
            {!estado.conectado
              ? "Ligue o robô para testar."
              : sujo
                ? "Salve antes de testar."
                : "Roda uma vez, sem esperar o minuto."}
          </span>
        </span>
      </div>
    </div>
  );
}
