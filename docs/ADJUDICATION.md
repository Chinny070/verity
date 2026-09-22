# VERITY adjudication: custom leader/validator equivalence principle

## Why this changed

`adjudicate()` originally used `gl.eq_principle.strict_eq`, which requires
every validator to reproduce **byte-identical** output. StudioNet's
validator pool runs heterogeneous LLM families per node (observed in one
live run: `prd-gpt-oss`, `prd-sonnet`, `prd-gemini`, `prd-deepseek`,
`prd-kimi`, `prd-mistral`, `prd-grok`, `prd-minimax`, ...). Free-form LLM
JSON essentially never matches byte-for-byte across different model
families, so `adjudicate()` never actually committed a resolved state even
though the leader's own execution reported `SUCCESS` (`strict_eq` only
guarantees the leader ran; it says nothing about whether validators agree
if they can't literally reproduce the string).

## What it uses now: `gl.vm.run_nondet_unsafe` with a custom validator

Per the current official GenLayer Equivalence Principle documentation
(<https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle>):

> Pick your validation method by reproducibility. If validators can
> reproduce the exact output, use `strict_eq`. If not, use an LLM-based or
> custom validator... For most contracts you'll write a custom validator
> function. It gives you full control over comparison logic and error
> handling.

The docs give the exact current API:

```python
result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
```

- `leader_fn()` takes nothing, returns any GenVM-serializable value (a
  `dict` here).
- `validator_fn(leader_result)` receives a `gl.vm.Result` --
  `gl.vm.Return[T]` (leader succeeded; unwrap via `.calldata`),
  `gl.vm.UserError`, or `gl.vm.VMError` -- and returns `bool`.
- The documented recommended pattern for a custom validator is: **re-run
  the leader function independently, then compare the results** on the
  decision-bearing fields only (documented example: `leader_data["winner"]
  == validator_data["winner"] and leader_data["score"] ==
  validator_data["score"]`, explicitly *not* comparing free-text analysis).

This is exactly the mechanism `Contract.adjudicate()` in
`contracts/verity.py` implements:

```python
def evaluate_evidence() -> dict:
    # Builds the adjudication prompt from the frozen proposition, subject,
    # event_category and frozen evidence.canonical_content; calls
    # gl.nondet.exec_prompt; parses and returns the structured JSON dict.
    ...

def validator_fn(leader_result) -> bool:
    if not isinstance(leader_result, gl.vm.Return):
        return False
    leader_data = leader_result.calldata
    validator_data = evaluate_evidence()  # independent re-derivation
    for field in DECISION_FIELDS:
        if leader_data.get(field) != validator_data.get(field):
            return False
    return True

result = gl.vm.run_nondet_unsafe(evaluate_evidence, validator_fn)
```

Note `validator_fn` never sees the leader's *prompt run* or *text* -- it
calls `evaluate_evidence()` itself, from scratch, against the same frozen
evidence and the same frozen constitution fields (`proposition`,
`subject`, `event_category`, `canonical_content`, all read from already-
committed contract storage, not re-fetched). Only the two independently
produced structured results are ever compared, and only on the fields
listed below.

## Decision-bearing fields (exact match required)

```python
DECISION_FIELDS = (
    "outcome",
    "event_status",
    "temporal_validity",
    "subject_match",
    "category_match",
    "evidence_sufficiency",
)
```

Every one of these must be **exactly equal** between the leader's result
and a validator's independently-derived result for that validator to
accept (`==`, not similarity/fuzzy matching, not an LLM judging whether
they "look similar"). `source_authority` and `evidence_ids_relied_on` are
still present in the structured output and are re-validated
deterministically in `validate_adjudication_result()` (below), but are not
part of the leader/validator exact-match set the equivalence principle
itself enforces -- `source_authority` is a corroborating signal the
deterministic validator already re-derives its own boolean policy from,
and `evidence_ids_relied_on` integrity is a structural check, not a
subjective judgment call.

`rationale` is **never** compared and **never** controls payout -- it is
bounded to `MAX_RATIONALE_CHARS` and stored purely for human-readable
audit trail.

## What still happens deterministically after consensus

`gl.vm.run_nondet_unsafe` returning successfully means the leader and
enough validators independently derived the same decision fields from the
same frozen evidence -- but the contract still never trusts that blindly.
`validate_adjudication_result()` (a pure, unit-tested function with no
`gl.*` calls) re-checks the accepted result against contract storage
before it can touch `agreement.canonical_outcome`:

