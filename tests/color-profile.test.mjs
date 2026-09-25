import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, sanitizeColorProfile, sanitizeColorManagement, sanitizeProject } from '../src/core/state.js';
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

test('Stage 13d persists bounded source/proof intents, display fallback and gamut policy',()=>{
  assert.deepEqual(sanitizeColorManagement(),{
    renderingIntent:'perceptual',proofRenderingIntent:'relative',displaySpace:'srgb',
    softProofEnabled:false,blackPointCompensation:true,gamutWarningEnabled:false,gamutWarningThreshold:3,
  });
  assert.deepEqual(sanitizeColorManagement({renderingIntent:'relative',proofRenderingIntent:'absolute',displaySpace:'srgb',gamutWarningEnabled:true,gamutWarningThreshold:4.25}),{
    renderingIntent:'relative',proofRenderingIntent:'absolute',displaySpace:'srgb',
    softProofEnabled:false,blackPointCompensation:true,gamutWarningEnabled:true,gamutWarningThreshold:4.3,
  });
  assert.equal(sanitizeColorManagement({gamutWarningThreshold:99}).gamutWarningThreshold,20);
  assert.equal(sanitizeColorManagement({gamutWarningThreshold:.1}).gamutWarningThreshold,.5);
  assert.equal(sanitizeColorManagement({proofRenderingIntent:'bad',displaySpace:'display-p3'}).proofRenderingIntent,'relative');
  assert.equal(sanitizeColorManagement({displaySpace:'display-p3'}).displaySpace,'srgb');
});

test('Stage 13d persists proof and display ICC profiles independently from the source ICC',()=>{
  const proof={
    kind:'icc',untagged:false,
    dataUrl:'data:application/vnd.iccprofile;base64,YWNzcA==',
    name:'Proof CMYK',version:'4.4',deviceClass:'prtr',colorSpace:'CMYK',pcs:'Lab',signatureValid:true,
  };
  const display={
    kind:'icc',untagged:false,
    dataUrl:'data:application/vnd.iccprofile;base64,YWNzcA==',
    name:'Display RGB',version:'4.4',deviceClass:'mntr',colorSpace:'RGB',pcs:'XYZ',signatureValid:true,
  };
  const doc=createDocument({name:'Production proof'});
  doc.proofProfile=proof;
  doc.displayProfile=display;
  doc.colorManagement={
    renderingIntent:'perceptual',proofRenderingIntent:'relative',displaySpace:'srgb',
    softProofEnabled:true,blackPointCompensation:false,gamutWarningEnabled:true,gamutWarningThreshold:3.5,
  };
  const safe=sanitizeProject(doc);
  assert.deepEqual(safe.proofProfile,proof);
  assert.deepEqual(safe.displayProfile,display);
  assert.deepEqual(safe.colorManagement,{
    renderingIntent:'perceptual',proofRenderingIntent:'relative',displaySpace:'srgb',
    softProofEnabled:true,blackPointCompensation:false,gamutWarningEnabled:true,gamutWarningThreshold:3.5,
  });
  assert.equal(sanitizeProject({...doc,proofProfile:{kind:'icc',dataUrl:'javascript:bad'}}).proofProfile,null);
  assert.equal(sanitizeProject({...doc,displayProfile:{kind:'icc',dataUrl:'javascript:bad'}}).displayProfile,null);
});
