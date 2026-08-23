import type { Metadata } from "next";
import { PainelTool, type HuntOpcao } from "@/components/robo/painel-tool";
import { exigirVip } from "@/lib/robo/sessao";
import { lerVinculo } from "@/lib/robo/vinculo";
import { lerDesejado } from "@/lib/robo/motor/desejado";
import { lerConfig } from "@/lib/robo/motor/config";
import { estadoDe } from "@/lib/robo/motor/sessao";
import { retomarSessoes } from "@/lib/robo/motor/boot";
import { fetchSource } from "@/lib/source";

export const metadata: Metadata = { title: "Painel" };

/** O painel e dinamico por natureza: ele mostra uma sessao viva. */
export const dynamic = "force-dynamic";

export default async function Painel() {
  const u = await exigirVip();
  const [v, d, fonte, cfg] = await Promise.all([
    lerVinculo(u.id),
    lerDesejado(u.id),
    fetchSource(),
    lerConfig(u.id),
  ]);

  const vivo = estadoDe(u.id);

  /**
   * Abrir o painel RELIGA o que deveria estar rodando.
   *
   * O boot do processo cobre o caso normal, mas ele roda uma vez e pode ter
   * falhado — banco ainda subindo, jogo fora do ar, container que nasceu antes
   * da rede. Depois disso, o robo fica parado com o desejo ligado no banco e
   * ninguem descobre, porque quem usa o robo justamente NAO fica olhando a tela.
   *
   * Quando alguem enfim abre, esta e a hora mais barata de consertar. Fora do
   * caminho da renderizacao: a pagina nao espera a reconexao pra desenhar, e o
   * stream mostra o resultado quando ele chegar.
   */
  if (d?.ligado && !vivo.ligado && v?.status === "active") {
    setTimeout(() => { void retomarSessoes(u.id).catch(() => {}); }, 0);
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
      // `expired` e `blocked` continuam sendo vinculo: a tela precisa poder
      // EXPLICAR o que houve, e mandar essa pessoa pro "conecte sua conta"
      // trocaria a instrucao exata por uma tela generica.
      temVinculo={!!v}
      vinculo={v?.status ?? null}
      nomeJogador={v?.nomeJogador ?? null}
      configInicial={cfg}
    />
  );
}
