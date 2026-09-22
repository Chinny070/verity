"""One-off hosted-lifecycle demonstration against real StudioNet, per
VERITY_PRODUCT_SPEC.md section 17: CREATE -> MATCH -> real GenLayer web
retrieval -> evidence freeze -> state reread -> adjudication/consensus ->
resolution -> settlement -> withdrawal, using a real historical
entertainment result (96th Academy Awards, Best Picture: Oppenheimer,
sourced from Wikipedia).

Run manually (not part of the pytest suite):
    python scripts/hosted_demo.py

Prints every tx hash, the evidence id, the consensus votes, and the
final accounting so the run can be recorded in docs/.
"""

import json
import time

from gltest import get_contract_factory, create_accounts
from gltest.assertions import tx_execution_succeeded


def p(label, value):
    print(f"\n=== {label} ===")
    print(value if isinstance(value, str) else json.dumps(value, indent=2, default=str))


def main():
    factory = get_contract_factory("Contract")
    contract = factory.deploy(args=[])
    p("DEPLOYED CONTRACT", contract.address)

    accounts = create_accounts(2)
    creator, counterparty = accounts[0], accounts[1]
    p("CREATOR", creator.address)
    p("COUNTERPARTY", counterparty.address)

    now = int(time.time())
    match_close_time = now + 90
    expected_event_time = now + 100
    resolution_not_before = now + 110
    resolution_deadline = now + 1200  # 20 min buffer for LLM adjudication

    create_args = [
        "AWARD_WINNER",
        "Oppenheimer wins Best Picture at the 96th Academy Awards",
        "Oppenheimer",
        "Academy Awards Best Picture 2024",
        "YES",
        "en.wikipedia.org",
        "/wiki/96th_Academy_Awards",
        match_close_time,
        expected_event_time,
        resolution_not_before,
        resolution_deadline,
    ]

    create_result = contract.connect(creator).create_agreement(
        args=create_args
    ).transact(value=10**18)
    assert tx_execution_succeeded(create_result), create_result
    p("CREATE_AGREEMENT TX", create_result["hash"])

    agreement = contract.get_agreement(args=[1]).call()
    p("AGREEMENT AFTER CREATE", agreement)

    match_result = contract.connect(counterparty).match_agreement(
        args=[1]
    ).transact(value=10**18)
    assert tx_execution_succeeded(match_result), match_result
    p("MATCH_AGREEMENT TX", match_result["hash"])

    print(f"\nWaiting until resolution_not_before ({resolution_not_before})...")
    while int(time.time()) < resolution_not_before + 2:
        time.sleep(2)

    evidence_url = "https://en.wikipedia.org/wiki/96th_Academy_Awards"
    freeze_result = contract.connect(creator).freeze_evidence(
        args=[1, evidence_url]
    ).transact()
    assert tx_execution_succeeded(freeze_result), freeze_result
    p("FREEZE_EVIDENCE TX", freeze_result["hash"])

    agreement = contract.get_agreement(args=[1]).call()
    p("AGREEMENT AFTER FREEZE (state reread)", agreement)
    evidence_id = agreement["evidence_id"]

    evidence = contract.get_evidence(args=[evidence_id]).call()
    p("EVIDENCE RECORD", {
        k: (v[:300] + "..." if isinstance(v, str) and len(v) > 300 else v)
        for k, v in evidence.items()
    })

    adjudicate_result = contract.connect(creator).adjudicate(args=[1]).transact()
    assert tx_execution_succeeded(adjudicate_result), adjudicate_result
    p("ADJUDICATE TX", adjudicate_result["hash"])
    p("ADJUDICATE CONSENSUS VOTES", adjudicate_result["consensus_data"]["votes"])

    agreement = contract.get_agreement(args=[1]).call()
    p("AGREEMENT AFTER ADJUDICATE", agreement)

    settle_result = contract.connect(creator).settle(args=[1]).transact()
    assert tx_execution_succeeded(settle_result), settle_result
    p("SETTLE TX", settle_result["hash"])

    agreement = contract.get_agreement(args=[1]).call()
    p("AGREEMENT AFTER SETTLE (final accounting)", agreement)

    winner_account = creator if agreement["winner"] == creator.address else counterparty
    withdraw_result = contract.connect(winner_account).withdraw(args=[1]).transact()
    assert tx_execution_succeeded(withdraw_result), withdraw_result
    p("WITHDRAW TX (winner)", withdraw_result["hash"])

    p("DONE", "Full hosted lifecycle completed successfully.")


def test_hosted_lifecycle_demo():
    """Run via pytest so gltest's plugin-managed config/fixtures are
    available (a bare `python scripts/hosted_demo.py` has no contracts_dir
    etc. -- those are wired up by the gltest pytest plugin):
        python -m pytest scripts/hosted_demo.py -v -s
    """
    main()
