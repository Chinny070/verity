# Manual StudioNet deployment (you control the wallet)

This walks you through deploying the frozen VERITY contract to GenLayer
StudioNet **yourself**, using your own wallet/account, entirely through
the official `genlayer` CLI. Nothing here asks for or needs your private
key, seed phrase, or mnemonic at any point -- the CLI manages your keys
in its own local encrypted keystore, and you approve every signing
action yourself, locally.

Verified against the actual installed CLI's own `--help` output and
current official StudioNet configuration on this machine at the time of
writing (`genlayer --version` → `0.39.2`). If your installed version
differs, run `genlayer <command> --help` yourself and prefer what it
says over this document.

Frozen release candidate this deployment must match:

| Field | Value |
|---|---|
| File | `contracts/verity.py` |
| SHA-256 | `0d02adac2b5ea52a637c6b09dfdc65fd0388b8144da5e3ac97e6bf7b70ff6f6e` |
| Git commit | `b7300eba9ea4b29c2ab44dd3bf4a744a741c34f9` (contract content unchanged since `4300d2e`) |
| Depends / runner tag | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |

---

## 1. Open the right directory

```
cd C:\Users\USERpc\verity
```

All commands below assume this as your working directory (so
`contracts/verity.py` resolves correctly).

## 2. Confirm you're targeting StudioNet

```
genlayer network info
```

Expected output includes:

```
{
  alias: 'studionet',
  name: 'Genlayer Studio Network',
  chainId: '61999',
  rpc: 'https://studio.genlayer.com/api',
  ...
}
```

If `alias` is not `studionet`, switch to it explicitly:

```
genlayer network set studionet
```

(`genlayer network list` shows all configured networks and marks the
active one with `*`.)

## 3. How your account/wallet is selected

The `genlayer` CLI does not take a `--account` flag on `deploy` --
it always uses whichever account is currently **active** in its local
keystore. List your accounts and see which one is active:

```
genlayer account list
```

The active account is marked `(active)`. If you don't have an account
yet, create one (this generates a new local encrypted keystore -- the
CLI will prompt you for a password to protect it; **you never see or
type a raw private key**):

```
genlayer account create --name my-deployer
```

To switch which account is active:

```
genlayer account use my-deployer
```

If the account's key is locked (keystores lock by default between CLI
sessions on some setups), unlock it so it can sign:

```
genlayer account unlock --account my-deployer
```

This caches the decrypted key in your OS keychain for this session
only -- it is not printed to the terminal, not written to any file
you can accidentally paste, and you can reverse it any time with
`genlayer account lock --account my-deployer`.

## 4. Check the wallet address BEFORE deployment — [YOU VERIFY THIS]

```
genlayer account show --account my-deployer
```

Expected output:

```
{
  name: 'my-deployer',
  address: '0x....',
  balance: '<amount> GEN',
  network: 'Genlayer Studio Network',
  status: 'unlocked',
  active: true
}
```

**Read the `address` field and confirm it is the wallet you actually
intend to deploy from.** This is the public address that will own the
deployment transaction (it does not own the contract itself -- VERITY
has no admin/owner role at all, see `docs/SECURITY_AUDIT.md`).

## 5. Check its GEN balance — [YOU VERIFY THIS]

The same `account show` output above includes `balance`. StudioNet is
gasless for normal use (transaction fees are typically covered by
Studio's fee manager, not drawn from your balance the way L1 gas would
be), but confirm the account shows a nonzero/reasonable balance before
proceeding so you know it's a real, usable account. If you need funds,
StudioNet accounts are typically auto-funded or can be requested via
the GenLayer Studio UI/faucet -- this document does not perform that
step for you.

## 6. The exact deployment command

```
genlayer deploy --contract contracts/verity.py --args '[]'
```

`--args '[]'` is correct and required: `Contract.__init__(self)` takes
no arguments (it only initializes `next_agreement_id`/`next_evidence_id`
internally).

You do not need `--rpc` (network is already set to studionet from step
2) or `--fees`/`--fee-value` (omitting lets genlayer-js derive the fee
deposit automatically, which is the normal path for StudioNet).

## 7. What wallet approval/signature to expect — [YOU AUTHORIZE THIS]

