import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathControlSurfaceController } from '../src/interaction/path-control-surface-controller.js';

test('Pen retains explicit editing of an empty Saved Path until the first subpath is drawn', () => {
  const owner = { paths: [{ id: 2000, name: 'New path', subpaths: [] }], layers: [] };
  let editIndex = 0;
  const surface = createPathControlSurfaceController({
    state: {
      getDocument: () => owner,
      getDocumentPathEditIndex: () => editIndex,
      setDocumentPathEditIndex: value => { editIndex = value; },
      getVectorMaskEditLayerId: () => null,
    },
    runtime: {
      getCurrentTool: () => 'pen',
      getZoom: () => 1,
      hasPenDraft: () => false,
      hasActiveInteraction: () => false,
      setCursor: () => {},
    },
    geometry: { layerToDocument: point => point },
  });
  assert.equal(surface.hit({ x: 8, y: 8 }), null);
  assert.equal(surface.draw(null), false);
  assert.equal(editIndex, 0, 'empty path must remain an active Pen target');

  // The editor must still drop a stale target after the path is removed.
  owner.paths.splice(0, 1);
  assert.equal(surface.hit({ x: 8, y: 8 }), null);
  assert.equal(editIndex, -1);
});
