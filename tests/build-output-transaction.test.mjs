import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishBuildArtifacts } from '../tools/build-output-transaction.mjs';

async function makeFixture(t) {
  const root = await fs.mkdtemp(join(tmpdir(), 'zpe-build-output-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = ['src/app.bundle.js', 'index.html', 'version.json'];
  await fs.mkdir(join(root, 'src'));
  const paths = files.map(file => join(root, file));
  for (let i = 0; i < paths.length; i += 1) await fs.writeFile(paths[i], `previous-${i}`);
  return {
    root,
    paths,
    artifacts: paths.map((path, index) => ({ path, content: `new-${index}` })),
  };
}

async function assertContents(paths, prefix) {
  assert.deepEqual(await Promise.all(paths.map(path => fs.readFile(path, 'utf8'))),
    paths.map((_, index) => `${prefix}-${index}`));
}

test('successful build publication replaces all three artifacts and cleans staging', async t => {
  const { root, paths, artifacts } = await makeFixture(t);
  await publishBuildArtifacts(artifacts);
  await assertContents(paths, 'new');
  assert.deepEqual((await fs.readdir(root)).filter(name => name.includes('-build-')), []);
  assert.deepEqual((await fs.readdir(join(root, 'src'))).filter(name => name.includes('-build-')), []);
});

test('failed staging leaves all previously generated artifacts unchanged', async t => {
  const { root, paths, artifacts } = await makeFixture(t);
  const failingFs = {
    ...fs,
    writeFile: async (path, ...args) => {
      if (String(path).includes('.index.html-build-')) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
      return fs.writeFile(path, ...args);
    },
  };
  await assert.rejects(publishBuildArtifacts(artifacts, failingFs), { code: 'ENOSPC' });
  await assertContents(paths, 'previous');
  assert.deepEqual((await fs.readdir(root)).filter(name => name.includes('-build-')), []);
});

test('failed final rename restores earlier published artifacts and removes new ones', async t => {
  const { paths, artifacts } = await makeFixture(t);
  await fs.rm(paths[0]); // A first-time artifact must not survive a failed build.
  const failingFs = {
    ...fs,
    rename: async (from, to) => {
      if (to === paths[2] && String(from).endsWith('/next')) {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      }
      return fs.rename(from, to);
    },
  };
  await assert.rejects(publishBuildArtifacts(artifacts, failingFs), { code: 'EACCES' });
  await assert.rejects(fs.stat(paths[0]), { code: 'ENOENT' });
  assert.equal(await fs.readFile(paths[1], 'utf8'), 'previous-1');
  assert.equal(await fs.readFile(paths[2], 'utf8'), 'previous-2');
});

test('a failed rollback retains the backup instead of deleting the only previous copy', async t => {
  const { root, paths, artifacts } = await makeFixture(t);
  const failingFs = {
    ...fs,
    rename: async (from, to) => {
      if (to === paths[2] && String(from).endsWith('/next')) throw new Error('publish failure');
      if (to === paths[0] && String(from).endsWith('/previous')) throw new Error('rollback failure');
      return fs.rename(from, to);
    },
  };
  await assert.rejects(publishBuildArtifacts(artifacts, failingFs), AggregateError);
  const entries = await fs.readdir(join(root, 'src'));
  const retained = entries.find(name => name.startsWith('.app.bundle.js-build-'));
  assert.ok(retained, 'backups must survive a rollback failure');
  assert.equal(await fs.readFile(join(root, 'src', retained, 'previous'), 'utf8'), 'previous-0');
});
