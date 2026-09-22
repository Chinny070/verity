// VERITY frontend configuration.
//
// CONTRACT_ADDRESS points at the user's own final StudioNet deployment,
// deployed via a connected browser wallet per docs/MANUAL_DEPLOYMENT.md.
// Verified against the frozen release candidate before this was set:
// schema (`genlayer schema`) matched exactly, and the deployed source
// (`genlayer code`) hashes to the same frozen SHA-256
// 0d02adac2b5ea52a637c6b09dfdc65fd0388b8144da5e3ac97e6bf7b70ff6f6e --
// see docs/FINAL_DEPLOYMENT_RECORD.md for the full record.
export const CONTRACT_ADDRESS = "0xAAc022f491ADE6b09637427Bb9d8B4BaF85d718D";

// Chain preset name from genlayer-js/chains. StudioNet per product spec
// section 2/18 ("current StudioNet target").
export const CHAIN_NAME = "studionet";

// StudioNet block explorer, used to link out to real transactions/
// addresses so a reviewer can independently verify everything shown here.
export const EXPLORER_URL = "https://genlayer-explorer.vercel.app";

// The reviewer/demo agreement id on the deployed contract above -- the
// real, live-run 96th Academy Awards Best Picture example recorded in
// docs/RELEASE_VERIFICATION.md. Used by the reviewer walkthrough section.
export const REVIEWER_DEMO_AGREEMENT_ID = 1;
