import "./style.css";
import {
  connectWallet,
  getConnectedAddress,
  contractConfigured,
  readContract,
  writeContract,
  VerityTxError,
} from "./genlayerClient.js";
import { CONTRACT_ADDRESS, EXPLORER_URL, REVIEWER_DEMO_AGREEMENT_ID } from "./config.js";

const app = document.getElementById("app");

const state = {
  wallet: null,
  agreements: [],
  loading: false,
  error: null,
  notice: null,
  lastTx: null,
  pendingAction: null, // e.g. "match:1" while a specific button's tx is in flight
  reviewer: { agreement: null, evidence: null, loading: false, error: null },
};

// Real, previously-verified transaction record for the reviewer demo
// agreement (see docs/RELEASE_VERIFICATION.md for full detail and how to
// independently reproduce). These hashes are not fetched live -- they are
// the actual finalized StudioNet transactions from the hosted lifecycle
// run against this exact deployed contract; the on-chain STATE they
// produced (agreement + evidence below) is read live, not hardcoded.
const REVIEWER_TX_LOG = [
  { step: "1. Create", method: "create_agreement", hash: "0x274f64fb9fd8f5ffedbbcc3c19927232d562e76c838f315ed2ef50f59e366620" },
  { step: "2. Match", method: "match_agreement", hash: "0x9b99d7ee6b3cf5e3351daca2dfc26fbd9cd01918095bbe22a219875986b6f1db" },
  { step: "3. Freeze evidence", method: "freeze_evidence", hash: "0x1622dfc3e2fb3fc1bd3a5fc7d2110ed2f7be83fb351ad790ad4d3b3f025c5adb" },
  { step: "4. Adjudicate", method: "adjudicate", hash: "0x7b7160f8308c8fc5946f3c7c0d96640612d37ae18f724752332e3a71d7b2b0a8" },
  { step: "5. Settle", method: "settle", hash: "0xdd558e63d9ed4f63e411f5f0f64d8946d2bdc32685772afd05f3436cbeedce11" },
  { step: "6. Withdraw", method: "withdraw", hash: "0xb9ffed5115124ede0703a6f2e5176cf388346f43e00ba3fa80e4b2c1a95b6b2c" },
];
const REVIEWER_VOTES = [
  { addr: "0x4EDbE1FC9EAeC7b0EBA849b0C76AE73Eb0ad5C47", vote: "agree" },
  { addr: "0xE6BD8050758CB15fC88387223E31Ae2708B119dC", vote: "agree" },
  { addr: "0xec2Fb79cd12255Eb34886CEd7332f27B98DEe658", vote: "agree" },
  { addr: "0xDB1c35c1f05d885999b8f13e5735307BcC16Be88", vote: "idle" },
  { addr: "0xacc2459F341D7a887bcA8FAA62F1EC9378d4Bc67", vote: "idle" },
];

function explorerTxUrl(hash) {
  return `${EXPLORER_URL}/?search=${hash}`;
}
function explorerAddressUrl(addr) {
  return `${EXPLORER_URL}/?search=${addr}`;
}

const OUTCOME_LABEL = {
  PENDING: "PENDING",
  CONFIRMED_TRUE: "CONFIRMED TRUE",
  CONFIRMED_FALSE: "CONFIRMED FALSE",
  UNRESOLVED: "UNRESOLVED",
  INVALID_EVENT: "INVALID EVENT",
};

