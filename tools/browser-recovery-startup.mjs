/**
 * Browser smoke startup gate. The editor publishes data-app-ready=true only
 * AFTER restoreRecoveryIfAvailable() has read IndexedDB and the user has
 * resolved any recovery decision. DOMContentLoaded is not that barrier.
 */
export async function settleBrowserRecoveryStartup(client, {
  evaluate, waitFor, assert, label = 'browser recovery startup',
} = {}) {
  const state = () => evaluate(client, `(() => {
    const modal = document.querySelector('#modalRoot .recovery-modal');
    return {
      ready: document.documentElement?.dataset.appReady || '',
      recovery: Boolean(modal),
      actionable: Boolean(modal?.querySelector('[data-new-project]')),
    };
  })()`);
  const phase = await waitFor(`${label} recovery decision or completed bootstrap`, async () => {
    const current = await state();
    if (current.ready === 'error') throw new Error(`${label}: application bootstrap failed`);
    if (current.recovery) return 'recovery';
    return current.ready === 'true' ? 'ready' : false;
  }, 15_000);

  if (phase === 'recovery') {
    // Do not discard or restore any recorded document, especially another
    // window's recovery key. Use exactly the app's public New Project action.
    const accepted = await evaluate(client, `(() => {
      const button = document.querySelector('#modalRoot .recovery-modal [data-new-project]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert(accepted, `${label}: recovery prompt disappeared before its public action`);
  }

  await waitFor(`${label} bootstrap completion`, async () => {
    const current = await state();
    if (current.ready === 'error') throw new Error(`${label}: application bootstrap failed`);
    return current.ready === 'true' && !current.recovery;
  }, 15_000);

  // "Start new project" creates the regular New Document draft. Cancel ONLY
  // that exact draft; any other dialog is a failure, not a blanket dismissal.
  const draft = await evaluate(client, `(() => {
    const dialog = document.querySelector('#modalRoot [role="dialog"]');
    if (!dialog) return 'none';
    if (dialog.getAttribute('aria-label') !== 'Новый документ') return 'unexpected';
    const cancel = dialog.querySelector('[data-cancel]');
    if (!cancel) return 'unexpected';
    cancel.click();
    return 'cancelled';
  })()`);
  assert(draft === 'none' || draft === 'cancelled',
    `${label}: unexpected modal left after recovery startup`, String(draft));
  await waitFor(`${label} unobstructed editor`, () => evaluate(client,
    "!document.querySelector('#modalRoot [role=dialog]')"), 10_000);
  return { recoveryPrompt:phase === 'recovery', draft };
}
