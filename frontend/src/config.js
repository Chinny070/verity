// VERITY frontend configuration.
//
// CONTRACT_ADDRESS points at the frozen, verified StudioNet reference
// deployment (see docs/RELEASE_VERIFICATION.md for the exact source
// SHA-256, git commit, and every real transaction hash of the full
// hosted lifecycle -- CREATE/MATCH/FREEZE/ADJUDICATE/SETTLE/WITHDRAW --
// that was run live against this exact contract instance).
export const CONTRACT_ADDRESS = "0xd0E0ccd9Fd5BB364A439332EFdf397FA74004655";

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
