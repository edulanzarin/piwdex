// Roda no container piwdex-migrate no boot: aplica as migrations e sai.
// piwdex nao tem seed (modelo por usuario, sem org/tenant a semear).
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

function run(script) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [join(dir, script)], { stdio: "inherit" });
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} saiu com codigo ${code}`)),
    );
  });
}

try {
  await run("migrate.mjs");
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
