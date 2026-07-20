import { allPropertyProfitAndLoss } from "@/reports/profitAndLoss";

async function main() {
  const reports = await allPropertyProfitAndLoss();
  for (const r of reports) {
    console.log(`\n=== P&L: ${r.className} ===`);
    for (const row of r.rows) {
      console.log(`  ${row.accountName.padEnd(32)} ${row.accountType.padEnd(24)} ${row.amount.toFixed(2)}`);
    }
    console.log(`  ${"Net Income".padEnd(32)} ${"".padEnd(24)} ${r.netIncome.toFixed(2)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
