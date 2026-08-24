import { getData } from "../src/lib/data";
import { metaTable } from "../src/lib/meta";

const ESPERADOS = ["Zapdos","Moltres","Rhydon","Slaking","Gengar","Flareon","Mewtwo","Golem","Tyranitar","Dragonite"];
const ACUSADOS = ["Miltank","Meganium","Farfetchd","Heracross","Scizor","Shuckle","Blissey"];

const db = await getData();
const t = metaTable(db.creatures, "natural");
console.log(`\nTOPO 15 (nosso motor)`);
for (const e of t.slice(0, 15)) {
  console.log(`  ${String(e.position).padStart(3)}  ${e.tier}  ${e.score.toFixed(1).padStart(5)}  ${e.creature.name}`);
}
const pos = (n: string) => {
  const e = t.find((x) => x.creature.name.toLowerCase().replace(/[^a-z]/g,"") === n.toLowerCase().replace(/[^a-z]/g,""));
  return e ? `#${e.position} ${e.tier} ${e.score.toFixed(1)}` : "nao achei";
};
console.log(`\nOS QUE O PIWTOOLS POE EM S (deviam estar alto):`);
for (const n of ESPERADOS) console.log(`  ${n.padEnd(12)} ${pos(n)}`);
console.log(`\nOS QUE OS JOGADORES DISSERAM ESTAR ERRADOS (deviam cair):`);
for (const n of ACUSADOS) console.log(`  ${n.padEnd(12)} ${pos(n)}`);
console.log("");
