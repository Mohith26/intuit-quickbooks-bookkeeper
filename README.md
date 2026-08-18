# AutoLedger

An automated bookkeeper for small landlords built against the QuickBooks
Online v3 REST resource shapes: bank-feed transactions are auto-classified to
the right property/account with a rules-first + LLM-fallback hybrid
categorizer, posted as proper double-entry records (Purchase/Deposit/
JournalEntry with Class tagging), with an accountant-grade audit trail
(idempotent posting, one-command rollback, per-property P&L) and an accuracy
eval on a 300-transaction labeled set.

## Scope decision (read this before anything else)


- **`QBOClient` interface** (`src/post/qboClient.ts`) matches the QBO v3 REST
  resource shapes (Account, Class, Vendor, Customer, Purchase, Deposit,
  JournalEntry, Report) exactly. **`LocalQBOClient`** implements it faithfully
  against Postgres — same idempotency contract (external-ref `qboDocId`),
  same Class tagging, same Reports-API-shaped P&L. **`IntuitQBOClient`** is a
  documented stub showing exactly what the production adapter would look
  like; it's never instantiated.
- **`categorizeWithLlm`** (`src/categorizer/llm.ts`) is a real Anthropic
  Messages API tool-use implementation (category + required confidence +
  rationale), gated behind `ANTHROPIC_API_KEY`. With no key set, it returns
  `available: false` and the hybrid pipeline falls straight through to the
  human review queue — which is exactly the spec's own "below-threshold ->
  human review queue" rule, not a workaround.

Every number in RESULTS.md was measured against this local stack, with the
scope of each measurement stated plainly (rules-only vs. hybrid, etc).

## Architecture

```
seed/        setup-as-code: rental chart of accounts, 3 property Classes,
             vendors, tenant Customers (idempotent upserts)
intake/      faker-based bank-feed generator (14 personas, incl. deliberately
             unmatched "unknown vendor" noise) -> CSV -> Postgres, deduped on
             a stable date+amount+description+property hash
categorizer/ rules engine (exact/regex + recurring-template amount-window
             rules) -> LLM fallback (gated on ANTHROPIC_API_KEY) -> confidence
             threshold -> auto-post or human review queue
post/        QBOClient interface + LocalQBOClient (idempotent Purchase/
             Deposit/JournalEntry posting with Class tagging) + batch rollback
eval/        300-txn labeled eval: accuracy overall + per category,
             auto-posted vs. queued rates
reports/     per-property P&L from the Reports-API-equivalent
app/         Next.js review queue (accept/correct/batch-approve), reports
             page, month-end close checklist page
```

Stack: Next.js 14 (App Router) + TypeScript, Prisma + PostgreSQL 16, Anthropic
SDK (function-calling contract, unused without a key), vitest, `@faker-js/faker`.

## Reproduce the metrics (exact commands, see RESULTS.md for full output)

Prereqs: Node 20+, a local Postgres reachable at `DATABASE_URL` in `.env`
(this build used `docker run -d -p 15544:5432 -e POSTGRES_USER=autoledger -e
POSTGRES_PASSWORD=autoledger -e POSTGRES_DB=autoledger postgres:16-alpine`).

```bash
npm install
npx prisma migrate deploy      # or: npx prisma migrate reset --force --skip-seed

npm run seed                   # chart of accounts, 3 properties, vendors, baseline rules
npm run generate:txns          # 1,416 synthetic transactions -> data/transactions.csv
npm run import:csv             # import; run twice to see the dedupe no-op
npm run categorize             # rules -> LLM-if-configured -> queue
npm run eval                   # accuracy + per-category table on the 300-txn eval sample
npm run post -- my-batch       # idempotent posting; re-run the same command to see 0 created
npm run rollback -- <batchId>  # one-command rollback (batchId is printed by `post`)
npm run report                 # per-property P&L
npm run close                  # full seed->intake->categorize->post->report->eval walkthrough
npm test                       # vitest: rules, posting idempotency, rollback, eval, correction-lift
npm run dev                    # http://localhost:3000 -- /, /queue, /reports, /close
```

## Limitations / not-yet-measured

- **No real QuickBooks Online.** `LocalQBOClient` implements the same
  interface a real adapter would, and is unit/integration tested, but no
  live Intuit sandbox call was ever made. `IntuitQBOClient` is an unused stub.
- **No real LLM fallback exercised.** `categorizeWithLlm` is implemented
  against the Anthropic Messages API tool-use contract but never ran with a
  key; all measured accuracy/auto-post numbers are rules-only.
- **Manual bookkeeping-time baseline is unmeasured.** The spec asks for
  "time yourself on 50 txns" by hand; this build runs through non-interactive
  tool calls with no live human stopwatch trial available. Left blank in
  RESULTS.md/BULLETS.md rather than estimated.
- **The 300-txn "labeled" eval set is generator-ground-truth, not
  hand-labeled by an independent human reviewer.** Ground truth is the
  category the synthetic generator assigned when it created the transaction,
  which is a legitimate label for a synthetic corpus but is a weaker claim
  than an independently hand-labeled real-world set.
- **Schedule-E export (v2/should-have) was not built** — correctly out of
  v1 scope per the spec.
- **No real bank connections** — CSV-only, per the spec's explicit "Out of
  scope."
