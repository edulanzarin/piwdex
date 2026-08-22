import { Suspense } from "react";
import type { Metadata } from "next";
import { getHuntPayload } from "@/lib/hunt-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { HuntTool } from "@/components/hunt-tool";
import { HowTo, Panel, SkeletonForm } from "@/components/ui";
import { COMO_USAR_HUNT } from "@/lib/how-to";

export const metadata: Metadata = {
  alternates: { canonical: "/hunt" },
  title: "Onde caçar: rota de treino e XP por hora",
  description:
    "Onde caçar no Poke Idle World com o SEU pokémon: todo alvo do jogo medido pelos dois " +
    "lados do combate — XP/h, ouro/h e risco reais — e a rota de níveis até a meta.",
};

export const revalidate = 3600;

export default async function HuntPage() {
  const t0 = agora();
  // O payload ja vem fatiado do `hunt-data.ts`: golpes em tupla e loot cru so de
  // quem tem ponto no mapa. Mandar a `Creature` inteira seria ~1MB pra uma tela
  // que so simula combate.
  const payload = await getHuntPayload();

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="pix text-[22px] text-text">Hunt</h1>

      {/* O manual vem antes da ferramenta: esta tela abre VAZIA pedindo um pokemon,
          e sem manual a tela mais util do site e a que mais parece inacabada. */}
      <HowTo {...COMO_USAR_HUNT} tint="var(--color-t-hunt)" />

      <Suspense
        fallback={
          <Panel title={<span className="pix">O seu pokémon</span>}>
            <SkeletonForm />
          </Panel>
        }
      >
        <HuntTool payload={payload} />
      </Suspense>
    </div>
  );
}