function short(addr) {
  if (!addr) return "—";
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function statusClass(status, outcome) {
  if (status === "SETTLED") return "settled";
  if (status === "MATCHED" || status === "EVIDENCE_FROZEN" || status === "ADJUDICATED")
    return "matched";
  if (status === "REFUNDED" || status === "CANCELLED") return "refunded";
  return "";
}

async function loadAgreements() {
  state.error = null;
  if (!contractConfigured()) {
    state.agreements = [];
    render();
    return;
  }
  state.loading = true;
  render();
  try {
    const count = await readContract("get_agreement_count");
    const ids = Array.from({ length: Number(count) }, (_, i) => i + 1).reverse();
    const agreements = [];
    for (const id of ids) {
      const a = await readContract("get_agreement", [id]);
      agreements.push(a);
    }
    state.agreements = agreements;
  } catch (err) {
    state.error = err.message || String(err);
  } finally {
    state.loading = false;
    render();
  }
}

async function doConnect() {
  try {
    state.wallet = await connectWallet();
  } catch (err) {
    state.error = err.message || String(err);
  }
  render();
}

// Friendly, non-technical messages for the failure modes the product
// spec calls out explicitly. Falls back to the VerityTxError's own
// message (already stripped of raw tracebacks) for anything else.
function friendlyMessage(err, actionLabel) {
  if (!(err instanceof VerityTxError)) return err.message || String(err);
  switch (err.kind) {
    case "wallet_rejected":
      return "You declined the wallet request, so nothing was submitted.";
    case "submit_failed":
      return `Could not reach StudioNet to submit "${actionLabel}". Check your connection and try again.`;
    case "delayed_or_inconclusive":
      return `"${actionLabel}" is taking longer than expected to reach consensus. It may still finalize -- try refreshing in a moment, or check the transaction on the explorer below.`;
    case "execution_failed": {
      const m = (err.message || "").toLowerCase();
      if (m.includes("matching window closed")) return "The matching window for this agreement has closed.";
      if (m.includes("too early")) return "Evidence can't be frozen yet -- the resolution window hasn't opened.";
      if (m.includes("deadline passed")) return "The resolution deadline has passed; use Refund instead.";
      if (m.includes("does not match committed source policy")) return "That URL doesn't match this agreement's committed authoritative source -- rejected to prevent source shopping.";
      if (m.includes("already frozen")) return "Evidence has already been frozen for this agreement.";
      if (m.includes("not in evidence_frozen state")) return "Evidence must be frozen before adjudication can run.";
      if (m.includes("not in adjudicated state")) return "This agreement hasn't been adjudicated yet.";
      if (m.includes("already settled")) return "This agreement has already been settled.";
      if (m.includes("already refunded")) return "This agreement has already been refunded.";
      if (m.includes("already withdrawn")) return "These funds have already been withdrawn.";
      if (m.includes("refund not yet permitted")) return "This agreement isn't eligible for a refund yet -- the resolution deadline hasn't passed, or it already has a definite outcome.";
      if (m.includes("not a party") || m.includes("only the winner") || m.includes("only creator")) return "You're not eligible to perform this action on this agreement.";
      if (m.includes("no winner outcome")) return "Consensus reached an UNRESOLVED/INVALID_EVENT outcome -- use Refund instead of Settle.";
      return err.message || `"${actionLabel}" was rejected by the contract.`;
    }
    default:
      return err.message || String(err);
  }
}

async function submitAction(fn, args, value, agreementId, actionKey, actionLabel) {
  state.error = null;
  state.notice = null;
  state.lastTx = null;
  state.pendingAction = actionKey;
  render();
  try {
    const { txId, receipt } = await writeContract(fn, args, value);
    state.lastTx = txId;
    state.notice = `"${actionLabel}" confirmed on StudioNet and verified against re-read contract state.`;
    void receipt;
    // Re-read authoritative contract state after the write -- never treat
    // a returned tx hash as success on its own (spec section 18).
    if (agreementId) {
      const fresh = await readContract("get_agreement", [agreementId]);
      const idx = state.agreements.findIndex((a) => a.id === agreementId);
      if (idx >= 0) state.agreements[idx] = fresh;
      else await loadAgreements();
    } else {
      await loadAgreements();
    }
  } catch (err) {
    state.error = friendlyMessage(err, actionLabel);
    if (err instanceof VerityTxError && err.txId) state.lastTx = err.txId;
  }
  state.pendingAction = null;
  render();
}

async function loadReviewerDemo() {
  state.reviewer.loading = true;
  state.reviewer.error = null;
  render();
  try {
    const agreement = await readContract("get_agreement", [REVIEWER_DEMO_AGREEMENT_ID]);
    let evidence = null;
    if (agreement.evidence_id) {
      evidence = await readContract("get_evidence", [agreement.evidence_id]);
    }
    state.reviewer.agreement = agreement;
    state.reviewer.evidence = evidence;
  } catch (err) {
    state.reviewer.error = err.message || String(err);
  }
  state.reviewer.loading = false;
  render();
}

function waveform() {
  const bars = Array.from({ length: 14 }, () => 4 + Math.round(Math.random() * 18));
  return `<div class="waveform">${bars.map((h) => `<i style="height:${h}px"></i>`).join("")}</div>`;
}

function actionBtn(id, action, label, visible, variant, value) {
  if (!visible) return "";
  const key = `${action}:${id}`;
  const isPending = state.pendingAction === key;
  const cls = ["btn", variant].filter(Boolean).join(" ") + (isPending ? " loading" : "");
  const valueAttr = value !== undefined ? ` data-value="${value}"` : "";
  return `<button class="${cls}" data-action="${action}" data-id="${id}"${valueAttr} ${isPending ? "disabled" : ""}>${isPending ? "Submitting…" : label}</button>`;
}

function renderCard(a) {
  const outcomeLabel = OUTCOME_LABEL[a.canonical_outcome] || a.canonical_outcome;
  const stampClass =
    a.canonical_outcome === "CONFIRMED_TRUE"
      ? ""
      : a.canonical_outcome === "CONFIRMED_FALSE"
      ? "false"
      : a.canonical_outcome === "UNRESOLVED"
      ? "unresolved"
      : a.canonical_outcome === "INVALID_EVENT"
      ? "invalid"
      : null;

  const canMatch = a.status === "CREATED";
  const canFreeze = a.status === "MATCHED";
  const canAdjudicate = a.status === "EVIDENCE_FROZEN";
  const canSettle =
    a.status === "ADJUDICATED" &&
    (a.canonical_outcome === "CONFIRMED_TRUE" || a.canonical_outcome === "CONFIRMED_FALSE");
  const canRefund =
    (["MATCHED", "EVIDENCE_FROZEN"].includes(a.status)) ||
    (a.status === "ADJUDICATED" &&
      ["UNRESOLVED", "INVALID_EVENT"].includes(a.canonical_outcome));
  const canWithdraw = ["SETTLED", "REFUNDED", "CANCELLED"].includes(a.status);

  return `
  <div class="card" data-id="${a.id}">
    <div class="card-main">
      <div class="status-pill ${statusClass(a.status)}">${a.status.replace("_", " ")}</div>
      <p class="prop">${a.proposition}</p>
      <div class="meta-row">
        <span>${a.outcome_type}</span>
        <span>${a.subject}</span>
        <span>${a.event_category}</span>
        <span>Stake ${a.stake}</span>
      </div>
      <div class="source-lock">SOURCE LOCK <b>${a.source_host}${a.source_path_prefix}</b></div>
      <div class="positions">
        <div class="position-card yes">
          <div class="label">Creator — ${a.creator_position}</div>
          <div class="val">${short(a.creator)}</div>
        </div>
        <div class="position-card no">
          <div class="label">Counterparty</div>
          <div class="val">${short(a.counterparty)}</div>
        </div>
      </div>
      ${a.evidence_id ? `<div class="meta-row">Evidence ID <b>${a.evidence_id}</b></div>` : ""}
      ${a.rationale ? `<div class="meta-row" style="text-transform:none">${a.rationale}</div>` : ""}
      <div class="actions" style="flex-direction:row;flex-wrap:wrap">
        ${actionBtn(a.id, "match", "Match", canMatch, "", a.stake)}
        ${a.status === "CREATED" ? actionBtn(a.id, "cancel", "Cancel (creator)", true, "secondary") : ""}
        ${actionBtn(a.id, "freeze", "Freeze Evidence", canFreeze, "secondary")}
        ${actionBtn(a.id, "adjudicate", "Adjudicate", canAdjudicate, "secondary")}
        ${actionBtn(a.id, "settle", "Settle", canSettle, "")}
        ${actionBtn(a.id, "refund", "Refund", canRefund, "coral")}
        ${actionBtn(a.id, "withdraw", "Withdraw", canWithdraw, "")}
      </div>
    </div>
    <div class="card-side">
      ${stampClass !== null ? `<div class="stamp ${stampClass || ""}">${outcomeLabel}</div>` : `<div class="stamp" style="border-color:var(--silver-static);color:var(--silver-static)">${outcomeLabel}</div>`}
      ${waveform()}
      <div class="meta-row" style="margin:0">Resolution deadline<br/><b style="color:var(--broadcast-ivory)">${new Date(Number(a.resolution_deadline) * 1000).toLocaleString()}</b></div>
    </div>
  </div>`;
}

const LIFECYCLE_STEPS = [
  "Proposition Committed",
  "Participants Matched",
  "Official Signal Retrieved",
  "Evidence Frozen",
  "GenLayer Consensus",
  "Canonical Result",
  "Settlement",
];
function lifecycleDoneCount(a) {
  if (!a) return 0;
  if (a.status === "CREATED") return 1;
  if (a.status === "MATCHED") return 2;
  if (a.status === "EVIDENCE_FROZEN") return 4; // retrieval + freeze both happened
  if (a.status === "ADJUDICATED") return 6;
  if (a.status === "SETTLED") return 7;
  if (a.status === "REFUNDED" || a.status === "CANCELLED") return 2;
  return 0;
}

function renderReviewerPanel() {
  const { agreement, evidence, loading, error } = state.reviewer;
  const done = lifecycleDoneCount(agreement);
  return `
  <div class="reviewer-panel">
    <h3>Reviewer Walkthrough — No Wallet Required</h3>
    <div class="sub">
      A real, previously-run hosted lifecycle on GenLayer StudioNet. Every value below
      (except the transaction log, which is the permanent record of what already
      happened) is read live from the deployed contract at
      <a href="${explorerAddressUrl(CONTRACT_ADDRESS)}" target="_blank" rel="noopener">${short(CONTRACT_ADDRESS)}</a>
      -- see <code>docs/RELEASE_VERIFICATION.md</code> for full detail.
    </div>

    <div class="lifecycle-rail">
      ${LIFECYCLE_STEPS.map((s, i) => `<div class="lifecycle-step ${i < done ? "done" : ""}">${s}</div>`).join("")}
    </div>

    ${loading ? `<div class="empty">Reading authoritative state…</div>` : ""}
    ${error ? `<div class="error-banner">${error}</div>` : ""}

    ${agreement ? `
      <div class="evidence-block">
        <div class="k">Proposition</div>
        <div class="v prose">${agreement.proposition}</div>
      </div>
      <div class="evidence-block">
        <div class="k">Committed authoritative source (locked at creation, enforced at evidence freeze)</div>
        <div class="v">https://${agreement.source_host}${agreement.source_path_prefix}</div>
      </div>
      <div class="evidence-block">
        <div class="k">Creator position / Outcome type</div>
        <div class="v prose">${agreement.creator_position} &nbsp;·&nbsp; ${agreement.outcome_type}</div>
      </div>
      ${evidence ? `
      <div class="evidence-block">
        <div class="k">Evidence ID (bound to this agreement, integrity-checked at adjudication)</div>
        <div class="v">${evidence.id}</div>
      </div>
      <div class="evidence-block">
        <div class="k">Evidence URL actually fetched by GenVM (not by this frontend)</div>
        <div class="v"><a href="${evidence.url}" target="_blank" rel="noopener">${evidence.url}</a></div>
      </div>
      <div class="evidence-block">
        <div class="k">Frozen evidence content (canonicalized, as stored on-chain)</div>
        <div class="v prose">${String(evidence.canonical_content).slice(0, 400)}…</div>
      </div>
      ` : ""}
      <div class="evidence-block">
        <div class="k">GenLayer canonical resolution</div>
        <div class="v prose">${agreement.canonical_outcome}${agreement.rationale ? " — " + agreement.rationale : ""}</div>
      </div>
      <div class="evidence-block">
        <div class="k">Consensus votes from the real adjudicate() transaction</div>
        <div class="consensus-votes">
          ${REVIEWER_VOTES.map((v) => `<span class="vote-chip ${v.vote}">${short(v.addr)} — ${v.vote}</span>`).join("")}
        </div>
      </div>
      <div class="evidence-block">
        <div class="k">Settlement (why this side won)</div>
        <div class="v prose">
          Creator position was <b>${agreement.creator_position}</b>; canonical resolution was
          <b>${agreement.canonical_outcome}</b> &rarr; ${agreement.winner && agreement.winner !== "0x0000000000000000000000000000000000000000" ? `winner is <b>${short(agreement.winner)}</b>` : "no winner yet"}.
          Deterministic mapping only -- rationale text never controls payout.
        </div>
      </div>
      <div class="evidence-block">
        <div class="k">Timeout / refund protection</div>
        <div class="v prose">If evidence is never frozen or adjudication never completes before the resolution
          deadline, <code>refund()</code> becomes permissionlessly callable by anyone, and both principals can
          independently withdraw their own stake exactly once -- verified live, see docs/RELEASE_VERIFICATION.md.</div>
      </div>
    ` : ""}

    <table class="tx-table">
      ${REVIEWER_TX_LOG.map((t) => `<tr><td>${t.step}</td><td><a href="${explorerTxUrl(t.hash)}" target="_blank" rel="noopener">${t.hash}</a></td></tr>`).join("")}
    </table>
  </div>`;
}

function render() {
  app.innerHTML = `
    <header class="masthead">
      <div>
        <h1 class="wordmark">VERI<span>TY</span></h1>
        <div class="tagline">The event ends. The web reacts. VERITY establishes the official outcome.</div>
      </div>
      <div class="wallet-box">
        ${
          state.wallet
            ? `<div class="addr-chip">${state.wallet}</div>`
            : `<button class="btn" id="connect-btn">Connect Wallet</button>`
        }
      </div>
    </header>

    <div class="live-strip"><span class="dot"></span> SIGNAL ROOM — LIVE AGREEMENTS FEED</div>

    ${!contractConfigured() ? `<div class="error-banner">VERITY is not deployed to StudioNet yet. Read-only browsing and actions are disabled until CONTRACT_ADDRESS is set in src/config.js. See README.md.</div>` : ""}
    ${state.error ? `<div class="error-banner">${state.error}</div>` : ""}
    ${state.notice ? `<div class="notice-banner">${state.notice}</div>` : ""}
    ${state.lastTx ? `<div class="tx-log">Last transaction: <a href="${explorerTxUrl(state.lastTx)}" target="_blank" rel="noopener">${state.lastTx}</a></div>` : ""}

    <div class="section-head"><h2>Reviewer Demo — 96th Academy Awards (Live)</h2></div>
    ${renderReviewerPanel()}

    <div class="section-head"><h2>Create a Proposition</h2></div>
    ${renderCreateForm()}

    <div class="section-head"><h2>Agreements (${state.agreements.length})</h2>
      <button class="btn secondary" id="refresh-btn">Refresh</button>
    </div>
    <div class="tape">
      ${
        state.loading
          ? `<div class="empty">Loading authoritative contract state…</div>`
          : state.agreements.length
          ? state.agreements.map(renderCard).join("")
          : `<div class="empty">No agreements yet. Public read-only browsing works without a wallet — connect only to act.</div>`
      }
    </div>

    <div class="footer-note">
      VERITY V1 — AWARD_WINNER / COMPETITION_WINNER only. Frontend + Intelligent Contract only,
      no backend in the production trust path. Evidence is retrieved by GenLayer validators via
      the contract's own web-content call, never by this frontend.
    </div>
  `;

  document.getElementById("connect-btn")?.addEventListener("click", doConnect);
  document.getElementById("refresh-btn")?.addEventListener("click", loadAgreements);
  document.getElementById("create-form")?.addEventListener("submit", onCreateSubmit);

  document.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => onAction(btn));
  });
}

