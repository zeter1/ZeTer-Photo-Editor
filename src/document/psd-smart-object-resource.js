import { dataUrlToBytes } from '../core/io.js';
import { encodePsdBlob, encodePsbBlob, rewriteEmbeddedLinkedLayerAsset } from '../formats/psd.js';
import {
  psdEmbeddedDocumentFingerprint,
  psdOpaqueBlockFromState,
  psdPreviewFingerprint,
} from './psd-native-metadata-plans.js';

const PSD_SMART_OBJECT_MAX_EMBEDDED_ASSET_BYTES = 40 * 1024 * 1024;
const PSD_SMART_OBJECT_MAX_ICC_PROFILE_BYTES = 4 * 1024 * 1024;
const PSD_SMART_OBJECT_MAX_LINKED_LAYER_BLOCK_BYTES = 128 * 1024 * 1024;
const PSD_SMART_OBJECT_MAX_EMBEDDED_EXPORT_PIXELS = 12_000_000;
const PSD_SMART_OBJECT_MAX_EMBEDDED_EXPORT_LAYERS = 200;

/**
 * Owns Photoshop Smart Object embedded-resource preparation and publication.
 *
 * Generic Smart Object session/content lifecycle remains in smart-object-controller.js.
 * PSD/PSB byte encoding and linked-layer record rewrite remain in formats/psd.js.
 * Export preparation and the shared opaque-block state encoder stay explicit ports.
 */
export function createPsdSmartObjectResource({
  prepareDocument,
  opaqueBlockToState,
} = {}) {
  async function serializeEmbeddedAsset(embedded, source, previewDataUrl) {
    const type = String(source?.asset?.detectedFileType || '').toLowerCase();
    if (type === 'png') {
      return dataUrlToBytes(previewDataUrl, { maxBytes:PSD_SMART_OBJECT_MAX_EMBEDDED_ASSET_BYTES });
    }
    if (type === 'psd' || type === 'psb') {
      const prepared = await prepareDocument(embedded);
      const profile = embedded.colorProfile;
      const iccProfile = profile?.kind === 'icc' && profile.dataUrl
        ? dataUrlToBytes(profile.dataUrl, { maxBytes:PSD_SMART_OBJECT_MAX_ICC_PROFILE_BYTES })
        : null;
      const encodeBlob = type === 'psb' ? encodePsbBlob : encodePsdBlob;
      const blob = encodeBlob({
        width:embedded.width,
        height:embedded.height,
        layers:prepared.layers,
        groups:prepared.groups,
        paths:prepared.paths,
        linkedLayerBlocks:prepared.linkedLayerBlocks,
        composite:prepared.composite,
        compositePixelBuffer:prepared.compositePixelBuffer,
        bitsPerChannel:prepared.bitsPerChannel,
        colorMode:prepared.colorMode,
        iccProfile,
        iccUntagged:Boolean(profile?.untagged),
        maxPixels:PSD_SMART_OBJECT_MAX_EMBEDDED_EXPORT_PIXELS,
        maxLayers:PSD_SMART_OBJECT_MAX_EMBEDDED_EXPORT_LAYERS,
      });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.byteLength > PSD_SMART_OBJECT_MAX_EMBEDDED_ASSET_BYTES) {
        throw new Error('Пересобранный embedded PSD/PSB превышает лимит 40 МБ');
      }
      return bytes;
    }
    throw new Error(
      'Stage 14c resource rewrite поддерживает embedded PNG/PSD/PSB; ' +
      (type || 'тип payload не определён')
    );
  }

  async function rewriteEmbeddedSource(parentDoc, layer, embedded, previewDataUrl) {
    const source = layer?.psdSmartObject;
    const asset = source?.asset;
    const baseline = source?.baseline;
    if (!source?.uniqueId || asset?.kind !== 'data') {
      return { rewritten:false, reason:'источник не является embedded Photoshop data asset' };
    }
    if (!baseline) {
      return { rewritten:false, reason:'нет import baseline для безопасного rewrite' };
    }
    if (
      Number(embedded.width) !== Number(baseline.embeddedWidth) ||
      Number(embedded.height) !== Number(baseline.embeddedHeight)
    ) {
      return { rewritten:false, reason:'размер embedded документа изменён; PlLd transform пока не пересчитывается' };
    }

    const blocks = (parentDoc.psdLinkedLayerBlocks || [])
      .map(block => psdOpaqueBlockFromState(block, { maxBytes:PSD_SMART_OBJECT_MAX_LINKED_LAYER_BLOCK_BYTES }))
      .filter(Boolean);
    const assetBytes = await serializeEmbeddedAsset(embedded, source, previewDataUrl);
    const rewritten = rewriteEmbeddedLinkedLayerAsset(blocks, source.uniqueId, assetBytes);
    if (rewritten.rewritten < 1) {
      return { rewritten:false, reason:'liFD resource с matching UUID не найден' };
    }
    return {
      rewritten:true,
      linkedLayerBlocks:rewritten.blocks.map(opaqueBlockToState).filter(Boolean),
      newSize:rewritten.newSize,
      oldSize:rewritten.oldSize,
      sourceKey:rewritten.sourceKey,
      type:asset.detectedFileType,
    };
  }

  function publishEmbeddedSourceRewrite(parentDoc, rewrite) {
    if (!parentDoc || !rewrite?.rewritten || !Array.isArray(rewrite.linkedLayerBlocks)) return;
    parentDoc.psdLinkedLayerBlocks = rewrite.linkedLayerBlocks;
  }

  function updateTargetAfterRewrite(target, { rewrite, previewDataUrl, embedded }) {
    if (!target?.psdSmartObject || !rewrite?.rewritten) return;
    target.psdSmartObject.asset = {
      ...(target.psdSmartObject.asset || {}),
      dataSize:rewrite.newSize,
      sourceKey:rewrite.sourceKey || target.psdSmartObject.asset?.sourceKey || null,
    };
    target.psdSmartObject.baseline = {
      ...target.psdSmartObject.baseline,
      previewFingerprint:psdPreviewFingerprint(previewDataUrl),
      embeddedFingerprint:psdEmbeddedDocumentFingerprint(embedded),
      embeddedWidth:embedded.width,
      embeddedHeight:embedded.height,
    };
  }

  return {
    serializeEmbeddedAsset,
    rewriteEmbeddedSource,
    publishEmbeddedSourceRewrite,
    updateTargetAfterRewrite,
  };
}
