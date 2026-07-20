# BULLETS.md — resume bullets, filled only from RESULTS.md

Spec's exact bullet templates from `34-intuit-quickbooks-bookkeeper.md`, with
blanks filled strictly from measured numbers in RESULTS.md. Anything not
measured stays a literal `___`.

---

1. Automated landlord bookkeeping on the QuickBooks Online API: hybrid
   rules+LLM categorization hit **95.3%** accuracy on a **300**-transaction
   labeled eval, auto-posting **91.6%** of volume as Class-tagged
   double-entry records across 3 properties

   - 95.3% = "conservative" accuracy (queued items counted as a miss) on the
     300-txn eval, RESULTS.md §2. Note: on the subset the pipeline actually
     commits to a category for (286/300), accuracy is 100.0% — the misses are
     100% attributable to correctly-queued unknown-vendor transactions, not
     misclassifications (RESULTS.md §2).
   - 91.6% = 1,297/1,416 auto-posted on the full generated dataset, RESULTS.md §1/§2.
   - "hybrid rules+LLM": no `ANTHROPIC_API_KEY` is configured in this build
     environment (see PLAN.md), so these numbers are rules-only; the LLM
     fallback path exists and is implemented (src/categorizer/llm.ts) but was
     never exercised against a real key. Stated plainly, not hidden.

2. Cut month-end bookkeeping from ~___ hr to ~**0.11 min** per 50
   transactions; below-confidence items route to a review queue whose
   corrections mint new deterministic rules (measured **100**-pt accuracy
   lift over dogfooding)

   - **weak-metric caveat on the "~0.11 min" side**: this is automated
     pipeline wall-clock time (6.618s for 50 txns: 3.734s categorize +
     2.884s post, RESULTS.md §4), dominated by fixed `tsx`/Node/Prisma
     startup cost per CLI invocation, not pure per-row processing time — it
     is not directly comparable to a human's per-transaction pace.
   - The manual-baseline "~___ hr" side is **intentionally left blank**: it
     requires a genuine human timed trial with a stopwatch, which isn't
     obtainable through this session's non-interactive tool calls. No number
     is reported rather than an estimated "typical bookkeeper" figure.
   - "100-pt accuracy lift" = the passing `tests/eval.test.ts` correction
     test: an unmatched vendor's transaction goes from queued (0% classified)
     to auto-classified correctly (100%) for its next occurrence, once a
     human correction mints the deterministic rule. This is a per-vendor
     before/after proven by a real automated test, not a corpus-wide re-run
     of the 300-txn eval — flagged here so the number isn't read as more than
     it is.

3. Engineered idempotent batch posting with external-ref dedupe +
   one-command rollback — re-posts create zero duplicates, and per-property
   P&Ls pull clean from the QBO Reports API

   - No blanks in the spec template for this bullet. Verified exactly as
     written: re-posting the same 1,297-transaction batch created 0
     duplicate `PostedRecord`s (RESULTS.md §3); `npx tsx scripts/rollback.ts`
     is the one-command rollback, reversing all 1,297 records and driving
     per-property net income to 0.00, then a re-post restores the exact
     pre-rollback P&L figures for all 3 properties (RESULTS.md §3/§5).
