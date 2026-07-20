# PLAN.md — AutoLedger (spec #34: intuit-quickbooks-bookkeeper)

Source of truth: `/Users/mohithgajjela/resume-projects/gsd-specs/34-intuit-quickbooks-bookkeeper.md`

## Scope decision (triage-driven)

Real QuickBooks Online requires an Intuit Developer account (hosted signup) and a real
LLM categorizer requires a paid/keyed API (ANTHROPIC_API_KEY / OPENAI_API_KEY — neither
is present in this environment). Both are blocked by rule 2 (no hosted accounts / no
spend). Per rule 2 ("build every part you CAN locally and record the blocked part
precisely"), this build:

- Implements a `QBOClient` interface with the exact QBO v3 REST resource shapes
  (Account, Class, Vendor, Customer, Purchase, Deposit, JournalEntry, Report) and ships
  a `LocalQBOClient` backed by our own Postgres tables that implements that interface
  faithfully (idempotency via `DocNumber`/`PrivateNote` external-ref, Class tagging,
  Reports API P&L aggregation). A real `IntuitQBOClient` adapter stub exists showing
  exactly what would change (base URL, OAuth token, intuit-oauth wiring) but is never
  exercised — no Intuit account was created, no network call to Intuit is made.
- Implements a `Categorizer` with a real rules engine (exact/regex vendor match +
  recurring-template detection) and a real `LLMCategorizer` interface using the
  Anthropic Messages API function-calling shape, gated behind `ANTHROPIC_API_KEY`. Since
  no key is configured in this environment, the LLM stage is never invoked for real —
  unmatched transactions fall straight to the human review queue, exactly as the spec's
  "below-threshold -> human review queue" rule prescribes. This is recorded honestly in
  RESULTS.md as "rules-only" accuracy; "hybrid" numbers are left unmeasured with that
  reason stated, not fabricated.

## Ordered tasks (mapped to spec Phases)

### Phase 1 — Sandbox-as-code + intake
1. Scaffold Next.js 14 + TS app, Prisma + local Postgres, vitest, faker.
2. Prisma schema: Account, Class(Property), Vendor, Customer(Tenant), Transaction,
   PostedRecord, Rule, EvalLabel.
3. `seed/chart.ts` — setup-as-code: rental chart of accounts, 3 property Classes,
   vendors, tenant customers. Idempotent (re-run = no dupes).
4. `intake/generate.ts` — faker-based generator, 1000+ realistic landlord transactions
   across personas (rent deposits, Home Depot runs, utility autopays, insurance,
   transfers), each tagged with a ground-truth category for later eval/labeling.
5. `intake/importCsv.ts` — CSV -> Postgres, dedupe on stable hash (date+amount+desc+acct).
   - **Verify (spec):** re-import of the same CSV is a no-op (unchanged row count);
     1,000+ txns staged in the DB.

### Phase 2 — Categorizer + eval
6. `categorizer/rules.ts` — deterministic rules engine (exact + regex vendor match,
   recurring-template match), returns category + confidence + rule id.
7. `categorizer/llm.ts` — LLMCategorizer interface + Anthropic-function-calling
   implementation, gated by `ANTHROPIC_API_KEY`; returns category + confidence +
   rationale. No-op passthrough to queue when key absent.
8. `categorizer/index.ts` — hybrid pipeline: rules -> (LLM if configured) -> threshold
   -> queue.
9. `eval/labels.json` — 300-txn labeled eval set (ground truth from the generator).
   `eval/run.ts` — accuracy overall + per category, rules-only vs hybrid, %auto-posted
   vs %queued.
   - **Verify (spec):** accuracy table by category produced; below-threshold rows
     provably land in the review queue table, not in PostedRecord.

### Phase 3 — Posting engine
10. `post/qboClient.ts` — QBOClient interface + LocalQBOClient (Postgres-backed) +
    IntuitQBOClient stub (unused).
11. `post/engine.ts` — approved classifications -> Purchase/Deposit/JournalEntry with
    Class tag; idempotent via external ref; batch id per run.
12. `post/rollback.ts` — rollback a batch id, restoring prior state.
    - **Verify (spec):** re-posting the same batch creates zero duplicate PostedRecords;
      rollback removes exactly the batch's postings; per-property P&L (Phase 4 reports)
      reflects postings before rollback and reverts after.

### Phase 4 — Review UX + reports
13. Next.js review queue page: list queued txns, accept/correct actions; correcting
    mints a new deterministic rule.
14. Batch-approve action for high-confidence rows.
15. `reports/profitAndLoss.ts` + reports page — per-property P&L from LocalQBOClient's
    Reports-equivalent; month-end close checklist page.
    - **Verify (spec):** a recorded correction demonstrably improves rule-based accuracy
      on a re-run of eval; month-end close walkthrough (seed -> intake -> categorize ->
      post -> report) runs end-to-end via one script.

### Cross-cutting
16. vitest suites: rules engine fixtures, posting idempotency, rollback, eval harness —
    all run in `npm test` (CI-in-a-box, no external CI configured since this is a local
    build).
17. RESULTS.md — every "Metrics to capture" figure from a real command run today, with
    the exact command recorded.
18. BULLETS.md — spec's 3 resume bullets, blanks filled only from RESULTS.md numbers;
    unmeasurable blanks left as literal `___` with reason.
19. README.md — architecture, reproduce commands, honest limitations section.
20. Publish: commit, create private GitHub repo, push.

## Explicit non-goals (spec "Out of scope")
No production/multi-user auth, no payroll, no invoicing, no taxes filed, no real bank
connections (CSV only), no real Intuit OAuth account, no Schedule-E export (v2/should-have,
skipped for v1).
