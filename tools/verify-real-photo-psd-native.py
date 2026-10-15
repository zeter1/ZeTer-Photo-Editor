#!/usr/bin/env python3
"""Strict independent Python/std-lib native RGBA word readback for one-layer PSD16/PSB32.

No ZeTer JavaScript codec is used. Cross-language parity against a separately
pinned LE SHA-256 is NOT Adobe/Photoshop validation or genuine-photo evidence.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import sys

MAX_BYTES = 48 * 1024 * 1024
MAX_PIXELS = 2_000_000


class InvalidPsd(ValueError):
    pass


def require(value, message):
    if not value:
        raise InvalidPsd(message)


class Cursor:
    def __init__(self, content):
        self.content = memoryview(content)
        self.offset = 0

    def take(self, count):
        require(isinstance(count, int) and count >= 0 and
                count <= len(self.content) - self.offset, 'truncated or oversized section')
        result = self.content[self.offset:self.offset + count]
        self.offset += count
        return result

    def read(self, fmt):
        return struct.unpack('>' + fmt, self.take(struct.calcsize('>' + fmt)))[0]

    def ascii(self, count):
        return bytes(self.take(count))

    def nested(self, length):
        return Cursor(self.take(length))

    def done(self):
        require(self.offset == len(self.content), 'unexpected trailing bytes')


def rgba_le_sha(channels, pixels, sample_bytes):
    require(set(channels) == {0, 1, 2, -1} and len(channels) == 4,
            'must contain exactly R/G/B/alpha channels')
    result = bytearray(pixels * 4 * sample_bytes)
    for channel_id, plane in channels.items():
        require(len(plane) == pixels * sample_bytes, 'wrong native channel size')
        position = 3 if channel_id == -1 else channel_id
        for px in range(pixels):
            source = px * sample_bytes
            dest = (px * 4 + position) * sample_bytes
            result[dest:dest + sample_bytes] = plane[source:source + sample_bytes][::-1]
    return hashlib.sha256(result).hexdigest()


def read_layer_planes(content, version, width, height, sample_bytes):
    section = Cursor(content)
    require(section.read('h') in (-1, 1), 'expected exactly one layer')
    bounds = [section.read('i') for _ in range(4)]
    require(bounds == [0, 0, height, width], 'not a full-canvas layer')
    require(section.read('H') == 4, 'expected four RGBA layer channels')
    lengths = {}
    for _ in range(4):
        channel_id = section.read('h')
        length = section.read('Q' if version == 2 else 'I')
        require(channel_id in (0, 1, 2, -1) and channel_id not in lengths,
                'duplicate/unknown layer channel')
        require(length == 2 + width * height * sample_bytes,
                'non-raw, missing or oversized layer plane')
        lengths[channel_id] = length
    require(section.ascii(4) == b'8BIM' and section.ascii(4) == b'norm',
            'invalid layer blend signature/mode')
    require(section.read('B') == 255 and section.read('B') == 0,
            'unexpected layer opacity or clipping')
    require(section.read('B') & 0x02 == 0 and section.read('B') == 0,
            'hidden layer or unexpected filler')
    section.take(section.read('I'))  # layer extra: masks, name, metadata
    planes = {}
    for channel_id, length in lengths.items():
        channel = section.nested(length)
        require(channel.read('H') == 0, 'compressed layer channel not supported')
        planes[channel_id] = channel.take(length - 2)
        channel.done()
    padding = section.take(len(section.content) - section.offset)
    require(len(padding) <= 3 and bytes(padding) == b'\0' * len(padding),
            'invalid layer-info padding')
    return planes


def verify_native_psd(data, fmt, expected_width, expected_height, expected_sha):
    reader = Cursor(data)
    require(reader.ascii(4) == b'8BPS', 'missing PSD signature')
    version = reader.read('H')
    depth = 16 if fmt == 'PSD16' else 32
    require(version == (1 if fmt == 'PSD16' else 2), 'PSD/PSB version mismatch')
    require(reader.ascii(6) == b'\0' * 6, 'reserved header bytes nonzero')
    require(reader.read('H') == 4, 'document must have four merged channels')
    height, width = reader.read('I'), reader.read('I')
    require(width == expected_width and height == expected_height and
            0 < width * height <= MAX_PIXELS, 'unexpected or oversized geometry')
    require(reader.read('H') == depth and reader.read('H') == 3,
            'expected RGB document with native depth')
    pixels = width * height
    sample_bytes = depth // 8
    reader.take(reader.read('I'))  # color mode data
    reader.take(reader.read('I'))  # image resources
    layer_mask = reader.nested(reader.read('Q' if version == 2 else 'I'))
    require(layer_mask.read('Q' if version == 2 else 'I') == 0,
            'ordinary layer-info must be empty for high-depth document')
    require(layer_mask.read('I') == 0, 'unexpected global layer mask')
    require(layer_mask.ascii(4) == (b'8BIM' if version == 1 else b'8B64'),
            'invalid high-depth tagged block signature')
    require(layer_mask.ascii(4) == (b'Lr16' if depth == 16 else b'Lr32'),
            'missing depth-specific layer block')
    body = layer_mask.nested(layer_mask.read('Q' if version == 2 else 'I'))
    layer_planes = read_layer_planes(body.content, version, width, height, sample_bytes)
    if len(body.content) & 1:
        require(layer_mask.ascii(1) == b'\0', 'invalid tagged layer padding')
    layer_mask.done()
    require(reader.read('H') == 0, 'only raw merged channels are supported')
    merged_planes = {channel: reader.take(pixels * sample_bytes)
                     for channel in (0, 1, 2, -1)}
    reader.done()
    layer_sha = rgba_le_sha(layer_planes, pixels, sample_bytes)
    merged_sha = rgba_le_sha(merged_planes, pixels, sample_bytes)
    require(layer_sha == expected_sha, 'layer native SHA-256 does not match independent pin')
    require(merged_sha == expected_sha, 'merged native SHA-256 does not match independent pin')
    return {
        'status': 'independent-python-native-readback-only',
        'format': fmt,
        'fileSha256': hashlib.sha256(data).hexdigest(),
        'nativeLayerSha256': layer_sha,
        'nativeMergedSha256': merged_sha,
        'width': width,
        'height': height,
        'photoshopParityVerified': False,
        'realPhotoVerified': False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('format', choices=['PSD16', 'PSB32'])
    parser.add_argument('file', type=Path)
    parser.add_argument('width', type=int)
    parser.add_argument('height', type=int)
    parser.add_argument('expected_native_sha256',
                        help='independently pinned damaged LE RGBA SHA-256')
    args = parser.parse_args()
    require(re.fullmatch('[0-9a-f]{64}', args.expected_native_sha256) is not None,
            'required canonical SHA-256 pin')
    require(args.file.is_file() and 0 < args.file.stat().st_size <= MAX_BYTES,
            'missing or oversized PSD/PSB file')
    result = verify_native_psd(args.file.read_bytes(), args.format,
                               args.width, args.height, args.expected_native_sha256)
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except (InvalidPsd, OSError, ValueError, struct.error) as error:
        print('037 Python photo native readback: ' + str(error), file=sys.stderr)
        sys.exit(1)
