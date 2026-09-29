# Tiled high-depth raster source — Stage 17a

Stage 17a вводит backward-compatible tiled persistence для больших native RGB/CMYK 8/16/32-bit PixelBuffer sources. Это foundation для больших PSD/PSB, а не утверждение, что весь document canvas уже виртуально-тайловый.

## Владельцы

- `src/core/pixel-buffer.js`: v1/v2 source format, строгая grid validation, per-tile little-endian encode/decode, adaptive serialization и compatibility materialization.
- `src/core/render.js`: RGB v2 high-depth preview декодирует по одному tile; `OffscreenCanvas` используется как staging surface, когда доступен, иначе DOM Canvas fallback.
- `src/document/psd-import-controller.js`: после decode sources от 8 MiB сохраняются как v2 tiles, меньшие остаются v1.

## Контракт v2

`kind = zpe-pixel-buffer-source-v2`; row-major grid; default tile 256×256; edge tiles имеют реальный меньший размер. Каждый tile хранит собственный bounded base64 payload. Grid обязан быть полным и упорядоченным; сумма `tile.rawBytes` точно равна `source.rawBytes`. Действуют прежний 48 MiB precision budget и лимит 8192 tiles. Legacy v1 остаётся читаемым.

## Render memory contract

Renderer делает sanitize → display surface → decode одного tile → native tone-map/color pipeline → `putImageData` → следующий tile. Для v2 preview не создаётся второй full 16/32-bit plane. Callers, которым действительно нужен mutable contiguous buffer, продолжают использовать `deserializePixelBufferSource()` и материализуют source только на этой границе.

## Ограничения Stage 17a

- PSD/PSB binary decoder пока materializes bounded channel planes до tiled handoff.
- Destructive paint/retouch и некоторые export/color-management paths пока материализуют contiguous PixelBuffer.
- Canvas compositor всё ещё требует display surface размером документа.
- Нет eviction-backed tile store, IndexedDB paging, worker-owned editing tiles, GPU renderer или RAW/DNG decode.

Следующий безопасный шаг: переносить tile-local operations на visitors/worker jobs, затем добавлять lazy backing store и только после этого пересматривать 512 MiB PSD/PSB input gate.

## Проверка

`tests/tiled-raster-source.test.mjs` фиксирует exact typed round-trip, edge tiles, adaptive v1/v2 policy, visitor и fail-closed sanitizer. `tests/high-depth-render-bridge.test.mjs` фиксирует tiled renderer + OffscreenCanvas seam. Полный gate: `npm run check` и file:// browser smoke.
