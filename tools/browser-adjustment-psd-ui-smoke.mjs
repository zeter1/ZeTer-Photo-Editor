// Focused production file:// Chrome PSD/PSB adjustment UI import/export regression.
process.env.ZPE_ADJUSTMENT_PSD_UI_BROWSER_ONLY = '1';
await import('./browser-smoke.mjs');
