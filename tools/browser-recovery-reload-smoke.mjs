import { settleBrowserRecoveryStartup } from './browser-recovery-startup.mjs';

/**
 * 035: Real file:// Chromium regression. Delay the *startup* IndexedDB open
 * success callback for longer than the obsolete 400ms recovery prompt probe,
 * but less than the production 750ms database timeout. Repeat on 3 fresh
 * execution contexts. No production code or persisted foreign records change.
 */
export async function verifyBrowserDelayedRecoveryReloads(client, {
  evaluate, waitFor, assert, recoveryStorageSource,
} = {}) {
  const key = 'workspace:zpe-smoke-035-delayed-recovery';
  const seedExpression = `(async () => {
    ${recoveryStorageSource}
    await saveRecoverySnapshot([{ docName:'035 delayed recovery',
      snapshot:JSON.stringify({name:'035 delayed recovery'}) }], {activeIndex:0},
      {key:${JSON.stringify(key)}});
    return (await loadRecoverySnapshots()).some(entry => entry.key === ${JSON.stringify(key)});
  })()`;
  assert(await evaluate(client, seedExpression),
    '035 must persist its own recovery entry before browser reload');

  // The hook only affects THIS ephemeral Chromium smoke profile. Delaying the
  // onsuccess handler preserves real IndexedDB transactions, modal rendering
  // and public recovery actions instead of synthesizing a fake DOM prompt.
  const script = `(() => {
    const open = IDBFactory.prototype.open;
    window.__zpe035IdbDelay = { observations:[] };
    IDBFactory.prototype.open = function(...args) {
      const request = Reflect.apply(open, this, args);
      if (args[0] !== 'zeter-photo-editor') return request;
      let successHandler = null;
      Object.defineProperty(request, 'onsuccess', {
        configurable:true,
        get() { return successHandler; },
        set(handler) {
          successHandler = handler;
          request.addEventListener('success', event => {
            const start = performance.now();
            setTimeout(() => {
              window.__zpe035IdbDelay.observations.push(performance.now() - start);
              if (typeof successHandler === 'function') successHandler.call(request, event);
            }, 550);
          }, {once:true});
        },
      });
      return request;
    };
  })();`;
  let identifier = null;
  try {
    ({ identifier } = await client.send('Page.addScriptToEvaluateOnNewDocument', { source:script }));
    assert(typeof identifier === 'string' && identifier.length > 0,
      '035 browser startup delay must be installed before reload');

    for (let iteration = 1; iteration <= 3; iteration++) {
      // Page.reload's CDP response is not a new-document ready barrier.
      await evaluate(client, 'window.__zpe035OldPage = true; true');
      await client.send('Page.reload', {ignoreCache:true});
      await waitFor(`035 reload ${iteration} new document`, () => evaluate(client,
        "document.readyState==='complete' && !window.__zpe035OldPage && !!document.querySelector('#fileInput')"), 15_000);

      const outcome = await settleBrowserRecoveryStartup(client, {
        evaluate, waitFor, assert, label:`035 delayed reload ${iteration}`,
      });
      assert(outcome.recoveryPrompt,
        `035 reload ${iteration} must resolve actual recovery dialog with New Project`);
      const evidence = await evaluate(client, 'window.__zpe035IdbDelay?.observations || []');
      assert(Array.isArray(evidence) && evidence.some(ms => ms >= 500),
        `035 reload ${iteration} must observe >=500ms genuine IndexedDB startup delay`,
        JSON.stringify(evidence));
    }
  } finally {
    if (identifier) await client.send('Page.removeScriptToEvaluateOnNewDocument', {identifier});
    // Only the entry created by this test is cleared. No other recovery key is
    // touched, and the public New Project action never deletes a snapshot.
    const clean = await evaluate(client, `(async () => {
      ${recoveryStorageSource}
      await clearRecoverySnapshot({key:${JSON.stringify(key)}});
      return !(await loadRecoverySnapshots()).some(entry => entry.key === ${JSON.stringify(key)});
    })()`);
    assert(clean, '035 must clean only its own recovery snapshot');
  }
}
