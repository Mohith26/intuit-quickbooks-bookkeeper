/**
 * Generates exactly N fresh transactions (a different faker seed/batch label
 * than the main 1416-row dataset) and writes them to a separate CSV, used only
 * for timing the "assisted" (automated) side of the bookkeeping-time metric on
 * a fixed 50-transaction slice (see RESULTS.md).
 */
import { generateTransactions } from "@/intake/generate";
import { stringify } from "csv-stringify/sync";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const n = Number(process.argv[2] ?? 50);
  const rows = generateTransactions("assisted-timing-batch", 999).slice(0, n);
  const csv = stringify(rows, { header: true });
  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "assisted-timing-batch.csv");
  fs.writeFileSync(outPath, csv);
  console.log(`Generated ${rows.length} transactions -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
