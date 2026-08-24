"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A REVELACAO NO SCROLL — a peca entra quando entra em cena.
 *
 * O site ja tinha animacao de entrada (`.anim-in`), e ela resolve outra coisa: o
 * que esta na PRIMEIRA tela, no carregamento. Tudo abaixo da dobra usando o mesmo
 * mecanismo anima enquanto ninguem esta olhando — a pessoa rola trinta segundos
 * depois e encontra o bloco ja parado, ou seja, paga o custo da animacao e nao
 * recebe nada em troca.
 *
 * ## Por que IntersectionObserver e nao evento de scroll
 *
 * Handler de `scroll` dispara dezenas de vezes por segundo na thread principal e
 * cada leitura de `getBoundingClientRect` forca layout. Com dez blocos na pagina
 * isso e jank garantido em maquina media. O observer entrega a mesma informacao
 * pelo caminho do compositor, e so quando o estado muda.
 *
 * ## Uma vez, e so
 *
 * O observer se DESLIGA na primeira entrada. Reanimar a cada passagem parece
 * generoso e e o oposto: quem rola pra cima pra reler uma frase recebe a frase
 * desaparecendo e voltando, e reler vira perseguir. Revelacao e uma apresentacao,
 * nao um estado.
 *
 * ## NADA que esta na tela fica invisivel
 *
 * Esta e a regra que manda nos dois numeros do gatilho, e ela foi escrita depois
 * de a home aparecer com as artes boiando sobre o wallpaper e nenhum texto.
 *
 * O que havia aqui era `threshold: 0.15` com `rootMargin` de **-12% embaixo** — a
 * raiz ENCOLHIA, ou seja, o gatilho disparava mais tarde, nao mais cedo (o
 * comentario antigo afirmava o contrario do que o valor fazia). Junte as duas
 * coisas e a conta fica assim: a peca so acende quando 15% dela ja passou de uma
 * linha 12% acima do fim da janela.
 *
 * Numa janela alta isso e imperceptivel. Numa janela BAIXA e o defeito inteiro:
 * com 470px de altura util e um bloco de 310px, o topo do bloco tinha de chegar a
 * 293px pra acender — ou seja, havia sempre uma faixa de mais de cem pixels, no
 * fim da tela, ocupada por conteudo em `opacity: 0`. A pessoa rolava e encontrava
 * buraco.
 *
 * Agora: `threshold: 0` e margem **positiva** embaixo. A raiz se estende pra
 * FORA da janela, entao a peca termina de aparecer antes de entrar na area de
 * leitura — e nao ha estado em que algo visivel esteja transparente. O limiar
 * some junto porque limiar por FRACAO nao serve pra bloco alto: ele exige mais
 * pixels quanto maior a peca, que e exatamente ao contrario do que se quer.
 *
 * ## `prefers-reduced-motion`
 *
 * Quem pediu menos movimento nao recebe transicao NENHUMA — e, o que importa
 * mais, recebe o conteudo VISIVEL desde o inicio. Um bloco com `opacity: 0`
 * esperando uma animacao que foi desligada e conteudo que nunca aparece, e esse
 * e o jeito mais facil de "acessibilidade" virar pagina em branco.
 */

type Efeito = "sobe" | "desce" | "esquerda" | "direita" | "surge" | "cresce";

const DE: Record<Efeito, string> = {
  sobe: "translateY(28px)",
  desce: "translateY(-28px)",
  esquerda: "translateX(-36px)",
  direita: "translateX(36px)",
  surge: "none",
  cresce: "scale(0.96)",
};

export interface RevealProps {
  children: ReactNode;
  efeito?: Efeito;
  /** atraso em ms — e como se faz cascata dentro de uma secao */
  delay?: number;
  /** quanto da peca precisa entrar em cena pra disparar (0 a 1).
   *  Zero de proposito — ver o comentario de `margem`. */
  limiar?: number;
  /** margem do gatilho. POSITIVA embaixo: a raiz se estende ABAIXO da janela, e
   *  a peca comeca a aparecer antes de entrar de fato. */
  margem?: string;
  duracao?: number;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "span" | "li" | "article";
}

