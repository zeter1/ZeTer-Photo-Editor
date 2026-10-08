// A signal being sent (ChildProcess.killed) is not proof that the process exited.
export async function stopBrowserProcess(browser, graceMs = 2_000) {
  const hasExited = () => browser.exitCode !== null || browser.signalCode !== null;
  if (hasExited()) return;

  await new Promise(resolve => {
    let graceTimer;
    let forceTimer;
    const onExit = () => {
      clearTimeout(graceTimer);
      clearTimeout(forceTimer);
      browser.off('exit', onExit);
      resolve();
    };

    browser.once('exit', onExit);
    graceTimer = setTimeout(() => {
      if (!hasExited()) browser.kill('SIGKILL');
      // Bound shutdown even if the child never emits exit after SIGKILL.
      forceTimer = setTimeout(onExit, graceMs);
    }, graceMs);
    if (!browser.killed) browser.kill('SIGTERM');
  });
}
