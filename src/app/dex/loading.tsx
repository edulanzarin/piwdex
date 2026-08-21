import { Loading } from "@/components/ui";

/**
 * Mostrado enquanto o servidor monta a Pokedex.
 *
 * Sem painel: a tela de espera nao e conteudo, e um intervalo. Uma caixa em
 * volta desenha um bloco vazio de 400px que fica ali sem informar nada — solto,
 * sobra o wallpaper e o bicho no meio.
 */
export default function DexLoading() {
  return <Loading label="Lendo o catálogo" />;
}
