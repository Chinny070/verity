import "./style.css";
import {
  connectWallet,
  getConnectedAddress,
  contractConfigured,
  readContract,
  writeContract,
} from "./genlayerClient.js";

const app = document.getElementById("app");

const state = {
  wallet: null,
  agreements: [],
  loading: false,
  error: null,
  lastTx: null,
};

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

async function submitAction(fn, args, value, agreementId) {
  state.error = null;
  state.lastTx = null;
  render();
  try {
    const { txId } = await writeContract(fn, args, value);
    state.lastTx = txId;
    // Re-read authoritative contract state after the write before
    // presenting anything as final (spec section 18 / build brief).
    if (agreementId) {
      const fresh = await readContract("get_agreement", [agreementId]);
      const idx = state.agreements.findIndex((a) => a.id === agreementId);
      if (idx >= 0) state.agreements[idx] = fresh;
      else await loadAgreements();
    } else {
      await loadAgreements();
    }
  } catch (err) {
    state.error = err.message || String(err);
  }
  render();
}

function waveform() {
  const bars = Array.from({ length: 14 }, () => 4 + Math.round(Math.random() * 18));
  return `<div class="waveform">${bars.map((h) => `<i style="height:${h}px"></i>`).join("")}</div>`;
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
        ${canMatch ? `<button class="btn" data-action="match" data-id="${a.id}" data-value="${a.stake}">Match</button>` : ""}
        ${a.status === "CREATED" ? `<button class="btn secondary" data-action="cancel" data-id="${a.id}">Cancel (creator)</button>` : ""}
        ${canFreeze ? `<button class="btn secondary" data-action="freeze" data-id="${a.id}">Freeze Evidence</button>` : ""}
        ${canAdjudicate ? `<button class="btn secondary" data-action="adjudicate" data-id="${a.id}">Adjudicate</button>` : ""}
        ${canSettle ? `<button class="btn" data-action="settle" data-id="${a.id}">Settle</button>` : ""}
        ${canRefund ? `<button class="btn coral" data-action="refund" data-id="${a.id}">Refund</button>` : ""}
        ${canWithdraw ? `<button class="btn" data-action="withdraw" data-id="${a.id}">Withdraw</button>` : ""}
      </div>
    </div>
    <div class="card-side">
      ${stampClass !== null ? `<div class="stamp ${stampClass || ""}">${outcomeLabel}</div>` : `<div class="stamp" style="border-color:var(--silver-static);color:var(--silver-static)">${outcomeLabel}</div>`}
      ${waveform()}
      <div class="meta-row" style="margin:0">Resolution deadline<br/><b style="color:var(--broadcast-ivory)">${new Date(Number(a.resolution_deadline) * 1000).toLocaleString()}</b></div>
    </div>
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
    ${state.lastTx ? `<div class="tx-log">Last transaction: ${state.lastTx}</div>` : ""}

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
  await submitAction("create_agreement", args, value, null);
}

async function onAction(btn) {
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === "match") {
    await submitAction("match_agreement", [id], BigInt(btn.dataset.value), id);
  } else if (action === "cancel") {
    await submitAction("cancel_unmatched", [id], undefined, id);
  } else if (action === "freeze") {
    const url = prompt("Evidence URL (must match the committed source policy):");
    if (!url) return;
    await submitAction("freeze_evidence", [id, url], undefined, id);
  } else if (action === "adjudicate") {
    await submitAction("adjudicate", [id], undefined, id);
  } else if (action === "settle") {
    await submitAction("settle", [id], undefined, id);
  } else if (action === "refund") {
    await submitAction("refund", [id], undefined, id);
  } else if (action === "withdraw") {
    await submitAction("withdraw", [id], undefined, id);
  }
}

render();
loadAgreements();
