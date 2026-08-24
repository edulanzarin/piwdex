"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Loading, Note, Select, Sprite, Switch } from "@/components/ui";
import { Pokeball } from "@/components/ui/pokeball";
import { Secao } from "@/components/robo/pecas";
import { compact } from "@/lib/labels";
import type { BolaEstoque, EstadoAuto, EstadoHunt } from "@/lib/robo/motor/tipos";
import { useRota } from "@/components/robo/conta-atual";

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

interface ItemBolsa {
  id: number;
  nome: string;
  icone: string;
  quantidade: number;
}

/**
 * O seletor de poção do Auto-Helper.
 *
 * Escolhe entre o que a BOLSA tem, como o de bola — o catálogo da loja mostraria
 * poção que você não tem e esconderia a que você tem. Zero é "Automático
 * (melhor)", que é o padrão do próprio jogo.
 */
function PocaoSelect({
  valor,
  onMudar,
  pocoes,
  desabilitado,
}: {
  valor: number;
  onMudar: (id: number) => void;
  pocoes: ItemBolsa[];
  desabilitado: boolean;
}) {
  return (
    <Select
      value={String(valor || "")}
      onChange={(v) => onMudar(Number(v) || 0)}
      disabled={desabilitado}
      options={[
        { value: "", label: "automática (a melhor)" },
        ...pocoes.map((i) => ({
          value: String(i.id),
          label: `${i.nome} · ${compact(i.quantidade)} na bolsa`,
          render: (
            <span className="flex min-w-0 items-center gap-2">
              {i.icone ? <Sprite src={i.icone} alt="" size={18} /> : null}
              <span className="min-w-0 flex-1 truncate">{i.nome}</span>
              <span
                className="shrink-0 text-[11px] tabular"
                style={{ color: i.quantidade > 0 ? "var(--color-text-mute)" : "var(--color-danger)" }}
              >
                {compact(i.quantidade)}
              </span>
            </span>
          ),
        })),
      ]}
    />
  );
}

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
            <span
              className="shrink-0 text-[11px] tabular"
              style={{
                color: b.infinita
                  ? "var(--color-neon)"
                  : b.quantidade > 0
                    ? "var(--color-text-mute)"
                    : "var(--color-danger)",
              }}
            >
              {b.infinita ? "∞" : compact(b.quantidade)}
            </span>
          </span>
        ),
      }))}
    />
  );
}

/**
 * Um interruptor do jogo e o ajuste que ele carrega.
 *
 * O ajuste mora num SLOT de altura fixa, e os quatro cartões têm o slot mesmo
 * quando não têm ajuste. Sem ele a grade desenhava quatro alturas — a bola tem
 * select, a poção tinha rótulo empilhado mais campo, o revive não tem nada — e
 * ligar um interruptor empurrava o vizinho.
 */
