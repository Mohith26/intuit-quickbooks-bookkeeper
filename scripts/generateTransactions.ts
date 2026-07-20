import { generateTransactions } from "@/intake/generate";
import { stringify } from "csv-stringify/sync";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const rows = generateTransactions("synthetic-v1", 42);
  const csv = stringify(rows, { header: true });
  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "transactions.csv");
  fs.writeFileSync(outPath, csv);
  console.log(`Generated ${rows.length} transactions -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
