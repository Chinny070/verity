# VERITY

> The event ends. The web reacts. VERITY establishes the official outcome.

VERITY is a GenLayer Intelligent Contract dApp that settles binary
YES/NO entertainment-outcome agreements (`AWARD_WINNER`,
`COMPETITION_WINNER`) against a precommitted authoritative web source,
adjudicated by GenLayer validator consensus.

Full spec: `docs/VERITY_PRODUCT_SPEC.md`. Build brief:
`docs/VERITY_CLAUDE_BUILD_BRIEF.md`. Stack decisions and how they were
verified: `STACK.md`.

This is a from-scratch build. No code was copied from other GenLayer
projects on this machine — the contract-side API was verified against
the actual output of the official `genlayer new` scaffold (see STACK.md).

## Layout

```
contracts/verity.py              Intelligent Contract (single file)
tests/direct/                    pytest, pure-logic unit tests (no GenVM needed)
tests/integration/                gltest lifecycle tests (need a running GenVM node)
frontend/                        Vite + genlayer-js "Signal Room" UI
docs/                            product spec + build brief (authoritative)
STACK.md                         selected GenLayer generation + how it was verified
```

## Lifecycle implemented

CREATE → MATCH → (WAIT) → FREEZE EVIDENCE → ADJUDICATE → SETTLE → WITHDRAW

Safety path: MATCH → resolution deadline passes without a valid winner
settlement → REFUND (permissionless) → WITHDRAW. An unmatched CREATE can
also be cancelled by its creator and refunded.

Payout mapping (deterministic, contract-enforced):

| creator_position | canonical_outcome | result |
|---|---|---|
| YES | CONFIRMED_TRUE | creator wins |
| YES | CONFIRMED_FALSE | counterparty wins |
| NO | CONFIRMED_FALSE | creator wins |
| NO | CONFIRMED_TRUE | counterparty wins |
| either | UNRESOLVED / INVALID_EVENT | no winner — refund path |

## What was actually tested (truthful status)

**Direct/unit tests — RAN, PASSING.** `tests/direct/test_verity_logic.py`
imports the contract's pure deterministic helper functions (constitution
validation, source-policy/source-shopping matcher, creator-position→payout
mapping for all 4 combinations + no-winner cases, and deterministic
adjudication-result validation including hostile/malformed/foreign-evidence-id
inputs) directly with pytest, no GenVM required.

```
$ python -m pytest tests/direct -q
29 passed
```

**Integration/lifecycle tests — WRITTEN, NOT EXECUTED.**
`tests/integration/test_verity_lifecycle.py` uses the official `gltest`
harness against a real GenVM node and covers matching rules,
self-match/wrong-stake/duplicate-match rejection, unmatched
cancel+refund+withdraw, the no-evidence timeout→refund→withdraw path
(with duplicate-withdrawal rejection), premature-refund rejection, and
source-shopping rejection at freeze time. **These were not run in this
environment**: `genlayer up` requires a working Docker Engine, and the
Docker Desktop service on this machine (`com.docker.service`) is
installed but not running / not startable from this non-interactive
session. This is a genuine environment blocker, not a design gap — see
"Remaining Human Action" below.

**Full web-retrieval → adjudicate → settle happy path — NOT YET TESTED.**
Requires the same running node plus outbound web/LLM access, which is
also the StudioNet hosted-verification step from spec section 17. Not
performed.

**Frontend — build RAN, PASSING.** `npm run build` inside `frontend/`
succeeds against the real `genlayer-js` SDK (454 modules, `vite build`
green). This only proves the app bundles and imports the real SDK
correctly — it does not prove any on-chain interaction, since nothing is
deployed yet. The app is wired to genlayer-js against a real contract
address only (no mock data path exists in the code at all — if
`CONTRACT_ADDRESS` in `frontend/src/config.js` is unset, the UI shows an
explicit "not deployed" banner rather than fabricating agreements). It
has not been exercised in a browser against a live node.

Do not read any status above as "passed" unless it says PASSING.

## Local development

```bash
# contract logic (no GenVM needed)
python -m pytest tests/direct -q

# full toolchain (needs Docker Engine running)
npm install -g genlayer
genlayer init
genlayer up
gltest tests/integration -v

# frontend
cd frontend && npm install && npm run dev
```

## Deployment

Not yet deployed. Deploying requires a funded StudioNet account and a
wallet signature — see "Remaining Human Action".

Once deployed, set `frontend/src/config.js` → `CONTRACT_ADDRESS` to the
deployed address; the frontend needs no other change to go live, since it
already only ever talks to the real Intelligent Contract (public reads
work without a wallet; wallet is required only to submit a write).

## Known limitations

- Integration/hosted verification blocked in this environment (Docker
  Engine not running; see above). The contract and direct tests are real
  and passing; the full lifecycle-under-GenVM and StudioNet hosted proof
  from spec section 17 have not been executed.
- V1 evidence model is one frozen evidence record per agreement, per
  spec section 8; no fallback-source multi-evidence handling is
  implemented yet.
- `freeze_evidence` and `adjudicate` are separate transactions
  (state persisted between them) rather than fused into one call, so the
  evidence-ID integrity check in `adjudicate` is a real read of
  previously committed contract state, not a same-call assumption.

## Remaining human action

To proceed to hosted verification, one of the following is needed from
you (no private key/seed phrase is ever needed from you for the technical
work itself):

1. Start Docker Desktop (or otherwise bring `com.docker.service` to a
   running state) so `genlayer up` can start a local GenVM node, so the
   integration test suite and a first local lifecycle run can actually
   execute — **or**
2. Provide/confirm a StudioNet RPC endpoint and a funded deployer account
   you control, so deployment and hosted verification can proceed
   directly against StudioNet instead of a local node (final settlement
   withdrawal to an EOA will still need your wallet's signature at that
   step, which I will ask for by name when reached, never your key).
