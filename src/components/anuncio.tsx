"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  ADSENSE_CLIENT,
  LAYOUTS,
  SLOTS,
  mostrarAnuncio,
  temSlot,
  type LugarDeAnuncio,
} from "@/lib/ads";

/**
 * Uma unidade de anuncio.
 *
 * A forma tem duas camadas de proposito — uma casca ESTAVEL que reserva o espaco
 * e um filho KEYADO que carrega o `<ins>` e o efeito. Cada camada resolve uma
 * armadilha que so aparece depois de publicado:
 *
 * 1. **O `push` roda uma vez por `<ins>`.** Em StrictMode o efeito monta duas
 *    vezes no MESMO no; o segundo `push` derruba a unidade com "All ins elements
 *    in the DOM with class=adsbygoogle already have ads in them". Guarda por
 *    `ref` — atributo do DOM nao serve, porque enquanto o script nao baixou os
 *    dois pushes so entram na fila e o erro estoura depois.
 * 2. **Trocar de rota precisa de `<ins>` NOVO.** Em `/dex/1` -> `/dex/2` a arvore
 *    e identica: o React reconcilia, o no persiste com o anuncio anterior dentro
 *    e o efeito nao roda. Nao adianta por `pathname` na lista de dependencias — o
 *    elemento reivindicado continua o mesmo e o push da erro. O que force o no a
 *    morrer e a `key`; e como o `ref` vive no componente keyado, ele nasce limpo
 *    junto. Por isso o efeito e o ref moram no FILHO, e nao aqui fora.
 * 3. **`key` leva a rota e SO a rota.** Keyar por filtro (search params) pediria
 *    anuncio novo a cada clique — inflacao de impressao, e o Google trata isso
 *    como trafego invalido.
 * 4. **Sem conta, sem requisicao.** O gate e a variavel de ambiente, que o Next
 *    inlina no build: sem ela, o `<ins>` nao existe e o script nao carrega. E o
 *    unico jeito honesto de desenvolver — anuncio em localhost nao serve, suja o
 *    console e conta como trafego invalido.
 */

type Formato = "auto" | "fluid";

export interface AnuncioProps {
  lugar: LugarDeAnuncio;
  formato?: Formato;
  /** `data-ad-layout-key` do painel, so nas unidades de feed */
  layoutKey?: string;
  /** altura reservada. Comece pelo tamanho MAIS PROVAVEL do relatorio de
   *  criativos do AdSense; ate ter dado, e chute honesto. */
  minH?: number;
  /** rotulo "Publicidade" em cima — a politica so aceita esta familia de palavras */
  rotulo?: boolean;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export function Anuncio({ lugar, formato = "auto", layoutKey, minH = 120, rotulo, className }: AnuncioProps) {
  const pathname = usePathname();
  const ligado = temSlot(lugar);

  // Em producao, lugar sem slot nao desenha NADA — nem o rotulo, nem a altura
  // reservada. Deixar a casca de pe era o que fazia o site ir ao ar com uma
  // caixa vazia dizendo "Publicidade".
  if (!mostrarAnuncio(lugar)) return null;

  return (
    // `data-anuncio` e o que o balao de apoio observa pra nunca cobrir um anuncio:
    // conteudo do site por cima de anuncio do Google e violacao de politica.
    // A altura fica na CASCA e nao no `<ins>` (o `<ins>` e do Google), e e
    // `min-height` pra unidade maior poder crescer sem empurrar a pagina.
    <div className={cn("w-full", className)} data-anuncio="">
      {rotulo ? (
        <span className="pix block pb-1 text-[10px] text-text-mute">Publicidade</span>
      ) : null}
      <div className="w-full" style={{ minHeight: minH, contain: "layout" }}>
        {ligado ? (
          <Unidade key={`${lugar}:${pathname}`} lugar={lugar} formato={formato} layoutKey={layoutKey} />
        ) : (
          <Reservado lugar={lugar} />
        )}
      </div>
    </div>
  );
}

/** O `<ins>` e o `push`. Existe separado pra a `key` poder mata-lo por inteiro —
 *  e o ref nascer limpo junto com ele. */
function Unidade({
  lugar,
  formato,
  layoutKey,
}: {
  lugar: LugarDeAnuncio;
  formato: Formato;
  layoutKey?: string;
}) {
  const empurrado = useRef(false);

  useEffect(() => {
    if (empurrado.current) return;
    empurrado.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // bloqueador de anuncio, script que nao carregou: a pagina segue inteira
    }
  }, []);

  return (
    <ins
      // A classe e o SELETOR que o script do Google varre. Ela vai sozinha, sem
      // utilitario junto: um `cn()` que reordene ou coma a classe deixa a unidade
      // invisivel pro AdSense, e nada acontece — sem erro nenhum.
      className="adsbygoogle"
      style={{ display: "block", width: "100%" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={SLOTS[lugar]}
      data-ad-format={formato}
      data-ad-layout-key={layoutKey}
      data-full-width-responsive="true"
      // o Google escreve atributos neste no depois da hidratacao; isto evita o
      // aviso do React sem esconder problema de verdade
      suppressHydrationWarning
    />
  );
}

/** O lugar do anuncio enquanto nao ha conta. So se chega aqui fora de producao —
 *  quem barra em producao e o `mostrarAnuncio`, antes da casca. Ele tem a MESMA
 *  geometria da unidade real, pra dar pra desenhar contra o layout que vai ao
 *  ar. */
function Reservado({ lugar }: { lugar: LugarDeAnuncio }) {
  return (
    <div
      aria-hidden="true"
      className="grid h-full min-h-inherit w-full place-items-center border border-dashed border-line-strong bg-bg-soft/90 p-4"
    >
      <span className="pix text-[11px] text-text-mute">espaço de anúncio · {lugar}</span>
    </div>
  );
}

/**
 * O anuncio no meio da grade.
 *
 * Ele ocupa uma celula como qualquer card, mas **nao pode vestir a roupa do card
 * de pokemon**. A politica do AdSense chama isso de formatacao mimetica, e antes
 * de ser violacao e trapaça com quem esta varrendo a grade procurando um bicho.
 * Por isso ele nao tem o vidro do `.panel`, nao tem hover, nao tem cursor de
 * link, e nao carrega nenhum marcador de identidade do card (numero da dex, badge
 * de tipo, espinha de stats).
 *
 * O rotulo em cima diz "Publicidade" — uma das palavras que a politica aceita.
 * Qualquer outra ("Recomendados", "Veja tambem", "Recursos") e violacao de titulo
 * enganoso, e nao ha meio termo aqui.
 */
export function CardAnuncio({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden border border-line-strong bg-bg-soft/95",
        className,
      )}
    >
      <span className="pix border-b border-line-strong px-3 py-1.5 text-[10px] text-text-mute">
        Publicidade
      </span>
      <Anuncio
        lugar="grade"
        formato="fluid"
        /* String vazia vira `data-ad-layout-key=""` no HTML, e atributo vazio nao
           e a mesma coisa que atributo ausente pro script do Google. */
        layoutKey={LAYOUTS.grade || undefined}
        minH={220}
        className="flex-1 p-2"
      />
    </div>
  );
}
