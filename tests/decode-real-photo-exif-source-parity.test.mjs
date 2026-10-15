import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const decoder=fileURLToPath(new URL('../tools/decode-real-photo.py',import.meta.url));
const python=process.env.ZPE_PHOTO_PYTHON || 'python3';
const probe=spawnSync(python,['-c','from PIL import Image, ImageCms, ImageOps'],{
  encoding:'utf8',timeout:15000,
});
const hasPillow=probe.status===0;

test('037B2b-2d: offline decoder cross-checks original EXIF APP1/TIFF IFD0', {
  skip:!hasPillow && process.env.ZPE_REQUIRE_PHOTO_DECODER_TESTS!=='1'
    ? 'Pillow unavailable (mandatory in CI)' : false,
},()=>{
  assert.equal(probe.status,0,probe.stderr||'Pillow unavailable');
  // These samples are synthetic (not licensed photo pixels or Adobe evidence).
  const runner=String.raw`
import hashlib
import importlib.util
from pathlib import Path
import sys
import tempfile
from PIL import Image

spec=importlib.util.spec_from_file_location('photo_decoder',sys.argv[1])
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
sha1=lambda b: hashlib.sha1(b).hexdigest()

def app1(tiff):
    payload=b'Exif\x00\x00'+tiff
    return b'\xff\xe1'+(len(payload)+2).to_bytes(2,'big')+payload

def inject(jpeg,segment):
    return jpeg[:2]+segment+jpeg[2:]

def rejected(jpeg,name,reason,folder):
    path=folder/(name+'.jpg')
    rgba=folder/(name+'.rgba')
    evidence=folder/(name+'.json')
    path.write_bytes(jpeg)
    module.SOURCE_SHA1=sha1(jpeg)
    try:
        module.decode(path,rgba,evidence)
    except ValueError as error:
        assert reason in str(error),str(error)
    else:
        raise AssertionError('accepted '+name)
    assert not rgba.exists() and not evidence.exists(),name

with tempfile.TemporaryDirectory() as directory:
    folder=Path(directory)
    image=Image.new('RGB',(16,12),color=(110,42,20))
    plain=folder/'plain.jpg'
    image.save(plain,format='JPEG')
    jpeg=plain.read_bytes()
    assert module.scan_exif_app1(jpeg) is None

    # Empty but structurally valid little-endian IFD0.
    empty_tiff=b'II\x2a\x00\x08\x00\x00\x00'+b'\x00\x00'+b'\x00'*4
    assert module.scan_exif_app1(inject(jpeg,app1(empty_tiff))) is None

    # Explicit big-endian TIFF Orientation, not dependent on Pillow's writer.
    big=b'MM\x00\x2a\x00\x00\x00\x08'+b'\x00\x01'
    big+=b'\x01\x12\x00\x03\x00\x00\x00\x01\x00\x07\x00\x00'+b'\x00'*4
    assert module.scan_exif_app1(inject(jpeg,app1(big)))==7

    exif=Image.Exif()
    exif[274]=3
    oriented=folder/'oriented.jpg'
    image.save(oriented,format='JPEG',exif=exif)
    original=oriented.read_bytes()
    assert module.scan_exif_app1(original)==3
    module.SOURCE_SHA1=sha1(original)
    module.SOURCE_SIZE=(16,12)
    decoded=module.decode(oriented,folder/'ok.rgba',folder/'ok.json')
    assert decoded['decoder']['exifOrientation']==3

    start=original.index(b'Exif\x00\x00')-4
    length=int.from_bytes(original[start+2:start+4],'big')
    segment=original[start:start+length+2]
    rejected(inject(original,segment),'duplicate-exif','Duplicate EXIF',folder)

    magic=bytearray(original)
    position=magic.index(b'Exif\x00\x00')+6+2
    magic[position]^=0x01
    rejected(bytes(magic),'bad-tiff','EXIF TIFF magic',folder)

    # Two identical Orientation tags must be rejected, even if Pillow reads one.
    entry=b'\x12\x01\x03\x00\x01\x00\x00\x00\x03\x00\x00\x00'
    duplicate_tags=b'II\x2a\x00\x08\x00\x00\x00'+b'\x02\x00'+entry+entry+b'\x00'*4
    rejected(inject(jpeg,app1(duplicate_tags)),'duplicate-tag',
             'Duplicate EXIF Orientation',folder)

    bad_signature=b'\xff\xe1\x00\x10'+b'ExifBAD'+b'\x00'*6
    rejected(inject(jpeg,bad_signature),'bad-signature',
             'Malformed EXIF APP1',folder)

    # Prove the cross-check runs before creating either decoder output.
    real_scan=module.scan_exif_app1
    module.scan_exif_app1=lambda _: 1
    try:
        rejected(original,'false-pillow-claim','Pillow EXIF Orientation',folder)
    finally:
        module.scan_exif_app1=real_scan
print('OK EXIF TIFF/Pillow source-byte parity')
`;
  const output=spawnSync(python,['-c',runner,decoder],{
    encoding:'utf8',timeout:30000,maxBuffer:1024*1024,
  });
  assert.equal(output.status,0,output.stderr||output.stdout);
  assert.match(output.stdout,/OK EXIF TIFF\/Pillow source-byte parity/);
});
