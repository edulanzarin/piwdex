import type { Metadata } from "next";
import { Note, Panel } from "@/components/ui";
import { exigirUsuario } from "@/lib/robo/sessao";

export const metadata: Metadata = { title: "Painel" };

/**
 * O painel — a tela que o subdominio abre.
 *
 * Ainda e a casca: a conta ja existe e o portao ja fecha, mas o motor entra nas
 * proximas camadas.
 */
export default async function Painel() {
  const u = await exigirUsuario();

  return (
    <Panel className="mx-auto mt-8 max-w-xl p-6">
      <h1 className="pix text-[18px] text-[var(--color-t-robo)]">Painel</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-text-dim">
        Olá, {u.nome ?? u.email}.
      </p>
      <Note className="mt-4">
        {u.vip
          ? "Assinatura ativa. Falta conectar a conta do jogo."
          : "Sem assinatura ativa — o robô só liga depois dela."}
      </Note>
    </Panel>
  );
}
