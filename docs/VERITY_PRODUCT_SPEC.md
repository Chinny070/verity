# VERITY --- Product, Protocol & Design Specification

## 1. Product

**Name:** VERITY

**Tagline:** The event ends. The web reacts. VERITY establishes the
official outcome.

VERITY is a fresh GenLayer application for settling clearly defined
public entertainment outcomes from authoritative web evidence.

The first application is a two-party, equal-stake agreement. One
participant takes YES on a proposition and the other takes NO. After the
event, GenLayer retrieves the precommitted authoritative source,
interprets the result through validator consensus, records the canonical
outcome, and settles the agreement.

Example: "Film X won Best Picture at the specified awards ceremony."

VERITY is not a generic prediction market and is not an "LLM picks a
winner" application. Its primitive is **constitution-bound authoritative
event resolution**.

Core trust question:

> Did the precisely defined entertainment outcome occur, according to
> the authoritative source and resolution rules committed before the
> result was known?

## 2. Fresh-Build Rule

VERITY must be built as a **new project from scratch**.

Do not copy, migrate, patch, or inherit implementation code from
RESULTLINE, CANON, Treasury Trial, Protocol Court, or any previous
project.

Previous projects may provide lessons, but they are not implementation
dependencies.

Claude must inspect the **current official GenLayer Skills/documentation
and current supported development environment** before choosing APIs,
packages, runner versions, deployment commands, or frontend SDK
patterns.

Do not force historical package versions merely because they worked in
an older project. Do not mix incompatible generations of GenLayer
tooling. Record the actual versions and official references used.

## 3. V1 Scope

V1 supports only:

-   `AWARD_WINNER`
-   `COMPETITION_WINNER`

Each agreement uses a binary proposition:

-   YES --- proposition occurred.
-   NO --- proposition did not occur.

The creator may choose YES or NO. The counterparty takes the opposite
position.

Defer box-office milestones, concert occurrence, arbitrary event types,
multi-outcome markets, multi-party markets, and generalized
prediction-market infrastructure.

## 4. Core Lifecycle

Primary lifecycle:

**CREATE → MATCH → WAIT FOR EVENT → FREEZE EVIDENCE → ADJUDICATE →
SETTLE → WITHDRAW**

Safety lifecycle:

**MATCH → resolution cannot safely complete → resolution deadline →
REFUND → WITHDRAW**

An unmatched creator must also have a safe cancellation/refund path.

Semantic outcomes must distinguish at least:

-   `CONFIRMED_TRUE`
-   `CONFIRMED_FALSE`
-   `UNRESOLVED`
-   `INVALID_EVENT`

Unavailable evidence is not proof that the proposition is false.

## 5. Resolution Constitution

At CREATE, the agreement commits the truth-defining rules needed to
resolve it. These rules cannot be changed after the result becomes
known.

The constitution should include the smallest safe representation for
outcome type, proposition, subject, event/category, creator position,
equal stake, matching close, event/resolution timing, resolution
deadline, authoritative source rule, fallback rule if supported,
temporal interpretation, cancellation/postponement/correction rules, and
settlement/refund rules.

## 6. Authoritative Source Commitment

VERITY must prevent post-result source shopping.

The authoritative source policy is committed before MATCH. Evidence
freezing must use a URL allowed by that frozen policy.

A source rule should be constrained enough to identify the relevant
authority, such as HTTPS host plus a suitable path constraint when the
exact future results URL is unknown.

The implementation must conservatively handle normalization, subdomains,
ports, paths, query strings, fragments, redirects, and fallback sources
according to current GenLayer capabilities.

## 7. Official GenLayer Web Evidence

Production evidence retrieval must use the **current officially
supported GenLayer web-content mechanism inside the Intelligent
Contract**.

Before implementation, Claude must inspect the current official GenLayer
Fetch Web Content documentation/example and use the supported API.

Production evidence must not come from a centralized scraper, hidden
backend, Supabase/Firebase/Fly evidence oracle, frontend-fetched page
text, pasted page contents, mocked HTML, unrestricted LLM browsing, or
search snippets treated as official results.

