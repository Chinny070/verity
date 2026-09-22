# VERITY release verification (StudioNet)

This records what was ACTUALLY observed running VERITY live against
GenLayer StudioNet. Nothing in this document is simulated, mocked, or
projected -- every transaction hash below is a real transaction that
finalized on StudioNet during this build/verification session.

## Frozen contract identity

| Field | Value |
|---|---|
| File | `contracts/verity.py` |
| SHA-256 | `0d02adac2b5ea52a637c6b09dfdc65fd0388b8144da5e3ac97e6bf7b70ff6f6e` |
| Git commit | `4300d2e3991240d3b91ef35abc17b4722fbfb868` |
| Depends / runner tag | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |
| Network | GenLayer StudioNet, chainId `61999` |
| RPC | `https://studio.genlayer.com/api` |
| genlayer CLI | `0.39.2` |
| genlayer-py | `0.16.3` |
| genlayer-test (gltest) | `0.29.2` |
| Python | `3.12.10` |

Compute the SHA-256 yourself to confirm this document still matches the
checked-out source:

```
sha256sum contracts/verity.py
```

## Reference hosted deployment (full lifecycle proof)

This is the single StudioNet deployment that a complete
CREATE -> MATCH -> FREEZE EVIDENCE -> ADJUDICATE -> SETTLE -> WITHDRAW
run was executed against, end to end, with the frozen contract above.
Produced by `python -m pytest scripts/hosted_demo.py -v -s`.

| Field | Value |
|---|---|
| Contract address | `0xd0E0ccd9Fd5BB364A439332EFdf397FA74004655` |
| Creator account | `0x3455680393Ba0C322129fC48e40e4c4fBB18a6d0` |
| Counterparty account | `0x1D9eEf4C6CEB68e8ef083Ca1F82Bea3809C24768` |
| Agreement id | `1` |

StudioNet explorer: <https://genlayer-explorer.vercel.app> (search any
hash below).

### Test proposition (real historical event, not synthetic)

- **Proposition:** "Oppenheimer wins Best Picture at the 96th Academy Awards"
- **Outcome type:** `AWARD_WINNER`
- **Subject:** "Oppenheimer"
- **Event category:** "Academy Awards Best Picture 2024"
- **Creator position:** `YES`
- **Committed source:** host `en.wikipedia.org`, path prefix `/wiki/96th_Academy_Awards`
- **Stake:** `1000000000000000000` wei (1 native GEN) per side

### Transaction-by-transaction record

| Step | Method | Tx hash |
|---|---|---|
| 1. Create | `create_agreement` | `0x274f64fb9fd8f5ffedbbcc3c19927232d562e76c838f315ed2ef50f59e366620` |
| 2. Match | `match_agreement` | `0x9b99d7ee6b3cf5e3351daca2dfc26fbd9cd01918095bbe22a219875986b6f1db` |
| 3. Freeze evidence | `freeze_evidence` | `0x1622dfc3e2fb3fc1bd3a5fc7d2110ed2f7be83fb351ad790ad4d3b3f025c5adb` |
| 4. Adjudicate | `adjudicate` | `0x7b7160f8308c8fc5946f3c7c0d96640612d37ae18f724752332e3a71d7b2b0a8` |
| 5. Settle | `settle` | `0xdd558e63d9ed4f63e411f5f0f64d8946d2bdc32685772afd05f3436cbeedce11` |
| 6. Withdraw (winner) | `withdraw` | `0xb9ffed5115124ede0703a6f2e5176cf388346f43e00ba3fa80e4b2c1a95b6b2c` |

### Real web evidence retrieved

- **Evidence URL fetched:** `https://en.wikipedia.org/wiki/96th_Academy_Awards`
- **Fetched by:** `gl.nondet.web.render(url, mode="text")` inside a real
  GenVM non-deterministic block, run independently by the leader and by
  matching validators -- never by the frontend or by this session's
  tooling.
- **Evidence id:** `1-1`
- **Retrieved at (unix):** `1790083107`
- **Canonicalized content (excerpt actually returned by GenVM):**
  `"Jump to content\nMain menu\nSearch\nDonate\nCreate account\nLog in\n...\n96th Academy Awards\n...\nDate March 10, 2024\n..."`

