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

export function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL nao definido.");
    process.exit(1);
  }
  return new pg.Client({ connectionString });
}

// O container de migrate sobe junto do banco: espera ficar pronto.
export async function connectWithRetry(client, tries = 15, delayMs = 2000) {
  for (let i = 1; i <= tries; i++) {
    try {
      await client.connect();
      return;
    } catch (e) {
      if (i === tries) throw e;
      console.log(`banco indisponivel (tentativa ${i}/${tries}), aguardando...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