- `outcome` must be one of the four terminal outcomes, else forced to
  `UNRESOLVED`.
- `evidence_ids_relied_on` must be a non-empty list where every id is in
  `valid_evidence_ids` -- i.e. evidence actually frozen for *this specific
  agreement* (reuses the existing evidence-ID integrity check; this
  function is unchanged in its evidence-ID logic).
- A `CONFIRMED_TRUE`/`CONFIRMED_FALSE` outcome additionally requires
  `source_authority`, `temporal_validity`, `subject_match`,
  `category_match`, and `evidence_sufficiency` to all be true, or it is
  forced to `UNRESOLVED` -- an attacker who somehow gets a majority to
  agree on `outcome` alone without the supporting fields still cannot
  produce a winner.

## Hard constraints preserved

- **No re-fetching during adjudication.** `evaluate_evidence()` reads only
  `record.canonical_content`, which was written once, by
  `freeze_evidence()`, before adjudication ever runs. Neither `leader_fn`
  nor `validator_fn` calls `gl.nondet.web.render` or touches `url` again.
- **No source shopping.** `freeze_evidence()`'s `url_matches_policy()`
  check against the agreement's committed `source_host`/
  `source_path_prefix` is untouched by this change.
- **Stake never enters adjudication.** The prompt in `evaluate_evidence()`
  contains only `proposition`, `subject`, `event_category`, evidence id,
  and the frozen evidence text -- no stake/value field is ever
  interpolated into it, and the prompt explicitly instructs the model to
  ignore stake/odds/popularity.
- **Rationale never controls payout.** Enforced structurally: `settle()`
  branches only on `agreement.canonical_outcome`
  (`compute_winner(creator_position, canonical_outcome, ...)`); rationale
  is stored and returned for display only.
- **Timeout/refund path untouched.** `refund()` was not modified by this
  change; it was re-verified live after redeploying the updated contract
  (see build report).

## The event_status bug: proof this was tested against real heterogeneous validators, not designed in theory

The first live run of the custom leader/validator pattern (tx
`0x049e6833f3f703eca813b031fb40ac8b523a43802d456cc60b3f5b507060bc2e`,
freeze -> adjudicate against the 96th Academy Awards / Wikipedia
evidence) reached only 1 `agree` vote out of 5 -- consensus failed and
`adjudicate()` never committed. This was investigated, not papered over,
by fetching the full transaction receipt (`genlayer receipt <hash>`) and
comparing the leader's actual returned structured output against the
per-validator votes:

- The leader's `eq_outputs` showed `"event_status": "settled"`.
- `event_status` was, at that point, an unconstrained free-text `string`
  field in the prompt schema.
- Different validator LLM families (that run observed `prd-grok`,
  `prd-gpt-5-4`, `prd-gpt-oss`, `prd-mistral`, `prd-glm` across leader +
  4 validators) each independently phrase a "yes, this already
  happened" judgment differently -- `"settled"`, `"final"`,
  `"concluded"`, etc. -- so `validator_fn`'s exact `==` check on
  `event_status` failed even between validators that substantively
  agreed on every other field.

Fix: `event_status` was constrained to a 4-value enum (`SETTLED` /
`NOT_YET_OCCURRED` / `DISPUTED` / `UNKNOWN`) in the prompt, so
independent evaluations converge onto the same token. **This is not a
loosening of the equivalence criteria** -- the comparison in
`validator_fn` is still exact `==` on every decision field, with no
tolerance added. It tightens the *output schema* so exact-match is
actually achievable for a field that is inherently a closed judgment
call, not free prose.

Re-run immediately after with the same frozen contract otherwise
unchanged: `adjudicate()` reached 3/5 `agree` (quorum), committed
`CONFIRMED_TRUE`, and the full lifecycle (settle -> withdraw) completed
successfully. Real transaction hashes for both the failing and the
passing run are preserved in this session's git history
(`606f452` design, `4300d2e` this fix) and in
`docs/RELEASE_VERIFICATION.md` for the passing run.

The lesson generalizes: **any free-text field used in an exact-match
equivalence principle across a heterogeneous LLM validator pool must be
constrained to a closed enum (or otherwise normalized) before it can be
expected to converge.** Boolean and fixed-enum fields
(`outcome`, `temporal_validity`, `subject_match`, `category_match`,
`evidence_sufficiency`) did not need this fix -- only the one field that
was still open-ended text did.
