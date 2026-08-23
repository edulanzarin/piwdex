import type { Metadata } from "next";
import { PainelTool, type HuntOpcao } from "@/components/robo/painel-tool";
import { exigirVip } from "@/lib/robo/sessao";
import { lerVinculo } from "@/lib/robo/vinculo";
import { lerDesejado } from "@/lib/robo/motor/desejado";
import { fetchSource } from "@/lib/source";

export const metadata: Metadata = { title: "Painel" };

/** O painel e dinamico por natureza: ele mostra uma sessao viva. */
export const dynamic = "force-dynamic";

export default async function Painel() {
  const u = await exigirVip();
  const [v, d, fonte] = await Promise.all([lerVinculo(u.id), lerDesejado(u.id), fetchSource()]);

  const hunts: HuntOpcao[] = fonte.hunts
    .map((h) => ({ slug: h.slug, nome: h.name, level: h.level, area: h.area }))
    .sort((a, b) => a.level - b.level || a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <PainelTool
      hunts={hunts}
      slugInicial={d?.slug ?? null}
      // `blocked` continua sendo vinculo: a tela precisa poder EXPLICAR a recusa,
      // e mandar essa pessoa pro "conecte sua conta" esconderia o motivo.
      temVinculo={!!v && v.status !== "expired"}
      nomeJogador={v?.nomeJogador ?? null}
    />
  );
}
