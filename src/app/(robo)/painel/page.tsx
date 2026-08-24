import type { Metadata } from "next";
import { PainelTool, type HuntOpcao } from "@/components/robo/painel-tool";
import { exigirVip } from "@/lib/robo/sessao";
import { contaDoUsuario, listarContas, primeiraConta } from "@/lib/robo/vinculo";
import { lerDesejado } from "@/lib/robo/motor/desejado";
import { lerConfig } from "@/lib/robo/motor/config";
import { estadoDe } from "@/lib/robo/motor/sessao";
import { retomarSessoes } from "@/lib/robo/motor/boot";
import { fetchSource } from "@/lib/source";

export const metadata: Metadata = { title: "Painel" };

/** O painel e dinamico por natureza: ele mostra uma sessao viva. */
export const dynamic = "force-dynamic";

/**
 * A conta que a tela opera vem da URL (`?conta=`), e nao de um cookie.
 *
 * E o mesmo motivo pelo qual os filtros da dex moram na URL: com varias contas,
 * "a aba do painel" passa a ser uma pergunta com sujeito, e um link tem que
 * poder carregar o sujeito junto. Cookie faria duas abas abertas em contas
 * diferentes brigarem pela mesma memoria.
 */
export default async function Painel({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string }>;
}) {
  const u = await exigirVip();
  const pedida = (await searchParams).conta;

  const [contas, fonte] = await Promise.all([listarContas(u.id), fetchSource()]);

  // Pedir uma conta que nao e sua cai na sua primeira, em vez de errar: o id na
  // URL e chute facil, e uma tela de erro aqui so ensinaria quais ids existem.
  const escolhida = pedida && (await contaDoUsuario(u.id, pedida)) ? pedida : await primeiraConta(u.id);
  const conta = contas.find((c) => c.id === escolhida) ?? null;

  const [d, cfg] = await Promise.all([
    escolhida ? lerDesejado(escolhida) : null,
    escolhida ? lerConfig(escolhida) : null,
  ]);

  const vivo = estadoDe(escolhida ?? "");

  /**
   * Abrir o painel RELIGA o que deveria estar rodando.
   *
   * O boot do processo cobre o caso normal, mas ele roda uma vez e pode ter
   * falhado — banco ainda subindo, jogo fora do ar, container que nasceu antes
   * da rede. Depois disso, o robo fica parado com o desejo ligado no banco e
   * ninguem descobre, porque quem usa o robo justamente NAO fica olhando a tela.
   *
   * Sem `apenas`: com varias contas, quem abre a tela costuma ter mais de uma
   * parada, e religar so a que ele esta olhando deixaria as outras no chao ate
   * ele lembrar de visita-las uma a uma.
   */
  if (d?.ligado && !vivo.ligado && conta?.status === "active") {
    setTimeout(() => { void retomarSessoes().catch(() => {}); }, 0);
  }

  const hunts: HuntOpcao[] = fonte.hunts
    .map((h) => ({ slug: h.slug, nome: h.name, level: h.level, area: h.area }))
    .sort((a, b) => a.level - b.level || a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <PainelTool
      // O estado VIVO ja no primeiro render.
      //
      // A pagina roda no mesmo processo do motor, entao ela pode simplesmente
      // perguntar. Sem isto, todo F5 abria em "parado" com os numeros em
      // travessao ate o primeiro frame do stream — o que se le como "o robo
      // resetou", que e exatamente o oposto do que aconteceu.
      estadoInicial={vivo}
      hunts={hunts}
      slugInicial={d?.slug ?? null}
      contas={contas}
      contaAtiva={escolhida ?? null}
      // `expired` e `blocked` continuam sendo vinculo: a tela precisa poder
      // EXPLICAR o que houve, e mandar essa pessoa pro "conecte sua conta"
      // trocaria a instrucao exata por uma tela generica.
      temVinculo={!!conta}
      vinculo={conta?.status ?? null}
      nomeJogador={conta?.apelido ?? conta?.nomeJogador ?? null}
      configInicial={cfg}
    />
  );
}
