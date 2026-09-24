import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const smoke = await readFile(new URL('../tools/browser-smoke.mjs', import.meta.url), 'utf8');

test('browser smoke disables Chromium sandbox only for root or Linux GitHub Actions', () => {
  assert.match(smoke, /const runningInGithubActionsLinux = process\.platform === 'linux' && process\.env\.GITHUB_ACTIONS === 'true'/);
  assert.match(smoke, /process\.getuid\?\.\(\) === 0 \|\| runningInGithubActionsLinux/);
  assert.match(smoke, /browserArgs\.unshift\('--no-sandbox'\)/);
  assert.doesNotMatch(smoke, /browserArgs\s*=\s*\[[\s\S]*?'--no-sandbox'[\s\S]*?'about:blank'/);
});
