import type { HowToProps } from "@/components/ui";
import { IV_MAX } from "@/lib/stats";
import { SIM_IV, WILD_HP_MULT } from "@/lib/combat";
import { TOTAL_BOSSES } from "@/lib/bosses";
import { REFORCO_DANO } from "@/lib/stadium";
import { DEFAULT_IV } from "@/lib/meta";
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
 *
 * ## A voz
 *
 * O Eduardo leu o topo da Hunt e disse "muita frase de IA". O tique nao esta no
 * assunto, esta no RITMO, e sao tres:
 *
 * 1. o travessao no meio da frase, emendando uma segunda ideia que deveria ser
 *    outra frase;
 * 2. a construcao "nao e X, e Y", que gasta a negativa antes de dizer o que e;
 * 3. a explicacao que se justifica sozinha logo depois de ja ter sido dita.
 *
 * A regra deste arquivo passa a ser: comece pelo sujeito, termine antes de se
 * explicar, e use dois pontos onde o travessao so estava emendando. Nenhum dado
 * do jogo mudou nesta passada; o que mudou foi onde a frase respira.
 */

/** Calculadora de IV, Quality e Poder. */
export const COMO_USAR_CALC: Omit<HowToProps, "tint"> = {
  resumo:
    "Você copia os seis stats da tela do jogo. Ela devolve o IV que está escondido atrás deles e projeta o pokémon no nível que você quiser.",
  passos: [
    {
      titulo: "Escolha a espécie",
      texto:
        "É ela que dá as seis bases. Sem base não há com o que comparar os seus números: dois pokémon com o mesmo ataque na tela podem ter IV oposto.",
    },
    {
      titulo: "Copie o nível e a quality do jogo",
      texto:
        "Os dois estão na tela do pokémon. A quality vai com as casas decimais que aparecerem, porque 1.5 e 1.52 mudam a leitura inteira.",
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
          IV entre 0 e {IV_MAX}. Faixa larga não é erro seu. Em nível baixo, meia unidade de
          stat vale dezenas de IV; quando o pokémon sobe, ela fecha sozinha.
        </>
      ),
    },
    {
      titulo: "Projete o nível que te interessa",
      texto:
        "No painel Projeção, escolha o nível desejado pra ver os stats e o poder lá na frente. Ao lado vem quanto falta pro teto, que é o mesmo pokémon com IV perfeito.",
    },
    {
      titulo: "Compartilhe o resultado",
      texto:
        "O estado inteiro mora na URL, então copiar link já entrega o pokémon montado. A imagem é desenhada no seu navegador: nada do seu pokémon sai da máquina.",
    },
  ],
  bomSaber: [
    <>
      Se aparecer que nenhum IV explica os stats, o errado quase sempre é o nível ou a
      quality. Confira os dois antes de duvidar do pokémon.
    </>,
    <>Quality não muda com o nível. Ela só muda com breeding.</>,
    <>
      A projeção assume o IV mais provável da leitura. Enquanto a faixa estiver larga, o
      poder projetado também é estimativa.
    </>,
  ],
};

