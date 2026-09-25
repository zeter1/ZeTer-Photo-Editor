import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [packageText,readme,index,changelog,main]=await Promise.all([
  readFile(new URL('package.json',root),'utf8'),
  readFile(new URL('README.md',root),'utf8'),
  readFile(new URL('index.html',root),'utf8'),
  readFile(new URL('CHANGELOG.md',root),'utf8'),
  readFile(new URL('src/main.js',root),'utf8'),
]);
const version=JSON.parse(packageText).version;

test('public current-version markers stay aligned with package.json',()=>{
  assert.match(version,/^[0-9]+\.[0-9]+\.[0-9]+$/);
  assert.match(readme,/^## Возможности$/m);
  const capabilityVersions=[...readme.matchAll(/^\*\*Текущая версия:\*\* ([0-9]+\.[0-9]+\.[0-9]+)$/gm)].map(match=>match[1]);
  assert.deepEqual(capabilityVersions,[version]);
  const startupVersions=[...readme.matchAll(/Версия ([0-9]+\.[0-9]+\.[0-9]+) специально собрана/g)].map(match=>match[1]);
  assert.deepEqual(startupVersions,[version]);
  assert.ok(index.includes(`<meta name="application-version" content="${version}" />`));
  assert.ok(changelog.includes(`## ${version} —`));
  assert.ok(main.includes("meta[name=\"application-version\"]"));
  assert.ok(main.includes('ZeTer Photo Editor ${escapeHtml(currentAppVersion())}'));
  assert.doesNotMatch(main,/ZeTer Photo Editor [0-9]+\.[0-9]+\.[0-9]+/);
});
