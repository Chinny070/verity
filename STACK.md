# VERITY — Selected GenLayer Stack

Recorded 2026-09-22, verified against the **official** `genlayer` CLI scaffold
(`genlayer new`) and current docs.genlayer.com pages. This is one internally
consistent current generation — nothing here is copied from older sibling
projects on this machine.

## Toolchain actually probed in this environment

- `genlayer` CLI: **v0.39.2** (installed via `npm install -g genlayer`)
- `genlayer-js`: **^0.9.0** (from official boilerplate `package.json`)
- `genlayer-test` (Python): **0.1.1** (from official boilerplate `requirements.txt`)
- Node: v24.14.0, npm 11.9.0, Python 3.12.10, Docker 27.5.1 (available;
  `genlayer up` uses it internally — this is the officially supported path,
  not infrastructure we introduced)

## Ground truth source

Ran `genlayer new` to generate the current official project template
(`football_bets` example) and read it directly — this is the authoritative,
runnable reference for current syntax, not a guess from docs prose. Template
discarded after extracting patterns; no code copied into VERITY beyond
matching the same official idioms any GenLayer project would use.

## Contract-side API (Python, GenVM)

```python
# { "Depends": "py-genlayer:<hash>" }   <- SHORT, single-line, ASCII only
from genlayer import *

class Contract(gl.Contract):
    field: TreeMap[Address, u256]        # persistent fields: annotated class body

    def __init__(self):                  # no return-type annotation
        ...

    @gl.public.write
    def mutate(self, x: str) -> None: ...

    @gl.public.write.payable
    def fund(self) -> None:
        amount = gl.message.value        # native GEN sent with tx

    @gl.public.view
    def read(self) -> dict: ...
```

- Storage: `TreeMap[K, V]`, `DynArray[T]`, `u256`/`u8`/etc fixed-width ints,
  `Address`. Custom records: `@allow_storage @dataclass class X: ...`.
- Sender: `gl.message.sender_address`. Time: `gl.message.datetime`
  (a `datetime`; VERITY converts to unix seconds via
  `int(gl.message.datetime.timestamp())` for deterministic comparisons —
  every validator executing the same tx sees the same value).
- Web evidence: `gl.get_webpage(url, mode="text")` — fetched **inside** a
  non-deterministic block, never trusted directly.
- LLM reasoning: `gl.exec_prompt(prompt: str) -> str`.
- Equivalence Principle: `gl.eq_principle_strict_eq(fn)` for canonicalizable
  output (VERITY uses this: the nondet block returns a canonical
  `json.dumps(..., sort_keys=True)` string, so every validator must
  reproduce byte-identical structured output — this is the "appropriate
  strategy" the spec asks for in place of comparing raw rendered HTML).
- Native transfer: `gl.get_contract_at(address).emit_transfer(value=u256(amount))`.

## Frontend SDK

`genlayer-js` (`createClient`, `createAccount`, chain presets incl.
`studionet`, `client.readContract`, `client.writeContract`,
`client.waitForTransactionReceipt` / `waitForDecision` /
`waitForFinalization`, browser wallet via `provider: window.ethereum`).

## Test framework

- Direct/unit tests: pytest against the contract module logic that can run
  without GenVM (constitution validators, payout mapping, source-policy
  matcher) — pure-Python helper functions extracted from the contract so
  they're independently testable.
- Integration tests: `gltest` (from `genlayer-test` package) against a
  running local GenVM/Studio node — `gltest tests/integration -v`,
  using `get_contract_factory`, `default_account`, `load_fixture`,
  `tx_execution_succeeded` per the official template's `test/` folder.

## StudioNet

GenLayer's hosted testnet, reached via `genlayer network` / CLI config and
`genlayer-js`'s `studionet` chain preset. Deployment requires a funded
account and, for the frontend flow, a browser wallet signature — this is the
human-authorization boundary called out in the build brief.

## Why this generation

This is the exact set of APIs the *current* `genlayer new` scaffold and
`docs.genlayer.com` (fetched 2026-09-22) both use together. No historical
package versions from other local projects were forced in.
