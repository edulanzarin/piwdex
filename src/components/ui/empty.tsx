import type { ReactNode } from "react";
import { Pokeball } from "./pokeball";
import { Sprite } from "./sprite";

/** Arte do estado vazio. `filtro` = a busca nao devolveu nada; `espera` = a
 *  ferramenta ainda nao recebeu entrada. Sao estados DIFERENTES e a tela nao
 *  pode dizer a mesma coisa nos dois: "nada bateu" pede pra afrouxar o filtro,
 *  "esperando" pede pra preencher o campo. */
export type ArteVazio = "filtro" | "espera";

const ARTE: Record<ArteVazio, string> = {
  filtro: "/images/icons/vazio.png",
  espera: "/images/icons/vazio.png",
};

/**
 * Estado vazio. Nunca e so "nada encontrado": diz o que aconteceu E oferece a
 * acao que resolve, senao o usuario fica olhando pra uma tela morta sem saber
 * que basta limpar um filtro.
 *
 * A arte deixou de ser a pokebola da MARCA apagada em cinza. Ela aparece no topo
 * de toda pagina e no carregamento de todo sprite — repeti-la aqui, morta, nao
 * informava nada e ainda dizia a coisa errada nas telas que nao falam de
 * pokemon (item, local de caca, golpe). O funil diz o que de fato aconteceu:
 * passou pelo filtro e nao sobrou nada.
 */
export function Empty({
  title,
  hint,
  action,
  arte = "filtro",
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  arte?: ArteVazio;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <Sprite
        src={ARTE[arte]}
        alt=""
        size={72}
        className="opacity-80"
        fallback={<Pokeball size={40} className="text-line-strong" />}
      />
      <p className="pix text-[13px] text-text-dim">{title}</p>
      {hint ? <p className="max-w-sm text-[14px] leading-relaxed text-text-mute">{hint}</p> : null}
      {action}
    </div>
  );
}
