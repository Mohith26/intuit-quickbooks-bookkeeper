import { postApprovedBatch } from "@/post/engine";

async function main() {
  const label = process.argv[2] ?? `batch-${new Date().toISOString()}`;
  const result = await postApprovedBatch(label);
  console.log(
    `Batch ${result.batchId}: attempted ${result.attempted}, created ${result.created}, idempotent no-ops ${result.idempotentNoOps}, skipped (not approvable) ${result.skippedNotApprovable}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
