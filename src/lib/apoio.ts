// O apoio ao piwdex, num lugar so.
//
// Sao DOIS caminhos, e eles nao competem — um custa dinheiro, o outro nao custa
// nada:
//
//  1. **Mandar o quanto quiser** por um link de pagamento fixo. Quem decide o valor
//     e quem paga; o site nao sugere numero nem cria "plano".
//  2. **Usar o codigo de indicacao no jogo** ao comprar diamante. Nao muda o preco
//     pra quem compra e volta pro projeto — e por isso ele vem PRIMEIRO na tela:
//     e o apoio que a maioria consegue dar.
//
// Trocar qualquer um dos dois e mexer numa linha aqui. Nenhum componente escreve o
// codigo nem a URL na mao.

/** Codigo de indicacao do Eduardo no Poke Idle World. */
export const CODIGO_APOIO = "DQVF6Q2";

/** O jogo, ja com a indicacao aplicada. */
export const URL_JOGO = `https://poke.idleworld.online/?ref=${CODIGO_APOIO}`;

/**
 * Link fixo de pagamento, onde a pessoa escolhe quanto mandar.
 *
 * VAZIO ATE O EDUARDO CRIAR. Enquanto for string vazia, a tela simplesmente NAO
 * mostra o caminho do dinheiro — nada de botao que nao leva a lugar nenhum, nada
 * de "em breve" ocupando espaco. Preencher aqui liga o botao no rodape e no balao
 * ao mesmo tempo.
 */
export const URL_PAGAMENTO = "";

/** Tem caminho de dinheiro configurado? */
export const temPagamento = (): boolean => URL_PAGAMENTO.trim().length > 0;
