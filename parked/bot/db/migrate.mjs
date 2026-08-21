// Runner de migration sem ORM: aplica os .sql ainda nao registrados, em
// ordem, cada um numa transacao, e anota em schema_migrations.
// Ver [[Runner de migration em SQL puro dispensa o CLI do ORM]].
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeClient, connectWithRetry } from "./_client.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(dir, "migrations");
const client = makeClient();

async function main() {
  await connectWithRetry(client);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id          text PRIMARY KEY,
    aplicado_em timestamptz NOT NULL DEFAULT now()
  );`);

  const { rows } = await client.query("SELECT id FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.id));
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let n = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(migrationsDir, file), "utf8");
    process.stdout.write(`-> ${file} ... `);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log("ok");
      n++;
    } catch (e) {
      await client.query("ROLLBACK");
      console.log("FALHOU");
      throw e;
    }
  }
  console.log(n === 0 ? "schema em dia (nada a aplicar)" : `${n} migration(s) aplicada(s)`);
}

main()
  .then(() => client.end())
  .catch(async (e) => {
    console.error(e);
    await client.end().catch(() => {});
    process.exit(1);
  });
