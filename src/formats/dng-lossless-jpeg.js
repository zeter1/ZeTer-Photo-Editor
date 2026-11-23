// Bounded ISO/IEC 10918-1 SOF3 decoder for DNG CFA strips/tiles.
// Supports full interleaved or disjoint 1/2-component SOS partitions
// (including mixed 1+2+1) for four-component CFA streams; each SOS carries
// its own entropy/predictor/restart sequence and writes native Bayer positions.
// No subsampling or camera-specific JPEG slices.
function requireJpeg(condition, reason) {
  if (!condition) throw new Error('DNG: lossless JPEG ' + reason);
}

export function decodeDngLosslessJpeg(bytes, {width, height, bits}) {
  requireJpeg(bytes instanceof Uint8Array && bytes.length >= 16, 'усечённый поток');
  requireJpeg(Number.isInteger(width) && Number.isInteger(height) &&
    width >= 1 && height >= 1 && width * height <= 16_000_000, 'небезопасные размеры');
  requireJpeg(bytes[0] === 0xff && bytes[1] === 0xd8, 'нет SOI');
  let position = 2, frame = null, scanMode = null, restartInterval = 0, driSeen = false;
  const tables = new Map(), seen = new Set();
  const result = new Uint16Array(width * height);

  function segment() {
    requireJpeg(position + 2 <= bytes.length, 'усечённая длина сегмента');
    const length = bytes[position] * 256 + bytes[position + 1];
    requireJpeg(length >= 2 && position + length <= bytes.length, 'усечённый сегмент');
    const data = bytes.subarray(position + 2, position + length);
    position += length;
    return data;
  }

  function marker() {
    requireJpeg(position < bytes.length && bytes[position++] === 0xff, 'ожидался маркер');
    while (position < bytes.length && bytes[position] === 0xff) position++;
    requireJpeg(position < bytes.length, 'усечённый маркер');
    const id = bytes[position++];
    requireJpeg(id !== 0 && id !== 0xd8 && !(id >= 0xd0 && id <= 0xd7),
      frame && seen.size === frame.components ? 'нет конечного EOI' : 'неожиданный JPEG маркер');
    return id;
  }

  function decodeScan(scan) {
    let current = 0, available = 0;
    function readBit() {
      if (!available) {
        requireJpeg(position < bytes.length, 'усечённый entropy scan');
        current = bytes[position++];
        if (current === 0xff) {
          requireJpeg(position < bytes.length && bytes[position++] === 0x00,
            'маркер или неверное byte stuffing внутри entropy scan');
        }
        available = 8;
      }
      available--;
      return (current >> available) & 1;
    }
    function readBits(n) {
      let value = 0;
      for (let i = 0; i < n; i++) value = (value << 1) | readBit();
      return value;
    }
    function category(table) {
      let code = 0;
      for (let length = 1; length <= 16; length++) {
        code = (code << 1) | readBit();
        const value = table[length].get(code);
        if (value !== undefined) return value;
      }
      requireJpeg(false, 'неверный код Huffman');
    }
    const shift = scan.pointTransform, frameWidth = frame.width;
    const initial = 1 << (bits - shift - 1), mask = (1 << (bits - shift)) - 1;
    for (let y = 0; y < height; y++) for (let x = 0; x < frameWidth; x++) {
      const mcu = y * frameWidth + x;
      if (restartInterval && mcu > 0 && mcu % restartInterval === 0) {
        requireJpeg(!available || (current & ((1 << available) - 1)) ===
          (1 << available) - 1, 'неверные padding bits перед restart');
        available = 0;
        requireJpeg(position + 2 <= bytes.length && bytes[position] === 0xff &&
          bytes[position + 1] === 0xd0 + ((mcu / restartInterval - 1) % 8),
          'отсутствует или нарушен порядок restart RSTn маркеров');
        position += 2;
      }
      for (let s = 0; s < scan.indices.length; s++) {
        const c = scan.indices[s];
        const index = mcu * frame.components + c;
        const left = x ? result[index - frame.components] >> shift : 0;
        const above = y ? result[index - width] >> shift : 0;
        const upperLeft = x && y ? result[index - width - frame.components] >> shift : 0;
        let predictor;
        if ((restartInterval && mcu % restartInterval === 0) || (x === 0 && y === 0))
          predictor = initial;
        else if (y === 0) predictor = left;
        else if (x === 0) predictor = above;
        else switch (scan.predictor) {
          case 1: predictor = left; break;
          case 2: predictor = above; break;
          case 3: predictor = upperLeft; break;
          case 4: predictor = left + above - upperLeft; break;
          case 5: predictor = left + ((above - upperLeft) >> 1); break;
          case 6: predictor = above + ((left - upperLeft) >> 1); break;
          case 7: predictor = (left + above) >> 1; break;
        }
        const size = category(scan.tables[s]);
        const magnitude = size === 16 ? 0 : readBits(size);
        const difference = size === 16 ? -32768 :
          (size && magnitude < 2 ** (size - 1) ? magnitude - (2 ** size - 1) : magnitude);
        result[index] = ((predictor + difference) & mask) << shift;
      }
    }
    // Each SOS contains exactly its own component samples. Only padding may
    // precede the next marker; a marker appearing inside entropy is an error.
    requireJpeg(!available || (current & ((1 << available) - 1)) ===
      (1 << available) - 1, 'неверные padding bits');
  }

  while (true) {
    const id = marker();
    if (id === 0xd9) {
      requireJpeg(frame && seen.size === frame.components, 'неполный набор SOS scan-компонентов');
      requireJpeg(position === bytes.length, 'нет конечного EOI или лишние данные');
      return result;
    }
    requireJpeg(!frame || seen.size !== frame.components, 'ожидался EOI после всех scan');
    if (id === 0xc3) {
      const d = segment(), components = d[5];
      requireJpeg(!frame && [1, 2, 4].includes(components) &&
        d.length === 6 + components * 3, 'неподдерживаемое число компонентов SOF3');
      const precision = d[0], rows = d[1] * 256 + d[2], cols = d[3] * 256 + d[4];
      requireJpeg(precision === bits && precision >= 8 && precision <= 16 &&
        rows === height && cols * components === width,
        'SOF3 precision/размеры не совпадают с DNG');
      const ids = [];
      for (let c = 0; c < components; c++) {
        const component = d[6 + c * 3], sampling = d[7 + c * 3], quant = d[8 + c * 3];
        requireJpeg(!ids.includes(component) && sampling === 0x11 && quant === 0,
          'повторный SOF3 ID, subsampling или quantization');
        ids.push(component);
      }
      frame = {ids, components, width: cols};
    } else if (id === 0xc4) {
      const d = segment();
      let i = 0;
      while (i < d.length) {
        requireJpeg(i + 17 <= d.length, 'усечённая таблица Huffman');
        const selector = d[i++], counts = d.subarray(i, i + 16);
        i += 16;
        const count = counts.reduce((sum, n) => sum + n, 0);
        requireJpeg((selector >> 4) === 0 && count > 0 && count <= 17 &&
          i + count <= d.length, 'неподдерживаемая таблица Huffman');
        const lookup = Array.from({length: 17}, () => new Map());
        let code = 0, index = i;
        for (let length = 1; length <= 16; length++) {
          code <<= 1;
          requireJpeg(code + counts[length - 1] <= 2 ** length, 'переполненная таблица Huffman');
          for (let j = 0; j < counts[length - 1]; j++) {
            const value = d[index++];
            requireJpeg(value <= 16 && !lookup[length].has(code), 'неверная Huffman категория');
            lookup[length].set(code++, value);
          }
        }
        tables.set(selector & 15, lookup);
        i += count;
      }
    } else if (id === 0xdd) {
      const d = segment();
      requireJpeg(!driSeen && d.length === 2 && seen.size === 0,
        'неверный или повторный DRI');
      restartInterval = d[0] * 256 + d[1];
      driSeen = true;
      requireJpeg(restartInterval > 0, 'нулевой restart interval в DRI');
    } else if (id === 0xda) {
      const d = segment();
      requireJpeg(frame && d.length >= 6, 'неподдерживаемая структура SOS');
      const count = d[0];
      requireJpeg(count >= 1 && d.length === 1 + 2 * count + 3,
        'неподдерживаемая структура SOS');
      // A four-channel CFA may be partitioned into 1- or 2-component
      // disjoint SOS groups, e.g. 1+2+1. Each SOS walks its own MCU grid;
      // component IDs map into the original frame, not scan order. Reject
      // switching from a full-frame scan to partitioned scans (or vice versa).
      const mode = count === frame.components ? 'interleaved' :
        (count === 1 || (frame.components === 4 && count === 2))
          ? 'partitioned' : null;
      requireJpeg(mode && (!scanMode || mode === scanMode),
        'неподдерживаемая смесь SOS scan-компонентов');
      if (!scanMode) scanMode = mode;
      const indices = [], scanTables = [];
      for (let s = 0; s < count; s++) {
        const componentId = d[1 + 2 * s], selector = d[2 + 2 * s];
        const index = frame.ids.indexOf(componentId);
        requireJpeg(index !== -1 && !seen.has(index) && !indices.includes(index) &&
          (selector & 15) === 0 && tables.has(selector >> 4),
          'неизвестный/повторный SOS компонент или таблица Huffman');
        indices.push(index);
        scanTables.push(tables.get(selector >> 4));
      }
      const predictor = d[1 + count * 2], transformByte = d[3 + count * 2];
      const pointTransform = transformByte & 15;
      requireJpeg(d[2 + count * 2] === 0 && (transformByte >> 4) === 0 &&
        predictor >= 1 && predictor <= 7 && pointTransform < bits &&
        bits - pointTransform >= 2, 'неподдерживаемый predictor/point transform/SOS');
      decodeScan({indices, tables: scanTables, predictor, pointTransform});
      for (const index of indices) seen.add(index);
    } else if (id === 0xe0 || (id >= 0xe1 && id <= 0xef) || id === 0xfe) {
      segment(); // APPn / COM only. No implicit colour calibration or slice geometry.
    } else {
      requireJpeg(false, 'неподдерживаемый JPEG сегмент 0x' + id.toString(16));
    }
  }
}
