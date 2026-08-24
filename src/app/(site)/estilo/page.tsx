import type { Metadata } from "next";
import { Amostra } from "./amostra";

/**
 * A tela de AMOSTRA do sistema de design.
 *
 * Ela existe porque redesenho se julga na peca montada, e nao no token. Enquanto
 * as primitivas so apareciam espalhadas por seis ferramentas, comparar o botao
 * primario com o secundario exigia abrir duas paginas e confiar na memoria — e
 * memoria de cor a dois cliques de distancia e o jeito mais rapido de aprovar
 * uma escada que nao existe.
 *
 * Aqui todas moram juntas, em todos os estados, na mesma superficie. Serve pra
 * decidir a linguagem e serve depois: primitiva nova nasce visivel aqui, e o que
 * nao couber nesta pagina provavelmente nao devia existir.
 *
 * Fora do indice de proposito — e ferramenta de quem constroi, nao conteudo.
 */
export const metadata: Metadata = {
  title: "Amostra do sistema de design",
  robots: { index: false, follow: false },
};

export default function EstiloPage() {
  return <Amostra />;
}