### Adjudication consensus (real multi-validator vote)

Leader ran `evaluate_evidence()` once; validators independently re-ran
the same evaluation against the same frozen evidence and compared their
own result to the leader's on the decision-bearing fields
(`outcome`, `event_status`, `temporal_validity`, `subject_match`,
`category_match`, `evidence_sufficiency`). Actual votes on this tx:

| Validator address | Vote |
|---|---|
| `0x4EDbE1FC9EAeC7b0EBA849b0C76AE73Eb0ad5C47` | agree |
| `0xE6BD8050758CB15fC88387223E31Ae2708B119dC` | agree |
| `0xec2Fb79cd12255Eb34886CEd7332f27B98DEe658` | agree |
| `0xDB1c35c1f05d885999b8f13e5735307BcC16Be88` | idle |
| `0xacc2459F341D7a887bcA8FAA62F1EC9378d4Bc67` | idle |

3 of 5 agreed -- quorum reached, consensus committed.

### Persisted resolution (authoritative state reread after the write)

- **canonical_outcome:** `CONFIRMED_TRUE`
- **rationale:** "Wikipedia article for 96th Academy Awards explicitly
  states 'Oppenheimer won seven awards, including Best Picture' and
  lists it as the winner in the Best Picture category."
- **status after adjudicate:** `ADJUDICATED`
- **status after settle:** `SETTLED`
- **winner:** `0x3455680393Ba0C322129fC48e40e4c4fBB18a6d0` (the creator,
  who held `YES` -- correct: `YES` + `CONFIRMED_TRUE` -> creator wins,
  per `compute_winner()`)
- **Withdrawal:** winner's `withdraw()` call succeeded (tx above).

## Separately-verified: timeout/refund and no-locked-funds path

Run live against a fresh StudioNet deployment of the same frozen
contract, via `tests/integration/test_verity_lifecycle.py::
test_no_evidence_timeout_refund_and_withdrawal` (no evidence ever
frozen; after `resolution_deadline` passes, a third-party stranger
account triggers `refund()` permissionlessly, then both principals
independently withdraw exactly once, with duplicate-withdrawal
rejected). Passing live run confirmed as part of the final regression
pass recorded below.

## Final regression pass (this frozen commit)

Run against StudioNet, same commit/SHA-256 as above.

- **Unit tests (`tests/direct`):** 30/30 passed
- **Integration tests (`tests/integration/test_verity_lifecycle.py`, live StudioNet):** 8/8 passed
  (one interim run in this session hit a transient StudioNet 502/connection
  error on `test_unmatched_cancel_and_refund_withdraw`'s create call --
  immediately re-run in isolation and passed cleanly; this class of
  flakiness is StudioNet-side HTTP infrastructure, not contract logic,
  and is documented, not hidden)

| Check | Result |
|---|---|
| Source commitment (constitution validated at CREATE) | PASS (`test_valid_constitution_passes` + live create) |
| Source-shopping protection | PASS (`test_source_shopping_rejected_at_freeze`, live) |
| Real web evidence path | PASS (live `gl.nondet.web.render` fetch of Wikipedia, above) |
| Evidence-ID integrity | PASS (unit tests + live: evidence id `1-1` bound to agreement `1`) |
| Custom leader/validator equivalence (adjudication) | PASS (live 3/5 quorum, above) |
| Creator-position -> settlement mapping | PASS (live: `YES` + `CONFIRMED_TRUE` -> creator won) |
| Timeout/refund | PASS (live) |
| Withdrawal (incl. duplicate-withdrawal rejection) | PASS (live) |
| No-locked-funds | PASS (live: both principals independently withdrew after refund) |

## How to reproduce

```
python -m pytest tests/direct -q                          # unit, no network
python -m pytest tests/integration/test_verity_lifecycle.py -v   # live StudioNet
python -m pytest scripts/hosted_demo.py -v -s              # full hosted lifecycle demo
```

`gltest.config.yaml` pins `studionet` as the default network -- no local
`genlayer up` / Docker node is required for any of the above.
