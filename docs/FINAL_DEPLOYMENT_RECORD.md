# VERITY final deployment record

Fill this in after you (the user, from your own wallet(s)) complete
`docs/MANUAL_DEPLOYMENT.md` and `docs/MANUAL_SMOKE_TEST.md` /
`docs/MANUAL_TIMEOUT_REFUND_TEST.md`. Only public addresses and
transaction hashes belong in this file -- **never** a private key, seed
phrase, or mnemonic. If you'd like, paste the real values back and I'll
fill this in for you; I will never ask you to paste a private key here
or anywhere else.

This file intentionally ships with blank fields -- it is a template,
not a record of a deployment that has happened yet.

## Deployment

| Field | Value |
|---|---|
| Network | StudioNet |
| Chain ID | 61999 |
| RPC | https://studio.genlayer.com/api |
| Deployer public address | _(fill in)_ |
| Contract source file | `contracts/verity.py` |
| Contract SHA-256 | `0d02adac2b5ea52a637c6b09dfdc65fd0388b8144da5e3ac97e6bf7b70ff6f6e` *(must match — see docs/MANUAL_DEPLOYMENT.md step 13)* |
| Git commit (frozen contract) | `b7300eba9ea4b29c2ab44dd3bf4a744a741c34f9` |
| Depends / runner tag | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |
| **Contract address** | _(fill in)_ |
| **Deployment transaction hash** | _(fill in)_ |
| Deployment date/time (UTC) | _(fill in)_ |
| Schema check performed (step 13a) | YES / NO |
| Source check performed (step 13b) | YES / NO |
| Explorer link | https://genlayer-explorer.vercel.app/?search=_(contract address)_ |

## Smoke test — main lifecycle

| Field | Value |
|---|---|
| Creator wallet PUBLIC address (Wallet A) | _(fill in)_ |
| Counterparty wallet PUBLIC address (Wallet B) | _(fill in)_ |
| Agreement ID | _(fill in)_ |
| Stake (wei, per side) | _(fill in)_ |
| Proposition | _(fill in)_ |
| Official/committed source | _(fill in — host + path prefix)_ |
| **CREATE tx** | _(fill in)_ |
| **MATCH tx** | _(fill in)_ |
| **FREEZE EVIDENCE tx** | _(fill in)_ |
| Evidence ID | _(fill in)_ |
| Evidence URL actually fetched | _(fill in)_ |
| **ADJUDICATE tx** | _(fill in)_ |
| Consensus result (votes observed) | _(fill in — e.g. "4/5 agree")_ |
| Persisted resolution (`canonical_outcome`) | _(fill in)_ |
| Rationale (as stored on-chain) | _(fill in)_ |
| **SETTLE tx** | _(fill in)_ |
| Winner (address) | _(fill in)_ |
| **WITHDRAW tx** | _(fill in)_ |
| Final owed/received balance | _(fill in)_ |
| Final agreement state | _(fill in — should be `SETTLED`, both withdrawal flags per outcome)_ |
| Duplicate-withdrawal rejection confirmed | YES / NO |
| Non-winner withdrawal rejection confirmed | YES / NO |

## Timeout/refund proof (separate disposable agreement)

| Field | Value |
|---|---|
| Agreement ID | _(fill in)_ |
| Accelerated deadlines used | YES / NO |
| **CREATE tx** | _(fill in)_ |
| **MATCH tx** | _(fill in)_ |
| **REFUND tx** | _(fill in)_ |
| Refund triggered by (address; confirms permissionless) | _(fill in)_ |
| **WITHDRAW tx (Wallet A)** | _(fill in)_ |
| **WITHDRAW tx (Wallet B)** | _(fill in)_ |
| Duplicate-withdrawal rejection confirmed | YES / NO |
| Optional: adjudicated-UNRESOLVED refund branch also tested | YES / NO / N/A |

## Explorer links (fill in once you have real hashes)

- Contract: https://genlayer-explorer.vercel.app/?search=
- Deployment tx: https://genlayer-explorer.vercel.app/?search=
- CREATE tx: https://genlayer-explorer.vercel.app/?search=
- MATCH tx: https://genlayer-explorer.vercel.app/?search=
- FREEZE EVIDENCE tx: https://genlayer-explorer.vercel.app/?search=
- ADJUDICATE tx: https://genlayer-explorer.vercel.app/?search=
- SETTLE tx: https://genlayer-explorer.vercel.app/?search=
- WITHDRAW tx: https://genlayer-explorer.vercel.app/?search=

## Frontend configuration updated

| Field | Value |
|---|---|
| File | `frontend/src/config.js` |
| `CONTRACT_ADDRESS` updated to new deployment | YES / NO |
| `npm run build` reconfirmed clean after update | YES / NO |
