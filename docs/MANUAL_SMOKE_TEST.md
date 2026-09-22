# Manual smoke test — full lifecycle, your own two wallets

Walks through CREATE → MATCH → FREEZE EVIDENCE → ADJUDICATE → SETTLE →
WITHDRAW against **your own** freshly deployed contract (see
`docs/MANUAL_DEPLOYMENT.md` first), using two accounts you control.
Nothing here needs your private key, seed phrase, or mnemonic -- only
the public address of each account, and your own signing approval at
each step (either in a browser wallet, or by running an unlocked local
CLI account you control).

A separate, shorter document (`docs/MANUAL_TIMEOUT_REFUND_TEST.md`)
covers the timeout/refund safety path on a second, disposable agreement
with a short deadline -- you do not need to sit through this main
happy-path test's real deadlines to prove that path.

## Prerequisites

- A real, verified contract address from `docs/MANUAL_DEPLOYMENT.md`
  step 13 (schema + source both matched the frozen release candidate).
- `frontend/src/config.js` → `CONTRACT_ADDRESS` updated to that address.
- `cd frontend && npm install && npm run dev` running, opened in a
  browser.
- A browser wallet extension (e.g. MetaMask) with the StudioNet network
  added: chainId `61999`, RPC `https://studio.genlayer.com/api`. Add it
  once; you'll switch which *account* is selected in that same wallet
  extension between Wallet A and Wallet B, not switch networks.

## Two wallets: Wallet A (creator) and Wallet B (counterparty)

- **Wallet A** creates the agreement and picks a position (YES/NO).
- **Wallet B** is the counterparty who matches it with equal stake.
- Both must be under **your own** control, both need a small amount of
  StudioNet GEN. You can create two accounts in the same browser wallet
  extension (e.g. two MetaMask accounts) and switch between them in the
  extension's UI when this document tells you to.
- **Minimum recommended test stake: `10000000000000000` wei (0.01
  GEN)** per side -- small enough to be inconsequential on a test
  network, large enough to be nonzero (the contract rejects a
  zero/negative stake at `create_agreement`).

I will never ask you for either wallet's private key or seed phrase at
any point in this walkthrough. Every step below that requires your
signature is explicitly marked **[WALLET A SIGNS]** or **[WALLET B
SIGNS]**.

## Test proposition

Reuse the same clean pattern as the already-proven reference example
(a settled, unambiguous awards-show result), so there's no ambiguity in
what "correct" looks like:

| Field | Suggested value |
|---|---|
| Outcome type | `AWARD_WINNER` |
| Proposition | `Everything Everywhere All at Once wins Best Picture at the 95th Academy Awards` |
| Subject | `Everything Everywhere All at Once` |
| Event category | `Academy Awards Best Picture 2023` |
| Creator position | `YES` |
| Source host | `en.wikipedia.org` |
| Source path prefix | `/wiki/95th_Academy_Awards` |
| Evidence URL (used at freeze step) | `https://en.wikipedia.org/wiki/95th_Academy_Awards` |

This is a real, already-decided historical result (95th Academy Awards,
March 2023) different from the reference deployment's 96th Academy
Awards example, so your smoke test produces its own independent proof.

### Timing fields

Real StudioNet write latency (consensus + finalization) has been
observed at roughly 8–15 seconds per transaction in this project's own
testing -- see `docs/RELEASE_VERIFICATION.md` and the timing-bug note in
this session's git history. Use generous margins, not tight ones:

- `match_close_time`: now + 5 minutes
- `expected_event_time`: now + 6 minutes
- `resolution_not_before`: now + 7 minutes
- `resolution_deadline`: now + 60 minutes

(The frontend's create form takes local datetime pickers and converts
them to unix seconds for you.)

---

## Step 1 — CREATE — **[WALLET A SIGNS]**

1. In the browser, connect **Wallet A** ("Connect Wallet" in the
   VERITY header).
