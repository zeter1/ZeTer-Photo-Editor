import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { referenceMergedSamples, verifyPhotoshopCandidateBytes, PHOTOCRAFT_CASES,
  PHOTOCRAFT_REVISION } from '../tools/verify-photocraft-candidates.mjs';

// Deliberately generated wire-format fixtures for negative/boundary tests.
// They are NOT Photoshop-authored and do not replace the CI-pinned corpus.
function smallPsd({ bits = 16, compression = 0, width = 3, height = 2 } = {}) {
  const channels = 3, sampleBytes = bits / 8, stride = width * sampleBytes;
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(channels, 12);
  head.writeUInt32BE(height, 14); head.writeUInt32BE(width, 18);
  head.writeUInt16BE(bits, 22); head.writeUInt16BE(3, 24);
  const planes = Buffer.alloc(channels * height * stride);
  for (let c = 0; c < channels; c++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = c * height * stride + y * stride + x * sampleBytes;
    if (bits === 16) planes.writeUInt16BE(1000 + c * 10000 + y * 100 + x * 7, offset);
    else planes.writeFloatBE(c + y / 4 + x / 32, offset);
  }
  let payload = planes;
  if (compression === 1) {
    const lengths = Buffer.alloc(channels * height * 2);
    const chunks = [];
    for (let row = 0; row < channels * height; row++) {
      lengths.writeUInt16BE(stride + 1, row * 2);
      chunks.push(Buffer.from([stride - 1]), planes.subarray(row * stride, (row + 1) * stride));
    }
    payload = Buffer.concat([lengths, ...chunks]);
  } else if (compression === 2 || compression === 3) {
    if (compression === 3) {
      assert.equal(bits, 16);
      const diff = Buffer.from(planes);
      for (let row = 0; row < channels * height; row++) {
        let prior = planes.readUInt16BE(row * stride);
        for (let x = 1; x < width; x++) {
          const offset = row * stride + 2 * x;
          const value = planes.readUInt16BE(offset);
          diff.writeUInt16BE((value - prior + 65536) % 65536, offset);
          prior = value;
        }
      }
      payload = diff;
    }
    payload = deflateSync(payload);
  }
  const compressionBytes = Buffer.alloc(2);
  compressionBytes.writeUInt16BE(compression);
  return Buffer.concat([head, Buffer.alloc(12), compressionBytes, payload]);
}
function spec(bytes, bits) {
  return {
    id:'synthetic-not-photoshop', sha256:createHash('sha256').update(bytes).digest('hex'),
    size:bytes.length, bitsPerChannel:bits, layered:false,
  };
}

test('002B declared upstream candidates are immutable pinned PSD16/PSD32, not PSB32', () => {
  assert.match(PHOTOCRAFT_REVISION, /^[a-f0-9]{40}$/);
  assert.deepEqual(PHOTOCRAFT_CASES.map(x => x.bitsPerChannel), [16, 16, 32]);
  assert.ok(PHOTOCRAFT_CASES.every(x => /^[a-f0-9]{64}$/.test(x.sha256) &&
    x.file.endsWith('.psd') && !x.file.includes('..') && x.size > 1000));
});

test('002B native independent composite oracle matches codec for raw, RLE, ZIP and 16-bit prediction', async t => {
  for (const [bits, compression] of [[16,0],[16,1],[16,2],[16,3],[32,0],[32,1],[32,2]]) {
    await t.test(bits + '-bit compression=' + compression, async () => {
      const bytes = smallPsd({ bits, compression });
      const report = await verifyPhotoshopCandidateBytes(bytes, spec(bytes, bits));
      assert.equal(report.nativeCompositeParity, 'exact');
      assert.equal(report.compression, compression);
      assert.equal(report.bitsPerChannel, bits);
      assert.equal(report.layeredEntries, null);
    });
  }
});

test('002B independent oracle refuses tampering and truncated / overflowing PSD sections', async () => {
  const bytes = smallPsd();
  const signed = spec(bytes, 16);
  const tampered = Buffer.from(bytes);
  tampered[tampered.length - 1] ^= 1;
  await assert.rejects(verifyPhotoshopCandidateBytes(tampered, signed), /SHA-256/);
  await assert.rejects(verifyPhotoshopCandidateBytes(bytes.subarray(1), signed), /size/);

  const sectionOverflow = Buffer.from(bytes);
  sectionOverflow.writeUInt32BE(0xffffffff, 26);
  await assert.rejects(verifyPhotoshopCandidateBytes(sectionOverflow, spec(sectionOverflow, 16)),
    /outside input/);

  const brokenCompression = Buffer.from(bytes);
  brokenCompression.writeUInt16BE(99, 38);
  await assert.rejects(verifyPhotoshopCandidateBytes(brokenCompression, spec(brokenCompression, 16)),
    /compression/);

  const truncatedRle = smallPsd({ compression:1 });
  const corrupt = Buffer.from(truncatedRle);
  // The 3 * 2 PackBits row table immediately follows the compression marker.
  corrupt.writeUInt16BE(65535, 40);
  await assert.rejects(verifyPhotoshopCandidateBytes(corrupt, spec(corrupt, 16)),
    /outside input/);

  await assert.rejects(verifyPhotoshopCandidateBytes(bytes, { ...signed, layered:true }),
    /layer section/);
});

test('002B source buffer is never overwritten by composite parsing / PSD decoding', async () => {
  const bytes = smallPsd({ bits:32, compression:2 });
  const before = Buffer.from(bytes);
  const report = await verifyPhotoshopCandidateBytes(bytes, spec(bytes, 32));
  assert.equal(report.nativeCompositeParity, 'exact');
  assert.deepEqual(bytes, before);
});
