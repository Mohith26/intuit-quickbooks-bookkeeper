# RESULTS.md — measured metrics

All numbers below were produced by running the exact command shown, on this
machine, on **2026-07-20**, against a local Postgres 16 instance
(`docker run postgres:16-alpine`, `DATABASE_URL` in `.env`) — no numbers are
estimated or "typical." Reproduce by running the commands in order from a
clean database (`npx prisma migrate reset --force --skip-seed` first).

## Scope note (read this first)

No Intuit Developer account was created and no `ANTHROPIC_API_KEY`/
`OPENAI_API_KEY` is configured in this build environment (see PLAN.md for
why). Every metric below was measured against `LocalQBOClient` (a
Postgres-backed implementation of the exact same `QBOClient` interface a real
`IntuitQBOClient` would use) and the rules-only path of the hybrid
categorizer (the LLM fallback stage never fires because no key is set — it
falls through to the human review queue, which is exactly the spec's
"below-threshold -> queue" behavior). "Hybrid" and "rules-only" are therefore
numerically identical in this environment; that's stated here, not hidden.

## 1. Intake / dedupe (Phase 1 verify)

Command:
```
npx prisma migrate reset --force --skip-seed
npx tsx scripts/seed.ts
npx tsx scripts/generateTransactions.ts
npx tsx scripts/importCsv.ts        # 1st import
npx tsx scripts/importCsv.ts        # 2nd import, same CSV
```

Output (2026-07-20):
```
Seeded 13 accounts, 3 properties, 10 vendors, 21 new baseline rules.
Generated 1416 transactions -> data/transactions.csv
Import: 1416 rows in CSV, 1416 inserted, 0 skipped as duplicates.
Marked 300 transactions as the labeled eval sample.
Import: 1416 rows in CSV, 0 inserted, 1416 skipped as duplicates.
Marked 300 transactions as the labeled eval sample.
```

- **Transactions generated/staged: 1,416** (spec asked for 1,000+).
- **Re-import idempotency: 0 inserted / 1,416 skipped as duplicates** on the
  identical CSV — re-import is a verified no-op.

## 2. Categorization + eval (Phase 2 verify)

Command:
```
npx tsx scripts/categorize.ts
npx tsx scripts/runEval.ts
```

Output (2026-07-20, on the final 300-txn labeled eval sample, n=300):
```
Categorized 1416 transactions: 1297 auto-posted, 119 queued for review.
Eval sample size: 300
Classified accuracy (excl. queued): 100.0% (286/300 classified)
Conservative accuracy (queued counted as miss): 95.3%
Auto-posted: 286 (95.3%)
Queued: 14 (4.7%)

Per-category accuracy:
  Bank Fees                        25/25 (100.0%)
  CAM (Common Area Maintenance)    15/25 (60.0%)
  Insurance                        25/25 (100.0%)
  Landscaping & Grounds            25/25 (100.0%)
  Late Fee Income                  24/24 (100.0%)
  Mortgage Interest                25/25 (100.0%)
  Owner Transfers                  25/25 (100.0%)
  Pest Control                     25/25 (100.0%)
  Property Tax                     25/25 (100.0%)
  Rent Income                      25/25 (100.0%)
  Repairs & Maintenance            22/26 (84.6%)
  Utilities                        25/25 (100.0%)
```

Two accuracy definitions are reported because 14/300 eval transactions never
get a committed category (they're "unknown vendor" noise transactions the
generator deliberately includes — new/one-off contractors not in any rule's
keyword table — and correctly route to the human review queue instead of
being force-classified):
- **Classified accuracy (rules-only, excl. queued): 100.0%** (286/286) — when
  the rules engine commits to a category at all, it is never wrong in this
  eval.
- **Conservative accuracy (queued counted as a miss): 95.3%** (286/300) —
  the "did the whole automated pipeline get it right with zero human input"
  read.
- Per-category accuracy is exactly 100% for every category *except* the two
  that contain the deliberately-unmatched "unknown vendor" noise (CAM 60.0%,
  Repairs & Maintenance 84.6%) — those 14 misses are 100% attributable to
  queued items, not misclassifications (verified: `classifiedAccuracy` = 1.0).
- **% auto-posted vs. queued (full 1,416-txn run): 1,297/1,416 = 91.6%
  auto-posted, 119/1,416 = 8.4% queued** for human review.
- Rules-only vs. hybrid: **identical** (100.0% classified / 95.3%
  conservative both ways) — no `ANTHROPIC_API_KEY` is configured, so the LLM
  fallback stage never executes; see Scope note above.

## 3. Posting idempotency + rollback (Phase 3 verify)

Automated test suite (12/12 passing, includes dedicated idempotency +
rollback unit/integration tests):
```
npx vitest run
```
Output (2026-07-20): `Test Files  4 passed (4)  |  Tests  12 passed (12)`
(rules.test.ts, postingIdempotency.test.ts, rollback.test.ts, eval.test.ts).

