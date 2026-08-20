import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteGameLink } from "@/lib/game-link";
import { dropSession } from "@/lib/game-hunt-session";
import { saveRobotDesired } from "@/lib/robot-session-store";

export const runtime = "nodejs";

// Desvincula a conta do jogo do usuario logado. Nao invalida o token no jogo (o jogador
// segue logado la); so esquece aqui.
//
// "Esquecer" tem TRES partes, e antes so a terceira acontecia — por isso trocar de conta
// deixava a hunt da conta antiga viva na tela da nova:
//   1. o MOTOR em memoria (singleton single-conta) segue segurando o WS, o time ao vivo,
//      o chat e o timer de auto-compra da conta antiga;
//   2. o estado DESEJADO no banco segue dizendo "ligado", entao o boot e o resume
//      religam a sessao sozinhos depois;
//   3. o vinculo cifrado (game_links), que leva junto o snapshot do time.
// Soltar so o vinculo apagava a prova e mantinha o fantasma rodando.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "not_logged" }, { status: 401 });
  const userId = session.user.id;

  // 1) motor: solta a sessao deste usuario e tira do registro (o Map nao pode so crescer)
  dropSession(userId);

  // 2) desejado: sem isso o religamento automatico ressuscita a sessao que acabou de cair
  await saveRobotDesired(userId, {
    enabled: false, autobuy: false, mode: "manual",
    slug: null, leveling: null, levelingQueue: [],
  }).catch(() => { /* o vinculo sai de qualquer jeito */ });

  // 3) vinculo (apaga tambem o snapshot do time gravado na linha)
  await deleteGameLink(userId);

  return NextResponse.json({ ok: true });
}
