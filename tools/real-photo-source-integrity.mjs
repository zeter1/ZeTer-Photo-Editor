// 037B: byte-level admission gate for a licensed, photographed JPEG.
// This parser validates the JPEG header, NOT the entropy stream, decoder,
// ICC conversion, photograph provenance, or Photoshop interoperability.
import {createHash} from 'node:crypto';
import {parseExifOrientation} from './real-photo-exif-orientation.mjs';

const SHA1=/^[0-9a-f]{40}$/, SHA256=/^[0-9a-f]{64}$/;
// The original Wikimedia JPEG has 434 non-JPEG trailing bytes AFTER its EOI.
// Exception applies only to the exact Commons SHA-1, total size and EOI offset;
// arbitrary JPEGs and unit-policy overrides must still terminate at EOI.
const COMMONS_ORIGINAL_SHA1='c7fc9f013c70e01f164d232462ddd6e37e4079c4';
const COMMONS_ORIGINAL_BYTES=2783744;
const COMMONS_ORIGINAL_EOI_OFFSET=2783308;
const MAX_SOURCE_BYTES=32*1024*1024;
const fail=message=>{throw new TypeError('037 photo source: '+message);};

export function inspectPhotoJpeg(bytes,{expectedSha1,expectedWidth,expectedHeight}={}) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength<16 ||
      bytes.byteLength>MAX_SOURCE_BYTES ||
      !SHA1.test(expectedSha1??'') ||
      !Number.isSafeInteger(expectedWidth) || expectedWidth<240 || expectedWidth>10000 ||
      !Number.isSafeInteger(expectedHeight) || expectedHeight<240 || expectedHeight>10000) {
    fail('invalid source bytes, pinned SHA-1, or expected dimensions');
  }
  const source=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const sha1=createHash('sha1').update(source).digest('hex');
  if (sha1!==expectedSha1) fail('original JPEG SHA-1 mismatch');
  const lastEoiOffset=source.lastIndexOf(Buffer.from([0xff,0xd9]));
  const trailingBytes=lastEoiOffset<0?-1:bytes.length-lastEoiOffset-2;
  const hasExactEoi=trailingBytes===0;
  const isDocumentedCommonsTrailer=sha1===COMMONS_ORIGINAL_SHA1 &&
    bytes.length===COMMONS_ORIGINAL_BYTES &&
    lastEoiOffset===COMMONS_ORIGINAL_EOI_OFFSET && trailingBytes===434;
  if(bytes[0]!==0xff || bytes[1]!==0xd8 ||
      (!hasExactEoi && !isDocumentedCommonsTrailer))
    fail('missing JPEG SOI/EOI markers or untrusted trailing bytes');

  let pos=2,frame=null,sawScan=false,hasExif=false,hasIcc=false;
  let exifOrientation=null;
  let iccSegmentCount=null;
  const iccParts=new Set();
  while(pos<bytes.length-2) {
    if(bytes[pos++]!==0xff) fail('malformed JPEG marker sequence');
    while(pos<bytes.length && bytes[pos]===0xff) pos++;
    const marker=bytes[pos++];
    if (!Number.isInteger(marker) || marker===0x00 || marker===0xd8 ||
        marker===0xd9 || (marker>=0xd0&&marker<=0xd7))
      fail('unsupported JPEG marker before scan');
    if(pos+2>bytes.length-2) fail('truncated JPEG segment length');
    const length=(bytes[pos]<<8)|bytes[pos+1];
    if(length<2 || pos+length>bytes.length-2) fail('truncated JPEG segment');
    const data=pos+2, end=pos+length;
    if(marker===0xe1 && end-data>=4 &&
       bytes[data]===0x45 && bytes[data+1]===0x78 &&
       bytes[data+2]===0x69 && bytes[data+3]===0x66) {
      if(end-data<14 || bytes[data+4]!==0 || bytes[data+5]!==0)
        fail('malformed EXIF APP1 signature');
      if(hasExif) fail('duplicate EXIF APP1 segment');
      hasExif=true;
      exifOrientation=parseExifOrientation(bytes,data+6,end);
    }
    // Detect corrupt/partial ICC multipart headers before admitting JPEG data.
    if(marker===0xe2 && end-data>=11 &&
       Buffer.from(bytes.buffer,bytes.byteOffset+data,11).toString('ascii')==='ICC_PROFILE') {
      if(end-data<15 || bytes[data+11]!==0)
        fail('malformed ICC APP2 header or empty chunk');
      const part=bytes[data+12],total=bytes[data+13];
      if(part<1 || total<1 || part>total ||
         (iccSegmentCount!==null && total!==iccSegmentCount) ||
         iccParts.has(part))
        fail('invalid ICC APP2 part numbering');
      iccSegmentCount=total;
      iccParts.add(part);
      hasIcc=true;
    }
    if([0xc0,0xc1,0xc2].includes(marker)) {
      if(frame || end-data<6) fail('duplicate or truncated JPEG SOF');
      const height=(bytes[data+1]<<8)|bytes[data+2];
      const width=(bytes[data+3]<<8)|bytes[data+4];
      const components=bytes[data+5];
      frame={width,height,components,precision:bytes[data],progressive:marker===0xc2};
    } else if(marker>=0xc0 && marker<=0xcf && marker!==0xc4 && marker!==0xc8 && marker!==0xcc) {
      fail('unsupported JPEG frame encoding');
    }
    pos=end;
    if(marker===0xda) {sawScan=true;break;}
  }
  if(iccSegmentCount!==null && iccParts.size!==iccSegmentCount)
    fail('incomplete ICC APP2 profile');
  if(!frame || !sawScan || pos>=bytes.length-2 ||
     frame.width!==expectedWidth || frame.height!==expectedHeight ||
     frame.precision!==8 || frame.components!==3) {
    fail('JPEG frame/scan, dimensions, channels or precision mismatch');
  }
  return Object.freeze({
    kind:'zpe-real-photo-jpeg-source-v1',
    sha1,sha256:createHash('sha256').update(source).digest('hex'),
    bytes:bytes.byteLength,width:frame.width,height:frame.height,
    components:frame.components,precision:frame.precision,
    progressive:frame.progressive,hasExif,exifOrientation,hasIcc,
    jpegTrailingBytes:trailingBytes,
    pixelDecodeVerified:false,colorSpaceVerified:false,
  });
}