export function Reveal({
  children,
  efeito = "sobe",
  delay = 0,
  limiar = 0,
  margem = "0px 0px 18% 0px",
  duracao = 620,
  className,
  style,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  /**
   * Comeca VISIVEL e o efeito e ligado no cliente.
   *
   * O contrario — nascer invisivel — quebra duas coisas de uma vez: sem
   * JavaScript (ou se o hydrate falhar) a pagina fica em branco, e o rastreador
   * que nao executa script indexa uma pagina vazia. O custo de ligar depois e um
   * quadro; o custo de errar pro outro lado e o site inteiro.
   */
  const [pronto, setPronto] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const menos = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (menos) {
      setVisivel(true);
      return;
    }
    setPronto(true);

    const el = ref.current;
    if (!el) return;

    // Ja esta em cena no primeiro quadro: revela sem esperar o observer, senao o
    // topo da pagina pisca antes de aparecer.
    //
    // O teste olha as DUAS bordas. So o topo nao basta: um bloco que comeca
    // acima da janela e termina dentro dela (o caso de quem chega por link com
    // ancora, ou recarrega a pagina no meio) tem `top` negativo, passava por
    // aqui por acaso, e o de `top` grande com o rodape a mostra nao passava —
    // ficava esperando um observer pra revelar coisa que ja esta na cara.
    const caixa = el.getBoundingClientRect();
    if (caixa.top < window.innerHeight && caixa.bottom > 0) {
      setVisivel(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setVisivel(true);
        obs.disconnect(); // uma vez, e so
      },
      { threshold: limiar, rootMargin: margem },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [limiar, margem]);

  return (
    <Tag
      ref={ref as never}
      data-revelado={visivel || undefined}
      className={cn("will-change-[opacity,transform]", className)}
      style={{
        ...style,
        ...(pronto && !visivel
          ? { opacity: 0, transform: DE[efeito] }
          : { opacity: 1, transform: "none" }),
        transition: pronto
          ? `opacity ${duracao}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, ` +
            `transform ${duracao}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`
          : undefined,
      }}
    >
      {children}
    </Tag>
  );
}

/**
 * PARALAXE de peca solta — a arte anda mais devagar que a pagina.
 *
 * O efeito e o que da profundidade de cena: quando o fundo se move menos que o
 * texto, o olho le os dois como planos diferentes. E ele so funciona se for
 * SUTIL — deslocamento grande transforma paralaxe em elemento fora do lugar, e a
 * pessoa passa a ver o truque em vez da cena.
 *
 * O calculo roda dentro de `requestAnimationFrame` e escreve so `transform`, que
 * o compositor resolve sem layout. Ler `scrollY` e barato; o que custaria caro
 * seria medir o elemento a cada quadro, entao a medida sai uma vez e so refaz no
 * redimensionamento.
 */
export function Parallax({
  children,
  forca = 0.12,
  className,
}: {
  children: ReactNode;
  /** fracao do scroll que a peca acompanha. 0 = presa, 1 = anda junto */
  forca?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const menos = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (menos || !el) return;

    let centro = 0;
    let pedido = 0;

    const medir = () => {
      const caixa = el.getBoundingClientRect();
      centro = caixa.top + window.scrollY + caixa.height / 2;
    };

    const pintar = () => {
      pedido = 0;
      const meio = window.scrollY + window.innerHeight / 2;
      const desvio = (meio - centro) * forca;
      el.style.transform = `translate3d(0, ${desvio.toFixed(2)}px, 0)`;
    };

    const aoRolar = () => {
      if (pedido) return;
      pedido = requestAnimationFrame(pintar);
    };

    medir();
    pintar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", () => {
      medir();
      aoRolar();
    });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, [forca]);

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
