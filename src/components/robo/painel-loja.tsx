"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Checkbox, Empty, Loading, Note, NumberField, Select, Sprite, Switch } from "@/components/ui";
import { Pokeball } from "@/components/ui/pokeball";
import { ICONE, Secao, Valor } from "@/components/robo/pecas";
import { compact, TIER_LABEL } from "@/lib/labels";
import { qualityTier, TIER_COLOR, TIER_MIN, TIER_ORDER } from "@/lib/rarity";
import { RarityIcon } from "@/components/rarity-icon";
import { estoqueDoAlvo, type ConfigAuto, type EstadoHunt } from "@/lib/robo/motor/tipos";
import { useRota } from "@/components/robo/conta-atual";

/**
 * A aba do BALCÃO: o que entra na conta por dólar e o que sai dela por dólar.
 *
 * Ela existe separada da automação porque as duas respondem perguntas
 * diferentes. A automação é sobre USO — com que bola o jogo captura, a que %
 * de vida ele bebe poção —, e quem executa é o servidor do jogo. Aqui é
 * COMÉRCIO: comprar consumível, vender drop, vender pokémon. São chamadas REST
 * nossas, todas movem ouro, e nenhuma disputa a sessão de jogo — por isso a
 * reposição acontece com a caçada correndo.
 *
 * Juntas numa aba só, a decisão de quanto gastar ficava a três rolagens da de
 * quanto se recebe, que é a única comparação que essa tela precisa permitir.
 *
 * Nada aqui nasce ligado. Toda chave desta tela gasta ouro ou destrói pokémon.
 */

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
/** `null` quando o catálogo do jogo não respondeu: a tela diz "não sei" em vez
 *  de desenhar um zero, que é o mesmo número de uma bolsa vazia. */
interface Bolsa {
  pocoes: ItemMochila[];
  revives: ItemMochila[];
}
/** O que o Flint, o NPC de Pewter, compra — com o preco DELE por unidade. */
interface Pedra {
  id: number;
  nome: string;
  icone: string;
  quantidade: number;
  precoUnidade: number;
}

