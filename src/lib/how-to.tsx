import type { HowToProps } from "@/components/ui";
import { IV_MAX } from "@/lib/stats";
import {
  QUALITY_DIFF_MAX,
  QUALITY_MAX_NORMAL,
  PHEROMONE_NORMAL_COUNT,
  BASE_STONES,
  DOUBLE_STONES,
} from "@/lib/breeding";

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

/** Breeding: par, ovo e planejador de Quality. */
export const COMO_USAR_BREED: Omit<HowToProps, "tint"> = {
  resumo:
    "Diz se o par presta, o que sai do ovo e quantos breeds faltam até a Quality que você quer.",
  passos: [
    {
      titulo: "Monte os dois pais",
      texto: (
        <>
          Mesma espécie, e a Quality dos dois a no máximo {QUALITY_DIFF_MAX.toFixed(3)} de
          distância — essas são as duas regras que o jogo só cobra na hora de confirmar. A
          barra de diferença mostra o quanto de folga ainda resta.
        </>
      ),
    },
    {
      titulo: "Digite os stats, não o IV",
      texto: (
        <>
          O jogo não mostra IV em lugar nenhum: ele mostra nível, quality e os seis stats.
          Copie esses números e a ferramenta inverte a fórmula pra achar o IV — a mesma
          conta da Calculadora. O resultado sai como FAIXA, porque o stat da tela já veio
          arredondado; em nível alto ela fecha num inteiro e dá pra cravar. Se você já
          calculou o IV noutro lugar, o botão "IV direto" aceita o número pronto.
        </>
      ),
    },
    {
      titulo: "Ponha no slot 1 o de melhor IV",
      texto: (
        <>
          O filho herda a distribuição de IV INTEIRA do pai de maior Quality, e os IVs do
          outro se perdem. Se as duas Qualities empatarem, quem doa é o slot 1 — é a única
          parte da regra que você controla depois de escolher os pais.
        </>
      ),
    },
    {
      titulo: "Salve na estante quem você vai reusar",
      texto:
        "Um clique devolve o pokémon pro slot 1 ou 2 sem redigitar nível, quality e seis stats. A estante guarda os stats junto, então o pai volta com a mesma faixa de IV que tinha — e ela fica só neste navegador, não viaja no link.",
    },
    {
      titulo: "Escolha o modo antes de olhar o ovo",
      texto: (
        <>
          Free só custa dinheiro e {BASE_STONES} Stones, mas sobe pouco. Pheromone sobe de
          {" "}{PHEROMONE_NORMAL_COUNT} Pheromones por vez e anda quinze vezes mais rápido — e
          é justamente o que arrisca estourar o teto e deixar o filho sem par.
        </>
      ),
    },
    {
      titulo: "Leia o ovo como sorteio, não como resultado",
      texto: (
        <>
          O jogo não entrega uma Quality, entrega quatro possíveis com probabilidade. A
          manchete é a MÉDIA; a faixa ao lado é o que pode realmente sair. Pokémon normal
          trava em {QUALITY_MAX_NORMAL.toFixed(3)} e o que passa disso é pago e perdido.
        </>
      ),
    },
    {
      titulo: "Use o planejador antes de gastar",
      texto:
        "Ele diz quantos breeds faltam até o alvo em três números — melhor caso, típico e azarado — com o dinheiro, as Stones e quantos pokémon da espécie a corrente inteira consome. Orçe pelo azarado: parar no meio da corrente é o pior lugar pra ficar sem dinheiro.",
    },
  ],
  bomSaber: [
    <>
      Os dois pais são consumidos em todo breed, e cada breed devolve um só. Uma corrente de
      N breeds custa N+1 pokémon da espécie, e esse é o custo que ninguém orça.
    </>,
    <>
      Double Stones dobra a conta de Stones ({BASE_STONES} para {DOUBLE_STONES}) por 5% de +1
      IV num stat abaixo de {IV_MAX}. São 20 breeds por ponto esperado — e zero se os seis
      stats já estiverem no teto.
    </>,
    <>
      Um pai Shiny faz o filho nascer Shiny e tira o teto de Quality. A chance de Shiny
      espontâneo entre dois pais normais ainda é regra provisória, e a tela marca isso.
    </>,
    <>
      O planejador supõe que sempre existe um parceiro válido pro próximo breed. Achar esse
      parceiro é o trabalho que a tabela de sorteio não mostra.
    </>,
    <>
      Leitura de IV larga não é defeito da ferramenta, é falta de informação no stat da
      tela: em nível baixo, meia unidade de stat vale dezenas de IV. Subir o pai de nível
      antes de decidir é o que fecha a faixa.
    </>,
  ],
};
