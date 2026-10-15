#!/usr/bin/env python3
"""Independent, read-only photo/native fixture byte gate (037B2b-2i).

Uses Python stdlib + external Pillow. Does not import the ZeTer JS fixture
generator or PSD codec, and never generates or replaces the pinned manifest.
"""
import hashlib
import io
import json
from pathlib import Path
import struct
import sys

from PIL import Image, ImageOps

WIDTH, HEIGHT = 2560, 1920
CROP = 1025
ORIGIN = (CROP - 240) // 2
SHA1 = 'c7fc9f013c70e01f164d232462ddd6e37e4079c4'


def require(condition, message):
    if not condition:
        raise ValueError('037 pinned photo: ' + message)


def selected(x, y):
    x -= ORIGIN
    y -= ORIGIN
    return ((16 <= x < 80 and 16 <= y < 80)
            or (176 <= x < 240 and 176 <= y < 240)
            or (80 <= x < 176 and x == y))


def verify(manifest_path, jpeg_path, rgba_path, decoder_path):
    m = json.loads(Path(manifest_path).read_text('utf-8'))
    source = Path(jpeg_path).read_bytes()
    rgba = Path(rgba_path).read_bytes()
    require(m['kind'] == 'zpe-real-photo-bundle-manifest-v1', 'manifest kind')
    require(hashlib.sha1(source).hexdigest() == SHA1, 'source SHA-1')
    require(len(source) == 2783744, 'source length')
    require(hashlib.sha256(source).hexdigest() == m['sourceSha256'], 'source SHA-256 pin')
    require(m['decoded'] == {'sha256': hashlib.sha256(rgba).hexdigest(),
        'width': WIDTH, 'height': HEIGHT, 'pixelFormat': 'RGBA8'}, 'RGBA8 SHA-256/geometry pin')
    require(len(rgba) == WIDTH * HEIGHT * 4, 'RGBA8 length')
    require(m['crop'] == {'x': 0, 'y': 0, 'width': CROP, 'height': CROP}, 'frozen crop')
    require(m['decoder'] == json.loads(Path(decoder_path).read_text('utf-8')),
            'pinned decoder provenance differs from actual decoder JSON')
    require(m['decoder']['exifOrientation'] == 1 and
            m['decoder']['orientationApplied'] is False and
            m['decoder']['iccPolicy'] == 'assumed-sRGB', 'frozen color/orientation policy')
    with Image.open(io.BytesIO(source)) as image:
        require(image.format == 'MPO' and image.tell() == 0, 'source primary MPO frame')
        require(image.size == (WIDTH, HEIGHT), 'source dimensions')
        require(image.getexif().get(274) == 1, 'EXIF Orientation')
        require(image.getexif().get_ifd(34665).get(40961) == 1, 'EXIF ColorSpace sRGB')
        require(not image.info.get('icc_profile'), 'unexpected embedded ICC')
        pixels = ImageOps.exif_transpose(image).convert('RGBA').tobytes()
        require(pixels == rgba, 'independent Pillow decode differs from frozen RGBA8')
    hashes = {}
    count = 0
    for name, depth in [('rgb16', 2), ('float32', 4)]:
        clean = bytearray(CROP*CROP*4*depth)
        damaged = bytearray(len(clean))
        word = '<H' if depth == 2 else '<f'
        count = 0
        for y in range(CROP):
            for x in range(CROP):
                src = (y*WIDTH + x)*4
                dst = (y*CROP + x)*4*depth
                defect = selected(x, y)
                count += defect
                for channel in range(4):
                    b = rgba[src + channel]
                    clean_value = ((65535 if channel == 3 else b*257) if depth == 2
                                   else (1.0 if channel == 3 else b/255.0))
                    offset = dst + channel*depth
                    struct.pack_into(word, clean, offset, clean_value)
                    rounded = struct.unpack_from(word, clean, offset)[0]
                    damaged_value = (rounded ^ 65535 if depth == 2 else rounded + 1.0) if defect and channel < 3 else rounded
                    struct.pack_into(word, damaged, offset, damaged_value)
        require(count == 8288, 'connected ROI count')
        for suffix, data in [('cleanSha256', clean), ('damagedSha256', damaged)]:
            digest = hashlib.sha256(data).hexdigest()
            require(m['native'][name][suffix] == digest, name + ' ' + suffix + ' mismatch')
            hashes[name + '/' + suffix] = digest
    return {'status': 'independent-byte-pins-verified', 'sourceSha256': m['sourceSha256'],
            'rgba8Sha256': m['decoded']['sha256'], 'nativeSha256': hashes,
            'selectionPixels': count, 'sourcePrecisionBits': 8,
            'iccInterpretation': 'assumed-sRGB; no embedded profile; EXIF ColorSpace=1',
            'photoshopParityVerified': False, 'browserBenchmarkVerified': False}


if __name__ == '__main__':
    if len(sys.argv) != 5:
        print('Usage: verify-pinned-real-photo.py MANIFEST JPEG RGBA8 DECODER_JSON', file=sys.stderr)
        sys.exit(2)
    try:
        print(json.dumps(verify(*sys.argv[1:]), indent=2))
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
