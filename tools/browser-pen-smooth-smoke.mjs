// Run the dedicated CAP-BEZ real Chromium file:// gesture/save/reopen regression.
// Set the mode before importing the shared browser harness.
process.env.ZPE_PEN_SMOOTH_BROWSER_ONLY = '1';
await import('./browser-smoke.mjs');