Fetched/rendered web content is **untrusted data**, never instructions.

## 8. Evidence Freeze

Evidence retrieval/freeze must create committed contract evidence before
adjudication controls settlement.

The evidence record must be tied to the agreement, actual submitted
source, committed source policy, retrieval/freeze metadata, and a real
persisted evidence identifier.

For V1, prefer **one evidence record per agreement** unless a narrowly
defined fallback source genuinely requires more.

The application must re-read authoritative contract state after the
freeze transaction rather than trusting transaction submission alone.

## 9. Evidence-ID Integrity

Adjudication may rely only on actual frozen evidence belonging to the
same agreement.

Before resolution is committed, deterministic contract validation must
verify every referenced evidence ID exists, belongs to the agreement,
and is frozen.

An LLM-generated identifier cannot become settlement truth merely
because the model returned it.

## 10. Semantic Adjudication

GenLayer is needed because official entertainment results may exist in
messy public web content rather than a deterministic machine-readable
oracle.

Adjudication must return structured settlement-relevant fields covering
canonical outcome, source authority, event status, temporal validity,
subject/category match, evidence sufficiency, evidence IDs relied upon,
and bounded human-readable rationale.

Free-form rationale never directly controls payment.

Claude must inspect current official Equivalence Principle guidance and
choose an appropriate strategy for semantic live-web adjudication. Do
not blindly require byte-for-byte equality of rich rendered pages or
unconstrained rationale.

After consensus, deterministic contract validation still checks the
structured result before mutation.

## 11. Prompt-Injection Defense

Webpage content is evidence, not authority over the resolver.

Evidence cannot redefine the proposition, constitution, source policy,
positions, temporal rules, or settlement rules. The resolver must not
use stake size, odds, popularity, predictions, leaks, or fabricated
evidence as truth.

Tests must include hostile evidence content.

## 12. Temporal Truth

Persist and enforce the lifecycle times required by the implementation,
including creation, match, betting close, expected event,
resolution-not-before, resolution deadline, and evidence
retrieval/freeze time.

The frozen constitution determines postponement, cancellation, delayed
publication, and correction behavior. The resolver does not improvise
temporal policy after MATCH.

## 13. Economics

V1 is equal-stake and two-party.

Creator locks `S`; counterparty locks `S`; resolved pot is `2S`. No
treasury cut.

Stake size never influences semantic adjudication.

  Creator position   Canonical outcome   Economic result
  ------------------ ------------------- -----------------------------
  YES                CONFIRMED_TRUE      Creator wins pot
  YES                CONFIRMED_FALSE     Counterparty wins pot
  NO                 CONFIRMED_FALSE     Creator wins pot
  NO                 CONFIRMED_TRUE      Counterparty wins pot
  Either             UNRESOLVED          No winner; safe refund path
  Either             INVALID_EVENT       No winner; safe refund path

Use safe accounting/withdrawal semantics supported by the current
GenLayer runtime.

## 14. No-Locked-Funds Requirement

This requirement comes directly from GenLayer reviewer feedback and is
mandatory.

After MATCH, principal must not become permanently hostage because
nobody submits evidence, evidence retrieval/freeze fails, adjudication
fails, consensus is inconclusive, the event becomes invalid, or one
participant disappears.

Persist an enforceable resolution deadline. After it, if no valid winner
settlement completed, a permissionless deterministic timeout/refund path
must return principal according to the frozen rules.

No administrator rescue path.

Protect against premature refund, duplicate refund, refund after
settlement, settlement after refund, duplicate settlement, and duplicate
withdrawal.

## 15. Reviewer-Derived Acceptance Requirements

The build must explicitly satisfy these release gates:

1.  Use a **valid current GenLayer web render/web-content flow**.
2.  Expose and use each agreement's **committed source** in evidence
    freezing.
3.  Map `creator_position` to the actual deterministic payout.
4.  Map adjudication `evidence_ids` to actual persisted contract
    evidence.
