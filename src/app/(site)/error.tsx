"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Chip, Note, Panel, Pokeball, Sprite } from "@/components/ui";

/**
 * A tela de erro das rotas.
 *
 * Ate aqui nao havia NADA entre o `getData()` e o visitante. Bastava
 * `buildEntry`/`buildItemEntry` tropecar num registro novo do jogo — campo que o
 * catalogo passou a mandar nulo, especie sem golpe, drop apontando pra item que
 * saiu — pra a rota responder 500 com a tela padrao do Next: fundo branco, texto
 * em ingles, nada do site. Numa dex que le um catalogo de terceiro que muda
 * sozinho, isso nao e hipotese remota; e o modo de falha mais provavel que existe.
 *
 * `error.tsx` embrulha `page`, `loading` e `not-found` do segmento e de tudo que
 * esta abaixo dele num error boundary do React. Ele NAO cobre o `layout.tsx`
 * raiz — quem cobre e o `global-error.tsx` ao lado.
 */
export default function ErroDaRota({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Em producao a `message` que chega no cliente e generica de proposito (o
    // Next nao vaza detalhe do servidor pra ca). O que presta e o `digest`: e ele
    // que casa com a linha do log do servidor. Por isso ele tambem aparece NA
    // TELA — sem ele, um relato de bug e "deu erro" e nao da pra achar nada.
    console.error("[piwdex] erro na rota", error.digest ?? "sem digest", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-10">
      <Panel title="Erro" scan>
        <div className="flex flex-col items-center gap-5 px-2 py-8 text-center">
          {/* A bola em cor de perigo, e nao a pokebola vermelha da marca: aqui ela
              nao esta assinando o site, esta dizendo o que aconteceu. */}
          {/* A mesma arte do 404 — as duas telas dizem "isto aqui quebrou", e
              usar o mesmo desenho e o que faz a pessoa reconhecer o estado antes
              de ler. O `fallback` importa mais aqui do que em qualquer outra
              tela: se a pagina de erro depender de um PNG que nao carregou, ela
              vira a segunda falha em cima da primeira. */}
          <Sprite
            src="/images/icons/quebrada.png"
            alt=""
            size={96}
            className="[--sprite:76px] sm:[--sprite:96px]"
            fallback={<Pokeball size={72} className="text-danger" />}
          />

          <h1 className="pix text-[22px] text-text">Algo quebrou aqui</h1>

          <p className="max-w-md text-[15px] leading-relaxed text-text-dim">
            A página carregou, mas o PIWdex não conseguiu montar o conteúdo dela.
            Quase sempre é o catálogo do jogo ter mudado de forma e o site ainda não
            saber ler o registro novo.
          </p>

          {error.digest ? (
            <Chip tone="danger" title="Código desta falha no log do servidor">
              falha {error.digest}
            </Chip>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* `retry()`, e nao `reset()`. Os dois chegam por prop e a diferenca
                importa exatamente no caso daqui: `reset()` so limpa o estado do
                boundary e re-renderiza o MESMO payload ja buscado — se o que
                quebrou foi a leitura do catalogo, o botao nao faz nada e a tela
                volta pro erro no mesmo quadro, que e a pior especie de botao.
                `retry()` refaz a busca antes de re-renderizar, que e a unica
                forma de uma falha temporaria da fonte se resolver sozinha.
                Estavel desde o Next 16.3 (aqui roda 16.3.1). */}
            <Button variant="primary" size="lg" onClick={() => retry()}>
              tentar de novo
            </Button>
            <ButtonLink href="/" size="lg">
              voltar pro início
            </ButtonLink>
          </div>

          <Note className="text-left">
            Se acontecer de novo no mesmo endereço, o problema é do site e não da sua
            conexão — e o código da falha acima é o que identifica ela no log.
          </Note>
        </div>
      </Panel>
    </div>
  );
}
