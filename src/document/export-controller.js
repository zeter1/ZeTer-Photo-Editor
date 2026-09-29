import { clamp } from '../core/geometry.js';

const PSD_MIME = 'image/vnd.adobe.photoshop';
const PSB_FORMAT = 'psb';
const ICC_MAX_BYTES = 4 * 1024 * 1024;
const PSD_MAX_PIXELS = 48_000_000;
const PSD_MAX_LAYERS = 500;

const EXPORT_FORMAT_OPTIONS = [
  ['image/png', 'PNG'],
  ['image/jpeg', 'JPEG'],
  ['image/webp', 'WebP'],
  [PSD_MIME, 'PSD — RGB/CMYK слои 8/16/32-bit'],
  [PSB_FORMAT, 'PSB — RGB/CMYK Large Document 8/16/32-bit'],
];

/**
 * Owns user-facing document export orchestration.
 *
 * The controller freezes one detached document snapshot at modal submit time,
 * then routes that immutable export intent to raster rendering or PSD/PSB
 * preparation + codecs. Low-level encoding, rendering and downloads remain
 * explicit ports so this transaction stays directly testable.
 */
export function createDocumentExportController({
  documentState: {
    getDocument,
    blockPendingDocumentEdit,
    snapshotDocument,
    restoreDocument,
  } = {},
  rendering: { compositeToBlob } = {},
  psd: { prepareDocument } = {},
  codec: { encodePsdBlob, encodePsbBlob } = {},
  io: {
    downloadBlob,
    safeFilename,
    dataUrlToBytes,
    mimeExtensions = {},
  } = {},
  ui: {
    showModal,
    setStatus = () => {},
    toast = () => {},
    alertUser = () => {},
    consoleRef = console,
  } = {},
} = {}) {
  async function exportPsdDocument(exportDoc, { psb = false } = {}) {
    const format = psb ? 'PSB' : 'PSD';
    setStatus(`${format}: подготовка слоёв…`);
    const prepared = await prepareDocument(exportDoc);
    setStatus(`${format}: упаковка ${prepared.colorMode.toUpperCase()} ${prepared.bitsPerChannel}-bit каналов…`);

    const encodeBlob = psb ? encodePsbBlob : encodePsdBlob;
    const profile = exportDoc.colorProfile;
    const iccProfile = profile?.kind === 'icc' && profile.dataUrl
      ? dataUrlToBytes(profile.dataUrl, { maxBytes: ICC_MAX_BYTES })
      : null;
    const blob = encodeBlob({
      width: exportDoc.width,
      height: exportDoc.height,
      layers: prepared.layers,
      groups: prepared.groups,
      paths: prepared.paths,
      linkedLayerBlocks: prepared.linkedLayerBlocks,
      composite: prepared.composite,
      compositePixelBuffer: prepared.compositePixelBuffer,
      bitsPerChannel: prepared.bitsPerChannel,
      colorMode: prepared.colorMode,
      iccProfile,
      iccUntagged: Boolean(profile?.untagged),
      maxPixels: PSD_MAX_PIXELS,
      maxLayers: PSD_MAX_LAYERS,
    });
    const filename = `${safeFilename(exportDoc.name)}.${psb ? 'psb' : 'psd'}`;
    downloadBlob(blob, filename);

    if (prepared.warnings.length) {
      consoleRef.warn(`${format} export warnings`, prepared.warnings);
      setStatus(`Экспортирован ${filename} с ограничениями: ${prepared.warnings.length}`);
      toast(`${format} экспортирован с ограничениями: ${prepared.warnings.length}. Подробности — в консоли`, 'warn');
    } else {
      setStatus(`Экспортирован ${filename}`);
      toast(`${format} экспортирован`, 'success');
    }
  }

  function showExportDialog() {
    if (blockPendingDocumentEdit()) return;
    showModal({
      title: 'Экспорт изображения',
      fields: [
        {
          name: 'format',
          label: 'Формат',
          type: 'select',
          value: 'image/png',
          options: EXPORT_FORMAT_OPTIONS,
        },
        {
          name: 'quality',
          label: 'Качество',
          type: 'number',
          value: '92',
          min: '1',
          max: '100',
        },
      ],
      submitLabel: 'Экспорт',
      onSubmit: async values => {
        if (blockPendingDocumentEdit()) return false;
        try {
          setStatus('Экспорт…');
          const type = values.format;
          const exportDoc = restoreDocument(snapshotDocument(getDocument()));
          if (type === PSD_MIME) {
            await exportPsdDocument(exportDoc);
            return;
          }
          if (type === PSB_FORMAT) {
            await exportPsdDocument(exportDoc, { psb: true });
            return;
          }

          const quality = clamp(Number(values.quality) / 100, 0.01, 1);
          const blob = await compositeToBlob(exportDoc, type, quality);
          const filename = `${safeFilename(exportDoc.name)}.${mimeExtensions[type]}`;
          downloadBlob(blob, filename);
          setStatus(`Экспортирован ${filename}`);
        } catch (error) {
          consoleRef.error(error);
          alertUser(error?.message);
          setStatus('Ошибка экспорта');
        }
      },
    });
  }

  return { showExportDialog };
}
