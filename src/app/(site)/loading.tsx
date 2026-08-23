import { Loading } from "@/components/ui";

/**
 * A home tambem espera: ela le o catalogo pra mostrar o tamanho dele, e passa
 * pelo mesmo piso de tempo das outras telas. Sem este arquivo ela era a UNICA
 * rota que ficava em branco enquanto o servidor trabalhava.
 */
export default function HomeLoading() {
  return <Loading label="Ligando o PIWdex" />;
}
