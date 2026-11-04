import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const decoder=fileURLToPath(new URL('../tools/decode-real-photo.py',import.meta.url));
const python=process.env.ZPE_PHOTO_PYTHON || 'python3';
const probe=spawnSync(python,['-c','from PIL import Image'],{
  encoding:'utf8',timeout:15000,
});
const hasPillow=probe.status===0;

test('037B2b-2f: decoder output pair rollback, collisions and dangling symlink', {
  skip:!hasPillow && process.env.ZPE_REQUIRE_PHOTO_DECODER_TESTS!=='1'
    ? 'Pillow unavailable (mandatory in CI)' : false,
},()=>{
  assert.equal(probe.status,0,'Pillow required: '+probe.stderr);
  const runner="import hashlib\nimport importlib.util\nfrom pathlib import Path\nimport sys\nimport tempfile\nfrom PIL import Image\n\nspec=importlib.util.spec_from_file_location('decode_photo',sys.argv[1])\nmodule=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(module)\n\nwith tempfile.TemporaryDirectory() as directory:\n    folder=Path(directory)\n    source=folder/'source.jpg'\n    Image.new('RGB',(16,12),color=(40,80,120)).save(source,format='JPEG')\n    module.SOURCE_SHA1=hashlib.sha1(source.read_bytes()).hexdigest()\n    module.SOURCE_SIZE=(16,12)\n\n    original_dump=module.json.dump\n    def break_report(value, output, *args, **kwargs):\n        output.write('{\"truncated\":')\n        raise OSError('injected write failure')\n    module.json.dump=break_report\n    rgba=folder/'broken.rgba'\n    report=folder/'broken.json'\n    try:\n        try:\n            module.decode(source,rgba,report)\n        except OSError as error:\n            assert 'injected write failure' in str(error)\n        else:\n            raise AssertionError('expected injected report failure')\n    finally:\n        module.json.dump=original_dump\n    assert not rgba.exists() and not report.exists()\n\n    owned=folder/'occupied.json'\n    owned.write_bytes(b'preserve-existing-report')\n    try:\n        module.decode(source,folder/'new.rgba',owned)\n    except FileExistsError:\n        pass\n    else:\n        raise AssertionError('accepted occupied report destination')\n    assert owned.read_bytes()==b'preserve-existing-report'\n    assert not (folder/'new.rgba').exists()\n\n    # Simulate report collision after the preflight with the publishing helper.\n    late=folder/'late.json'\n    late.write_bytes(b'created-by-another-writer')\n    try:\n        module.publish_candidate_pair(folder/'late.rgba',late,b'test-bytes',{'test':True})\n    except FileExistsError:\n        pass\n    else:\n        raise AssertionError('accepted late report collision')\n    assert not (folder/'late.rgba').exists()\n    assert late.read_bytes()==b'created-by-another-writer'\n\n    # Path replacement during cleanup must not remove a file we did not create.\n    replaced=folder/'replaced.rgba'\n    other=folder/'replacement.rgba'\n    def replace_then_fail(value, output, *args, **kwargs):\n        replaced.unlink()\n        other.write_bytes(b'other-owner')\n        other.rename(replaced)\n        raise OSError('injected replacement race')\n    module.json.dump=replace_then_fail\n    try:\n        try:\n            module.decode(source,replaced,folder/'replaced.json')\n        except OSError as error:\n            assert 'replacement race' in str(error)\n        else:\n            raise AssertionError('expected replacement')\n    finally:\n        module.json.dump=original_dump\n    assert replaced.read_bytes()==b'other-owner'\n    assert not (folder/'replaced.json').exists()\n\n    # A dangling symlink must not resolve into a writable destination.\n    link=folder/'dangling.rgba'\n    target=folder/'external-never-create.rgba'\n    try:\n        link.symlink_to(target)\n    except (NotImplementedError,OSError):\n        pass\n    else:\n        result=module.main(['decode-real-photo.py',str(source),str(link),\n                            str(folder/'link-report.json')])\n        assert result==1\n        assert link.is_symlink()\n        assert not target.exists()\n        assert not (folder/'link-report.json').exists()\nprint('OK decoder output rollback and symlink rejection')";
  const output=spawnSync(python,['-c',runner,decoder],{
    encoding:'utf8',timeout:30000,maxBuffer:1024*1024,
  });
  assert.equal(output.status,0,output.stderr||output.stdout);
  assert.match(output.stdout,/OK decoder output rollback and symlink rejection/);
});