/** Breeding: par, ovo e planejador de Quality. */
export const COMO_USAR_BREED: Omit<HowToProps, "tint"> = {
  resumo:
    "Você monta os dois pais. Ela diz se o par é válido, que Quality o ovo pode sortear e quantos breeds ainda faltam até a que você quer.",
  passos: [
    {
      titulo: "Monte os dois pais",
      texto: (
        <>
          Mesma espécie, e a Quality dos dois a no máximo {QUALITY_DIFF_MAX.toFixed(3)} de
          distância. São as duas regras que o jogo só cobra na hora de confirmar. A barra de
          diferença mostra quanta folga ainda resta.
        </>
      ),
    },
    {
      titulo: "Digite os stats, não o IV",
      texto: (
        <>
          O jogo não mostra IV em lugar nenhum. Ele mostra nível, quality e os seis stats.
          Copie esses números e a ferramenta inverte a fórmula pra achar o IV, com a mesma
          conta da Calculadora. O resultado sai como FAIXA, porque o stat da tela já veio
          arredondado. Em nível alto ela fecha num inteiro e dá pra cravar. Se você já
          calculou o IV noutro lugar, o botão &quot;IV direto&quot; aceita o número pronto.
        </>
      ),
    },
    {
      titulo: "Ponha no slot 1 o de melhor IV",
      texto: (
        <>
          O filho herda a distribuição de IV INTEIRA do pai de maior Quality, e os IVs do
          outro se perdem. Se as duas Qualities empatarem, quem doa é o slot 1. É a única
          parte da regra que você controla depois de escolher os pais.
        </>
      ),
    },
    {
      titulo: "Salve na estante quem você vai reusar",
      texto:
        "Um clique devolve o pokémon pro slot 1 ou 2 sem redigitar nível, quality e seis stats. A estante guarda os stats junto, então o pai volta com a mesma faixa de IV que tinha. Ela fica só neste navegador e não viaja no link.",
    },
    {
      titulo: "Escolha o modo antes de olhar o ovo",
      texto: (
        <>
          Free só custa dinheiro e {BASE_STONES} Stones, mas sobe pouco. Pheromone consome
          {" "}{PHEROMONE_NORMAL_COUNT} Pheromones por vez e anda quinze vezes mais rápido, e
          é justamente ele que arrisca estourar o teto e deixar o filho sem par.
        </>
      ),
    },
    {
      titulo: "Leia o ovo como sorteio, não como resultado",
      texto: (
        <>
          O jogo não entrega uma Quality, entrega quatro possíveis com probabilidade. A
          manchete é a MÉDIA e a faixa ao lado é o que pode realmente sair. Pokémon normal
          trava em {QUALITY_MAX_NORMAL.toFixed(3)}, e o que passa disso é pago e perdido.
        </>
      ),
    },
    {
      titulo: "Use o planejador antes de gastar",
      texto:
        "Ele diz quantos breeds faltam até o alvo em três números: melhor caso, típico e azarado. Junto vêm o dinheiro, as Stones e quantos pokémon da espécie a corrente inteira consome. Orce pelo azarado, porque parar no meio da corrente é o pior lugar pra ficar sem dinheiro.",
    },
  ],
  bomSaber: [
    <>
      Os dois pais são consumidos em todo breed, e cada breed devolve um só. Uma corrente de
      N breeds custa N+1 pokémon da espécie, e esse é o custo que ninguém orça.
    </>,
    <>
      Double Stones dobra a conta de Stones ({BASE_STONES} para {DOUBLE_STONES}) por 5% de +1
      IV num stat abaixo de {IV_MAX}. Dá 20 breeds por ponto esperado, e zero se os seis
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
      Leitura de IV larga é falta de informação no stat da tela, não defeito da ferramenta.
      Em nível baixo, meia unidade de stat vale dezenas de IV. Subir o pai de nível antes de
      decidir é o que fecha a faixa.
    </>,
  ],
};

/** Hunt: onde caçar agora e a rota até um nível. */
export const COMO_USAR_HUNT: Omit<HowToProps, "tint"> = {
  resumo:
    "Ela simula o seu pokémon contra cada alvo do jogo, contando os dois lados da briga: o quanto você bate e o quanto apanha. Daí sai a ordem de onde caçar e o aviso de onde não dá.",
  passos: [
    {
      titulo: "Escolha o seu pokémon",
      texto:
        "Não existe 'a melhor hunt do jogo', existe a melhor hunt PRA ELE. A espécie define os golpes, e é o golpe contra o tipo do alvo que decide a velocidade de abate.",
    },
    {
      titulo: "Copie nível, quality e os stats",
      texto: (
        <>
          Os stats são opcionais: em branco, a simulação usa IV {SIM_IV} nos seis, que é a
          média do jogo. Preenchidos, a leitura de IV é a MESMA da calculadora, porque as
          duas telas não podem discordar sobre o mesmo pokémon.
        </>
      ),
    },
    {
      titulo: "Ajuste o cenário e mande calcular",
      texto:
        "Golpes de TM mudam a conta inteira, e todo golpe de poder 600 do jogo é TM. VIP soma 50% de XP. O tipo do dia multiplica o loot só nos alvos daquele tipo, e a captura desconta o preço das bolas. Com o cenário fechado, o botão simula os alvos de uma vez. Mexer nos campos depois disso não recalcula sozinho: o botão passa a dizer RECALCULAR.",
    },
    {
      titulo: "Leia a rota primeiro",
      texto:
        "Ela responde a pergunta mais comum: até onde eu subo, e caçando o quê. Cada faixa traz a hunt, os dois lados do combate e quantas horas ela custa. No topo vem o tempo e o ouro da subida inteira.",
    },
    {
      titulo: "Leia as DUAS colunas de combate",
      texto:
        "'Você bate' é metade da história. A vantagem elemental vale pros dois lados: um alvo que você bate x2.5 pode te bater x2.5 de volta e te derrubar no primeiro golpe. Por isso toda linha traz o risco junto.",
    },
    {
      titulo: "Abra 'todas as hunts' pra comparar",
      texto:
        "A segunda aba é o catálogo inteiro medido contra o seu pokémon, uma linha por alvo. Ordene pelo cabeçalho: XP/h pra subir, ouro/h pra farmar, abates/h pra velocidade, efetividade pra achar onde o seu golpe é super efetivo. Clicar de novo inverte a ordem, e clicar na linha abre a ficha da hunt.",
    },
    {
      titulo: "Ligue a captura se você caça pra vender",
      texto:
        "O jogo gasta uma bola por abate, capturando ou não. Com a captura ligada, o ouro/h já desconta o custo das bolas. A ficha da hunt mostra quantos abates uma captura custa e quando a bola cara torra mais do que a venda devolve.",
    },
  ],
  bomSaber: [
    <>
      O rendimento aqui é EFETIVO: se a hunt te derruba, o tempo parado no desmaio e na Joy
      já saiu do XP/h antes da lista ser ordenada. Hunt que te mata não ganha de hunt que
      rende.
    </>,
    <>
      Na hunt o selvagem tem {WILD_HP_MULT}x o HP normal e bate mais forte. É regra do jogo,
      não peso inventado aqui.
    </>,
    <>
      O jogo não publica a fórmula de dano nem a de captura. Tudo nesta tela é estimativa
      calibrada contra medições reais. Serve pra COMPARAR hunts e dar a ordem de grandeza,
      e não como número exato.
    </>,
    <>
      A chance de captura sai de uma lei derivada do valor de venda, com erro mediano de
      ~1,9x. Ela ordena alvos bem, mas o número de bolas é aproximação.
    </>,
    <>
      A rota não evolui ninguém. Evoluir reseta o nível e não re-rola IV nem quality, então o
      pokémon que você escolheu é o pokémon do começo ao fim.
    </>,
  ],
};

