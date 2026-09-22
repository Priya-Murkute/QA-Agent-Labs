# Build Log

This is the story of how this project actually got built — not a polished
changelog, but a record of what we tried, what broke, why it broke, and how
we fixed it. The goal is that anyone (including future us) can read this and
understand the reasoning, not just the outcome. Newest entries at the top.

---

## Fixing two agents that were quietly making things up

**Branch:** `fix-requirement-hallucination`

While testing the pipeline against a realistic PRD, we found a genuinely bad
failure. The source document had a section called "Risks and Open
Questions" that included this line: *"there is no requirement yet... to
revoke a previously issued certificate."* That sentence is explicitly
saying "we haven't decided this" — but our extraction agent didn't know the
difference between "this is a confirmed requirement" and "this is a note
about something unresolved." It pulled that sentence out as if it were a
real feature to test.

It got worse from there. The next agent in the pipeline — the one that
turns a requirement into actual test cases — only ever sees the requirement
in isolation, with none of the surrounding context. Handed this vague,
made-up "feature" with nothing real behind it, it didn't say "I don't have
enough information." It confidently invented details: a specific 2048-
character URL length limit, behavior around expired SSL certificates,
behavior during a server migration. None of that existed anywhere in the
source document. It just sounded plausible enough to pass as real.

That's the core danger with these agents: they don't fail loudly when
they're missing information. They fail quietly, by making something up that
reads exactly like a fact.

**How we fixed it**, in two places, because either agent could make this
mistake independently of the other:

- The **extraction agent** now gets explicit instructions to recognize the
  difference between "this document describes a real requirement" and
  "this document is telling you something is undecided, out of scope, or a
  risk." We gave it concrete signal phrases to watch for, so it has
  something specific to check against instead of a vague sense of
  "does this sound testable."
- The **test-plan agent** now gets an explicit rule: don't invent specific
  numbers, protocols, or infrastructure behavior that isn't actually stated.
  If the requirement doesn't say how long is "too long," write the test
  around "an unusually long value" instead of inventing a number that
  sounds authoritative but isn't real.

**How we know it actually worked**, rather than just hoping the prompt
change helped: we tested each fix on its own, against the exact scenario
that broke before.

First, we fed the extraction agent a tiny document with one real
requirement (password reset) sitting right next to the exact "risks" text
that tricked it last time. It came back with exactly one requirement —
password reset — and correctly ignored the risk note entirely.

Then, separately, we called the test-plan agent directly with the exact
vague description that previously caused it to invent the URL length limit
and SSL scenarios. This time, it stuck to what was actually knowable: does
the link work, does an invalid link show an error, does an unusually long
identifier still work, and — importantly — it correctly said that
revocation is "not currently supported" instead of pretending a revoke
feature existed.

**What's still not fixed:** the pipeline can still extract the same real
requirement twice under two different names (we saw this happen once, and
our current duplicate-detection only catches exact name matches, not
things that are worded differently but mean the same thing). And there's
still no proper evaluation dataset — right now we catch problems by
manually reading output and noticing something looks wrong, which doesn't
scale and won't catch a regression automatically next time we change a
prompt. That's the argument for building a real evaluation set before
adding much more.

---

## Phase 2 — Turning a test plan into an actual Playwright file

**Branch:** `phase-2-playwright-generator`

Up to this point, everything we built produced JSON — a structured list of
test cases, but nothing that could actually run in a browser. Phase 2 closes
that gap: it takes a validated test plan and turns it into a real
`.spec.ts` file.

We deliberately didn't ask the AI to write the Playwright code itself. The
generator is plain, boring TypeScript that turns each test case into a
`test.fixme(...)` block — the title, the preconditions and steps written as
comments, and two clear TODOs where a real Playwright action and assertion
need to go. This keeps the same boundary we've used everywhere else in this
project: the AI proposes, validated data flows through, and a human reviews
before anything executes for real. We didn't want an agent silently writing
arbitrary browser-automation code with no one looking at it first.

We used `test.fixme()` instead of a plain `test()` on purpose. An empty
skeleton with no real assertions would technically "pass" if left as a
normal test — which is a lie. `fixme` reports it as "not implemented yet"
in Playwright's output, which is the honest thing to say.

**Two real bugs turned up while checking this actually worked, not just
that it looked right on screen:**

The first was small — a text-escaping function meant for a JavaScript
string literal was also being applied to a plain code comment, so comments
ended up with ugly literal backslashes in them (`\'Invalid email or
password.\'` instead of a clean quote). Comments don't need that kind of
escaping at all, so we split the escaping logic into two purposes and fixed
it.

