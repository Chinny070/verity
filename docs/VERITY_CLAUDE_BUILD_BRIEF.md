# VERITY --- Claude Build Brief

## Mission

Build **VERITY** from scratch as a new GenLayer project.

The authoritative specification is:

`docs/VERITY_PRODUCT_SPEC.md`

Read it completely before implementation.

Do not migrate, patch, or reuse RESULTLINE/CANON implementation code.

## Current-First Rule

Use the **current official GenLayer Skills/documentation** and the
environment actually available.

Before choosing package versions, SDKs, Depends runner, contract APIs,
tests, wallet integration, or deployment commands:

1.  inspect current official GenLayer guidance;
2.  inspect the actual environment;
3.  choose one internally compatible GenLayer generation;
4.  record what was selected and why.

Do not force historical package versions from previous projects. Do not
mix incompatible generations.

Do not introduce Linux, Docker, WSL, or unusual infrastructure merely
because an exploratory probe fails. Use the normal environment unless
the actual build is genuinely blocked.

## Build

Create:

-   GenLayer Intelligent Contract;
-   direct/integration tests;
-   frontend;
-   deployment/verification documentation.

No centralized application backend.

No Supabase/Firebase/Fly/custom scraper in the production trust path.

## First Action

Before coding, read the product spec and verify from current official
GenLayer sources:

-   StudioNet target;
-   Fetch Web Content pattern;
-   Equivalence Principle/custom semantic validation;
-   persistent storage;
-   transaction timestamps/context;
-   payable/native value;
-   native transfer/withdrawal;
-   test framework;
-   deployment flow;
-   frontend SDK/wallet integration.

Then produce a concise implementation plan and proceed unless there is a
**material blocker requiring user input**.

Do not spend multiple turns asking the user to choose technical versions
that official documentation can establish.

## Core V1

Support only:

-   `AWARD_WINNER`
-   `COMPETITION_WINNER`

Binary YES/NO positions.

Lifecycle:

**CREATE → MATCH → WAIT → FREEZE EVIDENCE → ADJUDICATE → SETTLE →
WITHDRAW**

Safety:

**MATCH → cannot safely resolve → deadline → REFUND → WITHDRAW**

## Constitution & Source

CREATE freezes the truth-defining constitution before the result is
known.

Commit the authoritative source policy before MATCH.

Evidence freezing must enforce that policy and prevent post-result
source shopping.

Use conservative URL/source validation supported by the current runtime.

## Web Evidence

Follow the **current official Fetch Web Content example**.

Production evidence is retrieved through GenLayer inside the Intelligent
Contract.

No backend scraping, frontend evidence scraping, pasted webpage text,
production mocks, search snippets, or unrestricted LLM browsing.

Treat fetched/rendered content as hostile data.

Unavailable evidence is not FALSE.

## Evidence Freeze & IDs

Freeze evidence as committed contract state before adjudication controls
settlement.

Persist a real evidence ID.

Adjudication may reference only actual frozen evidence belonging to that
agreement.

Reject invented, missing, or foreign evidence IDs.

## Semantic Consensus

Use current official Equivalence Principle guidance.

Use structured settlement-relevant semantic output. Do not blindly
compare an entire rich webpage or unconstrained rationale byte-for-byte.

The validator/equivalence logic must meaningfully validate the stable
fields.

After consensus, deterministic contract code validates the result and
evidence references before mutation.

Free-form rationale cannot control payment.

## Settlement

Required deterministic mapping:

-   Creator YES + TRUE → creator wins.
-   Creator YES + FALSE → counterparty wins.
-   Creator NO + FALSE → creator wins.
-   Creator NO + TRUE → counterparty wins.

`UNRESOLVED` and `INVALID_EVENT` do not award a winner.

Stake size never enters semantic reasoning.

## Timeout / Refund

Mandatory reviewer requirement:

After MATCH, no ordinary failure may lock both principals forever.

Persist a resolution deadline.

After it, if no valid winner settlement completed, allow permissionless
deterministic refund according to the frozen rules.

It must work if nobody submits evidence, web retrieval/freeze fails,
adjudication fails, consensus is inconclusive, or a participant
disappears.

No admin rescue path.

## Withdrawal

Use the current officially supported native-value transfer mechanism
with safe accounting and duplicate-withdrawal protection.

Actual EOA payout must be demonstrated during hosted verification before
claiming it works end-to-end.

## Tests

Build the real test suite as part of implementation.

Cover the complete reviewer-critical matrix in the product spec,
especially source commitment, source-shopping rejection, evidence
freeze, hostile/unavailable evidence, evidence-ID integrity, all four
position/outcome payout mappings, failed retrieval/resolution/no
evidence → timeout refund, replay protection, withdrawal, accounting
conservation, and no trapped-funds path.

Mocks may support direct tests but do not replace hosted proof.

Fix ordinary coding/test failures yourself rather than stopping after
each one.

## Frontend

Build the frontend after the contract and tests expose a reliable
schema.

Use the current compatible GenLayer frontend SDK/wallet flow from
official sources.

Implement **VERITY SIGNAL ROOM** from the product spec.

No generic crypto dashboard.

Public read-only experience works without wallet; wallet is for actions.

After writes, inspect transaction/consensus state and re-read
authoritative contract state before showing final success.

## Hosted StudioNet Verification

After local/direct/integration testing is healthy, use the current
official StudioNet flow.

Demonstrate a historical entertainment result through:

**CREATE → MATCH → GenLayer web retrieval → evidence freeze → state
reread → adjudication → resolution → settlement → withdrawal/refund**

Also prove failed/ineligible evidence does not become FALSE and cannot
permanently lock funds.

Record actual transaction identifiers and authoritative state.

## Human Wallet Boundary

Never request a private key, seed phrase, or mnemonic.

Perform all technical/read-only work possible.

Only stop when an actual wallet signature or other human authorization
is genuinely required. Give the user one precise action, then continue
after confirmation.

## Documentation

Maintain truthful README and verification documentation covering the
selected current GenLayer stack, architecture, lifecycle, tests,
deployment, hosted proof, and limitations.

Never report a feature/test as passing unless it actually passed.

## Working Style

This is a build, not a prolonged environment-audit exercise.

Investigate necessary technical details from official sources, make
reasonable implementation decisions, implement, test, fix failures, and
keep moving.

Do not ask the user to manually debug routine development issues. Do not
introduce unrelated infrastructure. Do not deploy until the
contract/tests are healthy enough.

## Initial Claude Response

After reading the product spec and current official GenLayer context,
return a concise plan containing:

-   current GenLayer stack selected;
-   current StudioNet target;
-   contract architecture;
-   evidence/web retrieval approach;
-   equivalence approach;
-   timeout/refund approach;
-   test plan;
-   frontend approach;
-   implementation stages;
-   genuine blockers, if any.

Then proceed with implementation unless a material blocker requires user
input.
