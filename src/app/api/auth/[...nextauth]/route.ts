import { handlers } from "@/lib/robo/auth";

// O endpoint do Auth.js. So responde no subdominio do robo — no apex o `proxy.ts`
// devolve 404, porque login e coisa da area logada e nao do site de busca.
export const { GET, POST } = handlers;
