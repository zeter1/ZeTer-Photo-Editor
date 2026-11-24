import test from 'node:test';
import assert from 'node:assert/strict';
import { pointInSelection } from '../src/core/geometry.js';
import { createWideConnectedRoiIndices } from '../tools/browser-wide-connected-native-evidence.mjs';
import { createWideConnectedUiPolygon } from '../tools/browser-wide-connected-ui-polygon.mjs';

for (const [width,height,x,y] of [[256,256,0,0],[1025,1025,392,392],[768,450,80,100]]) {
  test(`036B: actual polygon selection pixel centers match 8288-wide Worker ROI at ${width}x${height} (${x},${y})`,()=>{
    const polygon=createWideConnectedUiPolygon(width,height,{x,y});
    assert.equal(polygon.points.length,10);
    assert.equal(polygon.type,'polygon');
    const expected=createWideConnectedRoiIndices(width,height,{x,y});
    const obtained=[];
    for(let py=0;py<height;py++) for(let px=0;px<width;px++) {
      if(pointInSelection({x:px+0.5,y:py+0.5},polygon)) obtained.push(py*width+px);
    }
    assert.deepEqual(Uint32Array.from(obtained),expected,
      'public polygon must generate precise 8-connected islands + 96 diagonal pixels');
    const set=new Set(obtained);
    assert.equal(set.size,8288);
    assert.ok(set.has((y+80)*width+x+80));
    assert.ok(!set.has((y+80)*width+x+81));
  });
}
test('036B: reject out-of-bounds polygon origin instead of clipping connected island',()=>{
  assert.throws(()=>createWideConnectedUiPolygon(256,256,{x:17,y:17}),/bounds/);
  assert.throws(()=>createWideConnectedUiPolygon(1025,1025,{x:-1,y:0}),/bounds/);
});
