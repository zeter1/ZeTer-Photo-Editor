#!/usr/bin/env python3
"""037B2b-3h: third-party psd-tools native layer/merged readback.

Only accepts independently pinned one-layer ZeTer photo-defect PSD16/PSB32
artifacts. No JPEG decoding, real-photo authenticity, Adobe-authored goldens,
Photoshop parity, rendering or browser benchmark is established.
"""
import argparse
from hashlib import sha256
from importlib.metadata import version as distribution_version
from io import BytesIO
import json
from pathlib import Path
import re
import sys

MAX_FILE_BYTES = 48 * 1024 * 1024
MAX_PIXELS = 2_000_000
READER_VERSION = "1.19.0"


class ExternalPsdError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ExternalPsdError(message)


def rgba_native_sha(planes, pixels, depth):
    """Convert independent big-endian raw PSD planes into little-endian RGBA words.

    Hash the *bits* (including Float32 payload/sign), never float conversion,
    NumPy normalization or Pillow's 8-bit view.
    """
    require(set(planes) == {0, 1, 2, -1} and len(planes) == 4,
            "expected exactly RGB and transparency channels")
    stride = depth // 8
    output = bytearray(pixels * 4 * stride)
    for channel, source in planes.items():
        require(len(source) == pixels * stride, "native plane byte count mismatch")
        rgba_channel = channel if channel >= 0 else 3
        for pixel in range(pixels):
            start = pixel * stride
            dest = (pixel * 4 + rgba_channel) * stride
            output[dest:dest + stride] = source[start:start + stride][::-1]
    return sha256(output).hexdigest()


def verify_external_readback(data, fmt, width, height, expected_native, expected_file):
    require(0 < len(data) <= MAX_FILE_BYTES, "missing or oversized PSD/PSB")
    require(0 < width * height <= MAX_PIXELS and width > 0 and height > 0,
            "invalid or oversized expected geometry")
    require(sha256(data).hexdigest() == expected_file, "file SHA-256 mismatch")
    # Third-party PSD/PSB structure and channel decompression; never import
    # ZeTer's JavaScript codec nor its Python/std-lib fixture reader.
    from psd_tools.psd import PSD
    doc = PSD.read(BytesIO(data))
    header = doc.header
    depth = 16 if fmt == "PSD16" else 32
    require(header.version == (1 if fmt == "PSD16" else 2) and
            header.depth == depth and int(header.color_mode) == 3 and
            header.channels == 4 and header.width == width and
            header.height == height, "third-party header/depth/color/geometry mismatch")

    layer_info = doc._get_layer_info()
    require(layer_info is not None and layer_info.layer_count == -1 and
            len(layer_info.layer_records) == 1 and
            len(layer_info.channel_image_data) == 1,
            "third-party layer record count/transparency mismatch")
    layer = layer_info.layer_records[0]
    require((layer.left, layer.top, layer.right, layer.bottom) ==
            (0, 0, width, height), "third-party layer bounds mismatch")
    require(layer.name == "Pinned photo defect (8-bit derived)",
            "third-party layer name mismatch")
    channel_info = list(layer.channel_info)
    channel_data = list(layer_info.channel_image_data[0])
    require(len(channel_info) == len(channel_data) == 4,
            "third-party channel record count mismatch")
    require(set(int(item.id) for item in channel_info) == {0, 1, 2, -1},
            "third-party channel IDs mismatch")
    require(all(int(channel.compression) == 0 for channel in channel_data),
            "expected raw native layer channels")
    pixels = width * height
    stride = depth // 8
    require(all(info.length == 2 + pixels * stride for info in channel_info),
            "unexpected layer byte lengths")
    planes = {
        int(info.id): channel.get_data(width, height, depth, header.version)
        for info, channel in zip(channel_info, channel_data)
    }
    layer_hash = rgba_native_sha(planes, pixels, depth)
    require(int(doc.image_data.compression) == 0,
            "expected raw merged channels")
    merged = doc.image_data.get_data(header)
    require(len(merged) == 4, "third-party merged channel count mismatch")
    merged_hash = rgba_native_sha(dict(zip((0, 1, 2, -1), merged)), pixels, depth)
    require(layer_hash == expected_native, "third-party layer native SHA-256 mismatch")
    require(merged_hash == expected_native, "third-party merged native SHA-256 mismatch")
    return {
        "status": "external-psd-tools-native-readback-only",
        "reader": "psd-tools",
        "readerVersion": distribution_version("psd-tools"),
        "format": fmt,
        "fileSha256": sha256(data).hexdigest(),
        "nativeLayerSha256": layer_hash,
        "nativeMergedSha256": merged_hash,
        "width": width,
        "height": height,
        "photoshopParityVerified": False,
        "realPhotoVerified": False,
        "browserBenchmarkVerified": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("format", choices=["PSD16", "PSB32"])
    parser.add_argument("file", type=Path)
    parser.add_argument("width", type=int)
    parser.add_argument("height", type=int)
    parser.add_argument("expected_native_sha256")
    parser.add_argument("expected_file_sha256")
    args = parser.parse_args()
    for pin in (args.expected_native_sha256, args.expected_file_sha256):
        require(re.fullmatch(r"[0-9a-f]{64}", pin) is not None,
                "independently pinned lowercase SHA-256 required")
    require(args.file.is_file() and 0 < args.file.stat().st_size <= MAX_FILE_BYTES,
            "invalid artifact path or size")
    require(distribution_version("psd-tools") == READER_VERSION,
            "psd-tools reader must be pinned to " + READER_VERSION)
    result = verify_external_readback(
        args.file.read_bytes(), args.format, args.width, args.height,
        args.expected_native_sha256, args.expected_file_sha256)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (ExternalPsdError, OSError, ValueError, ImportError) as error:
        print("037 third-party PSD readback: " + str(error), file=sys.stderr)
        sys.exit(1)
