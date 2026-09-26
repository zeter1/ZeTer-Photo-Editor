export function createPointerLifecycleRouter({
  target,
  shouldStartPointer = () => true,
  onPointerDown = () => {},
  onPointerMove = () => {},
  onPointerUp = () => {},
  onPointerCancel = () => {},
} = {}) {
  if (!target || typeof target.addEventListener !== 'function') {
    throw new TypeError('pointer lifecycle target is required');
  }
  if (typeof target.setPointerCapture !== 'function' || typeof target.releasePointerCapture !== 'function') {
    throw new TypeError('pointer lifecycle target must support pointer capture');
  }
  for (const [name, handler] of Object.entries({
    shouldStartPointer,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  })) {
    if (typeof handler !== 'function') throw new TypeError(`${name} must be a function`);
  }

  let activePointerId = null;

  function isActivePointer(pointerId) {
    return activePointerId === pointerId;
  }

  function hasActivePointer() {
    return activePointerId !== null;
  }

  function releaseActivePointer() {
    if (activePointerId === null) return false;
    const pointerId = activePointerId;
    activePointerId = null;
    if (typeof target.hasPointerCapture === 'function' && !target.hasPointerCapture(pointerId)) return true;
    try {
      target.releasePointerCapture(pointerId);
    } catch (error) {
      if (error?.name !== 'NotFoundError') throw error;
    }
    return true;
  }

  function handlePointerDown(event) {
    if (hasActivePointer() || !shouldStartPointer(event)) return;
    activePointerId = event.pointerId;
    try {
      target.setPointerCapture(event.pointerId);
    } catch (error) {
      activePointerId = null;
      throw error;
    }
    return onPointerDown(event);
  }

  function handlePointerMove(event) {
    if (hasActivePointer() && !isActivePointer(event.pointerId)) return;
    return onPointerMove(event);
  }

  function handlePointerUp(event) {
    if (!isActivePointer(event.pointerId)) return;
    try {
      return onPointerUp(event);
    } finally {
      releaseActivePointer();
    }
  }

  function handlePointerCancel(event) {
    if (!isActivePointer(event.pointerId)) return;
    try {
      return onPointerCancel(event, { reason:'pointercancel' });
    } finally {
      releaseActivePointer();
    }
  }

  function handleLostPointerCapture(event) {
    if (!isActivePointer(event.pointerId)) return;
    activePointerId = null;
    return onPointerCancel(event, { reason:'lostpointercapture' });
  }

  target.addEventListener('pointerdown', handlePointerDown);
  target.addEventListener('pointermove', handlePointerMove);
  target.addEventListener('pointerup', handlePointerUp);
  target.addEventListener('pointercancel', handlePointerCancel);
  target.addEventListener('lostpointercapture', handleLostPointerCapture);

  return { isActivePointer, hasActivePointer, releaseActivePointer };
}
