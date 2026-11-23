// User-scoped RAW developing recipes. They never contain sensor bytes or raster previews.
export const RAW_PRESET_STORAGE_KEY='zeter.rawDevelopmentPresets.v1';
const MAX_PRESETS=16;
const MAX_STORAGE_BYTES=24000;
const LIMITS={exposure:[-5,5],wbRed:[0.25,4],wbBlue:[0.25,4],highlights:[-1,1],shadows:[-1,1],contrast:[-1,1]};
const DEMOSAIC=['bilinear','edge-aware-green','edge-aware-rgb'];

export function normalizeRawPresetDevelopment(source){
  if(!source||typeof source!=='object'||Array.isArray(source))return null;
  const result={};
  for(const [key,[min,max]] of Object.entries(LIMITS)){
    const value=key==='contrast' && source[key]===undefined ? 0 : source[key];
    if(typeof value!=='number'||!Number.isFinite(value))return null;
    result[key]=Math.max(min,Math.min(max,value));
  }
  const mode=source.demosaic??'bilinear';
  if(!DEMOSAIC.includes(mode))return null;
  result.demosaic=mode;
  return result;
}
export function normalizeRawPresetName(value){
  if(typeof value!=='string')return '';
  const name=value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' ');
  return name.length<=48?name:'';
}
export function readRawPresets(storage){
  try{
    const raw=storage?.getItem(RAW_PRESET_STORAGE_KEY);
    if(!raw||raw.length>MAX_STORAGE_BYTES)return [];
    const parsed=JSON.parse(raw);
    if(parsed?.schema!==1||!Array.isArray(parsed.presets)||parsed.presets.length>MAX_PRESETS)return [];
    const presets=[],names=new Set();
    for(const entry of parsed.presets){
      const name=normalizeRawPresetName(entry?.name);
      const development=normalizeRawPresetDevelopment(entry?.development);
      if(!name||!development||names.has(name.toLocaleLowerCase()))continue;
      names.add(name.toLocaleLowerCase());
      presets.push({name,development});
    }
    return presets;
  }catch{return [];} // Privacy mode, corrupt storage or disabled localStorage.
}
export function saveRawPreset(storage,name,development){
  const normalizedName=normalizeRawPresetName(name);
  const normalized=normalizeRawPresetDevelopment(development);
  if(!normalizedName||!normalized)return {ok:false,reason:'invalid'};
  const previous=readRawPresets(storage);
  const index=previous.findIndex(p=>p.name.toLocaleLowerCase()===normalizedName.toLocaleLowerCase());
  if(index<0&&previous.length>=MAX_PRESETS)return {ok:false,reason:'limit'};
  const presets=previous.slice();
  if(index>=0)presets[index]={name:normalizedName,development:normalized};
  else presets.push({name:normalizedName,development:normalized});
  try{
    if(typeof storage?.setItem!=='function')return {ok:false,reason:'storage'};
    storage.setItem(RAW_PRESET_STORAGE_KEY,JSON.stringify({schema:1,presets}));
    return {ok:true,presets};
  }catch{return {ok:false,reason:'storage'};}
}
export function deleteRawPreset(storage,name){
  const previous=readRawPresets(storage);
  const presets=previous.filter(p=>p.name!==name);
  if(previous.length===presets.length)return false;
  try{
    if(typeof storage?.setItem!=='function')return false;
    storage.setItem(RAW_PRESET_STORAGE_KEY,JSON.stringify({schema:1,presets}));
    return true;
  }catch{return false;}
}

export const RAW_PRESET_FILE_FORMAT='zeter-raw-development-presets';
const PORTABLE_KEYS=['format','schema','presets'];
const PRESET_KEYS=['name','development'];
const DEVELOPMENT_KEYS=[...Object.keys(LIMITS),'demosaic'];
const onlyKeys=(value,keys)=>value && typeof value==='object' && !Array.isArray(value) &&
  Object.keys(value).every(key=>keys.includes(key));

/** Portable v1 interchange: strict, small, named recipes only; never image or document bytes. */
export function parseRawPresetFile(text){
  if(typeof text!=='string' || new TextEncoder().encode(text).byteLength>MAX_STORAGE_BYTES)
    return {ok:false,reason:'size'};
  let source;
  try{source=JSON.parse(text);}catch{return {ok:false,reason:'invalid'};}
  if(!onlyKeys(source,PORTABLE_KEYS) || source.format!==RAW_PRESET_FILE_FORMAT ||
    source.schema!==1 || !Array.isArray(source.presets) ||
    source.presets.length===0 || source.presets.length>MAX_PRESETS)
    return {ok:false,reason:'invalid'};
  const names=new Set(),presets=[];
  for(const entry of source.presets){
    if(!onlyKeys(entry,PRESET_KEYS) || !onlyKeys(entry.development,DEVELOPMENT_KEYS))
      return {ok:false,reason:'invalid'};
    const name=normalizeRawPresetName(entry.name);
    const development=normalizeRawPresetDevelopment(entry.development);
    if(!name || name!==entry.name || !development || names.has(name.toLocaleLowerCase()))
      return {ok:false,reason:'invalid'};
    // Imported recipes must not be silently clamped: reject unsupported bounds.
    if(Object.entries(LIMITS).some(([key,[min,max]])=>
      (entry.development[key]!==undefined &&
        (entry.development[key]<min || entry.development[key]>max))))
      return {ok:false,reason:'invalid'};
    names.add(name.toLocaleLowerCase());
    presets.push({name,development});
  }
  return {ok:true,presets};
}
export function exportRawPresetFile(storage){
  const presets=readRawPresets(storage);
  if(!presets.length)return {ok:false,reason:'empty'};
  return {ok:true,filename:'ZeTer-RAW-presets.json',
    content:JSON.stringify({format:RAW_PRESET_FILE_FORMAT,schema:1,presets},null,2)+'\n'};
}
/** Atomic merge; existing names retain their slot, matching names are replaced only on confirmation in UI. */
export function importRawPresetFile(storage,text){
  const parsed=parseRawPresetFile(text);
  if(!parsed.ok)return parsed;
  try{
    if(typeof storage?.getItem!=='function'||typeof storage?.setItem!=='function')
      return {ok:false,reason:'storage'};
    const raw=storage.getItem(RAW_PRESET_STORAGE_KEY);
    const previous=readRawPresets(storage);
    // Do not erase corrupt local data when a migration is attempted.
    if(raw!==null && raw!==undefined){
      if(raw.length>MAX_STORAGE_BYTES)return {ok:false,reason:'storage'};
      const existing=JSON.parse(raw);
      if(existing?.schema!==1 || !Array.isArray(existing.presets) ||
        existing.presets.length!==previous.length)return {ok:false,reason:'storage'};
    }
    const presets=previous.slice();
    let added=0,overwritten=0;
    for(const entry of parsed.presets){
      const index=presets.findIndex(p=>p.name.toLocaleLowerCase()===entry.name.toLocaleLowerCase());
      if(index>=0){presets[index]=entry;overwritten++;}
      else{presets.push(entry);added++;}
    }
    if(presets.length>MAX_PRESETS)return {ok:false,reason:'limit'};
    const encoded=JSON.stringify({schema:1,presets});
    if(encoded.length>MAX_STORAGE_BYTES)return {ok:false,reason:'size'};
    storage.setItem(RAW_PRESET_STORAGE_KEY,encoded);
    return {ok:true,presets,added,overwritten};
  }catch{return {ok:false,reason:'storage'};}
}
