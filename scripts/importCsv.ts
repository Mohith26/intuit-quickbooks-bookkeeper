import { parseCsv, importTransactions, markEvalSample } from "@/intake/importCsv";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const csvPath = process.argv[2] ?? path.join(process.cwd(), "data", "transactions.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(csvText);
  const result = await importTransactions(rows);
  console.log(
    `Import: ${result.totalRows} rows in CSV, ${result.inserted} inserted, ${result.skippedDuplicates} skipped as duplicates.`
  );
  const marked = await markEvalSample(300);
  console.log(`Marked ${marked} transactions as the labeled eval sample.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
