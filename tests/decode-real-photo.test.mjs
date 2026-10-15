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

test('037B2b-2a: pinned JPEG -> EXIF/ICC-aware opaque RGBA8 decoder is fail-closed',{
  skip:!hasPillow && process.env.ZPE_REQUIRE_PHOTO_DECODER_TESTS!=='1'
    ? 'Pillow not installed (mandatory in CI)' : false,
},()=>{
  assert.equal(probe.status,0,'Pillow must be installed: '+probe.stderr);
  const runner="import hashlib\nimport importlib.util\nimport json\nfrom pathlib import Path\nimport sys\nimport tempfile\nfrom PIL import Image, ImageCms, ImageOps\n\nspec = importlib.util.spec_from_file_location('decode_photo', sys.argv[1])\nmodule = importlib.util.module_from_spec(spec)\nspec.loader.exec_module(module)\nwith tempfile.TemporaryDirectory() as tmp:\n    folder = Path(tmp)\n    image = Image.new('RGB', (16, 12))\n    for y in range(12):\n        for x in range(16):\n            image.putpixel((x, y), (x * 13, y * 17, (x + y) * 8))\n    exif = Image.Exif()\n    exif[274] = 3\n    jpeg = folder / 'photo.jpg'\n    image.save(jpeg, format='JPEG', quality=95, exif=exif)\n    # Test-only injected policy for a synthetic 16x12 input. The public CLI\n    # never exposes a policy override or accepts this JPEG as a real photo.\n    module.SOURCE_SHA1 = hashlib.sha1(jpeg.read_bytes()).hexdigest()\n    module.SOURCE_SIZE = (16, 12)\n    output = folder / 'raw.rgba'\n    evidence = folder / 'decoder.json'\n    result = module.decode(jpeg, output, evidence)\n    assert result['status'] == 'decoded-candidate-unreviewed'\n    assert result['decodedBytes'] == 16 * 12 * 4\n    assert result['decoder']['exifOrientation'] == 3\n    assert result['decoder']['orientationApplied'] is True\n    assert result['decoder']['iccPolicy'] == 'assumed-sRGB'\n    assert result['independentReviewRequired'] is True\n    with Image.open(jpeg) as original:\n        expected = ImageOps.exif_transpose(original).convert('RGBA').tobytes()\n    assert output.read_bytes() == expected\n    assert json.loads(evidence.read_text()) == result['decoder']\n    try:\n        module.decode(jpeg, output, evidence)\n    except FileExistsError:\n        pass\n    else:\n        raise AssertionError('overwrote existing evidence')\n    mutated = folder / 'bad.jpg'\n    data = bytearray(jpeg.read_bytes())\n    data[-3] ^= 1\n    mutated.write_bytes(data)\n    try:\n        module.decode(mutated, folder / 'bad.rgba', folder / 'bad.json')\n    except ValueError as err:\n        assert 'SHA-1' in str(err)\n    else:\n        raise AssertionError('accepted mutated JPEG')\n    assert not (folder / 'bad.rgba').exists()\n    # Embedded valid ICC must use the ImageCms -> sRGB path, not be ignored.\n    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()\n    with_icc = folder / 'icc.jpg'\n    image.save(with_icc, format='JPEG', quality=95, icc_profile=profile)\n    module.SOURCE_SHA1 = hashlib.sha1(with_icc.read_bytes()).hexdigest()\n    icc_result = module.decode(with_icc, folder / 'icc.rgba', folder / 'icc.json')\n    assert icc_result['decoder']['iccPolicy'] == 'embedded-ICC-to-sRGB'\n    assert icc_result['decoder']['exifOrientation'] is None\n    # 90 degree EXIF rotation would violate this source's pinned geometry.\n    exif[274] = 6\n    rotated = folder / 'rotated.jpg'\n    image.save(rotated, format='JPEG', quality=95, exif=exif)\n    module.SOURCE_SHA1 = hashlib.sha1(rotated.read_bytes()).hexdigest()\n    try:\n        module.decode(rotated, folder / 'rotated.rgba', folder / 'rotated.json')\n    except ValueError as err:\n        assert 'dimensions' in str(err)\n    else:\n        raise AssertionError('accepted transposed geometry')\n    assert not (folder / 'rotated.rgba').exists()\nprint('OK synthetic JPEG decoder regression')";
  const output=spawnSync(python,['-c',runner,decoder],{
    encoding:'utf8',timeout:30000,maxBuffer:1024*1024,
  });
  assert.equal(output.status,0,output.stderr||output.stdout);
  assert.match(output.stdout,/OK synthetic JPEG decoder regression/);

  // Public CLI never accepts the synthetic fixture or a missing source.
  const invalid=spawnSync(python,[decoder,'missing.jpg','a.rgba','b.json'],{
    encoding:'utf8',timeout:15000,
  });
  assert.equal(invalid.status,1);
  assert.match(invalid.stderr,/037 photo decode/);
});
