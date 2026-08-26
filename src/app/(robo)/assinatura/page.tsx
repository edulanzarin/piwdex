import type { Metadata } from "next";
import { AssinaturaTool } from "@/components/robo/assinatura-tool";
import { HeroRobo } from "@/components/robo/hero-robo";
import { exigirUsuario } from "@/lib/robo/sessao";
import { queryOne } from "@/lib/robo/db";
import { PRECO, pagamentoLigado } from "@/lib/robo/pagamento";

export const metadata: Metadata = { title: "Assinatura" };

/** O portao aqui e o do LOGIN, nao o da assinatura: esta e justamente a tela pra
 *  quem ainda nao tem. Mandar essa pessoa pro checkout a partir do checkout seria
 *  um laco. */
export default async function Assinatura() {
  const u = await exigirUsuario();
  const linha = await queryOne<{ vip_ate: string | null }>(
    "SELECT vip_ate FROM users WHERE id = $1",
    [u.id],
  );

  return (
    <div className="flex flex-col gap-4">
      <HeroRobo tela="/assinatura" />
      <AssinaturaTool
        ativa={u.vip}
        ate={linha?.vip_ate ?? null}
        preco={PRECO}
        ligado={pagamentoLigado()}
      />
    </div>
  );
}