/**
 * Um consumível e as três decisões que ele carrega: repor ou não, entre que
 * limites, e qual item.
 *
 * Cartão, e não uma pilha de campos soltos: os três consumíveis fazem a mesma
 * pergunta, e empilhá-los verticalmente obrigava a rolar para comparar bola com
 * poção. Lado a lado, a comparação é a leitura.
 *
 * O estoque fica no cabeçalho porque o piso não significa nada sozinho: "abaixo
 * de 25" só vira decisão ao lado do número que ele compara.
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
  /** quanto a bolsa tem do que vai ser reposto. `null` = não deu para conferir */
  estoque: number | null;
}) {
  const abaixo = estoque != null && Number.isFinite(estoque) && estoque <= piso;
  const texto =
    estoque == null ? "?" : estoque === Number.POSITIVE_INFINITY ? "∞" : compact(estoque);
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
        <span
          className="pix shrink-0 text-[10px] tabular"
          style={{
            color: estoque == null
              ? "var(--color-text-mute)"
              : abaixo
                ? "var(--color-warn)"
                : "var(--color-text-dim)",
          }}
          title={
            estoque == null
              ? "não consegui conferir a bolsa"
              : itemId
                ? "na bolsa, só do item escolhido"
                : "na bolsa, somando o tipo inteiro"
          }
        >
          {texto}
        </span>
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

/** O que compõe o número do cartão. Sem isto, "142 poções" é um total que
 *  ninguém consegue conferir — e o piso soma as fracas com as fortes. */
function NaBolsa({ itens }: { itens: ItemMochila[] }) {
  if (!itens.length) return <span className="text-[11px] text-text-mute">nada na bolsa</span>;
  return (
    <>
      {itens.map((i) => (
        <span key={i.id} className="flex items-center gap-1.5 border border-line px-2 py-1" title={i.nome}>
          {i.icone ? <Sprite src={i.icone} alt="" size={16} /> : null}
          <span className="max-w-[9rem] truncate text-[11px] text-text-dim">{i.nome}</span>
          <span className="text-[11px] tabular text-text-mute">{compact(i.quantidade)}</span>
        </span>
      ))}
    </>
  );
}

export function AbaLoja({
  estado,
  config,
  onConfig,
}: {
  estado: EstadoHunt;
  config: ConfigAuto;
  onConfig: (cfg: ConfigAuto) => Promise<void>;
}) {
  const rota = useRota();
  /**
   * Rascunho.
   *
   * Antes, cada clique gravava e passava a valer na hora — inclusive um "vender
   * o que o box acumula" ligado por engano, que destrói pokémon e não desfaz. A
   * tela acumula a mudança e só age quando alguém confirma.
   */
  const [rascunho, setRascunho] = useState<ConfigAuto>(config);
  const [salvando, setSalvando] = useState(false);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [mochila, setMochila] = useState<ItemMochila[]>([]);
  const [bolsa, setBolsa] = useState<Bolsa | null>(null);
  const [pedras, setPedras] = useState<Pedra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rodando, setRodando] = useState(false);

  const carregar = useCallback(async () => {
    const l = (await fetch(rota("/api/robo/loja"))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)) as { loja?: Loja; mochila?: ItemMochila[]; bolsa?: Bolsa | null } | null;
    if (!l) return;
    if (l.loja) setLoja(l.loja);
    setMochila(l.mochila ?? []);
    setBolsa(l.bolsa ?? null);
  }, []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      await carregar();
      if (vivo) setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [carregar]);

  // O salvo mudou por fora (outra aba, o servidor corrigiu um valor): o rascunho
  // acompanha, MENOS quando há edição pendente — sobrescrever ali apagaria o que
  // a pessoa está digitando.
  const sujoRef = useRef(false);
  useEffect(() => {
    if (!sujoRef.current) setRascunho(config);
  }, [config]);

  const mudar = useCallback((patch: Partial<ConfigAuto>) => {
    setRascunho((r) => ({ ...r, ...patch }));
  }, []);

  const sujo = JSON.stringify(rascunho) !== JSON.stringify(config);
  sujoRef.current = sujo;

  async function salvar() {
    setSalvando(true);
    try {
      await onConfig(rascunho);
    } finally {
      setSalvando(false);
    }
  }

  /**
   * Roda uma vez e RELÊ a bolsa.
   *
   * Um "rodar agora" que não mostra o resultado é um botão que pede fé: a compra
   * aconteceu do outro lado e a tela continuava com o estoque de antes.
   */
  async function rodarAgora() {
    setRodando(true);
    try {
      await fetch(rota("/api/robo/agora"), { method: "POST" }).catch(() => null);
      await carregar();
    } finally {
      setRodando(false);
    }
  }

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

  /**
   * A reposição escolhe entre as bolas da LOJA, e não entre as da conta: só se
   * pode comprar o que está à venda. (A captura automática faz o contrário, e é
   * por isso que ela mora na outra aba com a lista da conta — é lá que a Idle
   * Ball, que não está à venda, precisa aparecer.)
   */
  const bolasDaLoja = (loja?.bolas ?? []).map(comIcone);
  const pocoes = (loja?.itens ?? []).filter((i) => i.categoria === "heal");
  const revives = (loja?.itens ?? []).filter((i) => i.categoria === "revive");

  const estoqueBolas = estado.bolas.reduce((s, b) => (b.infinita ? s : s + b.quantidade), 0);
  // Quanto de ouro está parado no que já foi marcado: é o número que responde
  // "vale a pena ligar isso?", e sem ele a lista é só uma lista de nomes.
  const rendeMarcado = mochila
    .filter((i) => config.dropIds.includes(i.id))
    .reduce((soma, i) => soma + i.quantidade * i.precoNpc, 0);

  const p = estado.placar;
  const recebido = p.ouroVendas + p.ouroPokes;

  if (carregando) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      {/* O caixa da sessão. Comprar e vender só fazem sentido um ao lado do
          outro: a reposição é cara, e o que a paga é a venda de drop. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Valor
          rotulo="Dólares"
          valor={estado.ouro ?? loja?.ouro ?? null}
          icone={<ICONE.ouro size={12} />}
          tom="ouro"
          bruto
        />
        <Valor
          rotulo="Comprou"
          valor={p.ouroCompras || null}
          sufixo="nesta sessão"
          icone={<ICONE.ouro size={12} />}
          tom={p.ouroCompras ? "perigo" : "neutro"}
        />
        <Valor
          rotulo="Vendeu"
          valor={recebido || null}
          sufixo="nesta sessão"
          icone={<ICONE.ouro size={12} />}
          tom={recebido ? "vida" : "neutro"}
        />
        <Valor
          rotulo="Saldo"
          valor={recebido || p.ouroCompras ? recebido - p.ouroCompras : null}
          sufixo="do balcão"
          icone={<ICONE.ouro size={12} />}
          tom={recebido - p.ouroCompras < 0 ? "perigo" : "vida"}
        />
      </div>

      {/* ---------------- reposição ---------------- */}
      <Secao
        titulo="Reposição"
        icone={<ICONE.ouro size={14} />}
        hint="Bola zerada trava a fila de captura do jogo. Uma caçada boa queima centenas por hora. O robô compra do piso até o alvo, e não uma unidade de cada vez."
        acao={
          <span
            className="pix text-[11px]"
            style={{ color: estoqueBolas ? "var(--color-text-mute)" : "var(--color-danger)" }}
          >
            {estoqueBolas > 0 ? `${compact(estoqueBolas)} bolas na bolsa` : "bolsa sem bolas"}
          </span>
        }
      >
        <div className="grid items-stretch gap-3 sm:grid-cols-3">
          <Consumivel
            titulo="bolas"
            unidade="un"
            estoque={estoqueDoAlvo(estado.bolas, rascunho.bolaId)}
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
            estoque={bolsa ? estoqueDoAlvo(bolsa.pocoes, rascunho.pocaoId) : null}
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
            estoque={bolsa ? estoqueDoAlvo(bolsa.revives, rascunho.reviveId) : null}
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

        {/* O piso soma a categoria INTEIRA — Potion fraca com Hyper Potion. Só
            dá para escolher o número sabendo do que ele é feito. */}
        {bolsa ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
            <span className="pix mr-1 text-[10px] text-text-mute">na bolsa</span>
            <NaBolsa itens={[...bolsa.pocoes, ...bolsa.revives]} />
          </div>
        ) : (
          <Note tone="warn">
            Não consegui conferir a bolsa. Enquanto isso durar, o robô não repõe poção nem revive —
            comprar sem saber o estoque é como ele zerava a conta.
          </Note>
        )}

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
          </p>
        </div>
      </Secao>

      {/* ---------------- o que o jogo já deu ---------------- */}
      <Secao
        titulo="Coleta"
        icone={<ICONE.diamante size={14} />}
        hint="Prêmio que já é seu e está esperando um clique. Não gasta nem destrói nada — é a única parte desta tela sem lista e sem teto."
        acao={
          estado.placar.coletas ? (
            <span className="pix text-[11px] text-text-mute">
              {estado.placar.coletas} nesta sessão
            </span>
          ) : undefined
        }
      >
        <div className="grid items-stretch gap-3 sm:grid-cols-2">
          <div className="flex items-center border border-line bg-bg-soft p-3">
            <Switch
              block
              checked={rascunho.coletarDiaria}
              onChange={(e) => mudar({ coletarDiaria: e.currentTarget.checked })}
              label="pegar a diária"
              hint="uma vez por dia, e o dia que passa não volta"
            />
          </div>
          <div className="flex items-center border border-line bg-bg-soft p-3">
            <Switch
              block
              checked={rascunho.coletarPasse}
              onChange={(e) => mudar({ coletarPasse: e.currentTarget.checked })}
              label="pegar o passe"
              hint="missão concluída e tier alcançado, grátis e premium"
            />
          </div>
        </div>
      </Secao>

      {/* ---------------- pedra: o Flint paga melhor ---------------- */}
      <Secao
        titulo="Venda de pedra"
        icone={<ICONE.ouro size={14} />}
        hint="O Flint, em Pewter, é um comprador separado e paga por unidade um preço que a loja comum não paga. Pedra é material de evolução — marque só o que sobra."
        acao={
          pedras.length ? (
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" size="sm" onClick={() => mudar({ pedraIds: pedras.map((p) => p.id) })}>
                marcar tudo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!rascunho.pedraIds.length}
                onClick={() => mudar({ pedraIds: [], venderPedra: false })}
              >
                limpar
              </Button>
            </div>
          ) : undefined
        }
      >
        <Switch
          block
          checked={rascunho.venderPedra}
          disabled={!rascunho.pedraIds.length}
          onChange={(e) => mudar({ venderPedra: e.currentTarget.checked })}
          label="vender as pedras marcadas pro Flint"
          hint={
            rascunho.pedraIds.length
              ? `${rascunho.pedraIds.length} marcadas · ${compact(
                  pedras
                    .filter((p) => rascunho.pedraIds.includes(p.id))
                    .reduce((s, p) => s + Math.max(0, p.quantidade - rascunho.guardarPedra) * p.precoUnidade, 0),
                )} em dólares parados`
              : "marque pelo menos uma pedra abaixo"
          }
        />

        {pedras.length === 0 ? (
          <Empty title="Nenhuma pedra na bolsa" hint="Elas caem das caçadas e aparecem aqui." />
        ) : (
          <>
            <ul className="grid max-h-[260px] content-start gap-1 overflow-y-auto sm:grid-cols-2">
              {pedras.map((p) => {
                const marcada = rascunho.pedraIds.includes(p.id);
                const sai = Math.max(0, p.quantidade - rascunho.guardarPedra);
                return (
                  <li key={p.id}>
                    <label
                      className="flex h-11 cursor-pointer select-none items-center gap-2 border bg-bg-soft px-2 transition-colors hover:border-line-strong"
                      style={{
                        borderColor: marcada
                          ? "color-mix(in srgb, var(--color-ok) 45%, transparent)"
                          : "var(--color-line)",
                      }}
                    >
                      <Checkbox
                        checked={marcada}
                        onChange={() =>
                          mudar({
                            pedraIds: marcada
                              ? rascunho.pedraIds.filter((x) => x !== p.id)
                              : [...rascunho.pedraIds, p.id],
                          })
                        }
                      />
                      {p.icone ? (
                        <Sprite src={p.icone} alt="" size={20} />
                      ) : (
                        <span className="h-5 w-5 shrink-0 border border-line" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{p.nome}</span>
                      <span className="shrink-0 text-right text-[11px] tabular text-text-mute">
                        {compact(p.quantidade)}x · {compact(sai * p.precoUnidade)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
              <label className="flex flex-col gap-1">
                <span className="pix text-[10px] text-text-mute">guardar de cada uma</span>
                <NumberField
                  value={rascunho.guardarPedra}
                  onChange={(n) => mudar({ guardarPedra: n })}
                  min={0}
                  max={100000}
                  wrapClassName="w-28"
                  className="text-center"
                  suffix="un"
                />
              </label>
              <p className="max-w-sm pb-1 text-[11px] text-text-mute">
                Sobra na mochila, aconteça o que acontecer. Zero vende tudo — e evolução que precisa
                da pedra não desfaz.
              </p>
            </div>
          </>
        )}
      </Secao>

      {/* As duas vendas lado a lado: uma esvazia a mochila, a outra o box, e a
          pergunta "o que estou deixando o robô destruir" é a mesma nas duas. */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
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
          acao={<span className="pix shrink-0 text-[11px] text-text-mute">{estado.noBox} no box</span>}
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
                        /* O brasao no lugar do quadradinho de cor: e aqui que a
                           escada e ESCOLHIDA, entao e aqui que ela tem que ser
                           aprendida — e forma se aprende, matiz so se reconhece
                           depois de aprendida. */
                        <span className="flex items-center gap-2">
                          <RarityIcon rarity={t} size={15} style={{ color: TIER_COLOR[t] }} />
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

      {/* A barra de salvar gruda no rodapé porque as seções são altas: a mudança
          acontece no topo e a confirmação não pode ficar a uma rolagem dela. */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-bg/95 px-1 py-3 backdrop-blur">
        <Button size="lg" variant="primary" disabled={!sujo || salvando} onClick={() => void salvar()}>
          {salvando ? "salvando…" : "salvar alterações"}
        </Button>
        <Button size="lg" variant="ghost" disabled={!sujo || salvando} onClick={() => setRascunho(config)}>
          descartar
        </Button>
        <span className="text-[12px]" style={{ color: sujo ? "var(--color-warn)" : "var(--color-text-mute)" }}>
          {sujo ? "Há alterações que ainda não foram aplicadas." : "Tudo salvo."}
        </span>
        <span className="ml-auto flex items-center gap-3">
          <Button
            size="lg"
            variant="outline"
            disabled={!estado.conectado || sujo || rodando}
            onClick={() => void rodarAgora()}
          >
            {rodando ? "rodando…" : "rodar agora"}
          </Button>
          <span className="text-[12px] text-text-mute">
            {!estado.conectado
              ? "Ligue o robô para testar."
              : sujo
                ? "Salve antes de testar."
                : "Compra e vende uma vez, sem esperar o minuto."}
          </span>
        </span>
      </div>
    </div>
  );
}
