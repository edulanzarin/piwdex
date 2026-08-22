"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CODIGO_APOIO, URL_JOGO, URL_PAGAMENTO, temPagamento } from "@/lib/apoio";
import { Button, ButtonLink, IconButton, IconCheck, IconChevronRight, IconClose, IconLink } from "@/components/ui";
import { IconApoio } from "@/components/game-icons";

/**
 * O pedido de apoio, nas duas formas em que ele aparece no site.
 *
 * A regra que vale pras duas: **o caminho de graca vem primeiro**. Usar o codigo
 * de indicacao ao comprar diamante nao muda o preco pra quem compra, entao e o
 * apoio que a maioria consegue dar — pedir dinheiro antes disso e pedir o que
 * quase ninguem vai dar e desperdicar a unica frase que a pessoa vai ler.
 *
 * E o caminho do dinheiro **so existe quando existe**: enquanto `URL_PAGAMENTO`
 * estiver vazia, nao ha botao. Botao que abre nada, ou que diz "em breve", gasta
 * a confianca que o pedido inteiro depende de ter.
 */

/** Copia o codigo pro clipboard e confirma NO PROPRIO BOTAO. */
function useCopia() {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1800);
    return () => clearTimeout(t);
  }, [copiado]);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(CODIGO_APOIO);
      setCopiado(true);
    } catch {
      // sem clipboard (http, permissao negada): o codigo esta na tela, selecionavel
    }
  };
  return { copiado, copiar };
}

/** O codigo no meio da frase, clicavel: copiar sem um terceiro botao na faixa.
 *  Quem compra diamante DENTRO do jogo precisa do codigo na mao — o link com `?ref`
 *  so resolve pra quem entra por ele. */
export function CodigoInline() {
  const { copiado, copiar } = useCopia();
  return (
    <button
      type="button"
      onClick={() => void copiar()}
      title="Clique para copiar"
      className={cn(
        "pix inline-flex items-center gap-1 underline decoration-dotted underline-offset-4 transition-colors",
        copiado ? "text-neon decoration-neon" : "text-text hover:text-neon",
      )}
    >
      {/* O codigo NAO some quando copia: trocar o texto por "copiado" reflui a
          frase inteira no meio da leitura. Quem confirma e o visto do lado. */}
      {CODIGO_APOIO}
      {copiado ? <IconCheck size={13} /> : null}
      <span className="sr-only" aria-live="polite">
        {copiado ? "código copiado" : "clique para copiar o código"}
      </span>
    </button>
  );
}

/** O codigo em si: grande, selecionavel e com o botao de copiar do lado. */
export function CodigoApoio({ className }: { className?: string }) {
  const { copiado, copiar } = useCopia();
  return (
    <div className={cn("flex items-center gap-2 border border-line bg-bg-soft/70 px-3 py-2", className)}>
      {/* `select-all` deixa um clique pegar o codigo inteiro quando o clipboard
          nao existe — que e o caso de quem abre o site em http ou nega a permissao */}
      <code className="pix flex-1 select-all truncate text-[17px] tracking-[0.2em] text-text">
        {CODIGO_APOIO}
      </code>
      <Button
        size="sm"
        variant={copiado ? "neon" : "ghost"}
        onClick={() => void copiar()}
        iconLeft={copiado ? <IconCheck size={14} /> : <IconLink size={14} />}
      >
        {copiado ? "copiado" : "copiar"}
      </Button>
    </div>
  );
}

/**
 * A faixa de apoio: recado de um lado, botao do outro.
 *
 * Os dois botoes NAO sao a mesma coisa e a hierarquia diz isso: "usar meu codigo"
 * e neon (o caminho de graca, e o que a maioria consegue dar) e "apoio opcional" e
 * o acento (o caminho do dinheiro). Quando nao existe link de pagamento, sobra um
 * botao so e a faixa continua fazendo sentido — em vez de um botao morto ocupando
 * o lugar de honra.
 */
export function FaixaApoio() {
  return (
    <section className="flex flex-col gap-3 border border-neon/35 bg-neon/5 p-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex min-w-0 flex-1 gap-2.5">
        <IconApoio size={16} className="mt-0.5 shrink-0 text-neon" />
        <p className="max-w-[70ch] text-[13px] leading-relaxed text-text-dim">
          <span className="text-text">O piwdex é gratuito e o apoio é totalmente opcional.</span>{" "}
          Quem quiser ajudar com os custos do projeto pode usar o meu código de indicação{" "}
          <CodigoInline /> ao comprar diamante no jogo — não muda o preço pra você e volta
          pra cá.
          {temPagamento() ? " Ou mandar o quanto quiser, quando quiser." : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <AcoesApoio />
      </div>
    </section>
  );
}

/** Os dois botoes de acao, na ordem em que eles pesam. */
export function AcoesApoio({ compacto }: { compacto?: boolean }) {
  return (
    <div className={cn("flex flex-wrap gap-2", compacto && "flex-col")}>
      {temPagamento() ? (
        <ButtonLink
          external
          href={URL_PAGAMENTO}
          variant="primary"
          size={compacto ? "md" : "lg"}
          block={compacto}
          iconLeft={<IconApoio size={15} />}
        >
          apoio opcional
        </ButtonLink>
      ) : null}
      <ButtonLink
        external
        href={URL_JOGO}
        variant="neon"
        size={compacto ? "md" : "lg"}
        block={compacto}
        iconRight={<IconChevronRight size={14} />}
      >
        usar meu código
      </ButtonLink>
    </div>
  );
}

// ---------------------------------------------------------------- flutuante

const CHAVE = "piwdex:apoio-fechado";
/** Quanto tempo o "agora não" vale. Fechar de vez seria perder o pedido pra sempre
 *  em quem volta todo dia; voltar na sessao seguinte seria assedio. Trinta dias e
 *  o meio termo que da pra defender. */
const DIAS = 30;
/** So aparece depois que a pessoa USOU o site: 30s de pagina E alguma rolagem.
 *  Pedir apoio antes de entregar valor e pedir pra pessoa fechar sem ler. */
const ESPERA_MS = 30_000;

function fechadoRecentemente(): boolean {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return false;
    const quando = Number(bruto);
    if (!Number.isFinite(quando)) return false;
    // `Math.abs`: carimbo no FUTURO (relogio do aparelho adiantado, fuso trocado)
    // daria diferenca negativa e calaria o balao pra sempre.
    return Math.abs(Date.now() - quando) < DIAS * 24 * 60 * 60 * 1000;
  } catch {
    return false; // navegador sem storage: o balao aparece, e fechar vale a sessao
  }
}

