# Manual StudioNet deployment (you control the wallet)

Two genuinely different ways to deploy the frozen VERITY contract to
GenLayer StudioNet **yourself**, with your own wallet/account. Neither
ever asks for or needs your private key, seed phrase, or mnemonic:

- **Option A -- CLI keystore.** The `genlayer` CLI manages your keys in
  its own local encrypted keystore; you approve by running the command
  with an unlocked local account active.
- **Option B -- connected browser wallet (MetaMask etc.).** You sign the
  actual deployment transaction with a real browser-extension wallet
  popup, either through the official GenLayer Studio web IDE or through
  a tiny `genlayer-js` script that connects to your wallet the same way
  this project's own frontend does for every other write action.

Pick whichever matches how you actually want to control the deployer
key. Both target the same real network (StudioNet, chainId `61999`) and
both must be verified against the same frozen source afterward (§13).

Verified against the actual installed CLI's own `--help` output
(`genlayer --version` → `0.39.2`) and the actual installed frontend
SDK's TypeScript type definitions (`genlayer-js` `1.2.0`) at the time of
writing -- not remembered/older syntax. If your installed versions
differ, prefer `genlayer <command> --help` and the SDK's own types over
this document.

Frozen release candidate this deployment must match:

| Field | Value |
|---|---|
| File | `contracts/verity.py` |
| SHA-256 | `0d02adac2b5ea52a637c6b09dfdc65fd0388b8144da5e3ac97e6bf7b70ff6f6e` |
| Git commit | `b7300eba9ea4b29c2ab44dd3bf4a744a741c34f9` (contract content unchanged since `4300d2e`) |
| Depends / runner tag | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |

---

# Option A — CLI keystore

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

---

# Option B — Connected browser wallet

Two ways to do this, both confirmed to use the real GenLayer Studio
Network (chainId `61999` -- the exact same network as Option A, not a
separate "testnet"):

## B1. Through the GenLayer Studio web IDE (studio.genlayer.com)

This is GenLayer's own official hosted IDE. Its "Studio" environment
label and StudioNet are the same network -- when you connect a wallet
here, MetaMask will prompt to add/switch to a network named "GenLayer
Studio Network," chainId `61999`, matching `genlayer network info`'s
output from Option A exactly.

1. Open <https://studio.genlayer.com> in your browser.
2. **[YOU VERIFY]** Confirm you are working against the real hosted
   network, not any local/offline simulator mode the IDE may also
   offer -- if the IDE shows a network selector or mode toggle, it
   should say "Studionet"/"StudioNet," not "Local"/"Simulator." (This
   project separately investigated a "Could not load contract schema"
   error that turned out to come from a local/sandbox account inside
   this same IDE, unrelated to real StudioNet -- if you see a similar
   error, it likely means you're in that local mode, not connected to
   real StudioNet.)
3. **[YOU AUTHORIZE]** Click the wallet-connect button (typically in the
   navbar). Approve the MetaMask connection request, and approve adding
   the GenLayer Studio Network if prompted. **Verify the account address
   MetaMask shows is the one you intend to deploy from.**
4. Paste the contents of `contracts/verity.py` into the contract editor
   -- copy it exactly; do not retype it (a single-character difference
   changes the SHA-256 and breaks the freeze verification in step 13).
5. Find the "Run and Deploy" (or equivalently labeled) section and its
   "Deploy" control. The constructor takes no arguments
   (`Contract.__init__(self)`), so no constructor-argument fields should
   need filling in.
6. **[YOU VERIFY before approving]** Before clicking deploy, re-confirm
   the connected wallet address and network shown in the IDE.
7. **[YOU AUTHORIZE]** Click Deploy. MetaMask will show a transaction
   signature popup -- review it (destination should be the null/zero
   address or StudioNet's consensus/factory contract, consistent with
   any other Intelligent Contract deployment, not a personal address)
   and approve it yourself.
8. The IDE should then show deployment progress and, on success, the new
   contract's address and the transaction hash/id -- copy both. If the
   IDE's own UI doesn't clearly separate "transaction accepted" from
   "constructor actually succeeded," don't trust its own success
   indicator alone -- go straight to the shared verification steps
   below (§13/§14) using the CLI, which gives you the real
   `execution_result` from the receipt.

The exact button/section labels above are GenLayer's own product
copy and were not independently re-confirmed pixel-for-pixel in
current official docs at the time of writing (the public docs describe
the existence of a contract editor, "Run and Deploy" section, a wallet
button, and MetaMask prompting for the GenLayer Studio Network at
chainId `61999`, but do not enumerate exact current label text) --
if what you see on screen differs, trust the on-screen UI over this
document, and use the address/tx hash it gives you with the shared
verification steps below regardless of exact label wording.

## B2. Through a genlayer-js script driven by your connected wallet

For deterministic, scriptable control (the same underlying mechanism
this project's own frontend uses for every other write action, just
targeting `deployContract` instead of `writeContract`). This runs
entirely in your own browser -- no data leaves your machine except the
signed transaction you approve.

`frontend/src/genlayerClient.js` already exports a ready-to-use
`deployContract(code, args)` helper built exactly for this, using the
same `connectWallet()` your browser wallet already goes through for
every smoke-test action. To use it:

1. `cd frontend && npm run dev`, open the app in your browser.
2. Open your browser's developer console on that page (the running app
   already has `genlayer-js` loaded and a connected-wallet path wired
   up; you're reusing its module graph rather than writing a new one).
3. **[YOU AUTHORIZE]** Click "Connect Wallet" in the VERITY UI itself
   first (this calls `connectWallet()`, prompting MetaMask the normal
   way) -- **verify the address it shows is the one you intend to
   deploy from.**
4. In the console, fetch the frozen contract source as text and deploy
   it:
   ```js
   const mod = await import("/src/genlayerClient.js");
   const src = await fetch("/../contracts/verity.py").then(r => r.text());
   // Sanity check before deploying -- should match the frozen SHA-256:
   const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(src));
   console.log([...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join(""));
   // Compare the printed hash to 0d02adac2b5ea52a637c6b09dfdc65fd0388b8144da5e3ac97e6bf7b70ff6f6e
   // before continuing.
   const { txId, contractAddress, receipt } = await mod.deployContract(src, []);
   console.log({ txId, contractAddress, executionSucceeded: mod.txExecutionSucceeded(receipt) });
   ```
   (If your dev server doesn't serve `contracts/` at that relative path,
   just paste the file's contents as a JS template string instead of
   fetching it -- the important part is that `src` is character-for-
   character the frozen file.)
5. **[YOU AUTHORIZE]** MetaMask will show a signature popup for the
   deployment transaction -- review the connected account and approve
   it yourself.
6. `contractAddress` and `txId` in the console output are your new
   contract address and deployment transaction hash.
   `executionSucceeded` reflects the same `execution_result ===
   "SUCCESS"` check every other write action in this project uses --
   **do not trust a returned `txId` alone; check this field, or
   independently confirm via `genlayer receipt <txId>`.**

This path was verified against `genlayer-js` `1.2.0`'s actual shipped
TypeScript type definitions (`deployContract(args: {account?, code,
args?, kwargs?, leaderOnly?, consensusMaxRotations?}) => Promise<tx
hash>`), the same client type already used by this project's
`writeContract()`. It was not live-executed against a real wallet in
this session (no real wallet is available to this tooling, and
deploying was explicitly out of scope for this documentation pass) --
treat the console output and the shared verification steps below as
the actual proof, not this document's description of what should
happen.

---

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
