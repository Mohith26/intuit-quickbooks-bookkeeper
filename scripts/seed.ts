import { seedAll } from "@/seed/chart";
import { seedBaselineRules } from "@/seed/rules";

async function main() {
  const chart = await seedAll();
  const rules = await seedBaselineRules();
  console.log(
    `Seeded ${chart.accounts.length} accounts, ${chart.properties.length} properties, ${chart.vendors.length} vendors, ${rules.length} new baseline rules.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
