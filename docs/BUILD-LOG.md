# Build Log

A running record of what was built, what broke, and why — kept alongside the
code so the reasoning behind decisions isn't lost. Newest entries at the top.

---

## Phase 2 — Test plan → Playwright spec generator

**Branch:** `phase-2-playwright-generator`

Added a deterministic (non-LLM) generator that turns a schema-valid
`TestPlan` JSON into a `.spec.ts` file:

- `src/generators/playwright-generator.ts` — builds one `test.fixme(...)`
  block per test case (title, preconditions/steps as comments, expected
  result as a TODO). Deliberately not LLM-generated code — same "controlled
  boundary" principle as the rest of the pipeline: validated data in,
  reviewable code out.
- `src/run-generate-tests.ts` — CLI entry point (`npm run agent:generate --
  <path>`), accepts either a single test-plan JSON file or a directory of
  them.
- Every generated test uses `test.fixme()`, not a bare `test()`. An
  unimplemented skeleton with no real assertions would otherwise report as a
  false "pass" — `fixme` reports it as pending instead, which is the honest
  signal.

**Bugs found while testing this against real output:**

1. `escape()` (meant for values placed inside a single-quoted JS string
   literal, e.g. the test title) was also being applied to `expectedResults`
   inside a `//` comment. Comments don't need quote-escaping, so this
   produced literal `\'` characters visible in the generated file. Fixed by
   splitting into `escapeForStringLiteral()` (title only) and `toComment()`
   (everything placed in a `//` line, which also flattens embedded newlines
   so a multi-line field can't break out of the comment).
2. **`playwright.config.ts` had `testDir: './.tests'`** (a hidden dot-folder)
   instead of `'./tests'` — a pre-existing misconfiguration from the initial
   scaffold, not something introduced by this phase. This meant `npx
   playwright test` had only ever been running the default
   `.tests/example.spec.ts` boilerplate; the real `tests/smoke.spec.ts` from
   Phase 0, and now `tests/generated/`, were silently never discovered.
   Fixed by correcting `testDir` to `'./tests'`. Verified: `smoke.spec.ts`
   now runs and passes, and generated `test.fixme()` cases correctly show as
   *skipped* rather than invisible.

---

## Phase 1 extension — Two-stage requirement extraction pipeline

**Branch:** `two-stage-requirements-pipeline` (PR open against `main`)

Generalized Phase 1 from "read one hardcoded requirement file" to "map an
arbitrary document into distinct requirements, then generate a test plan for
each one":

- `src/schemas/requirements-list.ts` — contract for Stage 1's output.
- `src/agents/extraction-agent.ts` — maps a raw document (user story, case
  study, PRD, informal notes) into `{ feature, description }[]`.
- `src/run-pipeline.ts` — orchestrates both stages, writes
  `artifacts/requirements.json` and one `artifacts/test-plans/<slug>.json`
  per requirement.

**Bugs found and fixed, in the order they were hit:**

1. **Output truncation on a large document.** Feeding a full ~400-line PRD
   in one call caused the model's JSON response to get cut off mid-array
   before it closed — `JSON.parse` failed. Root cause: no `max_output_tokens`
   set, and even after setting one, the real constraint turned out to be
   Groq's free-tier **rate limit**: 8,000 tokens per minute, input + output
   combined. A single large document can exceed that before generation even
   starts.
2. **Fix: document chunking** (`src/utils/chunk.ts`). Estimates token count
   (char/4 heuristic — deliberately approximate, since the account routes
   through Groq's open models via OmniRoute, not a model with a canonical
   tokenizer), splits on markdown headings when present, falls back to
   paragraph splitting, and hard-splits a single oversized paragraph as a
   last resort. Unit-tested against 4 scenarios (headings, no headings,
   oversized single paragraph, small doc needing no split) before wiring it
   into the real pipeline.
3. **Fix: retry-with-backoff** (`src/utils/retry.ts`). Retries only on `429`
   (genuinely transient) with exponential backoff — deliberately does *not*
   retry `413` (request too large), since no amount of waiting fixes an
   oversized request; that needs chunking, not retrying.
4. **Fix: bounded concurrency** (`src/utils/concurrency.ts`). Stage 2's
   per-requirement calls are independent, so they run through a small
   worker pool instead of one at a time. Important finding from testing
   this: on a free-tier account, the real limit (tokens per minute *and*
   tokens per day) is a shared account-wide budget — concurrency reduces
   wall-clock latency stacking, but does **not** increase total throughput,
   and pushing concurrency too high just produces more `429`s that
   backoff then has to absorb.
5. **Hit Groq's daily quota (200,000 tokens/day), not just per-minute**,
   partway through a concurrency test — confirmed via the API's own error
   message. Not a bug in our code; a hard external constraint. Retry logic
   correctly gave up after 3 attempts rather than hanging, and all
   already-completed output was preserved on disk.

**Quality issues found (not bugs — these are the actual limits of the
approach, not something a chunking or retry fix addresses):**

- Tested against a real, well-structured client PRD (itemized IDs,
  priorities) as well as a synthetic messy case study. Extraction quality
  was noticeably better on the structured document.
- **Hallucination, confirmed twice.** In one case the model invented an
  unstated "maximum 1000 users" constraint and built boundary tests around
  it. In a worse case, a source document's explicit *open question* ("there
  is no requirement yet to revoke a certificate") was misclassified as a
  confirmed requirement, and the test-plan generator then fabricated a
  cascade of fully invented specifics (URL length limits, SSL behavior,
  server migration behavior) with zero grounding in the source.
- **Semantic duplicates slip through.** The same underlying requirement
  was extracted twice under different wording in one run; de-duplication
  is currently exact-string-match on the feature name, so it doesn't catch
  this.
- None of the above is caught automatically today — a human still has to
  read the `assumptions` field and the extracted requirement list. This is
  the argument for building a real evaluation set (roadmap Phase 9) rather
  than continuing to patch prompts reactively.

---

## Phase 1 — Requirement → validated test plan (single file)

**Branch:** `phase-1-requirement-agent` (merged to `main` via PR #1)

- `src/schemas/test-plan.ts`, `src/ai/client.ts`,
  `src/agents/requirement-agent.ts`, `src/run-requirement-agent.ts`.
- AI backend: local **OmniRoute** gateway (`http://localhost:20128/v1`)
  routing to **Groq** (`groq/openai/gpt-oss-120b`, free tier), after OpenAI
  billing had no credits. `client.ts` needed both `apiKey` and `baseURL`
  set — missing `baseURL` was the first bug (requests were silently going
  to OpenAI's real API with a gateway key, producing a misleading 401).
- Verified end-to-end: `requirements/login.md` → validated
  `artifacts/test-plan.json`.

## Phase 0 — Environment

Standard `npm init playwright@latest` scaffold (TypeScript, GitHub Actions).
`.env` originally had `.gitignore` content accidentally pasted into it —
fixed by separating the two files properly.
