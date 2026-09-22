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

// Writes: estimate fees, submit, then wait for the decision so the UI can
// re-read authoritative state before declaring success (spec section 18).
export async function writeContract(functionName, args = [], value) {
  if (!writeClient) {
    throw new Error("Connect a wallet before submitting a transaction.");
  }
  if (!contractConfigured()) {
    throw new Error("VERITY contract address is not configured yet.");
  }
  const call = {
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    ...(value !== undefined ? { value } : {}),
  };
  const estimate = await writeClient.estimateTransactionFeesForWrite(call);
  const txId = await writeClient.writeContract({
    ...call,
    fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
  });
  const receipt = await writeClient.waitForTransactionReceipt({
    hash: txId,
    status: "ACCEPTED",
  });
  return { txId, receipt };
}
