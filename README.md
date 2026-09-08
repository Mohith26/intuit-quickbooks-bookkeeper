# AutoLedger

An automated bookkeeper for small landlords. Bank-feed transactions come in as CSV, get classified to the right property and account, and are posted as double-entry records (Purchase, Deposit or JournalEntry, tagged with a property Class) with idempotent posting, one-command batch rollback, and a per-property P&L. The posting layer follows the QuickBooks Online v3 REST resource shapes so the local implementation could be swapped for the real API.

## How it works

Categorization is rules first, then an LLM fallback, then a confidence threshold. The rules engine checks exact and regex vendor matches, plus recurring-template rules that also require the amount to fall inside a window. A bare vendor match gets confidence 0.98, an amount-window match 0.95, and anything at or above 0.85 is auto-posted. Unmatched transactions go to the LLM stage, which only runs when `ANTHROPIC_API_KEY` is set; otherwise they fall through to the review queue in the Next.js app, where a correction mints a new rule for that vendor.

Posting goes through a `QBOClient` interface (`src/post/qboClient.ts`). `LocalQBOClient` implements it against Postgres with an external-ref `qboDocId` as the idempotency key, so re-posting a batch is a no-op. Rollback reverses every record in a batch and puts its categorizations back into a postable state. Next.js 14, TypeScript, Prisma, PostgreSQL 16, vitest.

## Results

Measured on 2026-07-20 with no API key configured, so the LLM stage never fired and these are rules-path numbers. Full output is in `RESULTS.md`.

The generator produced 1,416 transactions across 14 vendor personas, including deliberate unknown-vendor noise. Importing the same CSV twice inserted 1,416 then 0. Categorizing auto-posted 1,297 (91.6%) and queued 119 (8.4%).

On the 300-transaction eval sample, accuracy excluding queued items was 100.0% (286/286); counting queued items as misses, 95.3% (286/300). Every category scored 25/25 except the two containing the noise (CAM 15/25, Repairs & Maintenance 22/26), and all 14 misses were queued rather than mislabeled.

Posting the 1,297 transactions, resetting their status, and posting again created 1,297 then 0 records. Rollback took net income to 0.00 for all three properties, and re-posting restored the exact prior figures with the count still at 1,297. 12 vitest tests across 4 files pass.

The eval ground truth is whatever category the generator assigned, fine for a synthetic corpus but weaker than a hand-labeled real set. I did not time a manual baseline, so there is no time-saved number.

## Setup

Node 20+ and a Postgres at `DATABASE_URL` in `.env` (I used `postgres:16-alpine` in Docker on port 15544).

```bash
npm install
npx prisma migrate deploy
npm run seed                   # chart of accounts, 3 properties, vendors, rules
npm run generate:txns
npm run import:csv             # run twice to see the dedupe no-op
npm run categorize
npm run eval
npm run post -- my-batch       # re-run to see 0 created
npm run rollback -- <batchId>
npm run report
npm run close                  # end-to-end walkthrough
npm test
npm run dev                    # /, /queue, /reports, /close
```

## Known gaps

CSV intake only, no live bank connections. The remote API adapter is a stub. No Schedule E export.
