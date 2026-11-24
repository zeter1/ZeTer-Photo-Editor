import test from 'node:test';
import assert from 'node:assert/strict';
import {open,mkdtemp,readFile,rm,stat,symlink,writeFile,rename,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publishExclusivePhotoCandidate} from '../tools/photo-source-publication.mjs';

async function inTemp(run) {
  const folder=await mkdtemp(join(tmpdir(),'zpe-photo-publication-'));
  try { await run(folder); }
  finally { await rm(folder,{recursive:true,force:true}); }
}

const bytes=Buffer.from([0xff,0xd8,0x10,0x30,0x50,0xff,0xd9]);

test('037B2b-2g: exclusive publication writes the exact candidate, never overwrites',async()=>{
  await inTemp(async folder=>{
    const dest=join(folder,'original.jpg');
    await publishExclusivePhotoCandidate(dest,bytes);
    assert.deepEqual(await readFile(dest),bytes);
    if(process.platform!=='win32')
      assert.equal((await stat(dest)).mode&0o777,0o600);
    await assert.rejects(publishExclusivePhotoCandidate(dest,bytes),{code:'EEXIST'});
    assert.deepEqual(await readFile(dest),bytes);
    await assert.rejects(publishExclusivePhotoCandidate(dest,Buffer.alloc(0)),/arguments/);
  });
});

test('037B2b-2g: partial write rolls back only its new file before close',async()=>{
  await inTemp(async folder=>{
    const dest=join(folder,'partial.jpg');
    let closed=false;
    await assert.rejects(publishExclusivePhotoCandidate(dest,bytes,{
      openFile:async (...args)=>{
        const fh=await open(...args);
        return {
          stat:()=>fh.stat(),
          writeFile:async value=>{
            await fh.writeFile(value.subarray(0,3));
            throw new Error('injected partial write');
          },
          sync:()=>fh.sync(),
          close:async()=>{
            await assert.rejects(stat(dest),{code:'ENOENT'});
            closed=true;
            await fh.close();
          },
        };
      },
    }),/injected partial write/);
    assert.equal(closed,true);
    await assert.rejects(stat(dest),{code:'ENOENT'});
  });
});

test('037B2b-2g: sync failure also rolls back',async()=>{
  await inTemp(async folder=>{
    const dest=join(folder,'unsynced.jpg');
    await assert.rejects(publishExclusivePhotoCandidate(dest,bytes,{
      openFile:async (...args)=>{
        const fh=await open(...args);
        return {
          stat:()=>fh.stat(),
          writeFile:value=>fh.writeFile(value),
          sync:async()=>{throw new Error('injected fsync failure');},
          close:()=>fh.close(),
        };
      },
    }),/injected fsync failure/);
    await assert.rejects(stat(dest),{code:'ENOENT'});
  });
});

test('037B2b-2g: replacement during rollback is not deleted',async()=>{
  await inTemp(async folder=>{
    const dest=join(folder,'candidate.jpg');
    const other=join(folder,'unrelated.jpg');
    await assert.rejects(publishExclusivePhotoCandidate(dest,bytes,{
      openFile:async (...args)=>{
        const fh=await open(...args);
        return {
          stat:()=>fh.stat(),
          writeFile:async value=>{
            await fh.writeFile(value.subarray(0,2));
            await unlink(dest);
            await writeFile(other,'foreign-file');
            await rename(other,dest);
            throw new Error('injected path replacement');
          },
          sync:()=>fh.sync(),
          close:()=>fh.close(),
        };
      },
    }),/injected path replacement/);
    assert.equal(await readFile(dest,'utf8'),'foreign-file');
  });
});

test('037B2b-2g: occupied file and dangling symlink are never overwritten',async()=>{
  await inTemp(async folder=>{
    const dest=join(folder,'occupied.jpg');
    await writeFile(dest,'keep-me');
    await assert.rejects(publishExclusivePhotoCandidate(dest,bytes),{code:'EEXIST'});
    assert.equal(await readFile(dest,'utf8'),'keep-me');
    const link=join(folder,'dangling.jpg');
    const target=join(folder,'not-created.jpg');
    try { await symlink(target,link); }
    catch(error) { if(error.code==='EPERM') return; throw error; }
    await assert.rejects(publishExclusivePhotoCandidate(link,bytes),{code:'EEXIST'});
    await assert.rejects(stat(target),{code:'ENOENT'});
  });
});