/** Meta: tier list, duelo e panorama de tipos. */
export const COMO_USAR_META: Omit<HowToProps, "tint"> = {
  resumo:
    "Ela dá nota a cada espécie por dano por segundo e por quanto ela aguenta, e usa essa nota pra montar a tier list, o duelo e o panorama de tipos.",
  passos: [
    {
      titulo: "Escolha o pool antes de olhar a nota",
      texto:
        "Todo golpe de poder 600 do jogo é TM. Com TM a lista responde “quem presta se eu comprar a máquina”; só naturais responde “quem presta com o que eu já tenho”. São duas listas diferentes, e a régua de corte de cada tier muda junto.",
    },
    {
      titulo: "Leia o tier como NOTA, não como fila",
      texto:
        "O corte é por pontuação, e o piso de cada faixa fica ao lado da letra. Isso importa num jogo que recebe patch: se trinta espécies forem buffadas, elas sobem de tier. Num corte por posição (top 10% = S), alguém teria que descer pra abrir vaga.",
    },
    {
      titulo: "Abra o perfil pra saber de onde vem a nota",
      texto:
        "Clicar num pokémon mostra os dois eixos separados (bater e aguentar), o golpe que define a velocidade dele e onde cada stat cai dentro do catálogo. No fim vem quem derruba ele, medido pelos dois lados do duelo e não só por quem tem o tipo certo.",
    },
    {
      titulo: "Use o duelo pro seu pokémon, não pra espécie",
      texto: (
        <>
          A tier list compara espécies; o duelo compara INDIVÍDUOS, com nível e quality de
          cada lado. Os dois usam o mesmo IV ({DEFAULT_IV} ou {IV_MAX}) de propósito: assim
          a diferença que aparece é de espécie, nível e quality, e não de sorte de IV.
        </>
      ),
    },
    {
      titulo: "Marque o adversário como selvagem quando for caçada",
      texto: (
        <>
          Na hunt o selvagem tem {WILD_HP_MULT}x o HP e bate mais forte. É por isso que
          “ganho dele no duelo” não quer dizer “caço ele em paz”: com o reforço ligado, o
          mesmo confronto costuma virar.
        </>
      ),
    },
    {
      titulo: "Vá em Tipos quando a pergunta for de time",
      texto:
        "A aba mostra com que tipo o jogo bate mais forte, qual pokémon carrega esse tipo e quantas espécies o têm. É a resposta pra “meu time não tem nada de Pedra, quem eu pego?”.",
    },
  ],
  bomSaber: [
    <>
      A nota combina bater (55%) e aguentar (45%). Bater é dano por SEGUNDO, com a recarga
      do golpe dentro: um golpe de 160 com 30s de recarga rende menos que um de 60 a cada
      5s, e medir só o poder inverte a ordem.
    </>,
    <>
      Aguentar é HP VEZES defesa, não HP mais defesa. 200 de vida com 20 de defesa aguenta
      dez vezes mais que o contrário, e a soma esconde exatamente isso.
    </>,
    <>
      Velocidade fica fora da nota. O que se observa jogando é ela encurtar a recarga, e se
      for isso, ela multiplica o eixo de ataque em vez de somar. Sem a fórmula publicada,
      dar peso a ela seria inventar número.
    </>,
    <>
      Quem derruba quem mede os DOIS lados: entra na lista quem ganha a corrida do abate, e
      não quem simplesmente tem golpe super efetivo contra você.
    </>,
    <>
      Variantes de skin não entram na lista, porque apontam pra espécie base e não são uma
      linha própria do catálogo. As de Orre entram, porque têm stats próprios.
    </>,
  ],
};

