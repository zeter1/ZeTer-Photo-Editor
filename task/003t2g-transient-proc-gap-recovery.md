# 003T/2g — transient Linux /proc gap recovery in Chromium operation samples

**Priority:** P1. **Status:** TODO. **Parent:** [003T](003t-operation-memory-evidence.md); Stage [003](003-tiled-content-aware.md).
**Dependencies:** [003T/2f-2 DONE](003t2f-2-operation-incarnation-windows.md), [003T/2e](003t2e-milestone-window-audit.md), [003T/2f](003t2f-pid-window-control.md).

## Confirmed motivation

During real Chromium `file://` CI, a short-lived CDP-reported PID could disappear before the second `/proc/<pid>/stat` read: an `ENOENT` occurred after earlier Linux incarnation samples. The current `tools/browser-renderer-heap-sampler.mjs` caches `rssUnavailableReason` after such a failure and does not attempt later `/proc` reads, even when subsequent complete CDP membership snapshots may be available. In genuine 003T/2f-2 profiles, this legitimately produced many **unknown** later PID/starttime windows, not evidence that every later observation was impossible. See prior [CI #39297491415](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39297491415) and accepted [#39298148195](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39298148195). Treat this as an observability and safe-retry task, not a memory-peak task.

## Goal

Distinguish transient missing `/proc` files caused by process churn from persistent Linux unsupported/permission failures. Permit subsequent *fresh*, bounded, individually verified PID/starttime RSS snapshots where safe, while preserving explicit missing-window gaps and **never** reusing old PID values or claiming continuity, Worker→PID identity or process exit.

## Definition of done

- [ ] Inspect current sampler and negative tests: distinguish transient ENOENT from permanent capability/permission failure with conservative error handling and bounded work.
- [ ] For a transient missing member, reject the entire current aggregate, record that read as unknown, and clear the tracker adjacency; never sum a partial census or carry last-known incarnation forward.
- [ ] On a later valid CDP census, permit a new independent Linux starttime-before/status/starttime-after snapshot; do not report arrivals, departures, or PID reuse across the unobserved interval as continuous transitions.
- [ ] Add deterministic tests for ENOENT then independently successful read, persistent EACCES/unsupported, PID reuse, mismatched /proc starttime and dropped/duplicate CDP list; keep all unsupported Worker PID / peak claims rejected.
- [ ] Exercise genuine Linux Chromium `file://` PSD16 and PSB32 operations; inspect saved JSON and unchanged native bytes; pass full PR CI, merge, exact-main CI, and update `task/NEXT.md`/README.

## Scope and limits

No production editor code change unless a real defect is found. No new dependencies, no file-server requirement, no assumed privileged cgroup. Even successful separate PID snapshots cannot establish uninterrupted membership or an operation-exclusive peak. Independent Photoshop-authored PSB32 acceptance [002B/2c](002b2c-photoshop-psb32-provenance.md) remains BLOCKED by unavailable licensed reference.

**Next concrete action:** write a focused regression reproducing stale `rssUnavailableReason` after a transient ENOENT, then implement fail-closed safe re-observation and run in real Chromium `file://`.
