# Stage 15d — Photoshop Gradient / Pattern Fill foundation

Эта папка содержит реальные внешние MIT fixtures из `psd-tools/psd-tools`, pinned на commit `8f9a25ea98202061365701db54ce938931b27c09`.

- `psd-tools-gradient-fill.psd` — zero-bounds Photoshop Gradient Fill layer с `GdFl`: linear 90°, Custom Stops, красные color stops и transparency 100→0.
- `psd-tools-pattern-fill.psd` — zero-bounds Photoshop Pattern Fill layer с `PtFl`: pattern id `cf324614-b915-11d7-b003-ad2608ed939e`.

Stage 15d не притворяется полноценным editable gradient/pattern renderer. Adapter bounded-разбирает metadata в `fillLayers`, сохраняет raw blocks и оставляет canvas на composite preview. Это foundation для следующего semantic renderer/writer этапа.

Полный MIT notice сохранён рядом в `LICENSE-psd-tools-MIT.txt`. CI не скачивает fixtures из сети.
