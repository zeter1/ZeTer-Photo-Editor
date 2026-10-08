export function createPointerLifecycleRouter({
  target,
  eventTarget = target,
  shouldStartPointer = () => true,
  onPointerDown = () => {},
  onPointerMove = () => {},
  onPointerUp = () => {},
  onPointerCancel = () => {},
} = {}) {
  if (typeof target?.addEventListener !== 'function' || typeof eventTarget?.addEventListener !== 'function') {
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
  let activeStartToken = null;

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
    activeStartToken = null;
    if (typeof target.hasPointerCapture === 'function' && !target.hasPointerCapture(pointerId)) return true;
    try {
      target.releasePointerCapture(pointerId);
    } catch (error) {
      if (error?.name !== 'NotFoundError') throw error;
    }
    return true;
  }

  function abandonFailedStart(error, token) {
    // A late rejection must not release a newer gesture reusing the same pointerId.
    if (activeStartToken === token) releaseActivePointer();
    throw error;
  }

  function handlePointerDown(event) {
    if (hasActivePointer() || !shouldStartPointer(event)) return;
    const token = {};
    activePointerId = event.pointerId;
    activeStartToken = token;
    try {
      target.setPointerCapture(event.pointerId);
      const result = onPointerDown(event);
      return result && typeof result.then === 'function'
        ? Promise.resolve(result).catch(error => abandonFailedStart(error, token))
        : result;
    } catch (error) {
      return abandonFailedStart(error, token);
    }
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
    activeStartToken = null;
    return onPointerCancel(event, { reason:'lostpointercapture' });
  }

  eventTarget.addEventListener('pointerdown', handlePointerDown);
  eventTarget.addEventListener('pointermove', handlePointerMove);
  eventTarget.addEventListener('pointerup', handlePointerUp);
  eventTarget.addEventListener('pointercancel', handlePointerCancel);
  target.addEventListener('lostpointercapture', handleLostPointerCapture);

  return { isActivePointer, hasActivePointer, releaseActivePointer };
}
