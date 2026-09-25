# Stage 14a — Photoshop Smart Object fixture

`psd-tools-smartobject-layer.psd` — реальный внешний PSD fixture из `psd-tools/psd-tools`, pinned на commit `8f9a25ea98202061365701db54ce938931b27c09`.

Он содержит Photoshop Smart Object layer с `PlLd` + `SoLd` Additional Layer Info и document-level `lnk2` / `lnkE` linked-layer resources. ZeTer Photo Editor использует его для проверки opaque non-destructive metadata round-trip в PSD и PSB.

- upstream Git blob: `b37b63466ecee1586b5d917e0b40fbf236b0e65d`
- size: 26,144 bytes
- SHA-256: `f451b816bb5292564eaad9a29eb7543c3b2ad6b5dc35d1babc0a4c799502ee01`
- license: MIT; полный notice лежит рядом в `LICENSE-psd-tools-MIT.txt`.

Fixture bytes не генерируются кодом ZPE и не скачиваются в CI.
