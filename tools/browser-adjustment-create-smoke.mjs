// Focused production file:// Chrome test for selectable, editable Adjustment layers.
process.env.ZPE_ADJUSTMENT_CREATE_BROWSER_ONLY = '1';
await import('./browser-smoke.mjs');
