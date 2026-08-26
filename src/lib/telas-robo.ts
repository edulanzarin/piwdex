import {
  Award,
  Bot,
  Cable,
  IdCard,
  KeyRound,
  MessageSquare,
  ScrollText,
  SlidersHorizontal,
  Store,
  Target,
  type LucideIcon,
} from "lucide-react";
import { iconeUrl } from "./ferramentas";

/**
 * As telas do ROBÔ, num lugar só — o espelho do `FERRAMENTAS` da dex.
 *
 * Ele nasce pelo mesmo motivo que o outro: nome, arte e frase de uma tela
 * estavam repetidos entre a navegação, o título da página e o cabeçalho de cada
 * aba, e identidade escrita em três lugares é identidade que envelhece em dois.
 *
 * ## Uma cor só, e é decisão, não esquecimento
 *
 * Cada ferramenta da dex tem a sua cor, porque lá a cor responde "onde estou"
 * num site de dez destinos. Aqui são as telas de UM produto, e pintar cada uma
 * de um matiz inventaria dez identidades para um painel só — a barra do robô já
 * tinha decidido isso, e a arte segue a decisão.
 *
 * Então quem separa uma tela da outra é a **silhueta**, que é o mesmo critério
 * dos glifos de domínio: chave, elo, passe, crachá, bola arremessada,
 * engrenagem, sacola, balão, fita. Nenhuma das nove vira a mancha da vizinha
 * quando encolhe.
 *
 * ## Por que a arte grande e o glifo pequeno convivem
 *
 * `arte` é ilustração de 128 desenhada pra ser lida a partir de uns 40px, e é o
 * que abre uma tela ou uma aba. `Icone` é glifo de traço, que é o que sobrevive
 * a 14px no trilho de abas. Usar a ilustração nos dois lugares parece
 * economia e devolve uma mancha colorida no trilho; usar o glifo nos dois
 * devolve uma tela sem chegada.
 */
export interface TelaRobo {
  /** a rota (`/painel`) ou a chave da aba (`cacada`) */
  id: string;
  nome: string;
  /** nome do SVG em public/images/icons, sem extensão */
  arte: string;
  /** glifo de reserva da arte, e o ícone de 14px do trilho de abas */
  Icone: LucideIcon;
  /** o verbo de propósito que prepara o nome grande */
  chamada: string;
  /** uma frase: o que se faz aqui */
  linha: string;
}

export const COR_ROBO = "var(--color-t-robo)";

export const TELAS_ROBO: TelaRobo[] = [
  {
    id: "/painel",
    nome: "Painel",
    arte: "robo",
    Icone: Bot,
    chamada: "O seu",
    linha: "A sessão do jogo é do robô enquanto ele estiver ligado — caçar, repor, vender e falar rodam em cima dela.",
  },
  {
    id: "/conectar",
    nome: "Conectar",
    arte: "robo-conectar",
    Icone: Cable,
    chamada: "Ligue a sua conta em",
    linha: "A conta do jogo entra aqui, e é ela que o robô passa a operar. Uma conta do PIWdex pode segurar mais de uma.",
  },
  {
    id: "/assinatura",
    nome: "Assinatura",
    arte: "robo-assinatura",
    Icone: Award,
    chamada: "O passe que abre o",
    linha: "Não é recorrência: cada pagamento soma 30 dias, e nada renova sozinho nas suas costas.",
  },
  {
    id: "/entrar",
    nome: "Entrar",
    arte: "robo-entrar",
    Icone: KeyRound,
    chamada: "A sua chave do",
    linha: "A conta é do PIWdex, e não do jogo. A do jogo entra depois, na tela de conectar.",
  },
  {
    id: "/criar-conta",
    nome: "Criar conta",
    arte: "robo-entrar",
    Icone: KeyRound,
    chamada: "A sua chave do",
    linha: "Uma conta do PIWdex, e nada do jogo ainda: aqui só entram e-mail e senha seus.",
  },
  {
    id: "conta",
    nome: "Conta",
    arte: "robo-conta",
    Icone: IdCard,
    chamada: "O que o jogo diz da sua",
    linha: "O time, a bolsa e o box da conta que está na tela, lidos do jogo agora.",
  },
  {
    id: "cacada",
    nome: "Caçada",
    arte: "robo-cacada",
    Icone: Target,
    chamada: "O que está acontecendo na",
    linha: "Onde o robô está caçando, o que ele abateu e o que entrou na fila de captura.",
  },
  {
    id: "automacao",
    nome: "Automação",
    arte: "robo-automacao",
    Icone: SlidersHorizontal,
    chamada: "Os interruptores da",
    linha: "O Auto-Helper do jogo: captura, poção e revive automáticos. O robô liga o interruptor, quem executa é o servidor de lá.",
  },
  {
    id: "loja",
    nome: "Loja",
    arte: "robo-loja",
    Icone: Store,
    chamada: "O balcão da",
    linha: "Repor consumível, vender drop e vender pokémon — tudo que mexe em ouro mora aqui, longe dos interruptores.",
  },
  {
    id: "chat",
    nome: "Chat",
    arte: "robo-chat",
    Icone: MessageSquare,
    chamada: "Os três canais no",
    linha: "Ler os canais do jogo e falar por eles. Nada sai daqui sozinho.",
  },
  {
    id: "registro",
    nome: "Registro",
    arte: "robo-registro",
    Icone: ScrollText,
    chamada: "O que o robô fez, no",
    linha: "A fita corrida do que aconteceu: ligou, caiu, comprou, vendeu, trocou de hunt.",
  },
];

export function telaRobo(id: string): TelaRobo {
  const t = TELAS_ROBO.find((x) => x.id === id);
  if (!t) throw new Error(`tela de robô desconhecida: ${id}`);
  return t;
}

/** URL da arte de uma tela. Mesmo lugar e mesma versão das artes da dex — a
 *  regra de que arte de `public/` se serve por `iconeUrl` vale nas duas metades. */
export const arteRobo = (arte: string): string => iconeUrl(arte);
