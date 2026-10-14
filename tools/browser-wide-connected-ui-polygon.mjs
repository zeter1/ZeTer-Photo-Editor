// 036B: public polygon-selection gesture for two native-defect islands linked by
// a diagonal subpixel corridor. The 0.25px half-width bridges 8-neighbours
// without selecting adjacent pixel CENTERS (the production predicate samples
// at x + 0.5, y + 0.5). Test-only, not persisted in project/private state.
import { createWideConnectedRoiIndices } from './browser-wide-connected-native-evidence.mjs';

export function createWideConnectedUiPolygon(width,height,{x=0,y=0}={}) {
  // Keep geometry and its bounds tied to the same canonical 036A oracle.
  createWideConnectedRoiIndices(width,height,{x,y});
  const p=(dx,dy)=>({x:x+dx,y:y+dy});
  return {
    type:'polygon',
    points:[
      p(16,16),p(80,16),p(80,79.75),
      p(176.25,176),p(240,176),p(240,240),
      p(176,240),p(176,176.25),p(79.75,80),p(16,80),
    ],
  };
}
