import type { HowToProps } from "@/components/ui";
import { IV_MAX } from "@/lib/stats";

/**
 * O texto dos manuais das ferramentas.
 *
 * Mora aqui, e nao dentro da tela, por dois motivos. O primeiro e que manual e
 * CONTEUDO: revisar a redacao de tres ferramentas nao pode exigir abrir tres
 * componentes de UI e desviar de JSX de layout. O segundo e que o texto tem que
 * ficar honesto sozinho — a regra "cada IV vira faixa" sai de `IV_MAX` e da
 * formula, entao o numero e importado em vez de digitado, e nao ha como o
 * manual passar a mentir depois de um ajuste na conta.
 *
 * Uma constante por ferramenta. Catalogo (dex, itens) NAO tem manual: ele abre
 * cheio, o conteudo se explica de olhar, e um passo a passo ali seria o site
 * ensinando a rolar uma lista.
 */

/** Calculadora de IV, Quality e Poder. */
export const COMO_USAR_CALC: Omit<HowToProps, "tint"> = {
  resumo:
    "Descobre o IV que o jogo esconde a partir dos stats que ele mostra — e projeta o pokémon em qualquer nível.",
  passos: [
    {
      titulo: "Escolha a espécie",
      texto:
        "É ela que dá as seis bases. Sem base não há com o que comparar os seus números — dois pokémon com o mesmo ataque na tela podem ter IV oposto.",
    },
    {
      titulo: "Copie o nível e a quality do jogo",
      texto:
        "Os dois estão na tela do pokémon. A quality vai com as casas decimais que aparecerem: 1.5 e 1.52 mudam a leitura inteira.",
    },
    {
      titulo: "Digite os seis stats como o jogo mostra",
      texto:
        "Vida, ataque, defesa, atq. esp., def. esp. e velocidade, sem arredondar e sem somar bônus de item. É o número da tela, cru.",
    },
    {
      titulo: "Leia o IV como faixa, não como nota",
      texto: (
        <>
          O jogo já arredondou o stat antes de mostrar, então cada stat aceita um intervalo de
          IV entre 0 e {IV_MAX}. Faixa larga não é erro seu: em nível baixo meia unidade de stat
          vale dezenas de IV. Subiu de nível, ela fecha.
        </>
      ),
    },
    {
      titulo: "Projete o nível que te interessa",
      texto:
        "No painel Projeção, escolha o nível desejado pra ver os stats e o poder lá na frente — e quanto falta pro teto, que é o mesmo pokémon com IV perfeito.",
    },
    {
      titulo: "Compartilhe o resultado",
      texto:
        "O estado inteiro mora na URL, então copiar link já entrega o pokémon montado. A imagem é desenhada no seu navegador; nada do seu pokémon sai da máquina.",
    },
  ],
  bomSaber: [
    <>
      Se aparecer que nenhum IV explica os stats, o errado quase sempre é o nível ou a quality —
      confira os dois antes de duvidar do pokémon.
    </>,
    <>Quality não muda com o nível. Ela só muda com breeding.</>,
    <>
      A projeção assume o IV mais provável da leitura: enquanto a faixa estiver larga, o poder
      projetado também é estimativa.
    </>,
  ],
};
