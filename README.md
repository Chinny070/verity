# VERITY

> The event ends. The web reacts. VERITY establishes the official outcome.

VERITY is a GenLayer Intelligent Contract dApp that settles binary
YES/NO entertainment-outcome agreements (`AWARD_WINNER`,
`COMPETITION_WINNER`) against a source that both sides commit to
*before* the event, adjudicated by real GenLayer validator consensus --
no oracle operator, no admin key, no backend in the trust path.

**This is not a design document. Everything described below has been
run live against GenLayer StudioNet with a real historical event (the
96th Academy Awards), and every transaction hash is real and
independently verifiable.** See `docs/RELEASE_VERIFICATION.md` for the
complete record.

## The trust problem

Two people want to bet on a real-world outcome -- "Film X wins Best
Picture" -- without trusting each other, a bookmaker, or a centralized
oracle operator who could be bribed, hacked, or simply wrong. A
traditional smart contract can hold the stake, but it cannot *read the
news* to find out who won: EVM contracts have no access to the open
web, and any off-chain reporter (a "trusted" API, a single node fetching
a URL and posting the answer) reintroduces exactly the single point of
trust the contract was supposed to remove.

## Why GenLayer is necessary

GenLayer's Intelligent Contracts run inside GenVM, which gives contract
code two things ordinary EVM contracts don't have:

1. **Real web retrieval as a first-class, consensus-verified operation**
   (`gl.nondet.web.render`) -- multiple independent validators fetch the
   same committed URL and must reach agreement before the result is
   accepted into contract state.
2. **LLM reasoning as a first-class, consensus-verified operation**
   (`gl.nondet.exec_prompt`) -- validators independently interpret
   unstructured evidence text (a news article, an awards-show recap)
   against a fixed, structured question, and must agree before the
   interpretation is accepted.

Neither retrieval nor interpretation is trusted from any single node.
VERITY's entire value proposition depends on this: it lets two strangers
settle a real-world entertainment outcome with the same trust model as a
transfer of GEN, not "trust this API."

## V1 scope

- Outcome types: `AWARD_WINNER`, `COMPETITION_WINNER` only.
- Binary YES/NO propositions, two-party (creator vs. counterparty),
  equal stakes.
- One committed authoritative source per agreement, one frozen evidence
  record per agreement (no multi-source fallback in V1).
- No backend. The frontend talks directly to the deployed Intelligent
  Contract; every write happens through GenLayer's own consensus, every
  read is a real contract call.

## Architecture

```
contracts/verity.py              Intelligent Contract (single file, frozen -- see below)
tests/direct/                    pytest, pure-logic unit tests (no GenVM needed)
tests/integration/                gltest lifecycle tests, run live against StudioNet
scripts/hosted_demo.py            full hosted lifecycle demo (real web + real LLM consensus)
frontend/                        Vite + genlayer-js "Signal Room" UI, wired to the real deployment
docs/VERITY_PRODUCT_SPEC.md       product spec (authoritative for product decisions)
docs/VERITY_CLAUDE_BUILD_BRIEF.md build brief
docs/ADJUDICATION.md              why/how the custom leader/validator equivalence principle works
docs/RELEASE_VERIFICATION.md      frozen contract identity + every real hosted transaction hash
docs/SECURITY_AUDIT.md            threat-by-threat audit of the frozen contract
STACK.md                          selected GenLayer generation + how it was verified
gltest.config.yaml                pins StudioNet as the default test target (no Docker needed)
```

## The Resolution Constitution

Every agreement commits, at `create_agreement()` time, before anyone
knows the outcome and before a counterparty has even matched:

- **Proposition** -- the exact YES/NO question being settled.
- **Subject / event category** -- what and which event.
- **Creator's position** (`YES`/`NO`).
- **Source policy** -- `source_host` + `source_path_prefix`: the exact
  domain and URL-path prefix that will be treated as authoritative.
- **Timing**: `match_close_time <= expected_event_time <=
  resolution_not_before < resolution_deadline` -- enforced as a strict
  ordering at creation (`validate_constitution()`), so an agreement
  cannot be constructed with an internally inconsistent timeline.

None of this can be changed after creation. There is no admin function,
no upgrade path, no setter for any of these fields.

## Source commitment and source-shopping protection