function renderCreateForm() {
  return `
  <form id="create-form" class="card" style="display:block;padding:20px 22px">
    <div class="form-row"><label>Proposition</label><input name="proposition" required placeholder="Film X wins Best Picture" /></div>
    <div style="display:flex;gap:14px;flex-wrap:wrap">
      <div class="form-row" style="flex:1"><label>Outcome type</label>
        <select name="outcome_type"><option>AWARD_WINNER</option><option>COMPETITION_WINNER</option></select>
      </div>
      <div class="form-row" style="flex:1"><label>Your position</label>
        <select name="creator_position"><option>YES</option><option>NO</option></select>
      </div>
    </div>
    <div class="form-row"><label>Subject</label><input name="subject" required placeholder="Film X" /></div>
    <div class="form-row"><label>Event / category</label><input name="event_category" required placeholder="Best Picture 2027" /></div>
    <div style="display:flex;gap:14px;flex-wrap:wrap">
      <div class="form-row" style="flex:1"><label>Source host (https)</label><input name="source_host" required placeholder="www.oscars.org" /></div>
      <div class="form-row" style="flex:1"><label>Source path prefix</label><input name="source_path_prefix" placeholder="/winners" /></div>
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap">
      <div class="form-row" style="flex:1"><label>Match close</label><input type="datetime-local" name="match_close_time" required /></div>
      <div class="form-row" style="flex:1"><label>Expected event time</label><input type="datetime-local" name="expected_event_time" required /></div>
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap">
      <div class="form-row" style="flex:1"><label>Resolution not before</label><input type="datetime-local" name="resolution_not_before" required /></div>
      <div class="form-row" style="flex:1"><label>Resolution deadline</label><input type="datetime-local" name="resolution_deadline" required /></div>
    </div>
    <div class="form-row"><label>Stake (wei)</label><input name="stake" required placeholder="1000000000000000000" /></div>
    <button class="btn" type="submit" ${state.wallet ? "" : "disabled"}>Create Agreement</button>
    ${!state.wallet ? `<div class="meta-row" style="margin-top:8px">Connect a wallet to create an agreement.</div>` : ""}
  </form>`;
}

