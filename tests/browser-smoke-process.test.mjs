import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { stopBrowserProcess } from '../tools/browser-smoke-process.mjs';

class FakeBrowser extends EventEmitter {
  constructor({ ignoresTerm = false, ignoresKill = false } = {}) {
    super();
    this.ignoresTerm = ignoresTerm;
    this.ignoresKill = ignoresKill;
    this.exitCode = null;
    this.signalCode = null;
    this.killed = false;
    this.signals = [];
  }

  kill(signal) {
    this.signals.push(signal);
    this.killed = true; // Node sets this on successful signal delivery, not on exit.
    if ((signal === 'SIGTERM' && !this.ignoresTerm) ||
        (signal === 'SIGKILL' && !this.ignoresKill)) {
      queueMicrotask(() => {
        this.signalCode = signal;
        this.emit('exit', null, signal);
      });
    }
    return true;
  }
}

test('browser smoke shutdown stops after a graceful SIGTERM exit', async () => {
  const browser = new FakeBrowser();
  await stopBrowserProcess(browser, 5);
  assert.deepEqual(browser.signals, ['SIGTERM']);
  assert.equal(browser.listenerCount('exit'), 0);
});

test('browser smoke escalates to SIGKILL when SIGTERM was sent but process is still alive', async () => {
  const browser = new FakeBrowser({ ignoresTerm:true });
  await stopBrowserProcess(browser, 5);
  assert.deepEqual(browser.signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(browser.signalCode, 'SIGKILL');
  assert.equal(browser.listenerCount('exit'), 0);
});

test('browser smoke can escalate an already-signalled, still-running process', async () => {
  const browser = new FakeBrowser({ ignoresTerm:true });
  browser.killed = true;
  await stopBrowserProcess(browser, 5);
  assert.deepEqual(browser.signals, ['SIGKILL']);
  assert.equal(browser.signalCode, 'SIGKILL');
});

test('browser smoke shutdown is bounded if the child never emits exit', async () => {
  const browser = new FakeBrowser({ ignoresTerm:true, ignoresKill:true });
  await stopBrowserProcess(browser, 5);
  assert.deepEqual(browser.signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(browser.listenerCount('exit'), 0);
});

test('browser smoke shutdown does not signal a process that has exited', async () => {
  const browser = new FakeBrowser();
  browser.exitCode = 0;
  await stopBrowserProcess(browser, 5);
  assert.deepEqual(browser.signals, []);
});
