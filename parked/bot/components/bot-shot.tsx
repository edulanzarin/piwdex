import Image from "next/image";
import { T } from "./locale-provider";

// Print de tela do cockpit na pagina de venda. O print e a prova — entao ele nao pode
// virar borrao: sao capturas de 1600px de largura, e encolher isso pra 360px de celular
// apaga justamente os numeros que convencem (XP/hora, dolares/hora, o time ao vivo).
// Solucao: moldura de vidro igual a do resto do site e, no celular, o print rola na
// HORIZONTAL dentro da propria moldura (min-w segurando a largura legivel) em vez de
// espremer. A pagina nunca rola de lado — so a caixa do print.
export function BotShot({
  src,
  width,
  height,
  altKey,
  captionKey,
  priority = false,
}: {
  src: string;
  width: number;
  height: number;
  altKey: string;
  captionKey: string;
  priority?: boolean;
}) {
  return (
    <figure className="flex flex-col gap-3">
      <div className="card overflow-hidden p-2 sm:p-3">
        <div className="overflow-x-auto">
          <Image
            src={src}
            width={width}
            height={height}
            priority={priority}
            sizes="(max-width: 640px) 900px, 100vw"
            alt=""
            className="h-auto w-full min-w-[56rem] rounded"
          />
        </div>
      </div>
      {/* legenda faz o trabalho do alt pra quem VE; o alt fica vazio pra leitor de tela
          nao ouvir a mesma frase duas vezes seguidas */}
      <figcaption className="text-center text-sm text-text-dim">
        <span className="sr-only"><T k={altKey} />. </span>
        <T k={captionKey} />
      </figcaption>
    </figure>
  );
}