function Cartao({
  children,
  controle,
  linha,
}: {
  children: React.ReactNode;
  controle?: React.ReactNode;
  /** interruptor e ajuste na MESMA linha, pro ajuste que cabe em uma escolha */
  linha?: boolean;
}) {
  if (linha) {
    return (
      <div className="flex flex-wrap items-center gap-3 border border-line bg-bg-soft p-3">
        <div className="min-w-0 flex-1">{children}</div>
        {controle}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 border border-line bg-bg-soft p-3">
      {children}
      <div className="flex min-h-[2.375rem] flex-col justify-center">{controle}</div>
    </div>
  );
}

/**
 * Os limiares de vida que se oferece.
 *
 * Select e nao campo aberto: o jogo aceita qualquer inteiro, mas "curar abaixo
 * de 47%" e uma precisao que ninguem tem — o campo pedia uma decisao onde
 * bastava uma escolha, e ainda deixava digitar 0, que e o mesmo que desligar
 * com o interruptor ligado.
 */
const VIDA = [10, 20, 30, 40, 50, 60, 70, 80, 90];

export function AbaAutomacao({ estado }: { estado: EstadoHunt }) {
  const rota = useRota();
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
  const [pocoes, setPocoes] = useState<ItemBolsa[]>([]);
  const [revives, setRevives] = useState<ItemBolsa[]>([]);
  const [bolsaLida, setBolsaLida] = useState(false);
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
      const a = (await fetch(rota("/api/robo/auto"))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as {
        auto?: EstadoAuto;
        bolas?: BolaEstoque[];
        pocoes?: ItemBolsa[];
        revives?: ItemBolsa[];
        bolsaLida?: boolean;
      } | null;
      if (!vivo) return;
      if (a?.auto) setAuto(a.auto);
      if (a?.bolas?.length) setBolas(a.bolas);
      setPocoes(a?.pocoes ?? []);
      setRevives(a?.revives ?? []);
      setBolsaLida(!!a?.bolsaLida);
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
    // A poção vai na chave do JOGO, não na nossa: `pocaoId` é o nome interno, e
    // o campo real foi descoberto no payload da conta (ver `jogo/auto.ts`).
    if (auto.campoPocao && rascunho.pocaoId !== auto.pocaoId) {
      out[auto.campoPocao] = rascunho.pocaoId;
    }
    return out;
  }, [rascunho, auto]);

  const sujo = Object.keys(patch).length > 0;

  /**
   * A bola escolhida com a bolsa zerada.
   *
   * É o modo de falha mais silencioso desta tela: o interruptor fica ligado, o
   * jogo aceita a config, e o auto-catch simplesmente não joga nada — porque a
   * bola que ele foi mandado usar tem zero. Ter 555 de outra bola não resolve, e
   * é justamente o que faz o problema passar despercebido.
   */
  const semBola = (ligado: boolean, id: number) => {
    if (!ligado || !id) return null;
    const b = bolas.find((x) => x.id === id);
    return b && !b.infinita && b.quantidade <= 0 ? b.nome : null;
  };
  const catchVazio = atual ? semBola(atual.autoCatch, atual.autoCatchBallId) : null;
  const shinyVazio = atual ? semBola(atual.autoCatchShiny, atual.autoCatchShinyBallId) : null;
  const zeradas = [...new Set([catchVazio, shinyVazio].filter(Boolean))] as string[];

  // O próprio jogo avisa isto na tela dele ("Você não tem nenhum Revive na
  // bolsa"). Só vale quando a bolsa foi LIDA: falha de leitura não é bolsa vazia.
  const semRevive =
    !!atual?.autoRevive && bolsaLida && !revives.some((r) => r.quantidade > 0);

  async function salvar() {
    setSalvando(true);
    setRecado(null);
    try {
      const res = await fetch(rota("/api/robo/auto"), {
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

            {semRevive ? (
              <Note tone="warn">
                O Auto-Revive está ligado e não há nenhum Revive na bolsa — ele não levanta ninguém
                assim. Ligue a reposição de revive na aba Loja.
              </Note>
            ) : null}

            {zeradas.length ? (
              <Note tone="warn">
                {zeradas.length === 1
                  ? `O auto-catch está em ${zeradas[0]} e a bolsa tem zero.`
                  : `O auto-catch está em ${zeradas.join(" e ")} e a bolsa tem zero das duas.`}{" "}
                Enquanto isso, o jogo não captura nada — ter outra bola na bolsa não resolve, porque
                ele só joga a que foi escolhida aqui. Ligue a reposição dessa bola na aba Loja, ou
                escolha uma que você tenha.
              </Note>
            ) : null}

            <div className="grid items-stretch gap-3 sm:grid-cols-2">
              <Cartao
                controle={
                  atual.autoCatch ? (
                    <BolaSelect
                      valor={atual.autoCatchBallId}
                      onMudar={(autoCatchBallId) => mudar({ autoCatchBallId })}
                      bolas={bolas}
                      desabilitado={salvando}
                    />
                  ) : null
                }
              >
                <Switch
                  block
                  checked={atual.autoCatch}
                  disabled={salvando}
                  onChange={(e) => mudar({ autoCatch: e.currentTarget.checked })}
                  label="capturar sozinho"
                />
              </Cartao>

              <Cartao
                controle={
                  atual.autoCatchShiny ? (
                    <BolaSelect
                      valor={atual.autoCatchShinyBallId}
                      onMudar={(autoCatchShinyBallId) => mudar({ autoCatchShinyBallId })}
                      bolas={bolas}
                      desabilitado={salvando}
                    />
                  ) : null
                }
              >
                <Switch
                  block
                  checked={atual.autoCatchShiny}
                  disabled={salvando}
                  onChange={(e) => mudar({ autoCatchShiny: e.currentTarget.checked })}
                  label="bola separada para shiny"
                />
              </Cartao>

              <Cartao
                linha
                controle={
                  atual.autoPotion ? (
                    <>
                      {/* So aparece quando a conta traz o campo. Sem ele, nao ha
                          o que escolher e nao ha o que dizer — a frase que
                          morava aqui explicava uma ausencia que a propria
                          ausencia ja mostra. */}
                      {atual.campoPocao ? (
                        <div className="w-40 shrink-0">
                          <PocaoSelect
                            valor={atual.pocaoId}
                            onMudar={(pocaoId) => mudar({ pocaoId })}
                            pocoes={pocoes}
                            desabilitado={salvando}
                          />
                        </div>
                      ) : null}
                      <div className="w-28 shrink-0">
                        <Select
                          value={String(atual.autoPotionThreshold)}
                          onChange={(v) => mudar({ autoPotionThreshold: Number(v) })}
                          disabled={salvando}
                          options={(VIDA.includes(atual.autoPotionThreshold)
                            ? VIDA
                            : // O valor salvo entra na lista quando nao e um dos
                              // degraus: um select que nao contem o proprio valor
                              // desenha vazio e troca a config no primeiro save.
                              [atual.autoPotionThreshold, ...VIDA].sort((a, b) => a - b)
                          ).map((n) => ({ value: String(n), label: `${n}% de vida` }))}
                        />
                      </div>
                    </>
                  ) : null
                }
              >
                <Switch
                  block
                  checked={atual.autoPotion}
                  disabled={salvando}
                  onChange={(e) => mudar({ autoPotion: e.currentTarget.checked })}
                  label="usar poção sozinho"
                />
              </Cartao>

              {/* So o interruptor: o jogo nao deixa escolher o revive, e um
                  cartao sem ajuste nao precisa de paragrafo explicando que nao
                  tem ajuste. Quando FALTA revive na bolsa, isso vira aviso la em
                  cima, que e onde se age. */}
              <Cartao linha>
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
