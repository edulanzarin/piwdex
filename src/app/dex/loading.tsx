import { Loading, Panel } from "@/components/ui";

/**
 * Mostrado enquanto o servidor monta a Pokedex. Nao e enfeite: a pagina e
 * dinamica (confere o catalogo do jogo por ETag a cada visita), entao existe
 * mesmo uma espera de rede pra preencher.
 */
export default function DexLoading() {
  return (
    <Panel className="mt-4">
      <Loading label="Lendo o catálogo" hint="conferindo se o jogo publicou patch novo" />
    </Panel>
  );
}
