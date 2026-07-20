import { rollbackBatch } from "@/post/rollback";

async function main() {
  const batchId = process.argv[2];
  if (!batchId) {
    console.error("Usage: npm run rollback -- <batchId>");
    process.exit(1);
  }
  const result = await rollbackBatch(batchId);
  console.log(
    `Rolled back batch ${result.batchId}: ${result.reversedRecords} records reversed, ${result.restoredCategorizations} categorizations restored to postable.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
