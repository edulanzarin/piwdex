import pg from "pg";

// Dev local: carrega o .env se existir (rodando via `npm run`). No Docker
// nao ha .env e as variaveis ja vem do compose — o try/catch cobre os dois.
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    /* sem .env: usa o ambiente do processo */
  }
}

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL nao definido.");
    process.exit(1);
  }
  return url;
}

export function makeClient() {
  return new pg.Client({ connectionString: connectionString() });
}

/**
 * Conecta esperando o banco subir (o container de migration nasce junto dele).
 *
 * Devolve um client NOVO a cada tentativa, e isso nao e detalhe: um `pg.Client`
 * que falhou o `connect()` fica queimado — a segunda chamada estoura "Client has
 * already been connected", e como o laco tratava toda excecao como "banco
 * indisponivel", as 14 tentativas seguintes mentiam. O erro que aparecia no fim
 * era o do reuso; a causa real (senha errada, na primeira tentativa) nunca
 * chegava a tela.
 */
export async function connectWithRetry(tries = 15, delayMs = 2000) {
  let ultimo;
  for (let i = 1; i <= tries; i++) {
    const client = makeClient();
    try {
      await client.connect();
      return client;
    } catch (e) {
      ultimo = e;
      await client.end().catch(() => {});
      if (i === tries) break;
      console.log(`banco indisponivel (tentativa ${i}/${tries}): ${e.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw ultimo;
}