The second was much bigger, and honestly a little concerning: the
project's Playwright config was pointing at a hidden folder called
`.tests` instead of the normal `tests` folder. That meant that ever since
this project was first set up, running `npx playwright test` only ever ran
Playwright's own default example test — our actual smoke test from Day 1,
and anything we'd generate going forward, were completely invisible to the
test runner. Nobody would have noticed just by watching tests report
"passing," because the tests that mattered were never being run at all.
We fixed the config, then proved it: our real smoke test now runs and
passes, and the newly generated skeleton tests correctly show up as
"skipped" instead of vanishing silently.

---

## Making the pipeline handle real-world-sized documents

**Branch:** `two-stage-requirements-pipeline` (the chunking/retry/concurrency work)

Everything worked fine on small, hand-written examples. It broke the moment
we pointed it at an actual full-length PRD.

The first failure looked like the model just... stopped mid-sentence. The
JSON it returned wasn't closed properly, so parsing it failed. The real
reason took some digging: the free AI tier we're using has a hard limit on
how many tokens (roughly, words) it will process per minute, counting both
what we send it and what it sends back. A long document alone can use up
that whole budget before the model even finishes replying.

The fix was to stop sending whole documents in one shot. We built a small
utility that estimates how big a chunk of text is, and splits a document
into pieces that each fit comfortably within budget — preferring to split
along natural section headings so related content stays together, and
falling back to splitting by paragraph if there are no headings at all. We
didn't just trust that this worked — we wrote a handful of test scenarios
for the splitting logic itself (a document with headings, one without,
one giant unbroken block of text, and a document too small to need
splitting at all) before ever wiring it into the real pipeline.

Alongside that, we added a retry mechanism, but a deliberately narrow one.
If the model says "you're sending requests too fast, slow down," that's
worth waiting a couple of seconds and trying again. If the model says "this
single request is just too big," waiting doesn't help — no amount of
patience shrinks an oversized request. So retries only apply to the first
kind of failure, not the second.

We also tried running multiple requests at once instead of one after
another, since each individual extracted requirement is independent of the
others and doesn't need to wait its turn. This did help with the dead time
of waiting on network latency, but it came with an important lesson: our
free-tier account has a shared budget for the whole account, not per
request. Running things in parallel doesn't give you more budget — it just
spends the same budget faster, which mostly showed up as more "slow down"
messages rather than genuinely finishing sooner.

That lesson got proven the hard way, too: partway through a bigger test,
we didn't just hit the per-minute limit — we ran out of the entire day's
allowance (200,000 tokens/day on the free tier), something we hadn't even
known existed until the error message told us. Nothing was lost — every
requirement and test plan that had already finished stayed saved on disk —
but it was a clear reminder that "add more concurrency" only gets you so
far against a fixed budget you don't control.

**What this version can do that the first version couldn't:** take any
requirements document — not just one small, pre-written file — split it
into distinct real requirements, and generate a validated test plan for
each one. We proved this on a real client-style PRD (well-structured, with
numbered requirements) and on a deliberately messy, prose-heavy synthetic
document, and it handled both.

---

## Phase 1 — The first real agent: turning a requirement into a validated test plan

**Branch:** `phase-1-requirement-agent`

This is the smallest possible version of the whole idea: read one
requirement, ask an AI to propose test cases, and — critically — never
trust what comes back until it's checked. We used a schema (a strict
description of exactly what shape the data must be) to validate the
model's output before saving anything to disk. If the model returns
something that doesn't match, the run fails loudly instead of silently
saving garbage.

Getting the AI connection itself working took a few real detours. We
started by trying OpenAI directly, but the account had no billing credit,
so we routed through a local gateway tool called OmniRoute instead, which
lets you point at many different AI providers through one connection. We
ended up using Groq's free tier through that gateway. The very first
attempt to use it still failed — the client code had the right access key,
but was still pointed at OpenAI's real servers instead of the gateway, so
naturally it got rejected. Once that was fixed, the whole chain worked:
a plain-English login requirement went in, and a validated, schema-correct
test plan came out the other side.

---

## Phase 0 — Getting a normal Playwright project running, before any AI was involved

Standard project setup: Node, TypeScript, Playwright, GitHub Actions. One
small early mistake worth recording: the `.env` file (which should only
ever hold secret values like API keys) accidentally had the contents of
`.gitignore` pasted into it as well. Easy to miss, easy to fix — just a
reminder to actually look at a file's contents rather than assume it's
right because it was created by a wizard.
