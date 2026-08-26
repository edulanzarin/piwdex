import type { Metadata } from "next";
import Link from "next/link";
import { ATUALIZACOES, dataLonga, ultimaMudanca } from "@/lib/atualizacoes";
import { AtualizacoesLista } from "@/components/atualizacoes-lista";
import { Note, PageHeader } from "@/components/ui";
import { History as IconHistory } from "lucide-react";

export const metadata: Metadata = {
  alternates: { canonical: "/atualizacoes" },
  title: "Atualizações do PIWdex — o que mudou e quando",
  description:
    "Tudo que mudou no PIWdex: ferramentas novas, consertos de cálculo e melhorias. " +
    "Conserto que muda um número aparece aqui, porque quem decidiu com o número velho " +
    "precisa saber.",
};

/**
 * O que mudou, e quando.
 *
 * A página existe por causa de um caso específico e desconfortável: um conserto de
 * CÁLCULO muda a resposta que alguém já tomou como boa. Quem montou time contra um
 * boss antes de a penalidade de grupo entrar na conta saiu daqui com um "você
 * ganha" que o jogo desmentiu. Sem um lugar que diga "isto mudou no dia tal", a
 * única leitura possível pra essa pessoa é que a ferramenta erra — e não que ela
 * errava, foi corrigida, e a correção tem data.
 *
 * Por isso a lista não separa "novidades" de "correções" em abas: a correção é a
 * parte que mais importa e não pode ficar numa segunda página que ninguém abre. O
 * tipo é um selo na linha e um FILTRO — o meio-termo entre o selo, que não ajuda
 * quem procura, e a aba, que esconde.
 *
 * A página fica sendo a casca: título, as duas ressalvas e o dado. O recorte mora
 * na `AtualizacoesLista`, que é cliente.
 */
export default function AtualizacoesPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Atualizações"
        icon={<IconHistory size={22} />}
        lead={`Tudo que mudou no site, em ordem. A última foi em ${dataLonga(ultimaMudanca())}.`}
      />

      <Note>
        Esta página é o que mudou no SITE. O que mudou no JOGO — stat, drop, XP,
        ouro por abate — tem página própria, em{" "}
        <Link href="/patches" className="text-accent not-italic hover:opacity-80">
          patches do jogo
        </Link>
        .
      </Note>

      <Note>
        Conserto de cálculo entra aqui mesmo quando é pequeno. Se um número
        mudou, quem tomou uma decisão com o número velho tem o direito de saber
        — e de refazer a conta.
      </Note>

      <AtualizacoesLista itens={ATUALIZACOES} />
    </div>
  );
}
