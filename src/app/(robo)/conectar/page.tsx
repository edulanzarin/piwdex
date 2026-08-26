import type { Metadata } from "next";
import { ConectarTool } from "@/components/robo/conectar-tool";
import { HeroRobo } from "@/components/robo/hero-robo";
import { GerenciarContas } from "@/components/robo/gerenciar-contas";
import { exigirVip } from "@/lib/robo/sessao";
import { contaDoUsuario, limiteDeContas, listarContas } from "@/lib/robo/vinculo";

export const metadata: Metadata = { title: "Conectar" };

/**
 * Liga uma conta de jogo — a primeira ou mais uma.
 *
 * `?conta=` significa RECONECTAR aquela: quem venceu o token chega por aqui, e a
 * tela precisa saber de quem e o token que ela esta pedindo. Sem o parametro, e
 * uma conta nova, e o que a tela mostra e quantas ainda cabem.
 */
export default async function Conectar({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string }>;
}) {
  // O vinculo e o que destrava o robo, e o robo e o produto pago: o portao aqui
  // e o da assinatura, nao o do login.
  const u = await exigirVip();
  const pedida = (await searchParams).conta;
  const [contas, alvo] = await Promise.all([
    listarContas(u.id),
    pedida ? contaDoUsuario(u.id, pedida) : null,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <HeroRobo tela="/conectar" />
      <ConectarTool
      status={alvo?.status ?? null}
      nomeJogador={alvo?.apelido ?? alvo?.nomeJogador ?? null}
      motivoBloqueio={alvo?.bloqueioMotivo ?? null}
      reconectando={alvo?.id ?? null}
      jaLigadas={contas.length}
      limite={Number.isFinite(limiteDeContas(u)) ? limiteDeContas(u) : -1}
      />
      {/* Depois do formulario: quem chega aqui vem ADICIONAR. A lista e o que
          ele consulta quando ja fez isso — inclusive pra desfazer. */}
      <GerenciarContas contas={contas} />
    </div>
  );
}
