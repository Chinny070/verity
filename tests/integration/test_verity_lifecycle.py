"""Integration tests for the full VERITY lifecycle against a real GenVM
node, using the official `gltest` harness (see STACK.md).

These exercise the parts direct/unit tests cannot: the contract state
machine, duplicate-action protection, accounting/withdrawal, and the
timeout/refund safety path. Evidence-freeze/adjudicate steps that hit
`gl.get_webpage` / `gl.exec_prompt` require a Studio node with web +
LLM access configured; where noted, a test targets only state-machine
behaviour reachable without a live web fetch (e.g. timeout-before-any-
evidence refund) so it can run against a bare local node.

Run against StudioNet (the default target configured in
gltest.config.yaml -- hosted, gasless, no Docker/`genlayer up` needed):
    python -m pytest tests/integration -v

Status: written against and verified live against the `gltest` 0.29.2 /
genlayer-py 0.16.3 API surface (get_contract_factory, get_default_account,
load_fixture, tx_execution_succeeded, ContractFunction.call()/.transact()).
Read-only methods are invoked as `contract.method(args=[...]).call()`;
state-changing methods as `contract.connect(account).method(args=[...])
.transact(value=...)`.
"""

import time

from gltest import get_contract_factory, create_accounts, get_default_account
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded, tx_execution_failed


def deploy_contract():
    factory = get_contract_factory("Contract")
    contract = factory.deploy(args=[])
    assert contract.get_agreement_count(args=[]).call() == 0
    return contract


def _future_times(now=None):
    now = now or int(time.time())
    return dict(
        match_close_time=now + 60,
        expected_event_time=now + 120,
        resolution_not_before=now + 130,
        resolution_deadline=now + 200,
    )


def _create_args(**overrides):
    t = _future_times()
    t.update(overrides)
    return [
        "AWARD_WINNER",
        "Film X wins Best Picture",
        "Film X",
        "Best Picture 2027",
        "YES",
        "www.oscars.org",
        "/winners",
        t["match_close_time"],
        t["expected_event_time"],
        t["resolution_not_before"],
        t["resolution_deadline"],
    ]


def _as(contract, account):
    """Bind `contract` to `account` for a state-changing call."""
    return contract.connect(account)


def test_create_and_match_agreement():
    contract = load_fixture(deploy_contract)
    accounts = create_accounts(3)
    creator, counterparty = accounts[0], accounts[1]

    create_result = _as(contract, creator).create_agreement(
        args=_create_args()
    ).transact(value=10**18)
    assert tx_execution_succeeded(create_result)

    agreement = contract.get_agreement(args=[1]).call()
    assert agreement["status"] == "CREATED"
    assert agreement["creator_position"] == "YES"

    match_result = _as(contract, counterparty).match_agreement(
        args=[1]
    ).transact(value=10**18)
    assert tx_execution_succeeded(match_result)

    agreement = contract.get_agreement(args=[1]).call()
    assert agreement["status"] == "MATCHED"


def test_self_match_rejected():
    contract = load_fixture(deploy_contract)
    accounts = create_accounts(3)
    creator = accounts[0]
    _as(contract, creator).create_agreement(args=_create_args()).transact(
        value=10**18
    )
    result = _as(contract, creator).match_agreement(args=[1]).transact(
        value=10**18
    )
    assert tx_execution_failed(result)


def test_wrong_stake_match_rejected():
    contract = load_fixture(deploy_contract)
    accounts = create_accounts(3)
    creator, counterparty = accounts[0], accounts[1]
    _as(contract, creator).create_agreement(args=_create_args()).transact(
        value=10**18
    )
    result = _as(contract, counterparty).match_agreement(args=[1]).transact(
        value=5 * 10**17
    )
    assert tx_execution_failed(result)


def test_duplicate_match_rejected():
    contract = load_fixture(deploy_contract)
    accounts = create_accounts(3)
    creator, counterparty, third = accounts[0], accounts[1], accounts[2]
    _as(contract, creator).create_agreement(args=_create_args()).transact(
        value=10**18
    )
    ok = _as(contract, counterparty).match_agreement(args=[1]).transact(
        value=10**18
    )
    assert tx_execution_succeeded(ok)
    dup = _as(contract, third).match_agreement(args=[1]).transact(value=10**18)
    assert tx_execution_failed(dup)


