import { categorizeAllPending } from "@/categorizer";

async function main() {
  const results = await categorizeAllPending();
  const auto = results.filter((r) => r.status === "AUTO_POSTED").length;
  const queued = results.filter((r) => r.status === "QUEUED").length;
  console.log(`Categorized ${results.length} transactions: ${auto} auto-posted, ${queued} queued for review.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
