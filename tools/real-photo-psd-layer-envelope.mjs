// 037B2b-3g: strict raw PSD16/PSB32 one-layer fixture metadata gate.
// Test/fixture-only. This is not a generic Photoshop parser or third-party oracle.
// The PSD layer codec may normalize unsupported metadata; verify the original
// bytes before accepting a separately pinned native-layer/merged-pixel hash.
const fail=message=>{throw new TypeError('037 photo PSD/PSB: '+message);};
const name='Pinned photo defect (8-bit derived)';

class Reader {
  constructor(data) {
    this.bytes=data;
    this.view=new DataView(data.buffer,data.byteOffset,data.byteLength);
    this.offset=0;
  }
  take(length) {
    if(!Number.isSafeInteger(length) || length<0 ||
       length>this.bytes.length-this.offset)
      fail('truncated or oversized layer section');
    const start=this.offset;
    this.offset+=length;
    return this.bytes.subarray(start,this.offset);
  }
  uint8() {const start=this.offset;this.take(1);return this.view.getUint8(start);}
  uint16() {const start=this.offset;this.take(2);return this.view.getUint16(start,false);}
  int16() {const start=this.offset;this.take(2);return this.view.getInt16(start,false);}
  uint32() {const start=this.offset;this.take(4);return this.view.getUint32(start,false);}
  int32() {const start=this.offset;this.take(4);return this.view.getInt32(start,false);}
  uint64() {
    const hi=this.uint32(),lo=this.uint32();
    const value=hi*0x100000000+lo;
    if(!Number.isSafeInteger(value)) fail('unsafe PSB section length');
    return value;
  }
  length(version) {return version===2?this.uint64():this.uint32();}
  nested(length) {return new Reader(this.take(length));}
  expectAscii(expected,label) {
    const part=this.take(expected.length);
    for(let i=0;i<expected.length;i++)
      if(part[i]!==expected.charCodeAt(i)) fail(label);
  }
  expectZeros(length,label) {
    for(const value of this.take(length))
      if(value!==0) fail(label);
  }
  done() {
    if(this.offset!==this.bytes.length) fail('unexpected trailing layer metadata');
  }
}

function verifyLayerExtra(extra) {
  if(extra.uint32()!==0) fail('unexpected layer mask payload');
  if(extra.uint32()!==0) fail('unexpected layer blending ranges');
  const count=extra.uint8();
  if(count!==name.length) fail('unexpected Pascal layer name');
  extra.expectAscii(name,'unexpected Pascal layer name');
  extra.expectZeros((4-(1+count)%4)%4,'invalid Pascal name padding');
  extra.expectAscii('8BIM','expected Unicode layer name block');
  extra.expectAscii('luni','expected Unicode layer name block');
  const unicode=extra.nested(extra.uint32());
  if(unicode.uint32()!==name.length) fail('unexpected Unicode layer name length');
  for(const char of name)
    if(unicode.uint16()!==char.charCodeAt(0))
      fail('unexpected Unicode layer name');
  const remainder=unicode.bytes.length-unicode.offset;
  if(remainder>3 || (4+name.length*2+remainder)%4!==0)
    fail('invalid Unicode layer name padding');
  unicode.expectZeros(remainder,'invalid Unicode layer name padding');
  unicode.done();
  extra.done();
}

function verifyLayerInfo(info,version,width,height,bitsPerChannel) {
  if(info.int16()!==-1) fail('expected one RGBA layer with merged transparency');
  if(info.int32()!==0 || info.int32()!==0 ||
     info.int32()!==height || info.int32()!==width)
    fail('unexpected full-canvas layer bounds');
  if(info.uint16()!==4) fail('expected four RGBA channels');
  const planeLength=2+width*height*(bitsPerChannel/8);
  const channelIds=new Set();
  for(let i=0;i<4;i++) {
    const id=info.int16(),length=info.length(version);
    if(![0,1,2,-1].includes(id) || channelIds.has(id))
      fail('duplicate or unknown layer channel');
    if(length!==planeLength)
      fail('non-raw, missing or oversized layer plane');
    channelIds.add(id);
  }
  info.expectAscii('8BIM','invalid layer blend signature/mode');
  info.expectAscii('norm','invalid layer blend signature/mode');
  if(info.uint8()!==255 || info.uint8()!==0)
    fail('unexpected layer opacity or clipping');
  if(info.uint8()!==0x08 || info.uint8()!==0)
    fail('unexpected layer flags or filler');
  verifyLayerExtra(info.nested(info.uint32()));
  for(let i=0;i<4;i++) {
    const plane=info.nested(planeLength);
    if(plane.uint16()!==0) fail('compressed layer channel not supported');
    plane.take(planeLength-2);
    plane.done();
  }
  const padding=info.bytes.length-info.offset;
  if(padding>3) fail('unexpected trailing layer metadata');
  info.expectZeros(padding,'invalid layer-info padding');
  info.done();
}

/** Exact expected raw one-layer metadata, not general PSD/PSB eligibility. */
export function verifyRawPhotoLayerEnvelope(bytes,{version,width,height,bitsPerChannel}={}) {
  if(!(bytes instanceof Uint8Array) || bytes.byteLength<40 ||
     bytes.byteLength>48*1024*1024 ||
     !((version===1 && bitsPerChannel===16) ||
       (version===2 && bitsPerChannel===32)) ||
     !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
     width<=0 || height<=0 || width*height>2_000_000)
    fail('invalid raw layer envelope input');
  const reader=new Reader(bytes);
  reader.take(26); // Header validation is owned by inspectPsdHeader in caller.
  if(reader.uint32()!==0) fail('unexpected color mode data');
  if(reader.uint32()!==0) fail('unexpected image resources');
  const mask=reader.nested(reader.length(version));
  if(mask.length(version)!==0) fail('unexpected ordinary layer-info payload');
  if(mask.uint32()!==0) fail('unexpected global layer mask');
  mask.expectAscii(version===1?'8BIM':'8B64','invalid high-depth tagged block signature');
  mask.expectAscii(bitsPerChannel===16?'Lr16':'Lr32','missing depth-specific layer block');
  const bodyLength=mask.length(version);
  verifyLayerInfo(mask.nested(bodyLength),version,width,height,bitsPerChannel);
  if(bodyLength%2!==0) mask.expectZeros(1,'invalid tagged layer padding');
  mask.done();
  return true;
}
