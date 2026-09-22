// Thin wrapper around genlayer-js so the rest of the app never talks to
// the SDK directly. No backend, no mock/scraper path: every read and
// write here goes straight to the real Intelligent Contract per the
// product spec's "no backend in the production trust path" requirement.
import { createClient } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { CONTRACT_ADDRESS, CHAIN_NAME } from "./config.js";

let readClient = null;
let writeClient = null;
let connectedAddress = null;

function getChain() {
  const chain = chains[CHAIN_NAME];
  if (!chain) {
    throw new Error(`Unknown chain preset "${CHAIN_NAME}" in genlayer-js/chains`);
  }
  return chain;
}

export function getReadClient() {
  if (!readClient) {
    readClient = createClient({ chain: getChain() });
  }
  return readClient;
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No browser wallet found (window.ethereum is undefined).");
  }
  const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
  writeClient = createClient({
    chain: getChain(),
    account: address,
    provider: window.ethereum,
  });
  if (typeof writeClient.connect === "function") {
    await writeClient.connect(CHAIN_NAME);
  }
  connectedAddress = address;
  return address;
}

export function getConnectedAddress() {
  return connectedAddress;
}

export function contractConfigured() {
  return Boolean(CONTRACT_ADDRESS);
}

export async function readContract(functionName, args = []) {
  if (!contractConfigured()) {
    throw new Error("VERITY contract address is not configured yet.");
  }
  const client = getReadClient();
  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
  });
}

// A "hash returned" is never treated as success on its own -- GenVM
// consensus can accept a transaction whose leader execution actually
// errored (e.g. a require()-style check failing inside the contract), or
// validators can fail to reach quorum. This mirrors the same check the
// Python test suite uses (gltest.assertions.tx_execution_succeeded):
// only a leader receipt with execution_result === "SUCCESS" counts.
export function txExecutionSucceeded(receipt) {
  const leaderReceipt = receipt?.consensus_data?.leader_receipt;
  if (!leaderReceipt) return false;
  const entries = Array.isArray(leaderReceipt) ? leaderReceipt : [leaderReceipt];
  const leaderEntry = entries.find((e) => e?.mode === "leader") || entries[0];
  return leaderEntry?.execution_result === "SUCCESS";
}

function leaderErrorMessage(receipt) {
  const leaderReceipt = receipt?.consensus_data?.leader_receipt;
  const entries = Array.isArray(leaderReceipt) ? leaderReceipt : [leaderReceipt].filter(Boolean);
  const leaderEntry = entries.find((e) => e?.mode === "leader") || entries[0];
  const stderr = leaderEntry?.genvm_result?.stderr || "";
  // The contract raises plain Python Exception/ValueError; surface just the
  // final line (the actual message) rather than the full traceback.
  const lines = stderr.trim().split("\n").filter(Boolean);
  const last = lines[lines.length - 1] || "";
  const match = last.match(/(?:Exception|ValueError|Error):\s*(.+)$/);
  return match ? match[1] : null;
}

// Writes: estimate fees, submit, then wait for the decision, then verify
// the leader's own execution actually succeeded, so the UI can re-read
// authoritative state before declaring success (spec section 18). Throws
// a VerityTxError with a friendly message on any failure mode instead of
// surfacing raw SDK/RPC errors as the primary UX.
export class VerityTxError extends Error {
  constructor(message, { kind, txId, receipt } = {}) {
    super(message);
    this.name = "VerityTxError";
    this.kind = kind || "unknown";
    this.txId = txId;
    this.receipt = receipt;
  }
}

export async function writeContract(functionName, args = [], value) {
  if (!writeClient) {
    throw new VerityTxError("Connect a wallet before submitting a transaction.", {
      kind: "no_wallet",
    });
  }
  if (!contractConfigured()) {
    throw new VerityTxError("VERITY contract address is not configured yet.", {
      kind: "not_configured",
    });
  }
  const call = {
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    ...(value !== undefined ? { value } : {}),
  };

  let txId;
  try {
    const estimate = await writeClient.estimateTransactionFeesForWrite(call);
    txId = await writeClient.writeContract({
      ...call,
      fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
    });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/user rejected|user denied|denied transaction/i.test(msg)) {
      throw new VerityTxError("Wallet action was rejected.", { kind: "wallet_rejected" });
    }
    throw new VerityTxError(
      "Could not submit the transaction (network or wallet error).",
      { kind: "submit_failed" }
    );
  }

  let receipt;
  try {
    receipt = await writeClient.waitForTransactionReceipt({
      hash: txId,
      status: "ACCEPTED",
    });
  } catch (err) {
    // Either genuinely still pending/timed out, or consensus never
    // finalized (e.g. validators failed to reach quorum).
    throw new VerityTxError(
      "The transaction did not reach a decision in time. It may still finalize -- check again shortly, or view it on the StudioNet explorer.",
      { kind: "delayed_or_inconclusive", txId }
    );
  }

  if (!txExecutionSucceeded(receipt)) {
    const detail = leaderErrorMessage(receipt);
    throw new VerityTxError(detail || "The transaction was rejected by the contract.", {
      kind: "execution_failed",
      txId,
      receipt,
    });
  }

  return { txId, receipt };
}
