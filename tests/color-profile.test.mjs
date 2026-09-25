import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, sanitizeColorProfile, sanitizeProject } from '../src/core/state.js';
import { bytesToDataUrl, dataUrlToBytes } from '../src/core/io.js';

test('ICC binary data URL helpers round-trip bytes with a hard raw-size ceiling',()=>{
  const source=Uint8Array.from([0,1,2,127,128,254,255]);
  const url=bytesToDataUrl(source,'application/vnd.iccprofile');
  assert.match(url,/^data:application\/vnd\.iccprofile;base64,/);
  assert.deepEqual([...dataUrlToBytes(url,{maxBytes:source.length})],[...source]);
  assert.throws(()=>dataUrlToBytes(url,{maxBytes:source.length-1}),/превышает лимит/);
});

test('ICC profile metadata is bounded and survives project sanitization',()=>{
  const profile={
    kind:'icc',untagged:false,
    dataUrl:'data:application/vnd.iccprofile;base64,YWNzcA==',
    name:'Test ICC',version:'4.3.0',deviceClass:'mntr',colorSpace:'RGB',pcs:'XYZ',signatureValid:true,
  };
  assert.deepEqual(sanitizeColorProfile(profile),profile);
  const doc=createDocument({name:'ICC'});
  doc.colorProfile=profile;
  const safe=sanitizeProject(doc);
  assert.deepEqual(safe.colorProfile,profile);
  assert.equal(sanitizeColorProfile({kind:'icc',dataUrl:'javascript:alert(1)'}),null);
  assert.deepEqual(sanitizeColorProfile({kind:'untagged',untagged:true}),{kind:'untagged',untagged:true});
});