export const COMO_USAR_STADIUM: Omit<HowToProps, "tint"> = {
  resumo:
    "Você cadastra seus pokémon com os stats que o jogo mostra, escolhe o boss, monta o time de seis e a ferramenta roda a luta inteira: quem entra, quanto tira do boss, quem cai e onde o time quebra.",
  passos: [
    {
      titulo: "Comece pelo boss, não pelo time",
      texto: (
        <>
          O catálogo traz os {TOTAL_BOSSES} bosses do jogo com o nível oficial de cada um.
          O tipo do boss é o que mais muda a resposta, então escolher ele primeiro evita
          montar seis contra o alvo errado. Se o boss que você quer não estiver na lista,
          monte o alvo à mão pela espécie.
        </>
      ),
    },
    {
      titulo: "Cadastre seus pokémon como CARTA",
      texto:
        "A carta pede os seis stats da tela do jogo, mais nível e quality. É com esses números que o combate roda: nada de IV suposto, porque IV é justamente o que o jogo esconde. A carta fica salva neste navegador, na bolsa, e serve também de pai no Breeding.",
    },
    {
      titulo: "Guarde o time como DECK",
      texto:
        "Um deck aponta pras cartas, não copia os números. Subiu o Charizard de 300 pra 340? Corrige a carta uma vez e todo deck em que ele está passa a contar a verdade. Sem login não há nuvem: bolsa e decks moram neste navegador, então limpar os dados do site leva os dois.",
    },
    {
      titulo: "Ponha os seis na ORDEM em que eles entram",
      texto:
        "A fila é a fila do combate: o primeiro segura o começo, e quem vem depois pega o boss com o HP que sobrou. A ferramenta não reordena o time por conta própria, porque a ordem é decisão sua e trocar em silêncio esconderia o efeito dela.",
    },
    {
      titulo: "Leia a FATIA de cada um antes do veredito",
      texto:
        "Fatia é quanto do boss aquele pokémon leva embora antes de cair. É o número que se soma de cabeça: três de 40% derrubam. Dano por segundo alto pode virar fatia zero, e não é erro de conta: cada golpe tem recarga própria, e quem cai em dez segundos nunca chega a disparar o de quarenta.",
    },
    {
      titulo: "Confira o nível antes de trocar de espécie",
      texto:
        "Boss começa no nível 300 e vai até o 625. Na maior parte dos casos o que separa o time de uma queda rápida é o nível: subir vinte costuma mexer mais no resultado do que trocar o time inteiro.",
    },
    {
      titulo: "Ligue o TM só se você tem a máquina",
      texto:
        "Todo golpe de poder 600 do jogo é TM. Com o pool de TM ligado, o combate simulado usa golpes que o seu pokémon só tem depois de comprar a máquina, e a diferença chega a dez vezes de dano por segundo.",
    },
  ],
  bomSaber: [
    <>
      Os dois lados não têm a mesma certeza, e a tela não finge que têm. O seu time entra
      com os stats que você copiou do jogo. O boss não: o jogo não publica stat de boss,
      então os seis números dele saem de nível, quality e o IV suposto no controle do topo.
    </>,
    <>
      O jogo também não publica tipo de boss. O que a ferramenta faz é usar a espécie de
      que ele é feito: “Mega Alakazam Lv 350” entra como um Mega Alakazam de nível 350.
      Isso acerta o tipo e a ordem de grandeza; não acerta stat próprio de boss.
    </>,
    <>
      Trinta e seis dos {TOTAL_BOSSES} não são pokémon nenhum. A categoria Terror inteira e
      os humanos da Rocket são criação do jogo, e para eles não há espécie de onde tirar
      tipo e stat. Eles continuam na lista com nível e drops, e a tela diz que não simula.
    </>,
    <>
      O boss leva o reforço da caçada: {WILD_HP_MULT}x o HP e dano {REFORCO_DANO}x. É o que
      o jogo documenta pro lado selvagem, e é por isso que ganhar aqui não é a mesma coisa
      que ganhar no duelo do Meta.
    </>,
    <>
      Falta uma peça, e ela é grande. O jogo aplica uma penalidade de GRUPO que não está
      publicada: a resposta dele traz <code>mult</code> e <code>deficit</code> por boss, e a
      relação entre os dois é exata (<code>mult = 3^deficit</code>). O que ninguém publicou é
      como a força do grupo se calcula e o que esse fator multiplica. Um fator dessa ordem
      dominaria todo o resto do resultado, então ele fica de fora da conta em vez de entrar
      como chute.
    </>,
  ],
};