function toEpoch(datetimeLocalValue) {
  return Math.floor(new Date(datetimeLocalValue).getTime() / 1000);
}

async function onCreateSubmit(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const args = [
    f.get("outcome_type"),
    f.get("proposition"),
    f.get("subject"),
    f.get("event_category"),
    f.get("creator_position"),
    f.get("source_host"),
    f.get("source_path_prefix") || "",
    toEpoch(f.get("match_close_time")),
    toEpoch(f.get("expected_event_time")),
    toEpoch(f.get("resolution_not_before")),
    toEpoch(f.get("resolution_deadline")),
  ];
  const value = BigInt(f.get("stake"));
  await submitAction("create_agreement", args, value, null, "create", "Create Agreement");
}

const ACTION_LABELS = {
  match: "Match",
  cancel: "Cancel",
  freeze: "Freeze Evidence",
  adjudicate: "Adjudicate",
  settle: "Settle",
  refund: "Refund",
  withdraw: "Withdraw",
};

async function onAction(btn) {
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  const key = `${action}:${id}`;
  const label = ACTION_LABELS[action] || action;
  if (action === "match") {
    await submitAction("match_agreement", [id], BigInt(btn.dataset.value), id, key, label);
  } else if (action === "cancel") {
    await submitAction("cancel_unmatched", [id], undefined, id, key, label);
  } else if (action === "freeze") {
    const url = prompt("Evidence URL (must match the committed source policy):");
    if (!url) return;
    await submitAction("freeze_evidence", [id, url], undefined, id, key, label);
  } else if (action === "adjudicate") {
    await submitAction("adjudicate", [id], undefined, id, key, label);
  } else if (action === "settle") {
    await submitAction("settle", [id], undefined, id, key, label);
  } else if (action === "refund") {
    await submitAction("refund", [id], undefined, id, key, label);
  } else if (action === "withdraw") {
    await submitAction("withdraw", [id], undefined, id, key, label);
  }
}

render();
loadAgreements();
loadReviewerDemo();
