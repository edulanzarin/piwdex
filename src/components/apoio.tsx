"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { URL_JOGO, URL_PAGAMENTO, temPagamento } from "@/lib/apoio";
import { Button, ButtonLink, IconButton, IconChevronRight, IconClose } from "@/components/ui";
import { IconApoio } from "@/components/game-icons";

/**
 * O pedido de apoio, nas duas formas em que ele aparece no site.
 *
 * A regra que vale pras duas: **o caminho de graca e o que sempre existe**. Usar o
 * codigo de indicacao ao comprar diamante nao muda o preco pra quem compra, entao
 * e o apoio que a maioria consegue dar — e e ele que a FRASE explica, porque e o
 * unico que precisa de explicacao. O botao do dinheiro se explica sozinho e some
 * quando nao ha link.
 *
 * O CODIGO EM SI nao aparece na tela (decisao do Eduardo): quem clica no botao
 * entra no jogo por um link que ja carrega a indicacao, entao nao ha nada pra
 * copiar na mao.
 *
 * E o caminho do dinheiro **so existe quando existe**: enquanto `URL_PAGAMENTO`
 * estiver vazia, nao ha botao. Botao que abre nada, ou que diz "em breve", gasta
 * a confianca que o pedido inteiro depende de ter.
 */

/**
 * A faixa de apoio: recado de um lado, botao do outro.
 *
 * Os dois botoes NAO sao a mesma coisa e a cor diz isso: "usar meu codigo" e neon
 * (o caminho de graca) e "apoio opcional" e o acento (o do dinheiro). A ordem na
 * tela — dinheiro primeiro — e escolha do Eduardo, copiando a forma que ele
 * pediu; trocar e inverter os dois blocos de `AcoesApoio`. O que a frase promete
 * NAO depende da ordem, de proposito: texto que diz "o primeiro" quebra calado no
 * dia em que alguem mexe no layout.
 */
export function FaixaApoio() {
  return (
    <section className="flex flex-col gap-3 border border-neon/35 bg-neon/5 p-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex min-w-0 flex-1 gap-2.5">
        <IconApoio size={16} className="mt-0.5 shrink-0 text-neon" />
        <p className="max-w-[74ch] text-[13px] leading-relaxed text-text-dim">
          <span className="text-text">O PIWdex é gratuito e o apoio é totalmente opcional.</span>{" "}
          Se for comprar diamante no jogo, usar o meu código de indicação não muda o preço
          pra você e ajuda a manter o projeto de pé.
          {temPagamento() ? " Quem preferir mandar um valor escolhe quanto." : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <AcoesApoio />
      </div>
    </section>
  );
}

/** Os dois botoes de acao. Dinheiro primeiro (a forma que o Eduardo pediu), codigo
 *  sempre — ele e o unico que existe enquanto nao ha link de pagamento. */
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
 * 3. **z-30**: abaixo da barra de navegacao (z-40), do modal (z-100) e do popover
 *    (z-110). Balao de pedido nao pode cobrir o menu nem a tela que a pessoa abriu.
 *    (O popover subiu pra cima do modal quando os dois passaram a dividir a tela —
 *    ver `ui/popover.tsx`.)
 * 4. **Ele some quando o rodape entra em cena.** Os dois pedem a mesma coisa; um
 *    por cima do outro e o site pedindo duas vezes na mesma tela — e ainda tapando
 *    o proprio botao que ele quer que a pessoa clique. Sumir aqui NAO e dispensar:
 *    rolou pra cima de novo, ele volta.
 * 5. **Ele nunca cobre um anuncio.** "Conteudo que encobre total ou parcialmente
 *    anuncios veiculados pelo Google" e violacao de politica, e vale mesmo por um
 *    instante — entao o balao mede a propria area contra a de cada anuncio na
 *    tela e sai da frente. Sem anuncio configurado, nada disso roda.
 */
export function ApoioFlutuante() {
  const [visivel, setVisivel] = useState(false);
  const [noRodape, setNoRodape] = useState(false);
  const [sobreAnuncio, setSobreAnuncio] = useState(false);
  const caixa = useRef<HTMLElement>(null);
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

  // Anuncio na frente: o balao sai. Aqui a conta e de RETANGULO e nao de
  // interseccao com a janela — um anuncio no topo da tela nao atrapalha um balao
  // no canto de baixo, e esconder o pedido a toa seria pagar caro por nada.
  useEffect(() => {
    if (!visivel) return;
    const medir = () => {
      const eu = caixa.current?.getBoundingClientRect();
      if (!eu) return;
      const anuncios = document.querySelectorAll<HTMLElement>("[data-anuncio]");
      let bate = false;
      anuncios.forEach((a) => {
        const r = a.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.left < eu.right && r.right > eu.left && r.top < eu.bottom && r.bottom > eu.top) {
          bate = true;
        }
      });
      setSobreAnuncio(bate);
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, [visivel]);

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

  if (!visivel) return null;

  // Escondido NAO e desmontado: a medicao precisa da caixa pra saber quando o
  // anuncio saiu da frente. `visibility` guarda o retangulo (ao contrario de
  // `display: none`), e `inert` tira o conteudo do teclado e do leitor de tela
  // enquanto ele estiver invisivel.
  const escondido = noRodape || sobreAnuncio;

  return (
    <aside
      ref={caixa}
      aria-label="Apoiar o PIWdex"
      aria-hidden={escondido || undefined}
      inert={escondido || undefined}
      className={cn(
        "anim-rise fixed inset-x-3 bottom-3 z-30 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[22rem]",
        escondido && "invisible pointer-events-none",
      )}
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
            <p className="pix text-[12px] text-neon">Apoiar o PIWdex</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-dim">
              O PIWdex é gratuito e o apoio é totalmente opcional. Se for comprar diamante
              no jogo, usar o meu código não muda o preço pra você.
            </p>
          </div>
          <IconButton label="Fechar" size="sm" variant="ghost" onClick={fechar} className="-mr-1.5 -mt-1.5 shrink-0">
            <IconClose size={16} />
          </IconButton>
        </div>

        <AcoesApoio compacto />

        <Button variant="ghost" size="sm" onClick={fechar} className="self-center">
          agora não
        </Button>
      </div>
    </aside>
  );
}
