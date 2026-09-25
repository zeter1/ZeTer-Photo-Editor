# Stage 15c — Photoshop Shape / Vector Fill fixture

`psd-tools-shape-layer.psd` — внешний MIT fixture из `psd-tools/psd-tools`, pinned на commit `8f9a25ea98202061365701db54ce938931b27c09`.

Fixture содержит настоящий Photoshop Shape Layer:
- solid fill metadata в `vscg` с subtype `SoCo`;
- native vector mask `vsms`;
- stroke descriptor `vstk`;
- polygon path из 5 corner anchors.

Reference semantics:
- fill: `#00ffff`;
- stroke: `#ff00ff`;
- stroke width: 1 px;
- fill/stroke enabled;
- vector path: один closed/add subpath.

Stage 15c использует fixture для проверки typed solid-fill/stroke decode, native vector-mask rewrite и byte-for-byte сохранения opaque `vscg/vstk` descriptor blocks через PSD и PSB writer.

- upstream Git blob: `5d5b2023d85ddfbad624f30e6406e78788795fca`
- size: 25,391 bytes
- SHA-256: `23b3cc8dfcaca161443ab7345e49fdcd5494ceb864c16221b61ad99473a53830`
- license: MIT; notice лежит рядом в `LICENSE-psd-tools-MIT.txt`.

Fixture не генерируется кодом ZPE и не скачивается в CI.
