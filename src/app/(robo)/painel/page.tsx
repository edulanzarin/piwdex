import type { Metadata } from "next";
import { PainelTool, type HuntOpcao } from "@/components/robo/painel-tool";
import { exigirVip } from "@/lib/robo/sessao";
import { lerVinculo } from "@/lib/robo/vinculo";
import { lerDesejado } from "@/lib/robo/motor/desejado";
import { lerConfig } from "@/lib/robo/motor/config";
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

  const hunts: HuntOpcao[] = fonte.hunts
    .map((h) => ({ slug: h.slug, nome: h.name, level: h.level, area: h.area }))
    .sort((a, b) => a.level - b.level || a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <PainelTool
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