`freeze_evidence(agreement_id, url)` only accepts a URL that matches the
*already-committed* `source_host`/`source_path_prefix`
(`url_matches_policy()`): exact scheme (`https://` only), exact host
match (case-insensitive, no subdomain trickery, no port or userinfo
smuggling), path starting with the committed prefix. A creator cannot
commit to `oscars.org` and then, after seeing an unfavorable real
result, freeze evidence from a sympathetic blog instead -- the contract
rejects it. Live-verified: `test_source_shopping_rejected_at_freeze`.

## Web evidence

Evidence is fetched exactly once, by `gl.nondet.web.render(url,
mode="text")`, inside GenVM's non-deterministic block -- run
independently by the leader and by matching validators, never by the
frontend, never by any off-chain script. The result is canonicalized
(bounded length, JSON-serialized) and frozen into contract storage as an
`Evidence` record bound to the agreement's id. `freeze_evidence` can only
be called once per agreement -- no re-fetch-until-favorable.

**Actually observed:** a real fetch of
`https://en.wikipedia.org/wiki/96th_Academy_Awards`, canonicalized and
stored on-chain, in tx
`0x1622dfc3e2fb3fc1bd3a5fc7d2110ed2f7be83fb351ad790ad4d3b3f025c5adb`.

## Semantic consensus (adjudication)

This is the part that changed most during hardening, and it is worth
reading `docs/ADJUDICATION.md` in full. Short version:

