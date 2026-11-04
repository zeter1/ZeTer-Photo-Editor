// Strict, bounded EXIF APP1/TIFF IFD0 Orientation reader for photo admission.
// `start` points just after the six-byte Exif\0\0 prefix; `end` is APP1 end.
// This does not decode JPEG pixels or verify the color transform.
const fail=message=>{throw new TypeError('037 photo source: '+message);};

export function parseExifOrientation(bytes,start,end) {
  if(!(bytes instanceof Uint8Array) ||
     !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
     start<0 || end>bytes.length || start+8>end)
    fail('truncated EXIF TIFF header');
  const little=bytes[start]===0x49 && bytes[start+1]===0x49;
  const big=bytes[start]===0x4d && bytes[start+1]===0x4d;
  if(!little && !big) fail('invalid EXIF byte order');
  const u16=i=>little
    ? bytes[i]+bytes[i+1]*256 : bytes[i]*256+bytes[i+1];
  const u32=i=>little
    ? bytes[i]+bytes[i+1]*256+bytes[i+2]*65536+bytes[i+3]*16777216
    : bytes[i]*16777216+bytes[i+1]*65536+bytes[i+2]*256+bytes[i+3];
  if(u16(start+2)!==42) fail('invalid EXIF TIFF magic');
  const offset=u32(start+4);
  if(offset<8 || offset>end-start-2) fail('invalid EXIF IFD0 offset');
  const directory=start+offset, count=u16(directory);
  if(count>512 || directory+2+count*12+4>end)
    fail('truncated or oversized EXIF IFD0');
  let orientation=null;
  for(let n=0;n<count;n++) {
    const entry=directory+2+n*12;
    if(u16(entry)!==0x0112) continue;
    if(orientation!==null) fail('duplicate EXIF Orientation');
    if(u16(entry+2)!==3 || u32(entry+4)!==1)
      fail('invalid EXIF Orientation type or count');
    orientation=u16(entry+8);
    if(orientation<1 || orientation>8)
      fail('invalid EXIF Orientation value');
  }
  return orientation;
}
