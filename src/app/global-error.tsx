"use client";

import { Button, ButtonLink, Chip, Pokeball } from "@/components/ui";
import "./globals.css";

/**
 * O ultimo fio de seguranca.
 *
 * O `error.tsx` embrulha o conteudo da rota, mas nao o layout que esta acima
 * dele. Se quem quebrar for o proprio `layout.tsx` raiz — a fonte, o
 * `metadataBase`, a leitura de `temAnuncios()` —, nao ha boundary nenhum por
 * cima e a resposta volta a ser a tela padrao do Next. Este arquivo e o boundary
 * que existe acima de tudo.
 *
 * A regra dele e diferente da do `error.tsx`, e e o que dita o formato daqui:
 * quando ele entra em cena ele SUBSTITUI o layout raiz. Nao ha `<html>`, nao ha
 * `<body>`, nao ha o CSS que o layout importa e nao ha a variavel de fonte que o
 * `next/font` pendura na `<html>`. Tudo que esta tela precisa ela declara aqui —
 * e nada do que ela declara pode depender do que acabou de quebrar. Dai:
 *
 * - o `import "./globals.css"` proprio, senao nao existe nem token de cor nem
 *   `.pix`, e a tela de socorro sai sem tema;
 * - `[--font-ui:system-ui]` na `<html>`: `--font-ui-stack` comeca com
 *   `var(--font-ui)`, e com essa variavel indefinida a declaracao INTEIRA fica
 *   invalida e a pagina cai no serif do navegador. A fonte do sistema aqui e de
 *   proposito: baixar webfont na tela que socorre um site que caiu e pendurar a
 *   ultima chance numa requisicao de rede;
 * - so `Pokeball`, `Chip` e os botoes — primitivas de desenho puro, sem dado e
 *   sem layout, entao elas nao conseguem reproduzir a falha que trouxe a pessoa
 *   ate aqui.
 *
 * `metadata` nao existe em error boundary (ele e Client Component obrigatorio),
 * entao o titulo da aba vem do `<title>` do React 19, que o proprio React leva
 * pro `<head>`.
 */
export default function ErroGlobal({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="pt-BR" className="[--font-ui:system-ui]">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-16 text-center antialiased">
        <title>Erro — PIWdex</title>

        <Pokeball size={88} className="text-danger" />

        {/* Sem `.panel` aqui: o vidro depende de `backdrop-filter` sobre o
            wallpaper, e wallpaper e mais uma coisa que pode nao ter carregado
            quando se chega nesta tela. O fundo chapado do `body` basta. */}
        <div className="flex max-w-lg flex-col items-center gap-4">
          <h1 className="pix text-[24px] normal-case text-text">
            PIW<span className="text-accent">dex</span>
          </h1>
          <p className="pix text-[15px] text-danger">o site caiu nesta página</p>
          <p className="text-[15px] leading-relaxed text-text-dim">
            A falha aconteceu antes de qualquer parte do PIWdex conseguir aparecer.
            Recarregar costuma resolver; se não resolver, é problema do site e já está
            registrado no log.
          </p>

          {error.digest ? (
            <Chip tone="danger" title="Código desta falha no log do servidor">
              falha {error.digest}
            </Chip>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Mesmo motivo do `error.tsx`: `retry()` refaz a busca, `reset()` so
                re-renderiza o que ja falhou. */}
            <Button variant="primary" size="lg" onClick={() => retry()}>
              tentar de novo
            </Button>
            {/* Ancora de verdade, com recarga completa: quando esta tela aparece,
                o layout raiz nao subiu, entao contar com o roteador do cliente pra
                sair daqui e contar com a peca que acabou de quebrar. */}
            <ButtonLink href="/" size="lg">
              voltar pro início
            </ButtonLink>
          </div>
        </div>
      </body>
    </html>
  );
}
