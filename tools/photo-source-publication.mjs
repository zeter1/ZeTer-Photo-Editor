// Test-only 037B2b-2g: publish an independently checked photo candidate.
// Exclusive creation is not crash-atomic (SIGKILL/power loss can leave a file).
import {open,lstat,unlink} from 'node:fs/promises';

export async function publishExclusivePhotoCandidate(path,bytes,{openFile=open}={}) {
  if(typeof path!=='string' || !path.trim() ||
     !(bytes instanceof Uint8Array) || !bytes.byteLength ||
     typeof openFile!=='function')
    throw new TypeError('037 photo acquisition: invalid candidate publication arguments');
  // wx/0600 rejects occupied paths, including dangling symlinks, without
  // reading or overwriting user-controlled output. The open fd pins our inode.
  const file=await openFile(path,'wx',0o600);
  let identity;
  try {
    identity=await file.stat();
    if(!identity.isFile())
      throw new TypeError('037 photo acquisition: output is not a regular file');
    await file.writeFile(bytes);
    await file.sync();
  } catch(writeError) {
    // Keep the fd alive while cleaning up: closing it first could recycle the
    // inode, accidentally treating an unrelated replacement as ours.
    try {
      if(identity) {
        let current;
        try { current=await lstat(path); }
        catch(error) { if(error.code!=='ENOENT') throw error; }
        if(current?.isFile() &&
           current.dev===identity.dev && current.ino===identity.ino)
          await unlink(path);
      }
    } catch(rollbackError) {
      throw new AggregateError([writeError,rollbackError],
        '037 photo acquisition: write failed and safe rollback was incomplete');
    } finally {
      await file.close();
    }
    throw writeError;
  }
  await file.close();
}
