import { auth } from "@/lib/auth";
import { gameSession } from "@/lib/game-hunt-session";
import { listRobotEvents, unreadRobotEvents } from "@/lib/robot-events";
import { listNotifications, unreadCount } from "@/lib/alerts";
import { fetchAccountSnapshot, fetchTotalsSnapshot } from "@/lib/vip-snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stream SSE da area VIP: UMA conexao empurra TUDO que a UI mostra ao vivo — no lugar dos
// 8 setInterval que cada painel fazia (2s-10s) e do F5 em Desejos/Alertas. Eventos:
//   hunt     — estado da sessao do robo (status, analyzer, kills, modo, plano, reconexao).
//              Empurrado NA HORA via o bus do gameSession (kill chegou -> UI mexeu).
//   autosell — vendidos por especie da hunt atual (mesma origem, mesmo gatilho).
//   account  — conta completa do jogo (nivel, XP, gold, bolas, time). Poll de 15s (REST do jogo).
//   events   — feed de atividade do robo (banco, 5s).
//   alerts   — achados do sniper de mercado (banco, 5s).
//   totals   — dashboard cumulativo + hunt ao vivo (banco+memoria, 5s).
//   ping     — keepalive (25s). O EventSource do browser reconecta sozinho se cair.

const HUNT_THROTTLE_MS = 300;   // rajada de frames do WS vira no maximo ~3 pushes/s
const ACCOUNT_MS = 15_000;
const DB_MS = 5_000;
const PING_MS = 25_000;

export async function GET(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return new Response("not_logged", { status: 401 });
  if (!s.user.vip) return new Response("vip_only", { status: 403 });
  const userId = s.user.id;

  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const timers: ReturnType<typeof setInterval>[] = [];
      let huntTimer: ReturnType<typeof setTimeout> | null = null;
      let huntDirty = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { closed = true; }
      };

      const pushHunt = () => { send("hunt", gameSession.getState()); send("autosell", gameSession.getAutoSellView()); send("chat", gameSession.getChatView()); };
      const pushAccount = async () => { try { send("account", await fetchAccountSnapshot(userId)); } catch { /* proximo tick */ } };
      const pushTotals = async () => { try { send("totals", await fetchTotalsSnapshot(userId)); } catch { /* proximo tick */ } };
      const pushDb = async () => {
        try {
          const [events, unreadEv, notifications, unreadAl] = await Promise.all([
            listRobotEvents(userId, 20), unreadRobotEvents(userId), listNotifications(userId), unreadCount(userId),
          ]);
          send("events", { events, unread: unreadEv });
          send("alerts", { notifications, unread: unreadAl });
        } catch { /* proximo tick */ }
      };

      // mudancas do motor chegam NA HORA (throttle so pra rajada de kills)
      const onChange = () => {
        if (huntTimer) { huntDirty = true; return; }
        pushHunt();
        huntTimer = setTimeout(() => {
          huntTimer = null;
          if (huntDirty) { huntDirty = false; pushHunt(); }
        }, HUNT_THROTTLE_MS);
      };
      gameSession.bus.on("change", onChange);

      // snapshot inicial completo (a UI nasce preenchida, sem cascata de fetches)
      pushHunt();
      void pushAccount(); void pushDb(); void pushTotals();

      timers.push(setInterval(() => void pushAccount(), ACCOUNT_MS));
      timers.push(setInterval(() => { void pushDb(); void pushTotals(); }, DB_MS));
      timers.push(setInterval(() => send("ping", Date.now()), PING_MS));

      const cleanup = () => {
        if (closed) return;
        closed = true;
        gameSession.bus.off("change", onChange);
        for (const t of timers) clearInterval(t);
        if (huntTimer) clearTimeout(huntTimer);
        try { controller.close(); } catch { /* ja fechado */ }
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // proxy nao bufferiza o stream
    },
  });
}
