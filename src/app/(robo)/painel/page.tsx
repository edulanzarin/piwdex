import { Panel } from "@/components/ui";

/**
 * O painel — a tela que o subdominio abre.
 *
 * Placeholder do chassi: o roteamento por host ja funciona, o motor ainda nao
 * existe. Ela e substituida quando a camada de conta entrar.
 */
export default function Painel() {
  return (
    <Panel className="mx-auto mt-8 max-w-xl p-6">
      <h1 className="pix text-[18px] text-[var(--color-t-robo)]">Painel do robô</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-text-dim">
        O subdomínio já está de pé. O motor entra nas próximas camadas.
      </p>
    </Panel>
  );
}
