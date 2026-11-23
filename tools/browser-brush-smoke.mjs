// Isolated real Chromium fill -> brush -> commit regression.
process.env.ZPE_BRUSH_BROWSER_ONLY='1';
await import('./browser-smoke.mjs');
