# Stage 14a — Photoshop Smart Object fixture

`psd-tools-smartobject-layer.psd` — реальный внешний PSD fixture из `psd-tools/psd-tools`, pinned на commit `8f9a25ea98202061365701db54ce938931b27c09`.

Он содержит Photoshop Smart Object layer с `PlLd` + `SoLd` Additional Layer Info и document-level `lnk2` / `lnkE` linked-layer resources. ZeTer Photo Editor использует его для проверки opaque non-destructive metadata round-trip в PSD и PSB.

- upstream Git blob: `b37b63466ecee1586b5d917e0b40fbf236b0e65d`
- size: 26,144 bytes
- SHA-256: `f451b816bb5292564eaad9a29eb7543c3b2ad6b5dc35d1babc0a4c799502ee01`
- license: MIT; полный notice лежит рядом в `LICENSE-psd-tools-MIT.txt`.

Fixture bytes не генерируются кодом ZPE и не скачиваются в CI.

## Stage 14b typed linked-layer fixture

`psd-tools-placedLayer.psd` из того же pinned upstream commit содержит одновременно embedded PNG (`liFD`) и external linked PNG/PSD (`liFE`) Smart Objects. Regression проверяет typed Linked Layer parser, UUID matching, filename/filetype, embedded payload bytes и то, что external paths никогда не читаются с файловой системы автоматически.

- upstream Git blob: `707df934bb10bbcbb699c46d4bcde5580e48c036`
- size: 114,796 bytes
- SHA-256: `69ea01bf88cb85c48d3a78c3bb9e06ae141c9c9fc6a88267eae95c315e16180e`