/**
 * O balao de apoio.
 *
 * Tres decisoes que nao sao obvias:
 *
 * 1. **Ele nasce do cliente, nunca do HTML do servidor.** O que decide se ele
 *    aparece esta no `localStorage`, que o servidor nao ve — renderizar no
 *    servidor daria divergencia de hidratacao, ou pior: o balao piscando na cara
 *    de quem ja tinha fechado.
 * 2. **Ele espera a pessoa usar o site.** 30 segundos E ter rolado a pagina.
 *    Quem entra e sai em cinco segundos nunca ve, e e isso mesmo.
 * 3. **z-30**: abaixo da barra de navegacao (z-40), do popover (z-50) e do modal
 *    (z-100). Balao de pedido nao pode cobrir o menu nem a tela que a pessoa abriu.
 * 4. **Ele some quando o rodape entra em cena.** Os dois pedem a mesma coisa; um
 *    por cima do outro e o site pedindo duas vezes na mesma tela — e ainda tapando
 *    o proprio botao que ele quer que a pessoa clique. Sumir aqui NAO e dispensar:
 *    rolou pra cima de novo, ele volta.
 */
export function ApoioFlutuante() {
  const [visivel, setVisivel] = useState(false);
  const [noRodape, setNoRodape] = useState(false);
  // Dispensado nesta sessao. Precisa ser REF e nao estado: o listener de rolagem
  // fecha sobre o valor do primeiro render, entao com estado ele continuaria
  // enxergando "nao dispensado" e o balao voltava no primeiro scroll depois do X.
  const dispensado = useRef(false);

  useEffect(() => {
    if (fechadoRecentemente()) return;

    let rolou = false;
    let venceu = false;
    const talvez = () => {
      if (rolou && venceu && !dispensado.current) setVisivel(true);
    };
    const aoRolar = () => {
      if (window.scrollY > 200) {
        rolou = true;
        talvez();
      }
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    aoRolar(); // quem ja chegou rolado (link com ancora, F5 no meio da pagina)
    const t = setTimeout(() => {
      venceu = true;
      talvez();
    }, ESPERA_MS);

    return () => {
      window.removeEventListener("scroll", aoRolar);
      clearTimeout(t);
    };
  }, []);

  // O rodape em cena engole o balao. `IntersectionObserver` e nao `scroll` porque a
  // altura do rodape muda com a largura da tela, e comparar posicao na mao daria
  // errado exatamente no celular, onde ele e mais alto.
  useEffect(() => {
    const rodape = document.getElementById("rodape");
    if (!rodape) return;
    const obs = new IntersectionObserver(
      ([e]) => setNoRodape(e.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(rodape);
    return () => obs.disconnect();
  }, []);

  const fechar = () => {
    dispensado.current = true;
    setVisivel(false);
    try {
      localStorage.setItem(CHAVE, String(Date.now()));
    } catch {
      // sem storage o fechar vale so esta sessao — o layout raiz nao remonta entre
      // rotas, entao ele nao volta a cada clique de menu
    }
  };

  if (!visivel || noRodape) return null;

  return (
    <aside
      aria-label="Apoiar o piwdex"
      className="anim-rise fixed inset-x-3 bottom-3 z-30 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[22rem]"
    >
      {/* `.pop` e nao `.panel`: painel e a superficie de CONTEUDO (vidro arejado, pra
          deixar o wallpaper passar). O balao flutua POR CIMA da pagina — sobre a grade
          da dex o vidro deixava o sprite atras atravessar o texto. Flutuante usa a
          superficie opaca, que e pra isso que ela existe. */}
      {/* `bg-surface-3` por cima do `.pop`: a superficie flutuante do site e 94%
          opaca, e os 6% que sobram bastam pra um numero em ciano do card de tras
          atravessar o botao. Pedido que a pessoa le com o site aparecendo por dentro
          nao e pedido, e ruido. */}
      <div className="pop flex flex-col gap-3 border-neon/40 bg-surface-3 p-4 shadow-[0_0_60px_-24px_var(--color-neon)]">
        <div className="flex items-start gap-2">
          <IconApoio size={16} className="mt-0.5 text-neon" />
          <div className="min-w-0 flex-1">
            <p className="pix text-[12px] text-neon">Apoiar o piwdex</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-dim">
              O piwdex é gratuito e o apoio é totalmente opcional. Se for comprar diamante
              no jogo, usar o meu código não muda o preço pra você.
            </p>
          </div>
          <IconButton label="Fechar" size="sm" variant="ghost" onClick={fechar} className="-mr-1.5 -mt-1.5 shrink-0">
            <IconClose size={16} />
          </IconButton>
        </div>

        <CodigoApoio />
        <AcoesApoio compacto />

        <Button variant="ghost" size="sm" onClick={fechar} className="self-center">
          agora não
        </Button>
      </div>
    </aside>
  );
}
