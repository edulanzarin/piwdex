import type { Metadata } from "next";
import { ConectarTool } from "@/components/robo/conectar-tool";
import { exigirVip } from "@/lib/robo/sessao";
import { lerVinculo } from "@/lib/robo/vinculo";

export const metadata: Metadata = { title: "Conectar" };

export default async function Conectar() {
  // O vinculo e o que destrava o robo, e o robo e o produto pago: o portao aqui
  // e o da assinatura, nao o do login.
  const u = await exigirVip();
  const v = await lerVinculo(u.id);

  return (
    <ConectarTool
      status={v?.status ?? null}
      nomeJogador={v?.nomeJogador ?? null}
      motivoBloqueio={v?.bloqueioMotivo ?? null}
    />
  );
}