// A SHA-1-only image, or just a mutable URL, cannot qualify as a frozen fixture.
// Call this AFTER obtaining an independent pinned SHA-256 from inspection.
export function verifyPinnedPhotoJpeg(bytes,{expectedSha256,...options}={}) {
  if(!SHA256.test(expectedSha256??'')) fail('pinned source SHA-256 required');
  const info=inspectPhotoJpeg(bytes,options);
  if(info.sha256!==expectedSha256) fail('pinned source SHA-256 mismatch');
  return Object.freeze({...info,sha256Pinned:true});
}

// Decoder output must also be frozen: a matching JPEG hash alone does not
// establish the browser's orientation, color conversion, or RGBA pixels.
export function verifyPinnedDecodedRgba(rgba,{
  width,height,expectedRgbaSha256,requireOpaque=true,
}={}) {
  if(!(rgba instanceof Uint8Array) ||
     !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
     width<240 || height<240 || width>10000 || height>10000 ||
     rgba.byteLength!==width*height*4 ||
     !SHA256.test(expectedRgbaSha256??'')) fail('invalid RGBA decode or pinned hash');
  const digest=createHash('sha256')
    .update(Buffer.from(rgba.buffer,rgba.byteOffset,rgba.byteLength)).digest('hex');
  if(digest!==expectedRgbaSha256) fail('decoded RGBA SHA-256 mismatch');
  if(requireOpaque) for(let i=3;i<rgba.length;i+=4)
    if(rgba[i]!==255) fail('unexpected transparency in photo decode');
  return Object.freeze({kind:'zpe-real-photo-decoded-rgba-v1',width,height,
    sha256:digest,channels:4,bytes:rgba.byteLength,alphaOpaque:requireOpaque,
    colorSpaceVerified:false});
}
