import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [index, manifestText, packageText, styles, bundle, buildScript] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('version.json', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
  readFile(new URL('src/styles.css', root), 'utf8'),
  readFile(new URL('src/app.bundle.js', root), 'utf8'),
  readFile(new URL('tools/build-bundle.mjs', root), 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const packageJson = JSON.parse(packageText);

function hashBuild(parts) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const step = value => {
    hash ^= BigInt(value & 0xff);
    hash = BigInt.asUintN(64, hash * prime);
    hash ^= BigInt((value >>> 8) & 0xff);
    hash = BigInt.asUintN(64, hash * prime);
  };
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) step(part.charCodeAt(i));
    step(0xffff);
  }
  return hash.toString(16).padStart(16, '0');
}

test('cache manifest matches the committed browser build', () => {
  assert.equal(manifest.version, packageJson.version);
  assert.match(manifest.build, /^[0-9a-f]{16}$/);
  assert.ok(index.includes(`<meta name="application-build" content="${manifest.build}" />`));
  const normalizedIndex = index.replace(/^  <meta name="application-build" content="[^"]*" \/>\r?\n/m, '');
  assert.equal(manifest.build, hashBuild([normalizedIndex, styles, bundle]));
});

test('hosted startup checks an uncached manifest and reloads stale HTML once', () => {
  assert.match(index, /new URL\('\.\/version\.json', location\.href\)/);
  assert.match(index, /manifestUrl\.searchParams\.set\('_', String\(Date\.now\(\)\)\)/);
  assert.match(index, /fetch\(manifestUrl, \{ cache: 'no-store', signal: controller\.signal \}\)/);
  assert.match(index, /pageUrl\.searchParams\.set\('zpe_build', remoteBuild\)/);
  assert.match(index, /location\.replace\(pageUrl\.href\)/);
  assert.match(index, /src\/styles\.css\?v=/);
  assert.match(index, /src\/app\.bundle\.js\?v=/);
});

test('file protocol keeps the direct local startup path', () => {
  assert.match(index, /location\.protocol === 'file:'/);
  assert.match(index, /loadApp\(currentBuild, false\)/);
  assert.match(index, /'\.\/src\/app\.bundle\.js'/);
});

test('the build script owns both bundle and version manifest generation', () => {
  assert.match(buildScript, /stampBuildMeta/);
  assert.match(buildScript, /hashBuild/);
  assert.match(buildScript, /writeFile\(resolve\(root, 'version\.json'\)/);
});
