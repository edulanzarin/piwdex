import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconChevronDown } from "./icons";

/**
 * "Como usar" — o manual curto de uma FERRAMENTA.
 *
 * Existe porque catalogo e ferramenta se explicam de jeitos diferentes. A dex e
 * a lista de itens sao vitrine: o conteudo aparece sozinho e o visitante entende
 * so de olhar. Ferramenta e o contrario — ela abre VAZIA, esperando que alguem
 * saiba de onde tirar os numeros que ela pede. Sem manual, a tela mais util do
 * site e a que mais parece inacabada.
 *
 * Tres decisoes seguram a forma:
 *
 * 1. **O resumo fica SEMPRE visivel, o passo a passo nao.** Uma frase dizendo a
 *    pergunta que a ferramenta responde e o que o visitante de primeira viagem
 *    precisa; os seis passos sao referencia, e quem ja usou nao quer rolar por
 *    cima deles toda vez. Manual aberto por padrao empurra a ferramenta pra
 *    fora da primeira tela — que e o unico lugar onde ela funciona.
 * 2. **`<details>` e nao estado de React.** Abrir e fechar aqui e chrome, nao
 *    dado: nao vai pra URL, nao precisa de efeito, nao precisa de JS. Assim o
 *    bloco continua sendo componente de SERVIDOR e o manual ja nasce no HTML —
 *    inclusive pro buscador, que e quem traz gente nova.
 * 3. **O tint e da ferramenta.** Mesma cor que identifica a ferramenta na home e
 *    na navegacao, pra o manual ser lido como parte dela e nao como aviso do
 *    site.
 */
export interface HowToStep {
  /** o verbo do passo — curto, cabe numa linha */
  titulo: string;
  /** o porque e a armadilha; e aqui que o passo vira util */
  texto: ReactNode;
}

export interface HowToProps {
  /** a pergunta que a ferramenta responde, em uma frase. Sempre visivel. */
  resumo: ReactNode;
  passos: HowToStep[];
  /** o que a ferramenta NAO faz, e onde ela erra. */
  bomSaber?: ReactNode[];
  /** cor da ferramenta (`var(--color-t-calc)` e afins) */
  tint?: string;
  className?: string;
}

export function HowTo({ resumo, passos, bomSaber, tint, className }: HowToProps) {
  const cor = tint ?? "var(--color-accent)";

  return (
    <details
      className={cn("panel group", className)}
      style={{
        borderColor: `color-mix(in oklab, ${cor} 34%, var(--color-line))`,
      }}
    >
      {/* O `summary` inteiro e o alvo do clique — faixa de 40px de altura em vez
          de um chevron de 16. E o marcador nativo sai: ele e um triangulo de
          sistema no meio de uma interface que desenha os proprios icones. */}
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="pix shrink-0 text-[12px]" style={{ color: cor }}>
          Como usar
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-text-dim group-open:whitespace-normal">
          {resumo}
        </span>
        <IconChevronDown
          size={16}
          className="shrink-0 text-text-mute transition-transform duration-200 group-open:rotate-180"
        />
      </summary>

      <div className="flex flex-col gap-4 border-t border-line p-4">
        {/* Passo numerado, e o numero e PIXEL num quadrado da cor da ferramenta:
            a ordem tem que se ler de relance, sem contar linha. */}
        <ol className="flex flex-col gap-3">
          {passos.map((p, i) => (
            <li key={p.titulo} className="flex gap-3">
              <span
                className="pix mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pix text-[12px] tabular"
                style={{
                  color: cor,
                  backgroundColor: `color-mix(in oklab, ${cor} 16%, transparent)`,
                  border: `1px solid color-mix(in oklab, ${cor} 45%, transparent)`,
                }}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-text">{p.titulo}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-text-dim">
                  {p.texto}
                </span>
              </span>
            </li>
          ))}
        </ol>

        {/* A ressalva usa a MESMA voz italica de `Note` — e a ferramenta falando
            sobre si, nao mais um dado. Sem a caixa, porque aqui ja e um bloco de
            texto e caixa dentro de caixa vira ruido. */}
        {bomSaber?.length ? (
          <ul className="flex flex-col gap-1.5 border-t border-line pt-3">
            {bomSaber.map((b, i) => (
              <li
                key={i}
                className="flex gap-2 text-[13px] leading-relaxed text-text-mute italic"
              >
                <span aria-hidden="true" className="not-italic" style={{ color: cor }}>
                  ·
                </span>
                <span className="min-w-0 flex-1">{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
