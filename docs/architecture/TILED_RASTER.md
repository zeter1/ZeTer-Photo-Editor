# Tiled high-depth raster source — Stage 17b

Stage 17b продолжает Stage 17a: большие native RGB/CMYK 8/16/32-bit PixelBuffer sources остаются backward-compatible tiled persistence, а безопасные локальные destructive-команды больше не обязаны собирать весь v2 source в один contiguous typed array.

## Владельцы

- `src/core/pixel-buffer.js`: v1/v2 source format, strict grid validation, per-tile little-endian encode/decode, adaptive serialization, compatibility materialization и bounded `mutateSerializedPixelBufferTiles()`.
- `src/core/render.js`: RGB v2 preview декодирует по одному tile; `OffscreenCanvas` — staging surface, когда доступен.
- `src/painting/controller.js`: exact-owner tiled mutation preparation/publication, per-tile display-preview rebuild и contiguous fallback только для ещё не tile-local операций.
- `src/painting/command-controller.js`: raster line и current-layer selection clear используют tile mutation bridge.
- `src/selection/raster-mutation-controller.js`: merged visible-layer selection clear готовит tiled mutations до общей atomic publication.
- `src/document/psd-import-controller.js`: после decode sources от 8 MiB сохраняются как v2 tiles.

## Контракт v2

`kind = zpe-pixel-buffer-source-v2`; row-major grid; default tile 256×256; edge tiles имеют реальный меньший размер. Каждый tile хранит bounded base64 payload. Grid полон и упорядочен; сумма `tile.rawBytes` равна `source.rawBytes`. Действуют 48 MiB precision budget и лимит 8192 tiles. Legacy v1 остаётся читаемым.

## Render memory contract

Renderer делает sanitize → display surface → decode одного tile → native tone-map/color pipeline → `putImageData` → следующий tile. Для v2 preview не создаётся второй full 16/32-bit plane. Callers, которым нужен mutable contiguous buffer, используют `deserializePixelBufferSource()` только на явной compatibility boundary.

## Tile-local mutation contract

`mutateSerializedPixelBufferTiles()` fail-closed валидирует source, затем держит в памяти один decoded tile. Visitor получает локальный PixelBuffer и global `x/y` origin и возвращает неотрицательное целое число изменений. Tile с нулевым change count сохраняет исходный `dataUrl` byte-for-byte. RGB/CMYK без alpha может расширяться до straight alpha по tile без full-plane materialization; новый byte budget проверяется до publication.

Publication двухфазная: изменённые tile payloads и RGBA8 display preview готовятся вне document state, затем exact document/layer ownership проверяется повторно. Batch clear сохраняет all-or-nothing publication. Нулевой high-depth clear считается обработанным no-op и не проваливается в Canvas8.

Stage 17b переводит на этот путь:
- raster Line по native tiled RGB/CMYK;
- Clear Selection текущего raster layer;
- merged clear/cut по видимым слоям;
- full fallback reserialization теперь adaptive, поэтому большой source не обязан деградировать обратно в v1.

## Оставшиеся materialization boundaries

- PSD/PSB decoder пока materializes bounded channel planes до tiled handoff.
- Flood Fill и Content-Aware Fill требуют cross-tile/global neighborhood semantics и пока используют contiguous PixelBuffer.
- Brush/Eraser и retouch stroke cache пока держат contiguous working PixelBuffer на время stroke.
- Часть export/color-management paths материализует contiguous PixelBuffer.
- Canvas compositor всё ещё требует display surface размером документа.
- Нет eviction-backed store, IndexedDB paging, worker-owned editing tiles, GPU renderer или RAW/DNG decode.

Следующий безопасный шаг: tile working-set/cache + Worker jobs для Brush/Eraser/retouch, затем cross-tile flood/inpaint и lazy backing store. Только после этого пересматривать 512 MiB PSD/PSB input gate.

## Проверка

`tests/tiled-raster-source.test.mjs` фиксирует untouched-tile identity и alpha promotion; command/controller tests фиксируют routing/publication/no-op; `tests/high-depth-render-bridge.test.mjs` — tiled renderer + OffscreenCanvas seam. Полный gate: `npm run check` и file:// browser smoke.