2. Fill in the "Create a Proposition" form with the values above.
3. Stake: `10000000000000000` (0.01 GEN).
4. Submit. **Before approving in your wallet, verify:**
   - The recipient/contract address shown in the wallet popup matches
     your deployed VERITY contract address.
   - The value being sent matches your intended stake.
5. **What success actually looks like:** the app shows a notice banner
   ("... confirmed on StudioNet and verified against re-read contract
   state") -- this only appears after the frontend has re-read the
   contract via `get_agreement` and confirmed the write's leader
   execution reported `SUCCESS` (see `frontend/src/genlayerClient.js`
   `txExecutionSucceeded`). A returned transaction hash alone is never
   treated as success by this frontend or by you.
6. **Re-read and verify authoritative state** (the new agreement card,
   or `genlayer call <contract> get_agreement --args '[1]'`):
   - [ ] `status` is `CREATED`
   - [ ] `proposition`, `subject`, `event_category` match what you entered
   - [ ] `creator_position` is `YES` (or whatever you chose)
   - [ ] `creator` is **Wallet A's** address
   - [ ] `stake` is `10000000000000000`
   - [ ] `source_host` / `source_path_prefix` match the committed source
   - [ ] `match_close_time` / `expected_event_time` /
         `resolution_not_before` / `resolution_deadline` are in the
         correct order and match what you entered
   - [ ] `counterparty` is the zero address (nobody has matched yet)
   - [ ] `evidence_id` is empty
7. Note the agreement id shown (almost certainly `1` on a freshly
   deployed contract).

## Step 2 — MATCH — **[WALLET B SIGNS]**

1. Switch your browser wallet extension to **Wallet B**.
2. On the same agreement card, click "Match" (stake is pre-filled to
   match the creator's stake -- the contract will reject anything
   else: `match_agreement` requires `msg.value == agreement.stake`
   exactly).
3. **Before approving in your wallet, verify:** the stake amount shown
   equals Wallet A's stake, and the contract address is correct.
4. **Re-read and verify:**
   - [ ] `status` is now `MATCHED`
   - [ ] `counterparty` is **Wallet B's** address
   - [ ] `stake` unchanged (both sides now have equal stake locked --
         2× stake total held by the contract)

## Step 3 — FREEZE EVIDENCE — **[EITHER WALLET SIGNS — not payable]**

Wait until `resolution_not_before` has passed (per your timing choices
above). `freeze_evidence` is not payable, so either wallet may call it
(there is no restriction to creator/counterparty in the contract).

1. Click "Freeze Evidence" and enter the evidence URL:
   `https://en.wikipedia.org/wiki/95th_Academy_Awards`
   (must match the committed `source_host`/`source_path_prefix` exactly
   or the contract rejects it -- this is the source-shopping defense
   working as intended).
2. This transaction takes longer than the others: GenVM is actually
   fetching the live page (`gl.nondet.web.render`) inside a real
   non-deterministic block, independently, on the leader and matching
   validators.
3. **Re-read and verify:**
   - [ ] `status` is now `EVIDENCE_FROZEN`
   - [ ] `evidence_id` is non-empty (e.g. `"1-1"`)
   - [ ] Call `get_evidence` with that id and confirm: `frozen: true`,
         `agreement_id` matches, `url` matches what you submitted, and
         `canonical_content` contains real text from the Wikipedia page
         (not empty, not an error message) -- this is your proof the
         retrieval actually happened against the real web, not a mock.

## Step 4 — ADJUDICATE — **[EITHER WALLET SIGNS — not payable]**

1. Click "Adjudicate".
2. This is the slowest step: each validator independently re-evaluates
   the frozen evidence against the frozen constitution and must agree
   with the leader field-by-field (see `docs/ADJUDICATION.md`). Expect
   it to take longer than the other writes.
3. **Check the consensus result, not just that a hash came back.** If
   the app's notice banner appears, the frontend has already confirmed
   `execution_result === "SUCCESS"` for you. For independent
   verification, pull the raw receipt:
   ```
   genlayer receipt <adjudicate tx hash>
   ```
   and look at `consensus_data.votes` -- you should see a majority
   `agree`. If you see `execution_result: 'ERROR'` in the leader
   receipt despite a tx hash existing, or a majority `disagree`, the
   agreement's `status` will still show `EVIDENCE_FROZEN` (unchanged)
   -- adjudicate() only commits on real consensus. You can retry it.
4. **Re-read and verify:**
   - [ ] `status` is now `ADJUDICATED`
   - [ ] `canonical_outcome` is `CONFIRMED_TRUE` (since the real answer
         is that Everything Everywhere All at Once did win) --
         `CONFIRMED_FALSE`/`UNRESOLVED`/`INVALID_EVENT` would indicate
         something went wrong with your proposition/source setup, not
         a contract bug per se; re-check your inputs before assuming a
         bug.
   - [ ] `rationale` is a non-empty, sensible explanation referencing
         the evidence

## Step 5 — SETTLE — **[EITHER WALLET SIGNS — permissionless, not payable]**

1. Click "Settle".
2. **Re-read and verify:**
   - [ ] `status` is now `SETTLED`
   - [ ] `winner` follows the deterministic table: creator held `YES`
         and outcome is `CONFIRMED_TRUE` → **winner should be Wallet
         A's address** (the creator). If you chose `NO` as the creator
         position, the winner should instead be Wallet B (counterparty).
         Cross-check this against `docs/README.md`'s payout table --
         do not just trust whatever address appears; confirm it's the
         *correct* one per the table given your `creator_position` and
         `canonical_outcome`.

## Step 6 — WITHDRAW — **[ONLY THE WINNER'S WALLET SIGNS]**

1. Switch your browser wallet to whichever wallet is the `winner` from
   step 5.
2. Click "Withdraw".
3. **Before approving, verify:** you are connected as the winner
   address, not the loser.
4. **Re-read and verify:**
   - [ ] The winner's `*_withdrawn` flag (`creator_withdrawn` or
         `counterparty_withdrawn`, whichever applies) is now `true`
   - [ ] The winner's on-chain GEN balance increased by approximately
         2× the stake (both sides' stake, minus whatever the network's
         own fee mechanism deducted) -- check via
         `genlayer account show --account <winner's account name>` or
         your wallet's own balance display, before vs. after
   - [ ] **Attempt to withdraw again from the same wallet** and confirm
         it is rejected (duplicate-withdrawal protection) -- this
         should show a friendly "These funds have already been
         withdrawn" message, not a raw error, and the agreement state
         must not change.
5. **Attempt to withdraw from the losing wallet** and confirm it is
   rejected ("You're not eligible to perform this action on this
   agreement" / "only the winner may withdraw").

---

## Full checkpoint summary

| Step | State verified | Real evidence of |
|---|---|---|
| CREATE | proposition, creator position, stake, constitution, source commitment, deadlines all correct | Resolution Constitution committed before anyone knows the outcome |
| MATCH | counterparty stored, equal stake locked | Two-party agreement formed |
| FREEZE EVIDENCE | real web retrieval happened, evidence persisted with a real evidence id, source policy enforced | GenVM actually fetched the live page; source-shopping defense works |
| ADJUDICATE | validators reached consensus (checked via receipt, not assumed), resolution is authoritative contract state | Custom leader/validator equivalence principle actually converges on real, independent LLM evaluations |
| SETTLE | winner follows `creator_position` + `canonical_outcome` exactly | Deterministic settlement, no inversion |
| WITHDRAW | only entitled wallet can withdraw, balance changes correctly, no duplicate withdrawal | No-locked-funds guarantee + duplicate-protection both hold |

When you're done, transfer the real values you observed (addresses, tx
hashes, evidence id, consensus result, final balances) into
`docs/FINAL_DEPLOYMENT_RECORD.md`.