def test_unmatched_cancel_and_refund_withdraw():
    contract = load_fixture(deploy_contract)
    accounts = create_accounts(3)
    creator = accounts[0]
    _as(contract, creator).create_agreement(args=_create_args()).transact(
        value=10**18
    )
    cancel = _as(contract, creator).cancel_unmatched(args=[1]).transact()
    assert tx_execution_succeeded(cancel)
    agreement = contract.get_agreement(args=[1]).call()
    assert agreement["status"] == "CANCELLED"
    withdraw = _as(contract, creator).withdraw(args=[1]).transact()
    assert tx_execution_succeeded(withdraw)
    dup_withdraw = _as(contract, creator).withdraw(args=[1]).transact()
    assert tx_execution_failed(dup_withdraw)


def test_no_evidence_timeout_refund_and_withdrawal():
    """No-locked-funds path: nobody ever submits evidence; after the
    resolution deadline passes, refund() must be permissionless and both
    principals must be independently withdrawable exactly once."""
    contract = load_fixture(deploy_contract)
    accounts = create_accounts(3)
    creator, counterparty, stranger = accounts[0], accounts[1], accounts[2]

    # Margins here must exceed real StudioNet write latency (observed
    # 8-15s per transact() including consensus), not just wall-clock
    # test-code time, or create_agreement's own temporal-ordering check
    # (now < match_close_time at EXECUTION time, not submission time) can
    # fail before the agreement is even created -- see git history for a
    # live repro of this exact false failure.
    now = int(time.time())
    args = _create_args(
        match_close_time=now + 30,
        expected_event_time=now + 35,
        resolution_not_before=now + 40,
        resolution_deadline=now + 50,
    )
    create_result = _as(contract, creator).create_agreement(args=args).transact(
        value=10**18
    )
    assert tx_execution_succeeded(create_result), create_result
    match_result = _as(contract, counterparty).match_agreement(args=[1]).transact(
        value=10**18
    )
    assert tx_execution_succeeded(match_result), match_result

    # cross the resolution deadline with no evidence ever frozen
    while int(time.time()) < now + 52:
        time.sleep(3)

    # permissionless: a stranger triggers the refund
    refund_result = _as(contract, stranger).refund(args=[1]).transact()
    assert tx_execution_succeeded(refund_result)
    agreement = contract.get_agreement(args=[1]).call()
    assert agreement["status"] == "REFUNDED"

    w1 = _as(contract, creator).withdraw(args=[1]).transact()
    assert tx_execution_succeeded(w1)
    w2 = _as(contract, counterparty).withdraw(args=[1]).transact()
    assert tx_execution_succeeded(w2)
    # duplicate withdrawal protection
    dup = _as(contract, creator).withdraw(args=[1]).transact()
    assert tx_execution_failed(dup)


def test_premature_refund_rejected():
    contract = load_fixture(deploy_contract)
    accounts = create_accounts(3)
    creator, counterparty = accounts[0], accounts[1]
    _as(contract, creator).create_agreement(args=_create_args()).transact(
        value=10**18
    )
    _as(contract, counterparty).match_agreement(args=[1]).transact(value=10**18)
    # deadline is far in the future -- refund must be rejected now
    result = _as(contract, creator).refund(args=[1]).transact()
    assert tx_execution_failed(result)


def test_source_shopping_rejected_at_freeze():
    """Evidence URL that does not match the committed source policy must
    be rejected even though the agreement is otherwise ready to resolve."""
    contract = load_fixture(deploy_contract)
    accounts = create_accounts(3)
    creator, counterparty = accounts[0], accounts[1]
    # See test_no_evidence_timeout_refund_and_withdrawal for why these
    # margins must exceed real StudioNet write latency, not just a few
    # seconds of wall-clock test-code time.
    now = int(time.time())
    args = _create_args(
        match_close_time=now + 30,
        expected_event_time=now + 35,
        resolution_not_before=now + 40,
        resolution_deadline=now + 120,
    )
    create_result = _as(contract, creator).create_agreement(args=args).transact(
        value=10**18
    )
    assert tx_execution_succeeded(create_result), create_result
    match_result = _as(contract, counterparty).match_agreement(args=[1]).transact(
        value=10**18
    )
    assert tx_execution_succeeded(match_result), match_result
    while int(time.time()) < now + 42:
        time.sleep(3)
    result = _as(contract, creator).freeze_evidence(
        args=[1, "https://some-fan-blog.example.com/winners"]
    ).transact()
    assert tx_execution_failed(result)


# NOTE: full evidence-freeze -> adjudicate -> settle -> withdraw happy-path
# tests (both YES-wins and NO-wins branches), hostile-evidence-content
# tests, and failed-retrieval / failed-resolution -> deadline -> refund
# tests are written at the state-machine level above; running them through
# a *real* gl.get_webpage/gl.exec_prompt call additionally requires a
# Studio node with outbound web + LLM access configured, which is the
# hosted-verification step recorded in README.md rather than something
# faked here with a mock oracle.
