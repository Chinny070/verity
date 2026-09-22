// VERITY frontend configuration.
//
// CONTRACT_ADDRESS is intentionally blank until the Intelligent Contract
// is actually deployed to StudioNet (see README.md "Remaining Human
// Action"). The app refuses to fabricate reads/writes against an unset
// address -- it shows an explicit "not deployed yet" state instead.
export const CONTRACT_ADDRESS = "";

// Chain preset name from genlayer-js/chains. StudioNet per product spec
// section 2/18 ("current StudioNet target").
export const CHAIN_NAME = "studionet";
