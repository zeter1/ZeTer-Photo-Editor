# Stage 15a — Photoshop Type Layer fixture

`psd-tools-type-layer.psd` — внешний MIT fixture из `psd-tools/psd-tools`, pinned на commit `8f9a25ea98202061365701db54ce938931b27c09`.

Fixture содержит настоящий Photoshop Type Layer с `TySh` TypeToolObjectSetting. Regression проверяет:
- text value `A`;
- affine transform `(1, 0, 0, 1, 0, 4.978787...)`;
- horizontal orientation / anti-alias descriptor metadata;
- native `TySh` preservation through PSD and PSB writer;
- bounded transform rewrite для перемещения слоя без растрирования semantic metadata.

- upstream Git blob: `d920df70baf977c2fc04d5e47147ef831d5c53e6`
- size: 43,944 bytes
- SHA-256: `b24e6f4c7277dd499ebb20c88ac06698f4563e75bfeb6aa6cb0d2466140fd81f`
- license: MIT; notice лежит рядом в `LICENSE-psd-tools-MIT.txt`.

Fixture не генерируется кодом ZPE и не скачивается в CI.
