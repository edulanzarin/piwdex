import { SERVE_BOT } from "@/lib/robo/papel";

/**
 * O que roda quando o processo nasce.
 *
 * O Railway nao le `docker-compose.yml`: cada peca do chassi precisa de um
 * equivalente na plataforma, e o equivalente de um worker auxiliar e um laco
 * dentro do proprio processo do app. De brinde, isso melhora a paridade — o
 * mesmo mecanismo em dev, no compose e em producao.
 *
 * O atraso e pro banco: o app costuma aceitar requisicao antes de o Postgres
 * terminar de subir, e uma retomada que falha aqui so voltaria no proximo
 * restart.
 */
export async function register() {
  // O serviço da dex nao religa robo nenhum: ele nem tem o que segurar, e uma
  // segunda instancia religando as mesmas sessoes faria dois processos
  // disputarem a mesma conexao do outro lado — que aceita uma so. O sintoma
  // disso sai como "fui chutado", e nao como "tem dois de mim".
  if (!SERVE_BOT) return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // A rede vem ANTES do boot, e nao junto: a retomada e o momento mais provavel
  // de erro do processo inteiro (varias contas, token velho, jogo mudando de
  // forma), e instalar a guarda depois dela seria proteger tudo menos a parte
  // que mais quebra.
  const { instalarGuarda } = await import("@/lib/robo/motor/guarda");
  instalarGuarda();

  setTimeout(() => {
    void import("@/lib/robo/motor/boot")
      .then((m) => m.retomarSessoes())
      .catch((e) => console.error("[robo] boot falhou:", e));
  }, 8_000);
}
