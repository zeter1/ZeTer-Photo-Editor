#!/usr/bin/env python3
"""037B2b-2a: explicit, versioned Pillow decoder for the pinned CC0 photo.

Offline only. The output is a *candidate*, never an independently reviewed pin.
Usage: python3 tools/decode-real-photo.py input.jpg NEW-decoded.rgba NEW-decoder.json
"""
import hashlib
import io
import json
from pathlib import Path
import sys

try:
    from PIL import Image, ImageCms, ImageOps, __version__ as pillow_version
except ImportError as error:
    raise SystemExit('Install reviewed Pillow version first: ' + str(error)) from error

SOURCE_SHA1 = 'c7fc9f013c70e01f164d232462ddd6e37e4079c4'
SOURCE_SIZE = (2560, 1920)
SOURCE_MAX_BYTES = 32 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000



def scan_icc_app2(jpeg: bytes):
    """Independently validate ICC APP2 part graph, not JPEG/color decoding."""
    if jpeg[:2] != b'\xff\xd8':
        raise ValueError('Invalid JPEG SOI')
    pos, expected_count, parts = 2, None, {}
    while pos < len(jpeg) - 2:
        if jpeg[pos] != 0xff:
            raise ValueError('Malformed JPEG marker before scan')
        while pos < len(jpeg) and jpeg[pos] == 0xff:
            pos += 1
        if pos >= len(jpeg):
            raise ValueError('Truncated JPEG marker')
        marker = jpeg[pos]
        pos += 1
        if marker == 0xda:
            break
        if marker in (0, 0xd8, 0xd9) or 0xd0 <= marker <= 0xd7:
            raise ValueError('Unexpected JPEG marker before scan')
        if pos + 2 > len(jpeg):
            raise ValueError('Truncated JPEG segment')
        length = int.from_bytes(jpeg[pos:pos + 2], 'big')
        end = pos + length
        if length < 2 or end > len(jpeg) - 2:
            raise ValueError('Malformed JPEG segment length')
        payload = jpeg[pos + 2:end]
        if marker == 0xe2 and payload.startswith(b'ICC_PROFILE'):
            if len(payload) < 15 or payload[11] != 0:
                raise ValueError('Malformed ICC APP2 signature or empty part')
            number, total = payload[12], payload[13]
            if (not number or not total or number > total or
                    (expected_count is not None and total != expected_count) or
                    number in parts):
                raise ValueError('Duplicate or inconsistent ICC APP2 part')
            expected_count = total
            parts[number] = payload[14:]
        pos = end
    if expected_count is None:
        return None
    if len(parts) != expected_count:
        raise ValueError('Incomplete ICC APP2 profile')
    return b''.join(parts[index] for index in range(1, expected_count + 1))



def decode(input_path: Path, rgba_path: Path, evidence_path: Path):
    if rgba_path == evidence_path or input_path in (rgba_path, evidence_path):
        raise ValueError('Original and both output paths must be distinct')
    if rgba_path.exists() or evidence_path.exists():
        raise FileExistsError('Refusing to overwrite output; choose new paths')
    size = input_path.stat().st_size
    if not 0 < size <= SOURCE_MAX_BYTES or not input_path.is_file():
        raise ValueError('Invalid original JPEG size or file')
    jpeg = input_path.read_bytes()
    if hashlib.sha1(jpeg).hexdigest() != SOURCE_SHA1:
        raise ValueError('Original JPEG SHA-1 differs from documented Wikimedia original')
    raw_icc = scan_icc_app2(jpeg)
    with Image.open(io.BytesIO(jpeg)) as original:
        if original.format != 'JPEG' or original.size != SOURCE_SIZE or original.mode != 'RGB':
            raise ValueError('Unsupported original JPEG format, geometry or color mode')
        exif = original.getexif()
        orientation = exif.get(274)
        if orientation is not None and orientation not in range(1, 9):
            raise ValueError('Invalid EXIF orientation')
        # Source admission separately reconciles APP1/APP2 flags; PIL decodes the
        # actual EXIF orientation / reassembled ICC profile, not just markers.
        icc = original.info.get('icc_profile')
        if icc != raw_icc:
            raise ValueError('Pillow ICC assembly differs from validated JPEG APP2 chunks')
        if icc is not None and (not isinstance(icc, bytes) or not 128 <= len(icc) <= 4 * 1024 * 1024):
            raise ValueError('Unsupported embedded ICC length')
        original.load()
        oriented = ImageOps.exif_transpose(original)
        if oriented.size != SOURCE_SIZE:
            raise ValueError('Orientation changed pinned raster dimensions')
        if icc is None:
            rgb = oriented.convert('RGB')
            policy = 'assumed-sRGB'
            color_evidence = 'No Pillow-assembled embedded ICC; RGB samples assumed sRGB. Human color review required.'
        else:
            source_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            target_profile = ImageCms.createProfile('sRGB')
            rgb = ImageCms.profileToProfile(
                oriented, source_profile, target_profile, renderingIntent=0,
                outputMode='RGB',
            )
            policy = 'embedded-ICC-to-sRGB'
            name = ImageCms.getProfileName(source_profile).strip()
            color_evidence = (
                'Pillow-assembled ICC converted by ImageCms to sRGB (perceptual intent 0); '
                'input profile name=' + repr(name[:120]) + '; human review required.'
            )
        rgba = rgb.convert('RGBA').tobytes('raw', 'RGBA')
    if len(rgba) != SOURCE_SIZE[0] * SOURCE_SIZE[1] * 4 or rgba[3::4] != b'\xff' * (len(rgba) // 4):
        raise ValueError('Non-opaque or incorrectly sized decoded RGBA8')
    evidence = {
        'tool': 'Pillow Image/ImageOps/ImageCms',
        'version': pillow_version + '; LittleCMS ' + str(getattr(ImageCms.core, 'littlecms_version', 'unknown')),
        'command': 'python3 tools/decode-real-photo.py ORIGINAL.jpg NEW-decoded.rgba NEW-decoder.json',
        'exifOrientation': orientation,
        'orientationApplied': orientation is not None and orientation != 1,
        'iccPolicy': policy,
        'colorEvidence': color_evidence,
    }
    # Evidence only describes a decoder *run*. These digests are candidates to
    # be reviewed and pinned independently; never write them into a reviewed manifest.
    rgba_path.parent.mkdir(parents=True, exist_ok=True)
    evidence_path.parent.mkdir(parents=True, exist_ok=True)
    with rgba_path.open('xb') as output:
        output.write(rgba)
    with evidence_path.open('x', encoding='utf8') as output:
        json.dump(evidence, output, indent=2, ensure_ascii=False)
        output.write('\n')
    return {
        'status': 'decoded-candidate-unreviewed',
        'sourceSha256Candidate': hashlib.sha256(jpeg).hexdigest(),
        'rgbaSha256Candidate': hashlib.sha256(rgba).hexdigest(),
        'decodedBytes': len(rgba),
        'decoder': evidence,
        'independentReviewRequired': True,
    }


def main(argv):
    if len(argv) != 4:
        print('Usage: python3 tools/decode-real-photo.py original.jpg NEW-decoded.rgba NEW-decoder.json', file=sys.stderr)
        return 2
    try:
        result = decode(*(Path(value).resolve() for value in argv[1:]))
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except (ValueError, OSError) as error:
        print('037 photo decode: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