`adjudicate()` does **not** use a generic "AI voting" mechanism, and it
does **not** use `gl.eq_principle.strict_eq` (which requires
byte-identical output and turned out to be unworkable against
StudioNet's real heterogeneous LLM validator pool). It uses the current
official GenLayer custom leader/validator equivalence principle,
`gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`:

1. The **leader** independently evaluates the frozen evidence against
   the frozen Resolution Constitution once, and returns a tightly
   structured JSON result (`outcome`, `source_authority`,
   `event_status`, `temporal_validity`, `subject_match`,
   `category_match`, `evidence_sufficiency`,
   `evidence_ids_relied_on`, and a separate bounded `rationale`).
2. Each **validator independently re-derives its own result** from
   scratch, against the *same* frozen evidence and the *same* frozen
   constitution -- never given the leader's text -- and only then
   compares its own result to the leader's, field by field, requiring
   **exact equality** on `outcome`, `event_status`, `temporal_validity`,
   `subject_match`, `category_match`, and `evidence_sufficiency`.
   `rationale` is never compared and never affects consensus.
3. `validate_adjudication_result()` (a pure, unit-tested function)
   deterministically re-checks the consensus-accepted result against
   contract storage afterward -- evidence ids must be real and frozen
   for this specific agreement, and a `CONFIRMED_TRUE`/`CONFIRMED_FALSE`
   outcome additionally requires all the supporting boolean fields to be
   true, or it is forced to `UNRESOLVED`.

Stake size is never in the prompt. Rationale never controls payout.
**Actually observed:** real consensus reaching quorum (3 of 5 validators
agreeing) on tx
`0x7b7160f8308c8fc5946f3c7c0d96640612d37ae18f724752332e3a71d7b2b0a8`,
committing `CONFIRMED_TRUE`.

## Settlement

`settle()` maps `creator_position` + `canonical_outcome` to a winner
through a small, pure, exhaustively unit-tested function
(`compute_winner`):

| creator_position | canonical_outcome | result |
|---|---|---|
| YES | CONFIRMED_TRUE | creator wins |
| YES | CONFIRMED_FALSE | counterparty wins |
| NO | CONFIRMED_FALSE | creator wins |
| NO | CONFIRMED_TRUE | counterparty wins |
| either | UNRESOLVED / INVALID_EVENT | no winner -- refund path |

Settlement is permissionless (anyone can call `settle()` once
adjudicated) so a beneficiary is never dependent on the *other* party's
cooperation to claim their win.

## Timeout / refund and the no-locked-funds guarantee

If evidence is never frozen, or adjudication never completes, before
`resolution_deadline`, `refund()` becomes callable by **anyone**
(permissionless, not just the two parties) and transitions the agreement
to `REFUNDED`. Both principals can then independently `withdraw()`
their own stake, exactly once each (duplicate withdrawal is rejected).
The same applies if adjudication explicitly resolves to
`UNRESOLVED`/`INVALID_EVENT`. An unmatched agreement can also be
cancelled by its creator and refunded. Live-verified end to end,
including a stranger account (not either principal) triggering the
refund: see `test_no_evidence_timeout_refund_and_withdrawal`.

## Frontend

`frontend/` (Vite + `genlayer-js`, no framework) is wired to the real
deployed StudioNet contract (`frontend/src/config.js`) -- no mock data
path exists anywhere in the code. Public visitors, with no wallet
connected, can:

- Browse every agreement's proposition, outcome type, creator position,
  stake, lifecycle stage, committed source, evidence URL/id, canonical
  resolution, rationale, and settlement/refund status (all live reads).
- Walk through a **Reviewer Demo** panel that live-reads the real 96th
  Academy Awards agreement and shows the committed source, frozen
  evidence, evidence id, real consensus votes, canonical resolution, and
  the permanent transaction log with StudioNet explorer links -- built
  specifically so a reviewer can understand why GenLayer is necessary
  without reading source code.

A wallet is required only to *act* (create, match, freeze evidence,
adjudicate, settle, refund, withdraw). Every write action shows a
pending state, is tracked through to a decision via the current SDK,
and **only shows success after re-reading authoritative contract state
and confirming the leader's own execution actually succeeded** --
`writeContract()` throws a typed `VerityTxError` (never a raw SDK
error as primary UX) for wallet rejection, submit failure,
delayed/inconclusive consensus, or contract-level rejection, each
mapped to a specific, human-readable message (see
`frontend/src/genlayerClient.js` / `main.js`).

## Testing

```bash
python -m pytest tests/direct -q                          # unit, no network, ~1s
python -m pytest tests/integration/test_verity_lifecycle.py -v   # live StudioNet
python -m pytest scripts/hosted_demo.py -v -s              # full hosted lifecycle demo
```

`gltest.config.yaml` pins `studionet` as the default network -- **no
Docker, no local `genlayer up`, no local GenVM node is required for
any of this.** StudioNet is hosted and gasless.

Current status: 30/30 unit tests passing; 8/8 integration tests passing
live against StudioNet (occasional single-test flakiness has been
observed and is StudioNet-side HTTP infrastructure -- transient 502s /
connection errors -- not contract logic; always confirmed by an
immediate isolated re-run in this session's history).

## Hosted StudioNet proof

Full detail, every hash, in `docs/RELEASE_VERIFICATION.md`. Summary:

- **Contract:** `0xd0E0ccd9Fd5BB364A439332EFdf397FA74004655` on
  StudioNet (chainId `61999`)
- **Real event:** "Oppenheimer wins Best Picture at the 96th Academy
  Awards," sourced from `en.wikipedia.org`
- **Full lifecycle run live:** create -> match -> real web fetch ->
  evidence freeze -> real multi-validator consensus (3/5 agree) ->
  `CONFIRMED_TRUE` -> settle (creator, who held `YES`, correctly wins)
  -> withdraw
- Separately verified live: timeout/refund with a permissionless
  stranger-triggered refund and duplicate-withdrawal rejection

## How to run locally

```bash
# contract logic (no GenVM needed)
python -m pytest tests/direct -q

# live StudioNet tests (no Docker needed -- StudioNet is hosted)
python -m pytest tests/integration/test_verity_lifecycle.py -v

# frontend, against the real deployed StudioNet contract
cd frontend && npm install && npm run dev
```

To deploy a fresh instance instead of using the frozen reference
deployment: `genlayer deploy --contract contracts/verity.py --args '[]'`
against `https://studio.genlayer.com/api`, then update
`CONTRACT_ADDRESS` in `frontend/src/config.js`.

## Known limitations

- V1 evidence model is one frozen evidence record per agreement (spec
  section 8); no multi-source fallback.
- No allowlist of "legitimate" authoritative domains -- source
  trustworthiness is judged by the counterparty before matching (they
  can decline to match a bad-faith source) and by the LLM's
  `source_authority` field during adjudication, not by an on-chain
  registry. See `docs/SECURITY_AUDIT.md`.
- No IDN/homograph domain-spoofing defense (same risk class as any
  web-based oracle).
- `settle()` is permissionless with no expiry -- if nobody ever calls it
  after a definitive adjudication, funds are not locked (anyone can
  still call it at any time), but there is no automatic push; this
  matches common escrow-contract design and is documented, not treated
  as a bug.
- Integration tests occasionally hit transient StudioNet HTTP
  infrastructure errors (502s); this is the hosted network's own
  reliability, not VERITY's logic, and is not hidden -- see
  `docs/RELEASE_VERIFICATION.md`.

## Future work

- Multi-source evidence with fallback/corroboration.
- Additional `outcome_type`s beyond awards/competitions.
- On-chain registry or reputation signal for authoritative sources.
- Appeal path using GenLayer's native appeal/re-execution mechanism for
  disputed adjudications.
