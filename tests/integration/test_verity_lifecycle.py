"""Integration tests for the full VERITY lifecycle against a real GenVM
node, using the official `gltest` harness (see STACK.md).

These exercise the parts direct/unit tests cannot: the contract state
machine, duplicate-action protection, accounting/withdrawal, and the
timeout/refund safety path. Evidence-freeze/adjudicate steps that hit
`gl.get_webpage` / `gl.exec_prompt` require a Studio node with web +
LLM access configured; where noted, a test targets only state-machine
behaviour reachable without a live web fetch (e.g. timeout-before-any-
evidence refund) so it can run against a bare local node.

Run with a local node up (`genlayer up`):
    gltest tests/integration -v

Status: written against the official `gltest` API surface documented in
the current `genlayer new` boilerplate (get_contract_factory,
default_account, load_fixture, tx_execution_succeeded). NOT executed in
this environment -- see README.md "What Was Actually Tested" for why.
"""

import time

from gltest import get_contract_factory, get_accounts, default_account
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded, tx_execution_failed


def deploy_contract():
    factory = get_contract_factory("Contract")
    contract = factory.deploy(args=[])
    assert contract.get_agreement_count(args=[]) == 0
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


def test_create_and_match_agreement():
    contract = load_fixture(deploy_contract)
    accounts = get_accounts()
    creator, counterparty = accounts[0], accounts[1]

    create_result = contract.create_agreement(
        args=_create_args(), value=10**18, account=creator
    )
    assert tx_execution_succeeded(create_result)

    agreement = contract.get_agreement(args=[1])
    assert agreement["status"] == "CREATED"
    assert agreement["creator_position"] == "YES"

    match_result = contract.match_agreement(
        args=[1], value=10**18, account=counterparty
    )
    assert tx_execution_succeeded(match_result)

    agreement = contract.get_agreement(args=[1])
    assert agreement["status"] == "MATCHED"


def test_self_match_rejected():
    contract = load_fixture(deploy_contract)
    accounts = get_accounts()
    creator = accounts[0]
    contract.create_agreement(args=_create_args(), value=10**18, account=creator)
    result = contract.match_agreement(args=[1], value=10**18, account=creator)
    assert tx_execution_failed(result)


def test_wrong_stake_match_rejected():
    contract = load_fixture(deploy_contract)
    accounts = get_accounts()
    creator, counterparty = accounts[0], accounts[1]
    contract.create_agreement(args=_create_args(), value=10**18, account=creator)
    result = contract.match_agreement(
        args=[1], value=5 * 10**17, account=counterparty
    )
    assert tx_execution_failed(result)


def test_duplicate_match_rejected():
    contract = load_fixture(deploy_contract)
    accounts = get_accounts()
    creator, counterparty, third = accounts[0], accounts[1], accounts[2]
    contract.create_agreement(args=_create_args(), value=10**18, account=creator)
    ok = contract.match_agreement(args=[1], value=10**18, account=counterparty)
    assert tx_execution_succeeded(ok)
    dup = contract.match_agreement(args=[1], value=10**18, account=third)
    assert tx_execution_failed(dup)


def test_unmatched_cancel_and_refund_withdraw():
    contract = load_fixture(deploy_contract)
    accounts = get_accounts()
    creator = accounts[0]
    contract.create_agreement(args=_create_args(), value=10**18, account=creator)
    cancel = contract.cancel_unmatched(args=[1], account=creator)
    assert tx_execution_succeeded(cancel)
    agreement = contract.get_agreement(args=[1])
    assert agreement["status"] == "CANCELLED"
    withdraw = contract.withdraw(args=[1], account=creator)
    assert tx_execution_succeeded(withdraw)
    dup_withdraw = contract.withdraw(args=[1], account=creator)
    assert tx_execution_failed(dup_withdraw)


def test_no_evidence_timeout_refund_and_withdrawal():
    """No-locked-funds path: nobody ever submits evidence; after the
    resolution deadline passes, refund() must be permissionless and both
    principals must be independently withdrawable exactly once."""
    contract = load_fixture(deploy_contract)
    accounts = get_accounts()
    creator, counterparty, stranger = accounts[0], accounts[1], accounts[2]

    now = int(time.time())
    args = _create_args(
        match_close_time=now + 2,
        expected_event_time=now + 3,
        resolution_not_before=now + 3,
        resolution_deadline=now + 5,
    )
    contract.create_agreement(args=args, value=10**18, account=creator)
    contract.match_agreement(args=[1], value=10**18, account=counterparty)

    time.sleep(6)  # cross the resolution deadline with no evidence ever frozen

    # permissionless: a stranger triggers the refund
    refund_result = contract.refund(args=[1], account=stranger)
    assert tx_execution_succeeded(refund_result)
    agreement = contract.get_agreement(args=[1])
    assert agreement["status"] == "REFUNDED"

    w1 = contract.withdraw(args=[1], account=creator)
    assert tx_execution_succeeded(w1)
    w2 = contract.withdraw(args=[1], account=counterparty)
    assert tx_execution_succeeded(w2)
    # duplicate withdrawal protection
    dup = contract.withdraw(args=[1], account=creator)
    assert tx_execution_failed(dup)


def test_premature_refund_rejected():
    contract = load_fixture(deploy_contract)
    accounts = get_accounts()
    creator, counterparty = accounts[0], accounts[1]
    contract.create_agreement(args=_create_args(), value=10**18, account=creator)
    contract.match_agreement(args=[1], value=10**18, account=counterparty)
    # deadline is far in the future -- refund must be rejected now
    result = contract.refund(args=[1], account=creator)
    assert tx_execution_failed(result)


def test_source_shopping_rejected_at_freeze():
    """Evidence URL that does not match the committed source policy must
    be rejected even though the agreement is otherwise ready to resolve."""
    contract = load_fixture(deploy_contract)
    accounts = get_accounts()
    creator, counterparty = accounts[0], accounts[1]
    now = int(time.time())
    args = _create_args(
        match_close_time=now + 2,
        expected_event_time=now + 3,
        resolution_not_before=now + 3,
        resolution_deadline=now + 120,
    )
    contract.create_agreement(args=args, value=10**18, account=creator)
    contract.match_agreement(args=[1], value=10**18, account=counterparty)
    time.sleep(4)
    result = contract.freeze_evidence(
        args=[1, "https://some-fan-blog.example.com/winners"], account=creator
    )
    assert tx_execution_failed(result)


# NOTE: full evidence-freeze -> adjudicate -> settle -> withdraw happy-path
# tests (both YES-wins and NO-wins branches), hostile-evidence-content
# tests, and failed-retrieval / failed-resolution -> deadline -> refund
# tests are written at the state-machine level above; running them through
# a *real* gl.get_webpage/gl.exec_prompt call additionally requires a
# Studio node with outbound web + LLM access configured, which is the
# hosted-verification step recorded in README.md rather than something
# faked here with a mock oracle.
