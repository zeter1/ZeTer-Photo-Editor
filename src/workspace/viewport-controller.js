import { clamp, fitZoom } from '../core/geometry.js';

const VIEWPORT_MIN_ZOOM = 0.1;
const VIEWPORT_MAX_ZOOM = 16;
const VIEWPORT_ZOOM_EPSILON = 1e-6;
const VIEWPORT_FIT_PADDING = 90;

export function createViewportController({
  state = {},
  geometry = {},
  view = {},
  ui = {},
} = {}) {
  const {
    getZoom = () => 1,
    setZoom: writeZoom = () => {},
    getCurrentSession = () => null,
    getDocument = () => null,
  } = state;
  const { clientPointToCanvas = () => ({ x: 0, y: 0 }) } = geometry;
  const {
    viewport = null,
    overlay = null,
    updateCanvasSize = () => {},
    drawOverlay = () => {},
    requestFrame = callback => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(callback) : callback()),
  } = view;
  const { setStatus = () => {} } = ui;

  function publishZoom(next, announce = true) {
    const value = clamp(next, VIEWPORT_MIN_ZOOM, VIEWPORT_MAX_ZOOM);
    if (Math.abs(value - getZoom()) < VIEWPORT_ZOOM_EPSILON) return false;

    writeZoom(value);
    const session = getCurrentSession();
    if (session) session.zoom = value;
    updateCanvasSize();
    drawOverlay();
    if (announce) setStatus(`Масштаб ${Math.round(value * 100)}%`);
    return true;
  }

  function setZoom(next, announce = true) {
    publishZoom(next, announce);
  }

  function setZoomAtClientPoint(next, clientX, clientY) {
    const point = clientPointToCanvas(clientX, clientY);
    if (!publishZoom(next, false)) return;

    requestFrame(() => {
      const rect = overlay.getBoundingClientRect();
      const zoom = getZoom();
      viewport.scrollLeft += rect.left + point.x * zoom - clientX;
      viewport.scrollTop += rect.top + point.y * zoom - clientY;
    });
    setStatus(`Масштаб ${Math.round(getZoom() * 100)}%`);
  }

  function fitToView() {
    const rect = viewport.getBoundingClientRect();
    const documentValue = getDocument();
    setZoom(fitZoom(
      rect.width,
      rect.height,
      documentValue.width,
      documentValue.height,
      VIEWPORT_FIT_PADDING,
    ));
    viewport.scrollTo({ left: 0, top: 0 });
  }

  return { setZoom, setZoomAtClientPoint, fitToView };
}
