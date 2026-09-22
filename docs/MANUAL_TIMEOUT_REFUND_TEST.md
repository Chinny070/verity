# Manual timeout/refund test — accelerated, on a separate disposable agreement

This does **not** modify or weaken the deployed contract in any way --
`resolution_deadline` is just a timestamp *you* choose at
`create_agreement()` time, like any other constitution field. Choosing
a short one for a second, throwaway test agreement proves the exact
same safety-path code (`refund()`/`withdraw()`) that a real agreement
with a real multi-week deadline would use; it does not touch, redeploy,
or reconfigure the contract.

Uses the same two wallets (A and B) as `docs/MANUAL_SMOKE_TEST.md`.
Create a **new** agreement for this (do not reuse the one from the main
smoke test) -- this will be agreement id `2` (or whatever the next id
is) on the same deployed contract.

## Accelerated timing (safe, this is just picking early deadlines)

Real StudioNet write latency observed in this project's own testing is
roughly 8–15 seconds per transaction (see
`docs/RELEASE_VERIFICATION.md`) -- so `match_close_time` must leave more
than that much room after `create_agreement` actually executes, or the
create/match calls themselves will fail their own timing checks before
you ever get to test the timeout path. Recommended:

| Field | Value |
|---|---|
| `match_close_time` | now + 60 seconds |
| `expected_event_time` | now + 70 seconds |
| `resolution_not_before` | now + 80 seconds |
| `resolution_deadline` | now + 100 seconds |

Any real proposition/subject/source works here -- the content doesn't
matter for this test since evidence is deliberately never frozen.
Reuse the same stake (`10000000000000000` wei) for consistency.

## Steps

### 1. CREATE — **[WALLET A SIGNS]**

Same as the main smoke test's step 1, with the accelerated timing above.
Verify `status: CREATED` as before.

### 2. MATCH — **[WALLET B SIGNS]**

Same as the main smoke test's step 2. Verify `status: MATCHED`.

### 3. Do nothing until the deadline passes

Deliberately skip freezing evidence. Wait until real time exceeds
`resolution_deadline` (about 100 seconds after you created the
agreement, plus whatever the create/match transactions themselves took).

### 4. REFUND — **[EITHER WALLET, OR A THIRD UNRELATED WALLET, SIGNS — permissionless]**

This is the point of the test: `refund()` has **no** sender
restriction. Prove it by calling it from whichever wallet is easiest --
it does not have to be Wallet A or Wallet B.

- Click "Refund" on the agreement.
- **Re-read and verify:**
  - [ ] `status` is now `REFUNDED`

### 5. WITHDRAW — **[WALLET A SIGNS, then separately WALLET B SIGNS]**

Both principals withdraw their own stake back, independently:

1. As **Wallet A**, click "Withdraw". Re-read and verify:
   - [ ] `creator_withdrawn` is now `true`
   - [ ] Wallet A's balance increased by approximately the stake amount
         (not 2×, since this is a refund, not a settlement -- each side
         only gets their own stake back)
2. **Attempt to withdraw again as Wallet A** and confirm it is rejected
   (duplicate-withdrawal protection on the refund path).
3. Switch to **Wallet B**, click "Withdraw". Re-read and verify:
   - [ ] `counterparty_withdrawn` is now `true`
   - [ ] Wallet B's balance increased by approximately the stake amount
4. **Attempt to withdraw again as Wallet B** and confirm it is rejected.

## What this proves

- `refund()` is genuinely permissionless -- not just documented as such.
- No funds are locked: both sides can always recover their own stake if
  resolution never completes in time.
- Duplicate-withdrawal protection holds on the refund path exactly as
  it does on the settlement path (same flags, same guard logic).
- You did not need to wait through a real production-length deadline to
  prove any of this, and the production contract was not weakened or
  specially configured to make this possible -- it's the same code path
  a real agreement's deadline would eventually hit.

## Optional: also prove the "adjudicated but UNRESOLVED" refund branch

If you want to additionally exercise the other refund-eligibility branch
(`status == ADJUDICATED` with `canonical_outcome` in
`UNRESOLVED`/`INVALID_EVENT`), create a third agreement with a
proposition that genuinely can't be confirmed from your chosen source
(e.g. a source page that doesn't actually mention the subject) and run
it through CREATE → MATCH → FREEZE EVIDENCE → ADJUDICATE as in the main
smoke test. If adjudication correctly returns `UNRESOLVED`, `refund()`
becomes immediately eligible without waiting for the deadline at all --
confirm this by calling it right after adjudicate() and checking
`status` transitions straight to `REFUNDED`.

Record whichever of these you actually ran in
`docs/FINAL_DEPLOYMENT_RECORD.md`.