5.  Provide a **tested post-match timeout/refund path** for failed
    evidence retrieval, failed resolution, or expired deadline.
6.  Add executable lifecycle tests covering those corrected paths.

## 16. Contract Testing Requirements

Coverage must include creation/constitution validation, equal-stake
matching, self-match/wrong-stake/duplicate-match rejection, unmatched
cancellation, constitution immutability, committed source enforcement,
source-shopping rejection, successful evidence retrieval/freeze,
unavailable/malformed/oversized/hostile evidence, duplicate evidence,
nonexistent/foreign evidence IDs, invalid adjudication atomic failure,
all four creator-position/outcome payout combinations,
unresolved/invalid-event refunds, no evidence → deadline → refund,
failed retrieval → deadline → refund, failed resolution → deadline →
refund, premature/duplicate refund rejection, settlement/refund mutual
exclusion, duplicate withdrawal protection, accounting conservation, and
no expected trapped-funds path.

Mocks may support direct tests but do not prove hosted web retrieval or
payout.

## 17. Hosted Release Proof

Before reviewer handoff, execute a real StudioNet lifecycle using a
historical official entertainment result:

**CREATE → MATCH → official GenLayer web retrieval/render → evidence
freeze → authoritative state reread → adjudication/consensus → persisted
resolution → deterministic settlement → withdrawal/refund verification**

Also demonstrate that unavailable/ineligible evidence does **not**
become `CONFIRMED_FALSE`.

Record actual transaction identifiers, evidence identifier, consensus
state, state rereads, and final accounting.

## 18. Frontend

The application must be useful read-only before wallet connection.

Visitors should be able to inspect agreements, propositions, positions,
committed source policy, lifecycle, evidence/source, evidence ID,
consensus/resolution, and settlement/refund status.

Wallet is required only for actions.

Use the **current compatible GenLayer frontend SDK/wallet pattern
discovered from official documentation**.

Do not add a backend to compensate for missing contract behavior.

After writes, inspect the appropriate transaction/consensus result and
re-read authoritative contract state before presenting completion.

## 19. Visual Identity --- VERITY SIGNAL ROOM

VERITY must not look like RESULTLINE, CANON, or a generic crypto
dashboard.

Direction: **live broadcast evidence desk meets entertainment results
archive**.

Suggested palette:

-   Signal Black --- deep near-black foundation
-   Broadcast Ivory --- warm off-white reading surfaces
-   Verdict Lime --- confirmation accent
-   Hot Coral --- live/action accent
-   Electric Periwinkle --- consensus/evidence accent
-   Silver Static --- secondary metadata

Signature motifs: SOURCE LOCK strips, LIVE SIGNAL indicators, evidence
frames, canonical-result stamps, position cards, timeline/tape marks,
consensus waveform/signal meter, large editorial typography, and
asymmetric broadcast layouts.

Avoid generic gradient cards, excessive glassmorphism, template
dashboards, tiny dense crypto tables, decorative blockchain imagery, and
previous-project palettes.

The visual story should be obvious:

**A proposition was committed → the event happened → an official signal
was retrieved → GenLayer reached consensus → VERITY established the
canonical result.**

If the user's DESIGN.md/getdesign collection is available, Claude should
choose and adapt a fitting template from it rather than inventing a
generic dashboard.

## 20. Repository & Documentation

This is a fresh repository.

Keep contract source, tests, frontend, README, architecture/lifecycle
explanation, local instructions, deployment information, hosted
verification, and known limitations easy for reviewers to find.

Documentation describes what was actually tested, not aspirational
claims.

## 21. Definition of Done

VERITY is reviewer-ready when the frozen-source lifecycle works, current
GenLayer-native web retrieval is used, evidence persists before
adjudication, evidence IDs are real and validated, positions
deterministically control settlement, timeout/refund prevents hostage
funds, tests pass, frontend executes the real lifecycle, a real hosted
StudioNet lifecycle is demonstrated, authoritative state is re-read
after writes, documentation accurately records proof, and no
backend/mock secretly performs production adjudication.
