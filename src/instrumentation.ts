// Boot do servidor (Next instrumentation): religa o robo persistido quando o container
// (re)nasce — sem isso, restart matava a hunt silenciosamente e nada avisava. O delay da
// tempo pro Postgres subir junto no compose.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resumeRobotSessions } = await import("@/lib/robot-boot");
  setTimeout(() => {
    void resumeRobotSessions().catch((e) => console.error("[robot-boot] falhou ao retomar:", e));
  }, 5_000);
}
