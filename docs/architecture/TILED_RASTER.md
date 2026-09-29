# Tiled high-depth raster source — Stage 17c

Stage 17c продолжает Stage 17a/17b: большие native RGB/CMYK 8/16/32-bit PixelBuffer sources остаются backward-compatible tiled persistence, а interactive Brush/Eraser больше не обязаны собирать весь v2 source в один contiguous typed array на старте штриха.

## Владельцы

- `src/core/pixel-buffer.js`: v1/v2 source format, strict grid validation, per-tile encode/decode, adaptive serialization, one-shot `mutateSerializedPixelBufferTiles()` и stroke-scoped `createSerializedPixelBufferTileWorkingSet()`.
- `src/core/render.js`: RGB v2 document preview декодирует по одному tile; `OffscreenCanvas` используется как staging surface, когда доступен.
- `src/painting/controller.js`: exact-owner native paint cache, tile working set, dirty-tile live preview, persistence и Canvas8 compatibility boundary.
- `src/painting/gesture-controller.js`: Brush/Eraser opt-in в tiled working set; retouch tools пока намеренно запрашивают contiguous native buffer.
- `src/painting/command-controller.js`: Line/current-layer Clear используют one-shot tiled mutation bridge.
- `src/selection/raster-mutation-controller.js`: merged visible-layer clear готовит tiled mutations до общей atomic publication.
- `src/document/psd-import-controller.js`: после decode sources от 8 MiB сохраняются как v2 tiles.

## V2 storage contract

`kind = zpe-pixel-buffer-source-v2`; row-major grid; default tile 256×256; edge tiles имеют реальный меньший размер. Каждый tile хранит bounded base64 payload. Grid полон и упорядочен; сумма `tile.rawBytes` равна `source.rawBytes`. Действуют 48 MiB precision budget и лимит 8192 tiles. Legacy v1 остаётся читаемым.

## Interactive Brush/Eraser working set

При начале native Brush/Eraser по v2 source controller:
1. валидирует exact owner/layer и общий high-depth byte budget;
2. создаёт пустой stroke working set без full-plane decode;
3. строит display canvas последовательным decode→tone-map→putImageData по одному source tile;
4. при dab/segment вычисляет bounding box кисти и загружает только пересекающиеся tiles;
5. держит touched tiles в памяти до конца текущего stroke и отмечает отдельно dirty + preview-dirty tiles;
6. live preview обновляет только preview-dirty tiles;
7. при commit сериализует dirty tiles, сохраняя untouched payloads byte-for-byte, затем повторно проверяет exact owner/target перед publication.

Это stroke-scoped cache, а не disk-backed virtual memory. Очень длинный штрих, который касается всего изображения, всё ещё может постепенно загрузить все tiles; важное отличие — full high-depth plane больше не создаётся заранее и локальные штрихи масштабируются по touched area.

Eraser с source без alpha логически повышает RGB→RGBA / CMYK→CMYKA. Touched tiles получают alpha при загрузке; на commit остальные tiles последовательно decode→alpha→encode без одновременного full-plane buffer. Если общий byte budget после добавления alpha превышен, stroke не стартует.

## Preview contract

Full RGBA8 display canvas пока остаётся нужен браузерному compositor. Он не является canonical precision source. During stroke layer filters применяются в tile preview и renderer получает `skipAdjustments`, чтобы не применять их дважды. Persisted `layer.dataUrl` перестраивается из canonical tiled source без layer filters, как и на старом contiguous high-depth path.

## Оставшиеся contiguous boundaries

- PSD/PSB binary decoder materializes bounded channel planes до tiled handoff.
- Flood Fill и Content-Aware Fill требуют cross-tile/global neighborhood semantics.
- Clone/Heal/Blur/Smudge/Dodge/Burn пока используют contiguous stroke buffer; clone additionally требует immutable full-source snapshot.
- Часть export/color-management paths материализует contiguous PixelBuffer.
- Canvas compositor требует full RGBA8 display surface.
- Нет IndexedDB/file-backed eviction store, worker-owned editing tiles, GPU renderer или RAW/DNG decode.

Следующая безопасная проходка: перенести neighborhood retouch на halo tiles + immutable tile snapshots, затем workerize дорогие tile jobs. После этого — cross-tile flood/inpaint и lazy backing store; только затем имеет смысл пересматривать 512 MiB PSD/PSB input gate.

## Проверка

- `tests/tiled-raster-source.test.mjs`: storage/mutation/working-set lazy-load и alpha promotion.
- `tests/painting-controller.test.mjs`: exact-owner native paint, tiled Brush persistence и untouched tile identity.
- `tests/high-depth-editing.test.mjs`: architectural routing guards.
- полный gate: `npm run check`, generated bundle diff и `npm run test:browser` через CI.
