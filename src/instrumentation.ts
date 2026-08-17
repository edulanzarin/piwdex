// Boot do servidor (Next instrumentation): valida o ambiente, religa o robo persistido
// e liga o loop do sniper quando o container (re)nasce — sem isso, restart matava a hunt
// silenciosamente e nada avisava. O delay da tempo pro Postgres subir junto no compose.

// Em producao, env faltando nao pode "subir e quebrar na primeira request" (AUTH_SECRET
// so explode no primeiro login; APP_URL faltando deixa o checkout do MP apontando pra
// localhost e o webhook nunca chega). Falha AQUI, no boot, com mensagem clara.
function assertProdEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.AUTH_SECRET) missing.push("AUTH_SECRET");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
    missing.push("SESSION_SECRET (minimo 16 caracteres)");
  }
  if (!process.env.APP_URL?.startsWith("https://")) {
    missing.push("APP_URL (https://, ex: https://piwdex.com.br)");
  }
  if (missing.length) {
    console.error(
      `[boot] producao sem env obrigatoria: ${missing.join(", ")}. ` +
        "Configure no Railway/compose e suba de novo. Abortando.",
    );
    process.exit(1);
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  assertProdEnv();
  const { resumeRobotSessions } = await import("@/lib/robot-boot");
  const { startTokenKeepalive } = await import("@/lib/token-keepalive");
  const { startSniperLoop } = await import("@/lib/sniper");
  // keepalive do vinculo: renova os tokens do jogo proativamente (bookmark e UMA vez so)
  startTokenKeepalive();
  // sniper de mercado: varredura a cada SCAN_INTERVAL s dentro do proprio processo
  // (substitui o worker externo do compose; Railway nao roda o compose)
  startSniperLoop();
  setTimeout(() => {
    void resumeRobotSessions().catch((e) => console.error("[robot-boot] falhou ao retomar:", e));
  }, 5_000);
}