Manual end-to-end idempotency run against the real 1,416-txn dataset:
```
npx tsx scripts/postBatch.ts "batch-run-1"
# manually flip status back to AUTO_POSTED to force a genuine re-post attempt
psql ... -c "UPDATE \"Categorization\" SET status='AUTO_POSTED' WHERE status='POSTED';"
npx tsx scripts/postBatch.ts "batch-run-1-repost"
```
Output:
```
Batch <id-1>: attempted 1297, created 1297, idempotent no-ops 0, skipped 0.
Batch <id-2>: attempted 1297, created 0, idempotent no-ops 1297, skipped 0.
```
`select count(*) from "PostedRecord";` → **1,297** (not 2,594) after both runs.
**Re-posting the same 1,297-transaction batch created zero duplicate
PostedRecords.**

Rollback + restore:
```
npx tsx scripts/rollback.ts <batch-run-1-id>
npx tsx scripts/report.ts     # net income -> 0.00 for all 3 properties
# re-post the rolled-back batch
npx tsx scripts/postBatch.ts "batch-run-2"
npx tsx scripts/report.ts     # net income restored to pre-rollback figures
```
Output: `Rolled back batch <id>: 1297 records reversed, ...` then P&L for all
3 properties reads `Net Income  0.00`; after re-posting,
`select count(*) from "PostedRecord";` is still **1,297** and P&L matches the
pre-rollback figures exactly (123 Maple St Duplex net -50417.57, 456 Oak Ave
Fourplex net -45375.72, 789 Pine Rd SFH net -44892.28).

- **Transactions posted (final state): 1,344** (1,297 from the main
  1,416-txn dataset + 47 from a separate 50-txn timing batch, see §4) across
  3 Class-tagged properties, 0 duplicates after 2 additional idempotent
  re-post attempts and 1 full rollback+re-post cycle.

## 4. Bookkeeping time (Phase 4 / metrics list)

Command:
```
npx tsx scripts/generateSmallBatch.ts 50
npx tsx scripts/importCsv.ts data/assisted-timing-batch.csv   # exactly 50 new, unclassified txns
time npx tsx scripts/categorize.ts
time npx tsx scripts/postBatch.ts "assisted-timing-batch-post"
```
Output (2026-07-20):
```
Categorized 50 transactions: 47 auto-posted, 3 queued for review.
npx tsx scripts/categorize.ts  0.58s user 0.31s system 23% cpu 3.734 total
Batch ...: attempted 47, created 47, idempotent no-ops 0, skipped 0.
npx tsx scripts/postBatch.ts ...  0.47s user 0.23s system 24% cpu 2.884 total
```
- **Assisted (automated pipeline) time for 50 transactions: 6.6s wall clock**
  (3.734s categorize + 2.884s post). Caveat: this includes ~2-3s of fixed
  `tsx`/Node/Prisma-connect startup cost per invocation, not pure per-row
  processing time — the marginal cost of the 50 rows themselves is a small
  fraction of that. Reported as measured, not adjusted, since the instruction
  is "no estimates."
- **Manual baseline (hand-categorizing 50 txns with a stopwatch): ___ —
  unmeasured.** This requires a genuine human timed trial (a person reading
  each bank-feed line and deciding a category in real time); this build runs
  through non-interactive tool calls with no live human-in-the-loop stopwatch
  session available, so no real number exists to report. Left blank per the
  "a fabricated number is worse than a blank" rule rather than estimating a
  "typical bookkeeper" figure.

## 5. Reports (Phase 4 verify)

`npx tsx scripts/report.ts` pulls a per-property P&L for all 3 seeded
properties from `LocalQBOClient.profitAndLoss` (the Reports-API-equivalent),
correctly reflecting postings before rollback, reading exactly 0 immediately
after rollback, and reflecting the restored figures after re-posting (see
§3 for the exact before/after/after-repost numbers).

## 6. Month-end close walkthrough (Phase 4 verify)

Command: `npx tsx scripts/monthEndClose.ts` (also live at `/close` in the
Next.js app). Output (2026-07-20): all 6 checklist steps `PASS` — chart
seeded, 1,416+ txns staged, 100% categorized, posting step correctly reports
0-to-post (everything already posted, proving idempotency held across the
whole run), 3/3 property P&Ls returned, eval harness ran on n=300.

## 7. Correction -> rule lift (Phase 4 verify)

Proven by `tests/eval.test.ts` ("correction -> minted rule improves accuracy
on re-run"): an unmatched vendor transaction is queued (0% classified before
correction), a human correction mints a new deterministic rule from its exact
vendor text, and a second occurrence of the same vendor is then auto-classified
correctly by that rule with `AUTO_POSTED` status — a **0% -> 100%** lift for
that specific new vendor, demonstrated as a passing automated test rather than
a single anecdotal run.
