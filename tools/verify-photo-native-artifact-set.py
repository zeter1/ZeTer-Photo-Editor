#!/usr/bin/env python3
"""037B2b-3: independently verify saved photo-derived PSD16 + PSB32 native bytes.

Run ONLY after the separate genuine JPEG / RGBA8 frozen-pin verification.
This does not establish Adobe authoring, Photoshop pixel parity, calibrated
ICC color, or Chromium inpainting quality. Does not regenerate file hashes.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

FORMATS = (
    ('psd16', 'PSD16', 'psd16-defect.psd', 'rgb16'),
    ('psb32', 'PSB32', 'psb32-defect.psb', 'float32'),
)
MAX_FILE = 48 * 1024 * 1024
PIN = re.compile(r'[0-9a-f]{64}\Z')


def require(condition, message):
    if not condition:
        raise ValueError('037 native artifact: ' + message)


def load_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def reader(script, fmt, file, size, native_sha, file_sha):
    args = [sys.executable, str(Path(__file__).with_name(script)),
            fmt, str(file), str(size), str(size), native_sha]
    if script.endswith('external.py'):
        args.append(file_sha)
    output = subprocess.run(args, check=True, text=True, capture_output=True)
    return json.loads(output.stdout)


def verify(manifest_path, artifact_dir, pins_path):
    manifest = load_json(manifest_path)
    pins = load_json(pins_path)
    require(set(pins) == {'kind', 'sourceSha256', 'decodedRgbaSha256', 'documents'}
            and pins['kind'] == 'zpe-real-photo-native-artifact-pins-v1'
            and pins['sourceSha256'] == manifest['sourceSha256']
            and pins['decodedRgbaSha256'] == manifest['decoded']['sha256']
            and set(pins['documents']) == {'psd16', 'psb32'},
            'invalid independent frozen file SHA-256 pins')
    evidence = load_json(artifact_dir / 'codec-evidence.json')
    require(manifest['kind'] == 'zpe-real-photo-bundle-manifest-v1',
            'expected reviewed source manifest')
    require(evidence['kind'] == 'zpe-photo-defect-psd-psb-codec-evidence-v1'
            and evidence['status'] == 'zpe-codec-native-roundtrip-only',
            'missing saved ZeTer codec evidence')
    require(evidence['originalSha256'] == manifest['sourceSha256']
            and evidence['decodedRgbaSha256'] == manifest['decoded']['sha256'],
            'saved source/decoder digests differ from reviewed pins')
    require(evidence['sourcePrecisionBits'] == 8
            and evidence['selectedPixels'] == 8288
            and evidence['photoshopParityVerified'] is False
            and evidence['browserBenchmarkVerified'] is False,
            'unsupported source depth, ROI or parity claim')
    require(set(evidence['documents']) == {'psd16', 'psb32'},
            'missing or extra saved formats')
    crop = manifest['crop']
    require(crop == {'x': 0, 'y': 0, 'width': 1025, 'height': 1025},
            'unexpected native photo crop')

    documents = {}
    for key, fmt, filename, native_key in FORMATS:
        path = artifact_dir / filename
        require(path.is_file() and not path.is_symlink()
                and 0 < path.stat().st_size <= MAX_FILE,
                'missing, symlinked or oversized ' + filename)
        proof = evidence['documents'][key]
        native_sha = manifest['native'][native_key]['damagedSha256']
        frozen = pins['documents'][key]
        require(set(frozen) == {'fileSha256', 'nativeSha256'}
                and frozen['nativeSha256'] == native_sha
                and isinstance(frozen['fileSha256'], str)
                and PIN.fullmatch(frozen['fileSha256']),
                'invalid frozen native/file pins for ' + key)
        expected_file = frozen['fileSha256']
        require(proof['fileSha256'] == expected_file,
                'ZeTer export differs from independently frozen file: ' + key)
        require(isinstance(native_sha, str) and PIN.fullmatch(native_sha)
                and isinstance(expected_file, str) and PIN.fullmatch(expected_file),
                'missing native/file SHA-256')
        require(proof['format'] == fmt
                and proof['nativeDefectSha256'] == native_sha
                and proof['selectedPixels'] == 8288
                and proof['nativeLayerAndCompositeExact'] is True
                and proof['unchangedOutsideSelectionAndAlpha'] is True,
                'saved ZeTer proof disagrees with reviewed native pin: ' + key)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        require(digest == expected_file, 'independent file digest mismatch: ' + key)
        standard = reader('verify-real-photo-psd-native.py', fmt, path, 1025,
                          native_sha, digest)
        external = reader('verify-real-photo-psd-external.py', fmt, path, 1025,
                          native_sha, digest)
        require(standard['status'] == 'independent-python-native-readback-only'
                and external['status'] == 'external-psd-tools-native-readback-only',
                'reader did not verify saved native words: ' + key)
        require(external['reader'] == 'psd-tools'
                and external['readerVersion'] == '1.19.0',
                'unreviewed third-party reader version: ' + key)
        for report in (standard, external):
            require(report['format'] == fmt
                    and report['width'] == report['height'] == 1025
                    and report['fileSha256'] == digest
                    and report['nativeLayerSha256'] == native_sha
                    and report['nativeMergedSha256'] == native_sha
                    and report['photoshopParityVerified'] is False
                    and report['realPhotoVerified'] is False,
                    'reader/native/hash claim mismatch: ' + key)
        require(external['browserBenchmarkVerified'] is False,
                'third-party reader cannot assert browser benchmark')
        documents[key] = {
            'format': fmt,
            'fileSha256': digest,
            'nativeLayerSha256': native_sha,
            'nativeMergedSha256': native_sha,
            'python': standard['status'],
            'thirdParty': external['status'],
            'thirdPartyVersion': external['readerVersion'],
        }
    return {
        'kind': 'zpe-photo-native-psd-psb-independent-readback-v1',
        'status': 'saved-native-layer-and-merged-words-verified',
        'originalSha256': manifest['sourceSha256'],
        'decodedRgbaSha256': manifest['decoded']['sha256'],
        'sourcePrecisionBits': 8,
        'selectionPixels': 8288,
        'frozenFilePinsVerified': True,
        'documents': documents,
        'adobeAuthoredVerified': False,
        'photoshopParityVerified': False,
        'browserBenchmarkVerified': False,
        'colorimetricallyCalibrated': False,
    }


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print('Usage: verify-photo-native-artifact-set.py REVIEWED_MANIFEST ARTIFACT_DIR FROZEN_FILE_PINS',
              file=sys.stderr)
        sys.exit(2)
    try:
        result = verify(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
        # Exclusive publication: a rerun must not silently overwrite evidence.
        path = Path(sys.argv[2]) / 'independent-native-readback.json'
        with path.open('x', encoding='utf-8') as output:
            json.dump(result, output, indent=2, sort_keys=True)
            output.write('\n')
        print(json.dumps(result, sort_keys=True))
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError,
            json.JSONDecodeError) as error:
        print('037 independent PSD/PSB readback: ' + str(error), file=sys.stderr)
        sys.exit(1)