The CLI will build and locally sign the deployment transaction using
your active account's key (decrypted only in memory / OS keychain, per
step 3) and submit it to StudioNet. There is no separate browser
wallet popup for the CLI path -- **the CLI itself is your wallet
here**, and running the command with your account active and unlocked
*is* the authorization step. If you want an explicit human-in-the-loop
pause before this, do not run the command until you have personally
re-read step 9 below and are ready.

## 8. What to verify before approving — [YOU VERIFY THIS]

Before you run the command in step 6, confirm:

- [ ] `genlayer network info` still shows `studionet` / chainId `61999`
- [ ] `genlayer account show` shows the address you intend to deploy from
- [ ] You are in `C:\Users\USERpc\verity` and `contracts/verity.py`'s
      SHA-256 matches the frozen value above:
      ```
      sha256sum contracts/verity.py
      ```

## 9. How to recognize successful deployment

On success, the CLI prints a result block ending with something like:

```
Result:
{
  'Transaction Hash': '0x...',
  'Contract Address': '0x...'
}

✔ Contract deployed successfully.
```

**Do not treat "Contract deployed successfully" alone as final** --
that message reflects that a transaction was accepted, not that the
constructor actually executed without error inside GenVM. Confirm with
the schema check in step 14 before trusting the address.

## 10. Where to get the new contract address

From the `Result` block in step 9: the `Contract Address` field. Save
it -- you'll need it for `docs/FINAL_DEPLOYMENT_RECORD.md` and for the
frontend config (see below).

## 11. Where to get the deployment transaction hash

Same `Result` block: the `Transaction Hash` field.

## 12. Verify it on the StudioNet explorer

```
https://genlayer-explorer.vercel.app/?search=<Transaction Hash or Contract Address>
```

Confirm the transaction shows as finalized/accepted and the contract
address matches what the CLI printed.

You can also pull the full receipt directly from the CLI for more
detail (consensus votes, execution result per validator):

```
genlayer receipt <Transaction Hash>
```

Look for `status_name: 'ACCEPTED'` (or `FINALIZED`) and, under
`consensus_data.leader_receipt`, `execution_result: 'SUCCESS'`. If you
see `execution_result: 'ERROR'` anywhere in the leader receipt, the
deployment did **not** actually succeed even if a contract address was
printed -- do not proceed to the smoke test; stop and investigate (see
`docs/RELEASE_VERIFICATION.md` for what a real prior failure of this
exact kind looked like, and `docs/ADJUDICATION.md`/`SECURITY_AUDIT.md`
for context).

## 13. Verify the deployed contract matches the frozen release candidate

Two independent checks, both against the **new** contract address from
step 10:

**a) Schema check** (confirms the deployed bytecode's method surface
matches what the frozen source produces):

```
genlayer schema <new contract address>
```

Compare the method list/signatures against what the frozen source
produces locally:

```
python - <<'PY'
import json, urllib.request
code = open("contracts/verity.py","rb").read()
hexcode = "0x" + code.hex()
payload = {"jsonrpc":"2.0","method":"gen_getContractSchemaForCode","params":[hexcode],"id":1}
req = urllib.request.Request("https://studio.genlayer.com/api", data=json.dumps(payload).encode(), headers={"Content-Type":"application/json","User-Agent":"Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=60) as r:
    print(r.read().decode())
PY
```

The two should show the exact same method names, parameter lists, and
return types (`adjudicate`, `cancel_unmatched`, `create_agreement`,
`freeze_evidence`, `get_agreement`, `get_agreement_count`,
`get_evidence`, `match_agreement`, `refund`, `settle`, `withdraw`).

**b) Source check** (confirms the deployed contract's actual source
matches the frozen file byte-for-byte):

```
genlayer code <new contract address>
```

Compare against `contracts/verity.py` directly, or compute a SHA-256 of
the returned source and compare it to
`0d02adac2b5ea52a637c6b09dfdc65fd0388b8144da5e3ac97e6bf7b70ff6f6e`.

Only once both checks match should you record the deployment as
verified in `docs/FINAL_DEPLOYMENT_RECORD.md`.

---

## Updating the frontend to point at your new deployment

**Do not do this until you have a real, verified contract address from
the steps above.** When you do:

- File: `frontend/src/config.js`
- Field: `export const CONTRACT_ADDRESS = "..."`

This is a plain public contract address -- no private key or wallet
info is ever stored in this file. Update it, then `cd frontend && npm
run build` (or `npm run dev` to preview) to pick up the change.
